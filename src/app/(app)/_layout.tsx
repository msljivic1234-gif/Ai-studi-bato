import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TAB_BAR_PADDING, TAB_CAPSULE, TAB_ITEM_BOTTOM, TAB_ITEM_PADDING, TAB_ITEM_TOP, TabCapsule, TabGlyph, TabLabel, tabBarHeight, tabBarSurface } from '../../ui/system/TabBarItem';
import { useTextScale } from '../../ui/system/textScale';
import { PorukaHost } from '../../ui/system/Poruka';
import { useSystemReducedMotion } from '../../hooks/useSystemReducedMotion';
import { sys } from '../../ui/system/tokens';
import { Press } from '../../ui/Press';
import { conversationInboxBuilt } from '../../data/conversationInboxGate';
import { ZadaciBarContext, zadaciBarStyle } from '../../ui/v2/discovery/zadaciBar';
import { ZadaciNavigationBar } from '../../ui/v2/discovery/ZadaciNavigationBar';

/**
 * One shell for one account: Početna | Zadaci | Dogovori | Poruke (inbox paired with its DEV reader).
 * The original owner decision 1, 2026-09-19,
 * supersedes the two intent-shaped shells of 2026-09-16; the middle tab is Zadaci since the owner's
 * information architecture of 2026-09-23, which retired the Mapa tab and the duplicate `/prilike` root).
 * The same person may own tasks, have applied to other people's and hold Dogovori on both sides at once,
 * so what they are to a thing is said on that thing and never chosen for the whole app. There is no mode
 * here to read, and nothing keys the navigator: `Tabs key={intent}` used to remount every screen beneath
 * it on a switch. My own tasks and my applications keep their routes and their screens; they are reached
 * from Početna. `/mapa` and `/prilike` stay registered as redirects to Zadaci for old links.
 */
/**
 * Around thirty screens live in this navigator with `href: null` — the whole profile family, the
 * review, the location and photo steps, support. They are pushed, not switched to, and with the
 * navigator's `animation: 'none'` not one of them moved: the screen was simply replaced, which is
 * why walking through the app felt like redrawing rather than going somewhere. Switching between
 * the root tabs stays instant, which is what the tab contract records and what a tab bar is for.
 *
 * A screen that is pushed ENTERS, so the spec gives it `sys.motion.push` AND the curve every entrance has, `easeOut`
 * (rule R2). A `transitionSpec` replaces the preset's whole config, and a timing with only a duration runs on React Native's
 * own ease-in-out: 3 % of the way after the first tenth of the time, a slow start that reads as lag on the finger.
 */
const PUSH_TRANSITION = { animation: 'shift' as const,
  transitionSpec: { animation: 'timing' as const,
    config: { duration: sys.motion.push, easing: Easing.bezier(...sys.motion.easeOut) } } };

// The bar's selection well, familiar control symbols, scalable labels and measured height live in
// `ui/system/TabBarItem`. Selection uses native-driver opacity/scale with Reduce Motion and cleanup.
// Root destinations switch immediately; navigation technology is not a visual restriction.
//
// Početna has its own house so the clipboard no longer sat next to a tab called Zadaci; Zadaci keeps the map it had.
const PRIMARY = { index: 'home', zadaci: 'map', dogovori: 'agreements', poruke: 'chat' } as const;
const PRIMARY_LABEL = { index: 'Početna', zadaci: 'Zadaci', dogovori: 'Dogovori', poruke: 'Poruke' } as const;
// At enlarged text, longer Serbian names earn more width instead of breaking in the middle of a word.
const LABEL_SPACE = { index: 7.5, zadaci: 6.25, dogovori: 8.5, poruke: 6.5 } as const;
type Primary = keyof typeof PRIMARY;
function isPrimary(name: string): name is Primary { return Object.hasOwn(PRIMARY, name); }
function sectionOf(state: { index: number; routes: readonly { name: string; key: string }[];
  history?: readonly { type: string; key?: string }[] }): Primary {
  const current = state.routes[state.index]?.name ?? 'index';
  if (isPrimary(current)) return current;
  // Read the navigator's actual history, so Back and different entry points stay consistent.
  // This affects presentation only: a highlighted parent still dispatches its original tab action.
  for (const entry of [...(state.history ?? [])].reverse()) {
    const name = entry.type === 'route' ? state.routes.find(route => route.key === entry.key)?.name : undefined;
    if (name && isPrimary(name)) return name;
  }
  // A task and its application belong to Zadaci, and so do the two retired discovery addresses while they redirect.
  return current === 'prilike' || current.startsWith('prilike/') || current === 'mapa' ? 'zadaci'
    : current === 'oceni-dogovor' ? 'dogovori' : 'index';
}

/**
 * `/mapa` and `/prilike` only redirect to Zadaci (and `/moje-aktivnosti` to Početna). Inside a tab navigator a redirect is a jump, and with
 * `backBehavior="history"` the jump left the retired route in the history: Back from Zadaci returned to it, it
 * redirected again, and Back could never leave Zadaci (proved on the real router, retired-discovery-routes.test).
 * A retired route therefore stays in the history only while it is the route on screen. Navigation state only; no
 * screen, read or guard is involved.
 */
const RETIRED = new Set(['mapa', 'prilike', 'moje-aktivnosti']);
type TabHistory = { index: number; routes: readonly { name: string; key?: string; params?: Record<string, unknown> }[];
  history?: readonly { type: string; key?: string }[] };
function withoutRetired<State>(state: State): State {
  const tabs = state as unknown as TabHistory | null;
  if (!tabs || !Array.isArray(tabs.history) || !Array.isArray(tabs.routes)) return state;
  const current = tabs.routes[tabs.index]?.key;
  const history = tabs.history.filter(entry => entry.type !== 'route' || entry.key === current
    || !RETIRED.has(tabs.routes.find(route => route.key === entry.key)?.name ?? ''));
  return history.length === tabs.history.length ? state : { ...tabs, history } as unknown as State;
}

/**
 * This tab router's own REPLACE drops the history entry at the position of the new route's index in `routes`, not the
 * entry of the route being left, so what vanished depended on where two screens happen to be registered. Zadaci is
 * second in that list, so a replace onto Zadaci dropped Početna (the sign-in shortcut "Uskoči i zaradi" lands on
 * Početna and is replaced with Zadaci, src/app/_layout.tsx, and Back from Zadaci then left the app); a sent application
 * replaced by Moje prijave kept its sent form in the history and lost Moje prijave itself; Raspored and Moji zadaci
 * opened cold stayed behind the screen that replaced them. Every REPLACE is therefore taken as the jump it is, and the
 * route being left is then dropped, as a replace means — except Početna, which stays behind what replaced it so Back
 * returns home (proved on the real router with every route registered, retired-discovery-routes.test). Navigation
 * state only; no screen, read or guard is involved.
 */
function replacedAsJump(action: { type: string }): boolean {
  return action.type === 'REPLACE';
}
/**
 * A flow's last step takes the flow with it. The review before publishing (`pregled-zadatka`) is pushed over the AI
 * conversation (`nova`), and it leaves by a replace: onto the task it just published ("Otvori zadatak"), onto Moji
 * zadaci after a saved draft, or back into the conversation to change something. In the first two the new task is done,
 * so the conversation leaves the history with the review, and Back from the task (or from Moji zadaci) returns to where
 * the person started the task (Početna, Zadaci, Moji zadaci), never into a finished conversation or its review. A replace
 * back into the conversation keeps it: it is the screen on show. Navigation state only; no screen, read or guard is
 * involved (retired-discovery-routes.test).
 */
const FLOW_BEHIND: Readonly<Record<string, readonly string[]>> = { 'pregled-zadatka': ['nova'] };
function withoutLeft<State>(state: State, left: { name: string; key?: string } | undefined): State {
  const tabs = state as unknown as TabHistory | null;
  if (!tabs || !left?.key || left.name === 'index' || !Array.isArray(tabs.history) || tabs.routes[tabs.index]?.key === left.key) return state;
  const shown = tabs.routes[tabs.index]?.key;
  const flow = new Set(FLOW_BEHIND[left.name] ?? []);
  const leaves = (key: string | undefined) => key === left.key
    || (key !== shown && flow.has(tabs.routes.find(route => route.key === key)?.name ?? ''));
  const history = tabs.history.filter(entry => entry.type !== 'route' || !leaves(entry.key));
  return history.length === tabs.history.length ? state : { ...tabs, history } as unknown as State;
}
/** A completed publication is a new root visit to Zadaci. Its one Back destination is Početna,
 * even if the person had visited several tabs before starting the AI conversation. */
function publicationLanding<State>(state: State, left: { name: string; key?: string } | undefined): State {
  const tabs = state as unknown as TabHistory | null;
  if (!tabs || left?.name !== 'pregled-zadatka' || !Array.isArray(tabs.history)) return state;
  const shown = tabs.routes[tabs.index], home = tabs.routes.find(route => route.name === 'index');
  if (shown?.name !== 'zadaci' || !home?.key || !shown.key
    || typeof shown.params?.publishedNeedId !== 'string'
    || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(shown.params.publishedNeedId)) return state;
  return { ...tabs, history: [{ type: 'route', key: home.key }, { type: 'route', key: shown.key }] } as unknown as State;
}

/**
 * A full screen has no tab bar (owner decision, 2026-09-18). The conversation, the review before
 * publishing and the map point are one task each with one way out, the back arrow. Leaving the tab
 * bar under them made a tap anywhere along the bottom edge an exit from an unfinished Zadatak, and
 * it was not even honest about where you were: the screens are pushed, so no tab was current.
 */
// A screen that carries its own bottom action does not also carry the navigator's bar. On a phone
// the public Task stacked the two: an orange "Otvori svoj zadatak" and then Početna│Mapa│Dogovori
// underneath it, together eating about 180dp, and the description was cut mid-sentence between
// them. The owner's 2026-09-18 decision named four screens for this — the ones where a tap along
// the bottom edge abandoned an unfinished Zadatak. The four spine details added on 2026-09-20 are
// the same shape: each ends in one sticky action, and none of them is a tab, so no tab was ever
// current while they were open.
export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const fontScale = useTextScale();
  const { width } = useWindowDimensions();
  const roomyLabels = fontScale >= 1.3 || width < 340;
  const measureKey = `${width}:${fontScale}`;
  const currentMeasureKey = useRef(measureKey); currentMeasureKey.current = measureKey;
  const [labelMetrics, setLabelMetrics] = useState<{ key: string; heights: Partial<Record<Primary, number>> }>({ key: '', heights: {} });
  const labelHeight = Math.max(sys.type.navLabel.lineHeight * fontScale,
    ...(labelMetrics.key === measureKey ? Object.values(labelMetrics.heights) : []));
  const rememberLabelHeight = (name: string, height: number) => {
    if (!isPrimary(name) || currentMeasureKey.current !== measureKey || !Number.isFinite(height) || height <= 0) return;
    const measured = Math.ceil(height);
    setLabelMetrics(current => {
      if (current.key === measureKey && current.heights[name] === measured) return current;
      return { key: measureKey, heights: { ...(current.key === measureKey ? current.heights : {}), [name]: measured } };
    });
  };
  const reducedMotion = useSystemReducedMotion();
  const PUSHED = reducedMotion ? { animation: 'none' as const } : PUSH_TRANSITION;
  const FULL = { ...PUSHED, tabBarStyle: { display: 'none' as const } };
  const REDIRECT = { ...FULL, animation: 'none' as const };
  // Discovery keeps the bar above ordinary map/list browsing, including FULL lists, and clears it for a selected pin
  // so the preview can sit by the safe bottom edge. Its measured height keeps ordinary cards and list ends unobscured.
  // The same motion host handles hiding and restoring the bar without changing the selected map/list state.
  const barBase = useMemo(() => ({ ...tabBarSurface, height: tabBarHeight(labelHeight, TAB_BAR_PADDING), marginHorizontal: 12, marginTop: 0,
    marginBottom: Math.max(12, insets.bottom) }), [labelHeight, insets.bottom]);
  const awayValue = useRef(new Animated.Value(0)).current;
  const [zadaciVisible, setZadaciVisible] = useState(false);
  const zadaciBar = useMemo(() => ({ hidden: awayValue, height: barBase.height + barBase.marginBottom, setVisible: setZadaciVisible }), [awayValue, barBase.height, barBase.marginBottom]);
  // Static inner geometry; a separate, stable host owns Discovery's translation and settled native visibility.
  const zadaciStyle = useMemo(() => ({ ...zadaciBarStyle(barBase, zadaciBar), height: barBase.height,
    bottom: barBase.marginBottom, paddingBottom: TAB_BAR_PADDING }), [barBase, zadaciBar]);
  // Where the bar's top edge is, measured from the window's bottom: the one "Poruka" (the short outcome bar) floats above it
  // on every screen of this navigator, so it never covers the bar and, where the bar is hidden, clears a flow's own footer.
  const barClearance = tabBarHeight(labelHeight, TAB_BAR_PADDING) + Math.max(12, insets.bottom);
  return <><ZadaciBarContext.Provider value={zadaciBar}><Tabs initialRouteName="index" backBehavior="history" safeAreaInsets={{ bottom: 0 }}
    tabBar={props => <ZadaciNavigationBar {...props} bar={zadaciBar} visible={zadaciVisible} />}
    UNSTABLE_router={original => ({
      // Every replace is taken as a jump that leaves the screen it replaces (see `replacedAsJump`), and a retired entry
      // never stays in the history.
      getStateForAction: (state, action, options) => withoutRetired(replacedAsJump(action)
        ? publicationLanding(withoutLeft(original.getStateForAction(state, { ...action, type: 'JUMP_TO' }, options), state.routes[state.index]), state.routes[state.index])
        : original.getStateForAction(state, action, options)),
      getStateForRouteFocus: (state, key) => withoutRetired(original.getStateForRouteFocus(state, key)) })}
    // The bottom bar is for the four ROOT screens only (owner's master directive, 2026-09-23): a detail, a flow, a
    // conversation and a setting are "in this job", not in the main menu, so they hide it (FULL). `profil/razgovor` was
    // the last exception until its composer had a keyboard-aware inset of its own; the AI conversation shell gives it one
    // now (round 4 review ra), so it hides the bar like every other conversation. (`prilike`, the root-like copy of Mapa
    // that was the other exception, is a redirect to Zadaci now.)
    // Around thirty screens are registered here with `href: null` — the whole profile family, the
    // review, the location and photo steps, support. With `animation: 'none'` not one of them had a
    // push transition: they replaced each other instantly, which is why moving through the app felt
    // like redrawing rather than going somewhere. Switching between the four tabs stays instant,
    // which is what a tab bar is for; only pushes move.
    screenOptions={({ route, navigation }) => {
      const selected = sectionOf(navigation.getState()) === route.name;
      const renderLabel = ({ children }: { children: ReactNode }) => <TabLabel key={measureKey} selected={selected}
        onTextLayout={({ nativeEvent }) => rememberLabelHeight(route.name,
          Math.max(0, ...nativeEvent.lines.map(line => line.y + line.height)))}>{children}</TabLabel>;
      return { headerShown: false, animation: 'none', sceneStyle: { backgroundColor: sys.color.ground },
      tabBarActiveTintColor: sys.navigation.foreground, tabBarInactiveTintColor: sys.navigation.muted, tabBarAllowFontScaling: true,
      tabBarLabelPosition: 'below-icon',
      tabBarLabel: renderLabel,
      // The button draws one control symbol and measured label. Skip the navigator's two focus-icon layers;
      // selection follows the originating SECTION even when a hidden detail has focus.
      tabBarIcon: () => null,
      // The capsule is the button's own, always-mounted child. Navigation stays silent (owner U10), including cancelled
      // touches and taps on the current tab. The button does not scale: a plain Pressable saves one Reanimated view per tab (B22).
      tabBarButton: ({ children, style, onPress, onLongPress, testID, 'aria-label': label }) =>
        <Press accessibilityRole="tab" accessibilityLabel={label ?? (isPrimary(route.name) ? PRIMARY_LABEL[route.name] : undefined)} accessibilityState={{ selected }}
          onPress={onPress} onLongPress={onLongPress} testID={testID} haptic="none" scaleTo={1} hitSlop={0}
          style={[style, { paddingHorizontal: roomyLabels ? 0 : TAB_ITEM_PADDING, paddingTop: TAB_ITEM_TOP, paddingBottom: TAB_ITEM_BOTTOM,
            borderRadius: TAB_CAPSULE, flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }]}>
          <TabCapsule selected={selected} radius={TAB_CAPSULE} />
          {isPrimary(route.name) && <TabGlyph kind={PRIMARY[route.name]} selected={selected} />}
          {isPrimary(route.name) ? renderLabel({ children: PRIMARY_LABEL[route.name] }) : children}
        </Press>,
      tabBarItemStyle: { borderRadius: TAB_CAPSULE, overflow: 'hidden',
        flex: roomyLabels && isPrimary(route.name) ? LABEL_SPACE[route.name] : 1 },
      // The height follows the icon and the actual label height (`tabBarHeight`); no font shrinking or truncation.
      tabBarStyle: route.name === 'zadaci' ? zadaciStyle : barBase }; }}>
    <Tabs.Screen name="index" options={{ title: PRIMARY_LABEL.index, tabBarAccessibilityLabel: PRIMARY_LABEL.index }} />
    <Tabs.Screen name="zadaci" options={{ title: PRIMARY_LABEL.zadaci, tabBarAccessibilityLabel: PRIMARY_LABEL.zadaci }} />
    <Tabs.Screen name="potrebe" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="nova" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="moje-prijave" options={{ href: null, ...FULL }} />
    {/* Retired (2026-09-23) and a redirect to Početna since 2026-09-24, registered like the two below. */}
    <Tabs.Screen name="moje-aktivnosti" options={{ href: null, ...REDIRECT }} />
    {/* Redirects to Zadaci: they never move and never show the bar for the frame before they hand over. */}
    <Tabs.Screen name="prilike" options={{ href: null, ...REDIRECT }} />
    <Tabs.Screen name="mapa" options={{ href: null, ...REDIRECT }} />
    <Tabs.Screen name="dogovori" options={{ title: PRIMARY_LABEL.dogovori, tabBarAccessibilityLabel: PRIMARY_LABEL.dogovori }} />
    <Tabs.Screen name="poruke" options={{ title: PRIMARY_LABEL.poruke, tabBarAccessibilityLabel: PRIMARY_LABEL.poruke, ...(conversationInboxBuilt() ? {} : { href: null, ...FULL }) }} />
    <Tabs.Screen name="profil" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/podesavanja" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="ai-istorija/index" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="ai-istorija/[conversationId]" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/radnik" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/razgovor" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/usluga-iz-prijave" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/podaci" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/fotografija" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/blokirani" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/pravna" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/o-aplikaciji" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/lozinka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/prijava-greske" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="bezbednost" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="podrska/index" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="podrska/novi" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="podrska/[id]" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="podrska/operator" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/lokacija" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/dostupnost" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/izvoz" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/privatnost" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/obavestenja" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="profil/ocene" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="raspored" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="arhiva" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="mesto-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="pregled-nacrta" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="pregled-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="fotografije-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="pitanja-zadatka" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="oceni-dogovor" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="potrebe/[id]/kandidati" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="potrebe/[id]/pregled" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="prilike/[id]" options={{ href: null, ...FULL }} />
    <Tabs.Screen name="prilike/[id]/prijava" options={{ href: null, ...FULL }} />
  </Tabs></ZadaciBarContext.Provider>
  {/* The host of the outcome bar for every screen of this navigator: screens call `poruka.show(...)` and render nothing, and it
      idles as nothing. The root stack's own screens (`dogovor/[id]`, `obavestenja`, `prijave`) lie ABOVE this navigator and
      cover it, so each of them mounts a host of its own. */}
  <PorukaHost clearance={barClearance} /></>;
}
