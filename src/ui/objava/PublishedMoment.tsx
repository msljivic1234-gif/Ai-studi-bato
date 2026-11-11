import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { Arrive } from '../system/Arrive';
import { FactArt } from '../system/FactArt';
import { layout } from '../system/layout';
import { PECAT_FALL_MS, Pecat } from '../system/Pecat';
import { Screen } from '../system/Screen';
import { sys } from '../system/tokens';

/**
 * "Objavljeno" (plan 2.9, owner 2026-10-07; "Papir i pečat", owner's pick of 2026-10-08): the one calm moment right after a publication the
 * server has confirmed. Until 2026-10-07 the success was replaced by the jump to the map in the same breath, so nobody ever saw it. The
 * moment is the paper with a pin and a pencil (144, the picture of a task laid on the table), which settles in once as the picture of an
 * empty state does (`Arrive`); the confirmation then falls beside the actual task title like a stamp (`Pecat`: tilted, 140 ms, no bounce, one
 * light tick as it lands); one confirmation and ONE green way on. The task is identified only when its actual title is supplied. Nothing else moves (the owner, 8 Oct 2026: the grey line about
 * where the applications can be seen, "Prijave vidiš ovde i u zvoncu.", explained what the green action already is). Under reduced motion the picture and the pill are there at once and the tick stays (a tick is an outcome, not movement).
 *
 * It holds `PUBLISHED_MOMENT_MS` when left alone and then continues by itself; a tap on the green action, or Android Back (the
 * route wires that), continues at once. It never blocks the way on. A screen reader is not hurried: while one is on, the moment
 * waits for the person to continue, because a sentence that is still being read must not be cut off by a screen change.
 *
 * The green action sits in the middle, under the words, and not at the foot where "Objavi zadatak" was: a second tap meant for
 * the publish button must not land on the way on and skip the moment before it was seen.
 */
/** The paper settles for `arrive`, the stamp falls on it as it ends, and the whole picture then holds for another 1,2 s before the moment goes on by itself. */
export const PUBLISHED_MOMENT_MS = sys.motion.arrive.duration + PECAT_FALL_MS + 1200;

/** True while a screen reader is on. The answer comes asynchronously; until then (and where there is no such API) it is off. */
function useScreenReaderOn(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let alive = true;
    try { void AccessibilityInfo.isScreenReaderEnabled?.()?.then(value => { if (alive) setOn(value === true); }, () => undefined); } catch { /* none here */ }
    let subscription: { remove?: () => void } | undefined;
    try { subscription = AccessibilityInfo.addEventListener?.('screenReaderChanged', value => { if (alive) setOn(value === true); }) as typeof subscription; } catch { /* none here */ }
    return () => { alive = false; subscription?.remove?.(); };
  }, []);
  return on;
}

export function PublishedMoment({ title, taskTitle, actionLabel = 'Otvorite zadatak', onContinue }: {
  /** What happened, as a sentence: "Zadatak je objavljen." */
  title: string;
  /** Actual title of the confirmed task. Missing data never becomes an invented task name. */
  taskTitle?: string | null;
  actionLabel?: string;
  /** Goes on to the task. Called at most once per tap or timer; the route's own fence decides whether it may. */
  onContinue: () => void;
}) {
  const screenReader = useScreenReaderOn();
  const name = taskTitle?.trim();
  // The visible stamp is concise; the accessible announcement retains the exact
  // outcome, including the distinction between publication and published edits.
  const confirmation = title === 'Zadatak je objavljen.' ? 'Objavljen'
    : title === 'Izmene su objavljene.' ? 'Izmene objavljene' : title;
  // The timer runs the newest `onContinue`, which holds the route's newest guards, never the one of the render that started it.
  const latest = useRef(onContinue); latest.current = onContinue;
  useEffect(() => {
    if (screenReader) return;
    const timer = setTimeout(() => latest.current(), PUBLISHED_MOMENT_MS);
    return () => clearTimeout(timer);
  }, [screenReader]);
  return <Screen kind="detail" contentStyle={s.content}>
    <View style={s.center}>
      <Arrive delay={0}><FactArt kind="publish" size={144} /></Arrive>
      <View style={s.words} accessible accessibilityRole="header" accessibilityLiveRegion="polite"
        accessibilityLabel={name ? `${name}. ${title}` : title}>
        {name ? <T accessible={false} variant="title" style={s.title}>{name}</T> : null}
        {/* Announce the name and confirmation once; the existing stamp keeps its motion and haptic. */}
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Pecat label={confirmation} tone="green" play delay={sys.motion.arrive.duration} />
        </View>
      </View>
      <V2Action kind="primary" label={actionLabel} onPress={onContinue} style={s.action} />
    </View>
  </Screen>;
}

const s = StyleSheet.create({
  // The paper, the words and the one way on stand in the middle of the screen, one more edge in from the screen's own (as the owner's picture
  // has it); the way on is as wide as the words allow (320) and centred, never pushed to one side.
  content: { flexGrow: 1 },
  center: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', gap: layout.section, paddingHorizontal: layout.gutter },
  words: { alignItems: 'center', gap: sys.space.md, maxWidth: 320, width: '100%' },
  title: { color: sys.color.ink, textAlign: 'center' },
  action: { alignSelf: 'center', maxWidth: 320, width: '100%' },
});
