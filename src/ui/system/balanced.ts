import { Platform, type TextStyle } from 'react-native';

/**
 * Balanced lines (UI/UX pass 2026-10-08, F8b): a centred title or sentence that takes two lines is two lines of about one length, not a
 * long one and a lonely word ("Nema zadataka u ovom / prikazu"). The states, the strip of "Nema veze" and the note of an unknown outcome
 * all centre or wrap short texts, so the three share this one way of asking for it.
 *
 * `BALANCED_LINES` is Android's own break strategy, a prop of the text (iOS ignores it). `balancedStyle` is the CSS one, for the web design lab,
 * which is not Android: it is what makes a screenshot taken there say what the phone is asked for. How the phone breaks the lines is not known
 * until it is seen on the phone.
 */
export const BALANCED_LINES = { textBreakStrategy: 'balanced' } as const;

export const balancedStyle: TextStyle | undefined = Platform.OS === 'web' ? ({ textWrap: 'balance' } as unknown as TextStyle) : undefined;
