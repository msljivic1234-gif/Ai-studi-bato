import { Fragment } from 'react';
import { StyleSheet, View } from 'react-native';
import { starost } from '../../lib/starost';
import { T } from '../Text';
import { Press } from '../Press';
import { V2Action } from '../v2/V2Action';
import { Glyph } from '../system/Glyph';
import { FactArt } from '../system/FactArt';
import { ruleWidth } from '../system/layout';
import { sys } from '../system/tokens';
import { qaCountLine, waitingWords, type QaInlineItem, type QaInlineReady, type TaskQaInlineState } from './taskQaInlineModel';

export type TaskQaInlineProps = {
  state: TaskQaInlineState;
  /** Reads the questions again after a failed read. */
  onRetry: () => void;
  /** A stranger who may ask opens the whole thread, where the question is written. */
  onAsk: () => void;
  /** The owner opens the whole thread to answer one waiting question. */
  onAnswer: (questionId: string) => void;
  /** The whole thread: every question, the ones of earlier versions, the answers in full. */
  onOpenAll: () => void;
  /** The screen is on its way somewhere else, or reading again: nothing here is pressable. */
  disabled?: boolean;
  /** "Now" for the ages; fixed only by tests. */
  now?: Date;
};

const shorten = (text: string, limit = 80) => { const chars = Array.from(text.trim().replace(/\s+/g, ' ')); return chars.length > limit ? `${chars.slice(0, limit).join('')}…` : chars.join(''); };
/** The dot between the parts of a line is for the eye; a screen reader pauses at a comma instead of reading the dot. */
const spoken = (line: string) => line.split(' · ').join(', ');

/**
 * The questions of one task and the owner's answers, where the task is read (owner, 2026-10-07: they were a link to another
 * screen, and nobody who read the task saw what had been asked). A stranger sees the answered questions, the owner sees
 * the ones that wait for him first and the answered after them. Quiet rows on the page, no card in a card, parted by a short
 * line of 1 dp (the one divider, composition spec 2026-10-07): the question, and under it the answer behind the green rule
 * the whole thread uses, with who answered and how long ago.
 *
 * Presentation only. The reader above owns the two reads, the account and the version of the task; asking and answering
 * stay in the whole thread, which this opens by the same route as before. A read that failed says so and offers the read
 * again: it never looks like a task nobody asked about. Questions are anonymous: no asker is shown, because none is known.
 */
export function TaskQaInline({ state, onRetry, onAsk, onAnswer, onOpenAll, disabled = false, now }: TaskQaInlineProps) {
  if (state.phase === 'idle') return null;
  return <View testID="task-qa-inline" style={s.section}>
    <View style={s.head}>
      <T accessibilityRole="header" variant="heading" style={s.title}>Pitanja i odgovori</T>
      {state.phase === 'ready' && state.waiting > 0 ? <WaitingChip label={waitingWords(state.waiting)} testID="task-qa-waiting" /> : null}
    </View>
    {state.phase === 'loading' ? <View style={s.loading} accessibilityLiveRegion="polite">
      <FactArt kind="chat" size={24} />
      <T variant="meta" tone="muted">Učitavamo pitanja…</T>
    </View>
      : state.phase === 'error' ? <View style={s.trouble}>
        <T variant="copy" tone="muted" accessibilityRole="alert">{state.message}</T>
        <V2Action label="Učitaj pitanja ponovo" kind="quiet" compact disabled={disabled} onPress={onRetry} style={s.link} />
      </View>
        : <Thread ready={state} disabled={disabled} now={now} onAsk={onAsk} onAnswer={onAnswer} onOpenAll={onOpenAll} />}
  </View>;
}

function Thread({ ready, disabled, now, onAsk, onAnswer, onOpenAll }: Pick<TaskQaInlineProps, 'onAsk' | 'onAnswer' | 'onOpenAll' | 'disabled' | 'now'> & { ready: QaInlineReady }) {
  const count = qaCountLine(ready.listed, ready.answered);
  return <>
    {count ? <T variant="note" tone="muted" accessibilityLabel={spoken(count)}>{count}</T> : null}
    {ready.shown.length ? <View>{ready.shown.map((item, index) => <Fragment key={item.questionId}>
      {index ? <View testID="task-qa-rule" pointerEvents="none" style={s.rule} /> : null}
      <Row item={item} viewer={ready.viewer} canAnswer={ready.canAnswer} disabled={disabled} now={now} onAnswer={onAnswer} />
    </Fragment>)}</View>
      // A thread kept out because the task changed must not read as a task nobody asked about.
      : <View style={s.emptyRow}>
        <FactArt kind="chat" size={28} />
        <T variant="copy" tone="muted" style={s.emptyCopy}>
          {ready.olderVersion
            ? 'Zadatak je izmenjen. Ranija pitanja pripadaju starijoj verziji.'
            : ready.viewer === 'PUBLIC'
              ? 'Još nema javnih pitanja o zadatku. Ako Vam nešto nije jasno, postavite pitanje ispod.'
              : 'Još nema javnih pitanja o zadatku. Kada neko postavi pitanje, ovde ćete moći da odgovorite.'}
        </T>
      </View>}
    {ready.shown.length && ready.olderVersion ? <T variant="note" tone="muted">Neka ranija pitanja pripadaju starijoj verziji zadatka.</T> : null}
    {ready.all > ready.shown.length ? <Press accessibilityRole="button" accessibilityLabel={`Prikaži sva pitanja (${ready.all})`}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onOpenAll} haptic="select" scaleTo={sys.motion.scale.row} style={s.more}>
      <T variant="bodyStrong" style={s.moreText}>{`Prikaži sva pitanja (${ready.all})`}</T>
      <Glyph name="caret-right" size={16} tone="green" />
    </Press> : null}
    {ready.canAsk ? <V2Action label="Postavi pitanje" kind="secondary" tone="neutral" disabled={disabled} onPress={onAsk} style={s.link} /> : null}
  </>;
}

/** One question: its words, and under them the answer with who gave it and when, or the sign that it waits. */
function Row({ item, viewer, canAnswer, disabled, now, onAnswer }: {
  item: QaInlineItem; viewer: QaInlineReady['viewer']; canAnswer: boolean; disabled?: boolean; now?: Date; onAnswer: (questionId: string) => void;
}) {
  if (typeof item.answer === 'string') {
    // Who answered: to the owner it is his own answer. Only the stranger's read says when; the owner's read does not.
    // "Upravo" is a sentence's first word elsewhere; in the middle of this line it is not capitalised.
    const age = item.answeredAt ? starost(item.answeredAt, { sada: now }) : null;
    const by = [viewer === 'OWNER' ? 'Tvoj odgovor' : 'Odgovor osobe koja je objavila zadatak', age === 'Upravo' ? 'upravo' : age, item.edited ? 'izmenjeno' : null]
      .filter(Boolean).join(' · ');
    return <View style={s.item}>
      <T variant="bodyStrong">{item.question}</T>
      <View style={s.answer}>
        <T variant="meta" tone="muted" accessibilityLabel={spoken(by)}>{by}</T>
        <T>{item.answer}</T>
      </View>
      {viewer === 'OWNER' && canAnswer ? <V2Action label="Izmeni odgovor" accessibilityLabel={`Izmeni odgovor na pitanje: ${shorten(item.question)}`}
        kind="secondary" tone="neutral" compact disabled={disabled} onPress={() => onAnswer(item.questionId)} style={s.link} /> : null}
    </View>;
  }
  const asked = item.askedAt ? starost(item.askedAt, { sada: now }) : null;
  return <View style={s.item}>
    <T variant="bodyStrong">{item.question}</T>
    <View style={s.waiting}>
      <WaitingChip label="Čeka odgovor" />
      {asked ? <T variant="meta" tone="muted">{asked === 'Upravo' ? 'Upravo postavljeno' : `Postavljeno ${asked}`}</T> : null}
    </View>
    {canAnswer ? <V2Action label="Odgovori" accessibilityLabel={`Odgovori na pitanje: ${shorten(item.question)}`} kind="secondary" tone="neutral" compact
      disabled={disabled} onPress={() => onAnswer(item.questionId)} style={s.link} /> : null}
  </View>;
}

/**
 * "Čeka odgovor": a word and a shape (an open ring), never the colour alone. Attention orange, because it waits for the
 * owner. The same tokens as the one state chip of the design system, so the two read as one family.
 */
function WaitingChip({ label, testID = 'task-qa-chip' }: { label: string; testID?: string }) {
  return <View testID={testID} accessible accessibilityRole="text" accessibilityLabel={label} style={s.chip}>
    <View style={s.ring} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" />
    <T variant="label" style={s.chipWord}>{label}</T>
  </View>;
}

const s = StyleSheet.create({
  section: { gap: sys.space.md },
  head: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.md, rowGap: sys.space.xs },
  title: { color: sys.color.ink },
  loading: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingVertical: sys.space.sm },
  emptyRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md, paddingVertical: sys.space.xs },
  emptyCopy: { flex: 1, minWidth: 0 },
  trouble: { gap: sys.space.xs, alignItems: 'flex-start' },
  // A question is a bare item on the page, parted from the next by a line of 1 dp (`rule`): the thread is one list, not a stack of cards.
  item: { gap: sys.space.sm, paddingVertical: sys.space.md },
  rule: { height: ruleWidth, backgroundColor: sys.color.line },
  // The answer stands behind the green rule, as in the whole thread, so the two voices differ at a glance.
  answer: { gap: sys.space.xs, paddingLeft: sys.space.md, borderLeftWidth: 3, borderLeftColor: sys.color.green },
  waiting: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: sys.space.sm, rowGap: sys.space.xs },
  // A button sized to its words, at the left edge of the text it belongs to.
  link: { alignSelf: 'flex-start' },
  more: { alignSelf: 'flex-start', minHeight: sys.touch.min, flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  moreText: { color: sys.color.green },
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingVertical: sys.space.xs,
    paddingLeft: sys.space.sm, paddingRight: sys.space.md, borderRadius: sys.radius.pill, backgroundColor: sys.color.orangeSoft },
  ring: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.6, borderColor: sys.color.orangeInk },
  // `label` tracks wide for capitals; these words are not capitals.
  chipWord: { color: sys.color.waitingInk, letterSpacing: 0 },
});
