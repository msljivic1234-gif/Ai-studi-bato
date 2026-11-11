import type { MarketplaceView, PublicBounds } from './marketplaceView';
import { pointKey, publicBounds } from './marketplaceView';
import { createDiscoveryV1Owner, wireBounds, type DiscoveryV1OwnerTransport, type DiscoveryV1PageState, type DiscoveryV1PlacesState,
  type DiscoveryV1Point } from './discoveryV1Owner';
import { discoveryV1MapMarkers, discoveryV1Opportunities, discoveryV1PlaceSuggestions, discoveryV1ViewPlan,
  type DiscoveryV1MapMarker } from './discoveryV1MarketplaceAdapter';
import type { PrilikaProjekcija } from '../contracts/projections';
import type { DiscoveryV1Counts, DiscoveryV1Availability, DiscoveryV1Item } from './discoveryV1Contract';
import type { DiscoveryV1MapResponse, DiscoveryV1PlacesResponse, DiscoveryV1PlaceRow } from './discoveryV1SpatialContract';
import { readFailureReason, type ReadFailureReason } from './readFailure';

type DiscoveryV1MapCounts = DiscoveryV1MapResponse['counts'];
type DiscoveryV1PlaceCounts = DiscoveryV1PlacesResponse['counts'];
export type DiscoveryV1MapRead = { loading: boolean; error: ReadFailureReason | null };

export type DiscoveryV1Peek =
  | { kind: 'TASK'; item: PrilikaProjekcija & { revision: number } }
  | { kind: 'PLACE'; point: DiscoveryV1Point; items: (PrilikaProjekcija & { revision: number })[]; totalCount: number };

export type DiscoveryV1ScreenSnapshot = {
  active: boolean;
  view: MarketplaceView | null;
  /** Strict public PAGE rows retained for bounded optional overlay ownership. */
  wireItems: DiscoveryV1Item[];
  items: (PrilikaProjekcija & { revision: number })[];
  mapMarkers: DiscoveryV1MapMarker[];
  mapWholeBounds: PublicBounds | null;
  /** MAP transport/contract state only. Native map style readiness has its own owner. */
  mapRead: DiscoveryV1MapRead;
  places: DiscoveryV1PlaceRow[];
  peek: DiscoveryV1Peek | null;
  /** Only a successful EXACT_PUBLIC read for the current TASK choice can authorize its map price. */
  exactTaskId: string | null;
  /** Only a successful POINT_MEMBERS read for this selected place can authorize its row price words. */
  verifiedPlaceKey: string | null;
  counts: DiscoveryV1Counts | null;
  availability: DiscoveryV1Availability | null;
  mapCounts: DiscoveryV1MapCounts | null;
  placeCounts: DiscoveryV1PlaceCounts | null;
  pageHasMore: boolean;
  memberHasMore: boolean;
  placeHasMore: boolean;
};
export type DiscoveryV1SelectionResult =
  | { kind: 'TASK' | 'PLACE'; applied: boolean }
  | { kind: 'CLUSTER'; bounds: PublicBounds }
  | { kind: 'stale' };

/**
 * A settled region this close to what the map was last read over (a fraction of its larger span) needs no new read: the camera came back
 * to where the read already is, as on a return to the screen, and the buckets on it are the ones the person would see.
 */
export const DISCOVERY_V1_MAP_REFRESH_TOLERANCE = 0.02;
function nearBounds(a: readonly number[], b: readonly number[]) {
  const span = Math.max(a[2] - a[0], a[3] - a[1], b[2] - b[0], b[3] - b[1], 1e-6), tolerance = span * DISCOVERY_V1_MAP_REFRESH_TOLERANCE;
  return a.every((value, index) => Math.abs(value - b[index]) <= tolerance);
}

/**
 * The first MAP request of a view with no viewport or area covers the whole world. It exists only to learn the server's
 * whole-filter bounds (the map mounts and fits from them); the markers for the fitted area come from a second request over
 * exactly those bounds, so the first picture is not one world-sized bucket.
 */
export const DISCOVERY_V1_SEED_BOUNDS: PublicBounds = [-180, -90, 180, 90];

function cloneView(view: MarketplaceView): MarketplaceView {
  return {
    ...view,
    area: view.area ? [...view.area] as PublicBounds : null,
    dates: view.dates ? { ...view.dates } : null,
    viewport: view.viewport ? { ...view.viewport, center: [...view.viewport.center] as [number, number],
      bounds: [...view.viewport.bounds] as PublicBounds } : null,
  };
}
function bounds(value: readonly number[]): PublicBounds {
  const valid=publicBounds(value);
  if(!valid) throw new Error('DISCOVERY_V1_SCREEN_BOUNDS');
  return valid;
}

/**
 * P6 screen state. It owns how list/map/filter/pin/places share one server anchor. The Zadaci route mounts it (through
 * DiscoveryV1Route) only in a build compiled with the P6 reader, against a backend that carries the P6 rollout.
 */
export function createDiscoveryV1ScreenSession(transport: DiscoveryV1OwnerTransport, isCurrent: () => boolean = () => true) {
  const owner=createDiscoveryV1Owner(transport,isCurrent);
  let view:MarketplaceView|null=null, peek:DiscoveryV1Peek|null=null, exactTaskId:string|null=null, verifiedPlaceKey:string|null=null, selectionSequence=0, priceGeneration=0;
  let pendingTaskSelection:number|null=null;
  let listSequence=0,mapGeneration=0,mapSequence=0,mapRead:DiscoveryV1MapRead={loading:false,error:null};
  let mapRetry:{bounds:PublicBounds;seed:boolean}|null=null;
  /** The task or place bucket the person chose last, while that choice stands (a read for it may still be on its way). */
  let chosen:DiscoveryV1MapMarker|null=null;
  // EX-03 (client work per settle): the owner replaces its page, map and places objects only when an answer lands, so what a snapshot hands out
  // is made once per answer and handed out again; the coordinator, the overlay and every commit used to build all of it anew (measured in node:
  // 400 row conversions for one settled pan of 50 rows). Nothing may mutate these arrays.
  let pageMade:{page:DiscoveryV1PageState;wire:DiscoveryV1Item[];items:(PrilikaProjekcija & {revision:number})[]}|null=null;
  let mapMade:{map:DiscoveryV1MapResponse;markers:DiscoveryV1MapMarker[]}|null=null;
  let placesMade:{places:DiscoveryV1PlacesState;rows:DiscoveryV1PlaceRow[]}|null=null;
  const pageOf=(page:DiscoveryV1PageState)=>{
    if(pageMade?.page!==page) pageMade={page,wire:[...page.items],items:discoveryV1Opportunities(page.items)};
    return pageMade;
  };
  const markersOf=(map:DiscoveryV1MapResponse)=>{
    if(mapMade?.map!==map) mapMade={map,markers:discoveryV1MapMarkers(map)};
    return mapMade.markers;
  };
  const placesOf=(places:DiscoveryV1PlacesState)=>{
    if(placesMade?.places!==places) placesMade={places,rows:discoveryV1PlaceSuggestions(places)};
    return placesMade.rows;
  };

  const snapshot=():DiscoveryV1ScreenSnapshot=>{
    const state=owner.snapshot(), page=state.page?pageOf(state.page):null;
    return {
      active:state.active,view:view?cloneView(view):null,
      wireItems:page?page.wire:[],
      items:page?page.items:[],
      mapMarkers:state.map?markersOf(state.map):[],
      mapWholeBounds:state.map?.wholeBounds ? [...state.map.wholeBounds] as PublicBounds : null,
      mapRead,
      places:state.places?placesOf(state.places):[],
      peek,
      exactTaskId,
      verifiedPlaceKey,
      counts:state.page?.counts ?? null,availability:state.page?.availability ?? null,mapCounts:state.map?.counts ?? null,
      placeCounts:state.places?.counts ?? null,pageHasMore:state.page?.hasMore ?? false,
      memberHasMore:state.members?.hasMore ?? false,placeHasMore:state.places?.hasMore ?? false,
    };
  };
  /** The choice is let go: its card, its reads and the view's selection. */
  const letGo=()=>{
    selectionSequence++;peek=null;exactTaskId=null;verifiedPlaceKey=null;chosen=null;owner.clearSelectionReads();
    if(view) view={...view,selectedId:null,selectedPlace:null};
  };
  /** PAGE and MAP carry no exact price revision. Any accepted read retires the earlier price proof, without closing the card. */
  const freshPublicRead=()=>{priceGeneration++;exactTaskId=null;verifiedPlaceKey=null;};
  const freshPublicReadFor=(selection:number)=>{if(selection===selectionSequence) freshPublicRead();};

  /** A retry belongs to this traversal and latest viewport. A stale seed cannot launch its second MAP over a newer viewport. */
  async function readMap(frame:PublicBounds,seed=false){
    const generation=mapGeneration,sequence=++mapSequence,selection=selectionSequence;
    const current=()=>generation===mapGeneration&&sequence===mapSequence&&isCurrent()&&owner.snapshot().active;
    mapRetry={bounds:[...frame] as PublicBounds,seed};mapRead={loading:true,error:mapRead.error};
    try{
      let result=await owner.loadMap(frame);
      if(!current()||result.kind==='stale')return {kind:'stale' as const};
      if(result.kind==='applied')freshPublicReadFor(selection);
      if(seed&&result.kind==='applied'&&result.value.wholeBounds){
        result=await owner.loadMap([...result.value.wholeBounds] as PublicBounds);
        if(!current()||result.kind==='stale')return {kind:'stale' as const};
        if(result.kind==='applied')freshPublicReadFor(selection);
      }
      if(result.kind==='applied')mapRead={loading:false,error:null};
      return result;
    }catch(error){
      if(!current())return {kind:'stale' as const};
      mapRead={loading:false,error:readFailureReason(error)};
      // The coordinator renews an expired anchor once. A MAP failure must not bypass that recovery contract.
      if(error instanceof Error&&(error.message==='DISCOVERY_V1_ANCHOR_EXPIRED'||error.message==='DISCOVERY_V1_FOR_ME_PROFILE_REQUIRED'))throw error;
      return {kind:'failed' as const};
    }finally{if(current())mapRead={...mapRead,loading:false};}
  }

  async function retryMap(){
    if(!view||!mapRetry||!isCurrent())return {kind:'noop' as const,snapshot:snapshot()};
    const result=await readMap(mapRetry.bounds,mapRetry.seed);
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function open(next:MarketplaceView,pageLimit=50){
    const list=++listSequence,generation=++mapGeneration;mapSequence++;mapRetry=null;mapRead={loading:false,error:null};
    const currentList=()=>list===listSequence&&generation===mapGeneration&&isCurrent();
    view=cloneView(next);peek=null;exactTaskId=null;verifiedPlaceKey=null;chosen=null;selectionSequence++;
    owner.clearSelectionReads();
    const plan=discoveryV1ViewPlan(view);
    owner.begin(plan.filter,plan.pageScope,pageLimit);
    const page=await owner.firstPage();
    if(!currentList())return {kind:'stale' as const,snapshot:snapshot()};
    if(page.kind!=='applied') return page.kind==='stale'?{kind:'stale' as const,snapshot:snapshot()}:{kind:'noop' as const,snapshot:snapshot()};
    if(plan.mapBounds||plan.mapSeed){
      await readMap(plan.mapBounds??[...DISCOVERY_V1_SEED_BOUNDS] as PublicBounds,plan.mapSeed);
    }
    if(!currentList())return {kind:'stale' as const,snapshot:snapshot()};
    return {kind:'applied' as const,snapshot:snapshot()};
  }

  /**
   * A settled move of the person's own. The list reads what they can see (`listBounds`: the map less what the search tools and the sheet or a
   * card cover); the map reads its whole frame (`mapBounds`, the same bounds when the caller has no separate frame). A chosen task or place
   * stays chosen, with its card, while its bucket is still on the map they now see; a choice whose bucket left it is let go.
   */
  async function settleMap(listBounds:PublicBounds,mapBounds:PublicBounds=listBounds){
    if(!view) return {kind:'noop' as const,snapshot:snapshot()};
    const selection=selectionSequence,list=++listSequence,generation=mapGeneration;
    const currentList=()=>list===listSequence&&generation===mapGeneration&&isCurrent();
    const area=bounds(listBounds),frame=bounds(mapBounds);
    view={...view,area:[...area] as PublicBounds,pinPlace:null};
    owner.setScope({kind:'AREA',bounds:[...area] as PublicBounds});
    const pagePromise=owner.firstPage().then(result=>{if(currentList()&&result.kind==='applied') freshPublicReadFor(selection);return result;});
    const mapPromise=readMap(frame),mapRequest=mapSequence;
    const [pageRead,mapReadResult]=await Promise.allSettled([pagePromise,mapPromise]);
    if(!currentList())return {kind:'stale' as const,snapshot:snapshot()};
    if(pageRead.status==='rejected')throw pageRead.reason;
    if(mapReadResult.status==='rejected')throw mapReadResult.reason;
    const page=pageRead.value,map=mapReadResult.value;
    if(page.kind==='stale') return {kind:'stale' as const,snapshot:snapshot()};
    const kept=chosen;
    if(selection===selectionSequence&&kept&&mapRequest===mapSequence&&map.kind==='applied'&&!map.value.buckets.some(bucket=>bucket.key===kept.key)) letGo();
    return {kind:'applied' as const,snapshot:snapshot()};
  }

  /**
   * A camera move that is not the person's own (a fit to a chosen place, Nearby, a saved work area) leaves the buckets of the region it left.
   * Only the MAP is read again, over the region now on screen: the list, its scope, the peek and the selection stay exactly as they are.
   */
  async function refreshMap(nextBounds:PublicBounds){
    if(!view) return {kind:'noop' as const,snapshot:snapshot()};
    const wire=wireBounds(bounds(nextBounds));
    const covered=owner.snapshot().map?.coverageBounds;
    if(!mapRead.error&&!mapRead.loading&&covered&&nearBounds(covered,wire)) return {kind:'noop' as const,snapshot:snapshot()};
    const result=await readMap(wire);
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function showPoint(point:DiscoveryV1Point){
    if(!view) return {kind:'noop' as const,snapshot:snapshot()};
    const list=++listSequence;
    const key=pointKey(point);
    if(!key) throw new Error('DISCOVERY_V1_SCREEN_POINT');
    view={...view,pinPlace:key,selectedId:null,selectedPlace:null};peek=null;exactTaskId=null;verifiedPlaceKey=null;chosen=null;selectionSequence++;owner.clearSelectionReads();
    owner.setScope({kind:'POINT_LIST',point:{...point}});
    const result=await owner.firstPage();
    if(list!==listSequence||!isCurrent())return {kind:'stale' as const,snapshot:snapshot()};
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function showAll(){
    if(!view) return {kind:'noop' as const,snapshot:snapshot()};
    const list=++listSequence;
    view={...view,area:null,pinPlace:null,selectedId:null,selectedPlace:null};peek=null;exactTaskId=null;verifiedPlaceKey=null;chosen=null;selectionSequence++;owner.clearSelectionReads();
    owner.setScope({kind:'ALL'});
    const result=await owner.firstPage();
    if(list!==listSequence||!isCurrent())return {kind:'stale' as const,snapshot:snapshot()};
    return {kind:result.kind,snapshot:snapshot()};
  }

  async function selectMarker(marker:DiscoveryV1MapMarker):Promise<DiscoveryV1SelectionResult>{
    const selection=++selectionSequence, priceReadGeneration=priceGeneration;
    pendingTaskSelection=marker.kind==='TASK'?selection:null;exactTaskId=null;verifiedPlaceKey=null;owner.clearSelectionReads();
    if(marker.kind==='CLUSTER'){peek=null;chosen=null;return {kind:'CLUSTER',bounds:[...marker.memberBounds] as PublicBounds};}
    chosen=marker;
    // The choice did not stand (nothing to show for it): it is no longer the chosen bucket.
    const failed=()=>{if(selection===selectionSequence)chosen=null;};
    if(marker.kind==='TASK'){
      try{
      // EX-03: PAGE and EXACT_PUBLIC return the same public item, so a row the list already holds IS the card's data. It is exposed at once (this runs before the first await,
      // so the caller can publish it in the same turn as the touch) and the exact read, which still goes out, only confirms or refreshes it: the card is replaced only when the
      // answer differs, a failed read keeps the known card, an answer without the task takes it away. A task that is not loaded waits for the exact read as before, and the card
      // that was showing stays until the new one lands.
      const loaded=owner.snapshot().page?.items.find(row=>row.id===marker.taskId)??null;
      if(loaded) peek={kind:'TASK',item:discoveryV1Opportunities([loaded])[0]};
      let result;
      try{result=await owner.readExact(marker.taskId);}
      catch(error){
        if(selection!==selectionSequence||!isCurrent()) return {kind:'stale'};
        if(loaded) return {kind:'TASK',applied:true};
        failed();throw error;
      }
      if(selection!==selectionSequence||!isCurrent()||result.kind==='stale') return {kind:'stale'};
      if(result.kind!=='applied'){if(!loaded){peek=null;failed();}return {kind:'TASK',applied:!!loaded};}
      const item=result.value.items[0];
      if(!item){peek=null;failed();return {kind:'TASK',applied:false};}
      if(!loaded||JSON.stringify(item)!==JSON.stringify(loaded)) peek={kind:'TASK',item:discoveryV1Opportunities([item])[0]};
      if(priceReadGeneration===priceGeneration) exactTaskId=item.id;
      return {kind:'TASK',applied:true};
      }finally{if(pendingTaskSelection===selection)pendingTaskSelection=null;}
    }
    // EX-03 (PLACE): the same idea for a point several tasks share. When every task of the place is already in the loaded list (the bucket's count equals the rows the list holds at that
    // point, so the set cannot be larger) the card is exposed at once; the members read, which still goes out and feeds the place's own paging, only confirms or refreshes it. A place
    // that is not fully loaded waits for that read as before.
    const key=pointKey(marker.point),rows=owner.snapshot().page?.items??[];
    const here=key?rows.filter(row=>row.pin&&pointKey(row.pin)===key):[];
    const known=here.length>0&&here.length===marker.taskCount?here:null;
    if(known) peek={kind:'PLACE',point:{...marker.point},items:discoveryV1Opportunities(known),totalCount:marker.taskCount};
    let result;
    try{result=await owner.firstMembers(marker.point,50);}
    catch(error){
      if(selection!==selectionSequence||!isCurrent()) return {kind:'stale'};
      if(known) return {kind:'PLACE',applied:true};
      failed();throw error;
    }
    if(selection!==selectionSequence||!isCurrent()||result.kind==='stale') return {kind:'stale'};
    if(result.kind!=='applied'){if(!known){peek=null;failed();}return {kind:'PLACE',applied:!!known};}
    // POINT_MEMBERS counts the entire filtered place; its bounded rows are only a preview. The live count may change even when those rows do not.
    if(!known||result.value.counts.listed!==marker.taskCount||JSON.stringify(result.value.items)!==JSON.stringify(known))
      peek={kind:'PLACE',point:{...marker.point},items:discoveryV1Opportunities(result.value.items),totalCount:result.value.counts.listed};
    if(priceReadGeneration===priceGeneration) verifiedPlaceKey=key;
    return {kind:'PLACE',applied:true};
  }

  /** Recheck retained TASK terms after a newer PAGE/MAP. It never delays those reads or takes ownership from a newer tap. */
  async function refreshSelectedExact(){
    const marker=chosen,shown=peek;
    if(marker?.kind!=='TASK'||shown?.kind!=='TASK'||shown.item.id!==marker.taskId
      ||exactTaskId!==null||pendingTaskSelection===selectionSequence) return {kind:'noop' as const};
    const selection=selectionSequence,generation=priceGeneration;
    let result;
    try{result=await owner.readExact(marker.taskId);}
    catch{return {kind:'failed' as const};}
    if(selection!==selectionSequence||generation!==priceGeneration||!isCurrent()||result.kind==='stale') return {kind:'stale' as const};
    if(result.kind!=='applied') return {kind:'failed' as const};
    const item=result.value.items[0];
    if(!item){letGo();return {kind:'applied' as const};}
    peek={kind:'TASK',item:discoveryV1Opportunities([item])[0]};exactTaskId=item.id;
    return {kind:'applied' as const};
  }

  async function nextPage(){const selection=selectionSequence,result=await owner.nextPage();if(result.kind==='applied') freshPublicReadFor(selection);return {kind:result.kind,snapshot:snapshot()};}
  async function nextMembers(){
    const selection=selectionSequence,result=await owner.nextMembers();
    if(selection!==selectionSequence||!isCurrent()) return {kind:'stale' as const,snapshot:snapshot()};
    if(result.kind==='applied'&&peek?.kind==='PLACE')
      peek={...peek,items:discoveryV1Opportunities(result.value.items),totalCount:result.value.counts.listed};
    return {kind:result.kind,snapshot:snapshot()};
  }
  async function queryPlaces(prefix:string,facetArea:PublicBounds|null=null,limit=10){
    const result=await owner.firstPlaces(prefix,facetArea?bounds(facetArea):null,limit);return {kind:result.kind,snapshot:snapshot()};
  }
  async function nextPlaces(){const result=await owner.nextPlaces();return {kind:result.kind,snapshot:snapshot()};}
  const clearPeek=()=>{selectionSequence++;peek=null;exactTaskId=null;verifiedPlaceKey=null;chosen=null;owner.clearSelectionReads();};
  const peekNow=()=>peek;
  /** The key of the bucket whose choice stands (its read may still be on its way), or null. */
  const chosenKey=()=>chosen?.key ?? null;
  const suspend=()=>{selectionSequence++;listSequence++;mapGeneration++;mapSequence++;mapRead={...mapRead,loading:false};exactTaskId=null;verifiedPlaceKey=null;owner.suspend();};
  const retire=()=>{selectionSequence++;listSequence++;mapGeneration++;mapSequence++;mapRetry=null;mapRead={loading:false,error:null};peek=null;exactTaskId=null;verifiedPlaceKey=null;chosen=null;view=null;owner.retire();pageMade=null;mapMade=null;placesMade=null;};

  return {open,settleMap,refreshMap,retryMap,showPoint,showAll,selectMarker,refreshSelectedExact,nextPage,nextMembers,queryPlaces,nextPlaces,clearPeek,peekNow,chosenKey,suspend,retire,snapshot};
}
