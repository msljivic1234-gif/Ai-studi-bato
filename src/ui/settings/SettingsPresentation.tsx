import type { ComponentProps, ReactNode } from 'react';
import { RefreshControl, StyleSheet, Switch, View, type StyleProp, type ViewStyle } from 'react-native';
import { Press } from '../Press';
import { ProductHeader } from '../product/ProductDetails';
import { Avatar } from '../system/Avatar';
import { FlowFooter } from '../system/FlowFooter';
import { Glyph } from '../system/Glyph';
import { layout, ruleWidth } from '../system/layout';
import { ListRow } from '../system/ListRow';
import { Screen } from '../system/Screen';
import { Section, type SectionAction } from '../system/Section';
import { Surface } from '../system/Surface';
import { brandAction, sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { ScrolledBar, useScrolledUnderBar } from './ScrolledBar';

/**
 * Shared settings layer (UI/UX pass, 2026-10-08, F6): every profile / account / support / legal surface is built from these
 * pieces, and they are now a THIN layer over the system's grid (`Screen`, `Section`, `ListRow`, `Surface`, `FlowFooter`) instead
 * of a second grid of their own. Exports, props and spoken labels are unchanged, so every screen that stands on them moves at
 * once: the edge of the screen is 20 (it was 24), the blocks stand 24 apart (it was 28), a group is named by a `Section`
 * (`heading`, it was a 13 px line), every row is a `ListRow` (its text starts 52 from the edge with a picture and 0 without, its
 * divider is 1 dp and inset), and the foot is the system's foot. White screen, open groups, one green brand action per screen.
 */
export function SettingsText({ variant = 'body', ...props }: ComponentProps<typeof T>) {
  // The old "display" of this layer was the name of a thing (28), not the 32 of a statement that carries a screen.
  return <T {...props} variant={variant === 'display' ? 'pageTitle' : variant} />;
}

export function SettingsScreen({ title, onBack, backLabel, disabled = false, children, footer, footerReason, right, refresh }: {
  /** The bar names the screen; nothing explains where you are (no eyebrow, owner 2026-09-23). */
  title: string; onBack: () => void;
  /** What the arrow says when "Nazad" is not enough ("Nazad na profil"). */ backLabel?: string;
  disabled?: boolean; children: ReactNode; footer?: ReactNode;
  /** Why the green action of the foot cannot be pressed yet: a quiet line ABOVE it (the system foot's rule), not under the button. */
  footerReason?: string | null; right?: ReactNode;
  /**
   * Pull to read the screen again, in place of a standing "Osveži" or "Proveri ponovo" (J12: a screen is refreshed by pulling it). `busy` is
   * the screen's own "a read is running": the spinner is the PULL's, and a read that starts by itself never raises it (`usePullRefresh`).
   */
  refresh?: { onRefresh: () => void; busy: boolean };
}) {
  const { scrolled, onScroll } = useScrolledUnderBar();
  const pull = usePullRefresh(refresh?.onRefresh, refresh?.busy ?? false);
  return <Screen kind="detail" header={<ScrolledBar scrolled={scrolled}><ProductHeader title={title} back={onBack} backLabel={backLabel} disabled={disabled} right={right} /></ScrolledBar>}
    footer={footer ? <SettingsFooter reason={footerReason}>{footer}</SettingsFooter> : undefined} onScroll={onScroll}
    refreshControl={refresh ? <RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} /> : undefined}>{children}</Screen>;
}

/** The band under a settings screen that holds its one green action: the system's foot, above the system's own bottom edge. */
export function SettingsFooter({ children, reason }: { children: ReactNode; reason?: string | null }) {
  return <FlowFooter testID="settings-primary-footer" reason={reason ?? undefined}>{children}</FlowFooter>;
}

/**
 * The sentence under the bar. It used to carry an uppercase kicker and a second, 28 px title; the bar
 * already names the screen, so here only a title that ADDS information (a state, a case) is drawn,
 * as a heading, and a tagline is not passed at all.
 */
export function SettingsIntro({ title, children }: { kicker?: string; title?: string; children: ReactNode }) {
  return <View style={styles.intro}>
    {title ? <SettingsText variant="heading" accessibilityRole="header">{title}</SettingsText> : null}
    <SettingsText variant="copy" tone="muted">{children}</SettingsText>
  </View>;
}

/**
 * Related settings form an open section, not another rounded box: the system's `Section` (a title in `heading`, 12 above what
 * it holds), and the screen's gap of 24 is what parts one section from the next. The optional footer explains the section once.
 * Forms and decisions that need a contained surface use `SettingsPanel`.
 */
export function SettingsGroup({ title, footer, action, children }: { title?: string; footer?: string; action?: SectionAction; children: ReactNode }) {
  return <Section title={title} action={action}>
    {children}
    {footer ? <SettingsText variant="note" tone="muted" style={styles.groupFooter}>{footer}</SettingsText> : null}
  </Section>;
}

/**
 * One row of a group: a `ListRow` (64 high with a picture or a second line, 56 without; the text 52 from the edge with a picture
 * and at the edge without one; the divider inset). A row that cannot be opened now draws its picture quiet as well as its words.
 * The row speaks its label and, as the hint, its detail, as it always did.
 */
export function SettingsRow({ label, detail, value, valuePlacement, icon, onPress, disabled = false, last = false, compact = false, tone = 'default', accessory, attention = false }: {
  label: string; detail?: string;
  /** What is set, in grey at the end of the line before the arrow ("Novi Sad"): the row's own answer, never a sentence. */ value?: string;
  valuePlacement?: 'end' | 'below';
  icon?: ReactNode; onPress: () => void; disabled?: boolean; last?: boolean;
  /** A row for something needed once in a long while (legal, export, the blocked list): no picture, so it does not
   *  compete with the rows a person opens every day (owner rule, 2026-09-23). A group has pictures in all its rows or in none. */
  compact?: boolean;
  /** `danger` for the one destructive row, which is the last row of the last group; `quiet` draws the picture in the quiet set. */
  tone?: 'default' | 'quiet' | 'danger';
  /** Drawn at the trailing edge in place of the arrow (a count, a state word). */
  accessory?: ReactNode;
  /** Something waits behind this row: an orange dot before the arrow, the app's one accent. */
  attention?: boolean;
}) {
  return <ListRow leading={icon && !compact ? icon : undefined} title={label} subtitle={detail} value={value} valuePlacement={valuePlacement} onPress={onPress} disabled={disabled} last={last}
    tone={tone} trailing={accessory ?? (attention ? <View accessible={false} style={styles.dot} /> : undefined)}
    arrow={accessory === undefined ? undefined : false} accessibilityLabel={label} accessibilityHint={detail ?? value} />;
}

/**
 * A choice that is on or off. The whole row is the switch (one focus stop, spoken as a switch with its state), so a
 * finger does not have to find the 51 × 31 control at the right edge; the drawn switch is hidden from a screen reader so
 * it is not heard twice. Green track and a white thumb when on, the strong line when off, never the platform's teal.
 * A switch that cannot be used now says why, under its help and in its hint.
 */
export function SettingsSwitchRow({ label, help, value, disabled = false, reason, onChange, last = false }: {
  label: string; help?: string; value: boolean; disabled?: boolean; reason?: string | null; onChange: (value: boolean) => void; last?: boolean;
}) {
  const why = disabled && reason ? reason : null;
  const hint = [help, why].filter(Boolean).join(' ') || undefined;
  return <Press accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ checked: value, disabled }}
    disabled={disabled} haptic={disabled ? 'none' : 'select'} scaleTo={sys.motion.scale.none} onPress={() => onChange(!value)} style={styles.switchRow}>
    <View style={styles.switchHeading}>
      <View style={styles.rowCopy}>
        <SettingsText variant="bodyStrong" tone={disabled ? 'muted' : 'ink'}>{label}</SettingsText>
      </View>
      <View style={styles.switchControl} pointerEvents="none" importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Switch value={value} disabled={disabled}
          trackColor={{ false: sys.color.lineStrong, true: sys.color.green }} thumbColor={sys.color.surface}
          ios_backgroundColor={sys.color.lineStrong} />
      </View>
    </View>
    {help ? <SettingsText variant="note" tone="muted">{help}</SettingsText> : null}
    {why ? <SettingsText variant="note" tone="muted">{why}</SettingsText> : null}
    {last ? null : <View pointerEvents="none" style={[styles.rule, { left: 0 }]} />}
  </Press>;
}

/**
 * A person with one action (the blocked list). Two focus stops: the person, which opens them, and the action under the
 * name. The person's part ends in the arrow at the row's edge, so it reads as a way onward. The action stands under the name, at
 * every text size, where the name starts (the face's slot of 40 and 12 more), so neither is squeezed and the arrow ends the row.
 */
export function SettingsPersonRow({ name, initials, onOpen, openHint, action, last = false }: {
  name: string; initials: string | null; onOpen: () => void; openHint?: string;
  action: { label: string; accessibilityLabel?: string; onPress: () => void; disabled?: boolean; loading?: boolean };
  last?: boolean;
}) {
  return <View style={styles.person}>
    <Press accessibilityRole="button" accessibilityLabel={name} accessibilityHint={openHint} haptic="select" scaleTo={sys.motion.scale.row}
      onPress={onOpen} style={styles.personOpen}>
      <View style={styles.personFace}><Avatar initials={initials} size={layout.slot} /></View>
      <SettingsText variant="bodyStrong" numberOfLines={2} style={styles.personName}>{name}</SettingsText>
      <Glyph name="caret-right" size={20} tone="muted" />
    </Press>
    <View style={styles.personAction}>
      <V2Action label={action.label} accessibilityLabel={action.accessibilityLabel} onPress={action.onPress}
        disabled={action.disabled} loading={action.loading} kind="quiet" compact />
    </View>
    {last ? null : <View pointerEvents="none" style={[styles.rule, { left: layout.slot + sys.space.md }]} />}
  </View>;
}

/** A contained surface for a form or a decision: the system's `panel` (an edge, no shadow); `soft` is the flat tint of a `note`. */
export function SettingsPanel({ children, soft = false, style }: { children: ReactNode; soft?: boolean; style?: StyleProp<ViewStyle> }) {
  return <Surface kind={soft ? 'note' : 'panel'} style={[styles.panel, style]}>{children}</Surface>;
}

/**
 * A line of a list that tells and opens nothing: a `ListRow` without a press (so no arrow and no press), its words as the
 * subtitle. Words that are more than text (a node) keep the row's measure and the divider.
 */
export function SettingsInfo({ title, children, icon, last = false }: { title: string; children: ReactNode; icon?: ReactNode; last?: boolean }) {
  if (typeof children === 'string') return <ListRow leading={icon} title={title} subtitle={children} last={last} />;
  return <View style={styles.info}>
    {icon ? <View style={styles.infoSlot}>{icon}</View> : null}
    <View style={styles.rowCopy}>
      <SettingsText variant="body">{title}</SettingsText>
      <SettingsText variant="note" tone="muted">{children}</SettingsText>
    </View>
    {last ? null : <View pointerEvents="none" style={[styles.rule, { left: icon ? layout.slot + sys.space.md : 0 }]} />}
  </View>;
}

/**
 * `primary` is the screen's one brand action (green surface, white label); other kinds map onto V2Action. `loading` is
 * this action's own write in flight (it keeps its colour and words, with a spinner); `reason` says why a disabled one
 * cannot be pressed now.
 */
export function SettingsAction({ label, onPress, disabled = false, loading = false, reason, kind = 'primary', icon, compact = false }: {
  label: string; onPress: () => void; disabled?: boolean; loading?: boolean; reason?: string | null;
  kind?: 'primary' | 'secondary' | 'quiet' | 'destructive'; icon?: ReactNode;
  /** A small control beside content (under a photo tile), never for the screen's one brand action. */
  compact?: boolean;
}) {
  if (kind !== 'primary') return <V2Action label={label} onPress={onPress} disabled={disabled} loading={loading} reason={reason} kind={kind} icon={icon} compact={compact} />;
  return <V2Action label={label} onPress={onPress} disabled={disabled} loading={loading} reason={reason} icon={icon} style={brandAction} />;
}

const styles = StyleSheet.create({
  intro: { gap: sys.space.sm },
  groupFooter: { paddingTop: sys.space.sm },
  rowCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  dot: { width: 10, height: 10, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  // The divider is not a border: it begins where the words begin, like the one of a `ListRow`.
  rule: { position: 'absolute', right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
  switchRow: { minHeight: layout.rowMinPlain, paddingVertical: sys.space.md, flexDirection: 'column', alignItems: 'stretch', gap: sys.space.xs },
  switchHeading: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  switchControl: { flexShrink: 0 },
  person: { minHeight: layout.rowMinPlain, paddingVertical: sys.space.sm },
  personOpen: { minHeight: layout.rowMinPlain, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  personFace: { width: layout.slot, alignItems: 'center', justifyContent: 'center' },
  personName: { flex: 1, minWidth: 0 },
  // The action takes its own line under the name, starting where the name starts (the face's slot and the gap).
  personAction: { paddingLeft: layout.slot + sys.space.md - sys.space.base, paddingBottom: sys.space.xs, alignItems: 'flex-start' },
  panel: { gap: layout.group },
  info: { minHeight: layout.rowMinPlain, paddingVertical: sys.space.md, flexDirection: 'row', gap: sys.space.md },
  infoSlot: { width: layout.slot, alignItems: 'center', justifyContent: 'flex-start' },
});
