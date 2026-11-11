import { useEffect, useState, useSyncExternalStore } from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { tick as playTick } from './haptics';
import { useReducedMotion } from './motion';
import { sheetLift, sys } from './tokens';

/**
 * "Poruka": the one short bar that says what just happened (plan 2.4). It replaces the ten scattered success lines and
 * announcements ("Dostupnost je sačuvana.", "Podešavanja su sačuvana.", …) with ONE place, one look and one behaviour:
 *
 * - a readable message above the bottom controls, with an optional named action; material and optical spacing are shared defaults;
 * - enters 8 dp low and transparent over `sys.motion.enter`, leaves over `sys.motion.exit`; under reduced motion it only
 *   appears and disappears;
 * - read out to a screen reader when it appears (`announceForAccessibility`);
 * - only ONE at a time: a new message replaces the one on show;
 * - gone after 4 s, or 6 s when it carries an action (the person needs the time to read it and reach for it);
 * - a success tick only when the caller says the outcome is CONFIRMED BY THE SERVER.
 *
 * It is a tiny module-level store plus a host: a screen calls `poruka.show(...)` and never renders anything. The `(app)` layout
 * mounts the host for every screen of its navigator. A screen drawn ABOVE that navigator (the root stack's `dogovor/[id]`,
 * `obavestenja` and `prijave` cover it) mounts its own `<PorukaHost clearance={...} />`: more than one host is safe, because
 * the message, its time, its reading aloud and its tick belong to the store, and the host under a covered screen is not seen.
 * The current renderer uses native-driven Animated. Another engine must preserve cleanup, reduced motion and replacement semantics.
 */

/** How long a message stays: the words alone, and with an action. */
export const PORUKA_MS = { plain: 4000, action: 6000 } as const;

export type PorukaAction = {
  /** One word or two, as a command: "Vrati", "Otvori". */
  label: string;
  onPress: () => void;
};

export type PorukaRequest = {
  /** What happened, in the words the person reads: one short sentence ("Nacrt je obrisan."). */
  text: string;
  /** The one thing that can be done about it. The message goes first, then the action runs: an action that shows a message of its own replaces this one. */
  action?: PorukaAction;
  /** True only when the SERVER has confirmed the outcome. It adds the success tick; leave it out for anything that is only a press or a local change. */
  confirmed?: boolean;
};

/** A message on show: what was asked, and the id `poruka.show` returned for it. */
export type PorukaMessage = PorukaRequest & { id: number };
type Message = PorukaMessage;

let current: Message | null = null;
let issued = 0;
/** The id of the message that was last read out and ticked: several hosts may be mounted (see `PorukaHost`), and it is said once. */
let delivered = 0;
let expiry: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();
/**
 * Every change of the message goes through here. The time a message stays belongs to the message, not to whoever draws it: it
 * is taken away after 4 s (6 s with an action) even if no host is mounted, so a message shown where nothing draws it never
 * turns up minutes later on the next screen that does.
 */
function publish(next: Message | null) {
  if (expiry) { clearTimeout(expiry); expiry = null; }
  current = next;
  if (next) {
    const id = next.id;
    expiry = setTimeout(() => { expiry = null; poruka.hide(id); }, next.action ? PORUKA_MS.action : PORUKA_MS.plain);
  }
  listeners.forEach(listener => listener());
}

export const poruka = {
  /** Shows a message, replacing the one on show. Returns its id (0 for an empty text, which shows nothing). */
  show(request: PorukaRequest): number {
    const text = request.text.trim();
    if (!text) return 0;
    publish({ ...request, text, id: ++issued });
    return issued;
  },
  /** Takes the message away: the one with this id, or whichever is on show when no id is given. An older id is a no-op. */
  hide(id?: number) { if (current && (id === undefined || current.id === id)) publish(null); },
  /** The message on show, or null. */
  current: (): Message | null => current,
  subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
};

const EASE_OUT = Easing.bezier(...sys.motion.easeOut);
/** How far the bar sits below its place while it enters and leaves: 8 dp. */
const RISE = sys.space.sm;
/** The widest the bar gets: on a tablet it is a capsule in the middle, not a band across the screen. */
export const PORUKA_MAX_WIDTH = 560;

/**
 * The tick of a confirmed outcome. How it is made (the system's own `Confirm` on Android, the Taptic success on iOS, silence
 * when there is no engine and never a crash) is `system/haptics`; this file only says when.
 */
function tick() {
  playTick('success');
}

/**
 * Draws the message on show. `clearance` is how far from the window's bottom edge the bar must stay clear (the tab bar and
 * the system's gesture area): the bar floats `sys.space.base` above it. Mount it as the last child beside a navigator, so it
 * lies over every screen of that navigator; on a screen with no bar `clearance` is the system inset, or the height of the
 * screen's own pinned footer, so the bar floats above that and never covers a command.
 */
export function PorukaHost({ clearance }: { clearance: number }) {
  const message = useSyncExternalStore(poruka.subscribe, poruka.current, poruka.current);
  const reduced = useReducedMotion();
  const [shown, setShown] = useState<{ message: Message; leaving: boolean } | null>(null);
  const [opacity] = useState(() => new Animated.Value(0));
  const [rise] = useState(() => new Animated.Value(RISE));
  // What is on show follows the store in the same render, never one render later: a message that replaces another must not
  // be drawn for a frame as nothing, and a message taken away starts leaving with no frame of the old state in between.
  if (message && (!shown || shown.leaving || shown.message.id !== message.id)) setShown({ message, leaving: false });
  else if (!message && shown && !shown.leaving) setShown(reduced ? null : { message: shown.message, leaving: true });
  const live = shown && !shown.leaving ? shown.message : null;
  const leaving = shown?.leaving === true;
  const present = shown !== null;

  // A message that has just appeared: said aloud once and ticked once, when the server confirmed it. Said once even when two
  // hosts draw it (a screen above the navigator may mount its own host; only the one on top is seen).
  useEffect(() => {
    if (!live || delivered === live.id) return;
    delivered = live.id;
    AccessibilityInfo.announceForAccessibility(live.text);
    if (live.confirmed) tick();
  }, [live]);

  useEffect(() => {
    if (!present) { opacity.setValue(0); rise.setValue(RISE); return; }
    if (reduced) return;
    const toward = leaving ? 0 : 1, duration = leaving ? sys.motion.exit : sys.motion.enter;
    const run = Animated.parallel([
      Animated.timing(opacity, { toValue: toward, duration, easing: EASE_OUT, useNativeDriver: true }),
      Animated.timing(rise, { toValue: leaving ? RISE : 0, duration, easing: EASE_OUT, useNativeDriver: true }),
    ]);
    run.start();
    return () => run.stop();
  }, [present, leaving, reduced, opacity, rise]);

  // The bar leaves on its own timer, not on the animation's callback: a stopped animation never calls back.
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => setShown(null), sys.motion.exit + 20);
    return () => clearTimeout(timer);
  }, [leaving, shown]);

  if (!shown) return null;
  const { id, text, action } = shown.message;
  return <View pointerEvents="box-none" style={[s.layer, { bottom: clearance + sys.space.base }]}>
    <Animated.View testID="poruka" pointerEvents={leaving ? 'none' : 'auto'}
      style={[s.bar, !action && s.barPlain, reduced ? null : { opacity, transform: [{ translateY: rise }] }]}>
      <T variant="copy" style={s.text} numberOfLines={3}>{text}</T>
      {action ? <Press testID="poruka-action" accessibilityRole="button" accessibilityLabel={action.label} haptic="select"
        disabled={leaving} onPress={() => { poruka.hide(id); action.onPress(); }} style={s.action}>
        <T variant="action" style={s.actionText}>{action.label}</T>
      </Press> : null}
    </Animated.View>
  </View>;
}

const s = StyleSheet.create({
  layer: { position: 'absolute', left: sys.space.base, right: sys.space.base, alignItems: 'center' },
  // A capsule for one line (the corner is half the height), a soft card for three: `sheet` is the 28 that does both.
  bar: { width: '100%', maxWidth: PORUKA_MAX_WIDTH, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm,
    paddingVertical: sys.space.sm, paddingLeft: sys.space.lg, paddingRight: sys.space.sm, backgroundColor: sys.color.surface,
    borderRadius: sys.radius.sheet, borderWidth: 1, borderColor: sys.color.line, ...sheetLift.detached },
  barPlain: { paddingRight: sys.space.lg },
  text: { flex: 1, color: sys.color.ink },
  // The one green word; its touch area is a full 44 high, however short the word.
  action: { minHeight: sys.touch.min, minWidth: sys.touch.min, paddingHorizontal: sys.space.md, alignItems: 'center', justifyContent: 'center',
    borderRadius: sys.radius.pill },
  actionText: { color: sys.color.green },
});
