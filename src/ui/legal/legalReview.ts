import type { LegalAcceptanceReceipt, LegalBundleStatus, LegalDocument } from '../../contracts/legal';
import type { ProcessorMapStatus } from '../../contracts/processorMap';
import type { Ishod } from '../../data/ports';
import type { LegalAcceptanceResult } from '../../data/legalClientService';

export function legalHttpsUrl(value: string): string | null {
  try { const url = new URL(value); return url.protocol === 'https:' && !!url.hostname && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function reviewedDocuments(bundle: LegalBundleStatus | null): [LegalDocument, LegalDocument] | null {
  if (!bundle?.ready || bundle.documents.length !== 2) return null;
  const terms = bundle.documents.find(doc => doc.kind === 'TERMS');
  const privacy = bundle.documents.find(doc => doc.kind === 'PRIVACY');
  return terms && privacy && [terms, privacy].every(doc => /^[0-9a-f]{64}$/.test(doc.sha256) && legalHttpsUrl(doc.url)) ? [terms, privacy] : null;
}
export async function boundedLegalRead<T>(read: () => Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([Promise.resolve().then(read), new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error('LEGAL_READ_TIMEOUT')), 15_000);
  })]); } finally { if (timer) clearTimeout(timer); }
}
type Intent = { key: string; terms: string; privacy: string };
type IntentJournal = { read: () => Intent | null; write: (intent: Intent | null) => void };
let sessionIntent: { owner: string; value: Intent | null } | null = null;
/** Retains only request coordinates across route remounts in this account session. */
export function sessionLegalIntentJournal(owner: string): IntentJournal {
  if (sessionIntent?.owner !== owner) sessionIntent = { owner, value: null };
  const scope = sessionIntent;
  return { read: () => sessionIntent === scope ? scope.value : null,
    write: value => { if (sessionIntent === scope) scope.value = value; } };
}
export type LegalReviewState = {
  bundle: LegalBundleStatus | null; processors: ProcessorMapStatus | null;
  loading: boolean; busy: boolean; error: string | null; processorError: string | null;
  pending: 'READ_REQUIRED' | 'REPLAY_AVAILABLE' | null; receipt: LegalAcceptanceReceipt | null;
};
type Dependencies = {
  isOwner: () => boolean; newId: () => string;
  intentJournal?: IntentJournal;
  readBundle: () => Promise<Ishod<LegalBundleStatus>>;
  readProcessors: () => Promise<Ishod<ProcessorMapStatus>>;
  accept: (key: string, terms: string, privacy: string) => Promise<LegalAcceptanceResult>;
  readAcceptance: (key: string) => Promise<Ishod<{ found: boolean; receipt: LegalAcceptanceReceipt | null }>>;
};
const unavailable = 'Dokumenti trenutno nisu dostupni. Pokušaj ponovo.';
const unknown = 'Ne znamo da li je prihvatanje sačuvano. Proveri ponovo.';

/** Keeps one exact reviewed intent across blur/readback/replay; no automatic write retry. */
export class LegalReviewController {
  private state: LegalReviewState = { bundle: null, processors: null, loading: true, busy: false,
    error: null, processorError: null, pending: null, receipt: null };
  private listeners = new Set<() => void>();
  private generation = 0; private focused = false; private intent: Intent | null = null;
  constructor(private readonly deps: Dependencies) { this.intent = deps.intentJournal?.read() ?? null; }
  private retain(intent: Intent | null) { this.intent = intent; this.deps.intentJournal?.write(intent); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  snapshot = () => this.state;
  private patch(patch: Partial<LegalReviewState>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(fn => fn()); }
  private current(generation = this.generation) { return this.focused && this.generation === generation && this.deps.isOwner(); }
  private ownsIntent(intent: Intent | null) {
    return this.intent === intent && (!this.deps.intentJournal || this.deps.intentJournal.read() === intent);
  }
  activate() {
    if (this.deps.intentJournal) this.intent = this.deps.intentJournal.read();
    this.focused = true; ++this.generation; this.patch({ busy: false, pending: this.intent ? 'READ_REQUIRED' : null }); void this.refresh();
  }
  deactivate() { this.focused = false; ++this.generation; }
  async refresh() {
    if (!this.current() || this.state.busy) return;
    const generation = ++this.generation;
    // What was read stays while it is read again (the screen shows it under the refresh at work, never a skeleton over it).
    // Nothing can be accepted meanwhile: `accept` and `readOutcome` refuse while `loading`. When the read lands, or fails, the
    // answer replaces it: a failed read leaves no stale bundle behind (it sets `bundle: null` below).
    this.patch({ loading: true, error: null, processorError: null });
    const [bundle, processors] = await Promise.allSettled([
      boundedLegalRead(this.deps.readBundle), boundedLegalRead(this.deps.readProcessors),
    ]);
    if (!this.current(generation)) return;
    this.patch({ loading: false,
      bundle: bundle.status === 'fulfilled' && bundle.value.ok ? bundle.value.podatak : null,
      error: bundle.status === 'fulfilled' ? bundle.value.ok ? null : bundle.value.poruka : unavailable,
      processors: processors.status === 'fulfilled' && processors.value.ok ? processors.value.podatak : null,
      processorError: processors.status === 'fulfilled' ? processors.value.ok ? null : processors.value.poruka : 'Podaci o obrađivačima trenutno nisu dostupni.',
    });
  }
  async accept(reviewedBundle = this.state.bundle) {
    if (!this.current() || !this.ownsIntent(this.intent) || reviewedBundle !== this.state.bundle || this.state.loading || this.state.busy) return;
    let intent = this.intent;
    if (intent) {
      // ABSENT permits only an explicit replay of the original reviewed bytes,
      // even if newer documents are now displayed. It never creates new consent.
      if (this.state.pending !== 'REPLAY_AVAILABLE') return;
    } else {
      const documents = reviewedDocuments(this.state.bundle);
      if (!documents || this.state.pending || this.state.bundle?.acceptedCurrentBundle) return;
      const [terms, privacy] = documents;
      if (this.state.receipt?.termsSha256 === terms.sha256 && this.state.receipt.privacySha256 === privacy.sha256) return;
      intent = { key: this.deps.newId(), terms: terms.sha256, privacy: privacy.sha256 };
      this.retain(intent);
    }
    const generation = this.generation;
    const current = () => this.current(generation) && this.ownsIntent(intent);
    this.patch({ busy: true, error: null, pending: 'READ_REQUIRED' });
    try {
      const result = await boundedLegalRead(() => {
        if (!current()) throw new Error('LEGAL_INTENT_CHANGED');
        return this.deps.accept(intent.key, intent.terms, intent.privacy);
      });
      if (!current()) return;
      if (result.ok && this.matches(result.podatak, intent)) { this.retain(null); this.patch({ receipt: result.podatak, pending: null, busy: false }); }
      else if (!result.ok && result.kod === 'LEGAL_REVIEW_CHANGED' && result.authoritativeReviewChanged === true) {
        // This replay was rejected for obsolete bytes. It says nothing about
        // whether an earlier request committed; fresh documents need fresh consent.
        this.retain(null); this.patch({ bundle: null, pending: null, error: result.poruka, busy: false });
      } else this.patch({ error: result.ok ? unknown : result.poruka, pending: 'READ_REQUIRED' });
    } catch { if (current()) this.patch({ error: unknown, pending: 'READ_REQUIRED' }); }
    finally { if (current()) this.patch({ busy: false }); }
  }
  async readOutcome() {
    if (!this.current() || !this.intent || !this.ownsIntent(this.intent) || this.state.busy || this.state.loading) return;
    const intent = this.intent, generation = this.generation;
    const current = () => this.current(generation) && this.ownsIntent(intent);
    this.patch({ busy: true, error: null });
    try {
      const result = await boundedLegalRead(() => {
        if (!current()) throw new Error('LEGAL_INTENT_CHANGED');
        return this.deps.readAcceptance(intent.key);
      });
      if (!current()) return;
      if (result.ok && result.podatak.found && result.podatak.receipt && this.matches(result.podatak.receipt, intent)) {
        this.retain(null); this.patch({ receipt: result.podatak.receipt, pending: null, busy: false });
      } else if (result.ok && result.podatak.found === false && result.podatak.receipt === null) {
        this.patch({ pending: 'REPLAY_AVAILABLE',
          error: 'Prethodno prihvatanje još nije pronađeno. Možete ponoviti isto prihvatanje.' });
      } else this.patch({ error: result.ok ? unknown : result.poruka, pending: 'READ_REQUIRED' });
    } catch { if (current()) this.patch({ error: unknown, pending: 'READ_REQUIRED' }); }
    finally { if (current()) this.patch({ busy: false }); }
  }
  private matches(receipt: LegalAcceptanceReceipt, intent: Intent) {
    return receipt.accepted === true && receipt.termsSha256 === intent.terms && receipt.privacySha256 === intent.privacy;
  }
}
