import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { SettingsText as T } from '../settings/SettingsPresentation';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { ListRow } from '../system/ListRow';
import { Section, type SectionAction } from '../system/Section';
import { Surface } from '../system/Surface';
import { sys } from '../system/tokens';

/**
 * A note that sits in a screen's flow: the system's `note` (a flat tint, not a card), a 24 px fact drawing and one or two sentences
 * (round 5, privacy / data / legal / support, owner step 11b; UI/UX pass 2026-10-08: it is a `Surface` now, the one container). It
 * replaces the pale green panels those screens used for everything, where green said "fine" even over "not available", "not
 * confirmed" and "failed".
 *
 * - `neutral`: the wash, ink words: a plain fact about the state.
 * - `quiet`: the wash, muted words: the same, said more softly ("Potpun raspored … još nije dostupan").
 * - `warn`: warnSoft, ink words: something waits for the person (an unconfirmed send, a preparation that did not run).
 * - `danger`: dangerSoft, danger words: a read or a command failed. Always spoken as an alert.
 *
 * It is never a card: it lies inside a screen or a card as a tint, so there is no card inside a card.
 */
export type NoteTone = 'neutral' | 'quiet' | 'warn' | 'danger';

export function InlineNote({ tone = 'neutral', art = 'info', artMuted, alert, children, testID }: {
  tone?: NoteTone; art?: FactArtKind | null; artMuted?: boolean;
  /** Spoken as an alert when it appears; `danger` always is. */ alert?: boolean;
  children: ReactNode; testID?: string;
}) {
  const spoken = alert || tone === 'danger';
  return <Surface kind="note" tone={tone === 'warn' ? 'warn' : tone === 'danger' ? 'danger' : 'wash'} testID={testID}>
    <View accessibilityLiveRegion={spoken ? 'polite' : undefined} style={s.row}>
      {art ? <FactArt kind={art} size={24} muted={artMuted ?? (tone === 'danger' || tone === 'quiet')} /> : null}
      <View style={s.copy}>
        {typeof children === 'string'
          ? <T variant="note" tone={tone === 'danger' ? 'danger' : tone === 'quiet' ? 'muted' : 'ink'} accessibilityRole={spoken ? 'alert' : undefined}>{children}</T>
          : children}
      </View>
    </View>
  </Surface>;
}

/**
 * The header of a settings group whose content is not a list (a loading placeholder, a note): the system's `Section`, so
 * "Rokovi čuvanja" reads the same loading, unpublished or published. It used to be a copy of the group's header.
 */
export function PlainSection({ title, action, children }: { title: string; action?: SectionAction; children: ReactNode }) {
  return <Section title={title} action={action}>{children}</Section>;
}

/** One line of a list that opens nothing: a `ListRow` that only tells (no arrow, no press). */
export function PlainRow({ label, detail, last = false }: { label: string; detail?: string; last?: boolean }) {
  return <ListRow title={label} subtitle={detail} last={last} />;
}

/** A fact drawing beside one quiet line, with no box: a statement about the whole screen (who sees a support request). */
export function QuietLine({ art, children }: { art: FactArtKind; children: ReactNode }) {
  return <View style={s.row}>
    <FactArt kind={art} size={24} />
    <T variant="note" tone="muted" style={s.copy}>{children}</T>
  </View>;
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
});
