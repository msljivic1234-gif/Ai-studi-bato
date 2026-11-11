import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { Arrive } from './Arrive';
import { BALANCED_LINES, balancedStyle } from './balanced';
import { ConversationArt } from './ConversationArt';
import { FactArt, type FactArtKind } from './FactArt';
import { SkeletonList, type SkeletonVariant } from './Skeleton';
import { brandAction, sys } from './tokens';

export type StateKind = 'empty' | 'loading' | 'error' | 'offline' | 'uncertain';
export type StateAction = {
  label: string; onPress: () => void; accessibilityLabel?: string;
  /** The action cannot be used now: it greys out. */
  disabled?: boolean;
  /** The screen is already at work on it (a read in flight): the action keeps its colour and shows its spinner, and cannot be pressed twice. */
  busy?: boolean;
};

/** The picture each kind uses when the screen does not name one: its own subject for an empty list, a quiet sign otherwise. */
const DEFAULT_ART: Record<Exclude<StateKind, 'loading'>, FactArtKind> = { empty: 'tasks', error: 'info', offline: 'info', uncertain: 'info' };

/**
 * The pictures that say "confirmed" (a tick): `FACT_TICK_KINDS` in `FactArt`, spelled out here and not imported, because twenty suites stand in for
 * `FactArt` with a bare component and a state must still draw under them (`state-view.test.tsx` holds that the two lists are the same).
 */
const SAYS_CONFIRMED: readonly FactArtKind[] = ['check', 'agreements', 'shield'];

/** The picture of a state at the size of a screen (composition spec, rule C: "art 96 prazno stanje"), and in a section of one. */
const ART = 96;
const ART_COMPACT = 48;
/** Emphasized full-screen artwork. This is an optical default, not a business state. */
const ART_HERO = 144;
/** The measure of the words: the sentence is never wider than this, whatever the screen (T7: "copy ≤ 280 širine"); the actions stand in the same column. */
const MEASURE = 280;

/** Shared state presentation. Material, hierarchy and illustration scale can evolve.
 * The cause of an empty list, unavailable data and an uncertain write remain
 * distinct. Never show confirmed artwork for an error/unknown result. Actions
 * retain their labels, recovery meaning and busy/disabled guards. Loading uses
 * placeholders and a live reading message; its current renderer has no actions. */
export type StateViewProps = {
  kind?: StateKind;
  /** The picture; defaults to the kind's own. Null omits decoration when the surrounding view already provides it. */ art?: FactArtKind | null;
  /** One line. While loading it is the quiet sentence under the placeholders. */ title: string;
  /** One sentence under the title. */ body?: string;
  /** The one way forward, drawn as the screen's green action. */ primary?: StateAction;
  /** A second, quieter way. */ quiet?: StateAction;
  /**
   * While loading: how many placeholders, the lines in each, and which shape is coming (a list of rows says `row`, tasks or Dogovori `record`,
   * the facts of a detail `fact`; the older shapes stay as they were). `face`, `heading`, `switches` and `foot` are what `Skeleton` takes.
   */
  skeleton?: { count?: number; rows?: number; variant?: SkeletonVariant; face?: boolean; heading?: boolean; switches?: boolean; foot?: boolean };
  /** The state is inside a section or a sheet, not the whole screen: a smaller picture and title and no lift. */
  compact?: boolean;
  /** Artwork emphasis for a full-screen state; compact presentation takes priority. */
  hero?: boolean;
  testID?: string;
};

export function StateView({ kind = 'empty', art, title, body, primary, quiet, skeleton, compact = false, hero = false, testID }: StateViewProps) {
  if (kind === 'loading') return <View testID={testID} accessibilityLiveRegion="polite" style={s.loading}>
    <SkeletonList count={skeleton?.count ?? 3} rows={skeleton?.rows} variant={skeleton?.variant} face={skeleton?.face} heading={skeleton?.heading}
      switches={skeleton?.switches} foot={skeleton?.foot} />
    <T variant="note" tone="muted" style={s.sentence}>{title}</T>
  </View>;
  const trouble = kind !== 'empty';
  const size = compact ? ART_COMPACT : hero ? ART_HERO : ART;
  // A failure never wears a picture that says "confirmed"; it falls back to the kind's quiet sign.
  const drawn = art == null || (trouble && SAYS_CONFIRMED.includes(art)) ? DEFAULT_ART[kind] : art;
  const picture = kind === 'empty' && art === 'chat' ? <ConversationArt size={size} />
    : <FactArt kind={drawn} size={size} muted={trouble} />;
  return <View testID={testID} accessibilityLiveRegion="polite" style={[s.frame, compact ? s.frameCompact : s.frameScreen]}>
    {compact ? null : <View style={s.above} />}
    <View style={s.column}>
      {/* An empty list's picture settles in once (V41's art arrive); a failure's does not, because it is not a thing to be glad of. */}
      {art === null ? null : <View style={compact ? s.artCompact : s.art}>{kind === 'empty' ? <Arrive>{picture}</Arrive> : picture}</View>}
      <T variant={compact ? 'heading' : 'title'} accessibilityRole={trouble ? 'alert' : 'header'} {...BALANCED_LINES} style={[s.title, balancedStyle]}>{title}</T>
      {body ? <T variant={compact ? 'note' : 'copy'} tone="muted" {...BALANCED_LINES} style={[s.copy, balancedStyle]}>{body}</T> : null}
      {primary || quiet ? <View style={s.actions}>
        {primary ? <V2Action label={primary.label} accessibilityLabel={primary.accessibilityLabel} onPress={primary.onPress}
          disabled={primary.disabled} loading={primary.busy} style={brandAction} /> : null}
        {quiet ? <V2Action label={quiet.label} accessibilityLabel={quiet.accessibilityLabel} onPress={quiet.onPress}
          disabled={quiet.disabled} loading={quiet.busy} kind="quiet" /> : null}
      </View> : null}
    </View>
    {compact ? null : <View style={s.below} />}
  </View>;
}

const s = StyleSheet.create({
  loading: { gap: sys.space.base },
  sentence: { textAlign: 'center' },
  // The frame fills a room it is given (a `flex: 1` parent) and is only as tall as its block where it is not. A fifth of the free room is
  // `above` and four fifths `below`, and the 48 over the block is the least it ever stands from what is above it.
  frame: { flexGrow: 1, alignItems: 'center' },
  frameScreen: { paddingTop: sys.space.huge, paddingBottom: sys.space.xxl },
  frameCompact: { paddingVertical: sys.space.base },
  above: { flex: 1 },
  below: { flex: 4 },
  column: { width: '100%', maxWidth: MEASURE, alignItems: 'center' },
  art: { marginBottom: sys.space.base },
  artCompact: { marginBottom: sys.space.md },
  title: { textAlign: 'center', color: sys.color.ink },
  copy: { textAlign: 'center', marginTop: sys.space.sm },
  // The actions fill the column: the green one is the same shape as the foot's, and the quiet one under it is as wide, so the touch is wide.
  actions: { alignSelf: 'stretch', marginTop: sys.space.xl, gap: sys.space.sm },
});
