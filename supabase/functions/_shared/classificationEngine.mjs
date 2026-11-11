// USKOČI P0 — shared, read-only classification boundary.
// This module is used by BOTH worker and requester Gemini handlers.
// It NEVER writes categories, worker capabilities, need snapshots or relations.
// Admission/commit is deliberately a separate, owner-reviewed transactional phase.
export const CLASSIFICATION_ACTIONS = Object.freeze([
  'REUSE_EXISTING', 'REUSE_ALIAS', 'EXTEND_MODE', 'CREATE_CHILD', 'CREATE_NEW_BRANCH',
  'PROPOSE_RESTRUCTURE', 'ASK_CLARIFICATION', 'NEEDS_REVIEW',
  'REJECT_UNSUPPORTED_OR_UNSAFE',
]);
const ACTIONS = new Set(CLASSIFICATION_ACTIONS);
const UUID = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const safeLabel = value => typeof value === 'string' && value.trim().length >= 3
  && value.trim().length <= 120 && !/[<>\u0000-\u001f]/.test(value);
const isRecord = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const catalogFingerprint = v => typeof v === 'string' && /^[a-f\d]{32}$/.test(v);
const validAliases = aliases => Array.isArray(aliases) &&
  JSON.stringify(aliases).length <= 65536 && aliases.every(safeLabel);
const plain = v => typeof v === 'string' && v.length <= 1000;
const modes = new Set(['REMOTE', 'ON_SITE']);
const inputKinds = new Set(['WORKER_CAPABILITY','NEED_SERVICE']);
const serbianCyrillic = Object.freeze({
  а:'a',б:'b',в:'v',г:'g',д:'d',ђ:'đ',е:'e',ж:'ž',з:'z',и:'i',ј:'j',
  к:'k',л:'l',љ:'lj',м:'m',н:'n',њ:'nj',о:'o',п:'p',р:'r',с:'s',
  т:'t',ћ:'ć',у:'u',ф:'f',х:'h',ц:'c',ч:'č',џ:'dž',ш:'š',
});
/** Cross-script normalization for the SAME written service, never semantic inference. */
export function normalizedClassificationIdentity(label) {
  if (!safeLabel(label)) return null;
  return label.normalize('NFKC').toLowerCase()
    .replace(/[\u0400-\u04ff]/g, letter => serbianCyrillic[letter] ?? letter)
    .normalize('NFC').trim().replace(/\s+/g, ' ');
}

// The canonical ID must not be treated as a semantic match merely because it exists.


function catalogError(reason) { throw new Error('CLASSIFICATION_CATALOG_' + reason); }

/** Catalog fetch is service-role-only; rpc is an injected server-side RPC client.
 *  STATIONARY is the existing SQL input spelling for canonical ON_SITE.
 *  Reject incomplete or changing pages instead of classifying against a partial tree.
 */
export async function loadClassificationCatalog(rpc, { pageSize = 100, maxBytes = 4194304, timeoutMs = 15000 } = {}) {
  if (typeof rpc !== 'function' || !Number.isInteger(maxBytes) || maxBytes < 1024
      || !Number.isInteger(timeoutMs) || timeoutMs < 1
      || !Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) catalogError('INPUT_INVALID');
  const byId = new Map(), scopesById = new Map();
  const deadline = Date.now() + timeoutMs;
  let receivedBytes = 0;
  let version = null, fingerprint;
  for (const [scope, legacyMode] of [['ON_SITE','STATIONARY'], ['REMOTE','REMOTE']]) {
    let cursor = null, completed = false;
    const seenCursors = new Set();
    while (!completed) {
      if (Date.now() >= deadline) catalogError('READ_TIMEOUT');
      const answer = await rpc('rpc_taxonomy_ai_catalog_context_service', {
        p_execution_location_mode: legacyMode, p_limit: pageSize, p_after_key: cursor,
      });
      receivedBytes += new TextEncoder().encode(JSON.stringify(answer)).byteLength;
      if (receivedBytes > maxBytes) catalogError('READ_TOO_LARGE');
      if (!isRecord(answer) || answer.action !== 'CATALOG_CONTEXT' ||
          !Array.isArray(answer.items) || !Number.isSafeInteger(answer.catalogVersion) ||
          answer.catalogVersion < 1 || answer.scope !== scope ||
          answer.classificationAuthority !== 'NONE' || answer.notificationAuthority !== 'NONE')
        catalogError('INVALID_PAGE');
      if (version !== null && version !== answer.catalogVersion) catalogError('STALE_VERSION');
      version = answer.catalogVersion;
      // Older catalog RPCs contain no aliases. They keep exact-name behavior.
      // A catalog version alone does not fence legacy alias writers; require
      // the server's content fingerprint across every page and both scopes.
      const hasFingerprint = Object.hasOwn(answer,'catalogFingerprint');
      const pageFingerprint = hasFingerprint ? answer.catalogFingerprint : null;
      if (hasFingerprint && !catalogFingerprint(pageFingerprint)) catalogError('INVALID_FINGERPRINT');
      if (fingerprint !== undefined && fingerprint !== pageFingerprint) catalogError('STALE_FINGERPRINT');
      fingerprint = pageFingerprint;
      for (const row of answer.items) {
        if (!isRecord(row) || !UUID.test(row.categoryId) || !safeLabel(row.label) ||
          !(row.parentId === null || UUID.test(row.parentId)) ||
          !Array.isArray(row.path) || row.path.length === 0 ||
          JSON.stringify(row.path).length > 65536 || !row.path.every(safeLabel))
          catalogError('INVALID_CATEGORY');
        const hasAliases = Object.hasOwn(row,'aliases');
        if (hasAliases && !validAliases(row.aliases)) catalogError('INVALID_ALIAS');
        if (hasAliases && !catalogFingerprint(pageFingerprint)) catalogError('ALIAS_FINGERPRINT_REQUIRED');
        const node = { id: row.categoryId, label: row.label, parentId: row.parentId,
          path: row.path.slice(), isLeaf: row.isLeaf === true,
          ...(hasAliases ? { aliases: Object.freeze(row.aliases.slice()) } : {}) };
        const existing = byId.get(node.id);
        if (existing && (existing.label !== node.label || existing.parentId !== node.parentId
          || JSON.stringify(existing.path) !== JSON.stringify(node.path)
          || JSON.stringify(existing.aliases) !== JSON.stringify(node.aliases)))
          catalogError('CONFLICTING_ID');
        byId.set(node.id, node);
        if (!scopesById.has(node.id)) scopesById.set(node.id, new Set());
        scopesById.get(node.id).add(scope);
      }
      if (answer.nextAfter === null) { completed = true; break; }
      if (typeof answer.nextAfter !== 'string' || !answer.nextAfter.length ||
          seenCursors.has(answer.nextAfter)) catalogError('INVALID_CURSOR');
      seenCursors.add(answer.nextAfter);
      cursor = answer.nextAfter;
    }
  }
  if (version === null) catalogError('MISSING_VERSION');
  return Object.freeze({ catalogVersion: version,
    ...(fingerprint !== null ? { catalogFingerprint: fingerprint } : {}),
    categories: Array.from(byId.values()).map(node => Object.freeze({
      ...node, modes: Object.freeze(Array.from(scopesById.get(node.id)).sort()),
    })),
  });
}

/** Read-only plan gate. AI output alone is never category/competence authority.
 *  Parent identity and category ID are looked up in the FRESH server catalog,
 *  never accepted as invented model IDs. Novel meanings always need admission.
 */
export function reviewClassificationProposal(input, snapshot, plan) {
  if (!isRecord(input) || !inputKinds.has(input.purpose) || !isRecord(snapshot) ||
      !Number.isSafeInteger(snapshot.catalogVersion) || !Array.isArray(snapshot.categories) ||
      !isRecord(plan) || !ACTIONS.has(plan.action))
    return { accepted: false, status: 'INVALID_INPUT' };
  if (!Number.isSafeInteger(plan.catalogVersion) ||
      plan.catalogVersion !== snapshot.catalogVersion)
    return { accepted: false, status: 'STALE_CATALOG' };
  if (!safeLabel(input.service) || (input.mode !== null && input.mode !== undefined &&
      !modes.has(input.mode)))
    return { accepted: false, status: 'INVALID_SERVICE' };
  if (!plain(plan.reason) || !plan.reason.trim())
    return { accepted: false, status: 'MISSING_EVIDENCE' };
  const categories = new Map(snapshot.categories.map(node => [node.id,node]));
  // Navigated pages are intentionally partial. Only independent, global
  // exact/registered-alias queries may establish uniqueness or absence.
  const navigated = snapshot.navigation?.kind === 'SERVER_QUERIES';
  const identity = normalizedClassificationIdentity(input.service);
  const identityCheck = navigated && Array.isArray(snapshot.navigation.identityChecks)
    ? snapshot.navigation.identityChecks.find(item => item.service === identity) : null;
  if (navigated && ['REUSE_EXISTING','REUSE_ALIAS','EXTEND_MODE','CREATE_CHILD','CREATE_NEW_BRANCH'].includes(plan.action) &&
      (!identityCheck || !Array.isArray(identityCheck.categoryIds)))
    return { accepted: false, status: 'GLOBAL_IDENTITY_NOT_VERIFIED' };
  if (['REUSE_EXISTING','REUSE_ALIAS','EXTEND_MODE'].includes(plan.action)) {
    const existing = categories.get(plan.categoryId);
    if (!existing) return { accepted: false, status: 'UNKNOWN_CANONICAL_ID' };
    const extending = plan.action === 'EXTEND_MODE';
    if (extending && !input.mode) return { accepted: false, status: 'MODE_CONFIRMATION_REQUIRED' };
    if (extending && existing.modes?.includes(input.mode))
      return { accepted: false, status: 'MODE_ALREADY_SUPPORTED' };
    if (!extending && input.mode && (!Array.isArray(existing.modes) || !existing.modes.includes(input.mode)))
      return { accepted: false, status: 'MODE_NOT_SUPPORTED' };
    // Aliases arrive only from the service-owned, fingerprinted catalog, never
    // from provider output. Keep the existing normalizer: accepting a stored
    // synonym is not permission to infer other synonyms or broader competence.
    const hasAlias = node => catalogFingerprint(snapshot.catalogFingerprint) &&
      validAliases(node.aliases) && node.aliases.some(alias => normalizedClassificationIdentity(alias) === identity);
    const verifiedAlias = hasAlias(existing);
    if (plan.action === 'REUSE_ALIAS' && !verifiedAlias)
      return { accepted: false, status: 'ALIAS_EVIDENCE_REQUIRED',
        catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE',
        notificationAuthority: 'NONE' };
    if (identity !== normalizedClassificationIdentity(existing.label) && !verifiedAlias)
      return { accepted: false, status: 'SEMANTIC_IDENTITY_REVIEW_REQUIRED',
        catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE',
        notificationAuthority: 'NONE' };
    // A stored alias collision cannot be resolved by the model choosing an ID.
    // The SQL owner-review projection independently repeats this identity check.
    const identities = snapshot.categories.filter(node =>
      (extending || !input.mode || node.modes?.includes(input.mode)) &&
      (normalizedClassificationIdentity(node.label) === identity || hasAlias(node)));
    if (new Set(identities.map(node => node.id)).size !== 1)
      return { accepted: false, status: 'AMBIGUOUS_CANONICAL_IDENTITY',
        catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE',
        notificationAuthority: 'NONE' };
    if (navigated && (identityCheck.categoryIds.length !== 1 || identityCheck.categoryIds[0] !== existing.id))
      return { accepted: false, status: 'AMBIGUOUS_CANONICAL_IDENTITY',
        catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE', notificationAuthority: 'NONE' };
    // Exact identity is necessary, not evidence that a new execution mode is
    // physically feasible. Preserve the proposal for the existing signed
    // admission; neither this read nor a user's preference changes the catalog.
    if (extending) return { accepted: false, status: 'ADMISSION_REVIEW_REQUIRED',
      categoryId: existing.id, catalogVersion: snapshot.catalogVersion,
      requiresOwnerReview: true, capabilityAuthority: 'NONE', notificationAuthority: 'NONE' };
    return { accepted: true, status: 'REUSE_CANDIDATE',
      categoryId: existing.id, catalogVersion: snapshot.catalogVersion,
      // Worker/need confirmation is STILL required before activation or dispatch.
      requiresOwnerReview: true, capabilityAuthority: 'NONE', notificationAuthority: 'NONE' };
  }
  if (['CREATE_CHILD','CREATE_NEW_BRANCH','PROPOSE_RESTRUCTURE'].includes(plan.action)) {
    if (navigated && ['CREATE_CHILD','CREATE_NEW_BRANCH'].includes(plan.action)) {
      if (identityCheck.categoryIds.length)
        return { accepted: false, status: 'EXISTING_IDENTITY_REQUIRES_REVIEW' };
      if (!snapshot.navigation.searchedServices?.includes(identity))
        return { accepted: false, status: 'CATALOG_RESEARCH_REQUIRED' };
    }
    if (plan.action === 'CREATE_CHILD') {
      const parent = categories.get(plan.parentId);
      if (!parent) return { accepted: false, status: 'UNKNOWN_PARENT_ID' };
      // Parent links organize meanings. Only the actual service has execution
      // modes; a new child does not inherit or extend its parent's capabilities.
    }
    if (!Array.isArray(plan.proposedPath) || !plan.proposedPath.length ||
        new TextEncoder().encode(JSON.stringify(plan.proposedPath)).byteLength > 12000 || !plan.proposedPath.every(safeLabel))
      return { accepted: false, status: 'INVALID_PATH' };
    if (plan.action !== 'PROPOSE_RESTRUCTURE' &&
        normalizedClassificationIdentity(plan.proposedPath.at(-1)) !==
        normalizedClassificationIdentity(input.service))
      return { accepted: false, status: 'SERVICE_LEAF_MISMATCH' };
    if (plan.action === 'CREATE_NEW_BRANCH' && plan.parentId != null)
      return { accepted: false, status: 'NEW_BRANCH_MUST_HAVE_NO_PARENT' };
    return { accepted: false, status: 'ADMISSION_REVIEW_REQUIRED',
      catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE',
      notificationAuthority: 'NONE' };
  }
  return { accepted: false, status: plan.action,
    catalogVersion: snapshot.catalogVersion, capabilityAuthority: 'NONE',
    notificationAuthority: 'NONE' };
}

/** Complete current catalog, never a relevance shortlist. Parent links preserve
 * every branch without repeating the entire ancestry on each row. Resource
 * exhaustion is an explicit read failure, never evidence a service is absent.
 * Fresh catalog loading and the signed review both fence concurrent changes.
 */
export function catalogPromptContext(snapshot) {
  if (!isRecord(snapshot) || !Array.isArray(snapshot.categories) ||
      !Number.isSafeInteger(snapshot.catalogVersion) || snapshot.catalogVersion < 1)
    catalogError('PROMPT_INVALID');
  const all = snapshot.categories;
  const byId = new Map(all.map(node => [node.id, node]));
  if (byId.size !== all.length) catalogError('DUPLICATE_ID');
  const finished = new Set();
  for (const node of all) {
    let current = node;
    const chain = new Set();
    while (current && !finished.has(current.id)) {
      if (chain.has(current.id)) catalogError('CYCLIC_ANCESTRY');
      chain.add(current.id);
      if (current.parentId == null) break;
      current = byId.get(current.parentId);
      if (!current) catalogError('INCOMPLETE_ANCESTRY');
    }
    for (const id of chain) finished.add(id);
  }
  return JSON.stringify({
    catalogVersion: snapshot.catalogVersion,
    catalogFingerprint: snapshot.catalogFingerprint ?? null,
    classificationAuthority: 'NONE',
    shortlisted: false,
    totalCategories: all.length,
    complete: true,
    instructions: 'This is the COMPLETE current eligible catalog across ON_SITE and REMOTE, not a shortlist. All nodes and registered aliases are included. Follow parentId links upward to roots and downward through children; compare all branches before proposing novelty. Select the narrowest existing service with exactly the same work, object and scope. Related, broader or narrower work is NOT equivalent. Never invent IDs. A missing exact phrase is not proof of a missing service: understand the meaning and clarify ambiguous work. For a clearly equivalent natural description, use the precise canonical service name in the reviewed skills/task category while preserving the person\'s actual scope in bio/description. Do not add services they never offered. New branches must be meaningful and non-duplicative; propose the necessary path, never create or activate it during chat. Mode and owner Save remain separate confirmations.',
    categories: all.map(node => ({
      id: node.id, parentId: node.parentId, label: node.label, modes: node.modes,
      ...(catalogFingerprint(snapshot.catalogFingerprint) && validAliases(node.aliases)
        ? { aliases: node.aliases } : {}),
    })),
  });
}
