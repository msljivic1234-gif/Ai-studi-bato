import { formatFullCatalogHierarchy } from './backgroundTaxonomyArchitect.mjs';

const actions = ['REUSE_EXISTING', 'EXTEND_MODE', 'CREATE_CHILD', 'CREATE_NEW_BRANCH', 'NEEDS_CLARIFICATION', 'AMBIGUOUS'];
const fields = ['service', 'mode', 'action', 'categoryId', 'parentId', 'proposedPath', 'ambiguityPrompt', 'reason'];
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuidOrEmpty = value => typeof value === 'string' && (value === '' || /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value));
const boundedText = (value, maximum) => typeof value === 'string' && value.length <= maximum && !/[<>\u0000-\u001f]/u.test(value);

// Provider-only metadata. The owned turn writer resolves it to catalog IDs;
// profile activation and task publication still require the business Save.
export function withSinglePassTaxonomySchema(schema) {
  return { ...schema, properties: { ...schema.properties, taxonomyDecisions: {
    type: 'ARRAY', maxItems: 24, items: { type: 'OBJECT', required: fields, properties: {
      service: { type: 'STRING' },
      mode: { type: 'STRING', enum: ['ON_SITE', 'REMOTE', 'UNKNOWN'] },
      action: { type: 'STRING', enum: actions },
      categoryId: { type: 'STRING' }, parentId: { type: 'STRING' },
      proposedPath: { type: 'ARRAY', maxItems: 12, items: { type: 'STRING' } },
      ambiguityPrompt: { type: 'STRING' }, reason: { type: 'STRING' },
    } },
  } }, required: [...(schema.required ?? []), 'taxonomyDecisions'] };
}

export function singlePassTaxonomyInstruction(catalog, purpose) {
  const rules = 'CLASSIFICATION in this response: private taxonomyDecisions only, never assistantMessage/title/description/bio. Server resolves catalog IDs at turn completion; that is not Publish/Save or proof of either write. '
    + 'Compare meanings across the WHOLE catalog: reuse equivalent work; create only when none fits. Similar names/parent alone do not prove equivalence (installation is not cleaning). Avoid duplicate branches and unnecessary levels. decision.service exactly matches effective need.category/offered skill after this reply’s corrections. Branch labels describe reusable services, without personal/contact/address/price/date data. '
    + 'REUSE_EXISTING: real leaf categoryId with requested mode. EXTEND_MODE: same leaf ID, missing requested mode. Both: parentId="", proposedPath=[]. CREATE_CHILD: deepest suitable real parentId, categoryId="", only missing labels ending in service (3–120 characters each). CREATE_NEW_BRANCH: empty IDs, complete new path ending in service. Never invent UUIDs. '
    + 'NEEDS_CLARIFICATION/AMBIGUOUS: only a real work distinction; ambiguityPrompt is the ONE plain-language question also asked in assistantMessage. Otherwise ambiguityPrompt="". Never turn a technical failure into a request to repeat known facts. reason is internal, 10–1000 characters. ';
  const scope = purpose === 'WORKER_CAPABILITY'
    ? 'One decision per offered service/mode; BOTH = ON_SITE + REMOTE with one ID/path. serviceModeChangesJson follows intended modes; preserve unchanged saved/draft IDs, including mode/handoff edits. Never restore removed services. UNKNOWN only for clarification. '
    : 'Classify one effective service using typed task_geography, not city alone. Handoff/location/time/price stay in facts, not taxonomy metadata. Unknown mode: ask about execution and return no decision. ';
  if (!catalog?.verifiedComplete) return rules + scope
    + 'Catalog unavailable: taxonomyDecisions=[]; keep useful facts, do not assume missing categories or promise classification readiness.';
  return rules + scope + `Complete server catalog, version ${catalog.catalogVersion}. Indented tree nodes: [categoryId LEAF MODES] label ~ aliases. Indentation defines the hierarchy. Use only these existing IDs:\n`
    + formatFullCatalogHierarchy(catalog);
}

export function takeSinglePassTaxonomy(value) {
  if (!record(value)) return { output: value, decisions: [] };
  const { taxonomyDecisions, ...output } = value;
  // A missing/malformed hint must not discard valid conversation facts or cause
  // another paid inference. Missing evidence remains unresolved for review.
  if (!Array.isArray(taxonomyDecisions) || taxonomyDecisions.length > 24
      || new TextEncoder().encode(JSON.stringify(taxonomyDecisions)).length > 49152)
    return { output, decisions: [] };
  const decisions = taxonomyDecisions.filter(item => record(item)
    && Object.keys(item).length === fields.length && fields.every(field => Object.hasOwn(item, field))
    && boundedText(item.service, 120) && item.service.trim().length >= 3
    && ['ON_SITE', 'REMOTE', 'UNKNOWN'].includes(item.mode) && actions.includes(item.action)
    && (item.mode !== 'UNKNOWN' || ['NEEDS_CLARIFICATION', 'AMBIGUOUS'].includes(item.action))
    && uuidOrEmpty(item.categoryId) && uuidOrEmpty(item.parentId)
    && Array.isArray(item.proposedPath) && item.proposedPath.length <= 12
    && item.proposedPath.every(label => boundedText(label, 120) && label.trim().length > 0)
    && boundedText(item.ambiguityPrompt, 500) && boundedText(item.reason, 1000) && item.reason.trim().length >= 10);
  // Do not turn conflicting duplicates into one accepted decision by filtering
  // out the malformed half. Keep useful facts; reject the incomplete metadata.
  return { output, decisions: decisions.length === taxonomyDecisions.length ? decisions : [] };
}

// Already validated model output only; no provider, retry, new authority or
// partial truncation. Leave room for jsonb overhead under the existing 18KB
// capture contract. Oversize metadata must not discard useful dialogue facts.
export function singlePassCapturePlan(built, catalog) {
  if (!Number.isSafeInteger(built?.catalogVersion) || built.catalogVersion < 1
      || !Array.isArray(built.proposals) || built.proposals.length < 1 || built.proposals.length > 24
      || catalog?.verifiedComplete !== true || catalog.catalogVersion !== built.catalogVersion
      || !Array.isArray(catalog.categories)) return null;
  // Anchors come from the server snapshot, never model-supplied labels. They
  // let SQL validate the referenced identities despite unrelated catalog edits.
  const anchors = [];
  const seen = new Set();
  for (const proposal of built.proposals) {
    let id = ['REUSE_EXISTING', 'EXTEND_MODE'].includes(proposal.action) ? proposal.categoryId
      : proposal.action === 'CREATE_CHILD' ? proposal.parentId : null;
    // Include ancestors so moving/renaming a branch during inference cannot
    // silently change the meaning of an otherwise unchanged leaf ID.
    for (let depth = 0; id && !seen.has(id); depth++) {
      if (depth >= 32) return null;
      const nodes = catalog.categories.filter(node => node.categoryId === id);
      if (nodes.length !== 1 || !boundedText(nodes[0].label, 120)) return null;
      anchors.push({ categoryId: id, label: nodes[0].label, parentId: nodes[0].parentId ?? null });
      seen.add(id);
      id = nodes[0].parentId;
    }
  }
  const trimmedProposals = built.proposals.map(p => ({
    ...p,
    reason: typeof p.reason === 'string' ? p.reason.slice(0, 140) : p.reason,
  }));
  const plan = { catalogVersion: built.catalogVersion, proposals: trimmedProposals, anchors };
  return new TextEncoder().encode(JSON.stringify(plan)).length <= 18000 ? plan : null;
}

// Missing classification cannot turn a model's acknowledgement into a ready
// card invitation. Keep real questions and every guarded business fact. This
// message grants no authority: signed server review still owns actual readiness.
export function withUnresolvedSinglePassReply(turn, built, plan) {
  if (!['ALLOW', 'CLARIFY'].includes(turn?.safety) || plan &&
      !built?.clarifications?.length && !built?.failures?.length && !built?.unresolvedServices?.length) return turn;
  const question = built?.clarifications?.[0]?.ambiguityPrompt;
  // An ordinary question can still collect a missing business fact.
  // Preserve Gemini's streamed reply whenever it is already non-empty so the
  // user's visible message never jumps or gets replaced at the end of the turn.
  if (!question && typeof turn.assistantMessage === 'string' && turn.assistantMessage.trim().length > 0) return turn;
  if (!question && turn.dialogue?.next === 'ANSWER') return turn;
  if (!question && turn.dialogue?.next !== 'REVIEW' && turn.assistantMessage.includes('?')) return turn;
  return { ...turn, assistantMessage: question || (turn.assistantMessage?.trim() || 'Podaci su zabeleženi u razgovoru.'),
    ...(turn.dialogue ? { dialogue: { ...turn.dialogue, next: question ? 'CLARIFY' : turn.dialogue.next, questionKey: 'NONE' } } : {}) };
}

// The public/mobile completion envelope stays unchanged. A resolved catalog ID
// is not a published task, an activated profile or saved worker consent.
export function singlePassCompletion(envelope) {
  if (!record(envelope) || Object.keys(envelope).length !== 2
      || !Object.hasOwn(envelope, 'completion') || !record(envelope.firstPlan)
      || !record(envelope.completion)) throw new Error('AI_FIRST_PLAN_RECEIPT_INVALID');
  const turn = envelope.completion.turn ?? envelope.completion;
  const receipt = envelope.firstPlan;
  if (turn.state === 'SUCCEEDED') {
    const resolved = Object.keys(receipt).length === 3 && receipt.state === 'RESOLVED'
      && receipt.authority === 'CATALOG_ONLY';
    const deferred = Object.keys(receipt).length === 4 && receipt.state === 'DEFERRED'
      && receipt.authority === 'NONE' && ['SAFETY_UNRESOLVED', 'CATALOG_CHANGED',
        'CATALOG_CONFLICT', 'CATALOG_SAFETY', 'MODE_UNRESOLVED'].includes(receipt.code);
    if ((!resolved && !deferred) || receipt.applicability !== 'NOT_EVALUATED')
      throw new Error('AI_FIRST_PLAN_RECEIPT_INVALID');
  } else if (Object.keys(receipt).length !== 2 || receipt.state !== 'NOT_ELIGIBLE' || receipt.authority !== 'NONE') {
    throw new Error('AI_FIRST_PLAN_RECEIPT_INVALID');
  }
  return envelope.completion;
}
