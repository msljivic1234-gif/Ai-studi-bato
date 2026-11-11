import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { ArrowRight, DotsThree } from 'phosphor-react-native';
import { needPriceBasisNote, needPriceText } from '../../data/needDetailPresentation';
import { ActionSheet, type SheetAction } from '../system/ActionSheet';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { brandAction, sys } from '../system/tokens';
import { ChromeIconButton, ScreenChrome, useChromeTitleOnScroll } from '../system/ScreenChrome';
import { T } from '../Text';
import { Press } from '../Press';

/**
 * Visual composition only. All data, permissions and callbacks belong to the caller.
 *
 * `ScreenChrome`'s detail bar, as DetailTopBar is: the arrow, the screen's name when it has one that
 * is not already the content's own title, an optional line under it, one action on the right. A task
 * screen draws the task's name large (`TaskDecisionTitle`, owner 2026-09-23) and hands the same name
 * here with `titleVisible`, so the bar says it only once the large title has scrolled away
 * (`useDetailScrollTitle`). `right` holds the "···" of rare actions (`useDetailMenu`).
 */
export function ProductHeader({ title, subtitle, back, backLabel = 'Nazad', disabled = false, right, titleVisible }: {
  title?: string; subtitle?: string; back: () => void; backLabel?: string; disabled?: boolean; right?: ReactNode; titleVisible?: boolean;
}) {
  return <ScreenChrome variant="detail" title={title} subtitle={subtitle} onBack={back} backLabel={backLabel} disabled={disabled}
    right={right} titleVisible={titleVisible} />;
}

/**
 * The task's name in the bar once its large title has gone (V46 detailChrome; owner step 5b, 2026-09-24). At the owner's
 * large font the title is two or three lines and leaves the screen after a third of it; from there on the map, the
 * questions and the person belonged to no named task. The line is where the large title ENDS, measured, not a guess:
 * the bar says the name exactly when the last line of the title has passed under it. The fade itself is the chrome's
 * (`ScreenChrome`'s one short fade, nothing under reduced motion); the name is a fact and never moves on its own.
 *
 * Pass `onScroll` to the ScrollView with `scrollEventThrottle={16}`, `onHeroLayout` to the block that holds the title
 * (a direct child of the scrolled content) and `onTitleLayout` to the title itself (`TaskDecisionTitle`).
 */
export function useDetailScrollTitle(): {
  titleVisible: boolean; onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onHeroLayout: (event: LayoutChangeEvent) => void; onTitleLayout: (event: LayoutChangeEvent) => void;
} {
  const [line, setLine] = useState(DEFAULT_TITLE_LINE);
  const hero = useRef(0), title = useRef<{ y: number; height: number } | null>(null);
  const measure = useCallback(() => {
    if (title.current) setLine(Math.max(1, Math.round(hero.current + title.current.y + title.current.height)));
  }, []);
  const onHeroLayout = useCallback((event: LayoutChangeEvent) => { hero.current = event.nativeEvent.layout.y; measure(); }, [measure]);
  const onTitleLayout = useCallback((event: LayoutChangeEvent) => {
    const { y, height } = event.nativeEvent.layout; title.current = { y, height }; measure();
  }, [measure]);
  const { titleVisible, onScroll } = useChromeTitleOnScroll(line);
  return { titleVisible, onScroll, onHeroLayout, onTitleLayout };
}
/** Before the first layout: one line of the hero title under the content's top padding. */
const DEFAULT_TITLE_LINE = 72;

/**
 * The detail's "···": the rare actions of the screen behind one control on the right of the bar, as an ActionSheet
 * (owner rule "stalno / ponekad / retko", 2026-09-23: what is needed rarely does not sit in the reading flow). Nothing is
 * drawn when there is nothing rare to do. Each action runs once the sheet has gone and keeps its own confirmation and
 * guard; the menu only opens the door to it.
 */
export function useDetailMenu(actions: readonly SheetAction[], { disabled = false, label = 'Radnje zadatka' }: {
  disabled?: boolean; /** What a screen reader calls the open menu. */ label?: string;
} = {}): { button: ReactNode; sheet: ReactNode } {
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const available = actions.length > 0;
  // A menu whose actions all went away (the task changed under it) is closed, and does not come back by itself later.
  useEffect(() => { if (!available) setOpen(false); }, [available]);
  if (!available) return { button: undefined, sheet: null };
  return {
    button: <ChromeIconButton label="Više radnji" icon={DotsThree} disabled={disabled} onPress={() => setOpen(true)} />,
    sheet: open ? <ActionSheet label={label} actions={actions} onClose={close} /> : null,
  };
}

/** Full-width reading rows keep long locations, translated dates and enlarged text readable. */
export function ProductFact({ art, label, value, note, prominent = false, prominentAs = 'amount' }: {
  art: FactArtKind; label: string; value: string; note?: string; prominent?: boolean;
  /** A prominent fact is either money or a word about money ("Tražim ponude"); the word never wears the amount's dress. */
  prominentAs?: 'amount' | 'label';
}) {
  return <View accessible accessibilityLabel={`${label}: ${value}${note ? `, ${note}` : ''}`} style={[s.fact, prominent && s.price]}>
    <FactArt kind={art} size={prominent ? 36 : 32} />
    <View style={s.factCopy}>
      {prominent ? <T variant="meta" tone="muted">{label}</T> : null}
      <T style={prominent ? (prominentAs === 'label' ? s.priceLabel : s.priceValue) : s.factValue}>{value}</T>
      {note ? <T variant="meta" tone="muted">{note}</T> : null}
    </View>
  </View>;
}

export function ProductFacts({ children }: { children: ReactNode }) {
  return <View style={s.facts}>{children}</View>;
}

/*
 * The task detail, recomposed from zero (owner, 2026-09-23: the HTML prototypes are documentation of
 * what a task says, not of how the screen is laid out). A task is read in one pass, top to bottom:
 * its name, then its facts as one list — where, when, how many people, how much, and who posts it —
 * then the words, what it needs, photos, the place on a small map and the questions. Sections are
 * separated by a hairline and air, never by boxes; the one action stays at the foot of the screen,
 * and what is done rarely waits behind the "···" of the bar.
 */

/**
 * A part of a detail screen: a hairline and air above it, and a heading when the part needs one. (`DetailFact`, `DetailFacts`
 * and `DetailLink`, the fact and the row that led somewhere, had no user and are gone with the UI/UX pass of 2026-10-08: a fact
 * is a `FactRow` now, and a row that leads somewhere is a `ListRow`.)
 */
export function DetailSection({ title, children }: { title?: string; children: ReactNode }) {
  return <View style={s.section}>
    {title ? <T accessibilityRole="header" variant="heading" style={s.sectionTitle}>{title}</T> : null}
    {children}
  </View>;
}

/**
 * The public stops of a task that moves, as one line: "Kalenić → Užice" under what kind of trip it is.
 * The label of each stop is heard, not shown; a stop that names the same place twice is said once.
 * A task done in one place draws nothing here: its place is already the first fact and the map.
 */
export function DetailRoute({ rows, country }: { rows: { label: string; value: string }[]; country?: string | null }) {
  const [mode, ...stops] = rows;
  const once = (value: string) => [...new Set(value.split(' · ').map(part => part.trim()).filter(Boolean))].join(' · ');
  const named = stops.map(stop => ({ label: stop.label, value: once(stop.value) })).filter(stop => stop.value);
  if (!mode || !named.length) return null;
  return <View accessible accessibilityLabel={`${mode.value}: ${named.map(stop => `${stop.label} ${stop.value}`).join(', ')}${country ? `, ${country}` : ''}`}
    style={s.route}>
    <T variant="meta" tone="muted">{country ? `${mode.value} · ${country}` : mode.value}</T>
    <T variant="bodyStrong" style={s.ink}>{named.map(stop => stop.value).join('  →  ')}</T>
  </View>;
}

/** Whether the stops of a task name anything the area line does not already say. */
export function routeAddsToArea(rows: { label: string; value: string }[], area: string): boolean {
  const [, ...stops] = rows;
  return stops.length > 1 || stops.some(stop => stop.value.split(' · ').map(part => part.trim()).filter(Boolean).some(part => !area.includes(part)));
}

/**
 * A task's words. A long description shows its first lines and one quiet press to read the rest;
 * the whole text is always there for a screen reader and for selection.
 */
export function DetailDescription({ text }: { text: string }) {
  const long = text.length > 360 || text.split(/\r?\n/).length > 8;
  const [open, setOpen] = useState(false);
  return <View style={s.description}>
    <T selectable variant="body" numberOfLines={long && !open ? 8 : undefined} style={s.descriptionText}>{text}</T>
    {long ? <Press accessibilityRole="button" accessibilityLabel={open ? 'Prikaži kraći opis' : 'Prikaži ceo opis'} accessibilityState={{ expanded: open }}
      onPress={() => setOpen(value => !value)} haptic="select" scaleTo={0.99} style={s.more}>
      <T variant="bodyStrong" style={s.moreText}>{open ? 'Prikaži kraći opis' : 'Prikaži ceo opis'}</T>
    </Press> : null}
  </View>;
}

/**
 * The two parts of a task's price, from the same helpers every other price in the app uses: the figure,
 * and what it covers in the words `needPriceBasisNote` already says. "Tražim ponude" and "Cena nije
 * navedena" are words about a price; they are never marked as an amount.
 */
export function productPriceParts(input: Parameters<typeof needPriceText>[0] & Parameters<typeof needPriceBasisNote>[0], offersNote: string): {
  value: string; note: string | null; isAmount: boolean;
} {
  if (input.rezimCene === 'OFFERS' || !input.ponudjenaCena) {
    return { value: needPriceText(input), note: input.rezimCene === 'OFFERS' ? offersNote : null, isAmount: false };
  }
  const basis = needPriceBasisNote(input);
  return { value: input.ponudjenaCena.prikaz, isAmount: /\d/.test(input.ponudjenaCena.prikaz),
    note: basis ? basis.charAt(0).toLocaleUpperCase('sr-Latn-RS') + basis.slice(1) : null };
}

/**
 * The screen's one primary action at the foot of a detail: its words, a count when the words are about
 * something counted ("Pregledaj prijave · 3"), and an arrow when it leads somewhere. What the count
 * means is said to a screen reader through `accessibilityLabel`.
 */
export function ProductFooterAction({ label, count, accessibilityLabel, onPress, disabled = false, arrow = true }: {
  label: string; count?: number | null; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; arrow?: boolean;
}) {
  const text = typeof count === 'number' ? `${label} · ${count}` : label;
  return <Press accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? text} accessibilityState={{ disabled }}
    disabled={disabled} onPress={onPress} haptic={disabled ? 'none' : 'select'} style={[s.footerAction, brandAction, disabled && s.footerDisabled]}>
    <T variant="action" style={s.footerText}>{text}</T>
    {arrow && !disabled ? <ArrowRight size={20} weight="bold" color={sys.color.onGreen} /> : null}
  </Press>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  facts: { gap: 4 },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 8 },
  factCopy: { flex: 1, minWidth: 0, gap: 2 },
  factValue: { ...sys.type.bodyStrong, color: sys.color.ink },
  price: { marginTop: 8, paddingVertical: 16, borderTopWidth: 1, borderBottomWidth: 1, borderColor: sys.color.line },
  priceValue: { ...sys.type.priceLarge, color: sys.color.money },
  priceLabel: { ...sys.type.title, color: sys.color.ink },
  section: { gap: 14, paddingTop: 24, borderTopWidth: 1, borderTopColor: sys.color.line },
  sectionTitle: { color: sys.color.ink },
  description: { gap: 6 },
  route: { gap: 2 },
  descriptionText: { color: sys.color.ink, lineHeight: 26 },
  more: { alignSelf: 'flex-start', minHeight: sys.touch.min, justifyContent: 'center' },
  moreText: { color: sys.color.green },
  footerAction: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.sm,
    paddingHorizontal: sys.space.base, paddingVertical: sys.space.sm },
  footerText: { flexShrink: 1, textAlign: 'center', color: sys.color.onGreen, fontVariant: ['tabular-nums'] },
  footerDisabled: { opacity: 0.45 },
});
