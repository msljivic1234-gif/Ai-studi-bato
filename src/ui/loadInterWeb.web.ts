import { loadAsync } from 'expo-font';
import { INTER_FACES } from './interFont';

const sources: Record<(typeof INTER_FACES)[keyof typeof INTER_FACES], number> = {
  'Inter-Regular': require('../../assets/fonts/inter/Inter-Regular.ttf'),
  'Inter-Medium': require('../../assets/fonts/inter/Inter-Medium.ttf'),
  'Inter-SemiBold': require('../../assets/fonts/inter/Inter-SemiBold.ttf'),
  'Inter-Bold': require('../../assets/fonts/inter/Inter-Bold.ttf'),
  'Inter-ExtraBold': require('../../assets/fonts/inter/Inter-ExtraBold.ttf'),
};

let started = false;

/** The browser has no embedded fonts, so each face is registered once, under the same name the native build uses. */
export function loadInterWeb(): void {
  if (started || typeof document === 'undefined') return;
  started = true;
  void loadAsync(sources).catch(() => {});
}
