import type { ReactNode } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import type { PotrebaProjekcija } from '../../../contracts/projections';
import { needPriceBasisNote } from '../../../data/needDetailPresentation';
import { T } from '../../Text';
import { Avatar } from '../../system/Avatar';
import { FactArt, type FactArtKind } from '../../system/FactArt';
import { FACT_ROW_ART, FactRow } from '../../system/FactRow';
import { Glyph } from '../../system/Glyph';
import { InfoButton } from '../../system/InfoButton';
import { MoneySummary } from '../../system/MoneySummary';
import { layout } from '../../system/layout';
import { plural } from '../../system/plural';
import { Section } from '../../system/Section';
import { Surface } from '../../system/Surface';
import { sys } from '../../system/tokens';
import { RELIABILITY_LABEL } from '../../profile/workTrustModel';
import { VALUE_WORDS, taskValue } from '../TaskFace';

/**
 * Shared task-detail content: names, truthful budget terms, requirements, public identity and privacy.
 * Public and owner pages choose their hierarchy; these parts do not derive authority or change task data.
 */

/** An open page title: its layout still belongs to the screen's measured chrome handoff. */
export function TaskDecisionTitle({ children, onLayout, prominent = false }: {
  children: ReactNode; onLayout: (event: LayoutChangeEvent) => void; prominent?: boolean;
}) {
  return <T accessibilityRole="header" onLayout={onLayout} variant={prominent ? 'display' : 'pageTitle'}
    style={[s.ink, prominent && s.prominentTitle]}>{children}</T>;
}

/**
 * The proposed budget and its actual basis, never an agreed or paid amount. A missing number stays
 * missing; offers remain words rather than money typography. Summary size promotes the same terms
 * without truncating the per-person/whole-task distinction.
 */
export function TaskDecisionValue({ need, size = 'detail', offersInfo }: { need: Pick<PotrebaProjekcija, 'rezimCene' | 'ponudjenaCena' | 'osnovaCene' | 'pokrivenost'>;
  /** Summary promotes task terms; card keeps only the compact basis, detail retains the full basis. */
  size?: 'card' | 'detail' | 'summary';
  /** What "Tražim ponude" means to the one who reads the page, one short sentence a line: it stands behind a small ⓘ at the end of the row and never under it (rule J5). */
  offersInfo?: readonly string[] }) {
  const value = taskValue(need);
  if (value.kind !== 'amount') {
    const words = <FactRow size={size === 'summary' ? 'detail' : size} art="offers" value={VALUE_WORDS[value.kind]} />;
    return value.kind === 'offers' && offersInfo?.length ? <View style={s.withInfo}>
      <View style={s.grow}>{words}</View>
      <View style={s.infoSlot}><InfoButton title="Tražim ponude" lines={offersInfo} /></View>
    </View> : words;
  }
  // What the sum buys, in the words of the place: a page says "ukupno" for the whole task and "po osobi · ukupno 6.000 RSD" when the people multiply it; a card says "ukupno" or "po osobi".
  const basis = size === 'card' ? value.basis : needPriceBasisNote(need)?.replace('ukupno za ceo zadatak', 'ukupno') ?? null;
  if (size === 'summary') return <MoneySummary label="Budžet" amount={value.amount} basis={basis} />;
  return <View accessible accessibilityRole="text" accessibilityLabel={`Budžet ${value.amount}${basis ? ` ${basis}` : ''}`} style={s.valueRow}>
    <View style={s.valueArt}><FactArt kind="money" size={FACT_ROW_ART} /></View>
    <View style={size === 'card' ? s.valueCopyCard : s.valueCopy}>
      <T variant={size === 'card' ? 'priceRow' : 'priceSmall'} style={s.amount}>{value.amount}</T>
      {basis ? <T variant="note" tone="muted">{basis}</T> : null}
    </View>
  </View>;
}

/** What "Tražim ponude" says to the person who asks, and to the person who may answer. The page shows the fact; this is the explanation behind it. */
export const OFFERS_INFO = {
  owner: ['Ne navodite iznos.', 'Svako ko se prijavi predlaže ukupan iznos, a Vi birate.'],
  worker: ['Zadatak nema unapred određen iznos.', 'U prijavi predlažete ukupan iznos.'],
} as const;

/**
 * Public maps remain approximate. The disclosure describes explicit sharing inside an agreement;
 * forming an agreement alone does not grant access to an address or private notes.
 */
export function TaskPlacePrivacy() {
  return <View style={s.withInfo}>
    <View style={s.grow}><FactRow art="lock" value="Tačnu adresu domaćin deli u Dogovoru" /></View>
    <View style={s.infoSlot}>
      <InfoButton title="Ko vidi adresu" lines={['Na mapi se vidi približno područje, ne tačna adresa.', 'U Dogovoru domaćin bira kome deli tačnu adresu i privatne napomene. Izbor prijave sam po sebi ne otkriva adresu.']} />
    </View>
  </View>;
}

const REQUIREMENT_ART: Record<string, FactArtKind> = {
  'Veštine': 'tool', 'Alat': 'tool', 'Vozilo': 'vehicle', 'Dozvole': 'document', 'Bitni uslovi': 'info',
  'Najmanje iskustva': 'star', 'Identitet': 'shield', 'Uslovi': 'document',
};

/** The values of a requirement group, one to a line: a bulleted list loses its bullets (the picture is the group's mark), a sentence stays one. */
function valuesOf(value: string): string {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  return lines.length > 0 && lines.every(line => /^[•\-–]\s*/.test(line)) ? lines.map(line => line.replace(/^[•\-–]\s*/, '')).filter(Boolean).join('\n') : value;
}

/** What the task asks of the person who takes it: every supplied value stays visible, each group is a fact with its name under it. */
export function TaskDecisionRequirements({ rows }: { rows: { label: string; value: string }[] }) {
  if (!rows.length) return null;
  return <Section title="Važno za ovaj zadatak">
    <View style={s.requirements}>{rows.map((row, index) => <FactRow key={`${row.label}:${index}`} size="detail"
      art={REQUIREMENT_ART[row.label] ?? 'document'} value={valuesOf(row.value)} note={row.label} />)}</View>
  </Section>;
}

/**
 * A rating with how many reviews it stands on (UX plan 2.11, R27), as the page draws it: the star and "4,7 · 3 ocene"; "Još nema ocena" for none
 * and "Ocena nije dostupna" when the read says nothing (neither has a star: no figure, nothing to rate); "4,7" alone when the read does not say how
 * many. The count is never guessed, so one review cannot pass for fifty.
 */
export function publisherTrust(rating: string | null | undefined, count: number | null | undefined): { text: string; star: boolean } {
  if (count === 0) return { text: 'Još nema ocena', star: false };
  if (!rating) return { text: 'Ocena nije dostupna', star: false };
  return { text: typeof count === 'number' && Number.isSafeInteger(count) && count > 0 ? `${rating} · ${plural(count, 'ocena', 'ocene', 'ocena')}` : rating, star: true };
}

/** The same rating as it is heard: "Ocena 4,7 · 3 ocene", "Još nema ocena", "Ocena nije dostupna". */
export function publisherRatingLine(rating: string | null | undefined, count: number | null | undefined): string {
  const trust = publisherTrust(rating, count);
  return trust.star ? `Ocena ${trust.text}` : trust.text;
}

/** The words of the one action at the foot of a task I can apply to (owner, 8 Oct 2026): a task with a fixed price is applied to, a task without one is answered with an offer. */
export const APPLY_WORDS = { priced: 'Pošalji prijavu', open: 'Pošalji ponudu' } as const;
export const applyActionLabel = (priced: boolean): string => priced ? APPLY_WORDS.priced : APPLY_WORDS.open;

/** The face of a person as a sticker: a ring of the page's own white and the one soft shadow of the screen, round whatever is put in it (a photo or the initials). */
function StickerFace({ photo, initials }: { photo?: ReactNode; initials: string | null }) {
  return <View style={s.sticker}><View style={s.stickerFace}>{photo ?? <Avatar initials={initials} size={FACE} />}</View></View>;
}

/**
 * Who posted it: the one record of the page, the only thing on it that casts a shadow because it is the only thing that is touched (owner, 8 Oct 2026, "Objavio
 * kao kartica poverenja"). A face of 56 as a sticker, the name, the rating with its star, and how reliably the person comes as agreed, only when the server says so
 * (`reliabilityPercent`, from the public work-trust read; nothing is drawn, and nothing is said about what is hidden, when it is not given). Pressing it opens
 * their public profile. A refusal of the safety entry (the one place a person is reported or blocked from) is said under the record, politely, so a screen
 * reader hears it without losing its place.
 */
export function TaskDecisionPublisher({ name, rating, count, reliabilityPercent, photo, initials, onPress, disabled = false, error }: {
  name: string; rating: string | null | undefined; count: number | null | undefined;
  /** "Dolazi kako je dogovoreno": the server's percentage for this person, or nothing. */ reliabilityPercent?: number | null;
  photo?: ReactNode; initials: string | null; onPress?: () => void; disabled?: boolean; error?: string | null;
}) {
  const trust = publisherTrust(rating, count);
  const reliability = typeof reliabilityPercent === 'number' && Number.isFinite(reliabilityPercent) ? `${RELIABILITY_LABEL} · ${Math.round(reliabilityPercent)}%` : null;
  const pressable = !!onPress && !disabled;
  return <Section title="Objavio">
    <Surface kind="record" onPress={pressable ? onPress : undefined} accessibilityLabel={[name, publisherRatingLine(rating, count), reliability].filter(Boolean).join(', ')}
      accessibilityHint={pressable ? 'Otvara javni profil' : undefined}>
      <View style={s.person}>
        <StickerFace photo={photo} initials={initials} />
        <View style={s.personText}>
          <T variant="bodyStrong" style={s.ink}>{name}</T>
          <View style={s.trustRow}>
            {trust.star ? <FactArt kind="star" size={16} /> : null}
            <T variant="note" tone="muted" style={s.tabular}>{trust.text}</T>
          </View>
          {reliability ? <T variant="note" style={s.reliability}>{reliability}</T> : null}
        </View>
        {onPress ? <Glyph name="caret-right" size={20} tone="muted" /> : null}
      </View>
    </Surface>
    {error ? <T accessibilityLiveRegion="polite" variant="note" tone="danger" style={s.refusal}>{error}</T> : null}
  </Section>;
}

/** The face's own size, and the sticker's ring around it. */
const FACE = 56;
const RING = 2;

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  prominentTitle: { textAlign: 'left' },
  // The amount's row has `FactRow`'s own geometry: the 28 picture, 12, the copy with its first line centred on the picture.
  valueRow: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, minHeight: FACT_ROW_ART },
  valueArt: { width: FACT_ROW_ART, height: FACT_ROW_ART },
  valueCopy: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm,
    paddingTop: Math.max(0, (FACT_ROW_ART - (sys.type.priceSmall.lineHeight ?? FACT_ROW_ART)) / 2) },
  // A fact with its ⓘ at the end of the row, the mark centred on the first line of the fact (the picture's 28).
  withInfo: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.xs },
  grow: { flex: 1, minWidth: 0 },
  infoSlot: { height: FACT_ROW_ART, justifyContent: 'center' },
  valueCopyCard: { flex: 1, minWidth: 0, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', columnGap: sys.space.sm,
    paddingTop: Math.max(0, (FACT_ROW_ART - (sys.type.priceRow.lineHeight ?? FACT_ROW_ART)) / 2) },
  amount: { color: sys.color.money, flexShrink: 0 },
  requirements: { gap: layout.group },
  refusal: { paddingTop: sys.space.sm },
  person: { flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  personText: { flex: 1, minWidth: 0, gap: sys.space.xs },
  trustRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.xs },
  tabular: { fontVariant: ['tabular-nums'] },
  reliability: { color: sys.color.fact },
  sticker: { width: FACE + 2 * RING, height: FACE + 2 * RING, borderRadius: sys.radius.pill, backgroundColor: sys.color.surface, alignItems: 'center', justifyContent: 'center',
    ...sys.elevation.card },
  stickerFace: { width: FACE, height: FACE, borderRadius: sys.radius.pill, overflow: 'hidden' },
});
