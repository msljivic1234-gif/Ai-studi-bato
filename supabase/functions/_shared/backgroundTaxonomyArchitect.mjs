// Catalog validation for the single interview response: no provider calls here.
// Both intake handlers pass the same complete snapshot and model decisions.
// SQL resolves catalog IDs; business review/Save admits tasks and capabilities.

import { normalizedClassificationIdentity } from './classificationEngine.mjs';
export { normalizedClassificationIdentity };
import { decodeServiceHandoff } from './serviceHandoff.mjs';
import { inspectWorkerModeRequests } from './workerServiceModeContext.mjs';

// Bounded same-isolate hints/fences, never a substitute for the SQL lifecycle.
// One map slot per conversation/revision, including pending/consumed markers.
const clarificationHintSlots = new Map();
const CLARIFICATION_TTL_MS = 5 * 60 * 1000;
const CLARIFICATION_MAX_SLOTS = 128;
const hintMemoryKey = (conversationId, draftRevision) => JSON.stringify([conversationId, draftRevision]);
function pruneClarificationHints(now = Date.now()) {
  for (const [key, entry] of clarificationHintSlots) {
    if (now < entry.timestamp || now - entry.timestamp >= CLARIFICATION_TTL_MS) clarificationHintSlots.delete(key);
  }
}
function setHintMemorySlot(entry) {
  pruneClarificationHints();
  const key = hintMemoryKey(entry.conversationId, entry.draftRevision);
  clarificationHintSlots.delete(key);
  clarificationHintSlots.set(key, Object.freeze(entry));
  while (clarificationHintSlots.size > CLARIFICATION_MAX_SLOTS) {
    clarificationHintSlots.delete(clarificationHintSlots.keys().next().value);
  }
  return entry;
}
function hintMemorySlot(conversationId, draftRevision) {
  pruneClarificationHints();
  return clarificationHintSlots.get(hintMemoryKey(conversationId, draftRevision));
}
function reserveHintMemorySlot(conversationId, draftRevision) {
  // An absent slot also needs an immutable token before awaiting. Otherwise
  // evicting a later consume marker could turn undefined back into undefined
  // and admit a stale response after the eviction/expiry (an ABA race).
  return hintMemorySlot(conversationId, draftRevision) ?? setHintMemorySlot({
    conversationId, draftRevision, consumed: true, timestamp: Date.now(),
  });
}

const executionMode = value => value === 'ON_SITE' || value === 'REMOTE';
function recordFailure(failure, failures) {
  failures.push(failure);
  console.warn('TAXONOMY_DECISION_REJECTED', failure.status, failure.code);
}
// PostgreSQL char_length counts codepoints; UTF-16 slice can split an emoji.
const boundedCodepoints = (value, limit) => Array.from(value).slice(0, limit).join('');
function validClarification(decision) {
  return ['NEEDS_CLARIFICATION', 'AMBIGUOUS'].includes(decision?.action)
    && typeof decision.ambiguityPrompt === 'string' && Array.from(decision.ambiguityPrompt.trim()).length >= 8
    && typeof decision.reason === 'string' && decision.reason.trim().length >= 10;
}
function decisionFailure(decision) {
  return ['REUSE_EXISTING', 'EXTEND_MODE'].includes(decision?.action)
    ? { status: 'PROVIDER_PERMANENT_FAILURE', code: 'SEMANTIC_REUSE_ADMISSION_UNAVAILABLE' }
    : { status: 'RETRYABLE_PROVIDER', code: 'PROVIDER_INVALID_DECISION' };
}

/**
 * Semantic reuse is an untrusted proposal for the owned atomic completion
 * and catalog resolver. The complete server snapshot proves an ID and supported mode
 * exist, NOT that the model understood the work correctly. The server-owned
 * resolver validates catalog identity; business review/Save still owns task
 * publication and worker capabilities. This local hint alone is not READY,
 * a global alias or a binder instruction.
 */
function semanticReuseHint(decision, service, mode, catalog) {
  const key = normalizedClassificationIdentity(service);
  if (!['REUSE_EXISTING', 'EXTEND_MODE'].includes(decision?.action) || !key || !executionMode(mode)
      || catalog?.verifiedComplete !== true || !Array.isArray(catalog.categories)
      || decision.parentId !== '' || typeof decision.categoryId !== 'string'
      || normalizedClassificationIdentity(decision.service) !== key
      || decision.mode !== mode || typeof decision.reason !== 'string'
      || decision.reason.trim().length < 10 || decision.reason.length > 1000) return null;
  const matches = catalog.categories.filter(node => node.categoryId === decision.categoryId);
  if (matches.length !== 1 || matches[0].isLeaf !== true
      || !Array.isArray(matches[0].modes)) return null;
  const hasMode = matches[0].modes.includes(mode);
  if (decision.action === 'REUSE_EXISTING' ? !hasMode : hasMode) return null;
  // In one-call intake the model chose an actual ID from the complete tree.
  // A natural label or an ambiguous alias is not a second semantic authority.
  // Saved/draft worker identities are protected separately. The owned SQL turn
  // resolves catalog proposals; profile Save still owns capability admission.
  if (!Array.isArray(decision.proposedPath) || decision.proposedPath.length !== 0) return null;
  return { categoryId: matches[0].categoryId, action: decision.action, reason: decision.reason.trim().slice(0, 900) };
}


// Model-generated structural paths are proposals; SQL validates every node.
// Reject malformed paths instead of silently shortening them.
function checkedNewPath(decision, service) {
  const raw = decision?.proposedPath;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const expected = normalizedClassificationIdentity(service);
  if (!expected) return null;
  const path = [], seen = new Set();
  for (const part of raw) {
    if (typeof part !== 'string') return null;
    const label = part.trim(), identity = normalizedClassificationIdentity(label);
    if (!identity || Array.from(label).length > 120
        || /[<>\u0000-\u001f]/u.test(label) || seen.has(identity)) return null;
    seen.add(identity);
    path.push(label);
  }
  if (normalizedClassificationIdentity(path[path.length - 1]) !== expected
      || new TextEncoder().encode(JSON.stringify(path)).length > 16000) return null;
  return path;
}

export function hintDraftRevision(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function taskTaxonomyMode(geography) {
  if (geography?.mode === 'REMOTE') return 'REMOTE';
  if (['STATIONARY', 'POINT_TO_POINT', 'MULTI_STOP', 'AREA_BASED'].includes(geography?.mode)) return 'ON_SITE';
  return null;
}

export function taskTaxonomyScope({ priorCategory, category, priorDescription, proposedDescription }) {
  if (typeof proposedDescription === 'string') return proposedDescription;
  // A new service must not be classified using the old task's scope. A scope
  // already gathered before the first category is still useful.
  if (typeof priorCategory === 'string' && typeof category === 'string' &&
      normalizedClassificationIdentity(priorCategory) !== normalizedClassificationIdentity(category)) return '';
  return typeof priorDescription === 'string' ? priorDescription : '';
}

function stableTaxonomyValue(value) {
  if (Array.isArray(value)) return value.map(stableTaxonomyValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort()
    .map((key) => [key, stableTaxonomyValue(value[key])]));
  return value;
}

export function taskClassificationFingerprint({ service, scopeSummary, mode, handoff }) {
  const normalizedService = normalizedClassificationIdentity(service);
  if (!normalizedService || !['ON_SITE','REMOTE'].includes(mode)) return null;
  const normalizedScope = typeof scopeSummary === 'string'
    ? scopeSummary.normalize('NFKC').trim().replace(/\s+/gu,' ').toLocaleLowerCase('sr') : '';
  const normalizedHandoff = mode === 'REMOTE' ? (decodeServiceHandoff(handoff) ?? null) : null;
  return JSON.stringify(stableTaxonomyValue({ service: normalizedService, scope: normalizedScope, mode, handoff: normalizedHandoff }));
}

export function workerSkillsFingerprint(skills) {
  if (!Array.isArray(skills)) return null;
  return [...new Set(skills.map(normalizedClassificationIdentity).filter(Boolean))].sort().join('|');
}

export function storeClarificationHint(conversationId, draftRevision, hint) {
  if (!conversationId) return;
  draftRevision = hintDraftRevision(draftRevision);
  if (draftRevision === null) return;
  setHintMemorySlot({
    service: hint.service, mode: hint.mode, ambiguityPrompt: hint.ambiguityPrompt, reason: hint.reason,
    conversationId,
    draftRevision,
    consumed: false,
    timestamp: Date.now(),
  });
}

export function getUnconsumedClarificationHint(conversationId, draftRevision) {
  if (!conversationId) return null;
  draftRevision = hintDraftRevision(draftRevision);
  if (draftRevision === null) return null;
  const found = hintMemorySlot(conversationId, draftRevision);
  if (!found || found.consumed) return null;
  const key = hintMemoryKey(conversationId, draftRevision);
  clarificationHintSlots.delete(key);
  clarificationHintSlots.set(key, found); // LRU only; never renew the timestamp.
  return found;
}

export function consumeClarificationHint(conversationId, draftRevision, service) {
  if (!conversationId) return;
  draftRevision = hintDraftRevision(draftRevision);
  if (draftRevision === null) return;
  const previous = hintMemorySlot(conversationId, draftRevision);
  // Replace the fence even when the named service differs. Confirmed consume
  // drops the private text; an unrelated current hint keeps its original age.
  setHintMemorySlot(previous && !previous.consumed && service && previous.service !== service
    ? { ...previous }
    : { conversationId, draftRevision, consumed: true, timestamp: Date.now() });
}

const trimSqlSpaces = value => typeof value === 'string' ? value.replace(/^ +| +$/g, '') : value;

function cacheConfirmedHint(hint, previous) {
  // Same-isolate guard only: a late read/ACK cannot overwrite a newer hint or
  // resurrect an entry consumed while the request was in flight.
  const current = hintMemorySlot(hint.conversationId, hint.draftRevision);
  if (current !== previous) return false;
  storeClarificationHint(hint.conversationId, hint.draftRevision, hint);
  return true;
}

function decodeClarificationHint(res, conversationId, draftRevision) {
  if (res?.ok === false) return null;
  const data = res?.ok === true ? res.data : res;
  const canonicalText = (value, min, max) => typeof value === 'string' && value === trimSqlSpaces(value) &&
    Array.from(value).length >= min && Array.from(value).length <= max;
  if (!data || typeof data !== 'object' || Array.isArray(data) ||
      data.conversationId !== conversationId || data.draftRevision !== draftRevision ||
      !canonicalText(data.service, 1, 200) || ![null, 'ON_SITE', 'REMOTE'].includes(data.mode) ||
      !canonicalText(data.ambiguityPrompt, 8, 600) ||
      !(data.reason === null || canonicalText(data.reason, 1, 300))) return null;
  return { conversationId, draftRevision, service: data.service, mode: data.mode,
    ambiguityPrompt: data.ambiguityPrompt, reason: data.reason };
}

// In-memory clarification hints (0 database roundtrips per turn).
// DB RPC calls (rpc_taxonomy_*_turn_hint_*) are retired to eliminate turn latency.
export async function persistClarificationHint(_rpc, hint) {
  if (!hint?.conversationId) return false;
  const draftRevision = hintDraftRevision(hint.draftRevision);
  if (draftRevision === null) return false;
  const reason = typeof hint.reason === 'string'
    ? trimSqlSpaces(boundedCodepoints(trimSqlSpaces(hint.reason), 300)) || null
    : hint.reason ?? null;
  const normalizedHint = {
    ...hint,
    draftRevision,
    service: trimSqlSpaces(hint.service),
    mode: hint.mode ?? null,
    ambiguityPrompt: trimSqlSpaces(hint.ambiguityPrompt),
    reason,
  };
  setHintMemorySlot({
    ...normalizedHint,
    consumed: false,
    timestamp: Date.now(),
  });
  return true;
}

export async function persistConsumeClarificationHint(_rpc, conversationId, draftRevision, service) {
  draftRevision = hintDraftRevision(draftRevision);
  if (!conversationId || draftRevision === null) return false;
  consumeClarificationHint(conversationId, draftRevision, service);
  return true;
}

export async function fetchUnconsumedClarificationHint(_rpc, conversationId, draftRevision) {
  return getUnconsumedClarificationHint(conversationId, draftRevision);
}

export function runInBackground(promise) {
  const safe = Promise.resolve(promise).catch(() => {
    // Exception text may contain provider/user data. Logging must also remain
    // non-fatal: this promise is deliberately detached from the foreground.
    try { console.warn('BG_TAXONOMY_ARCHITECT_WARN', 'FAILED'); } catch { /* Non-fatal telemetry. */ }
  });
  if (typeof globalThis.EdgeRuntime?.waitUntil === 'function') {
    globalThis.EdgeRuntime.waitUntil(safe);
    return Promise.resolve();
  }
  return safe;
}

export function indexFullCatalog(catalogVersion, catalogFingerprint, categories, verifiedComplete = false) {
  const byNormalizedKey = new Map();
  for (const cat of categories) {
    const labelKey = normalizedClassificationIdentity(cat.label);
    if (labelKey) {
      const list = byNormalizedKey.get(labelKey) ?? [];
      list.push(cat);
      byNormalizedKey.set(labelKey, list);
    }
    for (const alias of cat.aliases ?? []) {
      const aliasKey = normalizedClassificationIdentity(alias);
      if (aliasKey) {
        const list = byNormalizedKey.get(aliasKey) ?? [];
        if (!list.includes(cat)) list.push(cat);
        byNormalizedKey.set(aliasKey, list);
      }
    }
  }

  return {
    catalogVersion,
    catalogFingerprint,
    categories,
    byNormalizedKey,
    verifiedComplete,
  };
}

// In-Memory RAM cache for the Deno isolate (0 DB queries on warm turns).
let memoryCachedCatalog = null;
let catalogLoadingPromise = null;
const CATALOG_RAM_CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export function invalidateCatalogCache() {
  memoryCachedCatalog = null;
  catalogLoadingPromise = null;
}

export async function loadFullCatalogTree(rpc, signal) {
  const assertActive = () => {
    if (signal?.aborted) throw new Error('FULL_CATALOG_ABORTED');
  };
  assertActive();

  const now = Date.now();
  if (memoryCachedCatalog && (now - memoryCachedCatalog.cachedAt < CATALOG_RAM_CACHE_TTL_MS)) {
    return memoryCachedCatalog.catalog;
  }

  if (catalogLoadingPromise) {
    return catalogLoadingPromise;
  }

  catalogLoadingPromise = (async () => {
    try {
      const indexed = await fetchFullCatalogTreeFromDb(rpc, signal);
      if (indexed?.verifiedComplete) {
        memoryCachedCatalog = { catalog: indexed, cachedAt: Date.now() };
      }
      return indexed;
    } finally {
      catalogLoadingPromise = null;
    }
  })();

  return catalogLoadingPromise;
}

async function fetchFullCatalogTreeFromDb(rpc, signal) {
  const assertActive = () => {
    if (signal?.aborted) throw new Error('FULL_CATALOG_ABORTED');
  };
  assertActive();
  // A snapshot is complete only when its own count matches its actual items;
  // metadata equality alone cannot certify a complete current tree.
  try {
    const snapRes = await rpc('rpc_taxonomy_fetch_snapshot_v1', { p_generation: 1 }, signal, 2500);
    assertActive();
    const snap = snapRes?.ok ? snapRes.data : snapRes;
    if (snap && Number.isSafeInteger(snap.catalogVersion) && snap.catalogVersion > 0
        && typeof snap.catalogFingerprint === 'string' && snap.catalogFingerprint.length > 0
        && Array.isArray(snap.categories) && Number.isSafeInteger(snap.count)
        && snap.count === snap.categories.length) {
      const ids = new Set();
      for (const item of snap.categories) {
        if (!item || typeof item.categoryId !== 'string' || !item.categoryId
            || ids.has(item.categoryId)) throw new Error('FULL_CATALOG_SNAPSHOT_INVALID');
        ids.add(item.categoryId);
      }
      // Use the fresh authoritative complete response even if metadata has not
      // changed; the admission fingerprint does not cover every display label.
      // Count alone cannot certify parent closure. Refuse malformed trees
      // before returning the index used by either model path.
      formatFullCatalogHierarchy({ verifiedComplete: true, categories: snap.categories });
      assertActive();
      return indexFullCatalog(snap.catalogVersion, snap.catalogFingerprint, snap.categories, true);
    }
  } catch {
    // Caller cancellation is not permission to start another catalog read.
    assertActive();
    // Snapshot RPC unavailable, malformed or not yet deployed: use a complete
    // paged walk. Neither path may return an unverified partial result.
  }

  assertActive();
  const metaRes = await rpc('rpc_taxonomy_query_catalog_service', {
    p_query: { operation: 'META', scope: 'ALL', limit: 1 },
  }, signal, 3000);
  assertActive();
  const meta = metaRes?.ok ? metaRes.data : metaRes;
  // Admission metadata omits display/alias labels. An equal pair cannot certify
  // unchanged model input or authorize stale fallback after a failed snapshot.
  // Until the server supplies a complete content stamp, drain the current pages.

  // Fallback: drain EVERY ROOTS and CHILDREN cursor. Limits refuse work instead
  // of silently cutting off a catalog and declaring an absent service new.
  const PAGE_LIMIT = 100, MAX_PAGES = 2048, MAX_NODES = 20000, BATCH = 16;
  let pageReads = 0, catalogVersion = null, catalogFingerprint = null;
  const allNodes = new Map(), queue = [];
  const readPages = async (operation, categoryId = null) => {
    const result = [], cursors = new Set();
    let cursor = null;
    do {
      assertActive();
      if (++pageReads > MAX_PAGES) throw new Error('FULL_CATALOG_PAGE_LIMIT');
      const p_query = { operation, scope: 'ALL', limit: PAGE_LIMIT };
      if (categoryId !== null) {
        p_query.categoryId = categoryId;
        p_query.catalogVersion = catalogVersion;
        p_query.catalogFingerprint = catalogFingerprint;
      }
      if (cursor !== null) p_query.cursor = cursor;
      const response = await rpc('rpc_taxonomy_query_catalog_service', { p_query }, signal, 4000);
      assertActive();
      const page = response?.ok ? response.data : response;
      if (!page || !Array.isArray(page.items)
          || !Number.isSafeInteger(page.catalogVersion) || page.catalogVersion < 1
          || typeof page.catalogFingerprint !== 'string' || !page.catalogFingerprint
          || page.operation !== operation || page.scope !== 'ALL'
          || !Number.isSafeInteger(page.count) || page.count !== page.items.length
          || !Object.hasOwn(page, 'nextCursor')
          || (page.nextCursor !== null
              && (typeof page.nextCursor !== 'string' || !page.nextCursor))) {
        throw new Error('FULL_CATALOG_PAGE_INVALID');
      }
      if (catalogVersion === null) {
        catalogVersion = page.catalogVersion;
        catalogFingerprint = page.catalogFingerprint;
      } else if (page.catalogVersion !== catalogVersion
          || page.catalogFingerprint !== catalogFingerprint) {
        throw new Error('FULL_CATALOG_VERSION_CHANGED');
      }
      for (const item of page.items) {
        if (!item || typeof item.categoryId !== 'string' || !item.categoryId
            || typeof item.isLeaf !== 'boolean'
            || (operation === 'ROOTS' && item.parentId !== null)
            || (operation === 'CHILDREN' && item.parentId !== categoryId)) {
          throw new Error('FULL_CATALOG_ITEM_INVALID');
        }
        result.push(item);
      }
      const next = page.nextCursor;
      if (next !== null) {
        if (cursors.has(next) || page.items.length === 0) {
          throw new Error('FULL_CATALOG_CURSOR_STALLED');
        }
        cursors.add(next);
      }
      cursor = next;
    } while (cursor !== null);
    return result;
  };

  const roots = await readPages('ROOTS');
  assertActive();
  if (meta && Number.isSafeInteger(meta.catalogVersion)
      && (meta.catalogVersion !== catalogVersion
          || meta.catalogFingerprint !== catalogFingerprint)) {
    throw new Error('FULL_CATALOG_META_STALE');
  }
  const accept = item => {
    if (allNodes.has(item.categoryId)) throw new Error('FULL_CATALOG_DUPLICATE_ID');
    if (allNodes.size >= MAX_NODES) throw new Error('FULL_CATALOG_NODE_LIMIT');
    allNodes.set(item.categoryId, item);
    if (!item.isLeaf) queue.push(item.categoryId);
  };
  for (const root of roots) accept(root);
  while (queue.length > 0) {
    assertActive();
    const batch = queue.splice(0, BATCH);
    // Concurrent reads, deterministic insertion in parent/batch order.
    const childLists = await Promise.all(batch.map(id => readPages('CHILDREN', id)));
    assertActive();
    for (let i = 0; i < childLists.length; i++) {
      if (childLists[i].length === 0) throw new Error('FULL_CATALOG_NONLEAF_EMPTY');
      for (const child of childLists[i]) accept(child);
    }
  }

  // A paged walk also needs coherent ancestry before it can claim completeness.
  const completeNodes = [...allNodes.values()];
  formatFullCatalogHierarchy({ verifiedComplete: true, categories: completeNodes });
  assertActive();
  return indexFullCatalog(catalogVersion, catalogFingerprint, completeNodes, true);
}

/**
 * The classifier must see the same parent/child structure regardless of the
 * order in a snapshot or in paged ROOTS/CHILDREN responses. Never infer a
 * hierarchy from indentation on an arbitrary (e.g. alphabetical) list.
 *
 * This is only model input: it grants NO authority to create/reuse a category,
 * change modes, or skip the signed review/save admission.
 */
export function formatFullCatalogHierarchy(catalog) {
  if (catalog?.verifiedComplete !== true || !Array.isArray(catalog.categories)
      || catalog.categories.length === 0 || catalog.categories.length > 20000) {
    throw new Error('FULL_CATALOG_HIERARCHY_UNVERIFIED');
  }
  const byId = new Map(), children = new Map();
  for (const node of catalog.categories) {
    const id = node?.categoryId;
    const parentId = node?.parentId ?? null;
    if (typeof id !== 'string' || !id || byId.has(id)
        || !Object.hasOwn(node, 'parentId')
        || (parentId !== null && (typeof parentId !== 'string' || !parentId || parentId === id))
        || typeof node?.label !== 'string' || !node.label.trim()
        || typeof node?.isLeaf !== 'boolean'
        || !Array.isArray(node?.aliases) || !Array.isArray(node?.modes)
        || !node.aliases.every(alias => typeof alias === 'string')
        || !node.modes.every(mode => typeof mode === 'string')) {
      throw new Error('FULL_CATALOG_HIERARCHY_INVALID');
    }
    byId.set(id, { ...node, parentId });
    const siblings = children.get(parentId) ?? [];
    siblings.push(id);
    children.set(parentId, siblings);
  }
  for (const { parentId } of byId.values()) {
    if (parentId !== null && !byId.has(parentId)) throw new Error('FULL_CATALOG_HIERARCHY_ORPHAN');
  }
  const roots = children.get(null) ?? [];
  if (roots.length === 0) throw new Error('FULL_CATALOG_HIERARCHY_CYCLE');
  for (const ids of children.values()) ids.sort();
  const seen = new Set(), lines = [];
  const stack = roots.slice().reverse().map(id => ({ id, pathIds: [], depth: 0 }));
  let totalBytes = 0;
  const encoder = new TextEncoder();
  while (stack.length > 0) {
    const { id, pathIds, depth } = stack.pop();
    if (seen.has(id) || pathIds.length >= 32) throw new Error('FULL_CATALOG_HIERARCHY_CYCLE');
    seen.add(id);
    const node = byId.get(id), nested = children.get(id) ?? [];
    if (node.isLeaf && nested.length !== 0) throw new Error('FULL_CATALOG_HIERARCHY_LEAF_PARENT');
    const nextPathIds = [...pathIds, id];
    const indent = '  '.repeat(depth);
    const modesStr = node.modes && node.modes.length ? node.modes.join(',') : '';
    const leafStr = node.isLeaf ? ' LEAF' : '';
    const aliasStr = node.aliases && node.aliases.length ? ' ~ ' + node.aliases.join(', ') : '';
    const line = `${indent}[${id}${leafStr}${modesStr ? ' ' + modesStr : ''}] ${node.label}${aliasStr}`;
    totalBytes += encoder.encode(line).length + 1;
    if (totalBytes > 350000) throw new Error('FULL_CATALOG_HIERARCHY_TOO_LARGE');
    lines.push(line);
    for (let i = nested.length - 1; i >= 0; i--) {
      stack.push({ id: nested[i], pathIds: nextPathIds, depth: depth + 1 });
    }
  }
  if (seen.size !== byId.size) throw new Error('FULL_CATALOG_HIERARCHY_ORPHAN_OR_CYCLE');
  return lines.join('\n');
}

/** Validate the foreground model's decisions against its exact catalog snapshot.
 * Never fetch a second tree or infer/classify again when evidence is absent.
 */
export async function buildFullTreeTaxonomyProposals({
  items,
  conversationId,
  draftRevision,
  suppliedCatalog: catalog,
  suppliedDecisions,
}) {
  if (!Array.isArray(items) || items.length === 0) return null;
  if (!catalog?.verifiedComplete || !Array.isArray(catalog.categories)) return null;
  const validNodeIds = new Set(catalog.categories.map((c) => c.categoryId));

  const proposals = [];
  const unresolved = [];
  const clarifications = [];
  const failures = [];

  for (const item of items) {
    const service = typeof item?.service === 'string' ? item.service.trim() : '';
    const mode = item?.mode === 'REMOTE' ? 'REMOTE' : item?.mode === 'ON_SITE' ? 'ON_SITE' : null;
    if (!service || service.length < 3 || !mode) continue;
    const norm = normalizedClassificationIdentity(service);
    if (!norm) continue;
    // Unknown physical/digital handoff is not consent to digital delivery.
    const decodedHandoff = mode === 'REMOTE' ? decodeServiceHandoff(item.handoff) : undefined;

    unresolved.push({ service, mode, handoff: decodedHandoff });
  }

  if (unresolved.length > 0) {
    const aiDecisions = Array.isArray(suppliedDecisions) ? suppliedDecisions : [];
    for (const item of unresolved) {
      const norm = normalizedClassificationIdentity(item.service);
      const decisions = aiDecisions.filter(
        (d) => normalizedClassificationIdentity(d?.service) === norm && d?.mode === item.mode
      );
      const decision = decisions.length === 1 ? decisions[0] : null;
      const newPath = checkedNewPath(decision, item.service);
      if (validClarification(decision)) {
        const clarification = {
          conversationId: conversationId ?? null,
          draftRevision: draftRevision ?? null,
          service: item.service,
          mode: item.mode,
          action: 'NEEDS_CLARIFICATION',
          ambiguityPrompt: boundedCodepoints(decision.ambiguityPrompt.trim(), 500),
          reason: boundedCodepoints(decision.reason.trim(), 300),
          createdAt: new Date().toISOString(),
        };
        clarifications.push(clarification);
      } else if (semanticReuseHint(decision, item.service, item.mode, catalog)) {
        const reusable = semanticReuseHint(decision, item.service, item.mode, catalog);
        // Preserve the semantic ID for the owned SQL turn resolver.
        proposals.push({
          service: item.service, mode: item.mode, action: reusable.action,
          categoryId: reusable.categoryId, parentId: '', proposedPath: [],
          reason: reusable.reason, catalogVersion: catalog.catalogVersion,
          ...(item.handoff ? { handoff: item.handoff } : {}),
        });
      } else if (newPath && (
        decision?.action === 'CREATE_CHILD' && validNodeIds.has(decision.parentId)
          && decision.categoryId === ''
        || decision?.action === 'CREATE_NEW_BRANCH'
          && decision.parentId === '' && decision.categoryId === ''
      )) {
        // Only a verified existing parent or a deliberately new root is valid.
        // The owned SQL turn resolver, not this builder, performs the write.
        const parentId = decision.parentId;
        const rawReason = typeof decision?.reason === 'string' && decision.reason.trim().length >= 10
          ? decision.reason.trim().slice(0, 900)
          : `Nova specifična usluga „${item.service}“ raspoređena pod odgovarajuću granu kataloga.`;

        proposals.push({
          service: item.service,
          mode: item.mode,
          action: decision.action,
          categoryId: '',
          parentId,
          proposedPath: newPath,
          reason: rawReason,
          catalogVersion: catalog.catalogVersion,
          ...(item.handoff ? { handoff: item.handoff } : {}),
        });
      } else if (aiDecisions.length > 0) {
        recordFailure({ ...decisionFailure(decision), service: item.service, mode: item.mode }, failures);
      }
    }
  }

  return {
    catalogVersion: catalog.catalogVersion,
    proposals,
    clarifications,
    clarificationHint: clarifications[0] ?? null,
    failures,
  };
}

export async function buildWorkerFullTreeTaxonomyProposals({
  skills,
  messages,
  serviceModeContext,
  serviceModeChangesJson,
  conversationId,
  draftRevision,
  suppliedCatalog: catalog,
  suppliedDecisions,
}) {
  const cleanSkills = Array.isArray(skills)
    ? skills.filter((s) => typeof s === 'string' && s.trim().length >= 3).map((s) => s.trim())
    : [];
  if (cleanSkills.length === 0) return null;

  if (!catalog?.verifiedComplete || !Array.isArray(catalog.categories)) return null;
  const validNodeIds = new Set(catalog.categories.map((c) => c.categoryId));

  // Current-source, server-resolved draft IDs can survive the next question.
  // They remain draft intent: only profile Save grants worker capabilities.
  // A draft edit replaces the whole saved mode set for that service (including
  // an explicit removal of one half of BOTH), never unions old modes back in.
  const savedModes = Array.isArray(serviceModeContext?.savedServices) ? serviceModeContext.savedServices : [];
  const draftModes = Array.isArray(serviceModeContext?.draftServices) ? serviceModeContext.draftServices : [];
  const drafted = new Set(draftModes.map(item => normalizedClassificationIdentity(item?.service)));
  const priorModes = [...savedModes.filter(item => !drafted.has(normalizedClassificationIdentity(item?.service))), ...draftModes];
  const ownedMessages = Array.isArray(messages) ? messages : [];
  const { requests, invalidServices: invalidChanges } = inspectWorkerModeRequests(
    serviceModeChangesJson, { messages: ownedMessages,
      revision: Number.isSafeInteger(draftRevision) ? draftRevision - 1 : null, serviceModeContext },
    new Map(cleanSkills.map(service => [normalizedClassificationIdentity(service), service])));

  const savedEntriesValid = entries => entries.length > 0
    && new Set(entries.map(entry => entry.categoryId)).size === 1
    && entries.every(entry => executionMode(entry.mode)
      && (!Object.hasOwn(entry, 'handoff') || entry.mode === 'REMOTE' && decodeServiceHandoff(entry.handoff)));
  // Revalidate saved identity against this fresh complete catalog. Unchanged
  // choices do not need a paid opinion (or a new consent inferred by a model).
  // A rejected fresh declaration must still block preservation, never look
  // like an unrelated edit. Preserved draft intent never grants saved authority.
  const preservedIdentities = new Map();
  for (const service of cleanSkills) {
    const norm = normalizedClassificationIdentity(service);
    if (!norm || invalidChanges.has(norm) || requests.has(norm)) continue;
    const matches = catalog.byNormalizedKey.get(norm) ?? [];
    const saved = priorModes.filter(entry => normalizedClassificationIdentity(entry?.service) === norm);
    if (!savedEntriesValid(saved)) continue;
    const identities = catalog.categories.filter(node => node.categoryId === saved[0].categoryId);
    const identity = identities.length === 1 ? identities[0] : null;
    // The server-owned saved category ID carries the confirmed meaning. A
    // natural service name need not become a global alias just to retain it.
    // Still refuse a removed/non-leaf category, a removed mode, or a catalog
    // name now claiming a different identity. This never grants a new mode.
    if (catalog.verifiedComplete && identity?.isLeaf === true
        && Array.isArray(identity.modes) && saved.every(entry => identity.modes.includes(entry.mode))
        && matches.every(match => match.categoryId === identity.categoryId)) {
      preservedIdentities.set(norm, identity);
    }
  }
  const aiItems = Array.isArray(suppliedDecisions) ? suppliedDecisions : [];
  const failures = [];

  const proposals = [];
  const clarifications = [];
  const seenKeys = new Set();
  const unresolvedServices = [];

  for (const service of cleanSkills) {
    const norm = normalizedClassificationIdentity(service);
    if (!norm) continue;

    // Ignore unsolicited provider entries for work deliberately not requested.
    const matchingAi = preservedIdentities.has(norm) ? []
      : aiItems.filter((item) => normalizedClassificationIdentity(item?.service) === norm);
    const matchingPrior = priorModes.filter((item) => normalizedClassificationIdentity(item?.service) === norm);

    const requested = requests.get(norm);
    if (invalidChanges.has(norm)) {
      // A rejected/duplicated fresh declaration is not an unrelated edit. Do
      // not silently resurrect the old mode while that change is unresolved.
      unresolvedServices.push(service);
      recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'WORKER_MODE_REQUEST_INVALID', service }, failures);
      continue;
    }
    const savedValid = savedEntriesValid(matchingPrior);
    const chosenEntries = requested ? requested.modes.map(mode => {
      const saved = savedValid ? matchingPrior.find(entry => entry.mode === mode) : null;
      const handoff = mode === 'REMOTE'
        ? Object.hasOwn(requested, 'handoff') ? decodeServiceHandoff(requested.handoff) : decodeServiceHandoff(saved?.handoff)
        : undefined;
      return { mode, ...(handoff ? { handoff } : {}) };
    }) : savedValid ? matchingPrior : [];
    const addClarification = (decision, mode) => {
      // A question is NOT a completed mode. Keep its service visible to the
      // later review/recovery path, including one unresolved half of BOTH.
      unresolvedServices.push(service);
      clarifications.push({
        conversationId: conversationId ?? null,
        draftRevision: draftRevision ?? null,
        service, mode, action: 'NEEDS_CLARIFICATION',
        ambiguityPrompt: boundedCodepoints(decision.ambiguityPrompt.trim(), 500),
        reason: boundedCodepoints(decision.reason.trim(), 300), createdAt: new Date().toISOString(),
      });
    };
    if (chosenEntries.length === 0) {
      unresolvedServices.push(service);
      // A valid actual question is distinct from unavailable/malformed output.
      if (matchingAi.length === 1 && validClarification(matchingAi[0])
          && ['UNKNOWN', 'ON_SITE', 'REMOTE'].includes(matchingAi[0].mode)) {
        addClarification(matchingAi[0], null);
      } else if (aiItems.length > 0) {
        recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'WORKER_MODE_UNCONFIRMED', service }, failures);
      }
      continue;
    }

    for (const chosen of chosenEntries) {
      const dedupeKey = `${norm}|${chosen.mode}`;
      if (seenKeys.has(dedupeKey)) continue;
      seenKeys.add(dedupeKey);

      const decisions = matchingAi.filter(entry => entry.mode === chosen.mode);
      const decision = decisions.length === 1 ? decisions[0] : null;
      if (validClarification(decision)) {
        addClarification(decision, chosen.mode);
        continue;
      }
      if (requested && (!['REUSE_EXISTING', 'EXTEND_MODE', 'CREATE_CHILD', 'CREATE_NEW_BRANCH'].includes(decision?.action)
          || typeof decision.reason !== 'string' || decision.reason.trim().length < 10)) {
        unresolvedServices.push(service);
        recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'PROVIDER_INVALID_DECISION', service, mode: chosen.mode }, failures);
        continue;
      }
      // A requested mode/handoff edit is not a request to reclassify the same
      // saved service. Use its owned identity even when its natural label is
      // not a catalog alias; a replacement service is a separate skill change.
      if (requested && savedValid
          && (!['REUSE_EXISTING', 'EXTEND_MODE'].includes(decision.action)
            || decision.categoryId !== matchingPrior[0].categoryId)) {
        unresolvedServices.push(service);
        recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'WORKER_SERVICE_CATEGORY_ID_CONFLICT', service }, failures);
        continue;
      }

      const preservedIdentity = preservedIdentities.get(norm);
      const matches = preservedIdentity ? [preservedIdentity] : catalog.byNormalizedKey.get(norm) ?? [];
      if (matches.length === 1 && !requested) {
        const match = matches[0];
        const hasMode = Array.isArray(match.modes) && match.modes.includes(chosen.mode);
        // Saved continuity cannot repair a changed catalog or extend a mode.
        if (chosen.categoryId !== match.categoryId || !hasMode) {
          unresolvedServices.push(service);
          continue;
        }
        proposals.push({
          service,
          mode: chosen.mode,
          action: 'REUSE_EXISTING',
          categoryId: match.categoryId,
          parentId: '',
          proposedPath: [],
          reason: `Sačuvan je isti serverski ID i način rada za uslugu „${service}“.`,
          catalogVersion: catalog.catalogVersion,
          ...(chosen.mode === 'REMOTE' && chosen.handoff ? { handoff: chosen.handoff } : {}),
        });
      } else {
        const isValidParent = decision?.parentId && validNodeIds.has(decision.parentId);
        // Match Need: a new child may reference an existing parent but never
        // claim an existing category identity in the same model decision.
        const isNewCategory = decision?.categoryId === '';
        const newPath = checkedNewPath(decision, service);
        const isNewRoot = decision?.action === 'CREATE_NEW_BRANCH'
          && decision.parentId === '' && decision.categoryId === '';
        const reusable = requested
          ? semanticReuseHint(decision, service, chosen.mode, catalog) : null;
        if (reusable) {
          // Only a USER-quoted mode can survive as a semantic ID proposal.
          // SQL resolves its catalog identity; profile Save admits capabilities.
          proposals.push({
            service, mode: chosen.mode, action: reusable.action,
            categoryId: reusable.categoryId, parentId: '', proposedPath: [],
            reason: reusable.reason, catalogVersion: catalog.catalogVersion,
            ...(chosen.mode === 'REMOTE' && chosen.handoff ? { handoff: chosen.handoff } : {}),
          });
          unresolvedServices.push(service);
        } else if (requested && newPath && (
          decision?.action === 'CREATE_CHILD' && isValidParent && isNewCategory || isNewRoot
        )) {
          const rawReason = typeof decision.reason === 'string' && decision.reason.trim().length >= 10
            ? decision.reason.trim().slice(0, 900)
            : `Nova specifična usluga „${service}“ raspoređena pod odgovarajuću granu kataloga.`;
          proposals.push({
            service,
            mode: chosen.mode,
            action: decision.action,
            categoryId: '',
            parentId: decision.parentId,
            proposedPath: newPath,
            reason: rawReason,
            catalogVersion: catalog.catalogVersion,
            ...(chosen.mode === 'REMOTE' && chosen.handoff ? { handoff: chosen.handoff } : {}),
          });
        } else {
          // Missing/invalid mode decisions cannot silently disappear when a
          // different mode for the same service already has a proposal.
          unresolvedServices.push(service);
          if (aiItems.length > 0) {
            recordFailure({ ...decisionFailure(decision), service, mode: chosen.mode }, failures);
          }
        }
      }
    }
    // One specific service cannot acquire different canonical IDs or parents
    // because the provider answered ON_SITE and REMOTE separately. Refuse the
    // conflicting hints together; valid unrelated services remain untouched.
    const claimed = proposals.filter(p => normalizedClassificationIdentity(p.service) === norm);
    const identities = claimed.map(p => p.categoryId
      ? JSON.stringify(['EXISTING', p.categoryId])
      : JSON.stringify(['NEW', p.action, p.parentId,
          ...p.proposedPath.map(normalizedClassificationIdentity)]));
    if (new Set(identities).size > 1) {
      for (let i = proposals.length - 1; i >= 0; i--) {
        if (normalizedClassificationIdentity(proposals[i].service) === norm) proposals.splice(i, 1);
      }
      unresolvedServices.push(service);
      recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'WORKER_SERVICE_CATEGORY_ID_CONFLICT', service }, failures);
    } else if (claimed.length > 0 && chosenEntries.some(entry => !claimed.some(p => p.mode === entry.mode))) {
      // The existing capture RPC stores proposals only. A local unresolved flag
      // cannot protect that boundary: half of BOTH would look like a complete
      // single-mode proposal. Keep this service atomic until all its requested
      // modes are classified; retain its real clarification and other services.
      // This is not consent, a durable retry, or a canonical taxonomy write.
      for (let i = proposals.length - 1; i >= 0; i--) {
        if (normalizedClassificationIdentity(proposals[i].service) === norm) proposals.splice(i, 1);
      }
      unresolvedServices.push(service);
      recordFailure({ status: 'RETRYABLE_PROVIDER', code: 'WORKER_SERVICE_MODE_SET_INCOMPLETE', service }, failures);
    }
  }

  return {
    catalogVersion: catalog.catalogVersion,
    proposals,
    clarifications,
    clarificationHint: clarifications[0] ?? null,
    failures,
    unresolvedServices: [...new Set(unresolvedServices)],
  };
}
