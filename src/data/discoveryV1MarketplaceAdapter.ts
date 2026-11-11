import type { PrilikaProjekcija } from '../contracts/projections';
import { novac } from '../lib/novac';
import { podrucjeTekst } from '../lib/location';
import { needScheduleText } from './needDetailPresentation';
import { readPublicNeedDetail } from './needClientService';
import { atLeast, dateRange, pointKey, publicBounds, remoteDiscoveryScope, type MarketplaceView, type PublicBounds } from './marketplaceView';
import { discoveryV1MinBudgetRsd, type DiscoveryV1Filter, type DiscoveryV1Item } from './discoveryV1Contract';
import type { DiscoveryV1MapResponse, DiscoveryV1PlaceRow, DiscoveryV1PlacesResponse } from './discoveryV1SpatialContract';
import type { DiscoveryV1Point, DiscoveryV1Scope } from './discoveryV1Owner';

/**
 * `mapBounds` are the bounds the person's own viewport or area already names. `mapSeed` is true when the map has neither yet (a
 * first visit, or a filter change before any camera exists): the session then asks the server for the whole-filter bounds once,
 * because the map is only mounted, and only fitted, from a MAP answer.
 */
export type DiscoveryV1ViewPlan = { filter: DiscoveryV1Filter; pageScope: DiscoveryV1Scope; mapBounds: PublicBounds | null; mapSeed: boolean; placesFacetArea: PublicBounds | null };
export type DiscoveryV1MapMarker =
  | { kind: 'TASK'; key: string; point: DiscoveryV1Point; taskId: string; taskCount: 1 }
  | { kind: 'PLACE'; key: string; point: DiscoveryV1Point; taskCount: number }
  | { kind: 'CLUSTER'; key: string; point: DiscoveryV1Point; taskCount: number; distinctPointCount: number; memberBounds: PublicBounds };

function pinPoint(value: string): DiscoveryV1Point {
  const match=/^(-?(?:0|[1-9]\d*)\.\d{2}),(-?(?:0|[1-9]\d*)\.\d{2})$/.exec(value);
  if(!match) throw new Error('DISCOVERY_V1_VIEW_PIN_INVALID');
  const point={lat:Number(match[1]),lng:Number(match[2])};
  if(!Number.isFinite(point.lat)||!Number.isFinite(point.lng)||Math.abs(point.lat)>90||Math.abs(point.lng)>180||pointKey(point)!==value)
    throw new Error('DISCOVERY_V1_VIEW_PIN_INVALID');
  return point;
}
export function discoveryV1PointMembersScope(key: string): { kind: 'POINT_MEMBERS'; point: DiscoveryV1Point } {
  return { kind:'POINT_MEMBERS', point:pinPoint(key) };
}
export function discoveryV1ViewPlan(view: MarketplaceView): DiscoveryV1ViewPlan {
  const scoped=remoteDiscoveryScope(view), dates=dateRange(scoped.dates);
  const minBudgetRsd=discoveryV1MinBudgetRsd(scoped.minBudgetRsd);
  if(minBudgetRsd!==undefined&&scoped.price==='OFFERS')throw new Error('DISCOVERY_V1_MIN_BUDGET_PRICE_MODE');
  const filter:DiscoveryV1Filter={ text:scoped.query, price:scoped.price, where:scoped.where ?? 'any', places:atLeast(scoped.places),
    when:dates ? 'any' : scoped.when ?? 'any', dates,
    place:scoped.where==='remote' ? null : typeof scoped.place==='string' && scoped.place.trim() ? scoped.place : null,
    // Only "Za mene" ON is a key of the request: off, the request is the one the server has always read.
    ...(scoped.forMe===true ? { forMe:true as const } : {}),
    ...(minBudgetRsd!==undefined ? { minBudgetRsd } : {}) };
  let pageScope:DiscoveryV1Scope={kind:'ALL'};
  if(scoped.where!=='remote' && scoped.pinPlace) pageScope={kind:'POINT_LIST',point:pinPoint(scoped.pinPlace)};
  else if(scoped.where!=='remote' && scoped.area) {
    const bounds=publicBounds(scoped.area); if(!bounds) throw new Error('DISCOVERY_V1_VIEW_AREA_INVALID');
    pageScope={kind:'AREA',bounds};
  }
  const mapBounds=scoped.where==='remote' ? null : publicBounds(scoped.viewport?.bounds) ?? publicBounds(scoped.area);
  const placesFacetArea=scoped.where==='remote' ? null : publicBounds(scoped.area);
  return {filter,pageScope,mapBounds,mapSeed:scoped.where!=='remote'&&mapBounds===null,placesFacetArea};
}
function rawItem(item:DiscoveryV1Item):Record<string,unknown>{
  return { id:item.id,title:item.title,status:item.status,urgent:item.urgent,category:item.category,schedule_kind:item.scheduleKind,
    starts_at:item.startsAt,ends_at:item.endsAt,execution_location_mode:item.executionLocationMode,
    approximate_area:item.approximateArea ?? '',approximate_city:item.approximateCity ?? '',approximate_lat:item.pin?.lat ?? null,
    approximate_lng:item.pin?.lng ?? null,required_slots:item.requiredSlots,covered_slots:item.coveredSlots,
    required_skills:item.requiredSkills,required_tools:item.requiredTools,required_vehicles:item.requiredVehicles,
    required_licenses:item.requiredLicenses,minimum_experience_years:item.minimumExperienceYears,
    verified_identity_required:item.verifiedIdentityRequired,task_country_code:item.taskCountryCode,task_timezone:item.taskTimezone,
    mode:item.priceMode,requester_price_rsd:item.requesterPriceRsd,price_basis:item.priceBasis,requester_profile_id:item.requesterProfileId,
    response_deadline:item.responseDeadline,remaining_search_closed_at:null,description:'',
    need_geography:item.publicTopology===null?null:{public_topology:item.publicTopology},
    need_requirement_details:item.criticalConditions===null?null:{critical_conditions:item.criticalConditions} };
}
/**
 * EX-03 (client work per settle): a decoded row is never changed after the decoder made it, so its card projection is made once per row
 * object and handed out again (a settle used to convert every row eight times: the held picture, the session, the overlay, every commit).
 * The same object also lets the list keep its memoised rows. Nothing may mutate what this returns.
 */
const opportunities=new WeakMap<DiscoveryV1Item,PrilikaProjekcija & {revision:number}>();
/** Core task facts only. Optional profile/rating/avatar/urgency reads are bounded overlays and never membership authority. */
export function discoveryV1Opportunity(item:DiscoveryV1Item):PrilikaProjekcija & {revision:number}{
  const known=opportunities.get(item);
  if(known) return known;
  const made=projectOpportunity(item);
  opportunities.set(item,made);
  return made;
}
function projectOpportunity(item:DiscoveryV1Item):PrilikaProjekcija & {revision:number}{
  const raw=rawItem(item), {detail,schedule}=readPublicNeedDetail(raw as Record<string,any>);
  const remote=detail.rezimLokacije==='REMOTE', covered=Math.min(item.requiredSlots,item.coveredSlots);
  return { id:item.id,revision:item.revision,naslov:item.title,opis:'',detalji:detail,statusTekst:'Traži ponude',
    primaNovePrijave:item.acceptsApplications,rokZaPrijaveIso:item.responseDeadline,
    podrucjeTekst:remote?'Na daljinu':podrucjeTekst(item.approximateArea,item.approximateCity),
    taskCountryCode:item.taskCountryCode ?? undefined,taskTimezone:item.taskTimezone ?? undefined,schedule,
    vremeTekst:needScheduleText(schedule,item.taskTimezone ?? undefined),
    pokrivenost:{ukupno:item.requiredSlots,popunjeno:covered,preostalo:Math.max(0,item.requiredSlots-covered),udeo:item.requiredSlots?covered/item.requiredSlots:0},
    uslovi:[...item.requiredSkills,...item.requiredTools,...item.requiredVehicles],
    narucilacProfilId:item.requesterProfileId,narucilacAvatarId:null,narucilacIme:'',narucilacOcena:null,narucilacBrojOcena:null,
    priblizno:remote||!item.pin?null:{lat:item.pin.lat,lng:item.pin.lng},rezimCene:item.priceMode,osnovaCene:item.priceBasis,
    ponudjenaCena:item.requesterPriceRsd===null?undefined:{iznos:item.requesterPriceRsd,valuta:'RSD',prikaz:novac(item.requesterPriceRsd)} };
}
export const discoveryV1Opportunities=(items:readonly DiscoveryV1Item[])=>items.map(discoveryV1Opportunity);
export function discoveryV1EnrichmentTargets(items:readonly DiscoveryV1Item[], limit=100){
  if(!Number.isSafeInteger(limit)||limit<1||limit>100||items.length>limit) throw new Error('DISCOVERY_V1_ENRICHMENT_BOUND');
  return {needIds:[...new Set(items.map(item=>item.id))],profileIds:[...new Set(items.map(item=>item.requesterProfileId))]};
}
export const discoveryV1PlaceSuggestions=(response:Pick<DiscoveryV1PlacesResponse,'items'>):DiscoveryV1PlaceRow[] => response.items.map(item=>({...item}));
export function discoveryV1MapMarkers(response:DiscoveryV1MapResponse):DiscoveryV1MapMarker[]{
  return response.buckets.map(bucket=>bucket.kind==='TASK'
    ? {kind:'TASK',key:bucket.key,point:{...bucket.point},taskId:bucket.taskId,taskCount:1}
    : bucket.kind==='PLACE' ? {kind:'PLACE',key:bucket.key,point:{...bucket.point},taskCount:bucket.taskCount}
    : {kind:'CLUSTER',key:bucket.key,point:{...bucket.point},taskCount:bucket.taskCount,distinctPointCount:bucket.distinctPointCount,
      memberBounds:[...bucket.memberBounds] as PublicBounds});
}
