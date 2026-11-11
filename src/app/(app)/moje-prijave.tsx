import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, BackHandler } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { MojaPrijavaProjekcija } from '../../contracts/projections';
import type { Ishod, Izvor, PovuciPrijavuKomanda } from '../../data/ports';
import { applicationSelectionErrors, boundedApplicationSelectionRead } from '../../data/applicationSelectionClientService';
import { readApplicationCommandState, readExistingApplicationInterval, type ApplicationCommandState } from '../../data/myApplicationsClientService';
import { applicationSection } from '../../data/myApplicationsView';
import { ownApplicationsScope, type OwnApplicationsPageRequest } from '../../data/ownApplicationsPage';
import { ownApplicationsPagedBuilt } from '../../data/ownApplicationsPagedGate';
import { ru4Production, type Ru4RazresiPrijavuInput } from '../../data/ru4Production';
import { positiveInteger, sameId } from '../../data/serverReceipt';
import { fixedApplicationPrice, readableTitle } from '../../data/needDetailPresentation';
import { useOwnApplicationsPager } from '../../hooks/useOwnApplicationsPager';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { noviZahtevId } from '../../lib/idempotencija';
import { calendarInstant } from '../../lib/calendarTime';
import { sesijaSada, useSesija } from '../../store/sesija';
import { useIzvor } from '../../store/uloga';
import { MyApplicationsPresentation, type ApplicationsPaging, type ApplicationsTab, type OfferEdit } from '../../ui/v2/MyApplicationsPresentation';
import { useConfirmSheet } from '../../ui/system/ConfirmSheet';
import { poruka } from '../../ui/system/Poruka';

type Intent = { kind: 'withdraw'; command: PovuciPrijavuKomanda } | { kind: 'resolve'; command: Ru4RazresiPrijavuInput };
type Pending = { expectedPriceBasis: 'TOTAL' | 'HOURLY'; intent: Intent; row: MojaPrijavaProjekcija; inFlight: boolean; reconciled: boolean;
  result: 'receipt' | 'unknown' | 'rejected' | null; code: string | null };
type Loaded = { rows: MojaPrijavaProjekcija[]; notice: string | null };
const NO_ROWS: MojaPrijavaProjekcija[] = [];

/**
 * EX-04 S2 (B10): the same list a page at a time, in the server's own sets (one per tab). The screen's editor keeps owning the read, the reconciliation of a pending command and
 * the commands; the pager owns the rows, the server's counts and the next page. Until the pager has answered for the tab now asked for, the screen is loading, never showing another
 * set's applications under this one's title. `destination` is the application a notification named: the rest of the shown set is read until it is met.
 */
function usePagedApplications(source: Izvor, tab: ApplicationsTab, destination: string | null) {
  const readPage = useCallback((request: OwnApplicationsPageRequest) => source.mojePrijaveStrana(request), [source]);
  const scope = ownApplicationsScope(tab);
  const { state, pager } = useOwnApplicationsPager(readPage, scope, destination);
  const settled = state.scope === scope;
  return { pager, state, settled, rows: settled ? state.items as MojaPrijavaProjekcija[] : NO_ROWS,
    paging: { counts: state.counts, hasMore: settled && state.hasMore, loadingMore: settled && state.loadingMore, moreError: settled && state.moreError,
      onLoadMore: () => { void pager.loadMore(); } } satisfies ApplicationsPaging };
}
type PagedApplications = ReturnType<typeof usePagedApplications>;
const useNoPagedApplications = (_source: Izvor, _tab: ApplicationsTab, _destination: string | null): PagedApplications | null => null;
// One reader per build: a compile-time flag, so the order of hooks never changes while the app runs.
const usePagedApplicationRows: (source: Izvor, tab: ApplicationsTab, destination: string | null) => PagedApplications | null =
  ownApplicationsPagedBuilt() ? usePagedApplications : useNoPagedApplications;
function pricedOffer(draft: OfferEdit): OfferEdit {
  const people = draft.people;
  const price = draft.pricing.rezimCene === 'MY_PRICE'
    ? String(fixedApplicationPrice(draft.pricing, /^\d+$/.test(people) ? Number(people) : NaN) ?? '') : draft.price;
  return { ...draft, people, price };
}
const changedOffer = (draft: OfferEdit | null, original: OfferEdit | null) => !!draft && !!original &&
  (draft.price !== original.price || draft.people !== original.people || draft.note !== original.note);
const errors: Readonly<Record<string, string>> = { ...applicationSelectionErrors,
  FORBIDDEN: 'Ova prijava nije dostupna na ovom nalogu.', RESPONSE_NOT_OWNED: 'Ova prijava nije dostupna na ovom nalogu.',
  RESPONSE_NOT_WITHDRAWABLE: 'Prijavu trenutno ne možete da povučete. Osvežite listu da vidite trenutno stanje.',
  RESPONSE_NOT_AWAITING_REVIEW: 'Prijava je u međuvremenu promenjena. Osvežite listu.',
  RESPONSE_ALREADY_CURRENT: 'Prijava je već ažurirana. Osvežite listu.',
  INVALID_PROPOSED_WINDOW: 'Taj termin nije prihvaćen. Otvorite prijavu i izaberite drugi termin.',
  SCOPE_NOTE_TOO_LONG: 'Napomena može imati najviše 1.200 znakova.',
};
const unknown = () => ({ ok: false as const, kod: 'APPLICATION_OUTCOME_UNKNOWN', poruka: 'Ne znamo da li je radnja uspela. Osvežite listu pa pokušajte ponovo.' });
const identity = (p: MojaPrijavaProjekcija) => `${p.prijavaId}:${p.potrebaId}:${p.potrebaRevizija}:${p.prijavaRevizija}:${p.prijavaVerzija}:${p.stanje}`;
const withdrawal = (pending: Pending) => pending.intent.kind === 'withdraw' || pending.intent.command.akcija === 'WITHDRAW';
function observed(pending: Pending, row: ApplicationCommandState) {
  if (!sameId(row.applicationId, pending.row.prijavaId) || !sameId(row.needId, pending.row.potrebaId)) return false;
  // The exact persisted row establishes withdrawal. UPDATE/KEEP also require
  // the command receipt; a coincidentally similar offer never proves replay.
  if (withdrawal(pending)) return row.status === 'WITHDRAWN' && row.version >= pending.row.prijavaVerzija;
  const update = pending.intent.kind === 'resolve' && pending.intent.command.akcija === 'UPDATE' ? pending.intent.command : null;
  const sameInstant = (actual: string | null, expected: string | null | undefined) => expected === null
    ? actual === null : actual !== null && calendarInstant(expected) !== null && calendarInstant(actual) === calendarInstant(expected);
  // A later Need edit/closure changes today's projection, not whether this
  // version was saved against the reviewed revision. The list still displays
  // the server's current lifecycle; it cannot settle this command.
  return pending.result === 'receipt' && row.version === pending.row.prijavaVerzija + 1 &&
    row.submittedNeedRevision === pending.row.potrebaRevizija &&
    row.priceRsd === (update ? update.cenaRsd : pending.row.cena.iznos) &&
    row.priceBasis === pending.expectedPriceBasis &&
    row.coveredSlots === (update ? update.pokrivenaMesta : pending.row.pokrivaMesta) &&
    row.scopeNote === (update ? update.napomena : pending.row.napomena) &&
    (!update || sameInstant(row.proposedStartAt, update.predlozeniPocetak) && sameInstant(row.proposedEndAt, update.predlozeniKraj));
}
export default function MojePrijave() {
  const izvor = useIzvor(), router = useRouter();
  // "Zadatak je izmenjen — proveri svoju prijavu" used to land on the list and stop there, leaving
  // the person to find which of their applications it meant. The notification knows; it now says.
  const params = useLocalSearchParams<{ prijavaId?: string | string[]; nova?: string | string[] }>();
  const named = typeof params.prijavaId === 'string' ? params.prijavaId : null;
  // The receipt of an application that has just been sent opens this list with `nova=1` (the approved draft U8): that application is marked once, for
  // this visit ("Poslata · upravo"). A notification names an application without it, and then nothing is marked.
  const justSent = params.nova === '1';
  const landing = useRef<string | null>(null);
  const askedLanding = useRef<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [freshId, setFreshId] = useState<string | null>(null);
  // Paged builds only: a named application is not necessarily on the first page, so while it has not been met the rest of the set is read.
  const [landingActive, setLandingActive] = useState(false);
  const { user, accountRevision } = useSesija();
  const session = useMemo(() => ({ focused: false, active: AppState.currentState !== 'background' && AppState.currentState !== 'inactive',
    token: 0, readRevision: 0, reading: false, editRevision: 0, editingLoading: false, tab: (named ? 'all' : 'active') as ApplicationsTab, hardReload: false,
    expanded: null as string | null, draft: null as OfferEdit | null, original: null as OfferEdit | null,
    draftFor: null as string | null, pending: null as Pending | null, message: null as string | null }),
  [izvor, user?.id, accountRevision]);
  const [, render] = useState(0), [resume, setResume] = useState(0);
  // A destination named by a notification takes precedence over a retained filter: the one set that holds every application is "Sve".
  useEffect(() => {
    landing.current = named; askedLanding.current = null; setFocusId(null); setFreshId(null);
    // A named destination waits for the person's decision while another offer has unsaved edits.
    // In a paged build, changing the set now would hide that editor before the question appears.
    if (ownApplicationsPagedBuilt() && named && !(session.expanded !== named && changedOffer(session.draft, session.original))) {
      session.tab = 'all'; setLandingActive(true); render(v => v + 1);
    } else setLandingActive(false);
  }, [named]);
  const confirmation = useConfirmSheet(), retireConfirmation = confirmation.close;
  const paged = usePagedApplicationRows(izvor, session.tab, landingActive ? named : null);
  const pager = paged?.pager;
  const accountCurrent = useCallback(() => !!user?.id && sesijaSada().user?.id === user.id &&
    sesijaSada().accountRevision === accountRevision, [user?.id, accountRevision]);
  // Every retirement below also makes an open withdrawal question stale (its answer checks `editRevision`), so the
  // question leaves the screen with it instead of waiting there as a button that no longer does anything.
  const clearEdit = useCallback(() => { session.draft = null; session.original = null; session.draftFor = null;
    session.editRevision++; session.message = null; }, [session]);
  const clearReview = useCallback(() => { session.expanded = null; clearEdit(); session.editingLoading = false;
    retireConfirmation(); }, [session, clearEdit, retireConfirmation]);
  // A focus/read transition retires old callbacks and open questions, but keeps a loaded edit on this account.
  // Its current row and revision are checked again before the edit can be sent.
  const retireReview = useCallback(() => { if (!session.draft) { session.expanded = null; session.original = null; session.draftFor = null; }
    session.editRevision++; session.editingLoading = false; session.message = null; retireConfirmation();
  }, [session, retireConfirmation]);
  useFocusEffect(useCallback(() => {
    session.focused = true; session.token++; retireReview(); render(v => v + 1);
    return () => { session.focused = false; session.token++; session.readRevision++; session.reading = false; retireReview(); setFreshId(null); };
  }, [session, retireReview]));
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const active = state === 'active';
      if (session.active === active) return;
      session.active = active; session.token++; session.readRevision++; session.reading = false; retireReview();
      if (active) setResume(v => v + 1); else render(v => v + 1);
    });
    return () => subscription.remove();
  }, [session, retireReview]);
  const read = useCallback(async (): Promise<Ishod<Loaded>> => {
    const generation = ++session.readRevision, token = session.token; session.reading = true; retireReview();
    const owned = () => session.focused && session.active && token === session.token && generation === session.readRevision && accountCurrent();
    const pending = session.pending && !session.pending.inFlight ? session.pending : null;
    if (pending) pending.reconciled = false;
    const hard = session.hardReload; session.hardReload = false;
    try {
      const [rows, named] = await Promise.all([
        // Paged: the first page of the shown set is the read (the rows live in the pager); a page that did not arrive is a read that failed, like the whole list.
        pager ? boundedApplicationSelectionRead(pager.reload(hard ? 'keep' : 'auto')).then(fresh => { if (!fresh) throw new Error('APPLICATIONS_PAGE_NOT_READ'); return NO_ROWS; })
          : boundedApplicationSelectionRead(izvor.mojePrijave()),
        pending ? readApplicationCommandState(pending.row) : Promise.resolve(null),
      ]);
      if (!owned()) return { ok: false, kod: 'STALE_READ', poruka: 'Učitaj trenutne prijave.' };
      let notice: string | null = null;
      if (pending && session.pending === pending && !pending.inFlight && named) {
        pending.reconciled = named.ok;
        if (!named.ok) notice = 'Ne možemo da vidimo trenutno stanje ove prijave. Osveži listu pre nove radnje.';
        else if (observed(pending, named.podatak)) {
          // What happened is said once, in the app's one bar, and only after the readback confirmed it (a tick belongs to an outcome).
          // Neither command has an undo, so the bar carries no "Vrati".
          poruka.show({ text: withdrawal(pending) ? 'Prijava je povučena.' : 'Prijava je ažurirana prema izmenjenom zadatku.', confirmed: true });
          session.pending = null; clearReview();
        } else if (pending.result === 'receipt') notice = 'Radnja je uspela, ali je prijava u međuvremenu promenjena. Pregledaj je ponovo.';
      }
      return { ok: true, podatak: { rows, notice } };
    // The failure's cause is not known here, so the words do not guess one (verify r4b item B).
    } catch { return { ok: false, kod: 'READ_FAILED', poruka: 'Pokušaj ponovo za trenutak.' }; }
    finally { if (generation === session.readRevision) session.reading = false; }
  // Resume retires the hook's old owner and reads before showing actions.
  }, [session, izvor, accountCurrent, retireReview, clearReview, resume, pager]);
  const editor = useOwnedEditor(read), data = editor.data;
  // The applications on screen: the whole list's rows, or (paged) what the pager holds for the tab asked for.
  const shownRows = paged ? paged.rows : data?.rows ?? NO_ROWS;
  // A named row opens once its owned read arrives. An already edited offer stays visible
  // until the person chooses whether to open a different named application.
  useEffect(() => {
    const id = landing.current;
    if (!id || editor.loading || !session.focused || !session.active || !accountCurrent()) return;
    if (session.expanded !== id && changedOffer(session.draft, session.original)) {
      if (askedLanding.current === id) return;
      askedLanding.current = id;
      const review = session.editRevision;
      confirmation.ask({ title: 'Otvoriti drugu prijavu?',
        message: 'Nesačuvane izmene ove prijave biće odbačene pre otvaranja tražene prijave.',
        cancelLabel: 'Nastavi uređivanje', confirmLabel: 'Odbaci i otvori', tone: 'danger',
        onCancel: () => {
          if (landing.current !== id) return;
          askedLanding.current = null;
          // A read, blur or account change retires the question, not the destination.
          if (session.editRevision === review && session.focused && session.active && accountCurrent()) {
            landing.current = null; setLandingActive(false);
          }
        },
        onConfirm: () => {
          if (landing.current !== id || session.editRevision !== review || !session.focused || !session.active || !accountCurrent()) return;
          askedLanding.current = null; clearReview();
          if (ownApplicationsPagedBuilt()) { session.tab = 'all'; setLandingActive(true); }
          render(v => v + 1);
        } });
      return;
    }
    const row = shownRows.find(row => row.prijavaId === id);
    if (!row) return;
    // A new explicit destination takes precedence over a retained filter. Consume it once:
    // later tab choices and closing the review remain the person's own decisions.
    if (session.tab !== 'all' && session.tab !== applicationSection(row)) session.tab = 'all';
    if (session.expanded !== id) clearReview();
    landing.current = null; askedLanding.current = null; session.expanded = id;
    setFocusId(id); setFreshId(justSent ? id : null); setLandingActive(false); render(v => v + 1);
  }, [data, session, named, justSent, editor.loading, accountCurrent, shownRows, session.editRevision, clearReview, confirmation.ask]);
  const token = session.token, revision = session.readRevision, editRevision = session.editRevision;
  const current = () => session.focused && session.active && token === session.token && revision === session.readRevision && accountCurrent();
  const rowCurrent = (p: MojaPrijavaProjekcija) => current() && shownRows.some(row => identity(row) === identity(p));
  const idle = () => !session.reading && !session.pending && !editor.busy && !editor.uncertain && !session.editingLoading;
  const refresh = () => { if (current() && !session.reading && !session.pending?.inFlight) { session.hardReload = true; void editor.refresh(); } };
  const perform = (pending: Pending) => {
    if (!current() || !data || session.reading || pending.inFlight || editor.busy || editor.uncertain ||
        session.pending && (session.pending !== pending || !pending.reconciled)) return;
    void editor.save(async () => {
      session.pending = pending; pending.inFlight = true; pending.reconciled = false; session.message = null;
      let result: Ishod<unknown>;
      try {
        // A timeout bounds waiting, not server execution. After an owned read
        // the exact immutable idempotent command is the only retry allowed.
        const raw = await boundedApplicationSelectionRead<Ishod<unknown>>(pending.intent.kind === 'withdraw'
          ? izvor.povuciPrijavu(pending.intent.command) : ru4Production.resolveChangedApplication(pending.intent.command));
        if (!raw.ok) result = Object.prototype.hasOwnProperty.call(errors, raw.kod)
          ? { ok: false, kod: raw.kod, poruka: errors[raw.kod] } : unknown();
        else {
          const receipt = raw.podatak as { stanje?: string; status?: string; verzija?: number; version?: number; priceBasis?: 'TOTAL' | 'HOURLY' };
          const status = pending.intent.kind === 'withdraw' ? receipt?.stanje : receipt?.status;
          const version = pending.intent.kind === 'withdraw' ? receipt?.verzija : receipt?.version;
          result = positiveInteger(version) && version === pending.row.prijavaVerzija + (withdrawal(pending) ? 0 : 1) &&
            status === (withdrawal(pending) ? 'WITHDRAWN' : 'SUBMITTED') &&
            (withdrawal(pending) || receipt.priceBasis === pending.expectedPriceBasis) ? { ok: true, podatak: null } : unknown();
        }
      } catch { result = unknown(); }
      finally { pending.inFlight = false; }
      if (!accountCurrent() || session.pending !== pending) return unknown();
      pending.result = result.ok ? 'receipt' : result.kod === 'APPLICATION_OUTCOME_UNKNOWN' ? 'unknown' : 'rejected';
      pending.code = result.ok ? null : result.kod;
      if (session.focused && session.active) render(v => v + 1);
      if (!session.focused || !session.active || token !== session.token) return unknown();
      if (!result.ok) return result;
      const fresh = await read();
      if (!fresh.ok) return { ok: false, kod: 'APPLICATION_REFRESH_REQUIRED', poruka: 'Radnja je uspela, ali se lista nije osvežila. Osveži je.' };
      // A command moves an application between sections: the sets that are not shown are read again as new when they are asked for.
      pager?.forgetOtherSets();
      return fresh;
    });
  };
  const makeIntent = (p: MojaPrijavaProjekcija, action: 'KEEP' | 'UPDATE' | 'WITHDRAW') => {
    // Withdrawal's dialog captures and checks its own review revision. An explicit discard may
    // retire another row's edit before that question opens, so only KEEP/UPDATE use this render's revision.
    if (!rowCurrent(p) || !idle() || action !== 'WITHDRAW' && editRevision !== session.editRevision) return;
    const stale = p.stanje === 'STALE_REVIEW_REQUIRED';
    if (stale && session.expanded !== p.prijavaId || !stale && (action !== 'WITHDRAW' || !p.mozePovuci)) return;
    const draft = session.draft ? pricedOffer(session.draft) : null;
    if (action === 'KEEP' && p.osnovaCene !== 'TOTAL' && p.osnovaCene !== 'HOURLY') {
      session.message = 'Osnovica ranije cene nije potvrđena. Pregledajte cenu i broj ljudi, pa potvrdite ažuriranu prijavu.';
      render(v => v + 1); return;
    }
    if (action === 'UPDATE') {
      if (!draft) return;
      if (session.draftFor !== identity(p)) { session.message = 'Prijava se promenila tokom uređivanja. Sačuvajte svoj tekst, pa započnite novi pregled.';
        render(v => v + 1); return; }
      const price = /^\d+$/.test(draft.price) ? Number(draft.price) : NaN, people = /^\d+$/.test(draft.people) ? Number(draft.people) : NaN;
      if (positiveInteger(people) && people <= draft.pricing.pokrivenost.ukupno && draft.pricing.rezimCene === 'MY_PRICE'
        && fixedApplicationPrice(draft.pricing, people) === null) {
        session.message = 'Cena za ovaj broj ljudi mora biti najmanje 1 RSD. Proverite broj ljudi.'; render(v => v + 1); return;
      }
      if (!positiveInteger(price) || !positiveInteger(people)) { session.message = 'Unesite cenu u dinarima i broj ljudi, bez decimala.'; render(v => v + 1); return; }
      if (people > draft!.pricing.pokrivenost.ukupno) { session.message = `Možete da prijavite najviše ${draft!.pricing.pokrivenost.ukupno}.`; render(v => v + 1); return; }
      // Existing RU4 SQL limit, not a new UI/business policy.
      if (Array.from(draft.note.trim()).length > 1200) { session.message = errors.SCOPE_NOTE_TOO_LONG; render(v => v + 1); return; }
    }
    const intent: Intent = stale ? { kind: 'resolve', command: Object.freeze({ prijavaId: p.prijavaId,
      ocekivanaVerzija: p.prijavaVerzija, ocekivanaPotrebaRevizija: p.potrebaRevizija, akcija: action,
      clientRequestId: noviZahtevId(`prijava-${action.toLowerCase()}`),
      pokrivenaMesta: action === 'UPDATE' ? Number(draft!.people) : null, cenaRsd: action === 'UPDATE' ? Number(draft!.price) : null,
      napomena: action === 'UPDATE' ? draft!.note.trim() : null,
      predlozeniPocetak: action === 'UPDATE' ? draft!.start : null, predlozeniKraj: action === 'UPDATE' ? draft!.end : null }) }
      : { kind: 'withdraw', command: Object.freeze({ prijavaId: p.prijavaId, potrebaRevizija: p.potrebaRevizija,
        prijavaVerzija: p.prijavaVerzija, clientRequestId: noviZahtevId('povuci-prijavu'), razlog: null }) };
    perform({ expectedPriceBasis: action === 'UPDATE'
      ? draft!.pricing.rezimCene === 'MY_PRICE' && draft!.pricing.osnovaCene === 'HOURLY' ? 'HOURLY' : 'TOTAL'
      : p.osnovaCene === 'HOURLY' ? 'HOURLY' : 'TOTAL', intent, row: p, inFlight: false, reconciled: false, result: null, code: null });
  };
  const discardIfDirty = (next: () => void) => {
    if (!current()) return;
    if (!changedOffer(session.draft, session.original)) { next(); return; }
    const review = session.editRevision;
    confirmation.ask({ title: 'Odbaciti izmene prijave?', message: 'Uneta cena, broj ljudi ili napomena neće biti sačuvani.',
      cancelLabel: 'Nastavi uređivanje', confirmLabel: 'Odbaci izmene', tone: 'danger',
      onConfirm: () => { if (current() && review === session.editRevision) next(); } });
  };
  const withdraw = (p: MojaPrijavaProjekcija) => {
    if (!rowCurrent(p) || !idle()) return;
    discardIfDirty(() => {
      if (!rowCurrent(p) || !idle()) return;
      if (session.draft) { clearReview(); render(v => v + 1); }
      const review = session.editRevision;
      // The card shows the title without its stored wrapping quotes; the dialog names the same task the same way.
      // The question names the task and says what follows for the other person and for the worker (plan 2.3): no reason is asked.
      confirmation.ask({ title: 'Povući prijavu?',
        message: `Osoba koja je objavila zadatak više ne vidi Vašu ponudu za „${readableTitle(p.naslov)}”. Ako zadatak i dalje prima prijave, možete da pošaljete novu.`,
        cancelLabel: 'Odustani', confirmLabel: 'Povuci prijavu', tone: 'danger', onConfirm: () => {
          if (review === session.editRevision) makeIntent(p, 'WITHDRAW');
        } });
    });
  };
  const edit = async (p: MojaPrijavaProjekcija) => {
    if (!rowCurrent(p) || !idle() || session.expanded !== p.prijavaId) return;
    const generation = ++session.editRevision; session.editingLoading = true; session.message = null; render(v => v + 1);
    try {
      const result = await readExistingApplicationInterval(p);
      if (!rowCurrent(p) || generation !== session.editRevision) return;
      if (result.ok) { const offer = pricedOffer({ price: String(p.cena.iznos), people: String(p.pokrivaMesta), note: p.napomena, ...result.podatak });
        session.draft = offer; session.original = offer; session.draftFor = identity(p); }
      else session.message = 'Ne možemo da prikažemo termin i cenu prijave. Osvežite prijave pa pokušajte ponovo.';
    } catch { if (current() && generation === session.editRevision) session.message = 'Termin i cena nisu učitani. Osvežite prijave pre izmene.'; }
    finally { if (generation === session.editRevision) { session.editingLoading = false; if (current()) render(v => v + 1); } }
  };
  const navigate = (path: '/zadaci' | '/profil') => discardIfDirty(() => { clearReview(); router.navigate(path); });
  const leaveScreen = () => { clearReview(); if (router.canGoBack()) router.back(); else router.replace('/'); };
  const hardwareBack = useRef<() => boolean>(() => false);
  hardwareBack.current = () => {
    if (!current() || !changedOffer(session.draft, session.original)) return false;
    discardIfDirty(leaveScreen); return true;
  };
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => hardwareBack.current());
    return () => back.remove();
  }, []);
  const pending = session.pending, visible = current();
  const editedRow = session.expanded ? shownRows.find(p => p.prijavaId === session.expanded) : null;
  const draftStale = !!session.draft && (!editedRow || session.draftFor !== identity(editedRow));
  // Paged: nothing of another set is shown under this tab's title, a refresh keeps what is on screen, and a destination that is not in the shown set is never called missing.
  const reading = !session.focused || !session.active || (paged ? !paged.settled || paged.state.loading || (editor.loading && shownRows.length === 0) : editor.loading && shownRows.length === 0);
  const wholeSetKnown = !paged || (paged.settled && session.tab === 'all' && !paged.state.loading && !paged.state.hasMore && !paged.state.loadingMore);
  return <><MyApplicationsPresentation rows={visible ? shownRows as MojaPrijavaProjekcija[] : []} loading={reading} paging={paged?.paging}
    refreshing={!reading && (editor.loading || !!paged?.state.refreshing)}
    unavailable={!data || (!!paged && paged.settled && paged.state.error)} message={session.message ?? editor.error} notice={data?.notice ?? null}
    tab={session.tab} onTab={tab => { if (current() && tab !== session.tab) discardIfDirty(() => { clearReview(); session.tab = tab; render(v => v + 1); }); }}
    focusId={visible ? focusId : null} freshId={visible ? freshId : null} requestedId={visible && wholeSetKnown ? named : null}
    expanded={visible ? session.expanded : null} draft={visible ? session.draft : null} draftStale={visible && draftStale}
    busy={editor.busy || !!pending?.inFlight}
    editingLoading={session.editingLoading} pending={!!pending}
    pendingAction={pending ? withdrawal(pending) ? 'withdraw' : pending.intent.kind === 'resolve' && pending.intent.command.akcija === 'UPDATE' ? 'update' : 'keep' : null}
    canRetry={!!pending?.reconciled && !editor.uncertain && pending.result === 'unknown'}
    canReset={!!pending?.reconciled && !editor.uncertain && (pending.result === 'rejected' || pending.result === 'receipt')}
    onRefresh={refresh} onExplore={() => navigate('/zadaci')} onProfile={() => navigate('/profil')}
    onBack={() => discardIfDirty(leaveScreen)}
    onReview={p => { if (rowCurrent(p) && idle()) discardIfDirty(() => { clearReview(); session.expanded = p.prijavaId; render(v => v + 1); }); }}
    onClose={() => { if (current() && !session.pending) discardIfDirty(() => { clearReview(); render(v => v + 1); }); }} onEdit={p => void edit(p)}
    onChange={draft => { if (current() && idle() && editRevision === session.editRevision && session.draft) { session.draft = pricedOffer({ ...session.draft, price: draft.price, people: draft.people, note: draft.note }); session.editRevision++; session.message = null; render(v => v + 1); } }}
    onCancelEdit={() => { if (current() && idle()) discardIfDirty(() => { clearEdit(); render(v => v + 1); }); }}
    onKeep={p => makeIntent(p, 'KEEP')} onUpdate={p => makeIntent(p, 'UPDATE')} onWithdraw={withdraw}
    onAgreement={p => { if (rowCurrent(p) && !session.pending && p.stanje === 'SELECTED' && p.dogovorId)
      discardIfDirty(() => { clearReview(); router.push(`/dogovor/${p.dogovorId}` as any); }); }}
    onTask={p => { if (rowCurrent(p) && !session.pending) discardIfDirty(() => { clearReview(); router.push({ pathname: '/prilike/[id]', params: { id: p.potrebaId } }); }); }}
    onService={p => { if (rowCurrent(p) && idle() && ['SUBMITTED', 'VIEWED', 'SHORTLISTED', 'SELECTED'].includes(p.stanje))
      discardIfDirty(() => { clearReview(); router.push({ pathname: '/profil/usluga-iz-prijave' as any, params: { applicationId: p.prijavaId, needId: p.potrebaId } }); }); }}
    onRetry={() => { if (pending?.result === 'unknown' && pending === session.pending) perform(pending); }}
    onReset={() => { if (current() && pending === session.pending && pending?.reconciled && (pending.result === 'rejected' || pending.result === 'receipt') && !editor.busy && !editor.uncertain) {
      discardIfDirty(() => { session.pending = null; clearReview(); render(v => v + 1); });
    } }} />{confirmation.sheet}</>;
}
