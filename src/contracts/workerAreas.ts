/** Signed work territory. COUNTRY is country-wide stationary work; CITY uses
 * the same canonical locality-name match as legacy discovery, never a polygon.
 * A RADIUS is measured from a resolved city centre, not a home address. */
export type WorkerArea = Readonly<{
  kind:'COUNTRY'|'CITY'|'RADIUS'; countryCode:'RS'; label:string;
  city:string|null; sourceRef:string|null; latitude:number|null; longitude:number|null; radiusKm:number|null;
}>;
export function decodeWorkerAreas(raw:unknown):WorkerArea[]|null {
  if(!Array.isArray(raw)||raw.length>5)return null;
  const result:WorkerArea[]=[],seen=new Set<string>();
  for(const item of raw){
    if(!item||typeof item!=='object'||Array.isArray(item))return null;
    const a=item as Record<string,unknown>;
    if(Object.keys(a).sort().join(',')!=='city,countryCode,kind,label,latitude,longitude,radiusKm,sourceRef'
      ||a.countryCode!=='RS'||!['COUNTRY','CITY','RADIUS'].includes(String(a.kind))
      ||typeof a.label!=='string'||a.label.length<2||a.label.length>200||/[\u0000-\u001f\u007f]/.test(a.label))return null;
    if(a.kind==='COUNTRY'){
      if(a.label!=='Cela Srbija'||a.city!==null||a.sourceRef!==null||a.latitude!==null||a.longitude!==null||a.radiusKm!==null||raw.length!==1)return null;
    }else{
      if(typeof a.city!=='string'||a.city.length<2||a.city.length>160||/[\u0000-\u001f\u007f]/.test(a.city)
        ||typeof a.sourceRef!=='string'||!/^osm:(node|way|relation):[1-9][0-9]{0,19}$/.test(a.sourceRef)
        ||typeof a.latitude!=='number'||!Number.isFinite(a.latitude)||Math.abs(a.latitude)>90
        ||typeof a.longitude!=='number'||!Number.isFinite(a.longitude)||Math.abs(a.longitude)>180
        ||Math.abs(Math.round(a.latitude*100)/100-a.latitude)>1e-9||Math.abs(Math.round(a.longitude*100)/100-a.longitude)>1e-9
        ||(a.kind==='CITY'?a.radiusKm!==null:typeof a.radiusKm!=='number'||!Number.isInteger(a.radiusKm)||a.radiusKm<1||a.radiusKm>200))return null;
      if(a.label!==(a.kind==='CITY'?a.city:`${a.city} · do ${a.radiusKm} km`))return null;
    }
    const key=a.kind==='COUNTRY'?'RS':String(a.sourceRef);
    if(seen.has(key))return null;seen.add(key);result.push(a as WorkerArea);
  }
  return result;
}
export const workerAreasLabel=(areas:readonly WorkerArea[])=>areas.map(area=>
  area.label||(area.kind==='COUNTRY'?'Cela Srbija':area.city?`${area.city}${area.kind==='RADIUS'&&area.radiusKm?` · do ${area.radiusKm} km`:''}`:'')
).filter(Boolean).join(' · ');
