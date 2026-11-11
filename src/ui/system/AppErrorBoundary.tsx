import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, type ErrorBoundaryProps } from 'expo-router';
import { BrandMark } from '../entry/BrandAssets';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { brandAction, sys } from './tokens';

/**
 * What a person sees when a screen throws while rendering, instead of a white page (release, 2026-09-23).
 *
 * It is exported as `ErrorBoundary` from the root layout, so Expo Router wraps every route with it. It says
 * one true thing — this screen did not open — and offers the two ways out that always exist: draw it again,
 * or go back to the start. It never shows the raw error to the person and never claims that anything was or
 * was not saved; the error goes to the log, where a development build shows it.
 */
export function AppErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  if (__DEV__) console.error('[USKOČI] Screen failed to render', error);
  const home = () => {
    try { router.replace('/'); } catch { /* navigation itself is what failed; drawing again is the way out */ }
    void retry();
  };
  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    <View style={s.body}>
      <View accessible accessibilityRole="image" accessibilityLabel="USKOČI"><BrandMark size={56} /></View>
      <T accessibilityRole="header" variant="title" style={s.title}>Ovaj ekran se nije otvorio</T>
      <T variant="body" tone="muted" style={s.center}>Pokušajte ponovo. Ako se ponovi, vratite se na početak aplikacije.</T>
    </View>
    <View style={s.actions}>
      <V2Action label="Pokušajte ponovo" kind="primary" onPress={() => { void retry(); }} style={brandAction} />
      <V2Action label="Na početak" kind="quiet" onPress={home} />
    </View>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.surface, paddingHorizontal: 24 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  title: { textAlign: 'center', color: sys.color.ink }, center: { textAlign: 'center' },
  actions: { gap: 8, paddingBottom: 16 },
});
