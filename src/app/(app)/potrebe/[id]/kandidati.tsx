import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { ProfilePhoto } from '../../../../ui/media/ContextPhotos';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { KandidatProjekcija, PotrebaProjekcija } from '../../../../contracts/projections';
import type { Ishod, Izvor, IzborKomanda } from '../../../../data/ports';
import { boundedApplicationSelectionRead, conclusiveSelectionRefusal, readSelectedAgreement, readSelectionResult, type SelectionReceipt } from '../../../../data/applicationSelectionClientService';
import { selectionCommandJournal } from '../../../../data/selectionCommandJournal';
import { ownProfileClientService } from '../../../../data/ownProfileClientService';
import { workTrustClientService } from '../../../../data/workTrustClientService';
import type { CandidatesPageRequest } from '../../../../data/candidatesPage';
import { candidatesPagedBuilt } from '../../../../data/candidatesPagedGate';
import { useCandidatesPager } from '../../../../hooks/useCandidatesPager';
import { useFocusedResource } from '../../../../hooks/useFocusedResource';
import { useOwnedEditor } from '../../../../hooks/useOwnedEditor';
import { inicijali } from '../../../../lib/inicijali';
import { noviZahtevId } from '../../../../lib/idempotencija';
import { uuid, type ReceiptAccount } from '../../../../data/serverReceipt';
import { sesijaSada, useSesija } from '../../../../store/sesija';
import { useIzvor } from '../../../../store/uloga';
import { CandidateListPresentation, CandidateSelectionPresentation, SelectionRecoveryPresentation, SelectionUnavailable, type CandidatesPaging, type CandidateSort } from '../../../../ui/v2/ApplicationSelectionPresentation';
import { useSafetyEntry } from '../../../../ui/safety/useSafetyEntry';
import { Avatar, type AvatarSize } from '../../../../ui/system/Avatar';
type Receipt = SelectionReceipt;
type Pending = { command: IzborKomanda; need: PotrebaProjekcija | null; candidate: KandidatProjekcija | null; result: Ishod<Receipt> | null; inFlight: boolean; reconciled: boolean };
type Loaded = { need: PotrebaProjekcija | null; candidates: KandidatProjekcija[]; receipt: Receipt | null };
type Viewed = { state: 'PENDING' | 'CONFIRMED' | 'UNCONFIRMED' };
const NO_ROWS: KandidatProjekcija[] = [];
/** One sentence for the one refusal: the task changed between two reads, so the applications read before it are not the applications of what it is now. */
const STALE_REVIEW_MESSAGE = 'Zadatak se upravo promenio. Učitajte prijave ponovo.';
const NOT_SAVED_ON_DEVICE = 'Izbor nije poslat jer zahtev nije pouzdano sačuvan na telefonu. Proverite stanje pre ponovnog pokušaja.';
const NOT_RETIRED_ON_DEVICE = 'Izbor je potvrđen, ali zapis na telefonu još nije uklonjen. Možete otvoriti Dogovor ili ponoviti proveru.';

/** Reconcile only the immutable pending intent. A refreshed candidate list is
 * not a command receipt, and this helper never calls the selection writer. */
async function recoverPendingSelection(command: IzborKomanda, account: ReceiptAccount, current: () => boolean): Promise<Ishod<Receipt | null>> {
  const stale = (): Ishod<never> => ({ ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvorite prijavu.' });
  if (!current()) return stale();
  const result = await readSelectionResult(command, account);
  if (!current()) return stale();
  if (!result.ok) return result;
  return { ok: true, podatak: result.podatak.state === 'CONFIRMED' ? result.podatak.receipt : null };
}
async function retirePendingSelection(command: IzborKomanda, accountId: string, current: () => boolean): Promise<boolean> {
  try {
    const retired = await selectionCommandJournal.clear({ version: 1, accountId, needId: command.potrebaId, command }, current);
    return current() && retired;
  } catch { return false; }
}

/**
 * EX-04 S4 (A11): the same applications a page at a time, in the whole-list order. The screen's editor keeps owning the read of the task, the revision check, the offer sheet and the
 * choice; the pager owns the rows, the server's total and the next page. `complete` asks for the whole set (the order by price and the comparison are only right over every application).
 */
function usePagedCandidates(source: Izvor, taskId: string | undefined, complete: boolean, focusId: string | null) {
  const readPage = useCallback((request: CandidatesPageRequest) => taskId ? source.prijaveZaPotrebuStrana(taskId, { limit: request.limit, cursor: request.cursor })
    : Promise.reject(new Error('CANDIDATE_PAGE_NEED_REQUIRED')), [source, taskId]);
  const until = useCallback((items: readonly KandidatProjekcija[]) => !!focusId && items.some(row => row.prijavaId.toLowerCase() === focusId), [focusId]);
  const { state, pager } = useCandidatesPager(readPage, complete || !!focusId, focusId && !complete ? until : undefined);
  return { pager, state, rows: state.items as KandidatProjekcija[],
    paging: { total: state.counts?.total ?? null, hasMore: state.hasMore, loadingMore: state.loadingMore, moreError: state.moreError,
      onLoadMore: () => { void pager.loadMore(); } } satisfies CandidatesPaging };
}
/**
 * Who YOU are, for the moment "Dogovoreno!" (two faces: yours and the chosen person's): the name and the profile that holds your photo, read the way the header's own
 * avatar reads them (`ActualUserAvatar`: the requester identity first, the work identity only if the requester has none) and from nowhere else. It is read only while an
 * offer is open, which is where a choice, and so the moment, can happen: a list nobody opened an offer of makes no read, and by the time the choice is confirmed the answer
 * is already here. A read that has not answered, or failed, is no identity: the moment then draws the person, never letters that belong to nobody.
 */
function useOwnIdentity(wanted: boolean, accountId: string | undefined) {
  const read = useCallback(async (signal: AbortSignal) => {
    if (!wanted || !accountId) return null;
    const requester = await ownProfileClientService.read(accountId, 'narucilac');
    if (signal.aborted) throw new Error('CANDIDATES_OWN_FACE_RETIRED');
    return requester ?? ownProfileClientService.read(accountId, 'uskocer');
  }, [wanted, accountId]);
  const resource = useFocusedResource(read);
  return !resource.loading && !resource.error && resource.data?.accountId === accountId ? resource.data : null;
}
type PagedCandidates = ReturnType<typeof usePagedCandidates>;
const useNoPagedCandidates = (_source: Izvor, _taskId: string | undefined, _complete: boolean, _focusId: string | null): PagedCandidates | null => null;
// One reader per build: a compile-time flag, so the order of hooks never changes while the app runs.
const usePagedCandidateRows: (source: Izvor, taskId: string | undefined, complete: boolean, focusId: string | null) => PagedCandidates | null =
  candidatesPagedBuilt() ? usePagedCandidates : useNoPagedCandidates;
export default function Kandidati() {
  const params = useLocalSearchParams<{ id?: string; prijavaId?: string }>();
  const id = typeof params.id === 'string' ? params.id : undefined;
  const focusId = typeof params.prijavaId === 'string' && uuid(params.prijavaId) ? params.prijavaId.toLowerCase() : null;
  const izvor = useIzvor(), router = useRouter();
  const { user, accountRevision } = useSesija();
  const session = useMemo(() => ({ pending: null as Pending | null, viewed: new Map<string, Viewed>(), navigated: false,
    active: AppState.currentState !== 'background' && AppState.currentState !== 'inactive', focused: false,
    focusToken: 0, readRevision: 0, reading: false, compare: false, hardReload: false, resetting: false, notice: null as string | null,
    targetHandled: false, targetMissing: false, targetIncomplete: false }), [id, focusId, izvor, user?.id, accountRevision]);
  const [, render] = useState(0), [resume, setResume] = useState(0);
  const currentAccount = useCallback(() => !!user?.id && sesijaSada().user?.id === user.id &&
    sesijaSada().accountRevision === accountRevision, [user?.id, accountRevision]);
  const [opened, setOpened] = useState<{ data: Loaded; candidate: KandidatProjekcija } | null>(null);
  // The order chosen on the list outlives opening one offer and coming back; it belongs to this Task and
  // this account only, and it is a view of rows already read, never a new request.
  const sortScope = `${id ?? ''}:${user?.id ?? ''}:${accountRevision}`;
  const [sorted, setSorted] = useState<{ scope: string; sort: CandidateSort } | null>(null);
  const sort = sorted?.scope === sortScope ? sorted.sort : 'ARRIVAL';
  // Paged builds only. The order by price and the comparison are only right over every application: while either is on, the rest of the set is read, a page at a time and up to a bound.
  const paged = usePagedCandidateRows(izvor, id, sort !== 'ARRIVAL' || session.compare, focusId);
  const pager = paged?.pager;
  // A person's photo by their verified public profile id; without one (or while it cannot be read) the one Avatar with the
  // letters the candidate read already carries. One function for the life of the screen, so the memoised rows keep.
  const photo = useCallback((k: KandidatProjekcija, size: AvatarSize) => <ProfilePhoto profileId={k.radnikProfilId} size={size} initial={null}
    fallback={<Avatar size={size} initials={k.inicijali || null} />} />, []);
  // The applications the server confirmed as seen on this phone: their chip says "Viđena". The candidate read carries no viewed flag, so the
  // confirmed marks written by `openOffer` are all there is to say it with; an application not in the set reads "Poslata", which is still true.
  // One Set per distinct content, so the memoised rows do not redraw on every render.
  const seen = Array.from(session.viewed, ([key, view]) => view.state === 'CONFIRMED' ? key : '').filter(Boolean).sort().join('|');
  const viewed = useMemo(() => new Set(seen ? seen.split('|') : []), [seen]);
  useFocusEffect(useCallback(() => {
    session.focused = true; session.focusToken++; render(v => v + 1);
    return () => { session.focused = false; };
  }, [session]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      if (session.active === active) return;
      session.active = active; session.focusToken++; session.readRevision++; session.reading = false;
      // Private offer/profile/confirmation sheets leave with this visit. A dispatched command is
      // still owned by its original pending record and is reconciled after the next current read.
      setOpened(null);
      if (active) setResume(value => value + 1); else render(value => value + 1);
    });
    return () => subscription.remove();
  }, [session]);
  const read = useCallback(async (): Promise<Ishod<Loaded>> => {
    const generation = ++session.readRevision, token = session.focusToken; session.reading = true;
    session.navigated = false;
    const hard = session.hardReload; session.hardReload = false;
    if (!id) { session.reading = false; return { ok: false, kod: 'UNAVAILABLE', poruka: 'Ovaj zadatak više nije dostupan. Vratite se na zadatke.' }; }
    try {
      const stillCurrent = () => generation === session.readRevision && token === session.focusToken && session.focused && session.active && currentAccount();
      if (!stillCurrent() || !user?.id)
        return { ok: false, kod: 'STALE_READ', poruka: 'Osvežite pa pokušajte ponovo.' };
      session.notice = null;
      if (!session.pending) {
        // Recover the exact old identity before any current task/list read. A
        // new mount, Auth session or candidate revision never allocates a key.
        try {
          const stored = await selectionCommandJournal.load(user.id, id, stillCurrent);
          if (!stillCurrent() || session.pending) return { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvorite prijave.' };
          if (stored.state === 'CORRUPT') return { ok: false, kod: 'SELECTION_COMMAND_JOURNAL_INVALID',
            poruka: 'Sačuvani izbor na telefonu nije moguće pročitati. Proverite svoje Dogovore; novi izbor još nije otvoren.' };
          if (stored.state === 'PRESENT') session.pending = { command: stored.record.command, need: null, candidate: null,
            result: null, inFlight: false, reconciled: false };
        } catch { return { ok: false, kod: 'SELECTION_COMMAND_JOURNAL_READ_FAILED',
          poruka: 'Ne možemo da proverimo sačuvani izbor na telefonu. Pokušajte ponovo.' }; }
      }
      const request = session.pending;
      let selectionChecked = false;
      if (request && !request.inFlight) {
        // Resolve the accepted choice first. A stale, empty or unavailable list
        // cannot hide its committed receipt. Only the owned reviewed title is
        // reused below; the recovered view opens the current Agreement itself.
        const recovered = await recoverPendingSelection(request.command, { accountId: user.id, accountRevision },
          () => stillCurrent() && session.pending === request && !request.inFlight);
        if (!recovered.ok) return recovered;
        selectionChecked = true;
        if (recovered.podatak) {
          const retired = await retirePendingSelection(request.command, user.id,
            () => stillCurrent() && session.pending === request && !request.inFlight);
          if (!stillCurrent() || session.pending !== request) return { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvorite prijave.' };
          if (!retired) session.notice = NOT_RETIRED_ON_DEVICE;
          request.result = { ok: true, podatak: recovered.podatak }; request.reconciled = true;
          return { ok: true, podatak: { need: request.need, candidates: NO_ROWS, receipt: recovered.podatak } };
        }
      }
      // An unavailable or changed list cannot replace a saved request with a
      // new choice. The recovery-only view does not invent its old offer.
      const recoveryOnly = (message: string): Ishod<Loaded> => {
        if (!stillCurrent() || session.pending !== request || !request || !selectionChecked || request.inFlight)
          return { ok: false, kod: 'READ_FAILED', poruka: message };
        request.reconciled = true; session.notice = message;
        return { ok: true, podatak: { need: null, candidates: NO_ROWS, receipt: null } };
      };
      let need: PotrebaProjekcija | null, candidates: KandidatProjekcija[];
      try { [need, candidates] = await boundedApplicationSelectionRead(Promise.all([izvor.potreba(id),
        // Paged: the first page of the set is the read (the rows live in the pager); a page that did not arrive is a read that failed, like the whole list.
        pager ? pager.reload(hard ? 'keep' : 'auto').then(fresh => { if (!fresh) throw new Error('CANDIDATES_PAGE_NOT_READ'); return pager.snapshot().items as KandidatProjekcija[]; })
          : izvor.prijaveZaPotrebu(id)])); }
      catch { return recoveryOnly('Prijave trenutno nisu učitane. Sačuvani izbor ostaje isti; možete proveriti njegov ishod.'); }
      if (!need) return request ? recoveryOnly('Zadatak trenutno nije dostupan. Proverite ishod prethodnog izbora.')
        : { ok: false, kod: 'UNAVAILABLE', poruka: 'Ovaj zadatak više nije dostupan. Vratite se na zadatke.' };
      // RPC needRevision is the current Need revision for every row, including
      // STALE. Its separate responseNeedRevision is the older submitted snapshot.
      // Never combine independent reads from different current Need revisions.
      if (candidates.some(k => k.potrebaRevizija !== need!.revizija)) return request ? recoveryOnly(STALE_REVIEW_MESSAGE)
        : { ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: STALE_REVIEW_MESSAGE };
      if (!stillCurrent() || session.pending !== request)
        return { ok: false, kod: 'STALE_READ', poruka: 'Osvežite pa pokušajte ponovo.' };
      if (request && selectionChecked && !request.inFlight) {
        // No saved receipt is only a snapshot observation. The old request stays
        // frozen; a separate explicit retry reuses exactly this original key.
        request.reconciled = true;
        // Show a restored offer only when this read proves all its original
        // identity fields. New price/terms never fill an old reviewed snapshot.
        if (!request.need && need.revizija === request.command.potrebaRevizija) {
          const exact = candidates.find(k => k.prijavaId === request.command.prijavaId && k.verzija === request.command.prijavaVerzija
            && k.hash === request.command.prijavaHash && k.pokrivaMesta === request.command.mesta);
          if (exact) { request.need = need; request.candidate = exact; }
        }
      }
      const result = session.pending?.result;
      return { ok: true, podatak: { need, candidates: pager ? NO_ROWS : candidates, receipt: result?.ok ? result.podatak : null } };
    } catch { return { ok: false, kod: 'READ_FAILED', poruka: 'Prijave trenutno nije moguće učitati. Proverite vezu i pokušajte ponovo.' }; }
    finally { if (generation === session.readRevision) session.reading = false; }
  }, [id, izvor, session, currentAccount, resume, pager, user?.id, accountRevision]);
  const editor = useOwnedEditor(read), data = editor.data;
  // The applications on screen: the whole list's rows, or (paged) what the pager holds for this task.
  const shownRows = paged ? paged.rows : data?.candidates ?? NO_ROWS;
  const pending = session.pending;
  const candidate = pending ? pending.candidate : (opened?.data === data ? opened.candidate : null);
  // F05: a candidate is a person; the server resolves the safety target before bezbednost opens.
  const safety = useSafetyEntry(candidate?.radnikProfilId, { needId: id ?? null });
  // Your own name and photo for "Dogovoreno!", read while an offer is open (see `useOwnIdentity`).
  const own = useOwnIdentity(!!candidate, user?.id);
  const focusToken = session.focusToken, readRevision = session.readRevision;
  const current = () => session.focused && session.active && session.focusToken === focusToken && session.readRevision === readRevision && currentAccount();
  const refresh = () => { if (current() && !session.reading && !session.pending?.inFlight && !session.resetting) {
    if (session.targetMissing) { session.targetMissing = false; session.targetIncomplete = false; session.targetHandled = false; }
    session.hardReload = true; void editor.refresh();
  } };
  const back = () => {
    if (!current()) return;
    // An offer still open on screen closes first. One left behind by a fresh read (the band's "Osveži prijave" brings new
    // data, so the sheet is gone) is cleared on the way out, and this same press goes back (review r4 rk item 1): it
    // used to take one press to clear what nobody could see.
    if (opened && !pending) { setOpened(null); if (candidate) return; }
    if (session.navigated) return; session.navigated = true;
    if (router.canGoBack()) router.back(); else if (id) router.replace({ pathname: '/potrebe/[id]/pregled', params: { id } });
    else router.replace('/potrebe');
  };
  // The offer's confirmation waits on the returned command; every guard below still decides alone whether it runs.
  const choose = () => {
    const k = candidate;
    const accountId = user?.id;
    if (!current() || !accountId || session.pending?.inFlight || session.resetting || session.reading || editor.uncertain || !data
      || (session.pending && (!session.pending.reconciled || session.pending.result?.ok ||
        (session.pending.result && conclusiveSelectionRefusal(session.pending.result))))
      || (!session.pending && (!data.need || !k || !k.mozeIzabrati || k.stanje !== 'SELECTABLE' || k.potrebaRevizija !== data.need.revizija))) return;
    return editor.save(async () => {
      if (!current()) return { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvorite prijave.' };
      if (!session.pending) {
        if (!data.need || !k) return { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvorite prijave.' };
        session.pending = { need: data.need, candidate: k, result: null, inFlight: false, reconciled: false,
          command: Object.freeze({ potrebaId: data.need.id, potrebaRevizija: data.need.revizija, prijavaId: k.prijavaId,
            prijavaVerzija: k.verzija, prijavaHash: k.hash, mesta: k.pokrivaMesta, clientRequestId: noviZahtevId('izbor') }) };
      }
      const request = session.pending;
      request.inFlight = true; request.reconciled = false;
      let result: Ishod<Receipt>;
      const ownsWrite = () => current() && session.pending === request;
      try {
        try {
          await selectionCommandJournal.save({ version: 1, accountId, needId: request.command.potrebaId, command: request.command }, ownsWrite);
        } catch (error) {
          // Another retained screen's unresolved record must be loaded instead
          // of being overwritten by this screen's newly allocated request.
          if (ownsWrite() && error instanceof Error && ['SELECTION_COMMAND_UNRESOLVED', 'SELECTION_COMMAND_PAYLOAD_CHANGED',
            'SELECTION_COMMAND_JOURNAL_INVALID'].includes(error.message)) session.pending = null;
          result = { ok: false, kod: 'SELECTION_COMMAND_NOT_SAVED', poruka: NOT_SAVED_ON_DEVICE };
          request.result = result;
          return result;
        }
        if (!ownsWrite()) return { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvorite prijave.' };
        result = await izvor.izaberiPrijavu(request.command);
        if (result.ok && ownsWrite()) {
          const retired = await retirePendingSelection(request.command, accountId, ownsWrite);
          if (ownsWrite()) session.notice = retired ? null : NOT_RETIRED_ON_DEVICE;
        }
      }
      catch { result = { ok: false, kod: 'APPLICATION_SELECTION_UNCONFIRMED', poruka: 'Ne znamo da li je izbor sačuvan. Izaberite „Proverite da li je izabrano“.' }; }
      finally { request.inFlight = false; }
      request.result = result;
      if (session.focused && session.active && currentAccount()) render(v => v + 1);
      return result.ok ? { ok: true, podatak: { ...data, receipt: result.podatak } } : result;
    }, { settledFailure: conclusiveSelectionRefusal });
  };
  const resetPending = async () => {
    const request = session.pending, accountId = user?.id;
    if (!current() || !accountId || editor.busy || session.reading || session.resetting || !request || request.inFlight
      || (!request.result?.ok && !(request.result && conclusiveSelectionRefusal(request.result)))) return;
    const outcome = request.result;
    const ownsReset = () => current() && session.pending === request && request.result === outcome && !request.inFlight;
    session.resetting = true; render(value => value + 1);
    try {
      const retired = await retirePendingSelection(request.command, accountId, ownsReset);
      if (!ownsReset()) return;
      if (!retired) { session.notice = 'Zapis prethodnog izbora nije uklonjen sa telefona. Pokušajte ponovo pre novog izbora.'; return; }
      session.pending = null; session.notice = null; setOpened(null); void editor.refresh();
    } finally { session.resetting = false; if (current()) render(value => value + 1); }
  };
  const openAgreement = () => {
    if (!current() || !data?.receipt || session.navigated) return;
    session.navigated = true; router.replace({ pathname: '/dogovor/[id]', params: { id: data.receipt.dogovorId } });
  };
  const openOffer = (k: KandidatProjekcija) => {
    if (!current() || session.navigated || session.reading || editor.busy || editor.loading || !data ||
        !shownRows.includes(k)) return;
    setOpened({ data, candidate: k });
    const previous = session.viewed.get(k.prijavaId);
    if (previous && previous.state !== 'UNCONFIRMED') return;
    const attempt: Viewed = { state: 'PENDING' };
    session.viewed.set(k.prijavaId, attempt);
    // Only this explicit offer-opening action writes viewed state. Reopening an
    // unconfirmed offer may repeat its exact idempotent target; reads never do.
    void (async () => {
      try {
        const result = await izvor.oznaciPrijavuVidjenom(k.prijavaId);
        attempt.state = result.ok ? 'CONFIRMED' : 'UNCONFIRMED';
      } catch { attempt.state = 'UNCONFIRMED'; }
      // The result remains scoped to this original account/session object.
      // A late result cannot navigate, change selection, or update another view.
      if (current() && session.viewed.get(k.prijavaId) === attempt) render(value => value + 1);
    })();
  };
  // A notification passes an opaque response ID only after its owned event and Need
  // were read. The route never trusts that parameter as an offer: this screen opens
  // it only after the normal owner-scoped candidate read and revision check.
  useEffect(() => {
    if (!focusId || session.targetHandled || !data || !current() || session.reading || editor.busy || editor.loading || session.pending) return;
    const exact = shownRows.find(row => row.prijavaId.toLowerCase() === focusId);
    if (exact) {
      session.targetHandled = true;
      session.targetIncomplete = false;
      if (exact.stanje === 'WITHDRAWN') { session.targetMissing = true; render(value => value + 1); }
      else openOffer(exact);
    } else if (!paged?.state.hasMore && !paged?.state.loadingMore) {
      session.targetHandled = true; session.targetMissing = true; session.targetIncomplete = false; render(value => value + 1);
    } else if ((paged?.state.moreError || paged?.state.pageBoundReached) && !paged.state.loadingMore && !session.targetMissing) {
      // Automatic search stopped, while manual Load more or refresh can still find it.
      session.targetMissing = true; session.targetIncomplete = true; render(value => value + 1);
    }
    // Each render owns its current focus/read/account fence; the session marker
    // prevents opening the same offer again after the viewed receipt comes back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusId, data, shownRows, paged?.state.hasMore, paged?.state.loadingMore, paged?.state.moreError, paged?.state.pageBoundReached, session.focused, session.active, session.reading]);
  // The row at the top of the list opens the Task itself, whichever screen the list was opened from.
  const openTask = () => {
    if (!current() || session.navigated || !id) return;
    session.navigated = true; router.navigate({ pathname: '/potrebe/[id]/pregled', params: { id } });
  };
  // One function per offer, read revision and account (it was a new one on every render, and the Dogovor link of an
  // offer already chosen was read again on each, e.g. when the viewed mark came back). Every check stays inside it.
  const needId = data?.need?.id, chosenId = candidate?.prijavaId;
  const readAgreement = useCallback(async (): Promise<Ishod<{ dogovorId: string | null }>> => {
    if (!needId || !chosenId || !current()) return { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvorite prijavu.' };
    const result = await readSelectedAgreement(needId, chosenId);
    return current() ? result : { ok: false, kod: 'STALE_READ', poruka: 'Ponovo otvorite prijavu.' };
    // `current` reads the render's focus token and read revision and the account; those are the dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needId, chosenId, focusToken, readRevision, user?.id, accountRevision, session]);
  // Paged: a later page may have been read after the task changed under the first one. Applications of two revisions are never shown together: the same refusal the whole list makes,
  // unless a choice is already being decided (its sheet is what matters then).
  const mixed = !!paged && !!data?.need && !pending && paged.rows.some(k => k.potrebaRevizija !== data.need!.revizija);
  // Keep one coherent, same-account snapshot while the independent task/page reads settle.
  // A newer page must not appear beside an older task's capacity or revision.
  const retained = useRef<{ session: typeof session; rows: typeof shownRows; paging: CandidatesPaging | undefined } | null>(null);
  if (!editor.loading && data && !mixed) retained.current = { session, rows: shownRows, paging: paged?.paging };
  const snapshot = editor.loading && retained.current?.session === session ? retained.current : null;
  if (!session.focused || !session.active || !data || (mixed && !editor.loading))
    return <SelectionUnavailable loading={!session.focused || !session.active || editor.loading}
      message={mixed ? STALE_REVIEW_MESSAGE : editor.error ?? 'Prijave nisu dostupne.'} retry={refresh} back={back} />;
  const refusal = pending?.result && conclusiveSelectionRefusal(pending.result) ? pending.result : null;
  if (pending && (!data.need || !pending.need || !candidate || session.notice)) return <SelectionRecoveryPresentation
    receipt={data.receipt} busy={editor.busy || !!pending.inFlight || session.resetting || editor.loading}
    uncertain={editor.uncertain || (!pending.reconciled && !refusal && !data.receipt)} refresh={refresh} resend={choose} back={back} openAgreement={openAgreement}
    error={session.notice ?? editor.error ?? refusal?.poruka ?? null} reset={refusal && !editor.uncertain ? resetPending : undefined} />;
  if (!data.need) return <SelectionUnavailable loading={editor.loading} message="Prijave nisu dostupne." retry={refresh} back={back} />;
  // Step 7 (2026-09-24): the list stays under an opened offer, which is a sheet over it; closing the sheet is `back`.
  const list = data.receipt?.agreementStatus ? null : <CandidateListPresentation need={data.need} candidates={snapshot?.rows ?? shownRows} back={back} refresh={refresh} paging={snapshot ? snapshot.paging : paged?.paging}
    refreshing={editor.loading}
    targetNotice={session.targetMissing ? session.targetIncomplete
      ? 'Nismo pronašli ovu prijavu u učitanom delu. Osvežite listu ili učitajte još prijava.'
      : 'Ova prijava više nije dostupna. Pogledajte ostale prijave ili osvežite listu.' : undefined}
    open={openOffer} openTask={openTask} sort={sort}
    onSort={sort => { if (current()) setSorted({ scope: sortScope, sort }); }}
    comparison={session.compare} onComparison={compare => { if (current()) { session.compare = compare; render(value => value + 1); } }} photo={photo} viewed={viewed} />;
  if (!candidate || (editor.loading && !data.receipt?.agreementStatus)) return list;
  return <>{list}<CandidateSelectionPresentation need={pending?.need ?? data.need} candidate={candidate} back={back}
    photo={photo(candidate, 56)} safety={safety} viewed={viewed.has(candidate.prijavaId)}
    // "Dogovoreno!": the two faces at 72. Yours is your own photo, through the path the header's avatar takes, else the letters of your own name (the drawn
    // person while the answer has not come, or when you have no name); theirs is their photo, else the letters the candidate read already carries.
    ownFace={own ? <ProfilePhoto key={`${user?.id}:${accountRevision}:${own.profileId}`} profileId={own.profileId} size={72}
      fallback={<Avatar size={72} initials={inicijali(own.ime)} />} /> : undefined}
    themFace={photo(candidate, 72)}
    // The profile sheet's 96 px portrait, as the task's poster sheet draws it: the photo or its own large stand-in.
    publicPhoto={(profileId, size) => <ProfilePhoto profileId={profileId} size={size ?? 96} initial={null} />}
    readAgreement={readAgreement} openLinkedAgreement={agreementId => {
      if (!current() || session.navigated) return;
      session.navigated = true; router.replace({ pathname: '/dogovor/[id]', params: { id: agreementId } });
    }}
    publicProfile={async () => {
      if (!current()) return null;
      const profile = await izvor.javniProfil(candidate.radnikProfilId);
      return current() ? profile : null;
    }}
    // R24: "Dolazi kako je dogovoreno N%" is the server's to give (the owner's privacy switch): the profile sheet draws what comes back for this viewer and
    // nothing when it is hidden. A failed or stale read is no answer, for this account and this visit only.
    publicTrust={async profileId => {
      if (!current() || !user?.id) return null;
      const result = await workTrustClientService.publicTrust(profileId, { accountId: user.id, accountRevision });
      return current() && result.ok ? result.podatak.trust : null;
    }}
    choose={choose} busy={editor.busy || !!pending?.inFlight || session.resetting} pending={!!pending} uncertain={editor.uncertain || (!!pending && !pending.reconciled && !data.receipt && !refusal)} refresh={refresh}
    error={editor.error ?? refusal?.poruka ?? (pending && !data.receipt && !editor.uncertain ? 'Potvrda izbora još nije stigla. Možete proveriti ponovo ili izričito poslati isti izbor.'
      : session.viewed.get(candidate.prijavaId)?.state === 'UNCONFIRMED'
        ? 'Ponuda je otvorena, ali nismo zabeležili da je pogledana. Zatvorite je i otvorite ponovo.' : null)}
    chooseNext={resetPending}
    confirmed={!!data.receipt} confirmedStatus={data.receipt?.agreementStatus} openAgreement={openAgreement}
    reset={refusal && !editor.uncertain ? resetPending : undefined} /></>;
}
