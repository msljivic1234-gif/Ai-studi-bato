import type { JavniProfilProjekcija, NeedUrgencyProjection, PrilikaProjekcija } from '../contracts/projections';
import type { Izvor } from './ports';
import type { DiscoveryV1Item } from './discoveryV1Contract';
import { discoveryV1EnrichmentTargets, discoveryV1Opportunities } from './discoveryV1MarketplaceAdapter';
import { mediaAssetId } from './mediaAssetId';
import { publicProfileClientService } from './publicProfileClientService';
import { readNeedUrgencies } from './needUrgencyClientService';
import type { TaskRelation, TaskRelationIndex } from './taskRelation';

export const DISCOVERY_V1_OVERLAY_LIMIT = 100;
export const DISCOVERY_V1_PROFILE_CONCURRENCY = 4;

export type DiscoveryV1OverlayLoaders = {
  relations: (needIds: readonly string[], signal: AbortSignal) => Promise<TaskRelationIndex>;
  profile: (profileId: string, signal: AbortSignal) => Promise<JavniProfilProjekcija | null>;
  urgencies: (rows: readonly { id: string; urgent: boolean }[], signal: AbortSignal) => Promise<Map<string, NeedUrgencyProjection>>;
};
/**
 * The optional enrichment of the rows on screen. While `loading`, the entries are what the last settled load knew about the ids that are
 * still asked for (`admitted` is already the new request): a reload replaces an entry only when its fresh answer lands, adds the new ids as
 * they answer and has already dropped the ids that are no longer asked for. So `relations` is non-null whenever an earlier relation read
 * succeeded, and a row without an answer is bare, never invented. After a failed read the entries stay and the matching `errors` flag is set.
 */
export type DiscoveryV1OverlaySnapshot = {
  active: boolean; generation: number; sliceKey: string | null; loading: boolean;
  admitted: ReadonlyMap<string, string>;
  relations: TaskRelationIndex | null; profiles: ReadonlyMap<string, JavniProfilProjekcija>;
  urgency: ReadonlyMap<string, NeedUrgencyProjection>;
  /** Requested requester profiles with nothing to show: answered absent, or never answered and never known. Disjoint from `profiles`. */
  missingProfiles: ReadonlySet<string>;
  errors: { relations: boolean; profiles: boolean; urgencies: boolean };
};
export type DiscoveryV1OverlayLoadResult = { kind: 'applied'; snapshot: DiscoveryV1OverlaySnapshot } | { kind: 'stale' };

const unknownRelation: TaskRelation = { kind: 'UNKNOWN' };
const formatRating = (profile: JavniProfilProjekcija | undefined): string | null => {
  if (!profile?.poverenje.ocenaDostupna || profile.poverenje.ocenaProsek === null) return null;
  return profile.poverenje.ocenaProsek.toLocaleString('sr-Latn-RS', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
};
const reviewCount = (profile: JavniProfilProjekcija | undefined): number | null => {
  if (!profile?.poverenje.recenzijeDostupne) return null;
  const value = profile.poverenje.brojRecenzija;
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
};

const overlayFingerprint=(item:DiscoveryV1Item)=>[item.revision,item.requesterProfileId,item.urgent?'1':'0'].join(':');
const noErrors = () => ({ relations: false, profiles: false, urgencies: false });

/** The answers of an earlier read for the ids asked now, and UNKNOWN for every other id: a dropped id is not answered any more. */
const scopeRelations = (index: TaskRelationIndex, asked: readonly string[]): TaskRelationIndex => {
  const answers = new Map(asked.map(id => [id, index.relation(id)] as const));
  return { owned: new Set(asked.filter(id => index.owned.has(id))), applied: new Set(asked.filter(id => index.applied.has(id))),
    relation: needId => answers.get(needId) ?? unknownRelation };
};

export function discoveryV1OverlaySliceKey(items: readonly DiscoveryV1Item[]): string {
  if (items.length > DISCOVERY_V1_OVERLAY_LIMIT) throw new Error('DISCOVERY_V1_OVERLAY_BOUND');
  const ids = new Set<string>();
  return items.map(item => {
    if (ids.has(item.id)) throw new Error('DISCOVERY_V1_OVERLAY_DUPLICATE');
    ids.add(item.id);
    return [item.id, item.revision, item.requesterProfileId, item.urgent ? '1' : '0'].join(':');
  }).join('|');
}

type Overlaid = PrilikaProjekcija & { revision: number };
/**
 * EX-03: a row with its details is made again only when what it shows changes (the row, its publisher's profile object or its urgency object); every
 * commit used to build every row anew, which also re-rendered every memoised list row. Nothing may mutate what this returns.
 */
const overlaid = new WeakMap<Overlaid, { profile: JavniProfilProjekcija | undefined; urgency: NeedUrgencyProjection | undefined; value: Overlaid }>();
export function discoveryV1ApplyOverlayItem(item: Overlaid, overlay: DiscoveryV1OverlaySnapshot, admitted = true): Overlaid {
  const profile = overlay.profiles.get(item.narucilacProfilId), urgency = admitted ? overlay.urgency.get(item.id) : undefined;
  if (!profile && !urgency) return item;
  const known = overlaid.get(item);
  if (known && known.profile === profile && known.urgency === urgency) return known.value;
  const value = { ...item, ...(urgency ? { urgency } : {}), narucilacIme: profile?.ime ?? '',
    narucilacOcena: formatRating(profile), narucilacBrojOcena: reviewCount(profile),
    narucilacAvatarId: profile?.avatarPutanja ? mediaAssetId(profile.avatarPutanja) : null };
  overlaid.set(item, { profile, urgency, value });
  return value;
}
/** The rows with what the overlay knows about them; a row it has no answer for (not admitted, or not yet answered) stays bare. */
export function discoveryV1ApplyOverlays(items: readonly DiscoveryV1Item[], overlay: DiscoveryV1OverlaySnapshot)
  : (PrilikaProjekcija & { revision: number })[] {
  const base = discoveryV1Opportunities(items);
  return base.map((item, index) => {
    const source = items[index];
    if (overlay.admitted.get(source.id) !== overlayFingerprint(source)) return item;
    const profile = overlay.profiles.get(source.requesterProfileId), urgency = overlay.urgency.get(source.id);
    const known = overlaid.get(item);
    if (known && known.profile === profile && known.urgency === urgency) return known.value;
    const value = { ...item, ...(urgency ? { urgency } : {}), narucilacIme: profile?.ime ?? '',
      narucilacOcena: formatRating(profile), narucilacBrojOcena: reviewCount(profile),
      narucilacAvatarId: profile?.avatarPutanja ? mediaAssetId(profile.avatarPutanja) : null };
    overlaid.set(item, { profile, urgency, value });
    return value;
  });
}
export function discoveryV1OverlayRelation(overlay: DiscoveryV1OverlaySnapshot, needId: string): TaskRelation {
  return overlay.relations?.relation(needId) ?? unknownRelation;
}

export function createDiscoveryV1ExistingOverlayLoaders(source: Pick<Izvor, 'odnosiPremaZadacima'>): DiscoveryV1OverlayLoaders {
  return {
    relations: (ids, signal) => source.odnosiPremaZadacima(ids, { signal }),
    profile: (id, signal) => publicProfileClientService.javniProfil(id, signal),
    urgencies: (rows, signal) => readNeedUrgencies(rows, signal),
  };
}

export function createDiscoveryV1OverlayOwner(loaders: DiscoveryV1OverlayLoaders, isCurrent: () => boolean = () => true) {
  let active = true, generation = 0, controller: AbortController | null = null;
  const empty = (): DiscoveryV1OverlaySnapshot => ({ active, generation, sliceKey: null, loading: false, admitted: new Map(), relations: null,
    profiles: new Map(), urgency: new Map(), missingProfiles: new Set(), errors: noErrors() });
  let state = empty();
  const snapshot = (): DiscoveryV1OverlaySnapshot => ({ ...state, admitted:new Map(state.admitted), profiles: new Map(state.profiles), urgency: new Map(state.urgency),
    missingProfiles: new Set(state.missingProfiles), errors: { ...state.errors } });
  const current = (g: number) => active && generation === g && isCurrent();

  /** `reuseProfiles`: the profiles this owner already holds are not read again (a screen that comes back within minutes); the account's relations and urgencies always are. */
  async function load(items: readonly DiscoveryV1Item[], options: { reuseProfiles?: boolean } = {}): Promise<DiscoveryV1OverlayLoadResult> {
    if (!active) return { kind: 'stale' };
    const sliceKey = discoveryV1OverlaySliceKey(items), admitted=new Map(items.map(item=>[item.id,overlayFingerprint(item)] as const));
    const { needIds, profileIds } = discoveryV1EnrichmentTargets(items, DISCOVERY_V1_OVERLAY_LIMIT);
    controller?.abort();
    const own = new AbortController(); controller = own; const g = ++generation;
    // Stale-while-revalidate (independent review): what the last settled load knew about the ids still asked for stays until its fresh answer
    // lands. A dropped id goes now; a changed row (another revision, requester or urgency flag) does not carry the older row's urgency; a
    // requester's profile is the same person whichever of their rows asks for it. A retired owner starts from nothing (see `retire`).
    const kept = {
      relations: state.relations ? scopeRelations(state.relations, needIds) : null,
      profiles: new Map([...state.profiles].filter(([id]) => profileIds.includes(id))),
      urgency: new Map([...state.urgency].filter(([id]) => admitted.get(id) === state.admitted.get(id))),
    };
    state = { active: true, generation: g, sliceKey, loading: true, admitted, ...kept, missingProfiles: new Set(), errors: noErrors() };

    const relationTask = loaders.relations(needIds, own.signal).then(value => ({ ok: true as const, value }), () => ({ ok: false as const }));
    const urgencyRows = items.map(item => ({ id: item.id, urgent: item.urgent }));
    const urgencyTask = loaders.urgencies(urgencyRows, own.signal).then(value => ({ ok: true as const, value }), () => ({ ok: false as const }));
    // A landed answer: the profile, or null for one that is absent (gone, hidden). A read that failed or answered another profile lands nothing.
    const answered = new Map<string, JavniProfilProjekcija | null>();
    let profileCursor = 0, profileFailed = false;
    const worker = async () => {
      while (!own.signal.aborted && profileCursor < profileIds.length) {
        const id = profileIds[profileCursor++];
        if (options.reuseProfiles && kept.profiles.has(id)) continue;
        try {
          const value = await loaders.profile(id, own.signal);
          if (own.signal.aborted) return;
          if (value === null) { answered.set(id, null); continue; }
          if (value.profilId !== id || value.uloga !== 'narucilac') { profileFailed = true; continue; }
          answered.set(id, value);
        } catch { if (!own.signal.aborted) profileFailed = true; }
      }
    };
    await Promise.all([relationTask, urgencyTask,
      Promise.all(Array.from({ length: Math.min(DISCOVERY_V1_PROFILE_CONCURRENCY, profileIds.length) }, worker))]);
    const relations = await relationTask, urgencies = await urgencyTask;
    if (!current(g)) { own.abort(); return { kind: 'stale' }; }

    let urgenciesValid = urgencies.ok;
    if (urgencies.ok) {
      for (const [id, value] of urgencies.value) {
        const valid = needIds.includes(id) && (value.level === 'NORMAL' ? value.expiresAt === null
          : value.level === 'HITNO' && typeof value.expiresAt === 'string' && Number.isFinite(Date.parse(value.expiresAt)));
        if (!valid) { urgenciesValid = false; break; }
      }
    }
    const profiles = new Map<string, JavniProfilProjekcija>(), missingProfiles = new Set<string>();
    for (const id of profileIds) {
      // A fresh answer replaces the kept entry, absent included; without one the kept entry stays.
      const value = answered.has(id) ? answered.get(id) : kept.profiles.get(id);
      if (value) profiles.set(id, value); else missingProfiles.add(id);
    }
    state = { active: true, generation: g, sliceKey, loading: false, admitted, relations: relations.ok ? relations.value : kept.relations,
      profiles, urgency: urgencies.ok && urgenciesValid ? new Map(urgencies.value) : kept.urgency, missingProfiles,
      errors: { relations: !relations.ok, profiles: profileFailed, urgencies: !urgenciesValid } };
    if (controller === own) controller = null;
    own.abort();
    if (!urgenciesValid && urgencies.ok) throw new Error('DISCOVERY_V1_OVERLAY_URGENCY_INVALID');
    return { kind: 'applied', snapshot: snapshot() };
  }

  /** The screen has left and may come back: a load in flight is aborted and can never land; what the last settled load knew stays until the next one replaces it. */
  const suspend = () => {
    if (!active) return;
    generation++; controller?.abort(); controller = null;
    if (state.loading) state = { ...state, loading: false };
  };

  const retire = () => {
    if (!active) return;
    active = false; generation++; controller?.abort(); controller = null;
    state = empty();
  };
  return { load, snapshot, suspend, retire };
}
