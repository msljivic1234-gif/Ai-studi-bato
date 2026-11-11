import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StyleSheet, View } from 'react-native';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { Section } from '../system/Section';
import { T } from '../Text';
import { sys } from '../system/tokens';

/**
 * "Kako radi" (design proposal N4, owner 2026-10-07): the first time a brand-new account opens Početna there is ONE quiet row
 * under the two doors, three short steps with a "Sakrijte" beside the heading. One touch hides it, and a hidden row never
 * returns. There is no guide and no introduction screen; the row is the whole of it.
 *
 * What was hidden is a presentation fact kept on the device, like the entry's "intro seen" receipt: cosmetic, never blocking.
 * If it cannot be read the row is shown (and can be hidden again); if it cannot be written the row stays hidden for as long as
 * the app runs. No account data is involved, so the receipt is per device, not per account.
 */
export const HOW_IT_WORKS_KEY = 'uskoci.home.how-it-works-hidden.v1';

/** The steps, in the order of a task's life. The words are the proposal's own; the pictures are the app's own fact pictures. */
export const HOW_IT_WORKS_STEPS: readonly { art: FactArtKind; title: string; note: string }[] = [
  { art: 'publish', title: 'Objavite ili pronađite', note: 'Zadatak' },
  { art: 'agreements', title: 'Dogovorite se', note: 'Prijava i poruke' },
  { art: 'star', title: 'Ocenite', note: 'Posle završetka' },
];

/** How long a slow device read may delay the row: storage must never hold up the screen (the entry's receipt uses the same bound). */
const READ_MS = 500;

/** Remembered for as long as the app runs, so a hide that could not be written still holds when the screen is opened again. */
let hiddenThisRun = false;

/** Exposed for the tests: a fresh run of the app. */
export function forgetHiddenHowItWorks() { hiddenThisRun = false; }

type Knowledge = 'unknown' | 'shown' | 'hidden';

/** Whether the row is to be drawn, and the one command that hides it for good. Nothing is drawn until the receipt has answered. */
export function useHowItWorks() {
  const [known, setKnown] = useState<Knowledge>(hiddenThisRun ? 'hidden' : 'unknown');
  useEffect(() => {
    if (hiddenThisRun) { setKnown('hidden'); return; }
    let alive = true, settled = false;
    const settle = (hidden: boolean) => {
      // A slow device shows the row after READ_MS; its late answer still hides the row if it says it was hidden, and changes
      // nothing if it says it was not.
      if (!alive || (settled && !hidden)) return;
      settled = true;
      setKnown(hiddenThisRun || hidden ? 'hidden' : 'shown');
    };
    const timer = setTimeout(() => settle(false), READ_MS);
    try { Promise.resolve(AsyncStorage.getItem(HOW_IT_WORKS_KEY)).then(value => settle(value === '1'), () => settle(false)); }
    catch { settle(false); }
    return () => { alive = false; clearTimeout(timer); };
  }, []);
  const hide = useCallback(() => {
    hiddenThisRun = true;
    setKnown('hidden');
    try { Promise.resolve(AsyncStorage.setItem(HOW_IT_WORKS_KEY, '1')).catch(() => undefined); }
    catch { /* not written: it stays hidden for this run, and the next run may show it once more */ }
  }, []);
  return { visible: known === 'shown', hide };
}

/**
 * The row. `stacked` puts the three steps in a column when there is no room for three beside each other (large text, narrow window).
 * It is a `Section` like every other block of Početna: its heading, then the steps, and "Sakrijte" at the end of the heading's line.
 */
export function HowItWorks({ stacked }: { stacked: boolean }) {
  const { visible, hide } = useHowItWorks();
  if (!visible) return null;
  return <Section testID="how-it-works" title="Kako radi" action={{ label: 'Sakrijte', onPress: hide }}>
    <View accessible accessibilityLabel={HOW_IT_WORKS_STEPS.map((step, index) => `${index + 1}. ${step.title}, ${step.note}`).join('. ') + '.'}
      style={[s.steps, stacked && s.stepsStacked]}>
      {HOW_IT_WORKS_STEPS.map(step => <View key={step.title} style={[s.step, stacked && s.stepStacked]}>
        <FactArt kind={step.art} size={32} />
        <View style={[s.words, stacked && s.wordsStacked]}>
          <T variant="note" style={[s.stepTitle, !stacked && s.centred]}>{step.title}</T>
          <T variant="meta" tone="muted" style={stacked ? undefined : s.centred}>{step.note}</T>
        </View>
      </View>)}
    </View>
  </Section>;
}

const s = StyleSheet.create({
  steps: { flexDirection: 'row', gap: sys.space.base },
  stepsStacked: { flexDirection: 'column', gap: sys.space.md },
  step: { flex: 1, alignItems: 'center', gap: sys.space.sm },
  stepStacked: { flex: 0, flexDirection: 'row', gap: sys.space.md, minHeight: 48 },
  words: { alignItems: 'center', gap: sys.space.xs },
  wordsStacked: { alignItems: 'flex-start', flexShrink: 1 },
  stepTitle: { color: sys.color.ink, fontWeight: '600' },
  centred: { textAlign: 'center' },
});
