import { normalizedClassificationIdentity, reviewClassificationProposal } from './classificationEngine.mjs';
import { decodeServiceHandoff } from './serviceHandoff.mjs';

const record = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = value => typeof value === 'string' && /^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(value);
const mode = value => value === 'REMOTE' || value === 'ON_SITE';
const label = value => typeof value === 'string' && value.trim().length >= 3 && value.length <= 120 && !/[<>\u0000-\u001f]/.test(value);
const exact = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));

/** Owned SQL context only. Catalog execution modes describe a category, never a worker's choices. */
export function readWorkerServiceModeContext(context) {
  const data = context.serviceModeContext;
  if (!exact(data, ['schemaVersion', 'revision', 'savedServices', 'draftServices', 'unresolvedServices'])
      || data.schemaVersion !== 'WORKER_SERVICE_MODE_CONTEXT_V1'
      || !Number.isSafeInteger(data.revision) || data.revision !== context.revision
      || !Array.isArray(context.candidate?.skills)) throw new Error('WORKER_MODE_CONTEXT_INVALID');
  const offered = new Set(context.candidate.skills.map(normalizedClassificationIdentity));
  for (const entries of [data.savedServices, data.draftServices]) {
    if (!Array.isArray(entries) || entries.length > 24) throw new Error('WORKER_MODE_CONTEXT_INVALID');
    const seen = new Set();
    for (const entry of entries) {
      const key = normalizedClassificationIdentity(entry?.service);
      const identity = key + '|' + entry?.mode;
      if (!exact(entry, ['service', 'mode', 'categoryId', ...(Object.hasOwn(entry??{}, 'handoff') ? ['handoff'] : [])]) || !label(entry.service) || !mode(entry.mode)
          || (Object.hasOwn(entry, 'handoff') && (entry.mode !== 'REMOTE' || !decodeServiceHandoff(entry.handoff)))
          || !uuid(entry.categoryId) || !offered.has(key) || seen.has(identity)) throw new Error('WORKER_MODE_CONTEXT_INVALID');
      seen.add(identity);
    }
  }
  if (!Array.isArray(data.unresolvedServices) || data.unresolvedServices.length > 50
      || data.unresolvedServices.some(service => !label(service) || !offered.has(normalizedClassificationIdentity(service))))
    throw new Error('WORKER_MODE_CONTEXT_INVALID');
  return data;
}

export function workerServiceModeSchema(schema) {
  return { ...schema, properties: { ...schema.properties, serviceModeChangesJson: { type: 'STRING' } } };
}

export function workerServiceModeInstruction(context, includeContext = true, includeClassification = true) {
  return 'Per-service modes/handoff: draftServices replace savedServices for that service; otherwise preserve saved choices. Catalog modes and unrelated bio/area/calendar edits do not authorize changes or activation. '
    + 'serviceModeChangesJson is a STRING array of {service,modes,evidence,handoff?}, or "[]" for no change. service exactly matches an offered skill; modes is its COMPLETE intended REMOTE/ON_SITE set. evidence: verbatim USER quote (6–1000 characters) stating initial scope or a mode/handoff change. A standalone choice such as "Uživo", "Lično", "Onlajn" or "Oba" is valid evidence only for the immediately previous question that uniquely names this service and offers online/on-site alternatives at the same server revision. Return exactly the selected mode set and the actual USER quote, including its original script; never pad or invent a quote. A mode-only reply does not authorize a new handoff, so omit handoff and preserve any saved one. An ambiguous "Da", "Ne" or "Može" is not a mode choice. Obvious initial work can establish mode; a multi-service statement gives each service the same quote. '
    + 'handoff requires REMOTE. Handoff-only changes preserve modes; omitted handoff preserves its prior value. '
    + (includeClassification ? 'Its handoff must equal the new REMOTE classification proposal. ' : 'Declare handoff here once; the server attaches it to classification. ')
    + 'Unchanged server draft choices need no repeated declaration. An earlier change absent from context cites its original USER wording. Never cite assistant/catalog/bio/unrelated text as consent or invent it. Unclear mode: ask about execution, never default BOTH. '
    + (includeClassification ? 'Keep classificationShadowJson full snapshot consistent with these choices. ' : '')
    + 'These remain draft choices until explicit Save.'
    + (includeContext ? ' Server-owned service mode context: ' + JSON.stringify(context) + '.' : '');
}

// Elliptical choices belong to the immediately previous service-specific
// question on the same SQL-owned revision. Length and punctuation must not
// change their authority. This is not a second classifier or an activation.
const questionWords = value => (typeof value === 'string'
  ? value.match(/[\p{L}\p{N}]+/gu) ?? [] : [])
  .map(word => normalizedClassificationIdentity(word))
  .filter(word => typeof word === 'string' && word.length >= 4);
function questionNamesService(words, service) {
  const terms = questionWords(service);
  if (!terms.length) return false;
  return terms.filter(term => words.some(word => word === term
    || (word.length >= 5 && term.length >= 5 && word.slice(0, 4) === term.slice(0, 4))))
    .length >= Math.min(2, terms.length);
}
const modeReplyKey = evidence => {
  const text = evidence.trim().replace(/[\s.!?…]+$/u, '');
  // The service normalizer deliberately requires three characters. Preserve
  // two-letter yes/no here only to reject them; do not change service identity.
  if (/^(?:da|ne|да|не)$/iu.test(text)) return 'AMBIGUOUS';
  return normalizedClassificationIdentity(text)?.normalize('NFD').replace(/[\u0300-\u036f]/g, '') ?? null;
};
const modeReplyChoices = new Map([
  ['uzivo', ['ON_SITE']], ['licno', ['ON_SITE']],
  ['na lokaciji', ['ON_SITE']], ['na terenu', ['ON_SITE']],
  ['onlajn', ['REMOTE']], ['online', ['REMOTE']], ['na daljinu', ['REMOTE']],
  ['oba', ['REMOTE', 'ON_SITE']], ['oboje', ['REMOTE', 'ON_SITE']],
  ['obadva', ['REMOTE', 'ON_SITE']], ['oba nacina', ['REMOTE', 'ON_SITE']],
  ['na oba nacina', ['REMOTE', 'ON_SITE']], ['i jedno i drugo', ['REMOTE', 'ON_SITE']],
]);
function boundedModeReply(change, context, offered, expected) {
  if (change.modes.length !== expected.length || !expected.every(value => change.modes.includes(value))
      // A short choice says nothing about shipping or physical exchange.
      || Object.hasOwn(change, 'handoff')
      || !Number.isSafeInteger(context.revision)
      || context.serviceModeContext?.revision !== context.revision
      || !Array.isArray(context.messages) || context.messages.length < 2) return false;
  const user = context.messages.at(-1), assistant = context.messages.at(-2);
  if (user?.role !== 'USER' || assistant?.role !== 'ASSISTANT'
      || typeof user.body !== 'string' || typeof assistant.body !== 'string'
      || user.body.trim() !== change.evidence.trim()
      || (assistant.body.match(/\?/g) ?? []).length !== 1) return false;
  const words = questionWords(assistant.body);
  const remote = words.some(word => ['onlajn', 'online', 'daljinu'].includes(word));
  const onsite = words.some(word => ['uživo', 'uzivo', 'terenu', 'lokaciji', 'lično', 'licno'].includes(word));
  if (!remote || !onsite) return false;
  const named = [...offered.values()].filter(service => questionNamesService(words, service));
  return named.length === 1 && normalizedClassificationIdentity(named[0]) === normalizedClassificationIdentity(change.service);
}
function modeEvidenceAllowed(change, context, offered, userTexts) {
  if (typeof change.evidence !== 'string' || !change.evidence.trim()
      || change.evidence.length > 1000 || !userTexts.some(body => body.includes(change.evidence))) return false;
  const key = modeReplyKey(change.evidence);
  if (key === 'AMBIGUOUS' || key === 'moze' || key === 'vazi') return false;
  const expected = modeReplyChoices.get(key);
  // Apply the same context check to "Uživo" and "Uživo."/"Onlajn", not only
  // strings shorter than six characters. Longer complete statements retain
  // the existing quote contract and all downstream signed-review checks.
  return expected ? boundedModeReply(change, context, offered, expected) : change.evidence.trim().length >= 6;
}

/** Quote checks bind a model proposal to owned USER text, not semantic proof of consent.
 * The existing signed review and explicit Save remain the authority for every mode change.
 */
export function inspectWorkerModeRequests(serviceModeChangesJson, context, offered) {
  const userTexts = context.messages.filter(row => row.role === 'USER' && typeof row.body === 'string').map(row => row.body);
  let changes = [];
  // Parse once for both accepted requests and rejected declarations. An invalid
  // declaration must not disappear and look like an unrelated profile edit.
  if (typeof serviceModeChangesJson === 'string' && serviceModeChangesJson.trim() !== '') {
    if (new TextEncoder().encode(serviceModeChangesJson).byteLength > 12288)
      return { requests: new Map(), invalidServices: new Set(offered.keys()) };
    try {
      const value = JSON.parse(serviceModeChangesJson);
      if (!Array.isArray(value) || value.length > 12)
        return { requests: new Map(), invalidServices: new Set(offered.keys()) };
      changes = value;
    } catch {
      return { requests: new Map(), invalidServices: new Set(offered.keys()) };
    }
  }
  const requests = new Map(), declared = new Set();
  for (const change of changes) {
    const key = normalizedClassificationIdentity(change?.service);
    if (!key || !offered.has(key)) continue;
    // Count BEFORE validating the row: a valid row plus a malformed duplicate
    // is still ambiguous. Keep the key poisoned for every later occurrence.
    if (declared.has(key)) { requests.delete(key); continue; }
    declared.add(key);
    if (!exact(change, ['service', 'modes', 'evidence', ...(Object.hasOwn(change??{}, 'handoff') ? ['handoff'] : [])]) || !label(change.service)
        || !Array.isArray(change.modes) || change.modes.length < 1 || change.modes.length > 2
        || !change.modes.every(mode) || new Set(change.modes).size !== change.modes.length
        || (Object.hasOwn(change, 'handoff') && (!change.modes.includes('REMOTE') || !decodeServiceHandoff(change.handoff)))
        || !modeEvidenceAllowed(change, context, offered, userTexts)) continue;
    requests.set(key, change);
  }
  return { requests, invalidServices: new Set([...declared].filter(key => !requests.has(key))) };
}

// Retain the existing Map API for supported preservation/recovery callers.
export function workerModeRequests(serviceModeChangesJson, context, offered) {
  return inspectWorkerModeRequests(serviceModeChangesJson, context, offered).requests;
}

/** Recover only a wrong CREATE action for an already-existing exact identity.
 * This changes neither offered work nor execution intent and cannot invent an
 * alias, ID or mode. A fresh global EXACT proof and the normal engine gate are
 * required; the caller re-inspects the entire resulting snapshot before capture.
 */
export function recoverWorkerExistingIdentity({ raw, inspection, context, modeContext, catalog }) {
  const unchanged = { output: raw, recoveredCount: 0 };
  if (!['ALLOW', 'CLARIFY'].includes(raw?.safety)
      || modeContext?.revision !== context?.revision
      || catalog?.navigation?.kind !== 'SERVER_QUERIES'
      || !/^[a-f0-9]{32}$/.test(catalog.catalogFingerprint ?? '')
      || !Number.isSafeInteger(catalog.catalogVersion)
      || typeof raw.classificationShadowJson !== 'string'
      || new TextEncoder().encode(raw.classificationShadowJson).byteLength > 24576)
    return unchanged;
  let proposals;
  try {
    proposals = JSON.parse(raw.classificationShadowJson);
  } catch {
    return unchanged;
  }
  if (!Array.isArray(proposals) || proposals.length > 24) return unchanged;
  const skills = Array.isArray(raw.patch?.skills) ? raw.patch.skills : context.candidate.skills;
  const offered = new Map(skills.filter(label).map(service => [normalizedClassificationIdentity(service), service]));
  const requests = workerModeRequests(raw.serviceModeChangesJson, context, offered);
  const duplicate = new Set(), seen = new Set();
  for (const p of proposals) {
    const key = normalizedClassificationIdentity(p?.service) + '|' + p?.mode;
    if (seen.has(key)) duplicate.add(key);
    seen.add(key);
  }
  let recoveredCount = 0;
  const next = proposals.map(p => {
    const identity = normalizedClassificationIdentity(p?.service);
    if (!p || !['CREATE_CHILD', 'CREATE_NEW_BRANCH'].includes(p.action)
        || !mode(p.mode) || !offered.has(identity)
        || p.catalogVersion !== catalog.catalogVersion || duplicate.has(identity + '|' + p.mode)
        || !Array.isArray(p.proposedPath)
        || normalizedClassificationIdentity(p.proposedPath.at(-1)) !== identity
        || !inspection?.issues?.some(issue => issue.code === 'EXISTING_IDENTITY_REQUIRES_REVIEW'
          && issue.action === p.action && issue.mode === p.mode
          && normalizedClassificationIdentity(issue.service) === identity)) return p;
    const exactChecks = catalog.navigation.identityChecks?.filter(check => check.service === identity) ?? [];
    if (exactChecks.length !== 1 || exactChecks[0].categoryIds?.length !== 1) return p;
    const categoryId = exactChecks[0].categoryIds[0];
    const nodes = catalog.categories.filter(node => node.id === categoryId);
    if (nodes.length !== 1 || !nodes[0].modes?.includes(p.mode)) return p;
    const requested = requests.get(identity);
    if (requested) {
      if (!requested.modes.includes(p.mode) || Object.hasOwn(requested, 'handoff')
          && JSON.stringify(decodeServiceHandoff(p.handoff)) !== JSON.stringify(decodeServiceHandoff(requested.handoff))) return p;
    } else {
      // A catalog mode alone is never evidence of a person's execution choice.
      const prior = [...modeContext.savedServices, ...modeContext.draftServices]
        .filter(entry => entry.categoryId === categoryId && entry.mode === p.mode);
      if (prior.length === 0 || prior.some(entry =>
        JSON.stringify(decodeServiceHandoff(entry.handoff)) !== JSON.stringify(decodeServiceHandoff(p.handoff)))) return p;
    }
    const replacement = { ...p, action: 'REUSE_EXISTING', categoryId, parentId: '', proposedPath: [] };
    const verified = reviewClassificationProposal(
      { purpose: 'WORKER_CAPABILITY', service: p.service, mode: p.mode }, catalog,
      { ...replacement, parentId: null });
    if (!verified.accepted || verified.status !== 'REUSE_CANDIDATE') return p;
    recoveredCount++;
    return replacement;
  });
  return recoveredCount
    ? { output: { ...raw, classificationShadowJson: JSON.stringify(next) }, recoveredCount }
    : unchanged;
}

export function preserveWorkerServiceModes({ raw, hints, context, modeContext, catalog }) {
  const { serviceModeChangesJson, ...output } = raw;
  if (!['ALLOW', 'CLARIFY'].includes(output.safety)) return { output, hints: [], preserved: false, preservedServices: [], unresolvedChanges: [] };
  const skills = Array.isArray(output.patch?.skills) ? output.patch.skills : context.candidate.skills;
  const offered = new Map(skills.filter(label).map(service => [normalizedClassificationIdentity(service), service]));
  const requests = workerModeRequests(serviceModeChangesJson, context, offered);
  const knownService = (service, entry) => reviewClassificationProposal({ purpose: 'WORKER_CAPABILITY', service, mode: entry.mode }, catalog,
    { action: 'REUSE_EXISTING', categoryId: entry.categoryId, parentId: null, proposedPath: [],
      reason: 'Preserve the same server-registered service identity.', catalogVersion: catalog.catalogVersion }).accepted;
  const baseline = new Map();
  // Unconfirmed draft hints may include the very drift being corrected. They
  // inform the conversation but must never become preservation authority.
  for (const entries of [modeContext.savedServices]) {
    for (const [key, service] of offered) {
      if (baseline.has(key)) continue;
      // A model replacing an offered label with a registered alias must not
      // turn the same canonical service into an unbounded new capability.
      const prior = entries.filter(entry => normalizedClassificationIdentity(entry.service) === key || knownService(service, entry));
      const unique = [...new Map(prior.map(entry => [entry.categoryId + '|' + entry.mode, entry])).values()];
      if (unique.length) baseline.set(key, unique);
    }
  }
  let preserved = false;
  const result = [], preservedServices = [], unresolvedChanges = [];
  // A quoted change to modes alone must not silently widen a saved physical
  // handoff. The explicit handoff update is separately bound to the same hint.
  const applyRequest = (proposed, request, previous = []) => {
    if (!request || !request.modes.every(value => proposed.some(hint => hint.mode === value))) return null;
    if (Object.hasOwn(request, 'handoff') && !proposed.some(hint => hint.mode === 'REMOTE'
        && JSON.stringify(decodeServiceHandoff(hint.handoff)) === JSON.stringify(decodeServiceHandoff(request.handoff)))) return null;
    return proposed.filter(hint => request.modes.includes(hint.mode)).map(hint => {
      if (hint.mode !== 'REMOTE' || Object.hasOwn(request, 'handoff')) return hint;
      const saved = previous.find(entry => entry.mode === 'REMOTE');
      if (!saved) return hint;
      const { handoff: _proposal, ...rest } = hint;
      return { ...rest, ...(Object.hasOwn(saved, 'handoff') ? { handoff: decodeServiceHandoff(saved.handoff) } : {}) };
    });
  };
  for (const [key] of offered) {
    if (baseline.has(key)) continue;
    const proposed = hints.filter(hint => normalizedClassificationIdentity(hint.service) === key);
    const requested = requests.get(key);
    if (!requested) result.push(...proposed);
    else { const changed = applyRequest(proposed, requested); if (changed) result.push(...changed);
      else unresolvedChanges.push(offered.get(key)); }
  }
  for (const [key, previous] of baseline) {
    // Saved modes for one concrete service must share one canonical leaf.
    // Neither a model hint nor per-mode catalog validation may choose which
    // divergent saved ID to keep. Leave the saved context untouched and make
    // this service unresolved while preserving unrelated services below.
    if (new Set(previous.map(entry => entry.categoryId.toLowerCase())).size !== 1) {
      unresolvedChanges.push(offered.get(key));
      preserved = true;
      continue;
    }
    const proposed = hints.filter(hint => normalizedClassificationIdentity(hint.service) === key);
    const requested = requests.get(key);
    const changed = applyRequest(proposed, requested, previous);
    if (changed) {
      result.push(...changed);
      continue;
    }
    if (requested) unresolvedChanges.push(offered.get(key));
    const service = offered.get(key);
    const retained = previous.map(entry => ({ service, mode: entry.mode, action: 'REUSE_EXISTING', categoryId: entry.categoryId,
      parentId: '', proposedPath: [], reason: 'Preserve the existing service-specific delivery choice during an unrelated profile edit.', catalogVersion: catalog.catalogVersion,
      ...(Object.hasOwn(entry,'handoff') ? {handoff:decodeServiceHandoff(entry.handoff)} : {}) }));
    // Revalidate retained identities against this catalog too. A withdrawn category must not be revived by continuity.
    const valid = retained.every(entry => reviewClassificationProposal({ purpose: 'WORKER_CAPABILITY', service, mode: entry.mode }, catalog,
      { action: entry.action, categoryId: entry.categoryId, parentId: null, proposedPath: [], reason: entry.reason, catalogVersion: entry.catalogVersion }).accepted);
    if (valid) {
      result.push(...retained);
      // Feedback may dismiss an obsolete provider issue only with this actual
      // saved-context provenance, after fresh identity/mode validation. An
      // unsatisfied explicit mode-change request must remain unresolved.
      if (!requested) preservedServices.push(service);
    }
    preserved ||= !valid || proposed.length !== retained.length || proposed.some(hint => !retained.some(entry => entry.mode === hint.mode && entry.categoryId === hint.categoryId
      && JSON.stringify(decodeServiceHandoff(entry.handoff)) === JSON.stringify(decodeServiceHandoff(hint.handoff))));
  }
  return { output, hints: result, preserved, preservedServices, unresolvedChanges };
}