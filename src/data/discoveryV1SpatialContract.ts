import { placeKey, publicBounds, type PublicBounds } from './marketplaceView';
import { DISCOVERY_V1, type DiscoveryV1Anchor } from './discoveryV1Contract';

export type DiscoveryV1MapPoint = { lat: number; lng: number };
export type DiscoveryV1MapBucket =
  | { kind: 'TASK'; key: string; point: DiscoveryV1MapPoint; taskId: string }
  | { kind: 'PLACE'; key: string; point: DiscoveryV1MapPoint; taskCount: number }
  | { kind: 'CLUSTER'; key: string; point: DiscoveryV1MapPoint; taskCount: number; distinctPointCount: number; memberBounds: PublicBounds };

export type DiscoveryV1MapResponse = {
  version: typeof DISCOVERY_V1; mode: 'MAP'; asOf: string; filterKey: string; anchor: DiscoveryV1Anchor;
  coverageBounds: PublicBounds; effectiveGrid: number; wholeBounds: PublicBounds | null;
  buckets: DiscoveryV1MapBucket[];
  counts: { kind: 'exact_live'; observedAt: string; mapped: number; withoutPoint: number };
};

export type DiscoveryV1PlaceCursor = { count: number; text: string; key: string };
export type DiscoveryV1PlaceRow = { key: string; text: string; count: number };
export type DiscoveryV1PlacesResponse = {
  version: typeof DISCOVERY_V1; mode: 'PLACES'; asOf: string; filterKey: string; anchor: DiscoveryV1Anchor;
  items: DiscoveryV1PlaceRow[]; hasMore: boolean; nextCursor: DiscoveryV1PlaceCursor | null;
  counts: { kind: 'exact_live'; observedAt: string; everywhere: number; inArea: number | null };
};

type Obj = Record<string, unknown>;
const md5Re = /^[0-9a-f]{32}$/;
const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const instantRe = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const invalid = (code: string): never => { throw new Error(code); };
const object = (value: unknown): Obj => value !== null && typeof value === 'object' && !Array.isArray(value)
  ? value as Obj : invalid('DISCOVERY_V1_SPATIAL_OBJECT');
const exact = (row: Obj, keys: readonly string[], code: string) => {
  const a=Object.keys(row).sort(), b=[...keys].sort();
  if(a.length!==b.length || a.some((key,index)=>key!==b[index])) invalid(code);
};
const text = (value: unknown, code: string, max=500) =>
  typeof value === 'string' && value.length>0 && value.length<=max ? value : invalid(code);
const integer = (value: unknown, code: string, min=0) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value>=min ? value : invalid(code);
const number = (value: unknown, code: string) =>
  typeof value === 'number' && Number.isFinite(value) ? value : invalid(code);
const instant = (value: unknown, code: string) => {
  const v=text(value,code,64); return instantRe.test(v) && Number.isFinite(Date.parse(v)) ? v : invalid(code);
};
const uuid = (value: unknown, code: string) => {
  const v=text(value,code,36).toLowerCase(); return uuidRe.test(v) ? v : invalid(code);
};
const filterKey = (value: unknown) => {
  const v=text(value,'DISCOVERY_V1_SPATIAL_FILTER',32); return md5Re.test(v) ? v : invalid('DISCOVERY_V1_SPATIAL_FILTER');
};
const coarse = (value:number) => Math.round(value*100)/100===value;
function point(value: unknown): DiscoveryV1MapPoint {
  const row=object(value); exact(row,['lat','lng'],'DISCOVERY_V1_MAP_POINT_SHAPE');
  const lat=number(row.lat,'DISCOVERY_V1_MAP_POINT'), lng=number(row.lng,'DISCOVERY_V1_MAP_POINT');
  if(Math.abs(lat)>90 || Math.abs(lng)>180 || !coarse(lat) || !coarse(lng)) invalid('DISCOVERY_V1_MAP_POINT');
  return {lat,lng};
}
function bounds(value: unknown, code: string): PublicBounds {
  const decoded=publicBounds(value);
  return decoded ?? invalid(code);
}
function contains([west,south,east,north]:PublicBounds,p:DiscoveryV1MapPoint){
  const lon=west<=east ? p.lng>=west && p.lng<=east : p.lng>=west || p.lng<=east;
  return lon && p.lat>=south && p.lat<=north;
}
function anchor(value: unknown, key:string):DiscoveryV1Anchor{
  const row=object(value); exact(row,['version','filterKey','timeAt','publishedThrough','expiresAt'],'DISCOVERY_V1_SPATIAL_ANCHOR_SHAPE');
  if(row.version!==DISCOVERY_V1 || row.filterKey!==key) invalid('DISCOVERY_V1_SPATIAL_ANCHOR_BINDING');
  const timeAt=instant(row.timeAt,'DISCOVERY_V1_SPATIAL_ANCHOR_TIME');
  const publishedThrough=instant(row.publishedThrough,'DISCOVERY_V1_SPATIAL_ANCHOR_THROUGH');
  const expiresAt=instant(row.expiresAt,'DISCOVERY_V1_SPATIAL_ANCHOR_EXPIRES');
  if(Date.parse(timeAt)!==Date.parse(publishedThrough) || Date.parse(expiresAt)-Date.parse(timeAt)!==30*60_000)
    invalid('DISCOVERY_V1_SPATIAL_ANCHOR_WINDOW');
  return {version:DISCOVERY_V1,filterKey:key,timeAt,publishedThrough,expiresAt};
}
function bucket(value: unknown, coverage: PublicBounds):DiscoveryV1MapBucket{
  const row=object(value), kind=row.kind;
  if(kind==='TASK'){
    exact(row,['kind','key','point','taskId'],'DISCOVERY_V1_MAP_BUCKET_SHAPE');
    const p=point(row.point); if(!contains(coverage,p)) invalid('DISCOVERY_V1_MAP_BUCKET_OUTSIDE');
    return {kind,key:text(row.key,'DISCOVERY_V1_MAP_BUCKET_KEY',160),point:p,taskId:uuid(row.taskId,'DISCOVERY_V1_MAP_TASK_ID')};
  }
  if(kind==='PLACE'){
    exact(row,['kind','key','point','taskCount'],'DISCOVERY_V1_MAP_BUCKET_SHAPE');
    const p=point(row.point); if(!contains(coverage,p)) invalid('DISCOVERY_V1_MAP_BUCKET_OUTSIDE');
    return {kind,key:text(row.key,'DISCOVERY_V1_MAP_BUCKET_KEY',160),point:p,taskCount:integer(row.taskCount,'DISCOVERY_V1_MAP_BUCKET_COUNT',2)};
  }
  if(kind==='CLUSTER'){
    exact(row,['kind','key','point','taskCount','distinctPointCount','memberBounds'],'DISCOVERY_V1_MAP_BUCKET_SHAPE');
    const p=point(row.point); if(!contains(coverage,p)) invalid('DISCOVERY_V1_MAP_BUCKET_OUTSIDE');
    const taskCount=integer(row.taskCount,'DISCOVERY_V1_MAP_BUCKET_COUNT',2);
    const distinctPointCount=integer(row.distinctPointCount,'DISCOVERY_V1_MAP_POINT_COUNT',2);
    if(distinctPointCount>taskCount) invalid('DISCOVERY_V1_MAP_POINT_COUNT');
    return {kind,key:text(row.key,'DISCOVERY_V1_MAP_BUCKET_KEY',160),point:p,taskCount,distinctPointCount,
      memberBounds:bounds(row.memberBounds,'DISCOVERY_V1_MAP_MEMBER_BOUNDS')};
  }
  return invalid('DISCOVERY_V1_MAP_BUCKET_KIND');
}
export function decodeDiscoveryV1Map(value: unknown):DiscoveryV1MapResponse{
  const row=object(value);
  exact(row,['version','mode','asOf','filterKey','anchor','coverageBounds','effectiveGrid','wholeBounds','buckets','counts'],
    'DISCOVERY_V1_MAP_SHAPE');
  if(row.version!==DISCOVERY_V1 || row.mode!=='MAP') invalid('DISCOVERY_V1_MAP_MODE');
  const asOf=instant(row.asOf,'DISCOVERY_V1_MAP_ASOF'), key=filterKey(row.filterKey);
  const coverageBounds=bounds(row.coverageBounds,'DISCOVERY_V1_MAP_BOUNDS');
  const effectiveGrid=integer(row.effectiveGrid,'DISCOVERY_V1_MAP_GRID',1);
  if(effectiveGrid>24) invalid('DISCOVERY_V1_MAP_GRID');
  const wholeBounds=row.wholeBounds===null?null:bounds(row.wholeBounds,'DISCOVERY_V1_MAP_WHOLE_BOUNDS');
  const raw:unknown[]=Array.isArray(row.buckets)?row.buckets:invalid('DISCOVERY_V1_MAP_BUCKETS');
  if(raw.length>256) invalid('DISCOVERY_V1_MAP_BUCKETS');
  const buckets=raw.map(item=>bucket(item,coverageBounds));
  if(new Set(buckets.map(item=>item.key)).size!==buckets.length) invalid('DISCOVERY_V1_MAP_BUCKET_DUPLICATE');
  const counts=object(row.counts); exact(counts,['kind','observedAt','mapped','withoutPoint'],'DISCOVERY_V1_MAP_COUNTS_SHAPE');
  if(counts.kind!=='exact_live') invalid('DISCOVERY_V1_MAP_COUNTS_KIND');
  const mapped=integer(counts.mapped,'DISCOVERY_V1_MAP_COUNT'), withoutPoint=integer(counts.withoutPoint,'DISCOVERY_V1_MAP_COUNT');
  if(withoutPoint>mapped) invalid('DISCOVERY_V1_MAP_COUNT');
  const bucketTasks=buckets.reduce((sum,item)=>sum+(item.kind==='TASK'?1:item.taskCount),0);
  // mapped includes point-free rows; these cannot contribute to a spatial bucket.
  if(!Number.isSafeInteger(bucketTasks) || bucketTasks>mapped-withoutPoint)
    invalid('DISCOVERY_V1_MAP_BUCKET_OVERCOUNT');
  const taskIds=buckets.flatMap(item=>item.kind==='TASK'?[item.taskId]:[]);
  if(new Set(taskIds).size!==taskIds.length) invalid('DISCOVERY_V1_MAP_TASK_DUPLICATE');
  return {version:DISCOVERY_V1,mode:'MAP',asOf,filterKey:key,anchor:anchor(row.anchor,key),coverageBounds,effectiveGrid,
    wholeBounds,buckets,counts:{kind:'exact_live',observedAt:instant(counts.observedAt,'DISCOVERY_V1_MAP_COUNT_TIME'),mapped,withoutPoint}};
}
export function decodeDiscoveryV1Places(value: unknown, expectedLimit=30):DiscoveryV1PlacesResponse{
  if(!Number.isSafeInteger(expectedLimit)||expectedLimit<1||expectedLimit>30) invalid('DISCOVERY_V1_PLACES_LIMIT');
  const row=object(value);
  exact(row,['version','mode','asOf','filterKey','anchor','items','hasMore','nextCursor','counts'],'DISCOVERY_V1_PLACES_SHAPE');
  if(row.version!==DISCOVERY_V1 || row.mode!=='PLACES') invalid('DISCOVERY_V1_PLACES_MODE');
  const asOf=instant(row.asOf,'DISCOVERY_V1_PLACES_ASOF'), key=filterKey(row.filterKey);
  const raw:unknown[]=Array.isArray(row.items)?row.items:invalid('DISCOVERY_V1_PLACES_ITEMS');
  if(raw.length>expectedLimit) invalid('DISCOVERY_V1_PLACES_ITEMS');
  const items=raw.map(value=>{
    const item=object(value); exact(item,['key','text','count'],'DISCOVERY_V1_PLACE_SHAPE');
    const display=text(item.text,'DISCOVERY_V1_PLACE_TEXT',500), normalized=text(item.key,'DISCOVERY_V1_PLACE_KEY',500);
    if(placeKey(display)!==normalized) invalid('DISCOVERY_V1_PLACE_KEY_MISMATCH');
    return {key:normalized,text:display,count:integer(item.count,'DISCOVERY_V1_PLACE_COUNT',1)};
  });
  if(new Set(items.map(item=>item.key)).size!==items.length) invalid('DISCOVERY_V1_PLACE_DUPLICATE');
  for(let i=1;i<items.length;i++){
    const previous=items[i-1], current=items[i];
    if(current.count>previous.count || current.count===previous.count && current.text.localeCompare(previous.text,'sr-Latn-RS')<0)
      invalid('DISCOVERY_V1_PLACE_ORDER');
  }
  const hasMore=typeof row.hasMore==='boolean'?row.hasMore:invalid('DISCOVERY_V1_PLACES_HAS_MORE');
  let nextCursor:DiscoveryV1PlaceCursor|null=null;
  if(row.nextCursor!==null){
    const cursor=object(row.nextCursor); exact(cursor,['count','text','key'],'DISCOVERY_V1_PLACE_CURSOR_SHAPE');
    const display=text(cursor.text,'DISCOVERY_V1_PLACE_CURSOR_TEXT',500), normalized=text(cursor.key,'DISCOVERY_V1_PLACE_CURSOR_KEY',500);
    if(placeKey(display)!==normalized) invalid('DISCOVERY_V1_PLACE_CURSOR_KEY_MISMATCH');
    nextCursor={count:integer(cursor.count,'DISCOVERY_V1_PLACE_CURSOR_COUNT',1),text:display,key:normalized};
  }
  if(hasMore!==(nextCursor!==null)) invalid('DISCOVERY_V1_PLACE_CURSOR_PRESENCE');
  // Continue after exactly the emitted tail, never a plausible unrelated tuple.
  if(nextCursor!==null){
    const last=items[items.length-1];
    if(!last || last.count!==nextCursor.count || last.text!==nextCursor.text || last.key!==nextCursor.key)
      invalid('DISCOVERY_V1_PLACE_CURSOR_TAIL');
  }
  const counts=object(row.counts); exact(counts,['kind','observedAt','everywhere','inArea'],'DISCOVERY_V1_PLACE_COUNTS_SHAPE');
  if(counts.kind!=='exact_live') invalid('DISCOVERY_V1_PLACE_COUNTS_KIND');
  const everywhere=integer(counts.everywhere,'DISCOVERY_V1_PLACE_COUNTS');
  const inArea=counts.inArea===null?null:integer(counts.inArea,'DISCOVERY_V1_PLACE_COUNTS');
  if(inArea!==null && inArea>everywhere) invalid('DISCOVERY_V1_PLACE_COUNTS');
  // A task contributes to at most one locality, including on a filtered page.
  const listed=items.reduce((sum,item)=>sum+item.count,0);
  if(!Number.isSafeInteger(listed) || listed>everywhere) invalid('DISCOVERY_V1_PLACE_COUNTS');
  return {version:DISCOVERY_V1,mode:'PLACES',asOf,filterKey:key,anchor:anchor(row.anchor,key),items,hasMore,nextCursor,
    counts:{kind:'exact_live',observedAt:instant(counts.observedAt,'DISCOVERY_V1_PLACE_COUNTS_TIME'),everywhere,inArea}};
}
