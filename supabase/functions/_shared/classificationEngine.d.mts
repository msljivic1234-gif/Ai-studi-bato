// Types for shared Deno/Node ESM classification boundary.
export type ClassificationScope = 'REMOTE' | 'ON_SITE';
export type ClassificationPurpose = 'WORKER_CAPABILITY' | 'NEED_SERVICE';
export type CatalogCategory = Readonly<{
  id: string; label: string; parentId: string | null;
  path: readonly string[]; isLeaf: boolean; modes: readonly ClassificationScope[];
  aliases?: readonly string[];
}>;
export type CatalogSnapshot = Readonly<{
  catalogVersion: number; catalogFingerprint?: string; categories: CatalogCategory[];
  navigation?: { kind: 'SERVER_QUERIES'; identityChecks: { service: string; categoryIds: string[] }[]; searchedServices: string[] };
}>;
export type RpcClient = (name: string, args: Record<string, unknown>) => Promise<unknown>;
export declare function normalizedClassificationIdentity(label: unknown): string | null;
export declare const CLASSIFICATION_ACTIONS: readonly string[];
export declare function loadClassificationCatalog(
  rpc: RpcClient,
  options?: { pageSize?: number; maxBytes?: number; timeoutMs?: number },
): Promise<CatalogSnapshot>;
export declare function reviewClassificationProposal(
  input: { purpose: ClassificationPurpose; service: string; mode?: ClassificationScope | null },
  snapshot: CatalogSnapshot,
  plan: { action: string; catalogVersion: number; reason: string; categoryId?: string; parentId?: string | null; proposedPath?: string[] },
): { accepted: boolean; status: string; categoryId?: string; catalogVersion?: number; requiresOwnerReview?: boolean; capabilityAuthority?: string; notificationAuthority?: string };
export declare function catalogPromptContext(snapshot: CatalogSnapshot): string;
