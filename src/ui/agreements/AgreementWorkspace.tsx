import { useEffect, useRef, useState, type ReactNode } from 'react';
import { AccessibilityInfo, Platform, ScrollView, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
import type { DogovorProjekcija } from '../../contracts/projections';
import { FlowFooter } from '../system/FlowFooter';
import { Surface } from '../system/Surface';
import { STATUS_CHIPS, STATUS_MARK, StatusMark, type StatusKey } from '../system/StatusChip';
import { brandAction, sys } from '../system/tokens';
import { useTextScale } from '../system/textScale';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

/**
 * Presentation pieces of the Agreement workspace, recomposed from zero (owner, 2026-09-23: the HTML prototypes document function, not
 * layout; composition spec 2026-10-07, 4.9). A Dogovor is read in one pass: where it stands and what comes next, the terms, the contact
 * and the place, then the few things that can be opened. Sections are parted by space and rows by their own inset lines; a tint is spent
 * only where something waits for a person (a proposal, a confirmation, a problem); nothing else is a box. No state lives here; the route
 * owns reads, writes, journals and guards.
 * This module must stay free of reanimated hooks and inbox reads (route tests isolate those), so it uses only Press/T/icons/V2Action.
 */

export type WorkspaceTone = 'green' | 'warn' | 'muted' | 'danger';
const toneColor: Record<WorkspaceTone, string> = { green: sys.color.green, warn: sys.color.warn, muted: sys.color.muted, danger: sys.color.danger };

export const stateTone = (state: DogovorProjekcija['stanje']): WorkspaceTone =>
  state === 'CANCELLED' || state === 'COMPLETED' ? 'muted' : state === 'AWAITING_REQUESTER' ? 'warn' : 'green';

type EndStatus = Extract<StatusKey, 'task.completed' | 'task.cancelled'>;
export type AgreementStep = { tone: WorkspaceTone; title: string; body: string | null; status?: EndStatus };

/**
 * Where the Dogovor stands and what comes next, as the one place that says its state (round-1 critique A13: the bar,
 * the step and the people rows used to say it two or three times). The title is the state, or what waits when something
 * does; the body is the next step. Pure words: the route decides what can be done, and nothing here enables an action.
 *
 * - `party`: I am one of the two sides (a Dogovor read for someone else says the state and nothing to do).
 * - `change`: a proposal waits; `mine` is null when its content could not be read.
 * - `deadline`: the server's confirmation window, already written, used only while the requester's answer is awaited.
 */
export function agreementNextStep({ state, party, worker, change, ownRating, problemOpen, deadline }: {
  state: DogovorProjekcija['stanje']; party: boolean; worker: boolean;
  change: { waits: boolean; mine: boolean | null };
  ownRating: 'DUE' | 'GIVEN' | 'CLOSED' | 'UNKNOWN' | 'NOT_APPLICABLE';
  problemOpen: boolean; deadline: string;
}): AgreementStep {
  if (change.waits) return { tone: 'warn',
    title: change.mine === true ? 'Vaš predlog izmene čeka odgovor' : change.mine === false ? CHANGE_WAITS_FOR_ME : 'Predlog izmene čeka odgovor',
    body: 'Završetak je moguć tek kada se predlog prihvati, odbije ili povuče.' };
  if (state === 'COMPLETED') return { tone: stateTone(state), status: 'task.completed', title: 'Dogovor je završen', body: !party ? null
    : ownRating === 'GIVEN' ? 'Hvala na saradnji. Vaša ocena je sačuvana.'
      : ownRating === 'CLOSED' ? 'Hvala na saradnji.' : 'Hvala na saradnji. Ocena pomaže drugima da izaberu.' };
  // One form of the words across the app ("Dogovor je otkazan", as the task's own notice says it): the full stop that stood here was the only one.
  if (state === 'CANCELLED') return { tone: 'muted', status: 'task.cancelled', title: 'Dogovor je otkazan', body: null };
  if (state === 'AWAITING_REQUESTER') return { tone: 'warn', title: worker ? 'Čeka se potvrda druge strane' : CONFIRM_WAITS_FOR_ME,
    body: problemOpen ? 'Prijavljen je problem — automatski završetak je zaustavljen.' : `${deadline}. Bez odgovora se Dogovor zatvara sam.` };
  // Confirmed: the state is the title and the next step its one sentence (phone, 2026-10-08: two sentences stood over the steps). The
  // worker is told which button ends the work; what the other side then does is said in the review that button opens. The one who asked
  // for the work is told nothing here: the foot says, in its own sentence, whose move it is ("Čeka da Marko javi da je zadatak gotov.").
  return { tone: 'green', title: 'Dogovoreno', body: !party || !worker ? null : 'Kada završite, dodirnite „Zadatak je gotov“.' };
}

/** The step's own words where the step is mine, shared by the step card and the head of Poruke. */
const CHANGE_WAITS_FOR_ME = 'Predlog izmene čeka Vaš odgovor';
const CONFIRM_WAITS_FOR_ME = 'Završetak je označen i čeka Vašu potvrdu';
/** A finished Dogovor while my rating is due, in the Dogovori list's words for it (owner, 2026-09-23). */
export const RATING_WAITS_FOR_ME = 'Čeka Vašu ocenu';

/**
 * What this Dogovor waits for from ME, if anything, in the step's order and words: a change the other side proposed (it
 * blocks both completions, so it comes first), then a completion the other side marked, which I as the requester
 * confirm, then my rating once the review read says it is due. A change I proposed, a completion the other side has to
 * confirm, or a rating the read could not answer for ("UNKNOWN" is no claim that it waits) gives null. The head of Poruke
 * says it (review r4 rd: the bar used to show the state there, and Poruke no longer said that the Dogovor waits for me).
 */
export function agreementWaitsForMe({ state, requester, change, ownRating }: {
  state: DogovorProjekcija['stanje']; requester: boolean;
  change: { waits: boolean; mine: boolean | null };
  ownRating: 'DUE' | 'GIVEN' | 'CLOSED' | 'UNKNOWN' | 'NOT_APPLICABLE';
}): string | null {
  if (change.waits) return change.mine === false ? CHANGE_WAITS_FOR_ME : null;
  if (state === 'AWAITING_REQUESTER') return requester ? CONFIRM_WAITS_FOR_ME : null;
  return state === 'COMPLETED' && ownRating === 'DUE' ? RATING_WAITS_FOR_ME : null;
}

/** An explanation that stands behind an "ⓘ" (`system/InfoButton`) instead of on the screen: the question it answers, and a few short lines. */
export type AgreementInfo = { title: string; lines: readonly string[] };

/**
 * How a Dogovor goes, for the "ⓘ" at its head (owner, 8 Oct 2026: too much text; the coordinator: "na ekranu jedna rečenica ili ništa, ostalo iza ⓘ").
 * The screen keeps one sentence about the next step; what follows it - the other side's answer, the term in which it is given, the rating - is
 * here, in the order it happens and in the words of the buttons. Said to each side from its own place: the one who does the work marks it done,
 * the one who asked for it confirms. No hours are named: the server's own deadline is on the screen while the confirmation is awaited.
 */
export function agreementStepsInfo({ worker }: { worker: boolean }): AgreementInfo {
  return { title: 'Kako ide Dogovor', lines: [
    worker ? 'Kad završite zadatak, dodirnite „Zadatak je gotov“.' : 'Osoba koja uskače javlja da je zadatak gotov.',
    worker ? 'Druga strana potvrđuje završetak ili prijavljuje problem.' : 'Vi potvrđujete završetak ili prijavljujete problem.',
    worker ? 'Ako nema odgovora u roku, Dogovor se zatvara sam.' : 'Ako ne odgovorite u roku, Dogovor se zatvara sam.',
    'Kad je završetak potvrđen, možete da ocenite saradnju.',
  ] };
}

/**
 * Where the Dogovor stands and what comes next, said once: a dot in the state's colour, the state, and the next step under it.
 * The eyebrow "Sledeći korak" is gone (owner, 2026-09-23: no copy explaining where you are). When the step waits for someone, the
 * whole of it is one tinted `note` (the sentence that has to stand out, never a card), with what the step is about (a proposal's
 * lines) inside it; otherwise it is plain words on the white. `aside` is what stands at the end of the state's line: the "ⓘ" that opens how
 * a Dogovor goes.
 */
export function NextStepCard({ title, body, tone = 'green', status, aside, children }: { title: string; body?: string | null; tone?: WorkspaceTone; status?: EndStatus; aside?: ReactNode; children?: ReactNode }) {
  const previousTitle = useRef(title);
  useEffect(() => {
    if (title === previousTitle.current) return;
    previousTitle.current = title;
    // Android reads the persistent live text below. VoiceOver needs the changed step explicitly, never its initial title.
    if (title && Platform.OS === 'ios') AccessibilityInfo.announceForAccessibility(title);
  }, [title]);
  const waits = tone === 'warn' || tone === 'danger';
  const words = <>
    <View style={s.nextHead}>{status ? <StatusMark shape={STATUS_CHIPS[status].shape} tone={STATUS_CHIPS[status].tone} />
      : <View style={[s.dot, { backgroundColor: toneColor[tone] }]} />}
      <T variant={waits ? 'heading' : 'bodyStrong'} accessibilityRole="header" accessibilityLiveRegion="polite" style={s.nextTitle}>{title}</T>
      {aside}</View>
    {body ? <T variant={waits ? 'copy' : 'note'} tone="muted" style={[s.nextBody, status && { paddingLeft: STATUS_MARK + sys.space.sm }]}>{body}</T> : null}
    {children}
  </>;
  return <View accessibilityRole="summary">
    {waits ? <Surface kind="note" tone={tone === 'danger' ? 'danger' : 'warn'} style={s.nextWaiting}>{words}</Surface>
      : <View style={s.next}>{words}</View>}
  </View>;
}

/** Native ScrollView has no useful intrinsic height here. Measure only the message; both commands stay outside it. */
function RecoveryMessage({ message, limit }: { message: string; limit: number }) {
  const [contentHeight, setContentHeight] = useState<number | null>(null);
  return <ScrollView testID="agreement-action-recovery" style={[s.feedbackScroll, { height: Math.min(contentHeight ?? limit, limit) }]}
    keyboardShouldPersistTaps="handled" nestedScrollEnabled scrollEnabled={contentHeight === null || contentHeight > limit}
    onContentSizeChange={(_width, height) => {
      if (!Number.isFinite(height) || height <= 0) return;
      const measured = Math.ceil(height);
      setContentHeight(current => current === measured ? current : measured);
    }}>
    <T accessibilityRole="alert" variant="note" style={s.feedbackText}>{message}</T>
  </ScrollView>;
}

/**
 * The grey sentence that stands in the footer's place when NOTHING waits for the person (plan 2.6): no green button, only whose move it is -
 * "Čeka da Marko potvrdi završetak.". The route calls it only when it has no action to offer. Null when the honest thing is to say nothing:
 * the permissions could not be read, and the step card above already says how to read them again; and a Dogovor that is over (finished or
 * cancelled), whose state the head of the page has already said - the same words again at the foot were a duplicate (owner, 8 Oct 2026), and the
 * footer with nothing to say draws no bar at all.
 *
 * - `worker`: I am the side that does the work; once it is reported done, the confirmation is the other side's. Before that the move is
 *   the worker's, and the one who asked for the work is told whose move it is ("Čeka da Marko javi da je zadatak gotov."), not that
 *   completion "is not available": that sounded like a fault of the app on the most ordinary day of a Dogovor.
 * - `change`: a proposal waits; `mine` is null when its content could not be read.
 * - `permissionsKnown`: the server's own answer about completion (`radnje`) was read.
 */
export function agreementQuietLine({ state, party, worker, otherName, change, permissionsKnown }: {
  state: DogovorProjekcija['stanje']; party: boolean; worker: boolean; otherName?: string | null;
  change: { waits: boolean; mine: boolean | null }; permissionsKnown: boolean;
}): string | null {
  if (!party) return null;
  // The name stands as the subject of its sentence, so it needs no case ending; the app's own stand-in for a missing name is not a name.
  const given = otherName?.trim(), who = given && given !== 'Druga strana' ? given : 'druga strana';
  if (state === 'CANCELLED' || state === 'COMPLETED') return null;
  if (change.waits) return change.mine === true ? `Čeka da ${who} odgovori na Vaš predlog izmene.` : 'Predlog izmene čeka odgovor.';
  if (state === 'AWAITING_REQUESTER' && worker) return `Čeka da ${who} potvrdi završetak.`;
  if (!permissionsKnown) return null;
  if (state === 'CONFIRMED' && !worker) return `Čeka da ${who} javi da je zadatak gotov.`;
  return 'Završetak trenutno nije dostupan.';
}

/**
 * The foot of the Dogovor: at most one brand action per state, and none when nothing waits for the person - then it is one grey sentence
 * of the state (`quiet`). It is the system's `FlowFooter` (the one foot of every screen: the gutter across, 12 over and under, a line
 * above), and the one green thing on the screen. The second button, "Otvori poruke", is gone: the Poruke tab stands at the top of the same
 * screen, so the foot said it twice and took a quarter of it. `statusText` is the quiet line above ("Osvežavamo…", "Čuvamo promenu…").
 */
export function WorkspaceFooter({ brand, quiet, loading = false, statusText, notice, onLayout }: {
  brand: { label: string; onPress: () => void; disabled?: boolean } | null;
  /** Said in place of the action when there is none. */
  quiet?: string | null;
  loading?: boolean;
  statusText?: string | null;
  notice?: { message: string; refresh: () => void; refreshing: boolean } | null;
  /** The screen reads the footer's height to keep the outcome bar above it. */
  onLayout?: (event: LayoutChangeEvent) => void;
}) {
  const { width, height } = useWindowDimensions(), textScale = useTextScale();
  // Bound the reading area, never the footer: enlarged command labels keep their full natural touch height.
  const messageLimit = Math.max(48, Math.min(180, Math.floor(height / 4)));
  const recoveryMessage = notice?.message || null;
  const announcedRecovery = useRef<string | null>(null);
  useEffect(() => {
    if (recoveryMessage === announcedRecovery.current) return;
    announcedRecovery.current = recoveryMessage;
    // The recovery mounts with its text, so announce it directly on both platforms instead of also using a live region.
    // Clearing the message resets the episode: the same failure after a later attempt must be heard again.
    if (recoveryMessage) AccessibilityInfo.announceForAccessibility(recoveryMessage);
  }, [recoveryMessage]);
  // A footer with nothing to say draws nothing, so a finished Dogovor does not carry an empty padded bar.
  if (!brand && !quiet && !notice && !statusText) return null;
  return <View testID="agreement-action-footer" onLayout={onLayout} style={s.foot}>
    <FlowFooter>
      {notice ? <Surface kind="note" tone="warn">
        <RecoveryMessage key={JSON.stringify([notice.message, width, textScale])} message={notice.message} limit={messageLimit} />
        <V2Action label="Osveži status Dogovora" kind="quiet" loading={notice.refreshing}
          disabled={notice.refreshing} onPress={notice.refresh} />
      </Surface> : statusText ? <T variant="note" tone="muted" style={s.statusLine}>{statusText}</T> : null}
      {brand ? <V2Action label={brand.label} disabled={brand.disabled} loading={loading && !!brand.disabled}
        onPress={brand.onPress} style={brandAction} />
        : quiet ? <T testID="agreement-quiet-line" variant="note" tone="muted" style={s.quietLine}>{quiet}</T> : null}
    </FlowFooter>
  </View>;
}

const s = StyleSheet.create({
  // The foot is never squeezed by what stands above it: its message is bounded on its own, and the actions keep their full height.
  foot: { flexShrink: 0 },
  next: { gap: sys.space.sm },
  nextWaiting: { gap: sys.space.sm },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill },
  // The title takes the line, so what stands at its end (the "ⓘ") is at the end of the line and not after the last word.
  nextTitle: { color: sys.color.ink, flexGrow: 1, flexShrink: 1 },
  // The words start where the title's start (the dot and its gap are 16).
  nextBody: { paddingLeft: sys.space.base },
  feedbackScroll: { flexGrow: 0, flexShrink: 0 },
  feedbackText: { color: sys.color.ink },
  // The state in words where no action stands: grey, centred, as tall as the sentence needs - never a faded ghost of a button.
  quietLine: { textAlign: 'center', paddingVertical: sys.space.xs },
  statusLine: { textAlign: 'center' },
});
