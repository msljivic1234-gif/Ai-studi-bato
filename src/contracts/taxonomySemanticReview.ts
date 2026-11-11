/**
 * R04/F05: signed owner-review comparison, NOT a verified category admission.
 * Even a valid result is not capability permission or automatic taxonomy reuse.
 * The server must bind it to current source/revision and sign the enclosing
 * review digest. This pure decoder never makes the comparison READY.
 */
export type TaxonomySemanticReviewCandidate = Readonly<{
  service:string;
  mode:'ON_SITE'|'REMOTE';
  categoryId:string;
  categoryLabel:string;
  categoryParentId:string|null;
  reason:string;
  catalogVersion:number;
}>;
const uuid=(v:unknown):v is string=>typeof v==='string'&&
  /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i.test(v);
const text=(v:unknown,min:number,max:number):v is string=>
  typeof v==='string'&&v.trim().length>=min&&v.length<=max&&!/[<>\u0000-\u001f\u007f]/.test(v);
const record=(v:unknown):v is Record<string,unknown>=>v!==null&&typeof v==='object'&&!Array.isArray(v);
const fields=['service','mode','categoryId','categoryLabel','categoryParentId','reason','catalogVersion'];
const exact=(o:Record<string,unknown>)=>Object.keys(o).length===fields.length&&fields.every(k=>Object.hasOwn(o,k));

/** All-or-nothing decoding; a partial/malformed signed comparison is not shown. */
export function decodeTaxonomySemanticReviewCandidates(
  raw:unknown,version:unknown,services:readonly string[],
  expectedMode?:'ON_SITE'|'REMOTE'|null,
):TaxonomySemanticReviewCandidate[]|null{
  if(!Number.isSafeInteger(version)||!(Number(version)>0)
    ||!Array.isArray(raw)||raw.length<1||raw.length>24
    ||!Array.isArray(services)||services.length<1||services.length>24
    ||services.some(s=>!text(s,3,120)))return null;
  const allowed=new Set(services),seen=new Set<string>(),sameId=new Map<string,string>();
  const result:TaxonomySemanticReviewCandidate[]=[];
  for(const value of raw){
    if(!record(value)||!exact(value)||!text(value.service,3,120)||!allowed.has(value.service)
      ||(value.mode!=='ON_SITE'&&value.mode!=='REMOTE')
      ||(expectedMode&&value.mode!==expectedMode)
      ||!uuid(value.categoryId)||!text(value.categoryLabel,3,120)
      ||(value.categoryParentId!==null&&!uuid(value.categoryParentId))
      ||!text(value.reason,10,1000)||value.catalogVersion!==version)return null;
    const key=value.service+'|'+value.mode;
    if(seen.has(key)||sameId.has(value.service)&&sameId.get(value.service)!==value.categoryId)return null;
    seen.add(key);sameId.set(value.service,value.categoryId);
    result.push({
      service:value.service,mode:value.mode,categoryId:value.categoryId,
      categoryLabel:value.categoryLabel,categoryParentId:value.categoryParentId,
      reason:value.reason,catalogVersion:value.catalogVersion as number
    });
  }
  return result;
}
