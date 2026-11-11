import { memo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import type { MojaPrijavaProjekcija, StanjeMojePrijave } from '../../contracts/projections';
import { readableTitle } from '../../data/needDetailPresentation';
import { applicationPriceBasisText } from '../../lib/novac';
import { layout } from '../system/layout';
import { osoba } from '../system/plural';
import { STATUS_CHIPS, type StatusKey } from '../system/StatusChip';
import { Surface } from '../system/Surface';
import { useLayoutClass } from '../system/textScale';
import { sys } from '../system/tokens';
import { usePressLift } from '../system/usePressLift';
import { Press } from '../Press';
import { T } from '../Text';
import { RecordFoot, recordBody, recordFlush, type RecordFootTone } from './offer/RecordParts';
import { PrijavaCard, prijavaSpoken, type PrijavaModel, type PrijavaPrice, type PrijavaStatus } from './PrijavaCard';

/**
 * MY application in a list (owner's step 5c, 2026-09-24; one object for both people since 2026-10-07, plan 2.12; one `Surface record`
 * since 2026-10-08, composition spec 4.7). The content is the shared `PrijavaCard` (the state as the app's one `StatusChip`, the TASK's
 * title, then the term, the offer and the people on one line, and my message); this file is the worker's side of it:
 *
 *   - what each state of the read is called (the owner's five words: Poslata, Viđena, Izabrana, Nije izabrana, Povučena);
 *   - the interactive shell: the body opens the task, a long note has a separate read-only control to open its complete text,
 *     and the foot holds at most ONE action, the one this state allows, as a quiet row link under a line (never a button inside the card,
 *     and never green for a withdrawal): Izabrana → "Otvori Dogovor", an open one the server lets me withdraw → "Povuci prijavu" (a
 *     quiet ink link; the danger colour is kept for the question it opens), a changed task → "Pregledaj izmene zadatka" (the one
 *     orange dot of the card); nothing for a state that is over.
 *
 * The body opens the task the application belongs to, as it always did. The foot is its own press, a sibling of the body. The frame
 * gives under the finger as ONE object (`usePressLift`, the row rung), and nothing moves under reduced motion.
 *
 * Two of the read's states say more than the five words do, and the card says it in a line beside the chip rather than in a sixth word:
 * STALE_REVIEW_REQUIRED is still the application that was SENT, but the task changed under it ("Zadatak je izmenjen").
 * CLOSED also includes a previously selected, now cancelled Agreement. It says "Zatvorena" without claiming
 * the person was never chosen or that the task stopped looking for a replacement.
 */

/* ------------------------------------------------------------------------------------------------ what it says */

const STATUS: Record<StanjeMojePrijave, PrijavaStatus> = {
  SUBMITTED: 'application.sent',
  VIEWED: 'application.seen',
  // The owner's five states have no "u užem izboru". A shortlisted application is one the requester has acted on, so it has been seen.
  SHORTLISTED: 'application.seen',
  // The task changed under it: it is still the application that was sent. What is new is the line beside the chip and the foot.
  STALE_REVIEW_REQUIRED: 'application.sent',
  SELECTED: 'application.selected',
  WITHDRAWN: 'application.withdrawn',
  CLOSED: 'application.closed',
};
/** The state of an application as the chip says it: its key and its word. */
export const applicationStatus = (state: StanjeMojePrijave): { key: StatusKey; text: string } => ({ key: STATUS[state], text: STATUS_CHIPS[STATUS[state]].word });
const REASON: Partial<Record<StanjeMojePrijave, NonNullable<PrijavaModel['reason']>>> = {
  STALE_REVIEW_REQUIRED: { text: 'Zadatak je izmenjen.', tone: 'warn' },
  CLOSED: { text: 'Prijava više nije u izboru.', tone: 'muted' },
};

/**
 * My offer keeps the unit saved on its own version. TOTAL covers the people in
 * this application; HOURLY is per person per hour. A legacy missing unit is unknown. An amount that is not a
 * positive number with its written form is not an amount, and the card says so in words ("Cena nije navedena").
 */
export type ApplicationValue = PrijavaPrice;
export function applicationValue(row: Pick<MojaPrijavaProjekcija, 'cena' | 'osnovaCene'>): ApplicationValue {
  const amount = row.cena?.prikaz?.trim();
  const number = row.cena?.iznos;
  if (!amount || typeof number !== 'number' || !Number.isFinite(number) || number <= 0) return { kind: 'unpriced' };
  return { kind: 'amount', amount, basis: applicationPriceBasisText(row.osnovaCene) };
}

/**
 * The shared card's model for MY application: nothing here that the read did not carry. `fresh` is the application I have just sent (the list was
 * opened from its receipt): its chip adds "upravo" to "Poslata", for as long as the list is looked at in that visit (the approved draft U8).
 */
export function workerPrijava(row: MojaPrijavaProjekcija, fresh = false): PrijavaModel {
  const note = row.napomena?.trim();
  const calendarReason: PrijavaModel['reason'] = row.terminZauzet && ['SUBMITTED', 'VIEWED', 'SHORTLISTED'].includes(row.stanje)
    ? { text: 'Termin zauzet · imaš drugi Dogovor u ovo vreme. Prijava ostaje sačuvana.', tone: 'warn' } : null;
  const priceReason: PrijavaModel['reason'] = row.osnovicaZaProveru
    ? { text: 'Proverite cenu i način obračuna prijave.', tone: 'warn' } : null;
  return { status: STATUS[row.stanje], reason: calendarReason ?? priceReason ?? REASON[row.stanje] ?? null, who: { kind: 'task', title: readableTitle(row.naslov) },
    term: row.vremeTekst, price: applicationValue(row), people: osoba(row.pokrivaMesta), message: note ? `„${note}“` : null,
    quiet: row.stanje === 'WITHDRAWN' || row.stanje === 'CLOSED', ...(fresh ? { detail: 'upravo' } : {}) };
}

/** The one action the foot holds, from the state alone. `null`: the state allows none, or it is already open. */
export type ApplicationFootAction = 'agreement' | 'withdraw' | 'review';
export function applicationFoot(row: Pick<MojaPrijavaProjekcija, 'stanje' | 'dogovorId' | 'mozePovuci'>, expanded = false): ApplicationFootAction | null {
  // The review of the changed task is the one step of a stale application; while it is open under the card, it has its
  // own close and its own decisions, so the foot is not drawn twice.
  if (row.stanje === 'STALE_REVIEW_REQUIRED') return expanded ? null : 'review';
  if (row.stanje === 'SELECTED') return row.dogovorId ? 'agreement' : null;
  // The server's own flag, the one the screen's withdrawal guard reads; it is only ever set on an open application.
  return row.mozePovuci ? 'withdraw' : null;
}
const FOOT: Record<ApplicationFootAction, { label: string; spoken: string; tone: RecordFootTone; caret: 'right' | 'down' | 'none'; hint?: string }> = {
  agreement: { label: 'Otvori Dogovor', spoken: 'Otvori Dogovor', tone: 'green', caret: 'right' },
  // Withdrawing is rare ("retko"): a quiet ink link on every open card, and the danger colour only in the question it
  // opens (review r4 item 7).
  withdraw: { label: 'Povuci prijavu', spoken: 'Povuci prijavu', tone: 'ink', caret: 'none', hint: 'Pre povlačenja tražimo da potvrdite.' },
  // The spoken name starts with the visible words, so voice control and a screen reader name it the same (WCAG 2.5.3).
  review: { label: 'Pregledajte uslove prijave', spoken: 'Pregledajte uslove prijave', tone: 'waiting', caret: 'down', hint: 'Otvara trenutne uslove ispod kartice.' },
};
/** What the foot says, and what a screen reader hears ("Povuci prijavu: <naslov>"), per action. */
export const applicationFootWords = (action: ApplicationFootAction) => FOOT[action];

/** Everything the body shows, as one sentence after its command name, in the order it is drawn. Empty parts are left out. */
export function applicationSpoken(row: MojaPrijavaProjekcija, fresh = false): string {
  // The message is my own words, said as such and without the quotation marks the card draws around them.
  return prijavaSpoken(workerPrijava(row, fresh), { message: row.napomena?.trim(), messageLabel: 'Vaša poruka' });
}

/* ------------------------------------------------------------------------------------------------ the parts */

/**
 * What a person reads to recognise the application. Data to pixels only, memoised on the row and the text size alone, so
 * the screen's fresh per-render handlers (which the card must keep: a handle captured under one account revision must not
 * act under the next) re-render the thin interactive shell and not this text. The message is the only place my words to the
 * requester can be read again, so it is in quotes; a long one is clamped and has its own read-only control (`noteCollapsed`).
 */
export const ApplicationSummary = memo(function ApplicationSummary({ row, large, noteCollapsed = false, disabled = false, fresh = false }: {
  row: MojaPrijavaProjekcija; large: boolean; noteCollapsed?: boolean; disabled?: boolean; fresh?: boolean }) {
  return <PrijavaCard model={workerPrijava(row, fresh)} large={large} noteLines={noteCollapsed ? 2 : 0} disabled={disabled} />;
});

/**
 * One application: a `Surface record`. The body is ONE press that opens the task; the foot, when the state allows an action, is its own
 * press under a line; `children` is what opens under the card (the review of a changed task, which brings its own line). The frame
 * gives under the finger as one object, as the task card's does, and nothing moves under reduced motion. The handlers are the screen's
 * own guarded commands, handed in fresh on every render on purpose.
 */
function ApplicationCardBase({ row, onTask, onAgreement, onWithdraw, onReview, expanded = false, disabled = false, large: forced, fresh = false, children }: {
  row: MojaPrijavaProjekcija; onTask: () => void; onAgreement: () => void; onWithdraw: () => void; onReview: () => void;
  /** The application I have just sent: its chip says so ("Poslata · upravo"). */ fresh?: boolean;
  /** The review of the changed task is open under this card. */ expanded?: boolean;
  /** A command is in flight or waits for its readback: nothing on the card can be pressed. */ disabled?: boolean;
  /** The internal gallery shows the large-text layout without changing the phone's setting. */ large?: boolean;
  children?: ReactNode;
}) {
  // The same rule as the task card: stacked only for a window under 340 dp or text scale 1.3 and up (`useLayoutClass`).
  const stacked = useLayoutClass().stacked;
  const large = forced ?? stacked;
  const title = readableTitle(row.naslov);
  const action = applicationFoot(row, expanded);
  const foot = action ? FOOT[action] : null;
  const onFoot = action === 'agreement' ? onAgreement : action === 'withdraw' ? onWithdraw : onReview;

  const note = row.napomena?.trim() ?? '';
  // A conservative text rule, not measured line count: short notes are never clipped. Every clipped note has a control.
  const longNote = note.length > 80 || /[\r\n]/.test(note);
  const noteIdentity = [row.prijavaId, row.potrebaId, row.potrebaRevizija, row.prijavaRevizija, row.prijavaVerzija, row.stanje].join(':');
  const noteScope = useRef({ identity: noteIdentity, note, disabled });
  if (noteScope.current.identity !== noteIdentity || noteScope.current.note !== note) {
    noteScope.current = { identity: noteIdentity, note, disabled };
  }
  const noteOwner = noteScope.current;
  noteOwner.disabled = disabled;
  const [openNote, setOpenNote] = useState<typeof noteOwner | null>(null);
  const noteExpanded = openNote === noteOwner;
  const toggleNote = () => {
    // Retired callbacks cannot reopen a replacement row, including identity A -> B -> A.
    if (noteScope.current !== noteOwner || noteOwner.disabled) return;
    setOpenNote(current => current === noteOwner ? null : noteOwner);
  };
  const noteLabel = noteExpanded ? 'Prikaži manje' : 'Prikaži celu poruku';

  const lift = usePressLift();

  return <Animated.View style={lift.style}>
    <Surface kind="record" style={recordFlush}>
      <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak: ${title}`} accessibilityValue={{ text: applicationSpoken(row, fresh) }}
        accessibilityState={{ disabled }} disabled={disabled} onPress={onTask} onPressIn={lift.give} onPressOut={lift.settle} haptic="select" scaleTo={1}
        style={recordBody}>
        <ApplicationSummary row={row} large={large} disabled={disabled} noteCollapsed={longNote && !noteExpanded} fresh={fresh} />
      </Press>
      {/* A read-only sibling, never a nested press inside the task destination or the application command. */}
      {longNote ? <Press accessibilityRole="button" accessibilityLabel={noteLabel}
        accessibilityHint={`Poruka uz prijavu: ${title}`} accessibilityState={{ expanded: noteExpanded, disabled }}
        disabled={disabled} onPress={toggleNote} haptic="select" scaleTo={1} hitSlop={0} style={s.noteToggle}>
        <T variant="note" tone={disabled ? 'muted' : 'ink'}>{noteLabel}</T>
      </Press> : null}
      {/* No hit slop: the line is the border between reading controls and the application command. */}
      {foot ? <RecordFoot label={foot.label} tone={foot.tone} caret={foot.caret} disabled={disabled} accessibilityLabel={`${foot.spoken}: ${title}`}
        accessibilityHint={foot.hint} onPress={onFoot} onPressIn={lift.give} onPressOut={lift.settle} /> : null}
      {children}
    </Surface>
  </Animated.View>;
}
export const ApplicationCard = memo(ApplicationCardBase);

const s = StyleSheet.create({
  // Read-only, under the message it opens: its 48 dp reach starts at the end of the message (the body's own 16 under it are lent), and
  // the words stand at the card's text edge.
  noteToggle: { minHeight: layout.touch, justifyContent: 'center', paddingHorizontal: layout.card, marginTop: -sys.space.base },
});
