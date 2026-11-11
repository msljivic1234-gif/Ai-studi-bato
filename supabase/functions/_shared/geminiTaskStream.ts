import { AI_CREDITS_UNAVAILABLE } from '../../../src/contracts/aiAvailability.ts';

/** Constructed only from the actual provider HTTP status, never provider text. */
export class GeminiCreditsUnavailableError extends Error {
  constructor() { super(AI_CREDITS_UNAVAILABLE); this.name = 'GeminiCreditsUnavailableError'; }
}

/** Provider-controlled block details must never become an error message or operator log. */
const SAFE_GEMINI_BLOCK_REASONS = new Set([
  'SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'OTHER', 'BLOCK_REASON_UNSPECIFIED',
]);

export class GeminiSafetyBlockedError extends Error {
  readonly blockReason: string;
  constructor(rawBlockReason: unknown) {
    super('GEMINI_SAFETY_BLOCKED');
    this.name = 'GeminiSafetyBlockedError';
    this.blockReason = typeof rawBlockReason === 'string' && SAFE_GEMINI_BLOCK_REASONS.has(rawBlockReason)
      ? rawBlockReason : 'UNKNOWN';
  }
}

/** Bounded provider stream. Only the top-level assistantMessage becomes UI text. */
function stringAt(input: string, start: number): { value: string; end: number; complete: boolean } {
  let value = '';
  for (let i = start + 1; i < input.length; i++) {
    const char = input[i];
    if (char === '"') return { value, end: i + 1, complete: true };
    if (char.charCodeAt(0) < 32) throw new Error('AI_STREAM_INVALID');
    if (char !== '\\') { value += char; continue; }
    if (++i >= input.length) return { value, end: input.length, complete: false };
    const escape = input[i];
    if (escape === 'u') {
      if (i + 4 >= input.length) return { value, end: input.length, complete: false };
      const digits = input.slice(i + 1, i + 5);
      if (!/^[a-f0-9]{4}$/i.test(digits)) throw new Error('AI_STREAM_INVALID');
      value += String.fromCharCode(parseInt(digits, 16)); i += 4;
    } else {
      const escapes: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
      if (!(escape in escapes)) throw new Error('AI_STREAM_INVALID');
      value += escapes[escape];
    }
  }
  return { value, end: input.length, complete: false };
}

export function assistantPrefix(input: string): string {
  let depth = 0, key: string | null = null, expectingValue = false;
  for (let i = 0; i < input.length;) {
    const char = input[i];
    if (char === '"') {
      const parsed = stringAt(input, i);
      if (depth === 1 && expectingValue && key === 'assistantMessage') {
        let result = parsed.value;
        if (/[\uD800-\uDBFF]$/.test(result)) result = result.slice(0, -1);
        if (result.length > 1200 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(result)) throw new Error('AI_STREAM_INVALID');
        return result;
      }
      if (!parsed.complete) return '';
      if (depth === 1 && !expectingValue) key = parsed.value;
      i = parsed.end; continue;
    }
    if (char === '{' || char === '[') depth++;
    else if (char === '}' || char === ']') depth--;
    else if (depth === 1 && char === ':') expectingValue = true;
    else if (depth === 1 && char === ',') { key = null; expectingValue = false; }
    if (depth < 0) throw new Error('AI_STREAM_INVALID');
    i++;
  }
  return '';
}

// The callers already declare the provider's own schema subset, with its UPPERCASE type
// names, so the adapter forwards types unchanged instead of rewriting them.

/** The live provider wire omits object-key and array-length bounds. The caller's
 * strict local decoder remains authoritative for unknown keys and item limits;
 * enum, nullable and numeric bounds are forwarded unchanged. */
const wireUnsupportedKeywords = new Set(['additionalProperties', 'maxItems', 'minItems']);

function providerSchema(value: unknown, isRoot = true): unknown {
  if (Array.isArray(value)) return value.map(item => providerSchema(item, false));
  if (!value || typeof value !== 'object') return value;
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (wireUnsupportedKeywords.has(key)) continue;
    result[key] = providerSchema(item, false);
  }
  if (isRoot && result.type === 'OBJECT' && result.properties && typeof result.properties === 'object' && !Array.isArray(result.properties)) {
    const propKeys = Object.keys(result.properties as Record<string, unknown>);
    if (propKeys.includes('assistantMessage') && !Array.isArray(result.propertyOrdering)) {
      const priority = ['assistantMessage', 'safety', 'dialogue', 'availabilityChange', 'patch', 'facts', 'locationDecision', 'serviceModeChangesJson', 'taxonomyDecisions'];
      const ordered = [
        ...priority.filter(k => propKeys.includes(k)),
        ...propKeys.filter(k => !priority.includes(k)),
      ];
      result.propertyOrdering = ordered;
    }
  }
  return result;
}

export function geminiRequestBody(raw: string): string {
  const payload = JSON.parse(raw);
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('AI_STREAM_INVALID');
  const generation = payload.generationConfig;
  if (!generation || typeof generation !== 'object' || Array.isArray(generation)) throw new Error('AI_STREAM_INVALID');
  const mime = generation.responseMimeType;
  const schema = generation.responseSchema;
  const specifiedTemperature = typeof generation.temperature === 'number' ? generation.temperature : undefined;
  delete generation.temperature;
  delete generation.topP;
  delete generation.topK;
  delete generation.responseMimeType;
  delete generation.responseSchema;
  delete generation.responseFormat;
  const incomingThinking = generation.thinkingConfig;
  delete generation.thinkingConfig;
  if (incomingThinking && typeof incomingThinking === 'object' && !Array.isArray(incomingThinking)) {
    generation.thinkingConfig = incomingThinking;
  } else {
    generation.thinkingConfig = { thinkingBudget: 0 };
  }
  if (specifiedTemperature !== undefined) {
    generation.temperature = specifiedTemperature;
  }
  if (mime !== undefined || schema !== undefined) {
    if (mime !== 'application/json' || !schema || typeof schema !== 'object' || Array.isArray(schema)) throw new Error('AI_STREAM_INVALID');
    // Structured output travels in the provider's documented generateContent fields. The
    // earlier `responseFormat: { text: { mimeType, schema } }` wrapper is rejected by this
    // API with INVALID_ARGUMENT on `responseFormat.text.mimeType`, which is what broke every
    // turn after the function was redeployed onto it.
    generation.responseMimeType = mime;
    generation.responseSchema = providerSchema(schema);
  }
  return JSON.stringify(payload);
}

// Closed diagnostic vocabulary. Never emit raw provider messages, metadata, keys or task text.
const statuses = new Set(['INVALID_ARGUMENT', 'UNAUTHENTICATED', 'PERMISSION_DENIED', 'NOT_FOUND',
  'RESOURCE_EXHAUSTED', 'FAILED_PRECONDITION', 'UNAVAILABLE', 'INTERNAL', 'DEADLINE_EXCEEDED']);
const reasons = new Set(['API_KEY_INVALID', 'API_KEY_EXPIRED', 'API_KEY_SERVICE_BLOCKED',
  'API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_IP_ADDRESS_BLOCKED', 'API_KEY_ANDROID_APP_BLOCKED',
  'API_KEY_IOS_APP_BLOCKED', 'SERVICE_DISABLED', 'BILLING_DISABLED', 'CONSUMER_INVALID',
  'ACCESS_TOKEN_EXPIRED', 'ACCESS_TOKEN_SCOPE_INSUFFICIENT']);
const fields: Record<string, string> = {
  'generation_config.response_format': 'RESPONSE_FORMAT', 'generationConfig.responseFormat': 'RESPONSE_FORMAT',
  'generation_config.response_schema': 'RESPONSE_SCHEMA', 'generationConfig.responseSchema': 'RESPONSE_SCHEMA',
  'generation_config.thinking_config.thinking_level': 'THINKING_LEVEL', 'generationConfig.thinkingConfig.thinkingLevel': 'THINKING_LEVEL',
  'generation_config.max_output_tokens': 'MAX_OUTPUT_TOKENS', 'generationConfig.maxOutputTokens': 'MAX_OUTPUT_TOKENS',
  // Structural paths only, still a closed list: an unlisted path stays UNKNOWN so no
  // upstream string can ever be printed. These narrow an INVALID_ARGUMENT to one node.
  'generation_config.response_format.text.schema': 'RESPONSE_FORMAT_SCHEMA',
  'generationConfig.responseFormat.text.schema': 'RESPONSE_FORMAT_SCHEMA',
  'generation_config.response_format.text.mime_type': 'RESPONSE_FORMAT_MIME',
  'generationConfig.responseFormat.text.mimeType': 'RESPONSE_FORMAT_MIME',
  'generation_config.response_format.text': 'RESPONSE_FORMAT_TEXT',
  'generationConfig.responseFormat.text': 'RESPONSE_FORMAT_TEXT',
  'generation_config.thinking_config': 'THINKING_CONFIG', 'generationConfig.thinkingConfig': 'THINKING_CONFIG',
  'generation_config': 'GENERATION_CONFIG', 'generationConfig': 'GENERATION_CONFIG',
  'system_instruction': 'SYSTEM_INSTRUCTION', 'systemInstruction': 'SYSTEM_INSTRUCTION',
  'contents': 'CONTENTS', 'model': 'MODEL', 'tools': 'TOOLS',
  'safety_settings': 'SAFETY_SETTINGS', 'safetySettings': 'SAFETY_SETTINGS',
};

export function geminiFailureDiagnostic(raw: unknown): { status: string; reason: string; field: string } {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const e = value.error && typeof value.error === 'object' && !Array.isArray(value.error)
    ? value.error as Record<string, unknown> : {};
  const status = typeof e.status === 'string' && statuses.has(e.status) ? e.status : 'UNKNOWN';
  let reason = 'UNKNOWN', field = 'UNKNOWN';
  for (const rawDetail of Array.isArray(e.details) ? e.details.slice(0, 10) : []) {
    if (!rawDetail || typeof rawDetail !== 'object' || Array.isArray(rawDetail)) continue;
    const detail = rawDetail as Record<string, unknown>;
    if (typeof detail.reason === 'string' && reasons.has(detail.reason)) reason = detail.reason;
    for (const violation of Array.isArray(detail.fieldViolations) ? detail.fieldViolations.slice(0, 10) : []) {
      if (violation && typeof violation === 'object' && typeof violation.field === 'string'
        && Object.hasOwn(fields, violation.field)) field = fields[violation.field];
    }
  }
  return { status, reason, field };
}

/** Bounded inspection for operator logs; diagnostics cannot authorize a retry/refund. */
async function reportGeminiHttpFailure(response: Response, signal: AbortSignal): Promise<void> {
  let raw: unknown;
  const reader = response.body?.getReader();
  let rejectStopped: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => { rejectStopped = reject; });
  const stop = () => rejectStopped(new Error('AI_STREAM_STOPPED'));
  try {
    if (!reader || signal.aborted) throw new Error('AI_STREAM_STOPPED');
    signal.addEventListener('abort', stop, { once: true });
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let text = '', bytes = 0;
    while (true) {
      const part = await Promise.race([reader.read(), stopped]);
      if (signal.aborted) throw new Error('AI_STREAM_STOPPED');
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 8192) throw new Error('AI_STREAM_TOO_LARGE');
      text += decoder.decode(part.value, { stream: true });
    }
    raw = JSON.parse(text + decoder.decode());
  } catch { /* Unknown details remain unknown; do not expose malformed upstream data. */ }
  finally { signal.removeEventListener('abort', stop); void reader?.cancel().catch(() => undefined); }
  const d = geminiFailureDiagnostic(raw);
  console.error('GEMINI_STREAM_HTTP_FAILED', response.status, d.status, d.reason, d.field);
}

/** Accounted input/output totals, never content. Output includes thinking. Cached
 * tokens are already part of input: this contract neither adds them nor discounts
 * them. A cache price adjustment requires its own verified pricing contract. */
export type GeminiUsage = { promptTokens: number; outputTokens: number; totalTokens: number };
export type GeminiUsageDetails = {
  usage: GeminiUsage | null;
  /** Raw provider prompt count, including its cached subset. */
  promptTokens: number | null;
  candidateTokens: number | null; thoughtTokens: number | null;
  toolUsePromptTokens: number | null; cachedPromptTokens: number | null;
  totalTokens: number | null;
};

const wholeCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= 10_000_000;

/** One decoder for generateContent and SSE, including failed provider attempts.
 * https://ai.google.dev/api/generate-content#UsageMetadata
 * total = prompt + tool-use prompt + candidates + thoughts. Missing optional
 * output/input counts are only zero when the reported total proves zero residual;
 * an unexplained residual is never guessed to be thinking. Invalid accounting
 * stays unknown and must not prevent delivery of an otherwise valid answer. */
export function decodeGeminiUsage(raw: unknown): GeminiUsageDetails {
  const metadata = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw as Record<string, unknown> : {};
  const count = (value: unknown): number | null => wholeCount(value) ? value : null;
  const promptTokens = count(metadata.promptTokenCount), candidateTokens = count(metadata.candidatesTokenCount);
  const totalTokens = count(metadata.totalTokenCount);
  let thoughtTokens = count(metadata.thoughtsTokenCount), toolUsePromptTokens = count(metadata.toolUsePromptTokenCount);
  const rawCached = count(metadata.cachedContentTokenCount);
  const cachedPromptTokens = rawCached !== null && promptTokens !== null && rawCached <= promptTokens ? rawCached : null;
  if (promptTokens !== null && candidateTokens !== null && totalTokens !== null) {
    // Only absence permits a proven zero. Explicit null/negative/string values are malformed.
    if (metadata.thoughtsTokenCount === undefined && (toolUsePromptTokens !== null || metadata.toolUsePromptTokenCount === undefined)
      && totalTokens === promptTokens + candidateTokens + (toolUsePromptTokens ?? 0)) thoughtTokens = 0;
    if (metadata.toolUsePromptTokenCount === undefined && (thoughtTokens !== null || metadata.thoughtsTokenCount === undefined)
      && totalTokens === promptTokens + candidateTokens + (thoughtTokens ?? 0)) toolUsePromptTokens = 0;
  }
  let usage: GeminiUsage | null = null;
  if (promptTokens !== null && candidateTokens !== null && totalTokens !== null
    && thoughtTokens !== null && toolUsePromptTokens !== null
    && totalTokens === promptTokens + toolUsePromptTokens + candidateTokens + thoughtTokens) {
    usage = { promptTokens: promptTokens + toolUsePromptTokens, outputTokens: candidateTokens + thoughtTokens, totalTokens };
  }
  return {
    usage,
    promptTokens, candidateTokens, thoughtTokens, toolUsePromptTokens, cachedPromptTokens, totalTokens,
  };
}

export function geminiUsage(raw: unknown): GeminiUsage | null {
  return decodeGeminiUsage(raw).usage;
}

export async function streamGeminiTask(input: {
  url: string; key: string; body: string; signal?: AbortSignal; onText: (delta: string) => void;
  onUsage?: (usage: GeminiUsage) => void;
  /** Count-only diagnostics, including unknown fields; never interpreted as a measured zero. */
  onUsageDetails?: (details: GeminiUsageDetails) => void;
  timeoutMs?: 30000;
}): Promise<string> {
  const controller = new AbortController();
  let rejectStopped: (error: Error) => void = () => {};
  const stoppedIO = new Promise<never>((_resolve, reject) => { rejectStopped = reject; });
  // Attach a handler even when cancellation precedes the first I/O operation.
  void stoppedIO.catch(() => undefined);
  const stop = () => { controller.abort(); rejectStopped(new Error('AI_STREAM_STOPPED')); };
  const timeout = setTimeout(stop, input.timeoutMs ?? 12000);
  input.signal?.addEventListener('abort', stop, { once: true });
  if (input.signal?.aborted) stop();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let lastUsage = decodeGeminiUsage(undefined), receivedCompleteBody = false;
  try {
    if (controller.signal.aborted) throw new Error('AI_STREAM_STOPPED');
    const pendingResponse = fetch(input.url, { method: 'POST', redirect: 'error', signal: controller.signal,
      headers: { 'x-goog-api-key': input.key, 'Content-Type': 'application/json', Accept: 'text/event-stream' }, body: geminiRequestBody(input.body) })
      .then(response => {
        // A transport may deliver headers after cancellation already won the race.
        // No reader owns that response, so release its body here without waiting.
        if (controller.signal.aborted) {
          void response.body?.cancel().catch(() => undefined);
          throw new Error('AI_STREAM_STOPPED');
        }
        return response;
      });
    const response = await Promise.race([pendingResponse, stoppedIO]);
    if (!response.ok) {
      await reportGeminiHttpFailure(response, controller.signal);
      if (response.status === 402) throw new GeminiCreditsUnavailableError();
      throw new Error('AI_STREAM_UNAVAILABLE');
    }
    if (response.redirected || !response.body || !response.headers.get('content-type')?.includes('text/event-stream')) {
      void response.body?.cancel().catch(() => undefined); throw new Error('AI_STREAM_UNAVAILABLE');
    }
    reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: true });
    let buffer = '', raw = '', emitted = '', total = 0, stopped = false;
    const event = (value: string) => {
      const lines = value.split('\n').filter(line => line.startsWith('data:')).map(line => line.slice(5).trim());
      if (!lines.length) return;
      const data = JSON.parse(lines.join('\n'));
      if (data.promptFeedback?.blockReason) throw new GeminiSafetyBlockedError(data.promptFeedback.blockReason);
      if (data.error) throw new Error('AI_STREAM_REJECTED');
      // Usage blocks are cumulative, not deltas. An explicit incomplete final block
      // supersedes older counts too: settling an earlier partial total undercharges.
      if (Object.hasOwn(data, 'usageMetadata')) lastUsage = decodeGeminiUsage(data.usageMetadata);
      if (!Array.isArray(data.candidates) || data.candidates.length > 1) throw new Error('AI_STREAM_INVALID');
      const candidate = data.candidates[0];
      if (!candidate) return;
      if (candidate.finishReason && ['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION'].includes(candidate.finishReason)) {
        throw new GeminiSafetyBlockedError(candidate.finishReason);
      }
      if (Array.isArray(candidate.safetyRatings) && candidate.safetyRatings.some((rating: any) => rating?.blocked === true))
        throw new GeminiSafetyBlockedError('SAFETY');
      if (candidate.finishReason && candidate.finishReason !== 'STOP') throw new Error('AI_STREAM_INCOMPLETE');
      if (candidate.finishReason === 'STOP') stopped = true;
      for (const part of candidate.content?.parts ?? []) {
        if (part.thought === true) continue;
        if (typeof part.text !== 'string') throw new Error('AI_STREAM_INVALID');
        raw += part.text;
        if (raw.length > 131072) throw new Error('AI_STREAM_TOO_LARGE');
        const safe = assistantPrefix(raw);
        if (!safe.startsWith(emitted)) throw new Error('AI_STREAM_INVALID');
        if (safe.length > emitted.length) {
          const delta = safe.slice(emitted.length); emitted = safe;
          if (controller.signal.aborted) throw new Error('AI_STREAM_STOPPED');
          input.onText(delta);
        }
      }
    };
    while (true) {
      const part = await Promise.race([reader.read(), stoppedIO]);
      if (controller.signal.aborted) throw new Error('AI_STREAM_STOPPED');
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 524288) throw new Error('AI_STREAM_TOO_LARGE');
      buffer = (buffer + decoder.decode(part.value, { stream: true })).replace(/\r\n/g, '\n');
      let boundary: number;
      while ((boundary = buffer.indexOf('\n\n')) !== -1) { event(buffer.slice(0, boundary)); buffer = buffer.slice(boundary + 2); }
      if (buffer.length > 131072) throw new Error('AI_STREAM_TOO_LARGE');
    }
    buffer += decoder.decode();
    if (buffer.trim()) event(buffer);
    receivedCompleteBody = true;
    if (!stopped || typeof JSON.parse(raw).assistantMessage !== 'string' || JSON.parse(raw).assistantMessage !== emitted) throw new Error('AI_STREAM_INCOMPLETE');
    return raw;
  } finally {
    // A fully received provider response can have invalid application JSON but still
    // consume known tokens. An interrupted body must not settle an intermediate total.
    if (receivedCompleteBody) {
      if (input.onUsageDetails) { try { input.onUsageDetails(lastUsage); } catch { /* accounting never breaks delivery */ } }
      if (lastUsage.usage && input.onUsage) { try { input.onUsage(lastUsage.usage); } catch { /* accounting never breaks delivery */ } }
    }
    clearTimeout(timeout); input.signal?.removeEventListener('abort', stop); controller.abort();
    void reader?.cancel().catch(() => undefined);
  }
}
