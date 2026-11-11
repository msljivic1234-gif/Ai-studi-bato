import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';

/**
 * The app's letters are Inter (owner decision 2026-09-22: the V28/V31 prototype, "identično"). The
 * prototype asked for Inter but never loaded it, so it drew in whatever the machine had: Segoe UI on
 * the owner's PC, Roboto on Android, SF on iPhone. Bundling it is what makes the words look the same
 * on every phone.
 *
 * One file per weight, named by its PostScript name, and the weight is chosen by the file rather
 * than by `fontWeight`. A single-face family asked for 700 is emboldened a second time on Android
 * and in the browser, and iOS resolves an explicit weight back to the family's regular face, so the
 * weight key is removed once it has picked the file.
 *
 * Files: `assets/fonts/inter/` (Inter 4.001, SIL OFL 1.1, licence beside them), embedded natively by
 * the expo-font config plugin in `app.json` and loaded at runtime on web only.
 */
export const INTER_FACES = {
  400: 'Inter-Regular',
  500: 'Inter-Medium',
  600: 'Inter-SemiBold',
  700: 'Inter-Bold',
  800: 'Inter-ExtraBold',
} as const;

export type InterFace = (typeof INTER_FACES)[keyof typeof INTER_FACES];

/** The bundled face nearest to a React Native weight. There is no Inter lighter than 400 or heavier than 800 here. */
export function interFace(weight: TextStyle['fontWeight']): InterFace {
  const numeric = weight === 'bold' ? 700 : weight === 'normal' || weight === undefined ? 400 : Number(weight);
  if (!Number.isFinite(numeric) || numeric < 450) return INTER_FACES[400];
  if (numeric < 550) return INTER_FACES[500];
  if (numeric < 650) return INTER_FACES[600];
  if (numeric < 750) return INTER_FACES[700];
  return INTER_FACES[800];
}

/**
 * The style a Text should really receive. A caller that names its own family (the locked entry's
 * rounded display face) keeps it untouched; everything else is drawn in the Inter face its weight asks for.
 */
export function withInter(style: StyleProp<TextStyle>): TextStyle {
  const flat = StyleSheet.flatten(style) ?? {};
  if (flat.fontFamily) return flat;
  const { fontWeight, ...rest } = flat;
  return { ...rest, fontFamily: interFace(fontWeight) };
}
