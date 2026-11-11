// @ts-nocheck
import { measureAiPhase } from '../_shared/aiPhaseTiming.mjs';
import { readSupabasePublishableKey, readSupabaseServiceKey, supabaseServiceHeaders } from '../_shared/supabaseKeys.mjs';
import { taxonomyIntakeEnabled } from '../_shared/taxonomyRuntimeConfig.mjs';
// New taxonomy operations have a single explicit server-side rollout owner.
import { AI_CREDITS_UNAVAILABLE, AI_DIAGNOSTICS_HEADER, AI_DIAGNOSTICS_VERSION, AI_AVAILABILITY_HEADER } from '../../../src/contracts/aiAvailability.ts';
// USKOCI server-side AI intake boundary.
// Provider secrets live only in Supabase Edge Function environment. Never expose
// GEMINI_API_KEY / SUPABASE_SERVICE_ROLE_KEY to Expo, source or logs.

import {
  LEGACY_FACT_SCHEMA_V1,
  NEED_FACT_SCHEMA_V2,
  NEED_FACT_V2_DEFINITIONS,
  AI_PROPOSABLE_NEED_FACT_V2_KEYS,
  MAX_AI_NEED_FACT_V2_PROPOSALS,
  NEED_FACT_TURN_CAPABILITY_HEADER,
  NEED_FACT_TURN_CAPABILITY_VERSION,
  isAiProposableNeedFactV2Key,
  isNeedFactV2Key,
} from '../../../src/contracts/needFactsV2.ts';
import { decodeTaskApplicationDeadlineFact } from '../../../src/contracts/taskApplicationDeadline.ts';

import { validLocationContext, locationProviderSchema, locationInstruction, parseLocationOutput, validLocationEnvelope, type LocationContext, type LocationAction } from '../_shared/locationReply.ts';

import { interviewVoiceInstruction } from '../_shared/interviewVoiceInstruction.mjs';
import { AI_TEST_LIMITS, reserveAiTestBudget } from '../_shared/aiTestBudget.ts';
import { GeminiCreditsUnavailableError, GeminiSafetyBlockedError, geminiRequestBody, geminiUsage, streamGeminiTask, type GeminiUsage } from '../_shared/geminiTaskStream.ts';
import { singlePassTaxonomyInstruction, withSinglePassTaxonomySchema, takeSinglePassTaxonomy, singlePassCapturePlan, singlePassCompletion, withUnresolvedSinglePassReply } from '../_shared/singlePassTaxonomy.mjs';
import { completeFirstPlan } from '../_shared/completeFirstPlan.ts';
import { serviceExecutionInstruction } from '../_shared/serviceExecutionInstruction.mjs';
import { decodeServiceHandoff } from '../_shared/serviceHandoff.mjs';
import { createResearchDeadline } from '../_shared/researchDeadline.ts';
import { getOrCreateGeminiContextCache } from '../_shared/geminiContextCache.mjs';
import { INTERVIEW_INTENT_HEADER, INTERVIEW_INTENT_CAPABILITY, withConversationIntentSchema, conversationIntentInstruction,
  takeConversationIntent, intentAllowsDomain, guardInterviewIntentOutput, conversationIntentHint } from '../_shared/conversationIntent.mjs';

import {
  buildFullTreeTaxonomyProposals,
  loadFullCatalogTree,
  taskTaxonomyMode,
  taskTaxonomyScope,
  taskClassificationFingerprint,
  normalizedClassificationIdentity,
  runInBackground,
  persistClarificationHint,
  persistConsumeClarificationHint,
  fetchUnconsumedClarificationHint,
} from '../_shared/backgroundTaxonomyArchitect.mjs';

const isLiveTaxonomyIntake = (): boolean => taxonomyIntakeEnabled((key:string)=>Deno.env.get(key));

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': `authorization, apikey, content-type, x-client-info, ${NEED_FACT_TURN_CAPABILITY_HEADER}, ${INTERVIEW_INTENT_HEADER}`,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const LEGACY_FACT_KEYS = [
  'naslov', 'opis', 'kategorija', 'datum', 'vreme',
  'polaziste', 'odrediste', 'osoba', 'vozilo', 'uslovi',
] as const;
const legacyFactKeySet = new Set<string>(LEGACY_FACT_KEYS);
// Retired requirements stay readable in historical NEED_FACT_V2 documents, but
// a new interview may only propose conditions the current product enforces.
// Keep the old deployed writer compatible until the candidate registry/review RPC
// is admitted. A source build alone must not send an unknown fact to DEV.
const applicationDeadlineEnabled = () => Deno.env.get('USKOCI_TASK_AI_APPLICATION_DEADLINE_V1') === 'true';
export const INTERVIEW_NEED_FACT_V2_KEYS = AI_PROPOSABLE_NEED_FACT_V2_KEYS.filter(key => key !== 'need.required_licenses')
  .filter(key => key !== 'need.response_deadline' || applicationDeadlineEnabled());
const interviewFactKeySet = new Set<string>(INTERVIEW_NEED_FACT_V2_KEYS);
// Manual form witnesses remain in the full registry, but are neither AI input
// nor AI proposals. Keep legacy context during the existing schema transition.
const AI_CONTEXT_FACT_KEYS = [...LEGACY_FACT_KEYS, ...INTERVIEW_NEED_FACT_V2_KEYS];
const aiContextFactKeySet = new Set<string>(AI_CONTEXT_FACT_KEYS);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const PRICE_MODES = new Set(['MY_PRICE', 'OFFERS']);
const PRICE_BASES = new Set(['TOTAL', 'PER_PERSON', 'HOURLY']);
const SCHEDULE_KINDS = new Set([
  'FIXED_WINDOW',
  'FLEXIBLE',
  'REMOTE_ANYTIME',
  'TODAY_FLEXIBLE',
  'TOMORROW_FLEXIBLE',
  'WEEK_FLEXIBLE',
]);
const GEOGRAPHY_MODES = new Set(['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED', 'REMOTE']);

type FactSchemaVersion = typeof LEGACY_FACT_SCHEMA_V1 | typeof NEED_FACT_SCHEMA_V2;
type ParsedTurn = {
  safety: 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK';
  assistantMessage: string;
  proposals: Array<Record<string, unknown>>;
  // Set only by the deterministic guard, never accepted from model output.
  priceRetraction?: 'UNSUPPORTED_CURRENCY' | 'AMBIGUOUS_CURRENCY' | 'UNSUPPORTED_PRICE_BASIS';
  locationAction?: LocationAction;
  dialogue?: { next: string; questionKey: string; taskRelation: string; priceUnit: string; schedulePattern: string };
  // Validated current-turn provider proposal. Never part of a fact/SQL receipt.
  intentDecision?: ReturnType<typeof takeConversationIntent>;
  intentAllowsChanges?: boolean;
};

const DIALOGUE_VALUES = {
  next: ['ASK', 'CLARIFY', 'REVIEW', 'ACK', 'ANSWER'],
  questionKey: ['', 'need.description', 'need.people_needed', 'need.price_mode', 'need.price_rsd', 'need.price_basis',
    'need.schedule_kind', 'need.starts_at', 'need.ends_at',
    ...(applicationDeadlineEnabled() ? ['need.response_deadline'] : []),
    'need.task_country_code', 'need.task_geography', 'need.handoff'],
  taskRelation: ['CONTINUE', 'DIFFERENT_TASK', 'UNCLEAR'],
  priceUnit: ['WHOLE_JOB', 'PER_DAY', 'PER_HOUR', 'PER_TEAM_HOUR', 'UNSPECIFIED'],
  schedulePattern: ['SINGLE', 'FLEXIBLE_RANGE', 'REPEATED', 'UNSPECIFIED'],
};

type ServerTimeContext = {
  nowUtc: string;
  timeZone: 'Europe/Belgrade';
  localDate: string;
  localTime: string;
  utcOffset: string;
  nextCalendarWeek: { startsAt: string; endsAt: string; inclusiveLastDate: string } | null;
};

function serbiaTimeParts(now: Date): Omit<ServerTimeContext, 'nextCalendarWeek'> {
  const timeZone = 'Europe/Belgrade' as const;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    timeZoneName: 'longOffset',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return {
    nowUtc: now.toISOString(), timeZone,
    localDate: `${part('year')}-${part('month')}-${part('day')}`,
    localTime: `${part('hour')}:${part('minute')}:${part('second')}`,
    utcOffset: part('timeZoneName').replace(/^GMT/, '') || '+00:00',
  };
}

function serbiaMidnight(localDate: string): string | null {
  // Resolve a calendar date with the IANA rules for that date, never today's
  // offset. The round trip rejects a nonexistent midnight instead of shifting it.
  const wallTime = Date.parse(`${localDate}T00:00:00Z`);
  let instant = wallTime;
  for (let attempt = 0; attempt < 3; attempt++) {
    const parts = serbiaTimeParts(new Date(instant));
    const offset = Date.parse(`${localDate}T00:00:00Z`) - Date.parse(`${localDate}T00:00:00${parts.utcOffset}`);
    const next = wallTime - offset;
    if (next === instant) break;
    instant = next;
  }
  const resolved = serbiaTimeParts(new Date(instant));
  return resolved.localDate === localDate && resolved.localTime === '00:00:00'
    ? `${localDate}T00:00:00${resolved.utcOffset}` : null;
}

function serverTimeContext(now: Date): ServerTimeContext {
  const current = serbiaTimeParts(now);
  const localDay = new Date(`${current.localDate}T12:00:00Z`);
  const untilMonday = (8 - localDay.getUTCDay()) % 7 || 7;
  const dateAfter = (days: number) => new Date(localDay.getTime() + days * 86400000).toISOString().slice(0, 10);
  const startsAt = serbiaMidnight(dateAfter(untilMonday));
  const endsAt = serbiaMidnight(dateAfter(untilMonday + 7));
  return { ...current, nextCalendarWeek: startsAt && endsAt
    ? { startsAt, endsAt, inclusiveLastDate: dateAfter(untilMonday + 6) } : null };
}

function validTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return false;
  const instant = Date.parse(value);
  if (!Number.isFinite(instant)) return false;
  // Date.parse accepts some invalid calendar days by normalizing into the next
  // month. Validate the supplied civil date independently of its explicit offset.
  const offset = value.endsWith('Z') ? '+00:00' : value.slice(-6);
  const offsetMs = (offset[0] === '-' ? -1 : 1) * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(4))) * 60000;
  return new Date(instant + offsetMs).toISOString().slice(0, 19) === value.slice(0, 19);
}

function guardTimestampProposals(turn: ParsedTurn, input: string, activeFacts: any[], time: ServerTimeContext, pendingDeadlineQuestion = false): ParsedTurn {
  const known = new Map(activeFacts.filter(f => f.status !== 'UNKNOWN').map(f => [f.fact_key, f.fact_value]));
  const deadlineProposal = turn.proposals.find(p => p.key === 'need.response_deadline');
  if (deadlineProposal) {
    const decision = decodeTaskApplicationDeadlineFact(deadlineProposal.value);
    const evidence = typeof deadlineProposal.evidence === 'string' ? deadlineProposal.evidence.trim() : '';
    const anchored = evidence.length >= 3 && input.toLocaleLowerCase('sr').includes(evidence.toLocaleLowerCase('sr'));
    const explicitClear = /(?:bez\s+(?:posebnog\s+)?roka|nema\s+roka|(?:ukloni|obriši|obrisi|poništi|ponisti)\s+(?:taj\s+)?rok|prijave\s+(?:ostaju|neka\s+ostanu)\s+otvorene)/iu.test(evidence);
    const applicationIntent = /prijav|ponud|javlj|jave|odgovor|konkuri/iu.test(input);
    const hold = /(?:ne\s+menjaj|ne\s+diraj|ostavi\s+(?:isti|stari)|nemoj\s+da\s+menjaš)[^.!?]{0,32}rok/iu.test(input);
    const instant = decision?.kind === 'AT' ? Date.parse(decision.at) : NaN;
    const unchanged = decision && JSON.stringify(known.get('need.response_deadline')) === JSON.stringify(decision);
    const literal = decision?.kind === 'AT' && input.includes(decision.at) && evidence.includes(decision.at);
    const local = decision?.kind === 'AT' && Number.isFinite(instant) ? serbiaTimeParts(new Date(instant)) : null;
    const offset = decision?.kind === 'AT' ? decision.at.endsWith('Z') ? '+00:00' : decision.at.slice(-6) : '';
    const localMismatch = decision?.kind === 'AT' && !unchanged && !literal && local &&
      (`${local.localDate}T${local.localTime}` !== decision.at.slice(0, 19) || local.utcOffset !== offset);
    const relativeDays = /\bprekosutra\b/iu.test(evidence) ? 2 : /\bsutra\b/iu.test(evidence) ? 1 : /\bdanas\b/iu.test(evidence) ? 0 : null;
    const expectedRelativeDate = relativeDays === null ? null
      : new Date(Date.parse(`${time.localDate}T12:00:00Z`) + relativeDays * 86400000).toISOString().slice(0, 10);
    const relativeMismatch = decision?.kind === 'AT' && !unchanged && !literal && expectedRelativeDate !== null
      && local?.localDate !== expectedRelativeDate;
    const expired = decision?.kind === 'AT' && instant <= Date.parse(time.nowUtc);
    if (!decision || !anchored || hold || decision.kind === 'NONE' && !explicitClear || decision.kind === 'AT' && !applicationIntent && !pendingDeadlineQuestion || expired || localMismatch || relativeMismatch) {
      return { ...turn, safety: turn.safety === 'REVIEW' ? 'REVIEW' : 'CLARIFY',
        proposals: turn.proposals.filter(p => p.key !== 'need.response_deadline'),
        dialogue: turn.safety === 'REVIEW' ? turn.dialogue : turn.dialogue ? { ...turn.dialogue, next: 'CLARIFY', questionKey: '' } : undefined,
        assistantMessage: 'Rok za prijave nisam promenio. Da proverim: do kog datuma i sata po vremenu u Srbiji, ili želite izričito bez posebnog roka?' };
    }
  }
  const country = turn.proposals.find(p => p.key === 'need.task_country_code')?.value ?? known.get('need.task_country_code');
  const invalid = turn.proposals.some(proposal => {
    if (!['need.starts_at', 'need.ends_at'].includes(proposal.key)) return false;
    const value = proposal.value;
    if (!validTimestamp(value)) return true;
    // An unchanged active fact is not reinterpreted. A user's literal ISO instant
    // may intentionally use UTC or another offset; preserve it byte for byte.
    if (known.get(proposal.key) === value || input.includes(value) && String(proposal.evidence ?? '').includes(value)) return false;
    // RS is the currently admitted market. Do not assign Belgrade to a different
    // explicitly selected country; its admission remains the database's job.
    if (country && country !== 'RS') return false;
    const local = serbiaTimeParts(new Date(value));
    return `${local.localDate}T${local.localTime}` !== value.slice(0, 19)
      || local.utcOffset !== (value.endsWith('Z') ? '+00:00' : value.slice(-6));
  });
  if (!invalid) return turn;
  // An offset error never silently moves the user's instant or drops another
  // answer. Keep a policy REVIEW intact; it cannot be downgraded by a time guard.
  return { ...turn, safety: turn.safety === 'REVIEW' ? 'REVIEW' : 'CLARIFY',
    proposals: turn.proposals.filter(p => !['need.schedule_kind', 'need.starts_at', 'need.ends_at'].includes(p.key)),
    ...(turn.safety === 'REVIEW' ? {} : {
      dialogue: turn.dialogue ? { ...turn.dialogue, next: 'CLARIFY', questionKey: '' } : undefined,
      assistantMessage: 'Da proverim termin: mislite na navedene datume po lokalnom vremenu u Srbiji ili u drugoj vremenskoj zoni?',
    }) };
}

function response(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store',
      ...(status === 503 && body.code === AI_CREDITS_UNAVAILABLE ? { [AI_AVAILABILITY_HEADER]: AI_CREDITS_UNAVAILABLE, 'Access-Control-Expose-Headers': AI_AVAILABILITY_HEADER } : {}) },
  });
}

const object = (value: unknown): value is Record<string, any> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: unknown, keys: string[]) => object(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const isUuid = (value: unknown): value is string => typeof value === 'string' && uuidPattern.test(value);
const sameUuid = (value: unknown, expected: string) => isUuid(value) && value.toLowerCase() === expected.toLowerCase();

// What an operator log may say about a failed provider call: the class of the failure, from a closed
// list. Never the thrown text. A JSON parse error quotes the provider output it choked on, a runtime
// network error quotes its request, and a text that is merely shaped like one of our names proves
// nothing about where it came from. A name that is not listed is logged as UNKNOWN.
const OWN_FAILURE_NAMES = new Set([AI_CREDITS_UNAVAILABLE, 'AI_CLAIM_INVALID', 'AI_CONTEXT_INVALID', 'AI_CONTEXT_TOO_LARGE', 'AI_LEGACY_PERSIST_FAILED',
  'AI_MANUAL_ONLY_FACT_REJECTED', 'AI_PAYLOAD_EMPTY', 'AI_PAYLOAD_TOO_LARGE', 'AI_PRICE_RETRACTION_CONFLICT', 'AI_STREAM_INCOMPLETE',
  'AI_STREAM_INVALID', 'AI_STREAM_REJECTED', 'AI_STREAM_STOPPED', 'AI_STREAM_TOO_LARGE', 'AI_STREAM_UNAVAILABLE',
  'AI_TEST_ACCOUNTING_UNCONFIRMED', 'AI_TEST_BUDGET_UNAVAILABLE', 'AI_TRANSPORT_STOPPED', 'AI_TURN_RECEIPT_INVALID', 'AI_V2_FACT_INVALID', 'AI_V2_OUTPUT_INVALID',
  'ASSISTANT_MESSAGE_INVALID', 'ASSISTANT_MESSAGE_MISSING', 'PROVIDER_HTTP_FAILED', 'PROVIDER_OUTPUT_MISSING']);
const RUNTIME_FAILURE_CLASSES: Record<string, string> = { SyntaxError: 'OUTPUT_NOT_JSON', TypeError: 'RUNTIME_TYPE_ERROR',
  RangeError: 'RUNTIME_RANGE_ERROR', AbortError: 'ABORTED', TimeoutError: 'TIMED_OUT' };
function providerFailureClass(error: unknown): string {
  if (error instanceof GeminiSafetyBlockedError) return 'GEMINI_SAFETY_BLOCKED';
  const thrown = object(error) ? error : {};
  if (typeof thrown.message === 'string' && OWN_FAILURE_NAMES.has(thrown.message)) return thrown.message;
  return typeof thrown.name === 'string' && Object.hasOwn(RUNTIME_FAILURE_CLASSES, thrown.name) ? RUNTIME_FAILURE_CLASSES[thrown.name] : 'UNKNOWN';
}

/** Bounds both fetch and body consumption. Abort does not prove remote rollback. */
async function boundedJson(input: string | Request, init: RequestInit = {}, limit = 524288, timeout = 8000, parent?: AbortSignal, omitErrorBody = false) {
  const controller = new AbortController();
  let expired = false;
  let timer: ReturnType<typeof setTimeout>;
  let rejectStopped: (reason: Error) => void = () => {};
  const stopped = new Promise<never>((_resolve, reject) => { rejectStopped = reject; });
  const stop = () => { expired = true; controller.abort(); rejectStopped(new Error('AI_TRANSPORT_STOPPED')); };
  if (parent?.aborted) stop();
  else parent?.addEventListener('abort', stop, { once: true });
  timer = setTimeout(stop, timeout);
  const work = async () => {
    if (expired) throw new Error('AI_TRANSPORT_STOPPED');
    const result = typeof input === 'string'
      ? await fetch(input, { ...init, signal: controller.signal, redirect: 'error' }) : input;
    if (expired || result instanceof Response && result.redirected) throw new Error('AI_TRANSPORT_STOPPED');
    if (omitErrorBody && result instanceof Response && !result.ok) {
      void result.body?.cancel().catch(() => {});
      return { ok: false, status: result.status, data: null };
    }
    const size = result.headers.get('content-length');
    if (size !== null && (!/^\d+$/.test(size) || Number(size) > limit)) throw new Error('AI_PAYLOAD_TOO_LARGE');
    const reader = result.body?.getReader();
    if (!reader) throw new Error('AI_PAYLOAD_EMPTY');
    const chunks: Uint8Array[] = []; let count = 0;
    try {
      while (true) {
        const part = await Promise.race([reader.read(), stopped]);
        if (expired) throw new Error('AI_TRANSPORT_STOPPED');
        if (part.done) break;
        count += part.value.byteLength;
        if (count > limit) throw new Error('AI_PAYLOAD_TOO_LARGE');
        chunks.push(part.value);
      }
    } finally { if (expired || count > limit) void reader.cancel().catch(() => {}); }
    const bytes = new Uint8Array(count); let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    return { ok: result instanceof Response ? result.ok : true, status: result instanceof Response ? result.status : 200, data };
  };
  try { return await Promise.race([work(), stopped]); }
  finally { clearTimeout(timer); parent?.removeEventListener('abort', stop); }
}

const userWindows = new Map<string, { times: number[]; busy: boolean }>();
function admitUser(accountId: string) {
  const now = Date.now();
  for (const [id, value] of userWindows) if (!value.busy && !value.times.some(time => time > now - 60000)) userWindows.delete(id);
  let value = userWindows.get(accountId);
  if (!value) {
    if (userWindows.size >= 2000) return null;
    value = { times: [], busy: false }; userWindows.set(accountId, value);
  }
  value.times = value.times.filter(time => time > now - 60000);
  if (value.busy || value.times.length >= 6) return null;
  value.times.push(now); value.busy = true;
  return () => { value!.busy = false; };
}

function validTurn(value: unknown, conversationId: string, requestId: string) {
  if (!exact(value, ['conversationId', 'clientRequestId', 'state', 'turnId', 'retryAllowed', 'receipt']) ||
    !sameUuid(value.conversationId, conversationId) || !sameUuid(value.clientRequestId, requestId) ||
    !['ABSENT', 'PROCESSING', 'SUCCEEDED', 'FAILED'].includes(value.state) || typeof value.retryAllowed !== 'boolean') return false;
  if (value.state === 'ABSENT') return value.turnId === null && value.receipt === null;
  if (!isUuid(value.turnId)) return false;
  if (value.state !== 'SUCCEEDED') return value.receipt === null && (value.state !== 'PROCESSING' || value.retryAllowed === false);
  const r = value.receipt;
  return !value.retryAllowed && exact(r, ['userMessageId', 'assistantMessageId', 'proposedCount', 'safety', 'schemaVersion', 'authoritative']) &&
    isUuid(r.userMessageId) && isUuid(r.assistantMessageId) && r.userMessageId !== r.assistantMessageId &&
    Number.isSafeInteger(r.proposedCount) && r.proposedCount >= 0 && r.proposedCount <= MAX_AI_NEED_FACT_V2_PROPOSALS &&
    ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(r.safety) && r.schemaVersion === NEED_FACT_SCHEMA_V2 && r.authoritative === true &&
    (r.safety !== 'BLOCK' || r.proposedCount === 0);
}
const turnResponse = (turn: any) => response(turn.state === 'SUCCEEDED' ? 200 : turn.state === 'PROCESSING' ? 202 : 409, turn);

function validClaimContext(context: unknown) {
  if (!exact(context, ['schemaVersion', 'history', 'activeFacts']) || context.schemaVersion !== NEED_FACT_SCHEMA_V2 ||
    !Array.isArray(context.history) || context.history.length > 40 || !Array.isArray(context.activeFacts) || context.activeFacts.length > 64) return false;
  return context.history.every((row: unknown) => exact(row, ['role', 'body', 'sequence_no']) &&
    ['USER', 'ASSISTANT', 'SYSTEM'].includes(row.role) && typeof row.body === 'string' && row.body.length <= 6000 &&
    Number.isSafeInteger(row.sequence_no) && row.sequence_no > 0) &&
    context.activeFacts.every((row: unknown) => exact(row, ['fact_key', 'fact_value', 'value_type', 'display_value', 'fact_schema_version', 'status', 'source', 'created_at']) &&
      isAiProposableNeedFactV2Key(row.fact_key) && row.fact_schema_version === NEED_FACT_SCHEMA_V2);
}

function geminiText(payload: any): string | null {
  for (const candidate of payload?.candidates ?? []) {
    for (const part of candidate?.content?.parts ?? []) {
      if (typeof part?.text === 'string' && part.text.trim()) return part.text;
    }
  }
  return null;
}

async function postgrest(
  url: string,
  apiKey: string,
  authorization: string,
  path: string,
  init: RequestInit = {},
) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: apiKey,
      Authorization: authorization,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
}

function legacyProviderSchema() {
  return {
    type: 'OBJECT',
    additionalProperties: false,
    properties: {
      safety: { type: 'STRING', enum: ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'] },
      assistantMessage: { type: 'STRING' },
      facts: {
        type: 'ARRAY',
        maxItems: 10,
        items: {
          type: 'OBJECT',
          additionalProperties: false,
          properties: {
            key: { type: 'STRING', enum: LEGACY_FACT_KEYS },
            value: { type: 'STRING' },
            confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
            evidence: { type: 'STRING' },
          },
          required: ['key', 'value', 'confidence', 'evidence'],
        },
      },
    },
    required: ['safety', 'assistantMessage', 'facts'],
  };
}

function v2ProviderSchema(maxProposals = 12) {
  return withConversationIntentSchema({
    type: 'OBJECT',
    additionalProperties: false,
    properties: {
      safety: { type: 'STRING', enum: ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'] },
      assistantMessage: { type: 'STRING' },
      dialogue: { type: 'OBJECT', additionalProperties: false,
        // Gemini rejects an empty string enum member. Keep the internal no-question
        // marker at the decoder boundary; only the nonempty sentinel travels on wire.
        properties: Object.fromEntries(Object.entries(DIALOGUE_VALUES).map(([key, values]) =>
          [key, { type: 'STRING', enum: values.map(value => value === '' ? 'NONE' : value) }])),
        required: Object.keys(DIALOGUE_VALUES) },
      facts: {
        type: 'ARRAY',
        maxItems: maxProposals,
        items: {
          type: 'OBJECT',
          additionalProperties: false,
          properties: {
            key: { type: 'STRING', enum: INTERVIEW_NEED_FACT_V2_KEYS },
            // JSON encoded as a string keeps Gemini/OpenAI structured-output
            // contracts provider-neutral. Edge parses it back to real JSON and
            // PostgreSQL remains the final type/range/enum authority.
            valueJson: { type: 'STRING' },
            displayValue: { type: 'STRING' },
            confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
            evidence: { type: 'STRING' },
          },
          required: ['key', 'valueJson', 'displayValue', 'confidence', 'evidence'],
        },
      },
    },
    required: ['safety', 'assistantMessage', 'facts', 'dialogue'],
  });
}

function needRuntimeContext(activeFacts: any[], timeContext: ServerTimeContext) {
  // Defense in depth if the context transport returns rows outside its query
  // allowlist. This filters structured facts, not arbitrary conversation text.
  const known = activeFacts.filter((fact) => aiContextFactKeySet.has(fact?.fact_key)).map((fact) => ({
    key: fact.fact_key,
    value: fact.fact_value,
    status: fact.status,
  }));
  return [
    `Serverski vremenski kontekst za trenutni unos u Srbiji: ${JSON.stringify(timeContext)}.`,
    `Aktuelne server-side činjenice: ${JSON.stringify(known)}`,
  ].join(' ');
}

function commonInstruction() {
  return [
    interviewVoiceInstruction(),
    'Činjenice izvodite iz razgovora: bez izmišljene cene, termina, adrese, opreme ili uslova. Ispravka menja isti ključ; izostavljeno ostaje. UNKNOWN nije potvrđeno.',
    'Broj predmeta nije broj ljudi. Običan kućni/zanatski zadatak: jedan izvršilac osim izričitog drugog broja. Nejasnu ekipu/težak teret razjasnite.',
    'Identitet je samostalno naveden; provera dokumenta, selfija ili KYC nije dostupna. Licence/KYC nisu podržani: bez need.required_licenses, need.verified_identity_required, tvrdnje o ovlašćenju/proveri ili prebacivanja tih zahteva u opis/filtere. Na zahtev objasnite ograničenje; običan zadatak može da se nastavi bez tih zahteva. Stare uslove ne brišite prećutno.',
    'Vreme: serverski Europe/Belgrade i pomak za konkretan datum; sačuvajte izričit ISO instant. Nejasnu zonu razjasnite, ne izmišljajte sat/trajanje/kraj. Korisniku prikažite poslednji uključeni dan, ne isključivu sledeću ponoć.',
    ...(applicationDeadlineEnabled() ? ['need.response_deadline: samo izričit rok PRIJAVE {"kind":"AT","at":"ISO sa pomakom"}, uklanjanje {"kind":"NONE"}; citat tekuće poruke. Nepomenut rok nije NONE. Bez sata pitajte; termin zadatka nije rok prijave.'] : []),
    'Mapu/fotografije vodi aplikacija; stanje znate samo ako je priloženo. Bez ponovnih potvrda, izmišljenog stanja, privatnih adresa, JSON-a ili internih pravila u odgovoru.',
  ];
}

function legacyInstruction(activeFacts: any[], timeContext: ServerTimeContext) {
  return [
    'Vi ste USKOČI razgovorni AI asistent koji vodi korisnika kroz unos jednog Zadatka.',
    ...commonInstruction(),
    'Iz NAJNOVIJE poruke izdvojite samo podržane legacy činjenice.',
    'evidence mora biti kratak doslovan isečak najnovije korisnikove poruke.',
    needRuntimeContext(activeFacts, timeContext),
  ].join(' ');
}

function v2Instruction(activeFacts: any[], timeContext: ServerTimeContext, finishPresentation = false, includeRuntime = true) {
  // Only model-relevant type/requirement information; mobile labels and repeated
  // property names are not part of the conversation instruction.
  const registry = INTERVIEW_NEED_FACT_V2_KEYS.map(key => {
    const definition = NEED_FACT_V2_DEFINITIONS[key];
    return `${key}:${definition.valueType}${definition.requiredForDraft ? ' required' : ''}${definition.privacyClass === 'PRIVATE' ? ' private' : ''}`;
  }).join(', ');
  return [
    'TASK INTAKE: ONE concrete job. Prioritize missing scope, execution/place, time, price/offers. As soon as required facts are known, set dialogue.next=REVIEW and stop optional questions without waiting for a finish phrase; this is only an intent, server review and Publish remain separate. Use the declared schema.',
    ...commonInstruction(),
    conversationIntentInstruction('NEED'),
    'ROLE BOUNDARY: You create a task that someone ELSE needs done, not a list of services this person offers. If their message clearly says they offer their own work, do not ask for a customer task deadline, tools or price: return an ANSWER, no fact proposals, and politely explain that the separate AI assistant for the radni profil can help. The app offers the actual switch; never claim navigation or Save happened. If they both offer and request work, ask just one question to clarify the intent. Address users formally with Vi/Vam/Vas.',
    'Scope: ask only relevant distinctions (wall/floor area, load/access, lesson subject/level, route, digital deliverable). Unknown optional details can remain for agreement. Capture ALL distinct details already stated in this turn and confirmed history: stairs/no lift, size/fragility, access, material, route, equipment needs and limits. Preserve them as accurate need.description/need.critical_conditions or private access_notes as appropriate; never invent missing details or ask again for ones supplied. Draft a short need.title and clear need.description retaining scope/materials/limits, excluding uncertain execution, private addresses and duplicated price/dates. Corrections remove stale claims, not unrelated detail or typed facts.',
    'need.people_needed: positive integer (1..50). Default to 1 for standard individual work (majstor, popravka, časovi, moler, čišćenje, prevoz, servis). Only ask about people count or propose >1 if the task inherently requires a team (heavy moving, construction crew) or if user explicitly mentions multiple workers/people. If user does not mention people count, propose need.people_needed=1.',
    'need.category: internal natural action+object, no path/place/price/date/quantity or generic fallback. Derive from clear work: room size does not change service; painting a car does. facts contains only new/changed schema keys; valueJson is a JSON-encoded value of its registered type. evidence: short verbatim USER quote; title/description synthesis may use "Sinteza potvrđenih činjenica i razgovora". An acknowledgement alone is not a fact update.',
    'dialogue.next: ASK=one missing fact with questionKey; CLARIFY=ambiguity, including known description; ACK=correction without question; ANSWER=explanation; REVIEW=business essentials clear, an internal intent only. Non-ASK questionKey=NONE.',
    'Finish-only adds no conditions or changed values. Only missing title/category may derive from clear saved description, with its literal excerpt as evidence. taskRelation CONTINUE=initial/same task; DIFFERENT_TASK=explicit separate task, keep this draft and direct to Novi zadatak; UNCLEAR=ask intent. Replacing the work in this draft requires deciding which old price/time/place remain; until clear use CONTINUE/CLARIFY, facts [], one question. Never silently transfer/erase terms.',
    'Price: MY_PRICE needs a positive integer amount in need.price_rsd; OFFERS requests offers. If user specifies EUR/evri/€ (e.g. 50 evra or 50€), NEVER put its numeral in need.price_rsd: only whole RSD is supported. Do not convert it or claim EUR was saved. Ask for a user-confirmed amount in RSD while preserving independent scope/place/time/people details. If user says dinari, RSD, or enters a bare positive integer without currency (e.g. 3000), default to RSD. need.price_basis (MY_PRICE): TOTAL=whole job, PER_PERSON=each person, HOURLY=each person/hour. Store the unit amount, not people×hours. Honor explicit units; clarify ambiguous multi-person/team-hour amounts, never divide them. Day rates unsupported. TOTAL partial-team price=round(total × offered people / requested people), explain only on request.',
    'dialogue.priceUnit reports stated unit: WHOLE_JOB / PER_HOUR / PER_TEAM_HOUR / PER_DAY, otherwise UNSPECIFIED; do not substitute a calculated total.',
    'need.schedule_kind: FIXED_WINDOW=known start date/time, ends_at only if stated and later; TODAY_FLEXIBLE/TOMORROW_FLEXIBLE=no fixed hour; WEEK_FLEXIBLE=this calendar week; REMOTE_ANYTIME=truly unrestricted remote time; FLEXIBLE=explicit bounded choice. A choice within dates is neither unrestricted nor booking every day. Store starts_at/ends_at; whole dates use first local midnight to exclusive midnight after last date, with each bound’s DST offset. Next week uses server nextCalendarWeek. Preserve pending bounds; ask missing boundary, never invent one from an earliest start/latest deadline.',
    'dialogue.schedulePattern: FLEXIBLE_RANGE=bounded choice, even while clarifying; SINGLE=one continuous time or today/tomorrow/this week; REPEATED=separate days/shifts; otherwise UNSPECIFIED. Do not claim unsupported repeated schedules saved.',
    'need.task_geography: only mode/start/end/waypoints/serviceArea; points only label/city/area. Modes STATIONARY, POINT_TO_POINT, MULTI_STOP, AREA_BASED (needs start/serviceArea), REMOTE (no work points). Each physical point needs city + street/neighborhood/landmark, not a house number. Never infer origin/country from destination, profile, language, phone or ambiguous "centar". Preserve known stops/terms through corrections.',
    'Public points use privacy-safe street/POI; exact address/access notes use private facts, never copied between stops. Stationary need.exact_address may be the stated street/landmark without number for lookup. Known city+landmark lets the app geocode and user check the map: no invented coordinates, prose geocoding or repeated interview. Provider pickup/shipping belongs to need.handoff, not a work pin.',
    `Fact types; required = complete-draft requirement, not a repeated question: ${registry}`,
    ...(includeRuntime ? [needRuntimeContext(activeFacts, timeContext), needFinishContext(activeFacts, finishPresentation)] : []),
  ].join('\n');
}

function needFinishContext(activeFacts: any[], finishPresentation: boolean) {
  const known = new Map(activeFacts.filter(f => f.status !== 'UNKNOWN').map(f => [f.fact_key, f.fact_value]));
  const description = known.get('need.description');
  const missingPresentation = ['need.title', 'need.category'].filter(key => !known.has(key));
  return (finishPresentation && missingPresentation.length && typeof description === 'string' && description.trim() ? [
      `Završetak istog zadatka. Iz postojećeg need.description u serverskim činjenicama dopunite samo ${missingPresentation.join(', ')}; evidence je doslovan isečak tog opisa, ne Sinteza/komanda završetka. Bez izmene drugih vrednosti/uslova. dialogue: taskRelation CONTINUE, priceUnit UNSPECIFIED, schedulePattern UNSPECIFIED. Nejasan zadatak razjasnite, bez rezervne kategorije.`,
    ] : []).join(' ');
}

function parseSafety(value: unknown): ParsedTurn['safety'] {
  return ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(String(value))
    ? String(value) as ParsedTurn['safety']
    : 'REVIEW';
}

function rejectManualOnlyFacts(parsed: any): void {
  for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
    const key = typeof fact?.key === 'string' ? fact.key : '';
    if (isNeedFactV2Key(key) && !interviewFactKeySet.has(key)) {
      // Reject the entire turn before any writer, including BLOCK and legacy
      // replies; silently dropping this fact would still persist the response.
      throw new Error('AI_MANUAL_ONLY_FACT_REJECTED');
    }
  }
}

function parseLegacyOutput(parsed: any): ParsedTurn {
  rejectManualOnlyFacts(parsed);
  const safety = parseSafety(parsed?.safety);
  const assistantMessage = typeof parsed?.assistantMessage === 'string'
    ? parsed.assistantMessage.trim().slice(0, 1200)
    : '';
  if (!assistantMessage) throw new Error('ASSISTANT_MESSAGE_MISSING');
  const proposals: Array<Record<string, unknown>> = [];
  if (safety !== 'BLOCK') {
    for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
      const key = typeof fact?.key === 'string' ? fact.key : '';
      const value = typeof fact?.value === 'string' ? fact.value.trim().slice(0, 2000) : '';
      const evidence = typeof fact?.evidence === 'string' ? fact.evidence.trim().slice(0, 500) : '';
      const confidence = Number(fact?.confidence);
      if (!legacyFactKeySet.has(key) || !value || !evidence || !Number.isFinite(confidence)) continue;
      proposals.push({ key, value, confidence: Math.max(0, Math.min(1, confidence)), evidence });
    }
  }
  return { safety, assistantMessage, proposals };
}

function valueMatchesType(valueType: string, value: unknown): boolean {
  if (valueType === 'TEXT' || valueType === 'ENUM' || valueType === 'TIMESTAMPTZ') return typeof value === 'string' && value.trim().length > 0;
  if (valueType === 'INTEGER') return typeof value === 'number' && Number.isInteger(value);
  if (valueType === 'BOOLEAN') return typeof value === 'boolean';
  if (valueType === 'TEXT_ARRAY') {
    return Array.isArray(value)
      && value.length <= 50
      && value.every((x) => typeof x === 'string' && x.trim().length > 0 && x.length <= 500);
  }
  if (valueType === 'OBJECT') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  return false;
}

function locationRefValid(value: unknown): boolean {
  if (value == null) return true;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const values = ['label', 'city', 'area'].map((key) => typeof record[key] === 'string' ? record[key].trim() : '');
  if (!values.some(Boolean)) return false;
  return (record.label ? String(record.label).length <= 240 : true)
    && (record.city ? String(record.city).length <= 160 : true)
    && (record.area ? String(record.area).length <= 160 : true);
}

function geographyValid(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const geo = value as Record<string, unknown>;
  if (Object.keys(geo).some((key) => !['mode', 'start', 'end', 'waypoints', 'serviceArea'].includes(key))) return false;
  const mode = typeof geo.mode === 'string' ? geo.mode : '';
  if (!GEOGRAPHY_MODES.has(mode)) return false;
  const start = geo.start ?? null;
  const end = geo.end ?? null;
  const serviceArea = geo.serviceArea ?? null;
  const waypoints = geo.waypoints ?? [];
  if (!Array.isArray(waypoints) || waypoints.length > 20) return false;
  if (!locationRefValid(start) || !locationRefValid(end) || !locationRefValid(serviceArea) || !waypoints.every(locationRefValid)) return false;

  if (mode === 'REMOTE') return start == null && end == null && serviceArea == null && waypoints.length === 0;
  if (mode === 'STATIONARY') return start != null && end == null && serviceArea == null && waypoints.length === 0;
  if (mode === 'POINT_TO_POINT') return start != null && end != null && serviceArea == null && waypoints.length === 0;
  if (mode === 'MULTI_STOP') return start != null && serviceArea == null && (end != null || waypoints.length > 0);
  if (mode === 'AREA_BASED') return end == null && waypoints.length === 0 && (start != null || serviceArea != null);
  return false;
}

function normalizeAiGeographyProposal(val: unknown): unknown {
  if (!val || typeof val !== 'object' || Array.isArray(val)) return val;
  const raw = val as Record<string, any>;
  const mode = (typeof raw.mode === 'string' && GEOGRAPHY_MODES.has(raw.mode.toUpperCase()))
    ? raw.mode.toUpperCase()
    : 'STATIONARY';

  if (mode === 'REMOTE') return { mode: 'REMOTE' };

  let start = raw.start;
  if (!start && (raw.city || raw.area || raw.label)) {
    start = {
      city: typeof raw.city === 'string' ? raw.city.trim() : '',
      area: typeof raw.area === 'string' ? raw.area.trim() : '',
      label: typeof raw.label === 'string' ? raw.label.trim() : '',
    };
  } else if (start && typeof start === 'object' && !Array.isArray(start)) {
    start = {
      city: typeof start.city === 'string' ? start.city.trim() : '',
      area: typeof start.area === 'string' ? start.area.trim() : '',
      label: typeof start.label === 'string' ? start.label.trim() : '',
    };
  }

  if (mode === 'STATIONARY') {
    if (start && (start.city || start.area || start.label)) {
      return { mode: 'STATIONARY', start };
    }
  }

  if (mode === 'POINT_TO_POINT') {
    let end = raw.end;
    if (end && typeof end === 'object' && !Array.isArray(end)) {
      end = {
        city: typeof end.city === 'string' ? end.city.trim() : '',
        area: typeof end.area === 'string' ? end.area.trim() : '',
        label: typeof end.label === 'string' ? end.label.trim() : '',
      };
    }
    if (start && end) {
      return { mode: 'POINT_TO_POINT', start, end };
    }
  }

  return val;
}

function valueMatchesContract(key: string, value: unknown): boolean {
  if (!isNeedFactV2Key(key)) return false;
  const definition = NEED_FACT_V2_DEFINITIONS[key];
  if (!valueMatchesType(definition.valueType, value)) return false;

  if (key === 'need.title') return (value as string).trim().length <= 140;
  if (key === 'need.description') return (value as string).trim().length <= 6000;
  if (key === 'need.category') return (value as string).trim().length <= 120;
  if (key === 'need.price_mode') return PRICE_MODES.has(String(value));
  // Without this the ENUM falls through to `return true`, the model's word travels all the way to
  // the server, and the person sees V2_PRICE_BASIS_INVALID instead of the AI correcting itself.
  if (key === 'need.price_basis') return PRICE_BASES.has(String(value));
  if (key === 'need.price_rsd') return Number(value) >= 1 && Number(value) <= 100000000;
  if (key === 'need.schedule_kind') return SCHEDULE_KINDS.has(String(value));
  if (key === 'need.people_needed') return Number(value) >= 1 && Number(value) <= 50;
  if (key === 'need.minimum_experience_years') return Number(value) >= 0 && Number(value) <= 60;
  if (key === 'need.exact_address') return (value as string).trim().length <= 1000;
  if (key === 'need.access_notes') return (value as string).trim().length <= 2000;
  if (key === 'need.task_geography') return geographyValid(value);
  if (key === 'need.handoff') return decodeServiceHandoff(value) !== null;
  if (key === 'need.response_deadline') return decodeTaskApplicationDeadlineFact(value) !== null;
  return true;
}

function parseV2Output(parsed: any, maxProposals = 12): ParsedTurn {
  rejectManualOnlyFacts(parsed);
  if (!exact(parsed, ['safety', 'assistantMessage', 'facts', 'dialogue']) || !['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(parsed.safety) ||
    !Array.isArray(parsed.facts) || parsed.facts.length > maxProposals) {
    // Distinguish contract failures without logging user text or provider data.
    console.info('NEED_AI_OUTPUT_GATE', 'ROOT_SHAPE',
      'rootExact', exact(parsed, ['safety', 'assistantMessage', 'facts', 'dialogue']),
      'safetyValid', ['ALLOW', 'CLARIFY', 'REVIEW', 'BLOCK'].includes(parsed.safety),
      'factCount', Array.isArray(parsed.facts) ? parsed.facts.length : -1);
    throw new Error('AI_V2_OUTPUT_INVALID');
  }
  if (!exact(parsed.dialogue, Object.keys(DIALOGUE_VALUES))) {
    console.info('NEED_AI_OUTPUT_GATE', 'DIALOGUE_SHAPE');
    throw new Error('AI_V2_OUTPUT_INVALID');
  }
  const dialogue = { ...parsed.dialogue, questionKey: parsed.dialogue.questionKey === 'NONE' ? '' : parsed.dialogue.questionKey };
  if (Object.entries(DIALOGUE_VALUES).some(([key, values]) => !values.includes(dialogue[key]))) {
    console.info('NEED_AI_OUTPUT_GATE', 'DIALOGUE_ENUM');
    throw new Error('AI_V2_OUTPUT_INVALID');
  }
  // Metadata can be inconsistent even when typed facts are valid. Correct the
  // non-authoritative hint; never alter or fabricate a provider fact.
  if (dialogue.next === 'ASK' && !dialogue.questionKey) {
    console.info('NEED_AI_OUTPUT_GATE', 'ASK_KEY_REPAIRED');
    dialogue.next = 'ANSWER';
  } else if (dialogue.next !== 'ASK' && dialogue.questionKey) {
    console.info('NEED_AI_OUTPUT_GATE', 'NON_ASK_KEY_REPAIRED');
    dialogue.questionKey = '';
  }
  const safety = parseSafety(parsed?.safety);
  const assistantMessage = typeof parsed?.assistantMessage === 'string'
    ? parsed.assistantMessage.trim()
    : '';
  if (!assistantMessage || assistantMessage.length > 1200 || safety === 'BLOCK' && parsed.facts.length) throw new Error('ASSISTANT_MESSAGE_INVALID');
  const proposals: Array<Record<string, unknown>> = [];
  if (safety !== 'BLOCK') {
    const seen = new Set<string>();
    for (const fact of Array.isArray(parsed?.facts) ? parsed.facts : []) {
      const key = typeof fact?.key === 'string' ? fact.key : '';
      if (!exact(fact, ['key', 'valueJson', 'displayValue', 'evidence', 'confidence']) ||
        !interviewFactKeySet.has(key) || seen.has(key) || typeof fact.valueJson !== 'string') throw new Error('AI_V2_FACT_INVALID');
      let value: unknown;
      try { value = JSON.parse(fact.valueJson); } catch { continue; }
      if (key === 'need.task_geography') {
        value = normalizeAiGeographyProposal(value);
      }
      if (!valueMatchesContract(key, value)) {
        console.warn('NEED_AI_OUTPUT_GATE_FACT_SKIPPED', key);
        continue;
      }
      const displayValue = typeof fact?.displayValue === 'string' ? fact.displayValue.trim() : '';
      const evidence = typeof fact?.evidence === 'string' ? fact.evidence.trim() : '';
      const confidence = fact?.confidence;
      if (!displayValue || displayValue.length > 1000 || !evidence || evidence.length > 500 ||
        typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
        console.info('NEED_AI_OUTPUT_GATE', 'FACT_ATTRIBUTES');
        throw new Error('AI_V2_FACT_INVALID');
      }
      seen.add(key);
      proposals.push({
        key,
        value,
        // This typed key is always whole RSD. Presentation text cannot change
        // its amount or currency; the intent guard still requires RSD consent.
        displayValue: key === 'need.price_rsd' ? `${value} RSD`
          : key === 'need.price_basis' && value === 'HOURLY' ? 'Po osobi po satu' : displayValue,
        confidence: Math.max(0, Math.min(1, confidence)),
        evidence,
      });
    }
  }
  return { safety, assistantMessage, proposals, dialogue };
}

async function callGemini(
  key: string,
  model: string,
  schemaVersion: FactSchemaVersion,
  history: any[],
  activeFacts: any[],
  text: string,
  timeContext: ServerTimeContext,
  signal?: AbortSignal,
  onText?: (delta: string) => void,
  onUsage?: (usage: GeminiUsage) => void,
  locationContext?: LocationContext,
  imageBase64?: string,
  imageMime?: string,
  clarificationHint?: { ambiguityPrompt?: string; service?: string } | null,
  maxProposals = 12,
  singlePass?: { catalog: any; onDecisions: (decisions: any[]) => void },
) {
  const contents = history.slice(-30).map((row) => ({
    role: row.role === 'ASSISTANT' ? 'model' : 'user',
    parts: [{ text: String(row.body ?? '').slice(0, 4000) }],
  }));
  const userParts: any[] = [{ text: text || 'Ovo je fotografija zadatka. Molim Vas analizirajte sliku i predložite opis ili detalje zadatka.' }];
  if (imageBase64 && imageMime) {
    userParts.push({
      inlineData: {
        mimeType: imageMime,
        data: imageBase64,
      },
    });
  }
  contents.push({ role: 'user', parts: userParts });
  const parseOutput = async (value: any) => {
    const intentDecision = takeConversationIntent(value, text);
    value = guardInterviewIntentOutput(intentDecision.output, intentDecision, 'NEED');
    if (singlePass) {
      const extracted = takeSinglePassTaxonomy(value);
      value = extracted.output;
      singlePass.onDecisions(extracted.decisions);
    }
    const parseFacts=(output:any)=>parseV2Output(output,maxProposals);
    const parsedTurn=locationContext ? parseLocationOutput(value,locationContext,parseFacts) : parseFacts(value);
    const intentAllowsChanges = intentAllowsDomain(intentDecision, 'NEED') && ['ALLOW', 'CLARIFY'].includes(parsedTurn.safety);
    // An opposite/ambiguous intention cannot become a price retraction, map
    // confirmation, category proposal or task fact through a downstream guard.
    if (!intentAllowsChanges) return { ...parsedTurn, intentDecision, intentAllowsChanges };
    const previousMessage = history[history.length - 1];
    const pendingDeadlineQuestion = applicationDeadlineEnabled() && previousMessage?.role === 'ASSISTANT'
      && typeof previousMessage.body === 'string' && previousMessage.body.includes('?')
      && /prijav/iu.test(previousMessage.body)
      && /(?:do kada|do kog|kad|datum|sat|rok)/iu.test(previousMessage.body);
    // Classification is validated later against these guarded facts and the
    // same complete catalog. No tool loop or second model can alter the answer.
    return { ...guardConversationTurn(parsedTurn,text,history,activeFacts,timeContext,locationContext,pendingDeadlineQuestion),
      intentDecision, intentAllowsChanges };
  };
  // Stable rules precede private per-turn data. This permits provider prefix
  // caching without sharing application context or trusting stale catalog data.
  const instruction = schemaVersion === NEED_FACT_SCHEMA_V2 ? v2Instruction(activeFacts, timeContext, false, false) : legacyInstruction(activeFacts, timeContext);
  const stableParts = [{ text: instruction }, { text: serviceExecutionInstruction('NEED_SERVICE') }];
  const runtimeParts = [
    ...(schemaVersion === NEED_FACT_SCHEMA_V2 ? [{text:needRuntimeContext(activeFacts,timeContext)},
      {text:needFinishContext(activeFacts,taskFinishOnly(text) && !locationContext)}].filter(part=>part.text) : []),
    ...(clarificationHint?.ambiguityPrompt ? [{
      text: `Ranije je nedostajalo razjašnjenje: „${clarificationHint.ambiguityPrompt}“. Najpre proveri da li ga je korisnik već dao u ovoj poruci. Pitaj samo ako ta poslovna činjenica još nedostaje.`,
    }] : []),
    ...(locationContext ? [{ text: locationInstruction(locationContext) }] : []),
  ];
  // Stable system instruction is 100% invariant across turns to maximize Google TPU prefix caching.
  const stableSystemParts = [
    ...stableParts,
    ...(singlePass ? [{text:singlePassTaxonomyInstruction(singlePass.catalog,'NEED_SERVICE')}] : []),
  ];
  const factSchema = schemaVersion === NEED_FACT_SCHEMA_V2
    ? (locationContext ? locationProviderSchema(v2ProviderSchema(maxProposals)) : v2ProviderSchema(maxProposals))
    : legacyProviderSchema();
  const responseSchema = singlePass ? withSinglePassTaxonomySchema(factSchema) : factSchema;

  const augmentedContents = [
    ...(runtimeParts.length ? [{
      role: 'user',
      parts: [{ text: `[KONTEKST TRENUTNOG ZADATKA I VREMENA]:\n${runtimeParts.map(p => p.text).join('\n')}` }],
    }, {
      role: 'model',
      parts: [{ text: 'Razumeo sam server kontekst zadatka. Nastavljam razgovor po zanatskim smernicama.' }],
    }] : []),
    ...contents,
  ];

  let payloadBody: string;
  let cachedContentResource: string | null = null;
  if (singlePass?.catalog?.catalogVersion) {
    cachedContentResource = await getOrCreateGeminiContextCache({
      geminiApiKey: key,
      catalogVersion: singlePass.catalog.catalogVersion,
      catalog: singlePass.catalog,
      model,
      signal,
      purpose: 'NEED_SERVICE',
    });
  }

  if (cachedContentResource) {
    payloadBody = JSON.stringify({
      cachedContent: cachedContentResource,
      contents: augmentedContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: AI_TEST_LIMITS.llmMaxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });
  } else {
    payloadBody = JSON.stringify({
      systemInstruction: { parts: stableSystemParts },
      contents: augmentedContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: AI_TEST_LIMITS.llmMaxOutputTokens,
        responseMimeType: 'application/json',
        responseSchema,
        thinkingConfig: {
          thinkingBudget: 0,
        },
      },
    });
  }
  if (new TextEncoder().encode(payloadBody).byteLength > AI_TEST_LIMITS.llmRequestBytes) throw new Error('AI_CONTEXT_TOO_LARGE');
  if (onText) {
    const raw = await measureAiPhase('PROVIDER', () => streamGeminiTask({
      url: `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
      key, body: payloadBody, signal, onText: onText ?? (() => {}), onUsage, timeoutMs: 30000,
    }));
    return parseOutput(JSON.parse(raw));
  }
  const providerResponse = await boundedJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    { method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: geminiRequestBody(payloadBody) },
    131072, 30000, signal, false,
  );
  if (!providerResponse.ok) {
    console.error('GEMINI_GENERATE_FAILED', providerResponse.status);
    if (providerResponse.status === 402) throw new GeminiCreditsUnavailableError();
    throw new Error('PROVIDER_HTTP_FAILED');
  }
  const payload = providerResponse.data;
  // The non-streaming path reports the same counts on the single response body.
  if (onUsage) { const usage = geminiUsage(payload?.usageMetadata); if (usage) { try { onUsage(usage); } catch { /* accounting never breaks delivery */ } } }
  if (payload?.promptFeedback?.blockReason) throw new GeminiSafetyBlockedError(payload.promptFeedback.blockReason);
  for (const candidate of payload?.candidates ?? []) {
    if (['SAFETY', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII', 'RECITATION'].includes(candidate?.finishReason))
      throw new GeminiSafetyBlockedError(candidate.finishReason);
    if (candidate?.safetyRatings?.some((rating: any) => rating?.blocked === true)) throw new GeminiSafetyBlockedError('SAFETY');
  }
  const raw = geminiText(payload);
  if (!raw) throw new Error('PROVIDER_OUTPUT_MISSING');
  const parsed = JSON.parse(raw);
  return schemaVersion === NEED_FACT_SCHEMA_V2 ? parseOutput(parsed) : parseLegacyOutput(parsed);
}

function taskFinishOnly(input: string): boolean {
  const normalized = input.normalize('NFKC').toLowerCase().trim().replace(/[.!?,…]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Thanks is natural conversation framing, not a second command or a correction.
  // Remove only a complete, bounded greeting/farewell; exact finish intents remain
  // anchored so "to je to, ali promenite..." reaches the normal interview.
  const utterance = normalized.replace(/^(?:hvala(?: vam)?|хвала(?: вам)?)\s+/u, '')
    .replace(/\s+(?:hvala(?: vam)?|хвала(?: вам)?)$/u, '');
  return /^(?:to je to|to je sve|gotovo|gotovo to je sve|objavi|objavi zadatak|sačuvaj|sacuvaj|то је то|то је све|готово|објави|објави задатак|сачувај)$/.test(utterance);
}

// Explicit task publication stays outside map confirmation. This is a publication
// guard, not a vocabulary for recognizing natural affirmative replies.
function explicitPublicationOnly(input: string): boolean {
  return /^(?:objavi(?: zadatak)?|објави(?: задатак)?|sačuvaj zadatak|sacuvaj zadatak|сачувај задатак)[.!?,…\s]*$/i.test(input.trim());
}

function sameFactValue(left: unknown, right: unknown): boolean {
  // Object key order is immaterial; array order and exact typed values are not.
  const ordered = (value: any): any => Array.isArray(value) ? value.map(ordered)
    : object(value) ? Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered(value[key])])) : value;
  return JSON.stringify(ordered(left)) === JSON.stringify(ordered(right));
}

function cleanLocationPoint(p: any) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) return p;
  const cleaned: Record<string, string> = {};
  if (typeof p.city === 'string' && p.city.trim()) cleaned.city = p.city.trim();
  if (typeof p.area === 'string' && p.area.trim()) cleaned.area = p.area.trim();
  if (typeof p.label === 'string' && p.label.trim()) cleaned.label = p.label.trim();
  return Object.keys(cleaned).length ? cleaned : null;
}

function cleanGeography(geo: any) {
  if (!geo || typeof geo !== 'object' || Array.isArray(geo)) return geo;
  const res: Record<string, any> = { mode: geo.mode };
  if (geo.start) res.start = cleanLocationPoint(geo.start);
  if (geo.end) res.end = cleanLocationPoint(geo.end);
  if (geo.serviceArea) res.serviceArea = cleanLocationPoint(geo.serviceArea);
  if (Array.isArray(geo.waypoints)) res.waypoints = geo.waypoints.map(cleanLocationPoint).filter(Boolean);
  return res;
}

function needTurnPersistenceProposals(turn: ParsedTurn): Array<Record<string, unknown>> {
  const proposals = turn.proposals.map(p => {
    if (p.key === 'need.task_geography' && p.value && typeof p.value === 'object') {
      return { ...p, value: cleanGeography(p.value) };
    }
    return p;
  });
  if (!turn.priceRetraction) return proposals;
  if (!['CLARIFY', 'REVIEW'].includes(turn.safety) || proposals.some(p =>
    ['need.price_mode', 'need.price_rsd', 'need.price_basis'].includes(String(p.key)))) {
    throw new Error('AI_PRICE_RETRACTION_CONFLICT');
  }
  return [{ action: 'INVALIDATE_PRICE', reason: turn.priceRetraction }, ...proposals];
}

function guardConversationTurn(turn: ParsedTurn, input: string, history: any[], activeFacts: any[], time: ServerTimeContext, contextualLocation?: LocationContext, pendingDeadlineQuestion = false): ParsedTurn {
  if (turn.safety === 'BLOCK') return turn;
  // The monetary contract stores whole RSD only. A model that returns the
  // numeral from "100 EUR" as need.price_rsd would silently change its meaning.
  // A bare amount is ambiguous, and a short currency-only correction can refer
  // to the immediately preceding bare-number user turn. Neither is RSD consent.
  const hasAmountIn = (text: string, unit: string) => new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(?:\\d[\\d\\s.,]*\\s*(?:(?:u|na|у|на)\\s+)?${unit}|${unit}\\s*\\d[\\d\\s.,]*)(?=$|[^\\p{L}])`, 'iu').test(text);
  const euroUnit = '(?:€|eur|evr(?:o|a|i|ima)?|euro|eura|евр(?:о|а|и|има)?|еур(?:о|а)?)';
  const dinarUnit = '(?:rsd|рсд|din(?:ar(?:a|i|e|ima)?)?|дин(?:ар(?:а|и|е|има)?)?)';
  const priceWords = /bud(?:ž|z)et|cen(?:a|u|e|om)|iznos|naknad|naplat|za ceo posao|po osobi|буџет|цен[ауеом]|износ|накнад|наплат/iu;
  const expenseWords = /materijal|материјал|prevoz|превоз|goriv\p{L}*|горив\p{L}*|oprem\p{L}*|опрем\p{L}*/iu;
  // Work with the clause about the task price. A currency next to material
  // costs cannot authorize the same numeral in a later labor-price clause.
  const priceClauses = input.split(/[;,!?\n]|\.(?!\d)/u).map(clause => {
    if (/^\s*\d+\s*(?:radnik\p{L}*|ljud\p{L}*|osob\p{L}*|радник\p{L}*|људ\p{L}*|особ\p{L}*)/iu.test(clause)) return '';
    // "Prevoz za 500 RSD" is a task price; "prevoz me košta 500 RSD"
    // describes an expense. Do not discard the former as incidental cost.
    if (/(?:^|\s)(?:prevoz|превоз)\s+za\s+\d|(?:^|\s)(?:prevoz|превоз)\s+за\s+\d/iu.test(clause)
      && !/košta|kosta|кошта|trošak|trosak|трошак/iu.test(clause)) return clause;
    const expenseAt = clause.search(expenseWords);
    if (expenseAt >= 0) {
      const laterPrice = clause.slice(expenseAt + 1).search(priceWords);
      return laterPrice >= 0 ? clause.slice(expenseAt + 1 + laterPrice) : '';
    }
    return priceWords.test(clause) || hasAmountIn(clause, euroUnit) || hasAmountIn(clause, dinarUnit)
      || /^\s*\d/u.test(clause) ? clause : '';
  }).filter(Boolean);
  const previousUser = [...history].reverse().find(row => row?.role === 'USER');
  const previousAssistant = [...history].reverse().find(row => row?.role === 'ASSISTANT');
  const previousBareAmount = typeof previousUser?.body === 'string'
    && /^\s*(?:(?:budžet|budzet|cena|iznos|буџет|цена|износ)(?: je| је)?|ukupno|укупно)?\s*\d[\d\s.,]*(?:\s*(?:ukupno|za ceo posao|po osobi|укупно|за цео посао|по особи))?[.!?\s]*$/iu.test(previousUser.body);
  const currentBareAmount = /^\s*\d[\d\s.,]*[.!?\s]*$/u.test(input);
  const lastQuestion = typeof previousAssistant?.body === 'string'
    ? previousAssistant.body.match(/[^.!?]*\?/gu)?.at(-1) ?? '' : '';
  const previousAskedPrice = /bud(?:ž|z)et|cen(?:a|u|e)|iznos|буџет|цен[ауе]|износ/iu.test(lastQuestion)
    && !/koliko\s+(?:ljudi|osoba)|колико\s+(?:људи|особа)|kog datuma|ког датума/iu.test(lastQuestion);
  const activeRsdPrice = activeFacts.some(fact => fact.fact_key === 'need.price_rsd' && fact.status !== 'UNKNOWN');
  const euroOnlyReply = new RegExp(
    `^\\s*(?:(?:ipak|zapravo|mislio sam|mislim|to je|iznos je|cena je|u|na|ипак|заправо|мислио сам|мислим|то је|износ је|цена је|у|на)\\s+)*(?:${euroUnit})[\\s.!?]*$`, 'iu').test(input);
  const priceProposal = turn.proposals.find(proposal => proposal.key === 'need.price_rsd');
  const euroFollowup = euroOnlyReply && (previousBareAmount || activeRsdPrice || !!priceProposal);
  const priceEvidence = typeof priceProposal?.evidence === 'string' ? priceProposal.evidence : '';
  // Currency must be attached to the proposed amount, not merely appear
  // elsewhere in the message (e.g. material 100 RSD; labour budget 500).
  const proposedAmount = Number(priceProposal?.value);
  const proposedAmountToken = Number.isSafeInteger(proposedAmount) && proposedAmount > 0
    ? String(proposedAmount).split('').join('[\\s.,]*') : null;
  // The latest task-price clause wins. A later EUR correction must invalidate
  // an earlier RSD amount even when the same numeral appears in both clauses.
  const priceClause = priceClauses.at(-1) ?? '';
  const amountHasUnit = (text: string, unit: string) => !!proposedAmountToken && new RegExp(
    `(?:^|[^\\p{L}\\p{N}])(?:${unit}\\s*${proposedAmountToken}|${proposedAmountToken}\\s*(?:(?:u|na|у|на)\\s+)?${unit})(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text);
  const proposedRsdExplicit = !!priceProposal && amountHasUnit(priceClause, dinarUnit);
  const proposedEuroExplicit = !!priceProposal && amountHasUnit(priceClause, euroUnit);
  const euroPriceProposed = !!priceProposal && (proposedEuroExplicit || hasAmountIn(priceClause, euroUnit)
    || hasAmountIn(priceEvidence, euroUnit) && !proposedRsdExplicit || euroFollowup);
  const numericPriceProposalWithoutCurrency = !!priceProposal && !proposedEuroExplicit && !proposedRsdExplicit
    && /(?:^|[^\p{L}\p{N}])\d[\d\s.,]*(?=$|[^\p{L}])/u.test(input);
  const explicitPriceWords = priceWords.test(priceClause) || priceWords.test(input);
  const headcountOnlyAmount = !!proposedAmountToken && new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${proposedAmountToken}\\s*(?:radnik\\p{L}*|ljud\\p{L}*|osob\\p{L}*|sat\\p{L}*|dan\\p{L}*|радник\\p{L}*|људ\\p{L}*|особ\\p{L}*|сат\\p{L}*|дан\\p{L}*)(?=$|[^\\p{L}\\p{N}])`, 'iu').test(input)
    && !explicitPriceWords;
  const barePriceProposed = numericPriceProposalWithoutCurrency
    && (!headcountOnlyAmount || explicitPriceWords || currentBareAmount && previousAskedPrice);
  const spuriousNumericPriceProposal = numericPriceProposalWithoutCurrency && !barePriceProposed;
  // A bad amount proposal must not erase a separate, explicit choice to
  // collect offers. Require the user's words and the mode fact's evidence.
  const offersSaid = (value: string) => /ponud|понуд/iu.test(value);
  const offerChoice = /(?:želim|zelim|hoću|hocu|tražim|trazim|izaberi|odaberi|prihvatam|желим|хоћу|тражим|изабери|одабери|прихватам)[^,.!?;]{0,24}(?:ponud|понуд)/giu;
  const explicitOffers = (/^\s*(?:ponud[aeu]?|понуд[аеу]?)\s*(?=[,;.!?]|$)/iu.test(input)
    || [...input.matchAll(offerChoice)].some(match =>
    !/(?:^|[^\p{L}])(?:ne|не|ni|ни)\s*$/iu.test(input.slice(Math.max(0, (match.index ?? 0) - 12), match.index ?? 0)))
    && turn.proposals.some(proposal => proposal.key === 'need.price_mode'
    && proposal.value === 'OFFERS' && offersSaid(String(proposal.evidence ?? ''))));
  const barePriceWithoutFact = !priceProposal
    && (currentBareAmount && previousAskedPrice
      || priceClauses.some(clause => priceWords.test(clause) && /\d/u.test(clause)
        && !hasAmountIn(clause, dinarUnit) && !hasAmountIn(clause, euroUnit)));
  if (barePriceWithoutFact && !explicitOffers) {
    const rawNumber = (priceClause || input).match(/\d[\d.,]*/u)?.[0]?.replace(/[^\d]/gu, '');
    const parsedBare = rawNumber ? Number(rawNumber) : NaN;
    if (Number.isSafeInteger(parsedBare) && parsedBare >= 100 && parsedBare <= 10000000) {
      turn.proposals.push({
        key: 'need.price_rsd',
        value: parsedBare,
        displayValue: `${parsedBare} RSD`,
        evidence: (priceClause || input).trim().slice(0, 120),
      });
    }
  }
  const effectivePriceProposal = turn.proposals.find(proposal => proposal.key === 'need.price_rsd');
  // Only a user-stated, task-price EUR amount may invalidate earlier RSD
  // consent. Never let Gemini's display text or fabricated evidence invent
  // currency. Independent task details are retained.
  const euroFromUser = euroFollowup || priceClauses.some(clause => hasAmountIn(clause, euroUnit));
  const isEuroStated = euroFromUser || euroPriceProposed;
  if (effectivePriceProposal && !isEuroStated) {
    const amt = Number(effectivePriceProposal.value);
    if (!effectivePriceProposal.displayValue || effectivePriceProposal.displayValue === `${amt}`) {
      effectivePriceProposal.displayValue = `${amt} RSD`;
    }
    if (!explicitOffers && !turn.proposals.some(p => p.key === 'need.price_mode')) {
      turn.proposals.push({
        key: 'need.price_mode',
        value: 'MY_PRICE',
        evidence: String(effectivePriceProposal.evidence || input.trim().slice(0, 120) || 'Budžet u RSD'),
      });
    }
  }
  const unsupportedPrice = explicitOffers && !!effectivePriceProposal || isEuroStated && !explicitOffers;
  const priceRetraction = euroFromUser && activeRsdPrice && !explicitOffers
    ? 'UNSUPPORTED_CURRENCY' as const : undefined;
  const priceMessage = isEuroStated
    ? 'Iznos u evrima ne mogu da sačuvam kao dinare. Koji iznos u RSD želite da unesete?'
    : '';
  const offerMessage = explicitOffers && !!effectivePriceProposal
    ? 'Razumem, tražite ponude.'
    : '';
  const suspectAmountToken = proposedAmountToken ?? priceClauses.join(' ').match(/\d[\d.,]*/u)?.[0]
    ?.replace(/[^\d]/gu, '').split('').join('[\\s.,]*');
  const containsSuspectAmount = (text: string) => !!suspectAmountToken && new RegExp(
    `(?:^|[^\\p{L}\\p{N}])${suspectAmountToken}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text);
  const withoutUnsupportedPrice = (proposals: ParsedTurn['proposals']) => proposals.filter(proposal => {
    if (proposal.key === 'need.price_mode') return explicitOffers && proposal.value === 'OFFERS';
    if (['need.price_rsd', 'need.price_basis'].includes(proposal.key)) return false;
    // A clean title and job description are independent answers and need not
    // be lost just because the same turn also contained an unsupported price.
    if (['need.title', 'need.description'].includes(proposal.key) && typeof proposal.value === 'string')
      return !hasAmountIn(proposal.value, euroUnit) && !hasAmountIn(proposal.value, dinarUnit)
        && !(unsupportedPrice && containsSuspectAmount(proposal.value));
    return true;
  });
  // D06: HOURLY always stores the rate for one person for one hour. Neither
  // provider metadata nor an explicit team amount can silently change that
  // basis. Keep the amount itself; headcount and time never multiply this fact.
  const effectivePriceFact = (key: string) => turn.proposals.find(p => p.key === key)?.value
    ?? activeFacts.find(f => f.fact_key === key && f.status !== 'UNKNOWN')?.fact_value;
  const hourlyWords = /(?:na\s+sat|po\s+satu|satnic\p{L}*|на\s+сат|по\s+сату|сатниц\p{L}*)/iu;
  const hourly = ['PER_HOUR', 'PER_TEAM_HOUR'].includes(turn.dialogue?.priceUnit ?? '')
    || turn.proposals.some(p => p.key === 'need.price_basis' && p.value === 'HOURLY')
    || hourlyWords.test(priceClause);
  if (hourly && effectivePriceProposal && !isEuroStated && !explicitOffers && !turn.proposals.some(p => p.key === 'need.price_basis')) {
    turn.proposals.push({
      key: 'need.price_basis',
      value: 'HOURLY',
      evidence: String(effectivePriceProposal.evidence || input.trim().slice(0, 120) || 'Satnica'),
    });
  }
  // Include a trailing scope-only clause ("1200 RSD na sat; za celu ekipu"),
  // but not an earlier price that the latest price clause explicitly replaces.
  const priceScope = priceClause ? input.slice(input.lastIndexOf(priceClause)) : input;
  const teamScope = /(?:za\s+(?:(?:celu|cijelu|celokupnu|svu)\s+)?ekipu|za\s+(?:sve|obe|obje|dve|dvije|tri|četiri|cetiri|\d+)\s+(?:osobe|radnik\p{L}*|ljudi)|sat\s+cele\s+ekipe|за\s+(?:(?:целу|цијелу|целокупну|сву)\s+)?екипу|за\s+(?:све|обе|две|двије|три|четири|\d+)\s+(?:особе|радник\p{L}*|људи)|сат\s+целе\s+екипе)/giu;
  const statedTeamScope = [...priceScope.matchAll(teamScope)]
    .some(match => !/(?:^|[^\p{L}])(?:ne|nije|не|није)\s*$/iu.test(priceScope.slice(0, match.index)));
  const teamHourly = turn.dialogue?.priceUnit === 'PER_TEAM_HOUR' || hourly && statedTeamScope;
  const activeHourly = activeFacts.some(f => f.fact_key === 'need.price_basis'
    && f.status !== 'UNKNOWN' && f.fact_value === 'HOURLY');
  const teamOnlyReply = new RegExp('^\\s*(?:(?:mislio sam|mislila sam|mislim|to je|cena je|ipak|zapravo|мислио сам|мислила сам|мислим|то је|цена је|ипак|заправо)\\s+)*(?:'
    + teamScope.source + ')[.!\\s]*$', 'iu').test(input);
  // A model hint can ask for clarification, never revoke existing consent by
  // itself. Require an actual price correction, including a short team-scope
  // reply to the already known hourly rate, not e.g. gloves for the whole team.
  const statedHourlyCorrection = statedTeamScope && !priceScope.includes('?')
    && (hourlyWords.test(priceScope) || activeHourly && (priceWords.test(priceScope) || teamOnlyReply));
  const hourlyRetraction = teamHourly && statedHourlyCorrection && activeRsdPrice && !explicitOffers && !unsupportedPrice
    && turn.dialogue?.taskRelation === 'CONTINUE' ? 'UNSUPPORTED_PRICE_BASIS' as const : undefined;
  const hourlyMismatch = hourly && (teamHourly || effectivePriceFact('need.price_mode') !== 'MY_PRICE'
    || effectivePriceFact('need.price_basis') !== 'HOURLY'
    || !Number.isSafeInteger(effectivePriceFact('need.price_rsd'))
    || Number(effectivePriceFact('need.price_rsd')) < 1
    || ['WHOLE_JOB', 'PER_DAY'].includes(turn.dialogue?.priceUnit ?? ''));
  const unitPrice = !explicitOffers && (turn.dialogue?.priceUnit === 'PER_DAY'
    || hourlyMismatch && !spuriousNumericPriceProposal);
  const repeated = turn.dialogue?.schedulePattern === 'REPEATED';
  const withheldUnitFacts = new Set(['need.price_mode', 'need.price_rsd', 'need.price_basis', 'need.title', 'need.description',
    ...(repeated ? ['need.schedule_kind', 'need.starts_at', 'need.ends_at'] : [])]);
  const unitMessage = repeated
    ? 'Odvojene termine još ne možemo da sačuvamo kao jedan zadatak. Koji pojedinačni termin želite da dogovorite?'
    : hourlyMismatch
      ? `${hourlyRetraction ? 'Prethodna cena više nije potvrđena. ' : ''}Satnica se čuva po osobi po satu. Koji iznos u RSD po osobi po satu želite da postavite?`
      : 'Dnevnica još nije podržana. Koji iznos u RSD želite za ceo zadatak, ukupno ili po osobi?';
  if (turn.safety === 'REVIEW') {
    // Keep a policy-review decision intact while preventing a mismatched price
    // from reaching its writer. This branch intentionally does not downgrade it.
    let filtered = unsupportedPrice || spuriousNumericPriceProposal ? { ...turn, priceRetraction, proposals: withoutUnsupportedPrice(turn.proposals),
      assistantMessage: spuriousNumericPriceProposal
        ? 'Ovaj zahtev treba dodatno proveriti. Predlog cene nije potkrepljen Vašom porukom.'
        : explicitOffers ? `Ovaj zahtev treba dodatno proveriti. ${offerMessage}`
          : `Ovaj zahtev treba dodatno proveriti. ${priceMessage}` } : turn;
    if (unitPrice || repeated) filtered = { ...filtered,
      priceRetraction: filtered.priceRetraction ?? hourlyRetraction,
      proposals: filtered.proposals.filter(p => !withheldUnitFacts.has(p.key)),
      assistantMessage: unsupportedPrice ? filtered.assistantMessage : `Ovaj zahtev treba dodatno proveriti. ${unitMessage}` };
    return guardTimestampProposals(filtered, input, activeFacts, time, pendingDeadlineQuestion);
  }
  if (taskFinishOnly(input) && (!contextualLocation || turn.locationAction !== 'CONFIRM_DISPLAYED')
    || contextualLocation && explicitPublicationOnly(input)) {
    // Ending the interview supplies no new terms. Only missing presentation of an existing
    // description may be completed, with literal evidence from that description. Map replies
    // and task/price/schedule ambiguity never take this exception. Semantic accuracy still
    // belongs to the provider; the final review remains an explicit human decision.
    const known = new Map(activeFacts.filter(f => f.status !== 'UNKNOWN').map(f => [f.fact_key, f.fact_value]));
    const description = known.get('need.description');
    const plainFinish = !contextualLocation && turn.dialogue?.taskRelation === 'CONTINUE'
      && turn.dialogue.priceUnit === 'UNSPECIFIED' && turn.dialogue.schedulePattern === 'UNSPECIFIED';
    const proposals = plainFinish && typeof description === 'string' && description.trim()
      ? turn.proposals.filter(proposal => ['need.title', 'need.category'].includes(proposal.key) && !known.has(proposal.key)
        && typeof proposal.evidence === 'string' && proposal.evidence.trim().length >= 3
        && description.includes(proposal.evidence.trim())) : [];
    // Finish cannot bypass the completeness/map checks below.
    turn = { ...turn, proposals, dialogue: turn.dialogue ? { ...turn.dialogue, next: 'REVIEW', questionKey: '' } : undefined,
      assistantMessage: turn.assistantMessage?.trim() || 'Podaci su spremni za pregled.' };
  }
  const clarification = (assistantMessage: string): ParsedTurn => ({ safety: 'CLARIFY', proposals: [], assistantMessage });
  // A contradictory date does not erase independent budget/people/place answers.
  // Synthesized title/description may repeat that invalid date, so withhold them too.
  const clarifySchedule = (assistantMessage: string): ParsedTurn => ({
    ...turn, safety: 'CLARIFY',
    proposals: turn.proposals.filter(p => !['need.schedule_kind', 'need.starts_at', 'need.ends_at',
      'need.title', 'need.description'].includes(p.key)),
    dialogue: turn.dialogue ? { ...turn.dialogue, next: 'CLARIFY', questionKey: '' } : undefined,
    assistantMessage,
  });
  let dialogue = turn.dialogue;
  if (dialogue?.taskRelation === 'DIFFERENT_TASK') return clarification('Za drugi zadatak izaberite „Novi zadatak“ u opcijama razgovora. Ovaj razgovor čuva prethodni zadatak.');
  if (dialogue?.taskRelation === 'UNCLEAR') return clarification('Da li menjate ovaj zadatak ili želite da napravite novi?');
  if (unsupportedPrice) {
    // Keep independently understood job/people/place/time; do not persist a
    // public copy that carries the unsupported amount. A genuinely chosen
    // OFFERS mode is independent of that amount and needs no RSD question.
    turn = explicitOffers
      ? { ...turn, proposals: withoutUnsupportedPrice(turn.proposals),
          assistantMessage: offerMessage }
      : { ...turn, safety: 'CLARIFY', priceRetraction, proposals: withoutUnsupportedPrice(turn.proposals),
          dialogue: dialogue ? { ...dialogue, next: 'CLARIFY', questionKey: '' } : undefined,
          assistantMessage: priceMessage };
    dialogue = turn.dialogue;
  } else if (spuriousNumericPriceProposal) {
    // A headcount such as "2 radnika" must not become a price or trigger a
    // currency question merely because the model proposed need.price_rsd.
    const headcount = /(?:^|[^\p{L}\p{N}])\d+\s*(?:radnik\p{L}*|ljud\p{L}*|osob\p{L}*|радник\p{L}*|људ\p{L}*|особ\p{L}*)/iu.test(input);
    const falsePriceClaim = hasAmountIn(turn.assistantMessage, dinarUnit)
      || hasAmountIn(turn.assistantMessage, euroUnit)
      || /cen(?:a|u|e)\s+(?:je\s+)?\d|цен[ауе]\s+(?:је\s+)?\d/iu.test(turn.assistantMessage);
    turn = { ...turn, safety: headcount ? turn.safety : 'CLARIFY',
      proposals: withoutUnsupportedPrice(turn.proposals),
      assistantMessage: falsePriceClaim
        ? headcount ? 'Razumem koliko Vam izvršilaca treba.' : 'Na šta se odnosi broj koji ste naveli?'
        : turn.assistantMessage };
    dialogue = turn.dialogue;
  }
  if (unitPrice || repeated) {
    // An unsupported term does not erase independent answers in the same message.
    // Withhold its dependent facts and synthesized copy: a daily rate or several
    // shifts must not leak into a total price, one appointment or a public summary.
    // In particular, the price for several shifts is not the price for a new single shift.
    const partial = { ...turn, safety: 'CLARIFY' as const,
      priceRetraction: turn.priceRetraction ?? hourlyRetraction,
      proposals: turn.proposals.filter(p => !withheldUnitFacts.has(p.key)),
      dialogue: { ...dialogue!, next: 'CLARIFY', questionKey: '' },
      assistantMessage: unsupportedPrice && !repeated ? turn.assistantMessage : unitMessage };
    // Continue all existing validation, including relative dates and bounded
    // flexible ranges. A pricing clarification must never bypass time guards.
    turn = partial;
    dialogue = partial.dialogue;
  }
  // Deliberately narrow deterministic check. A negation, alternative, quotation
  // or several relative dates must be interpreted in context, never rewritten
  // by a naive keyword replacement. This does not prove arbitrary language true.
  const normalized = input.toLowerCase().replace(/данас/g, 'danas').replace(/прекосутра/g, 'prekosutra').replace(/сутра/g, 'sutra');
  const relative = normalized.match(/^\s*(?:(?:treba mi|termin je|za|треба ми|термин је|за)\s+)?(danas|sutra|prekosutra)[.!?\s]*$/);
  if (relative) {
    const offset = { danas: 0, sutra: 1, prekosutra: 2 }[relative[1]]!;
    const expectedDate = new Date(Date.parse(time.localDate + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
    const expectedKind = offset === 0 ? 'TODAY_FLEXIBLE' : offset === 1 ? 'TOMORROW_FLEXIBLE' : null;
    const kind = turn.proposals.find(p => p.key === 'need.schedule_kind')?.value;
    const start = turn.proposals.find(p => p.key === 'need.starts_at')?.value;
    const wrongKind = typeof kind === 'string' && kind !== 'FIXED_WINDOW' && kind !== expectedKind;
    const wrongStart = typeof start === 'string' && Number.isFinite(Date.parse(start))
      && serbiaTimeParts(new Date(start)).localDate !== expectedDate;
    if (wrongKind || wrongStart) return clarifySchedule(
      `Da razjasnimo termin: mislite li na ${expectedDate.split('-').reverse().join('.')}?`);
  }
  // Validate an explicit source/value contradiction even inside a full sentence.
  // This is evidence consistency, not interpretation of negation or alternatives:
  // on conflict ask for a date; never silently substitute one mentioned word.
  for (const proposal of turn.proposals) {
    if (!['need.schedule_kind', 'need.starts_at'].includes(proposal.key)) continue;
    const evidence = String(proposal.evidence ?? '').toLowerCase().trim()
      .replace(/данас/g, 'danas').replace(/прекосутра/g, 'prekosutra').replace(/сутра/g, 'sutra')
      .replace(/[.!?]+$/g, '').trim();
    if (!['danas', 'sutra', 'prekosutra'].includes(evidence)
      || !new RegExp('(?:^|[^\\p{L}])' + evidence + '(?=$|[^\\p{L}])', 'u').test(normalized)) continue;
    const offset = { danas: 0, sutra: 1, prekosutra: 2 }[evidence]!;
    const date = new Date(Date.parse(time.localDate + 'T12:00:00Z') + offset * 86400000).toISOString().slice(0, 10);
    const kind = offset === 0 ? 'TODAY_FLEXIBLE' : offset === 1 ? 'TOMORROW_FLEXIBLE' : null;
    const conflict = proposal.key === 'need.schedule_kind'
      ? proposal.value !== 'FIXED_WINDOW' && proposal.value !== kind
      : typeof proposal.value === 'string' && Number.isFinite(Date.parse(proposal.value))
        && serbiaTimeParts(new Date(proposal.value)).localDate !== date;
    if (conflict) return clarifySchedule('Koji je tačan datum početka zadatka?');
  }
  if (dialogue?.schedulePattern === 'FLEXIBLE_RANGE') {
    // Provider-owned interpretation of a bounded *choice* of dates must not
    // contradict its typed proposal by turning into unlimited availability.
    // This checks effective facts, so an answer about price/place can retain an
    // already complete range. It neither parses arbitrary user language nor
    // invents dates, removes old facts or authorizes publication.
    const effective = new Map(activeFacts.filter(f => f.status !== 'UNKNOWN').map(f => [f.fact_key, f.fact_value]));
    for (const proposal of turn.proposals) effective.set(proposal.key, proposal.value);
    const instant = (value: unknown) => typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)
      ? Date.parse(value) : NaN;
    const start = instant(effective.get('need.starts_at')), end = instant(effective.get('need.ends_at'));
    if (!['FLEXIBLE', 'REMOTE_ANYTIME'].includes(String(effective.get('need.schedule_kind')))
      || !Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
      return { ...turn, safety: 'CLARIFY',
        // A missing end must not silently turn a supplied start into an
        // unbounded not-before task. Other answers still reach the owned writer.
        proposals: turn.proposals.filter(proposal => !['need.schedule_kind', 'need.starts_at', 'need.ends_at'].includes(proposal.key)),
        dialogue: { ...dialogue, next: 'CLARIFY', questionKey: '' },
        assistantMessage: 'Dan može da bude fleksibilan unutar perioda. Od kog do kog datuma Vam odgovara da se zadatak uradi?' };
    }
  }
  const timeChecked = guardTimestampProposals(turn, input, activeFacts, time, pendingDeadlineQuestion);
  if (timeChecked !== turn) return timeChecked;
  const proposals = turn.proposals.filter(proposal => !activeFacts.some(fact =>
    fact.fact_key === proposal.key && fact.status !== 'UNKNOWN' && sameFactValue(fact.fact_value, proposal.value)));
  // Contextual map questions remain about the visible place. All safety, task,
  // time, price and typed-fact guards above still run; generic ACK/review prose does not replace them.
  if (contextualLocation) {
    const effectiveGeography = proposals.find(p => p.key === 'need.task_geography')?.value
      ?? activeFacts.find(f => f.fact_key === 'need.task_geography' && f.status !== 'UNKNOWN')?.fact_value;
    const effectiveHandoff = proposals.find(p => p.key === 'need.handoff')?.value
      ?? activeFacts.find(f => f.fact_key === 'need.handoff' && f.status !== 'UNKNOWN')?.fact_value;
    if(dialogue?.next==='REVIEW'&&(effectiveGeography as any)?.mode==='REMOTE'&&!decodeServiceHandoff(effectiveHandoff))
      return {...turn,proposals,assistantMessage: turn.assistantMessage?.trim() || 'Kako želite da preuzmete rezultat: digitalno, slanjem ili lično?'};
    // A REVIEW plan cannot skip the visible, still unconfirmed map step.
    // Direct explanations and genuine confirmations retain their own response.
    const pendingMapReview = dialogue?.next === 'REVIEW' && turn.locationAction !== 'CONFIRM_DISPLAYED'
      && (effectiveGeography as any)?.mode !== 'REMOTE';
    return { ...turn, proposals, ...(pendingMapReview && !turn.assistantMessage?.trim() ? {
      assistantMessage: contextualLocation.phase === 'PROPOSAL' || turn.locationAction === 'CORRECT'
        ? 'Još treba da proverite predloženo mesto na mapi i potvrdite potrebne tačke.'
        : 'Za ovu tačku još nemamo jednoznačno mesto. U kom je gradu i koji naziv ili orijentir da potražimo?'
    } : {}) };
  }
  const facts = new Map(activeFacts.filter(f => f.status !== 'UNKNOWN').map(f => [f.fact_key, f.fact_value]));
  for (const proposal of proposals) facts.set(proposal.key, proposal.value);
  if (!facts.has('need.people_needed') && dialogue?.next === 'REVIEW') {
    facts.set('need.people_needed', 1);
    proposals.push({ key: 'need.people_needed', value: 1, evidence: 'Podrazumevano za pojedinačni zadatak' });
  }
  if (facts.has('need.price_rsd') && !explicitOffers && facts.get('need.price_mode') !== 'MY_PRICE') {
    facts.set('need.price_mode', 'MY_PRICE');
    if (!proposals.some(p => p.key === 'need.price_mode')) {
      proposals.push({ key: 'need.price_mode', value: 'MY_PRICE', evidence: 'Naveden budžet u RSD' });
    }
  }
  if (facts.get('need.price_mode') === 'MY_PRICE' && facts.has('need.price_rsd') && !facts.has('need.price_basis')) {
    const defaultBasis = hourly ? 'HOURLY' : 'TOTAL';
    facts.set('need.price_basis', defaultBasis);
    if (!proposals.some(p => p.key === 'need.price_basis')) {
      proposals.push({ key: 'need.price_basis', value: defaultBasis, evidence: 'Podrazumevani obračun budžeta' });
    }
  }
  const missing = [...new Set(['need.description', 'need.people_needed', 'need.price_mode',
    ...(facts.get('need.price_mode') === 'MY_PRICE' ? ['need.price_rsd', ...(Number(facts.get('need.people_needed')) > 1 ? ['need.price_basis'] : [])] : []),
    'need.schedule_kind', ...(facts.get('need.schedule_kind') === 'FIXED_WINDOW' ? ['need.starts_at'] : []),
    'need.task_country_code', 'need.task_geography',
    ...((facts.get('need.task_geography') as any)?.mode==='REMOTE'&&!decodeServiceHandoff(facts.get('need.handoff'))?['need.handoff']:[]),
    ...Object.entries(NEED_FACT_V2_DEFINITIONS).filter(([, definition]) => definition.requiredForDraft).map(([key]) => key)])]
    .filter(key => !facts.has(key) || key==='need.handoff'&&!decodeServiceHandoff(facts.get(key)));
  const questions: Record<string, string> = {
    'need.description': 'Šta treba da se uradi?', 'need.people_needed': 'Koliko ljudi Vam treba?',
    'need.price_mode': 'Imate li planiran budžet ili želite da dobijete ponude?', 'need.price_rsd': facts.get('need.price_basis') === 'HOURLY' ? 'Koju cenu u dinarima po osobi po satu nudite?'
      : facts.get('need.price_basis') === 'PER_PERSON' ? 'Koju cenu u dinarima po osobi nudite?' : 'Koji iznos u dinarima nudite?',
    'need.price_basis': 'Da li je taj budžet ukupan za ceo zadatak ili po osobi?', 'need.schedule_kind': 'Kada treba da se uradi?',
    'need.starts_at': 'Kog datuma i u koliko sati zadatak počinje?', 'need.ends_at': 'Kada se zadatak završava?',
    'need.task_country_code': 'U kojoj državi je zadatak?', 'need.task_geography': 'Gde treba da se uradi?',
    'need.handoff': 'Kako želite da preuzmete rezultat: digitalno, slanjem ili lično?',
  };
  const incompleteMessage = () => {
    const key = missing.find(key => questions[key]);
    return key ? questions[key] : 'Podaci za pregled još nisu potpuni. Opis zadatka ostaje u razgovoru.';
  };
  // A city-only stationary task is valid geography for categorisation, but not a
  // ready point on the map. This is a conversation gate, NOT a public address or
  // permission to publish; server-owned review still controls actual readiness.
  const geography = facts.get('need.task_geography') as any;
  const streetOrLandmark = facts.get('need.exact_address');
  // A spoken neighborhood or POI belongs to the geography that Gemini already
  // proposed. It starts a map SEARCH, never a verified coordinate or exact address.
  // Requiring the private exact-address field caused endless repeated questions.
  const tidyPlace = (part: unknown) => typeof part === 'string'
    ? part.normalize('NFKC').toLocaleLowerCase('sr-Latn-RS').replace(/[^\p{L}\p{N}]+/gu, ' ').trim() : '';
  const city = tidyPlace(geography?.start?.city);
  const nearHint = [geography?.start?.area, geography?.start?.label].some(part => {
    const hint = tidyPlace(part);
    return !!hint && hint !== city && !['ovde', 'moja lokacija', 'trenutna lokacija', 'gde se nalazim'].includes(hint);
  });
  const hasPlaceHint = (typeof streetOrLandmark === 'string' && !!streetOrLandmark.trim()) || nearHint;
  const cityOnlyStationary = geography?.mode === 'STATIONARY' && !hasPlaceHint;
  const routePoints: Array<{name: string; target: string; point: any}> = geography?.mode === 'POINT_TO_POINT' || geography?.mode === 'MULTI_STOP'
    ? [{name:'polazište',target:'polazište',point:geography.start},
      ...(geography.waypoints ?? []).map((point: any, index: number) => ({name:`stanica ${index + 1}`,target:`stanicu ${index + 1}`,point})),
      ...(geography.end ? [{name:'odredište',target:'odredište',point:geography.end}] : [])] : [];
  const incompleteRoutePoint = routePoints.find(({point}) => {
    const city = tidyPlace(point?.city);
    return !city || ![point?.area, point?.label].some(part => {
      const hint = tidyPlace(part);
      return !!hint && hint !== city && !['ovde','moja lokacija','trenutna lokacija','gde se nalazim'].includes(hint);
    });
  });
  const routeQuestion = incompleteRoutePoint && (!tidyPlace(incompleteRoutePoint.point?.city)
    ? `U kom gradu je ${incompleteRoutePoint.name}?`
    : `Koju ulicu, deo grada ili orijentir da koristimo za ${incompleteRoutePoint.target}?`);
  const nearestPlaceQuestion = 'U kom delu grada je zadatak? Dovoljna je ulica ili neki bliski orijentir; tačku ćemo zatim proveriti na mapi.';
  const mapConfirmationMessage = 'Proverite predlog mesta na mapi. Pomerite pin ako treba, pa potvrdite tačku.';
  const routeMapMessage = 'Proverite i potvrdite preostale tačke rute na mapi.';
  const nextPlaceMessage = cityOnlyStationary ? nearestPlaceQuestion : routeQuestion
    || (routePoints.length ? routeMapMessage : geography?.mode === 'STATIONARY' && hasPlaceHint ? mapConfirmationMessage
      : 'Podaci su spremni za pregled.');
  let assistantMessage = turn.assistantMessage;
  const hasStreamedReply = typeof assistantMessage === 'string' && assistantMessage.trim().length > 0;
  if (dialogue?.next === 'ASK') {
    const needsPlaceDetail = dialogue.questionKey === 'need.task_geography' && (cityOnlyStationary || !!incompleteRoutePoint);
    const clarifyingApplicationDeadline = applicationDeadlineEnabled() && dialogue.questionKey === 'need.response_deadline'
      && !facts.has('need.response_deadline') && (pendingDeadlineQuestion || /prijav|konkuri|javlj/iu.test(input));
    const askingAlreadyKnown = activeFacts.some(f => f.fact_key === dialogue.questionKey && f.status !== 'UNKNOWN' && !proposals.some(p => p.key === dialogue.questionKey));
    const personAsks = /[?？]\s*$/u.test(input.trim());
    if (!missing.length && geography?.mode === 'REMOTE' && !clarifyingApplicationDeadline && !personAsks) {
      if (!hasStreamedReply) {
        assistantMessage = 'Osnovni podaci su zabeleženi. Možete da pregledate nacrt zadatka.';
      }
      dialogue = { ...dialogue, next: 'REVIEW', questionKey: '' };
    } else if (missing.length && !questions[dialogue.questionKey] && !needsPlaceDetail && !clarifyingApplicationDeadline && !personAsks) {
      const key = missing.find(key => questions[key]);
      if (key) {
        if (!hasStreamedReply) assistantMessage = incompleteMessage();
        dialogue = { ...dialogue, next: 'ASK', questionKey: key };
      }
    } else if (askingAlreadyKnown && !needsPlaceDetail && !clarifyingApplicationDeadline) {
      if (!hasStreamedReply) assistantMessage = missing.length ? incompleteMessage() : nextPlaceMessage;
    }
  } else if (dialogue?.next === 'REVIEW' && missing.length) {
    if (!hasStreamedReply) assistantMessage = incompleteMessage();
  } else if (!missing.length && dialogue?.next === 'REVIEW' && routePoints.length) {
    if (!hasStreamedReply) assistantMessage = routeQuestion || routeMapMessage;
  } else if (!missing.length && dialogue?.next === 'REVIEW' && geography?.mode === 'STATIONARY'
    && !(typeof streetOrLandmark === 'string' && streetOrLandmark.trim())) {
    if (!hasStreamedReply) assistantMessage = cityOnlyStationary ? nearestPlaceQuestion : mapConfirmationMessage;
  }
  return { ...turn, proposals, assistantMessage, dialogue };
}

Deno.serve(async (req: Request) => {
  const requestStartedAt = Date.now();
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return response(405, { code: 'METHOD_NOT_ALLOWED', message: 'Koristite POST.' });
  const authorization = req.headers.get('Authorization') ?? '';
  if (!/^Bearer [^\s]+$/.test(authorization)) return response(401, { code: 'AUTH_REQUIRED', message: 'Prijavite se da biste nastavili.' });
  let body: any;
  try { body = (await boundedJson(req, {}, 10485760, 15000, req.signal)).data; }
  catch { return response(400, { code: 'INVALID_JSON', message: 'Zahtev nije ispravan.' }); }
  if (!object(body) || Object.keys(body).some(key => !['conversationId', 'text', 'clientRequestId', 'mode', 'locationContext', 'imageBase64', 'imageMime'].includes(key)))
    return response(400, { code: 'REQUEST_INVALID', message: 'Zahtev nije ispravan.' });
  const locationMode = body.mode === 'locationReply';
  const locationContext: LocationContext | undefined = locationMode && validLocationContext(body.locationContext) ? body.locationContext : undefined;
  if (locationMode && (!locationContext || !exact(body, ['mode', 'conversationId', 'text', 'clientRequestId', 'locationContext']))
    || !locationMode && (Object.hasOwn(body, 'mode') || Object.hasOwn(body, 'locationContext')))
    return response(400, { code: 'LOCATION_CONTEXT_INVALID', message: 'Ponovo otvori prikaz mesta.' });
  if (locationMode && req.headers.get('Accept')?.split(',').some(value => value.trim() === 'text/event-stream'))
    return response(406, { code: 'LOCATION_STREAM_UNSUPPORTED', message: 'Odgovor o mestu koristi potvrđen pojedinačni odgovor.' });
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim().toLowerCase() : '';
  const text = typeof body.text === 'string' ? body.text.trim() : '';
  let imageBase64: string | undefined = undefined;
  let imageMime: string | undefined = undefined;
  if (body.imageBase64 !== undefined || body.imageMime !== undefined) {
    if (typeof body.imageBase64 !== 'string' || typeof body.imageMime !== 'string' ||
        !['image/jpeg', 'image/png', 'image/webp'].includes(body.imageMime) ||
        body.imageBase64.length === 0 || body.imageBase64.length > 7000000) {
      return response(400, { code: 'IMAGE_INVALID', message: 'Slika nije ispravna (dozvoljeni formati su JPEG, PNG i WebP do 5MB).' });
    }
    imageBase64 = body.imageBase64;
    imageMime = body.imageMime;
  }
  if (!isUuid(conversationId)) return response(400, { code: 'CONVERSATION_ID_INVALID', message: 'Nacrt Zadatka nije ispravan.' });
  if ((!text && !imageBase64) || text.length > 4000) return response(400, { code: 'MESSAGE_INVALID', message: 'Unesite poruku do 4.000 znakova ili fotografiju.' });
  const effectiveUserMessage = text || (imageBase64 ? 'Poslao sam fotografiju zadatka.' : '');
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
  const anonKey = readSupabasePublishableKey(name => Deno.env.get(name)) ?? '';
  if (!supabaseUrl || !anonKey) return response(500, { code: 'SERVER_CONFIG_ERROR', message: 'Serverska konfiguracija nije dostupna.' });
  let accountId: string;
  try {
    // Actual Auth user verification; neither body IDs nor editable JWT metadata
    // are accepted as the account identity used by the service-only completion.
    const verified = await boundedJson(supabaseUrl + '/auth/v1/user', {
      headers: { apikey: anonKey, Authorization: authorization },
    }, 65536, 5000, req.signal, true);
    if (!verified.ok && (verified.status === 401 || verified.status === 403))
      return response(401, { code: 'AUTH_REQUIRED', message: 'Prijavite se da biste nastavili.' });
    if (!verified.ok || !isUuid(verified.data?.id))
      return response(503, { code: 'AUTH_UNAVAILABLE', message: 'Provera naloga trenutno nije dostupna. Pokušaj ponovo.' });
    accountId = verified.data.id.toLowerCase();
  } catch { return response(503, { code: 'AUTH_UNAVAILABLE', message: 'Provera naloga trenutno nije dostupna. Pokušaj ponovo.' }); }
  const release = admitUser(accountId);
  if (!release) return response(429, { code: 'AI_RATE_LIMITED', message: 'Sačekajte trenutak pre sledeće poruke.' });
  const availabilityDiagnostics = req.headers.get(AI_DIAGNOSTICS_HEADER) === AI_DIAGNOSTICS_VERSION;
  const wantsStream = req.headers.get('Accept')?.split(',').some(value => value.trim() === 'text/event-stream') === true;
  const wantsIntent = req.headers.get(INTERVIEW_INTENT_HEADER) === INTERVIEW_INTENT_CAPABILITY;
  let completedIntentHint: ReturnType<typeof conversationIntentHint> = null;
  let detachedRelease = false;
  let requestId = '', attemptId: string | null = null, claimedTurnId: string | null = null;
  let retirementStarted = false;
  let serviceRoleKey = '';
  const rpc = (name: string, args: Record<string, unknown>, signal?: AbortSignal, timeout = 8000) => boundedJson(supabaseUrl + '/rest/v1/rpc/' + name, {
    method: 'POST', headers: supabaseServiceHeaders(serviceRoleKey, { 'Content-Type': 'application/json' }),
    body: JSON.stringify(args),
  }, 524288, timeout, signal);
  const identityArgs = () => ({ p_account_id: accountId, p_conversation_id: conversationId, p_client_request_id: requestId });
  const retireAttempt = async () => {
    if (!attemptId || retirementStarted) return;
    retirementStarted = true;
    try {
      // Independent bounded metadata settlement. PKG-039 SQL only ends the same
      // PROCESSING attempt; SUCCEEDED/cancelled are preserved, dispatch never reset.
      await rpc('rpc_ai_fail_need_turn_v2_service', { ...identityArgs(), p_attempt_id: attemptId }, undefined, 5000);
    } catch { /* Durable sweep remains the fallback; no inference retry/refund. */ }
  };
  try {
    const conversationQuery = await boundedJson(supabaseUrl + '/rest/v1/ai_conversations?id=eq.' + encodeURIComponent(conversationId) +
      '&purpose=eq.NEED_INTAKE&select=id,account_id,fact_schema_version,status&limit=1', {
      headers: { apikey: anonKey, Authorization: authorization },
    }, 8192, 8000, req.signal);
    if (!conversationQuery.ok) return response(502, { code: 'CONVERSATION_READ_FAILED', message: 'Nacrt nije mogao da se proveri.' });
    const rows = conversationQuery.data;
    if (!Array.isArray(rows) || rows.length !== 1 || !sameUuid(rows[0]?.id, conversationId) || !sameUuid(rows[0]?.account_id, accountId))
      return response(404, { code: 'CONVERSATION_NOT_FOUND', message: 'Nacrt nije dostupan ovom nalogu.' });
    const schemaVersion: FactSchemaVersion = rows[0].fact_schema_version === NEED_FACT_SCHEMA_V2 ? NEED_FACT_SCHEMA_V2 : LEGACY_FACT_SCHEMA_V1;
    if (schemaVersion === NEED_FACT_SCHEMA_V2) {
      const allowedKeys = locationMode
        ? ['mode', 'conversationId', 'text', 'clientRequestId', 'locationContext']
        : ['conversationId', 'text', 'clientRequestId', ...(imageBase64 ? ['imageBase64', 'imageMime'] : [])];
      if (!exact(body, allowedKeys) || !isUuid(body.clientRequestId))
        return response(400, { code: 'CLIENT_REQUEST_ID_INVALID', message: 'Ponovo otvorite unos pre slanja.' });
      requestId = body.clientRequestId.toLowerCase();
    } else if (!exact(body, ['conversationId', 'text']) || rows[0].status !== 'OPEN') {
      return response(409, { code: 'CONVERSATION_NOT_OPEN', message: 'Ovaj razgovor više nije otvoren.' });
    }
    serviceRoleKey = readSupabaseServiceKey(name => Deno.env.get(name)) ?? '';
    if (!serviceRoleKey) return response(500, { code: 'SERVER_CONFIG_ERROR', message: 'Serverska konfiguracija nije dostupna.' });
    let history: any[], activeFacts: any[];
    if (schemaVersion === NEED_FACT_SCHEMA_V2) {
      const result = await rpc(locationMode ? 'rpc_ai_claim_need_location_turn_v1_service' : 'rpc_ai_claim_need_turn_v2_service',
        { ...identityArgs(), p_user_message: effectiveUserMessage, ...(locationContext ? { p_location_context: locationContext } : {}) }, req.signal);
      if (!result.ok) {
        const name = result.data?.message;
        if (name === 'LOCATION_VERSION_CONFLICT' || name === 'LOCATION_CONTEXT_INVALID')
          return response(409, { code: name, message: 'Mesto je promenjeno. Pogledaj trenutni predlog pre odgovora.' });
        if (name === 'AI_RATE_LIMITED') return response(429, { code: 'AI_RATE_LIMITED', message: 'Sačekajte trenutak pre sledeće poruke.' });
        if (name === 'AI_REQUEST_ID_REUSED') return response(409, { code: 'AI_REQUEST_ID_REUSED', message: 'Ovaj pokušaj pripada drugoj poruci. Proverite razgovor.' });
        return response(502, { code: 'AI_TURN_NOT_CONFIRMED', message: 'Proverite ishod poruke pre nastavka.' });
      }
      const value = result.data;
      if (!exact(value, ['turn', 'claim']) || !validTurn(value.turn, conversationId, requestId)) throw new Error('AI_CLAIM_INVALID');
      if (value.claim === null) {
        if (!locationContext) return turnResponse(value.turn);
        const read = await rpc('rpc_ai_read_need_location_turn_v1_service', identityArgs(), req.signal);
        if (!read.ok || !validLocationEnvelope(read.data, locationContext, turn => validTurn(turn, conversationId, requestId))) throw new Error('AI_TURN_RECEIPT_INVALID');
        return response(read.data.turn.state === 'SUCCEEDED' ? 200 : read.data.turn.state === 'PROCESSING' ? 202 : 409, read.data);
      }
      const claim = value.claim;
      if (value.turn.state !== 'PROCESSING' || !exact(claim, ['attemptId', 'leaseExpiresAt', 'context']) || !isUuid(claim.attemptId) ||
        typeof claim.leaseExpiresAt !== 'string' || !Number.isFinite(Date.parse(claim.leaseExpiresAt)) || Date.parse(claim.leaseExpiresAt) <= Date.now())
        throw new Error('AI_CLAIM_INVALID');
      attemptId = claim.attemptId; claimedTurnId = value.turn.turnId;
      if (!validClaimContext(claim.context)) throw new Error('AI_CONTEXT_INVALID');
      history = claim.context.history; activeFacts = claim.context.activeFacts;
    } else {
      const headers = { apikey: anonKey, Authorization: authorization };
      const [messages, facts] = await Promise.all([
        boundedJson(supabaseUrl + '/rest/v1/ai_messages?conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&select=role,body,sequence_no&order=sequence_no.desc&limit=40', { headers }, 262144, 8000, req.signal),
        boundedJson(supabaseUrl + '/rest/v1/ai_structured_facts?conversation_id=eq.' + encodeURIComponent(conversationId) +
          '&fact_key=in.(' + encodeURIComponent(AI_CONTEXT_FACT_KEYS.map(key => JSON.stringify(key)).join(',')) +
          ')&superseded_at=is.null&select=fact_key,fact_value,value_type,display_value,fact_schema_version,status,source,created_at&order=created_at.asc', { headers }, 262144, 8000, req.signal),
      ]);
      if (!messages.ok || !facts.ok || !Array.isArray(messages.data) || !Array.isArray(facts.data)) throw new Error('AI_CONTEXT_INVALID');
      history = [...messages.data].reverse(); activeFacts = facts.data;
    }
    const geminiKey = Deno.env.get('GEMINI_API_KEY') ?? '', geminiModel = Deno.env.get('GEMINI_MODEL') ?? '';
    const provider = Deno.env.get('AI_PROVIDER') ?? '';
    const timeContext = serverTimeContext(new Date());
    const execute = async (onText?: (delta: string) => void, signal: AbortSignal = req.signal) => {
    let aiTurn: ParsedTurn;
    // One paid response; usage is accounted even if its semantic output is refused.
    let reportedUsage: GeminiUsage | null = null;
    let research: ReturnType<typeof createResearchDeadline> | null = null;
    let pendingClarificationHint: any = null;
    const singlePassActive = isLiveTaxonomyIntake();
    let fullCatalog: Awaited<ReturnType<typeof loadFullCatalogTree>> | null = null;
    let taxonomyDecisions: any[] = [];
    const taskDraftRevision = history.reduce((latest: number, row: any) =>
      Number.isSafeInteger(row?.sequence_no) ? Math.max(latest, row.sequence_no) : latest, 0);
    try {
      if (wantsStream && (schemaVersion !== NEED_FACT_SCHEMA_V2 || provider !== 'gemini' || geminiModel !== 'gemini-3.8-flash')) {
        await retireAttempt();
        return response(503, { code: 'AI_STREAM_NOT_CONFIGURED', message: 'Razgovor uživo još nije podešen.' });
      }
      // Every new inference uses the approved provider and shared reservation,
      // regardless of Accept or historical optional environment flags. Legacy
      // conversations retain their history/manual writers, but have no durable
      // V2 operation identity with which to authorize a new paid attempt.
      if (schemaVersion !== NEED_FACT_SCHEMA_V2 || provider !== 'gemini' || geminiModel !== 'gemini-3.8-flash'
        || !geminiKey || Deno.env.get('USKOCI_GEMINI_PAID_TEST_ENABLED') !== 'true') {
        await retireAttempt();
        return response(503, { code: 'AI_PROVIDER_NOT_CONFIGURED', message: 'AI obrada još nije aktivirana na serveru.' });
      }
      const budget = await reserveAiTestBudget({ supabaseUrl, serviceRoleKey, accountId, operationId: requestId, kind: 'LLM', signal });
      if (!budget.admitted || budget.replay) {
        await retireAttempt();
        return response(503, { code: budget.code, message: 'Probni AI zahtev nije odobren. Proverite prethodni ishod ili test limit.' });
      }
      if (schemaVersion === NEED_FACT_SCHEMA_V2) {
        // Persist dispatch intent before any provider I/O. Lost ACK, timeout or
        // response parsing failure cannot authorize another billable attempt.
        const dispatched = await rpc('rpc_ai_dispatch_need_turn_v2_service', { ...identityArgs(), p_attempt_id: attemptId }, signal);
        if (!dispatched.ok || dispatched.data !== true) {
          await retireAttempt();
          return response(409, { code: 'AI_TURN_NOT_CONFIRMED', message: 'Proverite ishod poruke pre nastavka.' });
        }
      }
      // The same deadline covers catalog loading and the foreground model.
      research = createResearchDeadline(signal, requestStartedAt);
      // Historical rollout flag now selects the full-catalog, one-call path.
      // Keep the same DEV/account admission until a separately verified rollout.
      if (singlePassActive) {
        fullCatalog = await measureAiPhase('NEED_FULL_CATALOG', () => loadFullCatalogTree(
          (name: string, args: Record<string, unknown>, sig?: AbortSignal, t?: number) => rpc(name, args, sig ?? research!.signal, t ?? 2500),
          research.signal)).catch(() => null);
        pendingClarificationHint = await fetchUnconsumedClarificationHint(
          null,
          conversationId,
          taskDraftRevision
        ).catch(() => null);
      }
      const existingCategoryFact = activeFacts.find((f: any) => f.fact_key === 'need.category' && f.status !== 'UNKNOWN')?.fact_value;
      const isExplicitReclassify = /(?:promen(?:i|ite)|drugi\s+(?:zadatak|posao)|ipak\s+(?:nesto|nešto)\s+drugo|pogre(?:s|š)na\s+kategorija)/iu.test(effectiveUserMessage);
      const needsTree = singlePassActive && (!existingCategoryFact || isExplicitReclassify);

      aiTurn = await callGemini(geminiKey, geminiModel, schemaVersion, history, activeFacts, effectiveUserMessage, timeContext, research.signal, onText,
        (usage) => { reportedUsage = usage; }, locationContext, imageBase64, imageMime, pendingClarificationHint,
        !locationContext && req.headers.get(NEED_FACT_TURN_CAPABILITY_HEADER) === NEED_FACT_TURN_CAPABILITY_VERSION ? MAX_AI_NEED_FACT_V2_PROPOSALS : 12,
        needsTree ? {catalog:fullCatalog,onDecisions:(decisions) => { taxonomyDecisions=decisions; }} : undefined);
      if (locationContext) {
        // A validated answer to the shown question (e.g. 'to je to') stays a map
        // confirmation. Explicit task publication can never take that route.
        if (!aiTurn.intentAllowsChanges || explicitPublicationOnly(effectiveUserMessage) || taskFinishOnly(effectiveUserMessage) && aiTurn.locationAction !== 'CONFIRM_DISPLAYED') aiTurn.locationAction = 'CONTINUE';
        else if (!aiTurn.locationAction || aiTurn.safety !== 'ALLOW') aiTurn.locationAction = 'CLARIFY';
      }
    } catch (providerError: any) {
      console.error('AI_PROVIDER_FAILED', providerFailureClass(providerError));
      await retireAttempt();
      if (availabilityDiagnostics && providerError instanceof GeminiCreditsUnavailableError) return response(503, { code: AI_CREDITS_UNAVAILABLE });
      return response(502, { code: 'AI_PROVIDER_FAILED', message: 'AI obrada trenutno nije uspela. Proverite ishod pre nastavka.' });
    } finally {
      research?.dispose();
      if (reportedUsage) {
        const usageSnapshot = reportedUsage;
        const recordUsage = async () => {
          try {
            await rpc('rpc_ai_test_record_usage_service', { p_operation_id: requestId, p_model: geminiModel,
              p_prompt_tokens: usageSnapshot.promptTokens, p_output_tokens: usageSnapshot.outputTokens,
              p_total_tokens: usageSnapshot.totalTokens }, new AbortController().signal, 3000);
          } catch { /* Retain the conservative reservation; never retry inference. */ }
        };
        void runInBackground(recordUsage());
      }
    }
    // A validated answer may finish after the phone disconnects. SQL still
    // checks explicit cancellation, ownership, source revision and lease.
    if (schemaVersion === NEED_FACT_SCHEMA_V2) {
      let builtTaxonomy: any = null;
      let hasClassificationInput = false;
      if (singlePassActive && aiTurn.intentAllowsChanges && ['ALLOW','CLARIFY'].includes(aiTurn.safety)) {
        const turnProposals = aiTurn.proposals ?? [];
        const fact = (key: string) => activeFacts.find((f: any) => f.fact_key === key && f.status !== 'UNKNOWN')?.fact_value;
        const effectiveFact = (key: string) => turnProposals.find((p: any) => p.key === key)?.value ?? fact(key);
        const effCategory = effectiveFact('need.category');
        hasClassificationInput = typeof effCategory === 'string' && effCategory.trim().length >= 3;
        const priorCategory = fact('need.category');
        const priorDescription = fact('need.description');
        const proposedDescription = turnProposals.find((p: any) => p.key === 'need.description')?.value;
        const effGeo = effectiveFact('need.task_geography') as any;
        const effHandoff = effectiveFact('need.handoff');
        const priorFingerprint=taskClassificationFingerprint({service:priorCategory,scopeSummary:priorDescription,
          mode:taskTaxonomyMode(fact('need.task_geography')),handoff:fact('need.handoff')});
        const effectiveScope=taskTaxonomyScope({priorCategory,category:effCategory,priorDescription,proposedDescription});
        const effectiveFingerprint=taskClassificationFingerprint({service:effCategory,scopeSummary:effectiveScope,
          mode:taskTaxonomyMode(effGeo),handoff:effHandoff});
        const classificationInputChanged=effectiveFingerprint!==null && effectiveFingerprint!==priorFingerprint;

        const effMode = taskTaxonomyMode(effGeo);
        let effectiveDecisions = taxonomyDecisions;
        if (effectiveDecisions.length === 0 && typeof effCategory === 'string' && effCategory.trim().length >= 3 && effMode && fullCatalog) {
          const normCat = normalizedClassificationIdentity(effCategory.trim());
          const catCandidates = (fullCatalog.byNormalizedKey?.get(normCat) ?? []) as any[];
          const stripDiacritics = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
          const effStripped = stripDiacritics(effCategory);
          const matchingLeaf = catCandidates.find((c: any) => c.isLeaf && c.modes?.includes(effMode))
            ?? catCandidates.find((c: any) => c.isLeaf)
            ?? fullCatalog.categories?.find((c: any) => c.isLeaf && normalizedClassificationIdentity(c.label) === normCat)
            ?? fullCatalog.categories?.find((c: any) => c.isLeaf && (stripDiacritics(c.label) === effStripped || (Array.isArray(c.aliases) && c.aliases.some((a: string) => stripDiacritics(a) === effStripped))));
          if (matchingLeaf) {
            const catAction = matchingLeaf.modes?.includes(effMode) ? 'REUSE_EXISTING' : 'EXTEND_MODE';
            effectiveDecisions = [{
              service: effCategory.trim(),
              mode: effMode,
              action: catAction,
              categoryId: matchingLeaf.categoryId,
              parentId: '',
              proposedPath: [],
              ambiguityPrompt: '',
              reason: `Zadržana potvrđena kategorija „${effCategory.trim()}“ iz prethodnog koraka razgovora.`,
            }];
          }
        }

        if (classificationInputChanged || Boolean(pendingClarificationHint) || effectiveDecisions.length > 0) {
          // A missing geography is not evidence of on-site execution. The
          // classifier runs when the conversation has a typed execution mode.
          if (typeof effCategory === 'string' && effCategory.trim().length >= 3 && effMode) {
            // Local validation of the already paid response; no background provider.
            builtTaxonomy = await measureAiPhase('NEED_TAXONOMY_VALIDATE', () => buildFullTreeTaxonomyProposals({
              suppliedCatalog: fullCatalog,
              suppliedDecisions: effectiveDecisions,
              items: [{ service: effCategory.trim(), mode: effMode, handoff: effHandoff }],
              conversationId,
              // Completion persists one USER and one ASSISTANT message.
              draftRevision: taskDraftRevision + 2,
            })).catch(() => null);
          }
        }
      }
      const taxonomyPlan = singlePassCapturePlan(builtTaxonomy, fullCatalog);
      if (hasClassificationInput && !locationContext)
        aiTurn = withUnresolvedSinglePassReply(aiTurn, builtTaxonomy, taxonomyPlan);
      if (builtTaxonomy?.proposals?.length && !taxonomyPlan) console.info('NEED_TAXONOMY_HINT_CAPTURE', 'PAYLOAD_UNAVAILABLE');
      // Paired SQL/Edge promotion is required. Never fall back to a split write
      // or run Gemini again when the atomic RPC is absent or its ACK is lost.
      const completionRpc = taxonomyPlan
        ? (locationContext ? 'rpc_ai_complete_need_location_turn_with_first_plan_service' : 'rpc_ai_complete_need_turn_with_first_plan_service')
        : (locationContext ? 'rpc_ai_complete_need_location_turn_v1_service' : 'rpc_ai_complete_need_turn_v2_service');
      const completionArgs = { ...identityArgs(), p_attempt_id: attemptId,
        // Claim and completion use the same canonical photo placeholder/text.
        p_user_message: effectiveUserMessage, p_assistant_message: aiTurn.assistantMessage, p_safety: aiTurn.safety, p_proposals: needTurnPersistenceProposals(aiTurn),
        ...(locationContext ? { p_location_context: locationContext, p_location_action: aiTurn.locationAction } : {}),
        ...(taxonomyPlan ? { p_taxonomy_plan: taxonomyPlan } : {}) };
      const decodeCompletion = (envelope: unknown) => {
        const data = taxonomyPlan ? singlePassCompletion(envelope) : envelope;
        const turn = locationContext ? data?.turn : data;
        if (!validTurn(turn, conversationId, requestId) || turn.turnId !== claimedTurnId
          || locationContext && !validLocationEnvelope(data, locationContext, value => validTurn(value, conversationId, requestId)))
          throw new Error('AI_TURN_RECEIPT_INVALID');
        if (turn.state === 'SUCCEEDED' && (turn.receipt.proposedCount !== aiTurn.proposals.length || turn.receipt.safety !== aiTurn.safety))
          throw new Error('AI_TURN_RECEIPT_INVALID');
        if (locationContext && turn.state === 'SUCCEEDED' && data.location.action !== aiTurn.locationAction)
          throw new Error('AI_TURN_RECEIPT_INVALID');
        return data;
      };
      const completion = await measureAiPhase('NEED_COMPLETE', async () => {
        if (taxonomyPlan) return completeFirstPlan({ rpc, writer: completionRpc, args: completionArgs, decode: decodeCompletion });
        const result = await rpc(completionRpc, completionArgs, new AbortController().signal);
        if (!result.ok) throw new Error('AI_TURN_RECEIPT_INVALID');
        return decodeCompletion(result.data);
      });
      const completed = locationContext ? completion.turn : completion;
      if (completed.state === 'SUCCEEDED') completedIntentHint = conversationIntentHint(aiTurn.intentDecision, aiTurn.safety);
      if (completed.state === 'SUCCEEDED' && aiTurn.intentAllowsChanges && pendingClarificationHint?.service) {
          // Consumption belongs to the confirmed turn, not the classifier's budget.
          const consumeSignal = new AbortController().signal;
          void runInBackground(persistConsumeClarificationHint(
            (name: string, args: Record<string, unknown>, sig?: AbortSignal, t?: number) => rpc(name, args, sig ?? consumeSignal, t ?? 2500),
            conversationId, taskDraftRevision, pendingClarificationHint.service));
      }
      if (completed.state === 'SUCCEEDED' && builtTaxonomy?.clarifications?.length) {
        // A question is advisory; accepted classification is already stored
        // atomically. This optional hint cannot certify or block completion.
        const hintSignal = new AbortController().signal;
        void runInBackground(Promise.all(builtTaxonomy.clarifications.slice(0,1).map((hint: any) =>
          persistClarificationHint((name: string, args: Record<string, unknown>, sig?: AbortSignal, t?: number) =>
            rpc(name, args, sig ?? hintSignal, t ?? 2500), hint).then(stored => {
              if (!stored) { try { console.warn('NEED_TAXONOMY_HINT_STORE', 'UNAVAILABLE'); } catch { /* Nonfatal diagnostics. */ } }
            }))));
      }
      // No raw provider prose escapes before the semantic check and the exact
      // owned completion receipt. Deltas were already progressively streamed by streamGeminiTask.
      return locationContext ? response(completed.state === 'SUCCEEDED' ? 200 : completed.state === 'PROCESSING' ? 202 : 409, completion) : turnResponse(completed);
    }
    // Existing LEGACY_TEXT_V1 path remains isolated. V2 never calls this writer.
    const result = await rpc('rpc_ai_apply_legacy_need_turn_service', { p_account_id: accountId, p_conversation_id: conversationId,
      p_user_message: text, p_assistant_message: aiTurn.assistantMessage, p_safety: aiTurn.safety, p_proposals: aiTurn.proposals }, signal);
    if (!result.ok) throw new Error('AI_LEGACY_PERSIST_FAILED');
    const proposedCount = Number(result.data?.proposedCount ?? result.data?.proposed_count ?? aiTurn.proposals.length);
    return response(200, { predlozeno: Number.isFinite(proposedCount) ? Math.max(0, Math.trunc(proposedCount)) : aiTurn.proposals.length,
      assistantMessage: aiTurn.assistantMessage, safety: aiTurn.safety, blocked: aiTurn.safety === 'BLOCK', schemaVersion, provider });
    };
    if (!wantsStream) {
      const work = execute(); void runInBackground(work); return await work;
    }
    detachedRelease = true;
    const abort = new AbortController(), abortFromRequest = () => abort.abort();
    req.signal.addEventListener('abort', abortFromRequest, { once: true });
    if (req.signal.aborted) abort.abort();
    let closed = false;
    const stream = new ReadableStream({
      async start(controller) {
        let sequence = 0;
        const emit = (event: Record<string, unknown>) => {
          if (closed || abort.signal.aborted) return;
          controller.enqueue(new TextEncoder().encode('data: ' + JSON.stringify({
            conversationId, clientRequestId: requestId, turnId: claimedTurnId, attemptId, sequence: ++sequence, ...event,
          }) + '\n\n'));
        };
        emit({ kind: 'accepted' });
        try {
          const work = execute(text => emit({ kind: 'text_delta', text }), abort.signal);
          void runInBackground(work);
          const result = await work;
          const data = await result.json();
          if (result.ok && validTurn(data, conversationId, requestId) && data.state === 'SUCCEEDED') emit({ kind: 'final', turn: data,
            ...(wantsIntent && completedIntentHint ? { conversationIntent: completedIntentHint } : {}) });
          else emit({ kind: 'safe_error', code: availabilityDiagnostics && result.status === 503 && data?.code === AI_CREDITS_UNAVAILABLE ? AI_CREDITS_UNAVAILABLE : 'AI_TURN_NOT_CONFIRMED' });
        } catch {
          await retireAttempt();
          emit({ kind: 'safe_error', code: 'AI_TURN_NOT_CONFIRMED' });
        } finally {
          if (!closed) { closed = true; controller.close(); }
          abort.abort(); req.signal.removeEventListener('abort', abortFromRequest); release();
        }
      },
      cancel() { closed = true; abort.abort(); },
    });
    return new Response(stream, { headers: { ...corsHeaders, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', 'X-Accel-Buffering': 'no' } });
  } catch {
    await retireAttempt();
    return response(502, { code: 'AI_TURN_NOT_CONFIRMED', message: 'Potvrda nije stigla. Proverite ishod poruke pre nastavka.' });
  } finally { if (!detachedRelease) release(); }
});
