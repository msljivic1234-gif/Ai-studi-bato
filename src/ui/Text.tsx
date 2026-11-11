import { Text as RNText, type TextProps } from 'react-native';
import { withInter } from './interFont';
import { loadInterWeb } from './loadInterWeb';
import { sys } from './system/tokens';

loadInterWeb();

const typeScale = sys.type;
type Variant = keyof typeof typeScale;
type Tone = 'ink' | 'muted' | 'onDark' | 'orange' | 'onOrange' | 'onGreen' | 'green' | 'danger' | 'success' | 'info' | 'warn' | 'violet';

/**
 * Text shares the system palette. A tone carries purpose without inventing a state:
 * success requires actual confirmation, while green can simply identify a brand command.
 * Orange text uses the contrast-safe ink; filled orange uses dark onOrange labels.
 * Callers still communicate status in words and choose a contrast-safe material.
 */
const tones: Record<Tone, string> = {
  ink: sys.color.ink,
  muted: sys.color.muted,
  onDark: sys.color.onDark,
  orange: sys.color.orangeInk,
  onOrange: sys.color.onOrange,
  onGreen: sys.color.onGreen,
  green: sys.color.green,
  danger: sys.color.danger,
  success: sys.color.success,
  info: sys.color.info,
  warn: sys.color.warn,
  violet: sys.color.violet,
};

type Props = TextProps & {
  variant?: Variant;
  tone?: Tone;
  /** Za naslove — sprečava usamljenu reč u poslednjem redu. */
  balance?: boolean;
};

/**
 * Shared readable type defaults. Explicit style overrides remain possible for
 * a reviewed composition; callers must preserve readable text and system scaling.
 */
export function T({ variant = 'body', tone = 'ink', balance, style, ...rest }: Props) {
  return (
    <RNText
      {...rest}
      style={withInter([
        typeScale[variant],
        { color: tones[tone] },
        balance ? { textAlign: 'left' } : null,
        style,
      ])}
    />
  );
}
