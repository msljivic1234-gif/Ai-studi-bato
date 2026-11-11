import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { T } from '../Text';
import { useLayoutClass } from './textScale';
import { sys } from './tokens';
import { InboxBell } from '../InboxBell';
import type { GlyphIcon, GlyphName } from './Glyph';
import { chrome, ChromeIconButton, ScreenChrome } from './ScreenChrome';

type HeaderIconButtonProps = ({ icon: GlyphIcon; glyph?: never } | { glyph: GlyphName; icon?: never }) & {
  label: string; hint?: string; active?: boolean; onPress: () => void;
  /** A word beside the glyph, for a command nobody can guess from a drawing (see `ChromeIconButton`). */ caption?: string;
  children?: ReactNode;
};

/**
 * A toggle beside the profile and the bell (search, filters): the one chrome icon button, spoken as selected or not;
 * `active` is shown by weight and colour together. A plain command uses `ChromeIconButton` itself. It takes a Glyph name
 * (`glyph="filters"`, the way forward) or a Phosphor component (`icon`, still accepted), and an optional `caption`.
 */
export function HeaderIconButton({ label, hint, active = false, onPress, caption, children, ...art }: HeaderIconButtonProps) {
  return <ChromeIconButton {...art} label={label} hint={hint} active={active} caption={caption} onPress={onPress}>{children}</ChromeIconButton>;
}

/**
 * Root navigation: the brand or section title leads, then the optional control, inbox and own profile.
 * Routes inject the authorized avatar as the last action; presentations retain a data-free profile fallback.
 * The default section name is spoken with the mark; showTitle opts into a visible title.
 */
type ScreenHeaderProps = { title: string; onProfile: () => void; right?: ReactNode;
  /** Data-owning routes inject the current-account identity; galleries never import its service. */
  profileEntry?: ReactNode;
  /** A visible section title instead of the brand mark. Only opt-in callers omit their duplicate content heading. */
  showTitle?: boolean;
};

export function ScreenHeader({ title, onProfile, right, profileEntry, showTitle = false }: ScreenHeaderProps) {
  if (showTitle) return <TitledRootHeader title={title} onProfile={onProfile} right={right} profileEntry={profileEntry} />;
  return <ScreenChrome variant="root" title={title} onProfile={onProfile} right={right} bell={<InboxBell />} profileEntry={profileEntry} />;
}

/** One in-flow title. Large text/narrow windows put it below the controls, with no clipping or font cap.
 * The profile and bell retain the same host positions when the layout class changes; the bell never remounts for layout. */
function TitledRootHeader({ title, onProfile, right, profileEntry }: ScreenHeaderProps) {
  const { stacked } = useLayoutClass();
  const heading = <T variant="title" accessibilityRole="header" style={s.title}>{title}</T>;
  return <View style={s.header}>
    <View style={s.row}>
      {!stacked ? <View style={s.copy}>{heading}</View> : null}
      <View style={s.actions}>{right}<InboxBell />{profileEntry ?? <ChromeIconButton glyph="profile" label="Moj profil" onPress={onProfile} />}</View>
    </View>
    {stacked ? <View style={s.stackedTitle}>{heading}</View> : null}
  </View>;
}

const s = StyleSheet.create({
  header: { paddingHorizontal: chrome.paddingHorizontal, paddingVertical: chrome.paddingVertical },
  row: { minHeight: chrome.control, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: chrome.gap },
  copy: { flexGrow: 1, flexShrink: 1, flexBasis: 120, minWidth: 0 },
  title: { color: sys.color.ink },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: sys.space.sm, flexShrink: 0, maxWidth: '100%' },
  stackedTitle: { paddingTop: sys.space.sm },
});
