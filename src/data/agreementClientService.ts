import { legacyRpcFailure } from './legacyRpcFailure';
import type { DogovorProjekcija, DogovorRadnje, PredlogIzmeneSazetak, UcesnikProjekcija } from '../contracts/projections';
import { completionErrors, completionFailure } from './agreementCompletion';
import type { Ishod, IzmenaKomanda, Izvor, PotvrdaZavrsetka } from './ports';
import { calendarFailure } from './calendarErrors';
import { failure, positiveInteger, readOwnedResult, record, sameId, timestamp, uuid, type ReceiptAccount } from './serverReceipt';
import { calendarInstant } from '../lib/calendarTime';
import { tacanTermin } from '../lib/tacanTermin';
import { needScheduleText } from './needDetailPresentation';
import { DOGOVORENA_ZONA } from '../lib/dogovorenoVreme';
import { supabaseKlijent } from './supabaseClient';
import { novac as novacTekst } from '../lib/novac';
import { vreme } from '../lib/vreme';
import { inicijali } from '../lib/inicijali';
import { sesijaSada } from '../store/sesija';
import { ratingReadOwnerCurrent, withAgreementRatings } from './agreementRatingsRead';

const supabase = new Proxy({} as ReturnType<typeof supabaseKlijent>, {
  get: (_target, prop) => (supabaseKlijent() as never)[prop],
});

type AgreementService = Pick<
  Izvor,
  'mojiDogovori' | 'dogovor' | 'posaljiPoruku' | 'predloziIzmenu' | 'odgovoriNaIzmenu' | 'prijaviProblem' | 'oznaciZavrsetak' | 'potvrdiZavrsetak'
>;

function fail<T>(error: unknown, code: string, message: string): Ishod<T> {
  const calendar = calendarFailure(error);
  if (calendar) return calendar;
  return legacyRpcFailure(error, code, message);
}

/** The money projection: the number, its currency, and the one way this app writes them together. */
function novac(iznos: number, valuta = 'RSD') {
  return {
    iznos,
    valuta,
    prikaz: novacTekst(iznos, valuta),
  };
}

function formatTime(iso: string | null | undefined) {
  return vreme(iso, { inace: 'Fleksibilno' });
}

function mapAgreement(raw: any, uid: string): DogovorProjekcija {
  const requester = raw.requesterAccountId === uid;
  const myId = requester ? raw.requesterAccountId : raw.workerAccountId;
  const otherId = requester ? raw.workerAccountId : raw.requesterAccountId;
  const myName = requester ? raw.requesterName : raw.workerName;
  const otherName = requester ? raw.workerName : raw.requesterName;
  const terms = raw.terms ?? {};
  if (terms.priceBasis != null && terms.priceBasis !== 'TOTAL' && terms.priceBasis !== 'HOURLY')
    throw new Error('AGREEMENT_PRICE_BASIS_INVALID');
  if (Object.prototype.hasOwnProperty.call(terms, 'currency') && terms.currency !== 'RSD')
    throw new Error('AGREEMENT_CURRENCY_INVALID');
  const acceptedTerms = record(raw.terms);
  const covered = terms.covered_slots;
  if (!positiveInteger(covered) || covered > 50 || (terms.required_slots != null
    && (!positiveInteger(terms.required_slots) || terms.required_slots > 50 || terms.required_slots < covered)))
    throw new Error('AGREEMENT_COVERAGE_INVALID');
  // Both counts belong to the accepted version. A later task edit cannot shrink
  // this party's team; older terms without the original task count keep it unknown.
  const total = terms.required_slots ?? 0;

  // pkg024a: the read names each side's public profile as well as its account. An account id is
  // not a profile id, so a missing or malformed key stays null rather than becoming a wrong read.
  const myProfileId = requester ? raw.requesterProfileId : raw.workerProfileId;
  const otherProfileId = requester ? raw.workerProfileId : raw.requesterProfileId;
  const participants: UcesnikProjekcija[] = [
    {
      id: myId,
      profilId: uuid(myProfileId) ? String(myProfileId) : null,
      ime: myName || 'Ti',
      // Letters only from a real name (lib/inicijali); none gives '' and the Avatar draws a person, never "TI".
      inicijali: inicijali(myName) ?? '',
      uloga: requester ? 'narucilac' : 'uskocer',
      mesta: requester ? null : covered,
      viSte: true,
      telefon: null,
    },
    {
      id: otherId,
      profilId: uuid(otherProfileId) ? String(otherProfileId) : null,
      ime: otherName || 'Druga strana',
      inicijali: inicijali(otherName) ?? '',
      uloga: requester ? 'uskocer' : 'narucilac',
      mesta: requester ? covered : null,
      viSte: false,
      // The current product uses only in-app messages, even against an old RPC.
      telefon: null,
    },
  ];

  const mode = raw.executionMode;
  const status = raw.status as DogovorProjekcija['stanje'];
  const amount = Number(terms.price_rsd ?? 0);
  // The historic field is explicitly price_rsd. Omission of a redundant currency
  // key does not erase that known unit; an explicit contradictory unit is refused above.
  const currency = 'RSD';
  // A missing, zero or unreadable agreed amount never reads as "0 RSD" (plan step 0, 2026-09-23): the projection
  // keeps its shape with an empty `prikaz`, and every screen says that in words instead of drawing an amount.
  const agreedAmount = Number.isFinite(amount) && amount > 0;

  return {
    id: raw.id,
    verzija: Number(raw.currentVersion),
    naslov: raw.title ?? '',
    stanje: status,
    cena: agreedAmount ? novac(amount, currency) : { iznos: 0, valuta: currency, prikaz: '' },
    osnovaCene: terms.priceBasis ?? null,
    // Parent task edits cannot silently change an already accepted Agreement.
    vremeTekst: acceptedSchedule(terms),
    ...(acceptedTerms ? {
      prihvacenPocetak: calendarInstant(acceptedTerms.proposed_start_at) !== null
        ? acceptedTerms.proposed_start_at as string
        : calendarInstant(acceptedTerms.declared_start_at) !== null
          ? acceptedTerms.declared_start_at as string : null,
      prihvacenObim: typeof acceptedTerms.scope_note === 'string' && acceptedTerms.scope_note.trim()
        && Array.from(acceptedTerms.scope_note).length <= 4000 ? acceptedTerms.scope_note : null,
    } : {}),
    putanjaTekst: [raw.approximateArea, raw.approximateCity].filter(Boolean).join(', '),
    pokrivenost: {
      ukupno: total,
      popunjeno: covered,
      preostalo: Math.max(0, total - covered),
      udeo: total > 0 ? covered / total : 0,
    },
    ucesnici: participants,
    rezim: mode === 'REMOTE' ? 'DALJINSKI' : mode === 'PICKUP_DELIVERY' ? 'PREUZIMANJE_DOSTAVA' : 'FIZICKI',
    kontakt: {
      // A legacy server may still project older PHONE grants until migration.
      // Never surface those fields in the supported messages-only client.
      mojTelefonPodeljen: false,
      njihovTelefon: null,
      lokacijaPostoji: mode !== 'REMOTE',
      tacnaLokacija: null,
      emailNijeDeljen: true,
    },
    chatDostupan: raw.agreementStatus === 'CONFIRMED' || raw.agreementStatus === 'SUPERSEDED',
    rokPotvrdeIso: raw.requesterDeadlineAt ?? null,
    problemOtvoren: Boolean(raw.problemOpened),
    // Only whether the Dogovor is finished; the list below asks the review read whether MY rating is still due.
    ocenaMoguca: status === 'COMPLETED',
    hronologija: [{ vremeTekst: formatTime(raw.createdAt), tekst: 'Dogovor je sklopljen' }],
    radnje: agreementActions(raw, uid),
    // PKG-023a. The workspace read has never carried either of these, so a null here means the
    // reader did not say, not that there is no term and no pending change.
    pocinje: typeof raw.startsAt === 'string' ? raw.startsAt : null,
    izmenaCeka: raw.pendingChange && typeof raw.pendingChange.id === 'string'
      ? { predlogId: raw.pendingChange.id, mojPredlog: raw.pendingChange.proposedByMe === true } : null,
    // PKG-048: the Zadatak and the Prijava this Dogovor grew out of. A server that does not say
    // leaves both null, and the screen then offers nothing rather than a row that leads nowhere.
    izvor: {
      zadatakId: uuid(raw.needId) ? String(raw.needId) : null,
      prijavaId: uuid(raw.applicationId) ? String(raw.applicationId) : null,
    },
    // Owner step 10 (critique A15): the accepted exact window, read from the same accepted terms as `vremeTekst`, so
    // the calendar can place my own tasks and finished Dogovori. A read without terms leaves the field out: the
    // calendar then says it shows only my work instead of calling a day empty.
    ...(raw.terms !== null && typeof raw.terms === 'object' && !Array.isArray(raw.terms)
      ? { tacanTermin: tacanTermin(terms.proposed_start_at, terms.proposed_end_at) } : {}),
  };
}

/** PKG-007 / GAP-0033: rpc_confirm_completion returns one authoritative terminal
 * receipt for both the original confirmation and the already-completed replay. A
 * void ACK, a foreign Agreement, a non-terminal state or an unreadable instant never
 * counts as completion. */
function decodeCompletionReceipt(raw: unknown, dogovorId: string): PotvrdaZavrsetka | null {
  const receipt = record(raw);
  if (!receipt || !sameId(receipt.agreementId, dogovorId) || receipt.state !== 'COMPLETED' ||
    !timestamp(receipt.completedAt) || typeof receipt.idempotentReplay !== 'boolean' || receipt.authoritative !== true) return null;
  return { zavrsenoIso: receipt.completedAt, ponovljeno: receipt.idempotentReplay };
}

/** PKG-007: the workspace's own actionState, bound to this Agreement, version and
 * account, is the only completion authority. The list RPC carries none; anything
 * missing, foreign, stale or malformed fails closed to null instead of a guess. */
function agreementActions(raw: Record<string, unknown>, uid: string): DogovorRadnje | null {
  const actions = decodeActionState(raw.actionState, raw.id, raw.currentVersion, uid);
  return actions && { mozeOznacitiZavrsetak: actions.canMarkWorkDone, mozePotvrditiZavrsetak: actions.canConfirmCompletion,
    izmenaNaCekanju: actions.pendingChanges.length > 0, predlogIzmene: pendingChangeSummary(raw, actions, uid) };
}

/**
 * The pending proposal, said in words on the Dogovor itself. It blocks both completions, and until
 * now the Dogovor showed it as one grey sentence with nothing to press, while what it proposed and
 * who had to answer lived one screen away behind "Izmene i otkazivanje". Same validation as the
 * Izmene reader; anything unreadable is `null`, never a guess.
 */
function pendingChangeSummary(raw: Record<string, unknown>, actions: ServerActionState, uid: string): PredlogIzmeneSazetak | null {
  const proposal = actions.pendingChanges.length === 1 && uuid(raw.id) && positiveInteger(raw.currentVersion)
    && uuid(raw.requesterAccountId) && uuid(raw.workerAccountId)
    ? decodePendingProposal(actions.pendingChanges[0], raw.id, raw.currentVersion, raw.requesterAccountId, raw.workerAccountId) : null;
  const accepted = decodeChangeTerms(raw.terms);
  if (!proposal || !proposal.termsAvailable || !accepted
    || proposal.terms.priceBasis !== accepted.priceBasis || proposal.terms.coveredSlots !== accepted.coveredSlots) return null;
  const proposed = proposal.terms, mine = sameId(proposal.proposedBy, uid);
  const window = (terms: AgreementChangeTerms) => acceptedSchedule({ proposed_start_at: terms.startsAt, proposed_end_at: terms.endsAt });
  const izmene: PredlogIzmeneSazetak['izmene'] = [];
  if (proposed.priceRsd !== accepted.priceRsd) izmene.push({ polje: 'Cena', sada: novac(accepted.priceRsd).prikaz + (accepted.priceBasis === 'HOURLY' ? ' po osobi po satu' : ''), predlog: novac(proposed.priceRsd).prikaz + (proposed.priceBasis === 'HOURLY' ? ' po osobi po satu' : '') });
  if (proposed.startsAt !== accepted.startsAt || proposed.endsAt !== accepted.endsAt) izmene.push({ polje: 'Termin', sada: window(accepted), predlog: window(proposed) });
  if ((proposed.scopeNote ?? '') !== (accepted.scopeNote ?? '')) izmene.push({ polje: 'Obim', sada: accepted.scopeNote || 'Nije naveden', predlog: proposed.scopeNote || 'Nije naveden' });
  return { id: proposal.proposalId, moj: mine, mozeOdgovoriti: !mine && actions.canRespondChange,
    mozePovuci: mine && actions.canWithdrawChange, razlog: proposal.reason, izmene };
}

function acceptedSchedule(terms: Record<string, unknown>): string {
  const start = terms.proposed_start_at, end = terms.proposed_end_at;
  if (start == null && end == null) {
    // Confirmed task beginning, no invented agreement duration or calendar lock.
    const declared = terms.declared_start_at;
    if (typeof declared === 'string' && calendarInstant(declared) !== null) {
      return needScheduleText({ kind: 'FIXED_WINDOW', startsAt: declared, endsAt: null },
        DOGOVORENA_ZONA) + ' · trajanje po dogovoru';
    }
    return 'Termin nije dogovoren';
  }
  if ((start != null && (typeof start !== 'string' || calendarInstant(start) === null)) ||
    (end != null && (typeof end !== 'string' || calendarInstant(end) === null))) return 'Termin nije dostupan';
  // The workspace returns accepted instants but no accepted display timezone. They were once shown
  // in UTC (two hours early in Belgrade), then in each reader's own phone zone, so one Dogovor read
  // two ways on two phones. The owner's rule (2026-09-21, deep read 8.27): Serbian time for both,
  // named "po vremenu u Srbiji" on a phone set elsewhere.
  return needScheduleText({ kind: 'FIXED_WINDOW', startsAt: start as string | null ?? null, endsAt: end as string | null ?? null },
    DOGOVORENA_ZONA)
    + (start == null ? ' · početak nije potvrđen' : end == null ? ' · kraj nije potvrđen' : '');
}

async function userId() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error('AUTH_REQUIRED');
  return data.user.id;
}

export type AgreementProblemReceipt = {
  agreementId: string; problemOpenedAt: string; problemOpenedBy: string;
  idempotentReplay: boolean; noAutomaticFaultOrDebt: true; authoritative: true;
};
export type AgreementProblemSnapshot = {
  agreementId: string; agreementVersion: number;
} & ({ state: 'AVAILABLE'; report: { openedAt: string; openedBy: string; narrative: string } }
  | { state: 'ABSENT' | 'LEGACY_UNAVAILABLE'; report: null });
const problemErrors = {
  AUTH_REQUIRED: 'Prijavi se da nastaviš.', NOT_PARTY: 'Nemaš pristup ovom Dogovoru.',
  ACCOUNT_CLOSING: 'Radnja je zaustavljena zbog postupka zatvaranja naloga. Osveži prikaz.',
  NEED_NOT_FOUND: 'Zadatak ovog Dogovora nije dostupan. Osveži prikaz.',
  AGREEMENT_NOT_FOUND: 'Dogovor nije dostupan.', EXECUTION_NOT_FOUND: 'Stanje Dogovora nije dostupno.',
  AGREEMENT_NOT_REPORTABLE: 'Problem se može prijaviti samo dok je Dogovor aktivan.',
  EXECUTION_NOT_REPORTABLE: 'Dogovor je promenjen. Proveri njegovo stanje.',
  NARRATIVE_REQUIRED: 'Opiši problem.', NARRATIVE_TOO_LONG: 'Opis može imati najviše 4.000 znakova.',
};
const problemOptions = { errors: problemErrors, fallback: 'PROBLEM_REPORT_UNCONFIRMED', invalid: 'PROBLEM_REPORT_INVALID' };
/** A problem report refused for a known reason (deep read 8.8): its own sentence, not "Prijava nije potvrđena". */
export const knownProblemRefusal = (kod: string) => Object.prototype.hasOwnProperty.call(problemErrors, kod);
const exactKeys = (row: Record<string, unknown>, keys: readonly string[]) =>
  Object.keys(row).length === keys.length && keys.every(key => Object.prototype.hasOwnProperty.call(row, key));

/** One existing P0E writer. Its narrative is shared in Agreement messages;
 * this is not a confidential abuse report or a separate moderation case. */
export const agreementProblemService = {
  async submit(agreementId: string, description: string, account?: ReceiptAccount): Promise<Ishod<AgreementProblemReceipt>> {
    const narrative = description.trim();
    if (!narrative) return failure('NARRATIVE_REQUIRED', problemErrors.NARRATIVE_REQUIRED);
    if (Array.from(narrative).length > 4000) return failure('NARRATIVE_TOO_LONG', problemErrors.NARRATIVE_TOO_LONG);
    if (!uuid(agreementId)) return failure('AGREEMENT_NOT_FOUND', problemErrors.AGREEMENT_NOT_FOUND);
    return readOwnedResult({ ...problemOptions, account, write: true,
      request: () => supabase.rpc('rpc_report_problem', { p_agreement_id: agreementId, p_narrative: narrative }),
      decode: raw => {
        const row = record(raw);
        if (!row || !exactKeys(row, ['agreementId', 'problemOpenedAt', 'problemOpenedBy', 'idempotentReplay', 'noAutomaticFaultOrDebt', 'authoritative']) ||
          !sameId(row.agreementId, agreementId) || !uuid(row.problemOpenedBy) ||
          typeof row.problemOpenedAt !== 'string' || calendarInstant(row.problemOpenedAt) === null ||
          typeof row.idempotentReplay !== 'boolean' || row.noAutomaticFaultOrDebt !== true || row.authoritative !== true) return null;
        return row as AgreementProblemReceipt;
      },
    });
  },
  read(agreementId: string, version: number, participantIds: readonly string[], account: ReceiptAccount): Promise<Ishod<AgreementProblemSnapshot>> {
    if (!uuid(agreementId) || !positiveInteger(version) || participantIds.length !== 2 ||
      !participantIds.every(uuid) || participantIds[0] === participantIds[1] || !participantIds.includes(account.accountId)) {
      return Promise.resolve(failure('PROBLEM_REPORT_INVALID', 'Prijava problema nije dostupna. Ponovo otvori Dogovor.'));
    }
    return readOwnedResult({ ...problemOptions, account, fallback: 'PROBLEM_REPORT_READ_FAILED',
      // Existing participant RLS owns access; no raw account or private unrelated fields.
      request: () => supabase.from('agreement_execution')
        .select('agreement_id,agreement_version,problem_opened_at,problem_opened_by,problem_narrative')
        .eq('agreement_id', agreementId).maybeSingle(),
      decode: raw => {
        const row = record(raw);
        if (!row || !exactKeys(row, ['agreement_id', 'agreement_version', 'problem_opened_at', 'problem_opened_by', 'problem_narrative']) ||
          !sameId(row.agreement_id, agreementId) || row.agreement_version !== version) return null;
        const base = { agreementId, agreementVersion: version };
        if (row.problem_opened_at === null && row.problem_opened_by === null && row.problem_narrative === null) return { ...base, state: 'ABSENT', report: null };
        if (typeof row.problem_opened_at !== 'string' || calendarInstant(row.problem_opened_at) === null ||
          (row.problem_opened_by !== null && (typeof row.problem_opened_by !== 'string' || !participantIds.includes(row.problem_opened_by))) ||
          (row.problem_narrative !== null && (typeof row.problem_narrative !== 'string' || !row.problem_narrative.trim()))) return null;
        // Pre-20260830191500 reports stored only the timestamp; that migration
        // added nullable details without backfill. Pre-P0E text had no length cap.
        // Preserve the known open flag, but never invent details or return unbounded text.
        if (row.problem_opened_by === null || row.problem_narrative === null ||
          row.problem_narrative.length > 8000 || Array.from(row.problem_narrative).length > 4000) {
          return { ...base, state: 'LEGACY_UNAVAILABLE', report: null };
        }
        return { ...base, state: 'AVAILABLE', report: { openedAt: row.problem_opened_at, openedBy: row.problem_opened_by, narrative: row.problem_narrative } };
      },
    });
  },
};

/** Selective admission from saved M05 commit60a3ce68, with source113 action
 * snapshot and bounds. PR101 safe errors and legacy message refusal stay intact. */
export type AgreementChangeTerms = {
  priceRsd: number; priceBasis: 'TOTAL' | 'HOURLY'; currency: 'RSD'; coveredSlots: number;
  scopeNote: string | null; startsAt: string | null; endsAt: string | null;
};
export type AgreementChangeProposal = {
  proposalId: string; agreementId: string; baseVersion: number; proposedBy: string;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'SUPERSEDED' | 'WITHDRAWN'; reason: string | null;
  createdAt: string; respondedBy: string | null; respondedAt: string | null;
} & ({ termsAvailable: true; terms: AgreementChangeTerms } | { termsAvailable: false; terms: null });
export type AgreementChangeSnapshot = {
  agreementId: string; agreementVersion: number;
  /** Display context from the same workspace read; older in-memory snapshots may omit it. */
  title?: string | null;
  agreementStatus: 'CONFIRMED' | 'SUPERSEDED' | 'COMPLETED' | 'CANCELLED';
  requesterAccountId: string; workerAccountId: string;
  /** The other party's name as the workspace reply already carries it (its requesterName / workerName); null when it
   * names none, so a screen says "Predlog druge strane" instead of inventing one (round 6, Izmene scene 10). */
  counterpartName: string | null;
  terms: AgreementChangeTerms | null; proposals: AgreementChangeProposal[];
  actions: AgreementActionState;
};
export type AgreementChangeReceipt = {
  proposalId: string; accepted: boolean; agreementVersion: number; authoritative: true;
};
export type AgreementActionState = {
  agreementId: string; agreementVersion: number; accountId: string; authoritative: true;
  canProposeChange: boolean; canRespondChange: boolean; canWithdrawChange: boolean;
  canMarkWorkDone: boolean; canConfirmCompletion: boolean; canCancel: boolean;
};
export type AgreementCommandReadback = { found: false } | { found: true; proposalId: string;
  agreementId: string; baseVersion: number; proposedBy: string; status: AgreementChangeProposal['status'] };
const actionKeys = ['canProposeChange', 'canRespondChange', 'canWithdrawChange',
  'canMarkWorkDone', 'canConfirmCompletion', 'canCancel'] as const;
type ServerActionState = Record<typeof actionKeys[number], boolean> & { pendingChanges: unknown[] };
/** One validation for both readers of actionState: authoritative, bound to the exact
 * Agreement/version/account, every capability boolean, at most one pending change. */
function decodeActionState(raw: unknown, agreementId: unknown, version: unknown, accountId: string): ServerActionState | null {
  const actions = record(raw);
  if (!actions || actions.authoritative !== true || !uuid(agreementId) || !sameId(actions.agreementId, agreementId) ||
    !positiveInteger(version) || actions.agreementVersion !== version || !sameId(actions.accountId, accountId) ||
    actionKeys.some(key => typeof actions[key] !== 'boolean') || !Array.isArray(actions.pendingChanges) ||
    actions.pendingChanges.length > 1) return null;
  return { canProposeChange: actions.canProposeChange as boolean, canRespondChange: actions.canRespondChange as boolean,
    canWithdrawChange: actions.canWithdrawChange as boolean, canMarkWorkDone: actions.canMarkWorkDone as boolean,
    canConfirmCompletion: actions.canConfirmCompletion as boolean, canCancel: actions.canCancel as boolean,
    pendingChanges: actions.pendingChanges };
}
const changeErrors = {
  ACCOUNT_CLOSING: 'Radnja je zaustavljena zbog postupka zatvaranja naloga. Osveži prikaz.',
  INTERACTION_BLOCKED: 'Ova radnja nije dostupna zbog blokiranja između učesnika. Za pomoć otvori podršku.',
  ALREADY_COMPLETED: 'Dogovor je već završen i ne može da se otkaže. Osveži njegov status.',
  NEED_NOT_FOUND: 'Zadatak ovog Dogovora nije dostupan. Osveži prikaz.',
  AGREEMENT_NEED_MISMATCH: 'Podaci Dogovora nisu usklađeni. Osveži prikaz; ako problem ostane, otvori podršku.',
  REASON_REQUIRED: 'Unesi razlog otkazivanja.',
  AGREEMENT_CAPABILITIES_NOT_READY: 'Radnje Dogovora još nisu spremne. Osveži prikaz kasnije.',
  AGREEMENT_CHANGE_AFTER_WORK_DONE: 'Rad je označen kao završen. Uslovi se više ne mogu menjati.',
  AGREEMENT_CHANGE_PENDING: 'Najpre odgovori na postojeći predlog izmene.',
  AGREEMENT_NOT_FOUND_OR_FORBIDDEN: 'Dogovor nije dostupan.',
  NOT_PROPOSER: 'Samo autor može da povuče ovaj predlog.',
  CHANGE_INPUT_TOO_LARGE: 'Predlog prelazi dozvoljenu dužinu.',
  AUTH_REQUIRED: 'Prijavi se da nastaviš.', NOT_PARTY: 'Nemaš pristup ovom Dogovoru.',
  AGREEMENT_NOT_FOUND: 'Dogovor nije dostupan.', AGREEMENT_VERSION_NOT_FOUND: 'Verzija Dogovora nije dostupna.',
  AGREEMENT_NOT_ACTIVE: 'Dogovor više nije aktivan. Osveži njegov status.',
  VERSION_REQUIRED: 'Ponovo učitaj važeću verziju Dogovora.', VERSION_CONFLICT: 'Dogovor je promenjen. Osveži važeće uslove.',
  CHANGE_PATCH_REQUIRED: 'Izmeni bar jedno polje Dogovora.',
  CLIENT_REQUEST_ID_REQUIRED: 'Zahtev nije spreman. Ponovo otvori izmenu.',
  CHANGE_REQUEST_ID_REUSED: 'Ovaj zahtev već pripada drugoj izmeni. Osveži predloge.',
  UNSUPPORTED_CHANGE_FIELD: 'Predlog sadrži nepodržanu izmenu.', INVALID_PRICE: 'Unesi pozitivan ceo iznos u RSD.',
  CHANGE_SCOPE_INVALID: 'Proveri opis obima zadatka.', CHANGE_CURRENCY_INVALID: 'Valuta Dogovora mora biti RSD.',
  CHANGE_TERMS_INVALID: 'Uslovi predloga nisu dostupni za prihvatanje.',
  CHANGE_PROPOSAL_NOT_FOUND: 'Predlog izmene nije dostupan.', PROPOSER_CANNOT_RESPOND: 'Na predlog odgovara druga strana.',
  PROPOSAL_NOT_PENDING: 'Na ovaj predlog više nije moguće odgovoriti.', DECISION_REQUIRED: 'Izaberi odgovor na predlog.',
  AGREEMENT_CALENDAR_INTERVAL_INVALID: 'Proveri tačan početak i kraj dogovorenog termina.',
  WORKER_CALENDAR_CONFLICT: 'Termin se preklapa sa drugim Dogovorom. Proveri Raspored i izaberi drugi termin.',
  CALENDAR_RECHECK_REQUIRED: 'Raspored se upravo promenio. Osveži podatke pre ponovnog pokušaja.',
  // PKG-031a (owner decision 2026-09-21, deep read 7.16): after the worker says done, the requester
  // confirms or reports a problem; the server refuses a cancel from a screen that did not know yet.
  AGREEMENT_WORK_REPORTED_DONE: 'Druga strana je javila da je zadatak gotov. Potvrdi završetak ili prijavi problem.',
};
// Input refusal and malformed success receipt must never share a code: only the
// former proves no command was accepted. The controller uses this same allowlist.
export const knownAgreementChangeRefusal = (kod: string) => kod === 'AGREEMENT_CHANGE_INVALID'
  || Object.prototype.hasOwnProperty.call(changeErrors, kod);
const changeOptions = { errors: changeErrors, fallback: 'AGREEMENT_CHANGE_UNCONFIRMED', invalid: 'AGREEMENT_CHANGE_INVALID_RECEIPT' };
const changeFields = ['cenaIznos', 'cenaValuta', 'pocetakIso', 'krajIso', 'obim'];
function changePatch(command: IzmenaKomanda): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  if (command.izmena.cenaIznos !== undefined) patch.price_rsd = command.izmena.cenaIznos;
  if (command.izmena.cenaValuta !== undefined) patch.currency = command.izmena.cenaValuta;
  if (command.izmena.pocetakIso !== undefined) patch.proposed_start_at = command.izmena.pocetakIso;
  if (command.izmena.krajIso !== undefined) patch.proposed_end_at = command.izmena.krajIso;
  if (command.izmena.obim !== undefined) patch.scope_note = command.izmena.obim;
  return patch;
}
// Legacy Izvor and the typed screen boundary share the same physical RPC adapters.
function proposeChange(command: IzmenaKomanda, patch: Record<string, unknown>) {
  return supabase.rpc('rpc_propose_agreement_change_v2', {
    p_agreement_id: command.dogovorId, p_expected_version: command.ocekivanaVerzija,
    p_patch: patch, p_reason: command.razlog ?? null, p_client_request_id: command.clientRequestId,
  });
}
function respondChange(proposalId: string, accept: boolean) {
  return supabase.rpc('rpc_respond_agreement_change', { p_proposal_id: proposalId, p_accept: accept });
}
function decodeChangeTerms(raw: unknown): AgreementChangeTerms | null {
  const terms = record(raw);
  if (!terms || !positiveInteger(terms.price_rsd) ||
    (terms.priceBasis !== 'TOTAL' && terms.priceBasis !== 'HOURLY') ||
    !positiveInteger(terms.covered_slots) || terms.covered_slots > 50 ||
    (terms.required_slots != null && (!positiveInteger(terms.required_slots) || terms.required_slots > 50 || terms.required_slots < terms.covered_slots)) ||
    (terms.scope_note != null && (typeof terms.scope_note !== 'string' || Array.from(terms.scope_note).length > 4000)) ||
    (Object.prototype.hasOwnProperty.call(terms, 'currency') && terms.currency !== 'RSD')) return null;
  const start = terms.proposed_start_at ?? null, end = terms.proposed_end_at ?? null;
  if (start !== null || end !== null) {
    const s = calendarInstant(start), e = calendarInstant(end);
    if ((s === undefined) !== (e === undefined) || s === null || e === null || s >= e) return null;
  }
  return { priceRsd: terms.price_rsd, priceBasis: terms.priceBasis, currency: 'RSD', coveredSlots: terms.covered_slots,
    scopeNote: terms.scope_note as string | null ?? null,
    startsAt: start as string | null, endsAt: end as string | null };
}
/** The workspace owns both pending rows and capability truth. One bounded
 * snapshot replaces the saved branch's unbounded history read and triple query.
 * Malformed historic terms are unavailable, never normalized into new terms. */
function decodeChangeWorkspace(raw: unknown, agreementId: string, accountId: string): AgreementChangeSnapshot | null {
  const row = record(raw);
  if (!row || !sameId(row.id, agreementId) || !positiveInteger(row.currentVersion) ||
    !uuid(row.requesterAccountId) || !uuid(row.workerAccountId) || sameId(row.requesterAccountId, row.workerAccountId) ||
    (!sameId(row.requesterAccountId, accountId) && !sameId(row.workerAccountId, accountId)) ||
    !['CONFIRMED', 'SUPERSEDED', 'COMPLETED', 'CANCELLED'].includes(row.agreementStatus as string)) return null;
  const actions = decodeActionState(row.actionState, agreementId, row.currentVersion, accountId);
  if (!actions) return null;
  const accepted = decodeChangeTerms(row.terms);
  const proposals: AgreementChangeProposal[] = [];
  for (const item of actions.pendingChanges) {
    const proposal = decodePendingProposal(item, agreementId, row.currentVersion, row.requesterAccountId, row.workerAccountId);
    if (!proposal || accepted && proposal.termsAvailable
      && (proposal.terms.priceBasis !== accepted.priceBasis || proposal.terms.coveredSlots !== accepted.coveredSlots)) return null;
    // An unreadable accepted unit cannot become TOTAL by accepting a later
    // proposal. Keep the identity so a party may still reject or withdraw it.
    proposals.push(accepted ? proposal : { ...proposal, termsAvailable: false, terms: null });
  }
  // The same two name fields the Dogovor projection reads (mapAgreement); a missing or blank one is null, never a label.
  const counterpart = sameId(row.requesterAccountId, accountId) ? row.workerName : row.requesterName;
  return { agreementId, agreementVersion: row.currentVersion,
    title: typeof row.title === 'string' && row.title.trim() ? row.title.trim() : null,
    agreementStatus: row.agreementStatus as AgreementChangeSnapshot['agreementStatus'],
    requesterAccountId: row.requesterAccountId, workerAccountId: row.workerAccountId,
    counterpartName: typeof counterpart === 'string' && counterpart.trim() ? counterpart.trim() : null,
    terms: accepted, proposals,
    actions: { agreementId, agreementVersion: row.currentVersion, accountId, authoritative: true,
      canProposeChange: actions.canProposeChange && accepted !== null, canRespondChange: actions.canRespondChange,
      canWithdrawChange: actions.canWithdrawChange, canMarkWorkDone: actions.canMarkWorkDone,
      canConfirmCompletion: actions.canConfirmCompletion, canCancel: actions.canCancel } };
}
/** One pending row of actionState, bound to this Agreement, its version and its two parties. */
function decodePendingProposal(item: unknown, agreementId: string, currentVersion: number,
  requesterAccountId: string, workerAccountId: string): AgreementChangeProposal | null {
  const r = record(item);
  if (!r || !uuid(r.id) || !positiveInteger(r.baseVersion) || r.baseVersion > currentVersion ||
    (!sameId(r.proposedByAccountId, requesterAccountId) && !sameId(r.proposedByAccountId, workerAccountId)) ||
    typeof r.createdAt !== 'string' || calendarInstant(r.createdAt) === null || !record(r.proposedTerms) ||
    (r.reason !== null && (typeof r.reason !== 'string' || Array.from(r.reason).length > 4000))) return null;
  const terms = decodeChangeTerms(r.proposedTerms);
  return { proposalId: r.id, agreementId, baseVersion: r.baseVersion, proposedBy: r.proposedByAccountId as string,
    status: 'PENDING', reason: r.reason as string | null, createdAt: r.createdAt, respondedBy: null, respondedAt: null,
    ...(terms ? { termsAvailable: true as const, terms } : { termsAvailable: false as const, terms: null }) };
}
function changeAccount(account: ReceiptAccount): ReceiptAccount | null {
  return account && uuid(account.accountId) && Number.isSafeInteger(account.accountRevision) && account.accountRevision >= 0
    ? { accountId: account.accountId, accountRevision: account.accountRevision } : null;
}
async function changeResponse(request: PromiseLike<unknown>): Promise<unknown> {
  const response = await request, result = record(response), error = record(result?.error);
  return error?.code === '40001' || error?.code === '40P01'
    ? { data: null, error: { message: 'CALENDAR_RECHECK_REQUIRED' } } : response;
}

export const agreementChangeService = {
  /** Exact existing participant-RLS row, never a newest-row inference. Request
   * keys are additionally scoped to their author; no proposal body is returned. */
  readCommand(agreementId: string, key: { clientRequestId: string } | { proposalId: string }, account: ReceiptAccount): Promise<Ishod<AgreementCommandReadback>> {
    const owner = changeAccount(account), selector = record(key), byId = selector !== null && Object.hasOwn(selector, 'proposalId');
    const value = byId ? selector?.proposalId : selector?.clientRequestId;
    if (!owner || !selector || !exactKeys(selector, [byId ? 'proposalId' : 'clientRequestId']) || !uuid(agreementId) || typeof value !== 'string' || (byId ? !uuid(value)
      : !value.trim() || Array.from(value).length > 200))
      return Promise.resolve(failure('AGREEMENT_CHANGE_INVALID', 'Potvrda radnje nije dostupna.'));
    return readOwnedResult({ ...changeOptions, account: owner, fallback: 'AGREEMENT_CHANGE_READ_FAILED',
      request: () => {
        const query = supabase.from('agreement_change_proposals').select('id,agreement_id,base_version,proposed_by_account_id,status').eq('agreement_id', agreementId);
        return (byId ? query.eq('id', value) : query.eq('proposed_by_account_id', owner.accountId).eq('client_request_id', value)).maybeSingle();
      },
      decode: raw => {
        if (raw === null) return { found: false };
        const row = record(raw);
        if (!row || !exactKeys(row, ['id', 'agreement_id', 'base_version', 'proposed_by_account_id', 'status'])
          || !uuid(row.id) || !sameId(row.agreement_id, agreementId) || !positiveInteger(row.base_version) || !uuid(row.proposed_by_account_id)
          || (byId ? !sameId(row.id, value) : !sameId(row.proposed_by_account_id, owner.accountId))
          || !['PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN'].includes(row.status as string)) return null;
        return { found: true, proposalId: row.id, agreementId, baseVersion: row.base_version,
          proposedBy: row.proposed_by_account_id, status: row.status as AgreementChangeProposal['status'] };
      },
    });
  },
  /** The existing RPC returns void. Its ACK is not a terminal-state receipt;
   * callers still read the canonical workspace before displaying CANCELLED. */
  cancel(agreementId: string, reason: string, account: ReceiptAccount): Promise<Ishod<{ acknowledged: true }>> {
    const owner = changeAccount(account);
    if (!owner || !uuid(agreementId) || typeof reason !== 'string' || !reason.trim() || Array.from(reason).length > 4000)
      return Promise.resolve(failure('AGREEMENT_CHANGE_INVALID', 'Unesi razlog otkazivanja, do 4.000 znakova.'));
    return readOwnedResult({ ...changeOptions, account: owner, write: true,
      request: () => supabase.rpc('rpc_cancel_agreement', { p_agreement_id: agreementId, p_reason: reason.trim() }),
      decode: raw => raw === null ? { acknowledged: true } : null,
    });
  },
  async read(agreementId: string, account: ReceiptAccount): Promise<Ishod<AgreementChangeSnapshot>> {
    const owner = changeAccount(account);
    if (!uuid(agreementId) || !owner) return failure('AGREEMENT_CHANGE_INVALID', 'Dogovor nije dostupan. Ponovo ga otvori.');
    return readOwnedResult({ ...changeOptions, account: owner, fallback: 'AGREEMENT_CHANGE_READ_FAILED',
      request: async () => {
        const result = await supabase.rpc('rpc_get_agreement_workspace', { p_agreement_id: agreementId });
        if (result.error === null && record(result.data) && !record(record(result.data)?.actionState)) {
          return { data: null, error: { message: 'AGREEMENT_CAPABILITIES_NOT_READY' } };
        }
        return result;
      },
      decode: raw => decodeChangeWorkspace(raw, agreementId, owner.accountId),
    });
  },
  async propose(command: IzmenaKomanda, account: ReceiptAccount): Promise<Ishod<{ proposalId: string }>> {
    const owner = changeAccount(account), raw = record(command), delta = record(raw?.izmena);
    if (!owner || !raw || !uuid(raw.dogovorId) || !positiveInteger(raw.ocekivanaVerzija) || !delta ||
      Object.keys(raw).some(key => !['dogovorId', 'ocekivanaVerzija', 'izmena', 'razlog', 'clientRequestId'].includes(key)) ||
      Object.keys(delta).some(key => !changeFields.includes(key))) return failure('AGREEMENT_CHANGE_INVALID', 'Predlog izmene nije ispravan.');
    if (typeof raw.clientRequestId !== 'string' || !raw.clientRequestId.trim()) return failure('CLIENT_REQUEST_ID_REQUIRED', changeErrors.CLIENT_REQUEST_ID_REQUIRED);
    if (Array.from(raw.clientRequestId).length > 200 || (typeof raw.razlog === 'string' && Array.from(raw.razlog).length > 4000)) return failure('CHANGE_INPUT_TOO_LARGE', changeErrors.CHANGE_INPUT_TOO_LARGE);
    if (raw.razlog !== undefined && typeof raw.razlog !== 'string') return failure('AGREEMENT_CHANGE_INVALID', 'Proveri razlog izmene.');
    if (delta.cenaIznos !== undefined && !positiveInteger(delta.cenaIznos)) return failure('INVALID_PRICE', changeErrors.INVALID_PRICE);
    if (delta.cenaValuta !== undefined && delta.cenaValuta !== 'RSD') return failure('CHANGE_CURRENCY_INVALID', changeErrors.CHANGE_CURRENCY_INVALID);
    if (typeof delta.obim === 'string' && Array.from(delta.obim).length > 4000) return failure('CHANGE_INPUT_TOO_LARGE', changeErrors.CHANGE_INPUT_TOO_LARGE);
    if (delta.obim !== undefined && typeof delta.obim !== 'string') return failure('CHANGE_SCOPE_INVALID', changeErrors.CHANGE_SCOPE_INVALID);
    const s = delta.pocetakIso === undefined ? undefined : calendarInstant(delta.pocetakIso);
    const e = delta.krajIso === undefined ? undefined : calendarInstant(delta.krajIso);
    if ((s === undefined) !== (e === undefined) || s === null || e === null || (s !== undefined && e !== undefined && s >= e)) return failure('AGREEMENT_CALENDAR_INTERVAL_INVALID', changeErrors.AGREEMENT_CALENDAR_INTERVAL_INVALID);
    const frozen = { ...command, izmena: { ...command.izmena } }, patch = Object.freeze(changePatch(frozen));
    if (!Object.keys(patch).length) return failure('CHANGE_PATCH_REQUIRED', changeErrors.CHANGE_PATCH_REQUIRED);
    return readOwnedResult({ ...changeOptions, account: owner, write: true,
      request: () => changeResponse(proposeChange(frozen, patch)),
      decode: data => uuid(data) ? { proposalId: data } : null });
  },
  async respond(proposal: AgreementChangeProposal, accept: boolean, account: ReceiptAccount): Promise<Ishod<AgreementChangeReceipt>> {
    const owner = changeAccount(account);
    if (!owner || !proposal || !uuid(proposal.proposalId) || !uuid(proposal.agreementId) || !uuid(proposal.proposedBy) ||
      !positiveInteger(proposal.baseVersion) || typeof accept !== 'boolean' ||
      !['PENDING', 'ACCEPTED', 'REJECTED', 'SUPERSEDED', 'WITHDRAWN'].includes(proposal.status)) return failure('AGREEMENT_CHANGE_INVALID', 'Predlog nije dostupan. Osveži Dogovor.');
    if (sameId(proposal.proposedBy, owner.accountId)) return failure('PROPOSER_CANNOT_RESPOND', changeErrors.PROPOSER_CANNOT_RESPOND);
    if (proposal.status !== 'PENDING' && !(accept && proposal.status === 'ACCEPTED') && !(!accept && proposal.status === 'REJECTED'))
      return failure('PROPOSAL_NOT_PENDING', changeErrors.PROPOSAL_NOT_PENDING);
    if (accept && (!proposal.termsAvailable || !proposal.terms || !positiveInteger(proposal.baseVersion + 1)
      || !positiveInteger(proposal.terms.priceRsd) || proposal.terms.currency !== 'RSD'
      || (proposal.terms.priceBasis !== 'TOTAL' && proposal.terms.priceBasis !== 'HOURLY')
      || !positiveInteger(proposal.terms.coveredSlots) || proposal.terms.coveredSlots > 50))
      return failure('CHANGE_TERMS_INVALID', changeErrors.CHANGE_TERMS_INVALID);
    const proposalId = proposal.proposalId, expectedVersion = proposal.baseVersion + (accept ? 1 : 0);
    return readOwnedResult({ ...changeOptions, account: owner, write: true,
      request: () => changeResponse(respondChange(proposalId, accept)),
      decode: raw => {
        const row = record(raw);
        return row && exactKeys(row, ['proposalId', 'accepted', 'agreementVersion', 'authoritative']) &&
          sameId(row.proposalId, proposalId) && row.accepted === accept && row.agreementVersion === expectedVersion && row.authoritative === true
          ? row as AgreementChangeReceipt : null;
      } });
  },
  withdraw(proposalId: string, account: ReceiptAccount): Promise<Ishod<{
    proposalId: string; status: 'WITHDRAWN'; idempotentReplay: boolean; authoritative: true;
  }>> {
    const owner = changeAccount(account);
    if (!owner || !uuid(proposalId)) return Promise.resolve(failure('AGREEMENT_CHANGE_INVALID', 'Predlog nije dostupan.'));
    return readOwnedResult({ ...changeOptions, account: owner, write: true,
      request: () => changeResponse(supabase.rpc('rpc_withdraw_agreement_change', { p_proposal_id: proposalId })),
      decode: raw => {
        const row = record(raw);
        return row && exactKeys(row, ['proposalId', 'status', 'idempotentReplay', 'authoritative']) &&
          sameId(row.proposalId, proposalId) && row.status === 'WITHDRAWN' &&
          typeof row.idempotentReplay === 'boolean' && row.authoritative === true
          ? { proposalId: row.proposalId, status: 'WITHDRAWN', idempotentReplay: row.idempotentReplay, authoritative: true } : null;
      } });
  },

};

type AgreementCursor = { at: string; id: string };
/** The page envelope must explicitly finish or advance. An invalid continuation is
 * unavailable, never a successful partial list. Preserve PostgreSQL microseconds. */
function agreementPage(raw: unknown, cursor: AgreementCursor | null, seen: Set<string>) {
  const invalid = (): never => { throw new Error('AGREEMENT_LIST_INVALID_PROJECTION'); };
  const data = record(raw);
  if (!data || !Array.isArray(data.items) || typeof data.hasMore !== 'boolean'
      || data.items.length > 100 || (data.hasMore && data.items.length === 0)) return invalid();
  const items: Record<string, unknown>[] = [];
  let previous = cursor ? { instant: calendarInstant(cursor.at)!, id: cursor.id.toLowerCase() } : null;
  let last: AgreementCursor | null = null;
  for (const item of data.items) {
    const row = record(item);
    if (!row || typeof row.id !== 'string' || !row.id.trim() || seen.has(row.id.toLowerCase())) return invalid();
    // A single terminal page also supports the existing workspace projection.
    // As soon as a page is traversed, every row must obey its keyset contract.
    if (data.hasMore || cursor) {
      const instant = calendarInstant(row.sortAt);
      if (!uuid(row.id) || typeof row.sortAt !== 'string' || instant === null) return invalid();
      const id = row.id.toLowerCase();
      if (previous && (instant > previous.instant || (instant === previous.instant && id >= previous.id))) return invalid();
      previous = { instant, id }; last = { at: row.sortAt, id: row.id };
    }
    seen.add(row.id.toLowerCase()); items.push(row);
  }
  return { items, hasMore: data.hasMore, next: last };
}

/** Canonical production client boundary; backend authority remains in Agreement RPCs. */
export const agreementClientService: AgreementService = {
  /**
   * PKG-023a. The paged reader answers what the unpaged one could not: the start instant of the work
   * and whether a change proposal is waiting for an answer. The pages are a keyset on the Agreement's
   * own created_at, which nothing rewrites, so the walk cannot repeat or hide a row; twenty pages is a
   * refusal, never a silent truncation.
   */
  async mojiDogovori(options) {
    const signal = options?.signal;
    const checkAbort = () => { if (signal?.aborted) throw new Error('AGREEMENT_LIST_ABORTED'); };
    checkAbort();
    const session = sesijaSada();
    const owner = { accountId: session.user?.id ?? '', accountRevision: session.accountRevision };
    const uid = await userId();
    checkAbort();
    if (uid !== owner.accountId || !ratingReadOwnerCurrent(owner)) throw new Error('AUTH_ACCOUNT_CHANGED');
    const rows: any[] = [];
    let cursor: AgreementCursor | null = null;
    const seen = new Set<string>();
    for (let page = 0; ; page++) {
      checkAbort();
      if (page >= 20) throw new Error('AGREEMENT_LIST_TOO_MANY_PAGES');
      const request = supabase.rpc('rpc_list_my_agreements_page', {
        p_scope: 'ALL', p_limit: 100, p_before_at: cursor?.at ?? null, p_before_id: cursor?.id ?? null,
      });
      const { data, error } = await (signal ? request.abortSignal(signal) : request);
      checkAbort();
      if (!ratingReadOwnerCurrent(owner)) throw new Error('AUTH_ACCOUNT_CHANGED');
      if (error) throw new Error('AGREEMENT_LIST_FAILED');
      const result = agreementPage(data, cursor, seen);
      rows.push(...result.items);
      if (!result.hasMore) break;
      cursor = result.next;
    }
    const agreements = rows.map((row) => mapAgreement(row, uid));
    // Calendar and support use Agreement facts, not rating actions. An omitted read is unknown, never NOT_DUE.
    if (options?.includeRatings === false) return agreements.map(row => row.stanje === 'COMPLETED'
      ? { ...row, ocenaMoguca: false, stanjeProvereOcene: 'UNAVAILABLE' as const } : row);
    // EX-04 S3 (RC-03). A server that says, in the page itself, whether MY rating of a finished Dogovor is still due (`ratingDue`, the same answer as
    // rpc_get_my_agreement_review's `eligible`) makes the per-row review reads unnecessary: no request per finished Dogovor, nothing for a stalled read to
    // withhold. All or none: one finished Dogovor without the fact means an older server, and then every row is asked the old way, never a mixture.
    const finished = agreements.map((row, index) => ({ row, raw: rows[index] as { ratingDue?: unknown } })).filter(entry => entry.row.stanje === 'COMPLETED');
    if (finished.every(entry => typeof entry.raw.ratingDue === 'boolean')) {
      if (!ratingReadOwnerCurrent(owner)) throw new Error('AUTH_ACCOUNT_CHANGED');
      const due = new Map(finished.map(entry => [entry.row.id, entry.raw.ratingDue === true]));
      return agreements.map(row => row.stanje === 'COMPLETED'
        ? { ...row, ocenaMoguca: due.get(row.id) === true, stanjeProvereOcene: due.get(row.id) === true ? 'DUE' as const : 'NOT_DUE' as const } : row);
    }
    return withAgreementRatings(agreements, owner);
  },

  async dogovor(id) {
    const uid = await userId();
    const { data, error } = await supabase.rpc('rpc_get_agreement_workspace', {
      p_agreement_id: id,
    });
    if (error) throw new Error('AGREEMENT_READ_FAILED');
    if (!data) return null;
    return mapAgreement(data, uid);
  },

  async posaljiPoruku(_dogovorId, telo) {
    if (!telo.trim()) return { ok: false, kod: 'MESSAGE_REQUIRED', poruka: 'Unesi poruku.' };
    return { ok: false, kod: 'MESSAGE_RETRY_KEY_REQUIRED',
      poruka: 'Otvori Poruke u Dogovoru i pošalji poruku iz tog prikaza.' };
  },

  async predloziIzmenu(k: IzmenaKomanda) {
    const patch = changePatch(k);

    if (!Object.keys(patch).length) {
      return { ok: false, kod: 'CHANGE_PATCH_REQUIRED', poruka: 'Izmeni bar jedno polje Dogovora.' };
    }

    const { data, error } = await proposeChange(k, patch);
    if (error || !data) return fail(error, 'CHANGE_PROPOSAL_FAILED', 'Predlog izmene nije sačuvan.');
    return { ok: true, podatak: { predlogId: data } };
  },

  async odgovoriNaIzmenu(predlogId, prihvatam) {
    const { error } = await respondChange(predlogId, prihvatam);
    if (error) return fail(error, 'CHANGE_RESPONSE_FAILED', 'Odgovor na izmenu nije sačuvan.');
    return { ok: true, podatak: null };
  },

  async prijaviProblem(dogovorId, opis) {
    const result = await agreementProblemService.submit(dogovorId, opis);
    return result.ok ? { ok: true, podatak: null } : result;
  },

  async oznaciZavrsetak(dogovorId) {
    const { data, error } = await supabase.rpc('rpc_mark_work_done', {
      p_agreement_id: dogovorId,
    });
    // PKG-007: the pending-change and completion guards are known denials with their own copy.
    if (error || !data) return completionFailure(error) ?? fail(error, 'COMPLETION_FAILED', 'Završetak nije mogao da se označi.');
    return { ok: true, podatak: { rokPotvrdeIso: data } };
  },

  /** PKG-007 / GAP-0033: sole production owner of the requester confirmation. The
   * server's structured terminal receipt (original or already-completed replay) is
   * required; the screen still confirms only by reading COMPLETED back. */
  async potvrdiZavrsetak(dogovorId) {
    if (!uuid(dogovorId)) return failure('COMPLETION_COMMAND_INVALID', 'Dogovor nije dostupan. Ponovo ga otvori.');
    return readOwnedResult({ write: true, errors: completionErrors, fallback: 'COMPLETION_UNCONFIRMED', invalid: 'COMPLETION_RECEIPT_INVALID',
      request: () => supabase.rpc('rpc_confirm_completion', { p_agreement_id: dogovorId }),
      decode: raw => decodeCompletionReceipt(raw, dogovorId) });
  },
};
