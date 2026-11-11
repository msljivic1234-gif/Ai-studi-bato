export interface GeminiContextCacheOptions {
  geminiApiKey: string;
  catalogVersion: number;
  catalog: any;
  model?: string;
  signal?: AbortSignal;
  purpose?: 'NEED_SERVICE' | 'WORKER_CAPABILITY';
}

export function buildUskociCachedKnowledge(catalog: any, purpose?: 'NEED_SERVICE' | 'WORKER_CAPABILITY'): string;
export function getOrCreateGeminiContextCache(options: GeminiContextCacheOptions): Promise<string | null>;
export function clearActiveGeminiCacheHandles(): void;
