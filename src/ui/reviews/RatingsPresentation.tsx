import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { trenutak } from '../../lib/trenutak';
import { Press } from '../Press';
import { SettingsScreen } from '../settings/SettingsPresentation';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';
import { QuietReadState } from '../v2/QuietReadState';
import { Avatar } from '../system/Avatar';
import { FactArt } from '../system/FactArt';
import { layout, ruleWidth } from '../system/layout';
import { dogovora } from '../system/plural';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import type { GivenRating } from './givenRatings';
import { ReviewCommentText } from './ReviewCommentText';

/**
 * "Ocene" (T4a, 2026-10-07): the place the rating line of the profile leads to. Two tabs, in the owner's words: "Primljene" (what
 * others gave the person) and "Date" (what the person gave). Presentation only: the route reads, owns every guard and navigates.
 *
 * Primljene shows what the backend answers about the person's own account: the average with its count and, in a build with the
 * written comments (D12), the comments about the person. The individual ratings behind the average are not listed because the
 * backend has no read for them; the screen says only what it shows ("Prosek svih ocena na tvom nalogu."), makes no promise about
 * what it cannot show, and no sentence on it promises anonymity (owner decision A10).
 *
 * Date lists the ratings the person left, each with the other side, the stars, the day and the Dogovor; a row opens that Dogovor.
 */
export type RatingsTab = 'received' | 'given';
export const RATINGS_TABS: readonly { key: RatingsTab; label: string }[] = [{ key: 'received', label: 'Primljene' }, { key: 'given', label: 'Date' }];

export type ReceivedView =
  | { kind: 'loading' } | { kind: 'error'; onRetry: () => void }
  /** No ratings yet. */ | { kind: 'none' }
  /** `label` is the one spelling of the average and its count ("5,0 · 4 ocene"). */ | { kind: 'rated'; label: string };

export type GivenRow = GivenRating & { onOpen: () => void };
export type GivenView =
  | { kind: 'loading' } | { kind: 'error'; onRetry: () => void }
  | { kind: 'ready'; rows: readonly GivenRow[]; failed: number; onRetryFailed: () => void; older: boolean; onMore: () => void;
      working: 'more' | 'retry' | null };

export function RatingsScreen({ tab, onTab, onBack, received, given, givenOpened }: {
  tab: RatingsTab; onTab: (tab: RatingsTab) => void; onBack: () => void;
  /** The body of "Primljene". */ received: ReactNode;
  /** The body of "Date"; the route hands it over only once the tab was opened, so nothing is read for a tab nobody looked at. */ given: ReactNode;
  /** The body of "Date" has been shown at least once: it stays mounted (hidden) so what was read is kept when the person goes back. */
  givenOpened: boolean;
}) {
  return <SettingsScreen title="Ocene" onBack={onBack}>
    <Segmented appearance="underline" value={tab} onChange={onTab} options={RATINGS_TABS} />
    <View style={tab === 'received' ? undefined : s.hidden}>{received}</View>
    {givenOpened ? <View style={tab === 'given' ? undefined : s.hidden}>{given}</View> : null}
  </SettingsScreen>;
}

/** Five stars, the first `rating` of them in colour: the rating as a picture, the words beside it say it too. */
export function StarsRow({ rating }: { rating: number }) {
  return <View accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={s.stars}>
    {[1, 2, 3, 4, 5].map(value => <FactArt key={value} kind="star" size={16} muted={value > rating} />)}
  </View>;
}

export function ReceivedRatings({ view, comments }: { view: ReceivedView; comments?: ReactNode }) {
  return <View style={s.body}>
    {view.kind === 'loading' ? <T variant="note" tone="muted" accessibilityLiveRegion="polite">Učitavamo prosek ocena…</T>
      : view.kind === 'error' ? <StateView kind="error" title="Ocene trenutno nisu dostupne" body="Proveri vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: view.onRetry }} />
        : view.kind === 'none' ? <StateView kind="empty" art="star" title="Još nema ocena" body="Ocene stižu posle završenih Dogovora." />
          : <View style={s.summary}>
            <View accessible accessibilityLabel={`Ocena: ${view.label}`} style={s.average}>
              <FactArt kind="star" size={24} />
              <T variant="heading" style={s.ink}>{view.label}</T>
            </View>
            <T variant="note" tone="muted">Prosek svih ocena na tvom nalogu.</T>
          </View>}
    {comments}
  </View>;
}

export function GivenRatings({ view }: { view: GivenView }) {
  if (view.kind === 'loading') return <QuietReadState art="star" title="Učitavamo date ocene…"
    body="Proveravamo ocene koje si ostavio." />;
  if (view.kind === 'error') return <StateView kind="error" title="Date ocene nisu učitane" body="Proveri vezu i pokušaj ponovo."
    primary={{ label: 'Pokušaj ponovo', onPress: view.onRetry }} />;
  const empty = view.rows.length === 0;
  return <View style={s.body}>
    {empty && !view.older && view.failed === 0 ? <StateView kind="empty" art="star" title="Još nema datih ocena"
      body="Ocene koje ostaviš posle završenog Dogovora pojaviće se ovde." /> : null}
    {empty && view.older ? <T variant="note" tone="muted">U poslednjim Dogovorima nema datih ocena.</T> : null}
    {view.rows.map((row, index) => <GivenItem key={row.agreementId} row={row} last={index === view.rows.length - 1} />)}
    {view.failed > 0 ? <View style={s.notice} accessibilityLiveRegion="polite">
      <T variant="note" tone="muted">{`Ne možemo da učitamo ocene za ${dogovora(view.failed)}.`}</T>
      <V2Action label="Pokušaj ponovo" kind="quiet" compact loading={view.working === 'retry'} disabled={view.working !== null} onPress={view.onRetryFailed} />
    </View> : null}
    {view.older ? <V2Action label="Prikaži starije" kind="secondary" loading={view.working === 'more'} disabled={view.working !== null} onPress={view.onMore} /> : null}
  </View>;
}

function GivenItem({ row, last }: { row: GivenRow; last: boolean }) {
  const name = row.person?.name ?? null, day = trenutak(row.createdAt)?.dan ?? null;
  const spoken = ['Ocena ' + row.rating + ' od 5', name ?? 'Ime nije dostupno', row.title, day].filter(Boolean).join('. ');
  return <View style={s.item}>
    <Press accessibilityRole="button" accessibilityLabel={spoken} accessibilityHint="Otvara Dogovor." haptic="select"
      scaleTo={sys.motion.scale.row} onPress={row.onOpen} style={s.open}>
      <View style={s.face}><Avatar initials={row.person?.initials ?? null} size={layout.slot} /></View>
      <View style={s.copy}>
        <View style={s.head}>
          {name ? <T variant="bodyStrong" numberOfLines={2} style={s.name}>{name}</T>
            : <T variant="bodyStrong" tone="muted" numberOfLines={2} style={s.name}>Ime nije dostupno</T>}
          {day ? <T variant="meta" tone="muted">{day}</T> : null}
        </View>
        <StarsRow rating={row.rating} />
        {row.title ? <T variant="note" tone="muted" numberOfLines={2}>{row.title}</T> : null}
      </View>
    </Press>
    {/* Outside the row's own press: the comment has a control of its own, and a button inside a button cannot be reached. */}
    {row.comment ? <View style={s.comment}><ReviewCommentText text={row.comment} /></View> : null}
    {last ? null : <View pointerEvents="none" style={s.rule} />}
  </View>;
}

const s = StyleSheet.create({
  hidden: { display: 'none' },
  body: { gap: sys.space.base },
  ink: { color: sys.color.ink },
  summary: { gap: sys.space.xs },
  average: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, minHeight: layout.touch },
  stars: { flexDirection: 'row', gap: sys.space.xs },
  item: { paddingVertical: sys.space.md, gap: sys.space.sm },
  // The divider is not a border: it begins where the words begin, like the one of a `ListRow`.
  rule: { position: 'absolute', left: layout.slot + sys.space.md, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
  open: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, minHeight: layout.touch },
  face: { width: layout.slot, alignItems: 'center' },
  copy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  head: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: sys.space.md },
  name: { flex: 1, minWidth: 0, color: sys.color.ink },
  comment: { paddingLeft: layout.slot + sys.space.md },
  notice: { gap: sys.space.xs, alignItems: 'flex-start' },
});
