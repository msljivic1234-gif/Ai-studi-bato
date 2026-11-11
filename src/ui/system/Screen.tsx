import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent,
  type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { layout } from './layout';
import { sys } from './tokens';

export type ScreenKind = 'root' | 'detail' | 'flow';

export type ScreenProps = {
  /** `root`: a tab (the tab bar already covers the bottom edge). `detail`: a thing opened from somewhere. `flow`: one job with one way out. */
  kind: ScreenKind;
  /** The bar: a `ScreenChrome`, `DetailTopBar` or `ProductHeader` element. The screen places it; it does not draw it. */
  header?: ReactNode;
  /** The foot, usually a `FlowFooter` with the one green action. It stands below the scroll, inside the keyboard avoidance. */
  footer?: ReactNode;
  /** The content scrolls (the default). `false`: it is a plain column that fills the room. */
  scroll?: boolean;
  /** The foot rises with the keyboard. On for a `flow` and off for the others, unless said. */
  keyboardAvoiding?: boolean;
  children: ReactNode;
  testID?: string;
  /** A recessed canvas makes individual white cards legible without changing other screens. */
  background?: 'ground' | 'wash';
  /** Only in an exception. The measure of a screen is its edge, its top and its gap, and they are not this. */
  contentStyle?: StyleProp<ViewStyle>;
  /** For `useChromeTitleOnScroll`: the bar says the name once the large title has scrolled away. */
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  /** Actual scroll viewport, for visibility-driven decoration without guessed header/inset heights. */
  onViewportLayout?: ScrollViewProps['onLayout'];
  /** A `RefreshControl` for pull to refresh. */
  refreshControl?: ScrollViewProps['refreshControl'];
};

/** Only the edges the screen itself is the last thing before: a tab has the tab bar under it, a thing opened or a flow has the system's bottom. */
const EDGES: Record<ScreenKind, readonly Edge[]> = {
  root: ['top', 'left', 'right'],
  detail: ['top', 'bottom', 'left', 'right'],
  flow: ['top', 'bottom', 'left', 'right'],
};

/**
 * The frame of every screen (composition spec 2026-10-07, N1). Twenty screens wrote their own `content: {}`: the edge was 16,
 * 20, 22 or 24, the top 8 or 16 or 0, the gap between blocks 12 to 28, and the foot 12 or 14 or 20 from the dark. Here the
 * edge is `layout.gutter` (20), the first thing is 8 below the bar, the blocks stand `layout.section` (24) apart, and the end
 * of the scroll is 32 from the last thing (24 above a foot). On a tablet the content is a column of at most `layout.maxWidth`,
 * centred. The screen draws no card and no line: the blocks it holds are `Section`s, rows and records, and the space between
 * them is the only thing that separates them.
 *
 * The bar and the foot are handed in, not drawn: the bar is whichever of the three chromes the screen has, the foot is the
 * `FlowFooter`. With a foot the keyboard raises it (a `flow` does this by default, see `keyboardAvoiding`); the safe area
 * below is the screen's own, so the foot needs no `edge` of its own.
 */
export function Screen({ kind, header, footer, scroll = true, keyboardAvoiding, children, testID, background = 'ground', contentStyle, onScroll, onViewportLayout, refreshControl }: ScreenProps) {
  const lifted = keyboardAvoiding ?? kind === 'flow';
  const content = [s.content, footer ? s.contentAboveFoot : s.contentToEnd, contentStyle];
  const body = scroll
    ? <ScrollView style={s.fill} contentContainerStyle={content} keyboardShouldPersistTaps="handled" onScroll={onScroll} onLayout={onViewportLayout}
      scrollEventThrottle={onScroll ? 16 : undefined} refreshControl={refreshControl}>{children}</ScrollView>
    : <View style={[s.fill, ...content]}>{children}</View>;
  const stage = <>
    {body}
    {footer ? <View style={s.footer}>{footer}</View> : null}
  </>;
  return <SafeAreaView testID={testID} edges={EDGES[kind]} style={[s.screen, { backgroundColor: sys.color[background] }]}>
    {header}
    {lifted ? <KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>{stage}</KeyboardAvoidingView>
      : <View style={s.fill}>{stage}</View>}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  fill: { flex: 1 },
  content: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center', paddingHorizontal: layout.gutter, paddingTop: sys.space.sm, gap: layout.section },
  contentToEnd: { paddingBottom: layout.zone },
  contentAboveFoot: { paddingBottom: layout.section },
  footer: { width: '100%', maxWidth: layout.maxWidth, alignSelf: 'center' },
});
