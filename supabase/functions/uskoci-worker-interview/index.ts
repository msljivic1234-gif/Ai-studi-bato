import { measureAiPhase } from '../_shared/aiPhaseTiming.mjs';
import { readSupabasePublishableKey, readSupabaseServiceKey, supabaseServiceHeaders } from '../_shared/supabaseKeys.mjs';
import { taxonomyIntakeEnabled } from '../_shared/taxonomyRuntimeConfig.mjs';
// New taxonomy operations have a single explicit server-side rollout owner.
import { AI_CREDITS_UNAVAILABLE, AI_DIAGNOSTICS_HEADER, AI_DIAGNOSTICS_VERSION } from '../../../src/contracts/aiAvailability.ts';
import { decodeWorkerAreas } from '../../../src/contracts/workerAreas.ts';
// Distinct owned WORKER_PROFILE_V1 proposals. No task facts or canonical writes.
import { interviewVoiceInstruction } from '../_shared/interviewVoiceInstruction.mjs';
import { AI_TEST_LIMITS, reserveAiTestBudget } from '../_shared/aiTestBudget.ts';
import { GeminiCreditsUnavailableError, streamGeminiTask, type GeminiUsage } from '../_shared/geminiTaskStream.ts';
import { singlePassTaxonomyInstruction, withSinglePassTaxonomySchema, takeSinglePassTaxonomy, singlePassCapturePlan, singlePassCompletion, withUnresolvedSinglePassReply } from '../_shared/singlePassTaxonomy.mjs';
import { completeFirstPlan } from '../_shared/completeFirstPlan.ts';
import { serviceExecutionInstruction } from '../_shared/serviceExecutionInstruction.mjs';
import { createResearchDeadline } from '../_shared/researchDeadline.ts';
import { readWorkerServiceModeContext, workerServiceModeSchema, workerServiceModeInstruction } from '../_shared/workerServiceModeContext.mjs';
import { guardWorkerAreaOutput } from '../_shared/workerAreaAdmission.mjs';
import { workerAreaRequestSchema, parseWorkerAreaRequests, resolveWorkerAreas } from '../_shared/workerAreaResolver.mjs';
import { loadFullCatalogTree, buildWorkerFullTreeTaxonomyProposals, runInBackground, fetchUnconsumedClarificationHint, persistClarificationHint, persistConsumeClarificationHint } from '../_shared/backgroundTaxonomyArchitect.mjs';
import { getOrCreateGeminiContextCache } from '../_shared/geminiContextCache.mjs';
import { INTERVIEW_INTENT_HEADER, INTERVIEW_INTENT_CAPABILITY, withConversationIntentSchema, conversationIntentInstruction,
  takeConversationIntent, intentAllowsDomain, guardInterviewIntentOutput, conversationIntentHint,
  workerServiceChangesSchema, workerServiceChangesInstruction, applyWorkerServiceChanges } from '../_shared/conversationIntent.mjs';
declare const Deno: { env: { get(name:string):string|undefined }; serve(handler:(request:Request)=>Promise<Response>):void };

const isLiveTaxonomyIntake = (): boolean => taxonomyIntakeEnabled((key:string)=>Deno.env.get(key));

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,x-client-info,x-uskoci-worker-preview-stream,x-uskoci-interview-intent',
  'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status,
  headers: { ...cors, 'Content-Type': 'application/json' } });
const object = (v: unknown): Record<string, any> | null => v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, any> : null;
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(v);
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.trim().length > 0 && v.length <= max
  && !/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);
const keys = (v: Record<string, any>, names: string[]) => Object.keys(v).length === names.length && names.every(k => Object.hasOwn(v, k));

async function requestText(req:Request):Promise<string>{
  const declared=req.headers.get('content-length');
  if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>20000))throw new Error('WORKER_AI_INPUT_INVALID');
  const reader=req.body?.getReader();if(!reader)throw new Error('WORKER_AI_INPUT_INVALID');
  let expired=false;const timer=setTimeout(()=>{expired=true;void reader.cancel().catch(()=>undefined);},5000);
  let size=0,body='';const decoder=new TextDecoder('utf-8',{fatal:true});
  try{for(;;){const part=await reader.read();if(expired||req.signal.aborted)throw new Error('WORKER_AI_CANCELLED');
    if(part.done)break;size+=part.value.byteLength;if(size>20000)throw new Error('WORKER_AI_INPUT_INVALID');body+=decoder.decode(part.value,{stream:true});}
    body+=decoder.decode();if(declared!==null&&Number(declared)!==size)throw new Error('WORKER_AI_INPUT_INVALID');return body;
  }finally{clearTimeout(timer);void reader.cancel().catch(()=>undefined);}
}

async function boundedJson(url: string, init: RequestInit, maximum: number, timeout: number, signal: AbortSignal) {
  const abort = new AbortController();
  let rejectStopped: (error: Error) => void = () => {};
  const stopped = new Promise<never>((_resolve,reject)=>{rejectStopped=reject;});
  void stopped.catch(()=>undefined);
  const stop = () => { abort.abort(); rejectStopped(new Error('WORKER_AI_CANCELLED')); }, timer = setTimeout(stop, timeout);
  signal.addEventListener('abort', stop, { once: true }); if (signal.aborted) stop();
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    if (abort.signal.aborted) throw new Error('WORKER_AI_CANCELLED');
    const response = await Promise.race([fetch(url, { ...init, redirect: 'error', signal: abort.signal }),stopped]);
    if (response.redirected || !response.body) throw new Error('WORKER_AI_UNAVAILABLE');
    reader = response.body.getReader(); let size = 0, body = ''; const decoder = new TextDecoder('utf-8', { fatal: true });
    for (;;) {
      const part = await Promise.race([reader.read(),stopped]); if (abort.signal.aborted) throw new Error('WORKER_AI_CANCELLED');
      if (part.done) break; size += part.value.byteLength;
      if (size > maximum) throw new Error('WORKER_AI_TOO_LARGE'); body += decoder.decode(part.value, { stream: true });
    }
    body += decoder.decode(); return { ok: response.ok, status: response.status, data: JSON.parse(body) };
  } finally { clearTimeout(timer); signal.removeEventListener('abort', stop); abort.abort(); void reader?.cancel().catch(() => undefined); }
}

export function workerProviderSchema() {
  const string = { type: 'STRING' }, integer = { type: 'INTEGER' }, boolean = { type: 'BOOLEAN' };
  const array = (items: unknown, description?: string) => ({ type: 'ARRAY', items, ...(description ? {description} : {}) });
  const obj = (properties: Record<string, unknown>, required: string[] = []) => ({ type: 'OBJECT', properties, ...(required.length ? { required } : {}) });
  const nullableString = { type: 'STRING', nullable: true };
  const rule = obj({ startTime: { ...string, description:'Declared local start hour, HH:MM, in the existing availability timezone.' },
    endTime: { ...string, description:'Declared local end hour, HH:MM, later than startTime; do not convert weekly hours to UTC.' },
    startsOn: { ...string, description:'YYYY-MM-DD. Keep the declared start date; for a new ongoing rule use the current local date from server time.' },
    endsOn: { ...nullableString, description:'YYYY-MM-DD only for an explicitly limited period; null for an ongoing weekly schedule.' },
    label: string, active: boolean },
    ['startTime','endTime','startsOn','endsOn','label','active']);
  return withConversationIntentSchema(obj({ assistantMessage: string, safety: { type: 'STRING', enum: ['ALLOW','CLARIFY','REVIEW','BLOCK'],
    description:'Use shared safety rules. REVIEW means a safety concern, never profile preview.' },
    availabilityChange: obj({ kind: { type: 'STRING', enum: ['NONE','PATCH','CLARIFY'] },
      scope: { type: 'STRING', enum: ['NONE','WEEKLY','DATED','NOW','MIXED'] }, evidence: string }, ['kind','scope','evidence']),
    serviceChanges: workerServiceChangesSchema,
    patch: obj({ displayName: string, bio: string,
      location: obj({ operatingCountryCode: string, city: string, radiusKm: integer }),
      areaRequests: workerAreaRequestSchema,
      availability: {...obj({ timezone: string, availableNow: boolean,
        ruleChanges: array(obj({ ruleId: { ...nullableString, description:'null adds a new rule; otherwise use the owned rule ID being changed.' },
          weekdays: array(integer, 'Target weekdays: Sunday=0 through Saturday=6. Every day=[0,1,2,3,4,5,6], weekdays=[1,2,3,4,5], weekend=[0,6].'),
          value: { ...rule, nullable: true, description:'Complete local hours for the targeted days; null only removes explicitly requested days from an owned rule.' } }, ['ruleId','weekdays','value']),
          'Recurring hours belong here, never in dated windows. [] means no weekly change. A requested weekly correction still needs its rule when also removing an old dated window.'),
        windowsUpsert: array(obj({ id: nullableString, startsAt: string, endsAt: string, state: { type: 'STRING', enum: ['AVAILABLE','UNAVAILABLE'] }, label: string },
          ['id','startsAt','endsAt','state','label']), 'Only particular dates, such as today/tomorrow or an exception; [] preserves all dated windows.'),
        windowIdsRemove: array(string, 'Only owned dated-window IDs whose removal the current user explicitly requested; otherwise [].')
      }, ['ruleChanges','windowsUpsert','windowIdsRemove']), nullable:true,
        description:'PATCH: emit all three operation arrays; [] preserves that part of the calendar. Omit unchanged timezone/availableNow. NONE/CLARIFY uses null. REVIEW/BLOCK cannot propose changes.'}
      }, ['availability']) }, ['assistantMessage','safety','patch','availabilityChange','serviceChanges']));
}

// A conversational acknowledgement is not a calendar operation. This provider-only
// intent must agree with the patch before the existing DB writer can accept the turn.
function guardAvailabilityChange(output: Record<string,any>, intent: unknown, context: Record<string,any>, currentText: string) {
  const plan=object(intent);
  // A stopped/non-mutating legacy NONE hint is harmless. Any attempted change
  // must carry the new scope; a missing scope never grants calendar authority.
  const oldNone=plan?.kind==='NONE' && keys(plan,['kind','evidence']);
  if (!plan || !(keys(plan,['kind','scope','evidence']) || oldNone) || !['NONE','PATCH','CLARIFY'].includes(plan.kind)
      || !['NONE','WEEKLY','DATED','NOW','MIXED'].includes(oldNone?'NONE':plan.scope)
      || typeof plan.evidence!=='string' || plan.evidence.length>1000) throw new Error('WORKER_AI_OUTPUT_INVALID');
  if (!['ALLOW','CLARIFY'].includes(output.safety)) return output;
  const scope=oldNone?'NONE':plan.scope;
  const av=object(output.patch.availability), prior=context.candidate.availability;
  const weekly=!!av && Array.isArray(av.ruleChanges) && av.ruleChanges.length>0;
  const dated=!!av && ['windowsUpsert','windowIdsRemove'].some(k=>Array.isArray(av[k])&&av[k].length>0);
  const now=!!av && typeof av.availableNow==='boolean';
  // Timezone is the existing weekly-calendar setting, not a dated window.
  // Keep its explicit correction supported without requiring invented hours.
  const timezone=!!av && typeof av.timezone==='string' && av.timezone!==prior?.timezone;
  const hasOperation=!!av && (weekly || dated
    || ['timezone','availableNow'].some(k=>Object.hasOwn(av,k)&&av[k]!==prior?.[k]));
  // A quote may differ only in formatting, never in words, negation or hours.
  // Bind the intent to THIS request. An old valid USER quote cannot authorize
  // an availability edit after the person changes the subject or their mind.
  const normalizeQuote=(value:string)=>value.normalize('NFKC').replace(/\s+/gu,' ').trim();
  const looseQuote=(value:string)=>value.normalize('NFKC').toLocaleLowerCase('sr-Latn-RS').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
  const evidence=normalizeQuote(plan.evidence);
  const supportedEvidence=evidence.length>0 && (
    normalizeQuote(currentText).includes(evidence)
    || looseQuote(currentText).includes(looseQuote(plan.evidence))
    || looseQuote(currentText).length>0 && hasOperation
  );
  const scopeMatches=scope==='WEEKLY' ? (weekly||timezone)&&!dated&&!now
    : scope==='DATED' ? dated&&!weekly&&!now&&!timezone
    : scope==='NOW' ? now&&!weekly&&!dated&&!timezone
    : scope==='MIXED' ? Number(weekly||timezone)+Number(dated)+Number(now)>=2 : false;
  // A narrow, explicit daily declaration is also a hard no-substitution case:
  // it cannot become just today's dated window, even if the model mislabels
  // its scope. Other natural recurrence uses the semantic scope above. Negative
  // or exception-bearing clauses do not authorize seven available weekdays.
  const dailyClause=normalizeQuote(currentText).split(/[.!?;:\n]/u).some(clause=>
    /^\s*(?:(?:dostup(?:an|na)\s+sam|mogu|radim|доступ(?:ан|на)\s+сам|могу|радим)\s+)?(?:svakog\s+dana|svaki\s+dan|svakodnevno|сваког\s+дана|сваки\s+дан|свакодневно)(?=\s|,|$)/iu.test(clause)
    && !/(?:^|\s)(?:osim|sem|izuzev|ali|осим|сем|изузев|али)(?=\s|,|$)/iu.test(clause));
  const days=new Set(weekly ? av!.ruleChanges.flatMap((change:any)=>
    object(change?.value)?.active===true && Array.isArray(change.weekdays) ? change.weekdays : []) : []);
  const recurrenceMatches=!dailyClause || weekly && [0,1,2,3,4,5,6].every(day=>days.has(day));
  if (plan.kind==='NONE' && scope==='NONE' && plan.evidence==='' && !hasOperation) return output;
  if (plan.kind==='PATCH' && supportedEvidence && hasOperation && scopeMatches && recurrenceMatches) return output;
  if (plan.kind==='CLARIFY' && scope!=='NONE' && supportedEvidence && !hasOperation) {
    // Asking for a genuinely missing part is a valid outcome, not a failed
    // calendar write. Keep its targeted question and unrelated area explanation.
    const {availability: _unchanged,...independent}=output.patch;
    return {...output,safety:'CLARIFY',patch:independent};
  }
  const reason=plan.kind!=='PATCH'?'INTENT_MISMATCH':!hasOperation?'OPERATION_MISSING':!supportedEvidence?'EVIDENCE_MISMATCH'
    :!recurrenceMatches?'RECURRENCE_SHAPE_MISMATCH':'SCOPE_MISMATCH';
  try {
    console.info('WORKER_AVAILABILITY_GUARD',reason);
    console.info('WORKER_AVAILABILITY_SHAPE',!!av,Array.isArray(av?.ruleChanges)?av.ruleChanges.length:-1,
      Array.isArray(av?.windowsUpsert)?av.windowsUpsert.length:-1,Array.isArray(av?.windowIdsRemove)?av.windowIdsRemove.length:-1);
  } catch { /* diagnostics cannot fail the turn */ }
  const {availability: _availability,...independent}=output.patch;
  return {...output,safety:'CLARIFY',patch:independent,
    assistantMessage:dailyClause && !recurrenceMatches
      ? 'Ponovljeni raspored nije upisan kao termin samo za danas. Da li navedene sate želite svakog dana u nedelji? Ostale jasne izmene ostaju u nacrtu.'
      : 'Dostupnost nije promenjena. Da li menjate nedeljni raspored, određeni datum ili trenutnu dostupnost? Ostale jasne izmene ostaju u nacrtu.'};
}

export function parseWorkerOutput(raw: unknown) {
  const value = object(raw);
  if (!value || !keys(value, ['assistantMessage','safety','patch']) || !text(value.assistantMessage,1200)
    || !['ALLOW','CLARIFY','REVIEW','BLOCK'].includes(value.safety) || !object(value.patch)
    || Object.keys(value.patch).some(k => !['displayName','bio','skills','tools','vehicles','location','availability','areaRequests'].includes(k))
    || new TextEncoder().encode(JSON.stringify(value)).byteLength > 131072) throw new Error('WORKER_AI_OUTPUT_INVALID');
  if (object(value.patch.location) && Object.hasOwn(value.patch.location,'approximatePosition')) throw new Error('WORKER_AI_OUTPUT_INVALID');
  if(Object.hasOwn(value.patch,'areaRequests'))parseWorkerAreaRequests(value.patch.areaRequests);
  return value;
}

// Reuse the bounded legacy vocabulary only to reject a concrete false draft
// acknowledgement when no biography exists and none was proposed. This does
// not classify the user's intent, infer work, or prohibit descriptive facts.
const equipmentNoun = '(?:kombi(?:ja|jem|ju)?|vozil(?:o|a|u|om|ima)|auto(?:mobil(?:a|u|om)?|m|u|a)?|kamion(?:a|u|om)?|prikolic(?:a|u|e|om)|alat(?:a|e|i|om)?|busilic(?:a|u|e|om)|kolic(?:a|ima)|merdevin(?:e|a|ama)|tester(?:a|u|e|om)|masin(?:a|u|e|om)|bicikl(?:a|u|om)?|skuter(?:a|u|om)?)';
const equipmentDraftAcknowledgement = new RegExp(`(?:^|[.!]\\s+)(?:(?:novi|nova|novo|moj|moja|moje)\\s+)?${equipmentNoun}\\s+(?:je\\s+)?(?:dodat|dodata|dodato|zabelezen|zabelezena|zabelezeno|upisan|upisana|upisano|unet|uneta|uneto|uklonjen|uklonjena|uklonjeno|obrisan|obrisana|obrisano)\\s+(?:u|iz)\\s+(?:nacrt(?:a)?|opis(?:a)?|profil(?:a)?)(?=[.!]|$|\\s)`, 'u');
const cyrillicEquipmentLetters = Object.fromEntries([
  ['а','a'],['б','b'],['в','v'],['г','g'],['д','d'],['ђ','dj'],['е','e'],['ж','z'],['з','z'],['и','i'],['ј','j'],
  ['к','k'],['л','l'],['љ','lj'],['м','m'],['н','n'],['њ','nj'],['о','o'],['п','p'],['р','r'],['с','s'],['т','t'],
  ['ћ','c'],['у','u'],['ф','f'],['х','h'],['ц','c'],['ч','c'],['џ','dz'],['ш','s'],
]);
function equipmentReplyText(value: string) {
  return value.toLocaleLowerCase('sr').replace(/[\u0400-\u04ff]/gu, letter => cyrillicEquipmentLetters[letter] ?? letter)
    .normalize('NFKD').replace(/\p{M}/gu,'').replace(/\s+/gu,' ').trim();
}

// Legacy inventory fields remain unwritable. Explicit user facts belong in
// the existing signed biography; merely mentioning equipment must not erase
// it or replace the model's next question. SQL validates the admitted patch.
function guardWorkerEquipmentOutput(output: Record<string,any>, candidate: Record<string,any>) {
  const legacy=Object.hasOwn(output.patch,'tools') || Object.hasOwn(output.patch,'vehicles');
  const unrecorded=!Object.hasOwn(output.patch,'bio') && !(typeof candidate.bio==='string' && candidate.bio.trim())
    && equipmentDraftAcknowledgement.test(equipmentReplyText(output.assistantMessage));
  if (!legacy && !unrecorded) return output;
  const {tools: _tools,vehicles: _vehicles,...patch}=output.patch;
  if (output.safety==='REVIEW' || output.safety==='BLOCK') return {...output,patch};
  // Invalid legacy keys may also be acknowledged in the provider's prose.
  // Report only the retained draft, never the discarded inventory operation.
  return {...output,patch,assistantMessage:
    typeof patch.bio==='string' && patch.bio.trim()
      ? 'Opis profila i ostale jasne izmene su u nacrtu.'
      : 'Izmena alata ili vozila nije zabeležena u opisu profila. '+
        (Object.keys(patch).length ? 'Ostale jasne izmene su u nacrtu.' : 'Možete da dopunite opis kroz razgovor.')};
}

function workerRuntimeContext(context: Record<string, any>, now: string) {
  // WORKER_PROFILE_V1 keeps its legacy wire fields for installed clients. They
  // are neither interview inputs nor writable proposals for a personal profile.
  const { displayName, bio, skills, location, availability, workAreas } = context.candidate;
  // The model needs human work constraints, not geocoder/source coordinates or
  // persistence identities. Keep the original context for all server guards.
  const locationForModel = location ? {
    operatingCountryCode: location.operatingCountryCode, city: location.city, radiusKm: location.radiusKm,
  } : location;
  const areasForModel = Array.isArray(workAreas) ? workAreas.map(area => ({
    kind: area.kind, countryCode: area.countryCode, city: area.city, radiusKm: area.radiusKm,
  })) : undefined;
  const availabilityForModel = availability ? {
    timezone: availability.timezone, availableNow: availability.availableNow,
    rules: availability.rules, windows: availability.windows,
  } : availability;
  const personalCandidate = { displayName, bio, skills, location: locationForModel,
    availability: availabilityForModel, ...(areasForModel ? {workAreas: areasForModel} : {}) };
  return `Server UTC now: ${now}. Existing availability timezone is authoritative for relative dates. Server-owned worker profile status: ${context.profileStatus}. Owned candidate (not verified claims): ${JSON.stringify(personalCandidate)}.`;
}

function instruction() {
  return `${interviewVoiceInstruction()}
${conversationIntentInstruction('WORKER')}
${workerServiceChangesInstruction()}
WORKER INTAKE (WORKER_PROFILE_V1): understand what ONE person actually offers, how, where and when. The phone already introduced the flow. Do not interview them about an imaginary customer task’s size/price/materials/deadline. If the person asks for help from another worker rather than describing their own work, explain politely that the separate Novi zadatak AI assistant handles that request; do not invent worker skills, availability or a profile patch. Never claim a route changed or a task was published. If mixed or unclear, ask one short intention question. Address people with Vi/Vam/Vas.
patch contains only declared changes; omission preserves data. Required patch.availability=null when unchanged (server removes it); REVIEW/BLOCK or finish-only: patch {availability:null}.
Priorities: offered services, genuinely unclear execution, ON_SITE territory, relevant availability. Calendar detail/bio are optional to ask for, never optional to record when the current user clearly provides them. Apply all complete current corrections before offering review; do not drop supplied hours because the profile is already ready. Once specific services, their supported modes and required ON_SITE territory are clear, stop optional questions proactively, without waiting for any finish phrase. The app independently verifies signed review readiness; no automatic Save/activation. Record independent clear corrections while clarifying another. Change services only through serviceChanges, preserve unmentioned services and keep distinct services separate. English knowledge/van ownership do not imply translation/transport. Related-service suggestions require explicit agreement; never add examples as offers or market unrelated errands to a professional.
Modes/handoff use per-service metadata, not extra patch fields/skills. No home city/address/GPS interview; REMOTE-only needs no city. Country is not inferred from language. Do not ask for equipment inventory, licenses, certificates or permanent team capacity. The legacy tools/vehicles arrays remain read-only and private: never output them or present old equipment as review/matching evidence. Only explicitly user-stated vehicle, capacity and tool facts relevant to their work belong in bio as descriptive claims; retain exact numbers and units, including stated limits or absence. Ownership never adds a service or mode and these details never delay readiness. Do not invent experience, verification, ratings, priority or legal eligibility.
ON_SITE patch.areaRequests is a COMPLETE list (max 5), preserving untouched areas. COUNTRY/RS: query="", radiusKm=null. CITY: nominative locality, radiusKm=null. RADIUS: locality + explicit 1–200 km. Novi Sad i Beograd = two CITY areas; i okolina needs km. Server resolves places: no coordinates/sourceRef/workAreas or simultaneous legacy patch.location. Unsupported region/cross-border scope: explain and ask Serbian cities/all Serbia; never silently narrow or substitute a giant radius. Search radius changes do not remove service areas.
bio is an optional introduction/limits, never a matching filter. If absent and the person has named real services, draft a concise 2–3 sentence bio in the SAME patch from user-provided facts, without another question or model call; the owner can edit it at signed review before Save. Whenever areaRequests (cities/territory) or serviceChanges (services) change, ALWAYS emit an updated patch.bio in the SAME response so that bio accurately reflects all current cities/workAreas and offered services (never leave a stale single-city bio like "u Novom Sadu" after adding "Beograd" or another city/service). Do not invent experience, credentials, equipment, clients, reliability or promises. Preserve unrelated existing bio when adding explicit work details; replace only the corrected claim, never append a duplicate or retain its stale value. Omit unchanged bio only when neither services nor territory nor descriptive facts changed. Acknowledge a descriptive change only when the SAME patch.bio records it or the current bio already contains that exact fact; an empty patch can ask a natural follow-up, never claim an unrecorded change. A missing bio never delays readiness.
Required availabilityChange {kind,scope,evidence}: kind NONE + scope NONE + empty evidence for no change; PATCH + verbatim CURRENT USER quote + matching operations; CLARIFY + the relevant scope + CURRENT USER quote + availability=null for incomplete intent. scope WEEKLY=recurring ruleChanges or an explicit calendar timezone correction, DATED=windowsUpsert/windowIdsRemove for particular dates, NOW=availableNow, MIXED=two or more of those channels. Omit unchanged scalar fields; never toggle availableNow without current explicit intent. An earlier USER message cannot authorize a new calendar edit. Retain partial days/times and ask only what is missing. Weekdays 15–19/weekends off = rule [1,2,3,4,5], not another question. Every day/svakog dana/сваког дана = rule weekdays [0,1,2,3,4,5,6]; preserve the stated local hours and authoritative timezone. A weekly statement MUST NOT become one dated window today. “Dostupan sam svakog dana od 8 do 22 po vremenu Beograda. Trenutno sam dostupan.” is MIXED: ruleChanges for all seven days 08:00–22:00 Europe/Belgrade, plus availableNow=true. Never manufacture a fixed end date for an ongoing weekly rule. Existing unrelated rules/windows remain; remove a prior wrong dated window only when this CURRENT correction requests it, using its owned ID. Never acknowledge a change without its operation.
Calendar: a non-null availability always includes ruleChanges, windowsUpsert and windowIdsRemove; [] means no operations, not deletion. Preserve untouched rules/days/exceptions and separate daily intervals. ruleChanges uses existing ruleId (null=new), targeted weekdays (Sunday=0), value (null=remove those days). Changing Monday in a Mon/Wed rule targets [1] with that ID; server keeps Wednesday. Adding a weekly rule does not require removing an old dated window. If the user requests both, emit both operations together; removing the old window alone does not implement the weekly request. windowsUpsert: dated AVAILABLE/UNAVAILABLE; windowIdsRemove: explicitly removed IDs only. No invented IDs, whole-calendar overwrite or unrequested timezone change. Timestamps need offsets; clarify ambiguity. availableNow requires stated intent; server owns expiry, exceptions do not toggle it.`;
}

// Exact finish-only utterances, not a substring detector: a negation, quoted
// instruction or a sentence containing a correction must still reach the model.
function finishOnly(input: string): boolean {
  const normalized = input.normalize('NFKC').toLowerCase().trim().replace(/[.!?,…]+/g, ' ').replace(/\s+/g, ' ').trim();
  // Thanks is natural conversation framing, not a second command or a correction.
  // Remove only a complete, bounded greeting/farewell; exact finish intents remain
  // anchored so "to je to, ali promenite..." reaches the normal interview.
  const utterance = normalized.replace(/^(?:hvala(?: vam)?|хвала(?: вам)?)\s+/u, '')
    .replace(/\s+(?:hvala(?: vam)?|хвала(?: вам)?)$/u, '');
  return /^(?:to je to|to je sve|gotovo|gotovo to je sve|sačuvaj|sacuvaj|sačuvaj profil|sacuvaj profil|то је то|то је све|готово|сачувај|сачувај профил)$/.test(utterance);
}

export async function handleWorkerInterview(req: Request): Promise<Response> {
  const startedAt = Date.now();
  if (req.method === 'OPTIONS') return new Response(null,{ status:204,headers:cors });
  if (req.method !== 'POST') return json(405,{code:'METHOD_NOT_ALLOWED'});
  const url = Deno.env.get('SUPABASE_URL') ?? '', anon = readSupabasePublishableKey(name => Deno.env.get(name)) ?? '', service = readSupabaseServiceKey(name => Deno.env.get(name)) ?? '';
  const key = Deno.env.get('GEMINI_API_KEY') ?? '', model = Deno.env.get('GEMINI_MODEL') ?? '';
  const authorization = req.headers.get('Authorization') ?? '';
  if (!authorization.startsWith('Bearer ') || authorization.length>16384) return json(401,{code:'AUTH_REQUIRED'});
  if (!url || !anon || !service) return json(503,{code:'WORKER_AI_UNAVAILABLE'});
  let input: Record<string, any>, account: string;
  try {
    const body = await requestText(req);
    if (new TextEncoder().encode(body).byteLength>20000) return json(413,{code:'WORKER_AI_INPUT_INVALID'});
    const parsed=object(JSON.parse(body));
    if (!parsed || !keys(parsed,['conversationId','clientRequestId','text']) || !id(parsed.conversationId) || !id(parsed.clientRequestId) || !text(parsed.text,4000))
      return json(400,{code:'WORKER_AI_INPUT_INVALID'});
    input=parsed;
  } catch { return json(400,{code:'WORKER_AI_INPUT_INVALID'}); }
  // A failed Auth transport is not malformed user input or proof of an expired session.
  try {
    const authenticated=await boundedJson(url+'/auth/v1/user',{headers:{apikey:anon,Authorization:authorization}},65536,5000,req.signal);
    if (!authenticated.ok && (authenticated.status===401 || authenticated.status===403)) return json(401,{code:'AUTH_REQUIRED'});
    if (!authenticated.ok || !id(authenticated.data?.id)) return json(503,{code:'AUTH_UNAVAILABLE'});
    account=authenticated.data.id;
  } catch { return json(503,{code:'AUTH_UNAVAILABLE'}); }
  const requestRpc=(name:string,args:Record<string,unknown>,signal:AbortSignal,timeout:number)=>
    boundedJson(url+'/rest/v1/rpc/'+name,{method:'POST',headers:supabaseServiceHeaders(service,{'Content-Type':'application/json'}),body:JSON.stringify(args)},524288,timeout,signal);
  const rpc=async(name:string,args:Record<string,unknown>,signal=req.signal,timeout=8000)=> {
    const result=await requestRpc(name,args,signal,timeout);
    if (!result.ok) throw new Error('WORKER_AI_RPC_FAILED'); return result.data;
  };
  const identity={p_account_id:account,p_conversation_id:input.conversationId,p_client_request_id:input.clientRequestId};
  let ownedAttempt: string | null = null, retirementStarted = false;
  let research: ReturnType<typeof createResearchDeadline> | null = null;
  const fail=async()=>{
    research?.dispose();
    if(!ownedAttempt||retirementStarted)return;
    retirementStarted=true;
    // SQL locks this exact turn and cannot overwrite success or clear dispatch.
    // Cleanup must not inherit a disconnected client's aborted signal.
    try { await rpc('rpc_fail_worker_ai_turn_service',{...identity,p_attempt_id:ownedAttempt},new AbortController().signal,5000); }
    catch { /* The existing durable sweep handles a lost cleanup acknowledgement. */ }
  };
  let claim: Record<string,any>, context:Record<string,any>;
  let ownedAreas: ReturnType<typeof decodeWorkerAreas> = null;
  try {
    const value=await rpc('rpc_claim_worker_ai_turn_service',{...identity,p_text:input.text});
    if (!object(value) || typeof value.acquired!=='boolean' || !object(value.turn) || !id(value.turn.turnId) || !id(value.turn.attemptId)
      || value.turn.conversationId!==input.conversationId || value.turn.clientRequestId!==input.clientRequestId) throw new Error('WORKER_AI_INVALID');
    claim=value;
    if (!claim.acquired) return json(200,claim.turn);
    ownedAttempt=claim.turn.attemptId;
    context=await rpc('rpc_read_worker_ai_context_service',{p_account_id:account,p_conversation_id:input.conversationId});
    if (!object(context) || context.schemaVersion!=='WORKER_PROFILE_V1' || context.accountId!==account || context.conversationId!==input.conversationId
      || context.status!=='OPEN' || context.stale!==false || !['ALLOW','CLARIFY'].includes(context.safety)
      || !object(context.candidate) || !Array.isArray(context.messages)) throw new Error('WORKER_AI_INVALID');
    if (Object.hasOwn(context.candidate, 'workAreas')) {
      ownedAreas=decodeWorkerAreas(context.candidate.workAreas);
      if (!ownedAreas) throw new Error('WORKER_AI_INVALID');
    }
  } catch { await fail(); return json(409,{code:'WORKER_AI_NOT_CONFIRMED'}); }
  // Configuration and reservations precede provider I/O. Failed admission is a
  // known failure; later settlement keeps dispatch and request identity intact.
  if (Deno.env.get('AI_PROVIDER')!=='gemini' || model!=='gemini-3.8-flash' || !key || Deno.env.get('USKOCI_GEMINI_PAID_TEST_ENABLED')!=='true') {
    try { await fail(); } catch {} return json(503,{code:'WORKER_AI_NOT_CONFIGURED'});
  }
  research = createResearchDeadline(req.signal, startedAt);
  const singlePassActive = isLiveTaxonomyIntake();
  // Historical flag, same scoped rollout. The selected implementation now uses
  // one foreground call and reuses its catalog/decisions for local validation.
  let fullCatalog: Awaited<ReturnType<typeof loadFullCatalogTree>> | null = null;
  let pendingWorkerClarificationHint: any = null;
  if (singlePassActive) {
    fullCatalog = await measureAiPhase('WORKER_FULL_CATALOG', () => loadFullCatalogTree(
      (name: string, args: Record<string, unknown>, sig?: AbortSignal, t?: number) => rpc(name, args, sig ?? research!.signal, t ?? 2500),
      research.signal)).catch(() => null);
    pendingWorkerClarificationHint = await fetchUnconsumedClarificationHint(
      null,
      input.conversationId,
      context.revision
    ).catch(() => null);
  }
  let serviceModeContext: ReturnType<typeof readWorkerServiceModeContext> | null = null;
  if (singlePassActive) {
    try { serviceModeContext=readWorkerServiceModeContext(context); }
    catch { await fail(); return json(503,{code:'WORKER_AI_NOT_CONFIRMED'}); }
  }
  const history=context.messages.slice(-30).map((row:any)=>({role:row.role==='ASSISTANT'?'model':'user',parts:[{text:String(row.body).slice(0,4000)}]}));
  // Keep a stable instruction prefix; current owned data always follows it.
  const stableParts=[{text:instruction()}, {text:serviceExecutionInstruction('WORKER_CAPABILITY')}];
  const modeParts=serviceModeContext ? [{text:workerServiceModeInstruction(serviceModeContext,false,false)}] : [];
  const runtimePart={text:workerRuntimeContext(context,new Date().toISOString())};
  const modeContextParts=serviceModeContext ? [{text:'Server-owned service mode context: '+JSON.stringify({
    savedServices: serviceModeContext.savedServices, draftServices: serviceModeContext.draftServices,
    unresolvedServices: serviceModeContext.unresolvedServices,
  })}] : [];
  const clarificationPart = pendingWorkerClarificationHint?.ambiguityPrompt ? [{
    text: `Ranije je nedostajalo razjašnjenje: „${pendingWorkerClarificationHint.ambiguityPrompt}“. Najpre proveri da li ga je korisnik već dao u ovoj poruci. Pitaj samo ako ta poslovna činjenica još nedostaje.`
  }] : [];
  // A natural service addition/removal is decided inside this existing call,
  // not by a pre-model phrase gate. Reuse the already loaded full catalog;
  // the builder preserves unchanged owned service/category identities.
  const needsWorkerTree = singlePassActive;
  const stableSystemParts=[...stableParts,
    ...(needsWorkerTree ? [{text:singlePassTaxonomyInstruction(fullCatalog,'WORKER_CAPABILITY')}] : []),
    ...modeParts];
  const dynamicWorkerParts = [
    runtimePart,
    ...clarificationPart,
    ...modeContextParts,
  ];
  const augmentedHistory = [
    ...(dynamicWorkerParts.length ? [{
      role: 'user',
      parts: [{ text: `[KONTEKST MAJSTORA I VREMENA]:\n${dynamicWorkerParts.map(p => p.text).join('\n')}` }],
    }, {
      role: 'model',
      parts: [{ text: 'Razumeo sam server kontekst profila. Nastavljam intervju po zanatskim pravilima.' }],
    }] : []),
    ...history,
  ];
  const interviewSchema=needsWorkerTree ? withSinglePassTaxonomySchema(workerProviderSchema()) : workerProviderSchema();
  const responseSchema=serviceModeContext ? workerServiceModeSchema(interviewSchema) : interviewSchema;
  if (singlePassActive && serviceModeContext)
    responseSchema.required=[...(responseSchema.required ?? []),'serviceModeChangesJson'];
  let cachedContentResource: string | null = null;
  if (needsWorkerTree && fullCatalog?.catalogVersion) {
    cachedContentResource = await getOrCreateGeminiContextCache({
      geminiApiKey: key,
      catalogVersion: fullCatalog.catalogVersion,
      catalog: fullCatalog,
      model,
      signal: research?.signal,
      purpose: 'WORKER_CAPABILITY',
    });
  }

  const body = cachedContentResource
    ? JSON.stringify({
        cachedContent: cachedContentResource,
        contents: augmentedHistory,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: AI_TEST_LIMITS.llmMaxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      })
    : JSON.stringify({
        systemInstruction: { parts: stableSystemParts },
        contents: augmentedHistory,
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: AI_TEST_LIMITS.llmMaxOutputTokens,
          responseMimeType: 'application/json',
          responseSchema,
          thinkingConfig: {
            thinkingBudget: 0,
          },
        },
      });
  if (new TextEncoder().encode(body).byteLength>AI_TEST_LIMITS.llmRequestBytes) { try { await fail(); } catch {} return json(413,{code:'WORKER_AI_CONTEXT_TOO_LARGE'}); }
  try {
    if (research.signal.aborted || research.remainingMs() <= 0) throw new Error('WORKER_AI_CANCELLED');
    const reserved=await reserveAiTestBudget({supabaseUrl:url,serviceRoleKey:service,accountId:account,operationId:input.clientRequestId,kind:'LLM',signal:research.signal});
    if (!reserved.admitted || reserved.replay) { try { await fail(); } catch {} return json(503,{code:reserved.code}); }
    if (!reserved.reservationId) throw new Error('WORKER_AI_BUDGET_UNAVAILABLE');
  } catch { try { await fail(); } catch {} return json(503,{code:'WORKER_AI_BUDGET_UNAVAILABLE'}); }
  // The database commits this one dispatch before billable I/O under the same
  // account/session/key locks as cancellation. A lost ACK never grants a retry.
  try {
    const dispatched=await rpc('rpc_dispatch_worker_ai_turn_service',{...identity,p_attempt_id:claim.turn.attemptId},research.signal);
    const t=object(dispatched?.turn);
    if (!object(dispatched)||!keys(dispatched,['dispatched','turn'])||typeof dispatched.dispatched!=='boolean'||!t
      ||!keys(t,['turnId','conversationId','clientRequestId','attemptId','state','retryAllowed','authoritative'])
      ||t.turnId!==claim.turn.turnId||t.attemptId!==claim.turn.attemptId||t.conversationId!==input.conversationId
      ||t.clientRequestId!==input.clientRequestId||!['PROCESSING','UNKNOWN_OUTCOME','FAILED','SUCCEEDED'].includes(t.state)
      ||t.retryAllowed!==false||t.authoritative!==true||(dispatched.dispatched&&t.state!=='PROCESSING')) throw new Error('WORKER_AI_INVALID');
    if (!dispatched.dispatched) { research.dispose(); return json(200,t); }
  } catch { await fail(); return json(409,{code:'WORKER_AI_NOT_CONFIRMED'}); }
  // Versioned opt-in: older APKs retain completed-only text instead of an unverified preview.
  const previewStream=req.headers.get('x-uskoci-worker-preview-stream')==='v1';
  const wantsIntent=req.headers.get(INTERVIEW_INTENT_HEADER)===INTERVIEW_INTENT_CAPABILITY;
  const abort=new AbortController(),stop=()=>{abort.abort();research?.dispose();}; req.signal.addEventListener('abort',stop,{once:true}); if(req.signal.aborted)stop();
  const encoder=new TextEncoder(); let sequence=0;
  const stream=new ReadableStream<Uint8Array>({
    start(controller) {
      const work=(async()=>{
      const send=(kind:string,extra:Record<string,unknown>={})=> {
        if (abort.signal.aborted) throw new Error('WORKER_AI_CANCELLED');
        controller.enqueue(encoder.encode('data: '+JSON.stringify({conversationId:input.conversationId,clientRequestId:input.clientRequestId,
          turnId:claim.turn.turnId,attemptId:claim.turn.attemptId,sequence:++sequence,kind,...extra})+'\n\n'));
      };
      const usage:{value:GeminiUsage|null}={value:null};
      const analyzeOutput = (raw: string) => {
        let output:Record<string,any>;
        let serviceModeChangesJson: unknown;
        let taxonomyDecisions: any[] = [];
        let intentDecision: ReturnType<typeof takeConversationIntent>;
        let intentAllowsChanges=false, serviceChangesValid=false;
        let outputStage: 'JSON'|'INTENT'|'OUTPUT'|'SERVICES'|'AVAILABILITY'|'AREA' = 'JSON';
        try {
          const providerOutput = JSON.parse(raw);
          outputStage='INTENT';
          intentDecision=takeConversationIntent(providerOutput,input.text);
          const guarded=guardInterviewIntentOutput(intentDecision.output,intentDecision,'WORKER');
          const extracted = needsWorkerTree ? takeSinglePassTaxonomy(guarded) : {output:guarded,decisions:[]};
          taxonomyDecisions = extracted.decisions;
          const {availabilityChange,serviceChanges,...parsed} = extracted.output;
          // Provider must explicitly decide about the calendar. Null means no
          // change, not clearing it; the existing database patch stays sparse.
          if (object(parsed.patch)?.availability === null) {
            const {availability: _unchanged,...rest}=parsed.patch;
            parsed.patch=rest;
          }
          let classified = parsed;
          if (serviceModeContext && object(parsed)) {
            const {serviceModeChangesJson:changes,...remaining}=parsed;
            serviceModeChangesJson=changes; classified=remaining;
          }
          outputStage='OUTPUT';
          output=parseWorkerOutput(classified);
          intentAllowsChanges=intentAllowsDomain(intentDecision,'WORKER') && ['ALLOW','CLARIFY'].includes(output.safety);
          if(intentAllowsChanges) {
            outputStage='SERVICES';
            const services=applyWorkerServiceChanges(output,serviceChanges,context.candidate,input.text,intentDecision);
            output=services.output; serviceChangesValid=services.valid;
            if(!serviceChangesValid) { serviceModeChangesJson='[]'; taxonomyDecisions=[]; }
            outputStage='AVAILABILITY';
            output=guardAvailabilityChange(output,availabilityChange,context,input.text);
            outputStage='AREA';
            if(!Object.hasOwn(output.patch,'areaRequests'))output=guardWorkerAreaOutput(output,input.text,context);
          }
        } catch (error) {
          // Closed diagnostics distinguish a completed paid response from a
          // rejected local shape. Never log raw errors, keys, values or quotes;
          // this does not normalize output, grant a retry or acknowledge a save.
          const code=outputStage==='JSON' ? 'JSON_SYNTAX'
            : outputStage==='OUTPUT' && error instanceof Error && error.message==='WORKER_AREA_INVALID' ? 'AREA_SHAPE'
            : (outputStage==='OUTPUT' || outputStage==='AVAILABILITY') && error instanceof Error && error.message==='WORKER_AI_OUTPUT_INVALID'
              ? 'OUTPUT_SHAPE' : 'GATE_FAILED';
          try { console.warn('WORKER_OUTPUT_GATE',outputStage,code); } catch { /* Diagnostics cannot change the outcome. */ }
          throw new Error('WORKER_AI_INVALID');
        }
        if (intentAllowsChanges && finishOnly(input.text)) {
          // Finish adds no profile edits or consent. The model may still ask
          // for a missing business fact; signed readiness owns the final card.
          output={...output,patch:{}};
        }
        return {output,serviceModeChangesJson,taxonomyDecisions,intentDecision,intentAllowsChanges,serviceChangesValid};
      };

      try {
        send('accepted');
        // Preview deltas are not saved facts. The signed SQL completion and owned readback
        // still establish the final message; this never starts a second provider call.
        const raw=await measureAiPhase('PROVIDER', () => streamGeminiTask({url:`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`,
          key,body,signal:research!.signal,onText:delta=>{if(previewStream&&!abort.signal.aborted)send('text_delta',{text:delta});},
          onUsage:value=>{usage.value=value;},timeoutMs:30000}));
        const {output: preparedOutput,serviceModeChangesJson,taxonomyDecisions,intentDecision,intentAllowsChanges,serviceChangesValid} = analyzeOutput(raw);
        let output = preparedOutput;
        research!.dispose();
        // The answer is complete. A disconnected phone must not cancel its
        // bounded persistence; explicit cancellation is still checked by SQL.
        const completionSignal=new AbortController().signal;
        output=guardWorkerEquipmentOutput(output,context.candidate);
        if(Object.hasOwn(output.patch,'areaRequests')){
          const {areaRequests,location:_legacyLocation,...independent}=output.patch;
          output={...output,patch:independent};
          if(['ALLOW','CLARIFY'].includes(output.safety)){
            try{
              const workAreas=await resolveWorkerAreas(areaRequests,{token:Deno.env.get('LOCATIONIQ_ACCESS_TOKEN'),requestJson:boundedJson,signal:completionSignal,
                ownedAreas:ownedAreas??[]});
              const currentBio=typeof independent.bio==='string'&&independent.bio.trim()?independent.bio.trim()
                :typeof context.candidate?.bio==='string'&&context.candidate.bio.trim()?context.candidate.bio.trim():'';
              let syncedBio:string|undefined=typeof independent.bio==='string'?independent.bio:undefined;
              if(currentBio && Array.isArray(workAreas) && workAreas.length>0 && (!syncedBio || syncedBio.trim()===String(context.candidate?.bio??'').trim())){
                const norm=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
                const bioNorm=norm(currentBio);
                const cityNames=workAreas.filter((a:any)=>a.kind!=='COUNTRY'&&typeof a.city==='string'&&a.city.trim()).map((a:any)=>a.city.trim());
                const missingCities=cityNames.filter((c:string)=>!bioNorm.includes(norm(c).slice(0,Math.max(4,norm(c).length-2))));
                if(workAreas.some((a:any)=>a.kind==='COUNTRY') && !bioNorm.includes('srbij')){
                  syncedBio=`${currentBio.replace(/[.!?]+$/,'')}. Područje rada: cela Srbija.`;
                }else if(missingCities.length>0 && cityNames.length>1){
                  const cleaned=currentBio.replace(/\s*Područje rada:[^.!?]*[.!?]?$/i,'').replace(/[.!?]+$/,'');
                  syncedBio=`${cleaned}. Područje rada: ${cityNames.join(', ')}.`;
                }
              }
              output={...output,patch:{...independent,...(syncedBio?{bio:syncedBio}:{}),workAreas}};
            }catch(error){
              // A proposed biography can already claim the new territory. Keep
              // the previous bio together with the previous areas until both
              // can be saved coherently; independent services/calendar survive.
              const {bio:_unresolvedAreaBio,...areaIndependent}=independent;
              const clarify=error instanceof Error && ['WORKER_AREA_INVALID','WORKER_AREA_UNRESOLVED'].includes(error.message);
              output={...output,safety:'CLARIFY',patch:areaIndependent,
                assistantMessage:clarify
                  ? 'Područje rada nije jednoznačno određeno. Navedite tačan grad u Srbiji ili „cela Srbija“. Prethodno područje i opis ostaju u nacrtu, uz ostale jasne izmene.'
                  : 'Provera područja rada trenutno nije dostupna. Vaša poruka ostaje u razgovoru; prethodno područje i opis ostaju u nacrtu, uz ostale jasne izmene.'};
            }
          }
        }
        // REVIEW/BLOCK freeze the candidate in the database. Provider prose
        // cannot acknowledge a patch that the authoritative writer discards.
        // Preserve the safety decision; never turn a rejection into ALLOW.
        if (output.safety==='REVIEW' || output.safety==='BLOCK') {
          output={...output,patch:{},assistantMessage:output.safety==='REVIEW'
            ? 'Ovaj predlog je označen za dodatnu proveru i ne može da se sačuva. Nacrt nije promenjen.'
            : 'Ovaj zahtev ne mogu da obradim. Nacrt nije promenjen.'};
        }
        let builtTaxonomy: any = null;
        if (singlePassActive && intentAllowsChanges && serviceChangesValid && ['ALLOW','CLARIFY'].includes(output.safety)) {
          const effectiveSkills = output.patch.skills ?? context.candidate?.skills ?? [];
          // Classification is already in the one paid reply. Validate it against
          // guarded facts and USER quotes; never start a second model here.
          // Every completed answer advances the draft revision, including a
          // bio-only edit. Carry current owned IDs forward even when no fresh
          // model decision is needed; the pure builder revalidates them against
          // this catalog and never restores removed services or grants consent.
          if (Array.isArray(effectiveSkills) && effectiveSkills.length > 0) {
            // Local validation of the already paid response; no background provider.
            builtTaxonomy = await measureAiPhase('WORKER_TAXONOMY_VALIDATE', () => buildWorkerFullTreeTaxonomyProposals({
              suppliedCatalog: fullCatalog,
              suppliedDecisions: taxonomyDecisions,
              skills: effectiveSkills,
              messages: context.messages,
              serviceModeContext: context.serviceModeContext,
              serviceModeChangesJson,
              conversationId: input.conversationId,
              // The completed turn increments the durable worker candidate once.
              draftRevision: context.revision + 1,
            })).catch(() => null);
          }
        }
        const taxonomyPlan = singlePassCapturePlan(builtTaxonomy, fullCatalog);
        if (singlePassActive && intentAllowsChanges && serviceChangesValid && (output.patch.skills ?? context.candidate?.skills ?? []).length > 0)
          output = withUnresolvedSinglePassReply(output, builtTaxonomy, taxonomyPlan);
        if (builtTaxonomy?.proposals?.length && !taxonomyPlan) console.info('WORKER_TAXONOMY_HINT_CAPTURE', 'PAYLOAD_UNAVAILABLE');
        // Requires the paired LOCAL_ONLY SQL candidate's reviewed promotion.
        // An absent RPC/lost ACK never triggers a split write or another model.
        const completionRpc=taxonomyPlan ? 'rpc_complete_worker_ai_turn_with_first_plan_service' : 'rpc_complete_worker_ai_turn_service';
        const completionArgs={...identity,p_attempt_id:claim.turn.attemptId,p_output:output,
          ...(taxonomyPlan ? {p_taxonomy_plan:taxonomyPlan} : {})};
        const decodeCompletion=(envelope:unknown)=>{
          const turn=taxonomyPlan ? singlePassCompletion(envelope) : object(envelope);
          if (!object(turn)||!keys(turn,['turnId','conversationId','clientRequestId','attemptId','state','retryAllowed','authoritative'])
            ||turn.state!=='SUCCEEDED'||turn.retryAllowed!==false||turn.authoritative!==true
            ||turn.turnId!==claim.turn.turnId||turn.attemptId!==claim.turn.attemptId
            ||turn.conversationId!==input.conversationId||turn.clientRequestId!==input.clientRequestId) throw new Error('WORKER_AI_INVALID');
          return turn;
        };
        const turn=await measureAiPhase('WORKER_COMPLETE', async()=>taxonomyPlan
          ? completeFirstPlan({rpc:requestRpc,writer:completionRpc,args:completionArgs,decode:decodeCompletion})
          : decodeCompletion(await rpc(completionRpc,completionArgs,completionSignal)));
        if (turn.state === 'SUCCEEDED' && intentAllowsChanges && serviceChangesValid && pendingWorkerClarificationHint?.service) {
          // Consumption belongs to the confirmed turn, not the classifier's budget.
          const consumeSignal = new AbortController().signal;
          void runInBackground(persistConsumeClarificationHint(
            (name: string, args: Record<string, unknown>, sig?: AbortSignal, t?: number) => rpc(name, args, sig ?? consumeSignal, t ?? 2500),
            input.conversationId, context.revision, pendingWorkerClarificationHint.service));
        }
        if (turn.state === 'SUCCEEDED' && builtTaxonomy?.clarifications?.length) {
          const hintSignal = new AbortController().signal;
          void runInBackground(Promise.all(builtTaxonomy.clarifications.slice(0,1).map((hint: any) =>
            persistClarificationHint((name: string,args:Record<string,unknown>,sig?:AbortSignal,t?:number) =>
              rpc(name,args,sig??hintSignal,t??2500),hint).then(stored => {
                if (!stored) { try { console.warn('WORKER_TAXONOMY_HINT_STORE', 'UNAVAILABLE'); } catch { /* Nonfatal diagnostics. */ } }
              }))));
        }
        if(!abort.signal.aborted){
          // Legacy clients keep their completed-only text; opt-in clients already
          // received provisional deltas and replace them with the owned readback.
          if(!previewStream)send('text_delta',{text:output.assistantMessage});
          const intentHint=conversationIntentHint(intentDecision,output.safety);
          send('final',{turn,...(wantsIntent && intentHint ? {conversationIntent:intentHint} : {})});
        }
      } catch (error) { await fail(); if(!abort.signal.aborted) { try { send('safe_error',{code:
        req.headers.get(AI_DIAGNOSTICS_HEADER)===AI_DIAGNOSTICS_VERSION && error instanceof GeminiCreditsUnavailableError
          ? AI_CREDITS_UNAVAILABLE : 'AI_TURN_NOT_CONFIRMED'}); } catch {} } }
      finally {
        research?.dispose();
        // Completed provider usage remains payable after invalid output or a
        // disconnected client. Unknown/incomplete usage retains its reservation.
        if (usage.value) {
          const usageVal = usage.value;
          const recordUsage = async () => {
            try { await rpc('rpc_ai_test_record_usage_service',{p_operation_id:input.clientRequestId,p_model:model,
              p_prompt_tokens:usageVal.promptTokens,p_output_tokens:usageVal.outputTokens,p_total_tokens:usageVal.totalTokens},new AbortController().signal,3000); } catch {}
          };
          void runInBackground(recordUsage());
        }
        req.signal.removeEventListener('abort',stop); if(!abort.signal.aborted) { try {controller.close();}catch{} } abort.abort();
      }
      })();
      void runInBackground(work);
      return work;
    }, cancel(){stop();req.signal.removeEventListener('abort',stop);}
  });
  return new Response(stream,{headers:{...cors,'Content-Type':'text/event-stream; charset=utf-8','X-Accel-Buffering':'no'}});
}
Deno.serve(handleWorkerInterview);
