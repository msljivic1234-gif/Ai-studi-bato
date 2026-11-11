import { useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { vreme } from '../../lib/vreme';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { Glyph } from '../system/Glyph';
import { layout } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Section } from '../system/Section';
import { InfoButton } from '../system/InfoButton';
import { Screen } from '../system/Screen';
import { StateView } from '../system/StateView';
import { Surface } from '../system/Surface';
import { field, sys } from '../system/tokens';
import { ProductHeader } from '../product/ProductDetails';
import { QuietReadState } from '../v2/QuietReadState';
import { V2Action } from '../v2/V2Action';
import { NextStepCard, type AgreementInfo, type AgreementStep } from './AgreementWorkspace';
import { AgreementSteps } from './AgreementSteps';

/**
 * The pieces of a Dogovor's overview that the route and its gallery draw the same way (composition spec 4.9, template T3): the head with
 * the work's name and where the Dogovor stands, the note for a Dogovor without a term (R02), the rows that lead elsewhere, the actions
 * (J15: what can be done is SEEN on the page, never only behind a "···"), a reported problem and the three ways on after it (R04).
 * Presentation only: every press is the route's own command, behind its own guards, and nothing here reads or writes anything.
 */

/**
 * The scroll of the overview, in the grid of every screen: 20 from the edge, 8 under the bar, 24 between one part and the next, and 24
 * under the last one before the foot. (`Screen` is the frame of every static screen; the Dogovor needs the scroll's own handle, to take a
 * person to the section a menu entry names, so it keeps the same measures here until `Screen` hands its scroll out.)
 */
export const overviewContent = { paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, paddingBottom: layout.section, gap: layout.section } as const;

/**
 * The head: my role, the work's own name, this bilateral agreement's accepted seat coverage when relevant, then where it stands —
 * the dot, the state, the next step — and the four steps of its way. When the next step waits for me, it is one tinted note.
 * `steps` is the step bar's own props, so the same state is read in one place (`agreementStepModel`).
 */
export function AgreementHead({ title, roleLabel, coverageLine, step, steps, info, children, showTitle = true }: {
  /** The work's title, readable ("Prenos ormana do kombija"). */
  title: string; roleLabel?: string; coverageLine?: string; step: AgreementStep; steps: ComponentProps<typeof AgreementSteps>;
  /** A group overview already names the task above its roster; its private state must not repeat that title. */
  showTitle?: boolean;
  /** How the Dogovor goes, behind an "ⓘ" at the end of the state's line: the screen says one sentence, the rest is one tap away. */
  info?: AgreementInfo | null;
  /** What a waiting step is about: the lines of a proposal, the way to read permissions again. Inside the step. */
  children?: ReactNode;
}) {
  // Only an authoritatively completed collaboration with my saved rating has no
  // next step left. A pending-change/recovery heading still takes precedence.
  const completedAndRated = steps.state === 'COMPLETED' && steps.ownRating === 'GIVEN' && step.status === 'task.completed';
  return <View style={s.head}>
    {roleLabel ? <T variant="meta" style={s.roleLabel}>{roleLabel}</T> : null}
    {showTitle ? <T accessibilityRole="header" variant="pageTitle" style={s.title}>{title}</T> : null}
    {coverageLine ? <T testID="agreement-individual-coverage" variant="note" tone="muted">{coverageLine}</T> : null}
    <NextStepCard tone={step.tone} status={step.status} title={completedAndRated ? 'Završen · ocena sačuvana' : step.title}
      body={completedAndRated ? null : step.body} aside={info ? <InfoButton title={info.title} lines={info.lines} /> : undefined}>{children}</NextStepCard>
    {!completedAndRated ? <View style={s.steps}><AgreementSteps {...steps} /></View> : null}
  </View>;
}

/**
 * A Dogovor with no term yet (idea R02): the one thing the two of them still have to do, said where the person reads what comes next.
 * One tinted note, never a card of its own: what is missing, and "Predloži termin" under it in the system's green words - the way to the
 * existing change of the terms, opened on the term. No sentence between the two (phone, 2026-10-08: the title and the button say it).
 * It stands until a proposal for the term is accepted.
 */
export function AgreementTermNote({ onPropose, disabled = false }: { onPropose: () => void; disabled?: boolean }) {
  return <Surface kind="note" tone="warn" testID="agreement-term-note" style={s.termNote}>
    <T accessibilityRole="header" variant="bodyStrong" style={s.title}>Termin još nije dogovoren</T>
    <Press accessibilityRole="button" accessibilityLabel="Predloži termin" accessibilityState={{ disabled }} disabled={disabled} haptic="select"
      onPress={onPropose} style={s.termAction}>
      <T variant="copy" tone="green" style={s.actionWord}>Predloži termin</T>
    </Press>
  </Surface>;
}

/** What one row of the links is: its press, and whether the screen is working (then it is grey and cannot be pressed). */
type LinkRow = { onPress: () => void; disabled?: boolean };

/**
 * The few things that lead elsewhere from a Dogovor, as ONE group of the one row: the source task, my application (the worker's) and the
 * Dogovor's history. A row that leads somewhere has the arrow, and a row says what it is and nothing else (J3, J4). Each row's spoken label
 * is the one it always had.
 */
export function AgreementLinks({ task, application, history }: {
  /** "Otvori zadatak": only when the source task is known and the person may open it. The row says the title of the work and its coarse area (never the private address) to a screen reader only: the page already shows both. */
  task?: LinkRow & { title: string; place: string };
  /** "Tvoja prijava": the worker's own application. */
  application?: LinkRow;
  /** "Tok Dogovora": the saved events. */
  history?: readonly { vremeTekst: string; tekst: string }[];
}) {
  const events = history?.length ? history : null;
  const rows: ((last: boolean) => ReactNode)[] = [];
  if (task) rows.push(last => <ListRow key="task" leading={<FactArt kind="tasks" size={32} />} title="Otvori zadatak" last={last}
    accessibilityLabel={`Otvori zadatak: ${task.title}. ${task.place}`} accessibilityHint="Otvara detalje zadatka iz kog je nastao ovaj Dogovor."
    disabled={task.disabled} onPress={task.onPress} />);
  if (application) rows.push(last => <ListRow key="application" leading={<FactArt kind="applications" size={32} />} title="Vaša prijava" last={last}
    accessibilityLabel="Vaša prijava" disabled={application.disabled} onPress={application.onPress} />);
  if (events) rows.push(() => <AgreementHistory key="history" events={events} />);
  if (!rows.length) return null;
  return <View>{rows.map((row, index) => row(index === rows.length - 1))}</View>;
}

/** "Tok Dogovora": a row of the one list that opens its events under itself, in the words and the order they were saved in. */
function AgreementHistory({ events }: { events: readonly { vremeTekst: string; tekst: string }[] }) {
  const [open, setOpen] = useState(false);
  return <View>
    <ListRow leading={<FactArt kind="clock" size={32} />} title="Tok Dogovora" accessibilityLabel="Tok Dogovora" last={!open}
      expanded={open} onPress={() => setOpen(current => !current)} />
    {open ? <View style={s.events}>
      {events.map((event, index) => <View key={index} style={s.event}>
        <View style={s.eventLine} /><View style={s.eventCopy}><T variant="body">{event.tekst}</T><T variant="meta" tone="muted">{event.vremeTekst}</T></View>
      </View>)}
    </View> : null}
  </View>;
}

/**
 * What can be DONE in a Dogovor, as rows of the page (J15, owner, 2026-10-08, "jedva se nađu"): "Izmeni uslove" and "Prijavi problem", each
 * with its picture, in ONE place and not again in a menu. A row is drawn only for a command the route gave, and every press is that command,
 * behind its own guards and confirmations. The ones that end something or report someone are `AgreementDangerActions`, apart and in red.
 */
export function AgreementActions({ change, problem }: {
  /** "Izmeni uslove": a proposal of a new price, scope or term. The other side has to accept it. */
  change?: LinkRow;
  /** "Prijavi problem": opens the form for it on the page. */
  problem?: LinkRow;
}) {
  if (!change && !problem) return null;
  return <View testID="agreement-actions">
    {change ? <ListRow leading={<Glyph name="edit" size={24} />} title="Izmeni uslove" last={!problem} accessibilityLabel="Izmeni uslove"
      accessibilityHint="Predlažeš novu cenu, obim ili termin. Druga strana mora da prihvati." disabled={change.disabled} onPress={change.onPress} /> : null}
    {problem ? <ListRow leading={<FactArt kind="alert" size={32} />} title="Prijavi problem" last accessibilityLabel="Prijavi problem"
      accessibilityHint="Zaustavlja automatski završetak, a druga strana vidi prijavu." disabled={problem.disabled} onPress={problem.onPress} /> : null}
  </View>;
}

/**
 * The two actions that end something or report someone: red words, a quiet picture, and a part of the page of their own (the screen's
 * 24 between it and the calm actions above). Each opens its own flow with its own confirmation - the reason and the review of a
 * cancellation, the safety screen - so each keeps its arrow.
 */
export function AgreementDangerActions({ cancel, safety }: {
  /** "Otkaži Dogovor": opens the cancelling with its reason. */
  cancel?: LinkRow;
  /** "Prijavi ili blokiraj osobu": blocking and the private report to support. */
  safety?: LinkRow;
}) {
  if (!cancel && !safety) return null;
  return <View testID="agreement-danger-actions">
    {cancel ? <ListRow leading={<Glyph name="cancel" size={24} tone="danger" />} tone="danger" arrow title="Otkaži Dogovor" last={!safety} accessibilityLabel="Otkaži Dogovor"
      accessibilityHint="Otkazivanje uz razlog. Pre slanja vidiš pregled." disabled={cancel.disabled} onPress={cancel.onPress} /> : null}
    {safety ? <ListRow leading={<FactArt kind="shield" size={32} muted />} tone="danger" arrow title="Prijavi ili blokiraj osobu" last
      accessibilityLabel="Prijavi ili blokiraj osobu" accessibilityHint="Blokiranje i poverljiva prijava podršci." disabled={safety.disabled} onPress={safety.onPress} /> : null}
  </View>;
}

/**
 * A problem that was reported, as the one tinted note it is (a problem is what waits for both): who reported it and when, the words that
 * were written, and one sentence - both sides read them, and a problem alone decides nobody's guilt or debt. What it changes in a Dogovor that
 * is still open - the automatic completion stops, the completion can still be confirmed, the words are kept in Poruke - is behind the "ⓘ" at the
 * end of its title (`active`), and the head of the Dogovor says the stop once. `keptFirst`: this screen holds a second description that was NOT
 * added (only the first one is stored).
 */
export function AgreementProblemNote({ mine, openedAt, narrative, active = false, keptFirst = false }: {
  mine: boolean; openedAt: string; narrative: string;
  /** The Dogovor is agreed or waiting for its confirmation. */
  active?: boolean; keptFirst?: boolean;
}) {
  return <Surface kind="note" tone="warn" testID="agreement-problem-note" style={s.problem}>
    <View style={s.noteHead}>
      <T accessibilityRole="header" variant="bodyStrong" style={[s.title, s.noteTitle]}>{mine ? 'Problem je prijavljen sa Vašeg naloga.' : 'Problem je prijavila druga strana.'}</T>
      {active ? <InfoButton title="Šta znači prijavljen problem" lines={PROBLEM_LINES} /> : null}
    </View>
    <T variant="note" tone="muted">{vreme(openedAt)}</T>
    <T variant="body" style={s.title}>{narrative}</T>
    <T variant="note" tone="muted">{keptFirst ? 'Sačuvan je prvi opis, a Vaš novi nije dodat. Za dopunu koristite Poruke.'
      : 'Opis vide oba učesnika, a problem sam po sebi ne određuje krivicu ili dug.'}</T>
  </Surface>;
}

/** What a reported problem changes while the Dogovor is open: said behind the "ⓘ" of the note, once and in short lines. */
const PROBLEM_LINES = ['Automatski završetak je zaustavljen.', 'Završetak se i dalje može potvrditi.', 'Opis je sačuvan u Porukama.'] as const;

/**
 * A problem is open but its details could not be shown: an older report that this view cannot read (`legacy`: nothing to do about it), or
 * a read that did not answer (then `onRefresh` reads it again). The problem itself is certain either way: the Dogovor says it is open.
 */
export function AgreementProblemUnknown({ legacy, onRefresh, disabled = false }: {
  legacy: boolean; onRefresh?: () => void; disabled?: boolean;
}) {
  return <Surface kind="note" tone="warn" testID="agreement-problem-note" style={s.problem}>
    <T accessibilityRole="header" variant="bodyStrong" style={s.title}>Problem je prijavljen</T>
    <T variant="note" tone="muted">{legacy ? 'Detalji ranije prijavljenog problema nisu dostupni. Problem ostaje sačuvan.' : 'Detalji prijave trenutno nisu učitani.'}</T>
    {onRefresh ? <V2Action label="Osvežite detalje prijave" kind="quiet" disabled={disabled} onPress={onRefresh} /> : null}
  </Surface>;
}

/**
 * The form to report a problem in this Dogovor, in place of the row that opened it. What is written is seen by the other side in
 * Poruke - this is not the private report to support - and once an attempt was made the text is kept as it was (`kept`): only an
 * explicit refresh may let a second one go, never a silent retry with other words.
 */
export function AgreementProblemForm({ value, onChange, editable, kept, busy, canSend, onSend, onCancel, disabled = false }: {
  value: string; onChange: (value: string) => void; editable: boolean;
  /** An attempt was made: the description stays as it was and cannot be changed or called off. */
  kept: boolean; busy: boolean; canSend: boolean; onSend: () => void; onCancel: () => void; disabled?: boolean;
}) {
  return <Section title="Problem u Dogovoru">
    <View style={s.form}>
      <T variant="note" tone="muted">Opis će videti druga strana u Porukama. Ovo nije poverljiva prijava podršci.</T>
      <TextInput accessibilityLabel="Opišite problem" value={value} onChangeText={onChange} multiline maxLength={4000} editable={editable}
        placeholder="Šta je ostalo nerešeno?" placeholderTextColor={sys.color.muted} style={s.input} />
      <V2Action label={busy ? 'Čuvamo prijavu…' : kept ? 'Pošaljite ponovo' : 'Pošaljite prijavu problema'} disabled={!canSend} onPress={onSend} />
      {!kept ? <V2Action label="Odustani od prijave problema" kind="quiet" disabled={disabled} onPress={onCancel} />
        : <T variant="note" tone="muted">Opis je sačuvan na ovom ekranu. Osvežite Dogovor pa ga pošaljite ponovo.</T>}
    </View>
  </Section>;
}

/**
 * The three ways on after a problem was reported (idea R04), so that a report is never a dead end: agree in Poruke; cancel the Dogovor
 * (with a reason and a review before sending); or report that the other side did not come, which opens support with this Dogovor
 * already chosen. Rows of the one list under their own title, each said by its title alone (what each does is spoken, J4); the cancelling is
 * the one that cannot be taken back, so its words are red. It is the ONLY place of "Otkaži Dogovor" while it stands (J1).
 */
export function AgreementProblemExits({ onMessages, onCancel, onNoShow, disabled = false }: {
  onMessages: () => void; onCancel?: () => void; onNoShow: () => void; disabled?: boolean;
}) {
  return <Section title="Šta dalje">
    <View>
      <ListRow leading={<FactArt kind="chat" size={32} />} title="Dogovorite se u Porukama" onPress={onMessages} disabled={disabled}
        accessibilityLabel="Dogovorite se u Porukama" accessibilityHint="Napišite šta je ostalo nerešeno." last={false} />
      {/* Red words are a command, but this one opens the cancelling with its reason, so it keeps the arrow of a way onward. */}
      {onCancel ? <ListRow leading={<Glyph name="cancel" size={24} tone="danger" />} tone="danger" arrow title="Otkaži Dogovor" onPress={onCancel} disabled={disabled}
        accessibilityLabel="Otkaži Dogovor" accessibilityHint="Otkazivanje uz razlog. Pre slanja vidite pregled." /> : null}
      <ListRow leading={<FactArt kind="shield" size={32} />} title="Prijavi nedolazak" onPress={onNoShow} disabled={disabled}
        accessibilityLabel="Prijavi nedolazak" accessibilityHint="Otvara podršku sa ovim Dogovorom." last />
    </View>
  </Section>;
}

/**
 * The Dogovor while it is being read, or when it could not be: the system's one state view in the frame of every opened screen
 * (template T7). Loading states only what is being checked; a failed read says what happened and has the one way forward;
 * a Dogovor the person has no access to has nothing to retry, so its way forward is back to the list.
 */
export function AgreementStatusView({ loading = false, error = false, retry, back }: { loading?: boolean; error?: boolean; retry?: () => void; back: () => void }) {
  return <Screen kind="detail" header={<ProductHeader title="Dogovor" back={back} />}>
    {loading ? <QuietReadState art="document" title="Učitavamo Dogovor…" body="Proveravamo pristup i važeće uslove." />
      : error ? <StateView kind="error" art="document" title="Dogovor nije učitan" body="Proverite internet vezu i pokušajte ponovo."
        primary={retry ? { label: 'Ponovo učitajte Dogovor', onPress: retry } : undefined} />
        : <StateView kind="error" art="document" title="Dogovor nije dostupan" body="Veza je zastarela ili nemate pristup ovom Dogovoru."
          primary={{ label: 'Nazad na Dogovore', onPress: back }} />}
  </Screen>;
}

const s = StyleSheet.create({
  // The title, the state and the steps: 12 apart, and the steps 16 under the state's words (the 12 and 4 more) so the bar stands apart from them.
  head: { gap: sys.space.md },
  steps: { marginTop: sys.space.xs },
  title: { color: sys.color.ink },
  roleLabel: { color: sys.color.green, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  termNote: { gap: sys.space.xs },
  termAction: { minHeight: layout.touch, justifyContent: 'center', alignSelf: 'flex-start' },
  actionWord: { fontWeight: '600' },
  problem: { gap: sys.space.sm },
  noteHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  noteTitle: { flexGrow: 1, flexShrink: 1 },
  form: { gap: sys.space.md },
  input: { ...field, minHeight: 100, textAlignVertical: 'top' },
  // The events open under their row, from where the row's words begin (the picture's slot and the gap after it).
  events: { paddingLeft: layout.slot + sys.space.md, paddingBottom: sys.space.md, gap: sys.space.md },
  event: { flexDirection: 'row', gap: sys.space.md },
  eventLine: { width: 2, borderRadius: sys.radius.pill, backgroundColor: sys.color.greenSoft, marginVertical: sys.space.xs },
  eventCopy: { flex: 1, gap: sys.space.xs },
});
