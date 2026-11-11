import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { T } from '../Text';
import { BrandMark } from '../entry/BrandAssets';
import { FactArt } from '../system/FactArt';
import { layout } from '../system/layout';
import { sys } from '../system/tokens';
import { PrimaryButton, QuietButton } from './AuthControls';

/**
 * Owner decision 2026-10-07, design proposal N3: signing in to a banned, blocked or closed account gets its own clear
 * message, not the generic sign-in error, and it is one sentence with one way out. Only what is known is said: the provider
 * refused this account, and the ordinary functions of the app cannot be used. No reason, no duration and no address is named,
 * because none is known to the app. The sentence about writing to support is said only together with the button that does it
 * (`supportAction`), so a sentence never promises a way that is not on the screen.
 */
export const restrictedAccountCopy = {
  title: 'Pristup nalogu je ograničen',
  body: 'Trenutno ne možeš da koristiš obične funkcije aplikacije.',
  support: 'Ako misliš da je u pitanju greška, javi nam se.',
  supportAction: 'Obrati se podršci',
  supportFailed: 'Pošta se nije otvorila. Pokušaj ponovo.',
} as const;

/**
 * The picture, the heading and the fact, with no red and no alert tone, because nothing the person typed was wrong. It is
 * the text of `RestrictedAccountScreen`; the screen owns the exits. A state of the app, so it is told the way the others are
 * (`StateView`): a fact picture at 48 in an 80 well, the title (21), one sentence in the ink, 8 and 16 between them.
 */
export function RestrictedAccountPanel({ withSupport = false }: { withSupport?: boolean }) {
  return <View testID="restricted-account-panel" style={s.panel} accessibilityLiveRegion="polite">
    {/* A fact picture, not a control: the words beside it carry the meaning. */}
    <View style={s.well} accessible={false} importantForAccessibility="no-hide-descendants">
      <FactArt kind="lock" size={48} />
    </View>
    <View style={s.words}>
      <T accessibilityRole="header" variant="title">{restrictedAccountCopy.title}</T>
      <T variant="copy">{withSupport ? `${restrictedAccountCopy.body} ${restrictedAccountCopy.support}` : restrictedAccountCopy.body}</T>
    </View>
  </View>;
}

/**
 * A restricted account's own screen (N3): white, no sheet over a backdrop, no bottom bar, because there is nothing to open.
 * The picture and the sentence, then the exits. `onSupport` draws "Obrati se podršci" as the one green action and the exit becomes
 * the quiet one; without it the exit is the one green action and nothing else is promised. The screen that shows this owns
 * what the exit does (the sign-in screens go back to the sign-in form: the person is not signed in, so there is nothing to
 * sign out of).
 */
export function RestrictedAccountScreen({ exitLabel, onExit, busy = false, onSupport }: {
  exitLabel: string; onExit: () => void; busy?: boolean;
  /** Opens the way to write to support; a rejection is said calmly under the buttons. Left out, there is no such way. */
  onSupport?: () => void | Promise<unknown>;
}) {
  const insets = useSafeAreaInsets();
  const [failed, setFailed] = useState(false);
  const asking = useRef(false);
  const support = async () => {
    if (!onSupport || asking.current) return;
    asking.current = true; setFailed(false);
    try { await onSupport(); } catch { setFailed(true); } finally { asking.current = false; }
  };
  return <View testID="restricted-account-screen" accessibilityViewIsModal style={[s.screen, { paddingTop: insets.top }]}>
    <ScrollView keyboardShouldPersistTaps="handled"
      contentContainerStyle={[s.scroll, { paddingBottom: Math.max(layout.zone, insets.bottom + sys.space.base) }]}>
      <View style={s.column}>
        <View accessible={false} importantForAccessibility="no-hide-descendants" style={s.brand}><BrandMark size={32} /></View>
        {/* The sentence and the way out stand in the middle of what is left, as the design proposal draws them (N3), not at the top. */}
        <View style={s.middle}>
          <RestrictedAccountPanel withSupport={!!onSupport} />
          {failed ? <T accessibilityLiveRegion="polite" variant="note" tone="muted">{restrictedAccountCopy.supportFailed}</T> : null}
          <View style={s.actions}>
            {onSupport ? <>
              <PrimaryButton title={restrictedAccountCopy.supportAction} onPress={() => void support()} disabled={busy} />
              <QuietButton title={exitLabel} onPress={onExit} disabled={busy} />
            </> : <PrimaryButton title={exitLabel} onPress={onExit} busy={busy} />}
          </View>
        </View>
      </View>
    </ScrollView>
  </View>;
}

const s = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: sys.color.surface },
  scroll: { flexGrow: 1, paddingHorizontal: layout.gutter, paddingTop: sys.space.base, alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxWidth, flexGrow: 1 },
  brand: { minHeight: layout.touch, justifyContent: 'center', marginBottom: sys.space.md },
  // Lifted a little above the true middle (the bottom padding), where the eye rests on a screen with nothing else on it.
  middle: { flexGrow: 1, justifyContent: 'center', gap: sys.space.base, paddingBottom: layout.touch + sys.space.base },
  // White like the screen (owner: no pale large panels); only the small picture well is a neutral control surface.
  panel: { gap: sys.space.base },
  words: { gap: sys.space.sm },
  well: { width: 80, height: 80, borderRadius: sys.radius.card, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
  actions: { gap: sys.space.sm, marginTop: sys.space.sm },
});
