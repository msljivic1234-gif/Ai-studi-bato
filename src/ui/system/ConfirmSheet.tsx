import { useCallback, useEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { ProductSheet, SHEET_TOUCH } from '../product/ProductSheet';
import { useReducedMotion } from './motion';
import { brandAction, sheetLift, sys } from './tokens';

/**
 * How long a confirmed command holds the sheet before Back and a tap outside work again. A command and its re-read can
 * take up to about 30 s at the 15 s deadlines; before the sheets, Back still left the screen all that time. After this
 * the person may close the window; the command carries on and the screen that owns it keeps showing that it runs.
 */
export const SLOW_COMMAND_MS = 2500;

/**
 * Both forms are centred (owner 2026-10-20). The wire names remain compatible with existing callers:
 * - `dialog`: a white card in the middle of the screen over a dimmed screen. A short question: a title that names what
 *   happens, one sentence, one confirm and a quiet way out. Every question asked so far is one of these.
 * - `sheet`: the scrollable content dialog (`ProductSheet`), for reasons, chips or fields (`extra`).
 *   Map panels have their separate gesture engine.
 */
export type ConfirmForm = 'dialog' | 'sheet';

export type ConfirmRequest = {
  title: string;
  /** One sentence: what will happen, in the words the person reads. */
  message: string;
  confirmLabel: string;
  /** The quiet way out; "Odustani" when left out. `null` for a notice that only informs and has nothing to cancel. */
  cancelLabel?: string | null;
  /** `danger` when confirming ends, withdraws or throws something away: the confirm is drawn in the danger colour. */
  tone?: 'default' | 'danger';
  /** Runs at most once. A returned promise keeps the confirm busy and the sheet open until it settles. The sheet never
   *  reports success or failure itself: the screen that owns the command shows its outcome. */
  onConfirm?: () => void | Promise<unknown>;
  /** Every ending that is not the confirm: the cancel button, Back, a tap outside, or the dialog being
   *  retired by its screen. Runs at most once, and never after the confirm. */
  onCancel?: () => void;
  /**
   * Content under the sentence that needs room: a list of reasons, chips, a field. It uses the scrollable centred
   * dialog, whatever `form` says (see `confirmFormOf`): content needs room and a field needs keyboard avoidance. It
   * keeps its own state and reports through the caller's callbacks; this component only draws it.
   */
  extra?: ReactNode;
  /**
   * What draws the question. Left out, it follows from the request: a bottom sheet when there is `extra` content, a dialog
   * otherwise. Say `'sheet'` to use the scrollable dialog for a question that has no extra content. `'dialog'` together with
   * `extra` is not honoured: the content has nowhere to stand in a dialog, so the sheet is drawn.
   */
  form?: ConfirmForm;
};

/**
 * Which form a request is drawn in. ONE rule, here: extra content always needs the sheet; otherwise the request's own
 * `form` if it names one; otherwise a dialog. No call site changes form by itself: a request that carries neither field is
 * a dialog, and the only way to a sheet is content that needs it or the caller's explicit word.
 */
export function confirmFormOf(request: Pick<ConfirmRequest, 'form' | 'extra'>): ConfirmForm {
  const extra = request.extra;
  if (extra !== undefined && extra !== null && extra !== false) return 'sheet';
  return request.form ?? 'dialog';
}

/**
 * What every form of the question shares: the one decision it takes, said once. The confirm runs the caller's command at
 * most once; a promise it returns keeps the confirm busy until it settles; every other ending (the cancel, Back, a tap
 * outside, the screen taking the question away) is a cancel, and a cancel never follows a confirm. `ended`
 * reports that the question is over, once; `dismiss`, which each form brings, is how that form leaves.
 */
function useConfirmFlow({ onConfirm, onCancel, onClosed }: Pick<ConfirmRequest, 'onConfirm' | 'onCancel'> & { onClosed: () => void }) {
  const [busy, setBusy] = useState(false);
  // A command that has run for SLOW_COMMAND_MS no longer holds the person in the question.
  const [slow, setSlow] = useState(false);
  const decided = useRef(false), closed = useRef(false), alive = useRef(true);
  const latest = useRef({ onCancel, onClosed }); latest.current = { onCancel, onClosed };
  const decline = useCallback(() => { if (decided.current) return; decided.current = true; latest.current.onCancel?.(); }, []);
  const ended = useCallback(() => { decline(); if (closed.current) return; closed.current = true; latest.current.onClosed(); }, [decline]);
  // Taken away by its screen (retired, or the branch that drew it is gone): that is not a confirm.
  useEffect(() => { alive.current = true; return () => { alive.current = false; ended(); }; }, [ended]);
  useEffect(() => {
    if (!busy) return;
    const timer = setTimeout(() => setSlow(true), SLOW_COMMAND_MS);
    return () => clearTimeout(timer);
  }, [busy]);
  const confirm = (dismiss: () => void) => {
    if (decided.current) return;
    decided.current = true;
    let result: unknown;
    try { result = onConfirm?.(); } catch (error) { dismiss(); throw error; }
    if (result && typeof (result as PromiseLike<unknown>).then === 'function') {
      setBusy(true);
      // Busy until the question is gone: the button does not flash back to pressable while it leaves.
      const settle = () => { if (alive.current) dismiss(); };
      (result as PromiseLike<unknown>).then(settle, settle);
      return;
    }
    dismiss();
  };
  const cancel = (dismiss: () => void) => { if (busy || decided.current) return; decline(); dismiss(); };
  return { busy, slow, ended, confirm, cancel, dismissible: !busy || slow };
}

/** What a tap outside says it does, for a screen reader: it closes the question as a "no", or only the window once a command runs on. */
const outsideHint = (busy: boolean, cancelLabel: string | null) =>
  busy ? 'Zatvara prozor; radnja se nastavlja.' : cancelLabel === null ? 'Zatvara obaveštenje.' : 'Zatvara pitanje bez potvrde.';

/**
 * A question asked inside the app instead of a system alert: a title, one sentence, a quiet cancel and ONE confirm.
 * Mounted means open. `onClosed` runs once the question is over (or was taken away by its parent), whatever ended it.
 *
 * Drawn in the form `confirmFormOf(request)` names: a compact centred dialog for a short question, a scrollable dialog for one that
 * carries `extra` content (or whose caller asks for `form: 'sheet'`). Both forms have the same contract, tested by the same
 * cases: one confirm that runs once, a busy state while its command runs, every other ending routed to the cancel path.
 */
export function ConfirmSheet(props: ConfirmRequest & { onClosed: () => void; reduced?: boolean }) {
  return confirmFormOf(props) === 'sheet' ? <ConfirmContentDialog {...props} /> : <ConfirmDialog {...props} />;
}

/** The question with extra content: central surface, independently scrolling content and pinned actions. */
function ConfirmContentDialog({ title, message, confirmLabel, cancelLabel = 'Odustani', tone = 'default', extra, onConfirm, onCancel,
  onClosed, reduced }: ConfirmRequest & { onClosed: () => void; reduced?: boolean }) {
  const { busy, dismissible, ended, confirm, cancel } = useConfirmFlow({ onConfirm, onCancel, onClosed });
  const danger = tone === 'danger';
  // Leaving a slow command's sheet is not a cancel: `decided` is already set, so the cancel path does not run again.
  return <ProductSheet title={title} closeButton={false} dismissible={dismissible} reduced={reduced} onClose={ended}
    // A tap outside the question closes it as a "no"; a notice (nothing to cancel) it simply closes. While the command runs
    // a tap outside does nothing, so the sheet takes it out of what a screen reader visits; once the command runs long it
    // only closes the window and the command carries on.
    backdropHint={outsideHint(busy, cancelLabel)}
    footer={dismiss => <View style={s.actions}>
      <Press testID="confirm-sheet-confirm" accessibilityRole="button" accessibilityLabel={confirmLabel}
        accessibilityState={{ disabled: busy, busy }} disabled={busy} haptic={busy ? 'none' : danger ? 'medium' : 'light'}
        onPress={() => confirm(dismiss)} style={[s.confirm, danger && s.danger]}>
        {busy ? <ActivityIndicator accessibilityElementsHidden importantForAccessibility="no-hide-descendants" color={sys.color.onGreen} /> : null}
        <T variant="action" style={s.onFilled}>{confirmLabel}</T>
      </Press>
      {cancelLabel === null ? null : <Press testID="confirm-sheet-cancel" accessibilityRole="button" accessibilityLabel={cancelLabel}
        accessibilityState={{ disabled: busy }} disabled={busy} haptic="select" onPress={() => cancel(dismiss)} style={s.cancel}>
        {/* While the command runs the quiet way out is grey, as a button that cannot be used is: never a faded ghost. */}
        <T variant="action" style={busy ? s.quietOff : s.quiet}>{cancelLabel}</T>
      </Press>}
    </View>}>
    {() => extra === undefined || extra === null || extra === false ? <T variant="copy" tone="muted">{message}</T>
      : <><T variant="copy" tone="muted">{message}</T>{extra}</>}
  </ProductSheet>;
}

// ---------------------------------------------------------------------------------------------------------------------
// The centred dialog (plan 2.20)
// ---------------------------------------------------------------------------------------------------------------------

/** The widest a dialog gets: a sentence at the app's copy size reads comfortably in it, and a narrow phone keeps 24 on each side. */
export const DIALOG_MAX_WIDTH = 340;
const EASE_OUT = Easing.bezier(...sys.motion.easeOut);

/** Native modal owns focus and Android Back. Content scrolls when text is large
 * while the title and commands stay available. Material, width and motion use
 * shared defaults. Dismissal settles the request once and returns focus promptly;
 * reduced motion disables transition movement. Other animation techniques remain
 * possible when they preserve those behaviors and native lifecycle safety. */
function ConfirmDialog({ title, message, confirmLabel, cancelLabel = 'Odustani', tone = 'default', onConfirm, onCancel, onClosed,
  reduced: callerReduced }: ConfirmRequest & { onClosed: () => void; reduced?: boolean }) {
  const systemReduced = useReducedMotion();
  const reduced = callerReduced ?? systemReduced;
  const { busy, dismissible, ended, confirm, cancel } = useConfirmFlow({ onConfirm, onCancel, onClosed });
  const { height } = useWindowDimensions();
  const [scale] = useState(() => new Animated.Value(reduced ? 1 : sys.motion.dialog.from));
  useEffect(() => {
    if (reduced) { scale.setValue(1); return; }
    const run = Animated.timing(scale, { toValue: 1, duration: sys.motion.dialog.enter, easing: EASE_OUT, useNativeDriver: true });
    run.start();
    return () => run.stop();
  }, [reduced, scale]);
  // A dialog has no animation of its own to wait for, so "dismiss" is "the question is over". Back and a tap outside are the
  // same one way out: a "no" (a cancel) while the question is open, and only the window once a long command runs on.
  const requestClose = () => { if (dismissible) ended(); };
  const danger = tone === 'danger';
  return <Modal visible transparent animationType={reduced ? 'none' : 'fade'} statusBarTranslucent onRequestClose={requestClose}>
    <View testID="confirm-dialog" style={s.layer}>
      {/* The dim is the tap-outside area: a tap is a "no", does nothing while the command it started runs, and then it is not visited at all. */}
      <Pressable testID="confirm-sheet-scrim" style={[StyleSheet.absoluteFill, s.dim]} onPress={requestClose} accessible={dismissible}
        accessibilityRole="button" accessibilityLabel="Zatvori" accessibilityHint={dismissible ? outsideHint(busy, cancelLabel) : 'Zatvori'} />
      <Animated.View accessibilityViewIsModal
        style={[s.card, { maxHeight: height - 2 * sys.space.xl }, reduced ? null : { transform: [{ scale }] }]}>
        <T accessibilityRole="header" variant="heading" style={s.title}>{title}</T>
        {/* Only a sentence that does not fit scrolls; its bar is always drawn then, so the person can see there is more. */}
        <ScrollView style={s.body} persistentScrollbar>
          <T variant="copy" tone="muted">{message}</T>
        </ScrollView>
        <View style={s.actions}>
          <Press testID="confirm-sheet-confirm" accessibilityRole="button" accessibilityLabel={confirmLabel}
            accessibilityState={{ disabled: busy, busy }} disabled={busy} haptic={busy ? 'none' : danger ? 'medium' : 'light'}
            onPress={() => confirm(ended)} style={[s.confirm, danger && s.danger]}>
            {busy ? <ActivityIndicator accessibilityElementsHidden importantForAccessibility="no-hide-descendants" color={sys.color.onGreen} /> : null}
            <T variant="action" style={s.onFilled}>{confirmLabel}</T>
          </Press>
          {cancelLabel === null ? null : <Press testID="confirm-sheet-cancel" accessibilityRole="button" accessibilityLabel={cancelLabel}
            accessibilityState={{ disabled: busy }} disabled={busy} haptic="select" onPress={() => cancel(ended)} style={s.cancel}>
            {/* While the command runs the quiet way out is grey, as a button that cannot be used is: never a faded ghost. */}
            <T variant="action" style={busy ? s.quietOff : s.quiet}>{cancelLabel}</T>
          </Press>}
        </View>
      </Animated.View>
    </View>
  </Modal>;
}

type Held = ConfirmRequest & { id: number };

/**
 * A confirmation asked where `Alert.alert` used to be: `ask` takes the same title, sentence, labels and callbacks, and
 * the screen renders `sheet` anywhere in its tree. The callbacks are the caller's own closures, captured when it asked,
 * so every guard inside them decides exactly as it did before. `close` retires an open question silently (its
 * `onCancel` still runs), for a screen that has just made its own answer stale.
 */
export function useConfirmSheet(options: { reduced?: boolean } = {}): {
  ask: (request: ConfirmRequest) => void; close: () => void; open: boolean; sheet: ReactElement | null;
} {
  const [held, setHeld] = useState<Held | null>(null);
  const next = useRef(0);
  const ask = useCallback((request: ConfirmRequest) => { setHeld({ ...request, id: ++next.current }); }, []);
  const close = useCallback(() => setHeld(null), []);
  let sheet: ReactElement | null = null;
  if (held) {
    const { id, ...request } = held;
    sheet = <ConfirmSheet key={id} {...request} reduced={options.reduced}
      onClosed={() => setHeld(current => current?.id === id ? null : current)} />;
  }
  return { ask, close, open: held !== null, sheet };
}

const s = StyleSheet.create({
  actions: { gap: sys.space.xs },
  // The confirm is the screen's one primary action (`brandAction`: 54 high, the primary corner, green); a destructive
  // one keeps that measure and takes the danger colour. Its label is `onGreen` on either fill (6.9:1 on danger).
  confirm: { ...brandAction, paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm,
    flexDirection: 'row', gap: sys.space.sm, alignItems: 'center', justifyContent: 'center' },
  danger: { backgroundColor: sys.color.danger },
  onFilled: { color: sys.color.onGreen, textAlign: 'center', flexShrink: 1 },
  cancel: { minHeight: SHEET_TOUCH, borderRadius: sys.radius.primary, paddingHorizontal: sys.space.base, alignItems: 'center', justifyContent: 'center' },
  quiet: { color: sys.color.green, textAlign: 'center' },
  quietOff: { color: sys.color.muted, textAlign: 'center' },
  // The dialog: a layer that fills the window and centres the card, the dim behind it (the tap-outside area), and the card.
  layer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: sys.space.xl },
  dim: { backgroundColor: sys.color.dim },
  card: { width: '100%', maxWidth: DIALOG_MAX_WIDTH, backgroundColor: sys.color.surface, borderRadius: sys.radius.card,
    paddingHorizontal: sys.space.xl, paddingTop: sys.space.xl, paddingBottom: sys.space.base, gap: sys.space.md, ...sheetLift.detached },
  title: { color: sys.color.ink },
  body: { flexGrow: 0, flexShrink: 1 },
});
