import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, AppState, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEntrySplashReady } from '../../hooks/useEntrySplashReady';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';
import { sesijaSada, useSesija } from '../../store/sesija';
import { Press } from '../Press';
import { T } from '../Text';
import { authCopy } from '../auth/authCopy';
import { profileLift, sys } from '../system/tokens';

import { BrandLockup } from './BrandAssets';

type Intent = 'REQUESTER' | 'WORKER';
export type EntryIntentSelection = { isCurrent: () => boolean };

// Official 3D clay natural illustrations matching Home doors ("Objavite zadatak" & "Uskočite i zaradite")
const publish = require('../../../assets/illustrations/natural-v1/publish.webp');
const discover = require('../../../assets/illustrations/natural-v1/money.webp');

export function EntryWelcome({ onRequester, onWorker, onSignIn, onSignUp, busy = false, error }: {
  onRequester: (selection: EntryIntentSelection) => void | Promise<void>;
  onWorker: (selection: EntryIntentSelection) => void | Promise<void>;
  onSignIn: () => void;
  onSignUp?: () => void;
  busy?: boolean;
  error?: string | null;
}) {
  const { width, height, fontScale } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const safeTop = Math.max(0, insets.top ?? 0);
  const safeBottom = Math.max(0, insets.bottom ?? 0);
  const reducedMotion = useSystemReducedMotion();
  const { onLayout, onSceneReady } = useEntrySplashReady({ waitForScene: true });
  const session = useSesija();
  const account = session.accountRevision;
  const [selected, setSelected] = useState<Intent | null>(null);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const pending = useRef<{ generation: number } | null>(null);
  const generation = useRef(0);
  const loaded = useRef(new Set<string>());

  const acknowledgeImage = useCallback((name: string) => {
    if (loaded.current.has(name)) return;
    loaded.current.add(name);
    if (loaded.current.size === 2) onSceneReady();
  }, [onSceneReady]);

  const enterAnim = useRef(new Animated.Value(reducedMotion ? 1 : 0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reducedMotion) return;
    Animated.timing(enterAnim, {
      toValue: 1,
      duration: sys.motion.welcome.entrance,
      useNativeDriver: true,
    }).start();

    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.025,
          duration: sys.motion.welcome.choicePulseHalf,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: sys.motion.welcome.choicePulseHalf,
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [reducedMotion]);

  // A callback may finish after a different account, a background transition or
  // a replacement choice. Its isCurrent guard must become false immediately.
  useEffect(() => {
    const cancel = () => {
      generation.current += 1;
      pending.current = null;
      setSelected(null);
    };
    cancel();
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') cancel();
    });
    return () => {
      generation.current += 1;
      pending.current = null;
      subscription.remove();
    };
  }, [account, reducedMotion, width, height, fontScale]);

  const available = !busy && !selected && !session.user;
  const choose = (intent: Intent) => {
    if (!available || pending.current || sesijaSada().accountRevision !== account || sesijaSada().user) return;
    const id = ++generation.current;
    pending.current = { generation: id };
    setSelected(intent);
    setSelectionError(null);
    const isCurrent = () => generation.current === id && pending.current?.generation === id &&
      sesijaSada().accountRevision === account && !sesijaSada().user;
    const callback = intent === 'REQUESTER' ? onRequester : onWorker;
    const deliver = async () => {
      if (!isCurrent()) return;
      try { await callback({ isCurrent }); }
      catch { if (isCurrent()) setSelectionError('Izbor trenutno nije sačuvan. Pokušajte ponovo.'); }
      finally {
        if (generation.current === id) {
          pending.current = null;
          setSelected(null);
        }
      }
    };
    // Artwork never delays the real intent write. Press supplies the shared
    // tactile response and honors the system's reduced-motion preference.
    void deliver();
  };
  const cancelChoice = () => {
    if (busy) return;
    generation.current += 1;
    pending.current = null;
    setSelected(null);
  };
  const openAuth = (callback?: () => void) => {
    if (!callback || !available || pending.current || sesijaSada().accountRevision !== account || sesijaSada().user) return;
    callback();
  };

  // Artwork tiles remain separate actions and fit narrow Android screens; at
  // large font sizes the ScrollView grows instead of clipping the copy.
  const gutter = width < 350 ? 16 : 20;
  const cardPadding = width < 350 ? 16 : 20;
  const artGap = width < 350 ? 12 : 20;
  const artSize = Math.min(140, Math.max(80, (width - 2 * gutter - 2 * cardPadding - artGap) / 2));
  const logoWidth = Math.min(285, Math.max(0, width - 2 * gutter - 2 * cardPadding));

  // Insets belong to the viewport: content padding alone scrolls away and lets
  // the card draw beneath Android's status bar. Keep the initial spacing unchanged.
  return <View testID="entry-welcome" onLayout={onLayout} style={[styles.root, { paddingTop: safeTop, paddingBottom: safeBottom }]}>
    <ScrollView testID="entry-scroll" style={styles.viewport} scrollEnabled={!selected} bounces={false}
      accessibilityElementsHidden={!!selected} importantForAccessibility={selected ? 'no-hide-descendants' : 'auto'}
      contentContainerStyle={[styles.content, { paddingHorizontal: gutter,
        paddingTop: Math.max(24, safeTop + (height < 700 ? 12 : 36)) - safeTop, paddingBottom: 24 }]}>
      <Animated.View testID="entry-card" style={[styles.card, { padding: cardPadding, opacity: enterAnim, transform: [{ translateY: enterAnim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
        <View testID="entry-logo" style={{ alignSelf: 'center', marginBottom: 12 }}>
          <BrandLockup width={Math.min(220, logoWidth)} />
        </View>
        <T testID="entry-title" style={[styles.title, width < 350 && styles.narrowTitle]}>Za svaki zadatak,{`\n`}prava osoba.</T>
        <T style={styles.description}>Objavite šta Vam treba ili uskočite svojim vremenom i znanjem.</T>
        <View style={[styles.choices, { gap: artGap }]}>
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Press testID="entry-requester" accessibilityRole="button" accessibilityLabel="Objavite zadatak"
              accessibilityHint="Pripremite objavljivanje zadatka. Isti nalog može i da se prijavljuje na zadatke."
              accessibilityState={{ disabled: !available, busy: selected === 'REQUESTER' }}
              disabled={!available} haptic={available ? 'select' : 'none'} scaleTo={sys.motion.scale.button}
              onPress={() => choose('REQUESTER')} style={[styles.choice, { width: artSize }]}>
              <Image testID="entry-art-publish" source={publish} contentFit="contain" transition={0}
                style={{ width: artSize, height: artSize }} accessible={false} onLoad={() => acknowledgeImage('publish')} />
              <T style={styles.choiceLabel}>Objavite zadatak</T>
            </Press>
          </Animated.View>
          <Press testID="entry-worker" accessibilityRole="button" accessibilityLabel="Uskočite i zaradite"
            accessibilityHint="Pronađite zadatke koji Vam odgovaraju. Isti nalog može i da objavljuje zadatke."
            accessibilityState={{ disabled: !available, busy: selected === 'WORKER' }}
            disabled={!available} haptic={available ? 'select' : 'none'} scaleTo={sys.motion.scale.button}
            onPress={() => choose('WORKER')} style={[styles.choice, { width: artSize }]}>
            <Image testID="entry-art-discover" source={discover} contentFit="contain" transition={0}
              style={{ width: artSize, height: artSize }} accessible={false} onLoad={() => acknowledgeImage('discover')} />
            <T style={styles.choiceLabel}>Uskočite i zaradite</T>
          </Press>
        </View>
      </Animated.View>
      <Animated.View testID="entry-auth-footer" style={[styles.authFooter, { opacity: enterAnim }]}>
        <Press accessibilityRole="button" accessibilityLabel={authCopy.signIn} disabled={!available}
          accessibilityState={{ disabled: !available }} haptic={available ? 'select' : 'none'}
          scaleTo={sys.motion.scale.button} onPress={() => openAuth(onSignIn)} style={styles.signIn}>
          <T style={styles.signInText}>{authCopy.signIn}</T>
        </Press>
        {onSignUp ? <Press accessibilityRole="button" accessibilityLabel={authCopy.signUp} disabled={!available}
          accessibilityState={{ disabled: !available }} haptic={available ? 'select' : 'none'}
          scaleTo={sys.motion.scale.button} onPress={() => openAuth(onSignUp)} style={styles.signUp}>
          <T style={styles.signUpText}>{authCopy.signUp}</T>
        </Press> : null}
        {(error || selectionError) ? <T accessibilityRole="alert" style={styles.error}>{error || selectionError}</T> : null}
        <View style={styles.footnote}>
          <T style={styles.footnoteText}>Jedan nalog za obe uloge</T>
        </View>
      </Animated.View>
    </ScrollView>
    {selected ? <View testID="entry-preparing" style={styles.preparingCover}
      accessibilityViewIsModal importantForAccessibility="yes">
      <View style={styles.preparingCard}>
        <View accessible accessibilityRole="progressbar" accessibilityLabel="Pripremamo izbor"
          accessibilityState={{ busy: true }} accessibilityLiveRegion="polite" style={styles.preparingStatus}>
          {!reducedMotion ? <ActivityIndicator accessible={false} color={sys.color.green} size="small" /> : null}
          <T style={styles.preparingText}>{selected === 'REQUESTER' ? 'Pripremamo objavu…' : 'Pripremamo zadatke…'}</T>
        </View>
        {!busy ? <Press accessibilityRole="button" accessibilityLabel="Otkaži izbor" scaleTo={1}
          onPress={cancelChoice} style={styles.cancel}>
          <T style={styles.cancelText}>Otkaži</T>
        </Press> : null}
      </View>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: sys.color.wash },
  viewport: { flex: 1, overflow: 'hidden' },
  content: { flexGrow: 1, alignItems: 'stretch', gap: 20 },
  card: { ...profileLift, backgroundColor: sys.color.surface, borderRadius: 24, gap: 16 },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.9,
    color: sys.color.ink, includeFontPadding: false },
  narrowTitle: { fontSize: 28, lineHeight: 34 },
  description: { fontSize: 15, lineHeight: 22, color: sys.color.muted, includeFontPadding: false },
  choices: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center' },
  choice: { alignItems: 'center', justifyContent: 'flex-start', minHeight: 48, gap: 4 },
  choiceLabel: { fontSize: 14, lineHeight: 20, fontWeight: '600', textAlign: 'center',
    color: sys.color.ink, includeFontPadding: false },
  authFooter: { gap: 12 },
  signIn: { minHeight: 54, borderRadius: 16, backgroundColor: sys.color.green,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  signInText: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: sys.color.onGreen },
  signUp: { ...profileLift, minHeight: 54, borderRadius: 16, backgroundColor: sys.color.surface,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  signUpText: { fontSize: 16, lineHeight: 22, fontWeight: '700', color: sys.color.ink },
  footnote: { alignItems: 'center', gap: 2, marginTop: 4 },
  footnoteText: { fontSize: 13, lineHeight: 18, color: sys.color.muted, textAlign: 'center' },
  error: { color: sys.color.danger, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  preparingCover: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(23, 34, 29, 0.24)',
    alignItems: 'center', justifyContent: 'center', padding: 24 },
  preparingCard: { ...profileLift, backgroundColor: sys.color.surface, borderRadius: 20,
    padding: 24, width: '100%', maxWidth: 320, alignItems: 'center', gap: 20 },
  preparingStatus: { alignItems: 'center', gap: 12 },
  preparingText: { color: sys.color.ink, fontSize: 16, lineHeight: 23, fontWeight: '600', textAlign: 'center' },
  cancel: { minWidth: 96, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: sys.color.green, fontSize: 15, lineHeight: 22, fontWeight: '600' },
});
