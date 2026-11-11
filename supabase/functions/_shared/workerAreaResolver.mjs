/** Server-only area resolution. Provider IDs identify a frozen OSM snapshot;
 * no client coordinates or LLM coordinates become work territory. */
export const workerAreaRequestSchema={type:'ARRAY',maxItems:5,description:'Complete desired ON_SITE area list, only when changed. COUNTRY RS, CITY, or RADIUS with explicit km. Never a home/GPS point. Omit for unchanged/online-only scope.',items:{type:'OBJECT',properties:{kind:{type:'STRING',enum:['COUNTRY','CITY','RADIUS']},countryCode:{type:'STRING',enum:['RS']},query:{type:'STRING',description:'Nominative locality name, no private address. Empty for COUNTRY.'},radiusKm:{type:'INTEGER',nullable:true}},required:['kind','countryCode','query','radiusKm']}};
const keys=(v,k)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length===k.length&&k.every(x=>Object.hasOwn(v,x));
const cyr='абвгдђежзијклмнопрстћуфхцчш',latin='abvgddezzijklmnoprstcufhccs';
const cityKey=s=>String(s??'').normalize('NFKC').trim().toLocaleLowerCase('sr').replace(/љ/g,'lj').replace(/њ/g,'nj').replace(/џ/g,'dz')
 .replace(/[абвгдђежзијклмнопрстћуфхцчш]/g,ch=>latin[cyr.indexOf(ch)]).replace(/đ/g,'d').normalize('NFD').replace(/\p{M}/gu,'')
 .replace(/^grad\s+/u,'').replace(/^belgrade$/u,'beograd').replace(/\s+/gu,' ');
export function parseWorkerAreaRequests(raw){
 if(!Array.isArray(raw)||raw.length<1||raw.length>5)throw Error('WORKER_AREA_INVALID');
 return raw.map(a=>{
  if(!keys(a,['kind','countryCode','query','radiusKm'])||a.countryCode!=='RS'||!['COUNTRY','CITY','RADIUS'].includes(a.kind)
   ||typeof a.query!=='string'||a.query.length>160||/[\u0000-\u001f\u007f]/u.test(a.query))throw Error('WORKER_AREA_INVALID');
  if(a.kind==='COUNTRY'?(raw.length!==1||a.query!==''||a.radiusKm!==null)
    :(a.query.trim().length<2||/[0-9]/u.test(a.query)||(a.kind==='CITY'?a.radiusKm!==null:!Number.isInteger(a.radiusKm)||a.radiusKm<1||a.radiusKm>200)))throw Error('WORKER_AREA_INVALID');
  return {...a,query:a.query.trim()};
 });
}
export function resolveWorkerAreaRows(request,raw){
 // A malformed provider reply is an unavailable lookup, not evidence that the
 // worker gave an unclear city. Only a valid result set may ask for clarification.
 if(!Array.isArray(raw)||raw.length>5)throw Error('WORKER_AREA_UNAVAILABLE');
 const cities=new Map();
 for(const row of raw){
  if(!row||typeof row!=='object'||!row.address||row.address.country_code?.toLowerCase()!=='rs')continue;
  // Only a locality object qualifies; a street address carrying a city does not.
  if(!['city','town','village','municipality','administrative'].includes(row.type)||!['place','boundary'].includes(row.class))continue;
  const city=row.address.city||row.address.town||row.address.village||row.address.municipality;
  if(typeof city!=='string'||city.length<2||city.length>160||/[\u0000-\u001f\u007f]/u.test(city))continue;
  if(!['node','way','relation'].includes(row.osm_type)||!String(row.osm_id??'').match(/^[1-9][0-9]{0,19}$/))continue;
  const lat=Number(row.lat),lng=Number(row.lon);
  if(typeof row.lat!=='string'||typeof row.lon!=='string'||!Number.isFinite(lat)||!Number.isFinite(lng)||Math.abs(lat)>90||Math.abs(lng)>180)continue;
  // Equal names can describe different towns. Only an identical OSM identity
  // collapses; otherwise ask for clarification rather than choose a first row.
  if(cityKey(city)!==cityKey(request.query))continue;
  const key=`osm:${row.osm_type}:${row.osm_id}`;
  if(!cities.has(key))cities.set(key,{kind:request.kind,countryCode:'RS',city,
   label:request.kind==='CITY'?city:`${city} · do ${request.radiusKm} km`,
   sourceRef:`osm:${row.osm_type}:${row.osm_id}`,latitude:Math.round(lat*100)/100,longitude:Math.round(lng*100)/100,radiusKm:request.radiusKm});
 }
 if(cities.size!==1)throw Error('WORKER_AREA_UNRESOLVED');
 return [...cities.values()][0];
}
// A free LocationIQ key allows two lookups/second. A single worker turn can
// contain up to five CITY/RADIUS areas: never burst them with Promise.all.
// This is per-turn pacing, not a distributed cross-worker rate limiter; one
// bounded 429 retry handles a concurrent request from another isolate/client.
const LOOKUP_GAP_MS=600;
function waitLookupGap(ms,signal){
 if(signal?.aborted)return Promise.reject(Error('WORKER_AI_CANCELLED'));
 if(ms<=0)return Promise.resolve();
 return new Promise((resolve,reject)=>{
  let timer;
  const aborted=()=>{clearTimeout(timer);signal?.removeEventListener('abort',aborted);reject(Error('WORKER_AI_CANCELLED'));};
  timer=setTimeout(()=>{signal?.removeEventListener('abort',aborted);resolve();},ms);
  signal?.addEventListener('abort',aborted,{once:true});
  if(signal?.aborted)aborted();
 });
}
export async function resolveWorkerAreas(raw,{token,requestJson,signal,
 ownedAreas=/** @type {ReadonlyArray<import('../../../src/contracts/workerAreas.ts').WorkerArea>} */([])}){
 const requests=parseWorkerAreaRequests(raw);
 const areas=[];
 let lastProviderStart=0,rateRetryUsed=false;
 for(const a of requests){
  if(signal?.aborted)throw Error('WORKER_AI_CANCELLED');
  if(a.kind==='COUNTRY'){
   areas.push({kind:'COUNTRY',countryCode:'RS',label:'Cela Srbija',city:null,sourceRef:null,latitude:null,longitude:null,radiusKm:null});
   continue;
  }
  // Reuse an already-owned signed OSM identity. No new provider query,
  // invented geocoding result, widened radius or new consent.
  const sameCity=ownedAreas.filter(area=>area.countryCode===a.countryCode&&cityKey(area.city)===cityKey(a.query));
  if(sameCity.length===1&&sameCity[0].kind===a.kind&&sameCity[0].radiusKm===a.radiusKm){
   areas.push({...sameCity[0]});continue;
  }
  if(!token){console.warn('WORKER_AREA_LOOKUP','TOKEN_MISSING');throw Error('WORKER_AREA_UNAVAILABLE');}
  const url=new URL('https://eu1.locationiq.com/v1/search');
  for(const [key,value] of Object.entries({key:token,q:a.query,format:'json',countrycodes:'rs',addressdetails:'1',limit:'5','accept-language':'sr-Latn'}))url.searchParams.set(key,value);
  for(;;){
   await waitLookupGap(Math.max(0,lastProviderStart+LOOKUP_GAP_MS-Date.now()),signal);
   if(signal?.aborted)throw Error('WORKER_AI_CANCELLED');
   lastProviderStart=Date.now();
   let response;
   try{response=await requestJson(url.toString(),{method:'GET'},131072,7000,signal);}
   catch(error){
    if(signal?.aborted)throw error;
    console.warn('WORKER_AREA_LOOKUP','TRANSPORT');
    throw Error('WORKER_AREA_UNAVAILABLE');
   }
   if(response?.ok){areas.push(resolveWorkerAreaRows(a,response.data));break;}
   if(response?.status===429&&!rateRetryUsed){
    rateRetryUsed=true;
    console.warn('WORKER_AREA_LOOKUP','RATE_LIMIT_RETRY');
    await waitLookupGap(1100,signal);
    continue;
   }
   // Do not print URLs (they include the key), locality text, IPs or provider bodies.
   console.warn('WORKER_AREA_LOOKUP',response?.status===429?'RATE_LIMIT':'UPSTREAM');
   throw Error('WORKER_AREA_UNAVAILABLE');
  }
 }
 // All-or-nothing: the caller's signed draft cannot gain half a territory.
 if(new Set(areas.map(a=>a.sourceRef??a.countryCode)).size!==areas.length)throw Error('WORKER_AREA_INVALID');
 return areas;
}
