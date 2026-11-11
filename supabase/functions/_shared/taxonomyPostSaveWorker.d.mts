export type CatalogOnlyTick = Readonly<{
 kind:'CATALOG_ONLY_TICK'; reconciled:number; claimed:number;
 admitted:number; reviewRequired:number; retry:number;
 capabilityAuthority:'NONE'; needRevisionAuthority:'NONE'; notificationAuthority:'NONE';
}>;
export type TaxonomyServiceRpc = (name: string,args:Record<string,unknown>)=>Promise<unknown>;
export declare class TaxonomyWorkerProtocolError extends Error { constructor(); }
export declare function processTaxonomyPostSaveTick(
 rpc: TaxonomyServiceRpc,
 options?: { limit?: number; reconcileLimit?: number },
): Promise<CatalogOnlyTick>;
