import type { ReactNode } from 'react';
import { readableTitle } from '../../data/needDetailPresentation';
import { StyleSheet, View } from 'react-native';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../contracts/projections';
import { Press } from '../Press';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Avatar } from '../system/Avatar';
import { ScreenChrome } from '../system/ScreenChrome';
import { Disclosure } from '../system/Disclosure';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { FactRow } from '../system/FactRow';
import { Glyph } from '../system/Glyph';
import { ListRow } from '../system/ListRow';
import { MoneyArt } from '../system/MoneyArt';
import { MoneySummary } from '../system/MoneySummary';
import { Section } from '../system/Section';
import { Segmented } from '../system/Segmented';
import { sys } from '../system/tokens';
import { osoba } from '../system/plural';
import { applicationPriceBasisText, BEZ_IZNOSA } from '../../lib/novac';
import { T } from '../Text';

export type AgreementTab = 'pregled' | 'poruke';
/** Named destinations keep the conversation discoverable without squeezing the person's header. Two sets of equal width, never a scroller. */
export function AgreementTabs({ tab, onChange }: { tab: AgreementTab; onChange: (tab: AgreementTab) => void }) {
  return <Segmented options={[{ key: 'pregled', label: 'Pregled' }, { key: 'poruke', label: 'Poruke' }]}
    value={tab} onChange={onChange} />;
}

const states: Record<DogovorProjekcija['stanje'], string> = {
  CONFIRMED: 'Dogovoreno', AWAITING_REQUESTER: 'Čeka se potvrda završetka', COMPLETED: 'Završeno', CANCELLED: 'Otkazano',
};
export const agreementStateText = (state: DogovorProjekcija['stanje']) => states[state];

/**
 * What the OTHER person is to me, in the third person, from the Dogovor's own participants (owner, 2026-09-19): their
 * name stands first, so a sentence about me beside it ("Uskočio si") read as if it were about them. The card, the
 * Dogovor's bar and its people rows say it with these words. Empty when the Dogovor does not say.
 */
export function agreementRole(person: Pick<UcesnikProjekcija, 'uloga'> | null | undefined): string {
  return person?.uloga === 'narucilac' ? 'Traži pomoć' : person?.uloga === 'uskocer' ? 'Uskače na Vaš zadatak' : '';
}

/**
 * The adapter's sentence for an accepted term with neither end (agreementClientService.acceptedSchedule). "Nije potvrđen" read as if
 * somebody's confirmation were awaited, when the term was simply never agreed (a flexible task): the words are "nije dogovoren"
 * since 2026-10-08. A read from before then may still carry the older sentence, so both are known.
 */
export const NO_TERM = 'Termin nije dogovoren';
const NO_TERM_OLD = 'Termin nije potvrđen';
/** A Dogovor that is over never had an exact time, and is no longer waiting for one (round-1 critique A3). */
export const NO_EXACT_TERM = 'Bez tačnog termina';
const SERBIAN_TIME = /\s*\(po vremenu u Srbiji\)/;

/** Whether the accepted term is the adapter's "no term at all" sentence, in either of its spellings. */
export const isNoTermText = (text: string) => text.trim() === NO_TERM || text.trim() === NO_TERM_OLD;

/**
 * The accepted term as a list and the overview draw it (round-1 critique A3, B15): the date as one line, and the zone
 * note, which a phone set outside Serbia carries, on a quiet line of its own instead of breaking the date over three.
 * The words are the adapter's, in Serbian time; only where they stand changes. A finished or cancelled Dogovor whose term
 * never had an end or a start says "Bez tačnog termina": "Termin nije dogovoren" read as a step still to come.
 */
export function agreementTerm({ vremeTekst, stanje }: Pick<DogovorProjekcija, 'vremeTekst' | 'stanje'>): { line: string; zone: string | null } {
  const text = vremeTekst.trim();
  if (isNoTermText(text) && (stanje === 'COMPLETED' || stanje === 'CANCELLED')) return { line: NO_EXACT_TERM, zone: null };
  if (isNoTermText(text)) return { line: NO_TERM, zone: null };
  const zone = SERBIAN_TIME.exec(text);
  if (!zone) return { line: text, zone: null };
  return { line: `${text.slice(0, zone.index)}${text.slice(zone.index + zone[0].length)}`.trim(), zone: 'Po vremenu u Srbiji' };
}

/**
 * A Dogovor on a task for more than one person. Only there does the list of both sides say something the bar does not;
 * on a 1:1 Dogovor the bar already names the one other person (round-1 critique A13).
 */
export const isGroupAgreement = (agreement: Pick<DogovorProjekcija, 'pokrivenost' | 'ucesnici'>) =>
  agreement.pokrivenost.ukupno > 1 || agreement.pokrivenost.popunjeno > 1 || agreement.ucesnici.length > 2;

/** How many people this Dogovor covers, said only when it is not the one person the bar already shows (A13). */
export const agreementPeople = (agreement: Pick<DogovorProjekcija, 'pokrivenost'>): string | null =>
  agreement.pokrivenost.popunjeno === 1 ? null : osoba(agreement.pokrivenost.popunjeno);

/**
 * The top bar of a Dogovor: the arrow back, then the person on the other side, their face or initials and their name,
 * with what they are to me under it. It is the same on Pregled and Poruke, so a tab never changes whom the screen is
 * about. The Dogovor's state is said once, in the next step, not here as well (round-1 critique A13). It is
 * the one chrome's detail bar with the face as its lead. No rating is drawn: the Dogovor does not carry one, and
 * "Još nema ocena" would be a claim about someone who may have many.
 */
export function AgreementPersonBar({ person, back, right }: { person: UcesnikProjekcija; back: () => void; right?: ReactNode }) {
  // The one Avatar: a missing name draws the person, never an empty disc.
  const initials = <Avatar initials={person.inicijali} size={40} />;
  return <ScreenChrome variant="detail" onBack={back} title={person.ime} subtitle={agreementRole(person) || undefined}
    lead={person.profilId ? <ProfilePhoto profileId={person.profilId} size={40} fallback={initials} /> : initials} right={right} />;
}

/**
 * A fact of the compact context in the chat, its spoken label and its full value together ("Termin: 24. sep · 17:00–19:00, Po vremenu u
 * Srbiji"). No fixed height or line limit clips long terms or enlarged text. An amount wears the money colour with its basis beside it;
 * a word about money ("Iznos nije sačuvan") stays ink and has no basis. (The overview draws the same facts as rows: `AgreementTerms`.)
 */
export function AgreementFact({ art, label, value, note, basis, money = false }: {
  art: FactArtKind; label: string; value: string; note?: string | null; basis?: string | null; money?: boolean;
}) {
  return <View accessible accessibilityLabel={`${label}: ${value}${money && basis ? ` ${basis}` : ''}${note ? `, ${note}` : ''}`} style={s.fact}>
    <View style={s.factArt}>{art === 'money' && money ? <MoneyArt size={24} /> : <FactArt kind={art} size={24} cut="art" />}</View>
    <View style={s.factCopy}>
      <T variant="note" style={money ? s.factMoney : s.factValue}>{value}{money && basis ? <T variant="note" tone="muted">{` ${basis}`}</T> : null}</T>
      {note ? <T variant="meta" tone="muted">{note}</T> : null}
    </View>
  </View>;
}

/** Where the work is, as every part of a Dogovor says it: "Na daljinu", the task's coarse area, or that it was never given. Never the private address. */
export const agreementTaskPlace = (a: Pick<DogovorProjekcija, 'rezim' | 'putanjaTekst'>): string =>
  a.rezim === 'DALJINSKI' ? 'Na daljinu' : a.putanjaTekst || 'Mesto nije navedeno';

/**
 * The source task of a Dogovor as the chat's compact context draws it: its title, and one explicit way back to it when the
 * authoritative source task id is available. The overview names the same task as the Dogovor's own title and as the row "Otvori zadatak".
 */
export function AgreementTaskLink({ agreement: a, onOpenTask, disabled = false }: {
  agreement: DogovorProjekcija;
  /** Only provided when the authoritative source task id is available. */
  onOpenTask?: () => void; disabled?: boolean;
}) {
  const title = readableTitle(a.naslov);
  const content = <View style={s.titleRow}>
    <FactArt kind="document" size={24} cut="art" />
    <View style={s.taskCopy}>
      <T accessibilityRole="header" variant="bodyStrong" style={s.ink}>{title}</T>
      <T variant="note" tone={onOpenTask ? 'ink' : 'muted'}>{onOpenTask ? 'Otvori zadatak' : 'Zadatak'}</T>
    </View>
    {onOpenTask ? <Glyph name="caret-right" size={20} tone="muted" /> : null}
  </View>;
  return onOpenTask ? <Press accessibilityRole="button" accessibilityLabel={`Otvori zadatak: ${title}`}
    accessibilityHint="Otvara detalje zadatka iz kog je nastao ovaj Dogovor."
    accessibilityState={{ disabled }} disabled={disabled} haptic="select" onPress={onOpenTask} style={s.hero}>{content}</Press>
    : <View style={s.hero}>{content}</View>;
}

/** An accepted scope that does not fit a row: more than a short line, or one that was written on several lines. */
const longScope = (scope: string) => Array.from(scope).length > 180 || /[\r\n]/.test(scope);
/** The words a Termin row says: the term, with the zone said in the same sentence ("(po vremenu u Srbiji)") on a phone outside Serbia. */
export function termValue(a: Pick<DogovorProjekcija, 'vremeTekst' | 'stanje'>): string {
  const term = agreementTerm(a);
  // The row's label is the word "Termin"; its value does not say it again ("Termin: Termin nije dogovoren").
  if (term.line === NO_TERM) return 'Nije dogovoren';
  return term.zone ? `${term.line} (po vremenu u Srbiji)` : term.line;
}

/**
 * Accepted terms of this individual collaboration: the agreed amount, followed by
 * labeled logistics and scope. Only the public coarse area belongs here. The
 * separately authorized contact section owns any private address. Missing money
 * remains a sentence; it must never look like a zero price or payment receipt.
 * Compact chat keeps its smaller context without another amount panel.
 */
export function AgreementTerms({ agreement: a, compact = false }: { agreement: DogovorProjekcija; compact?: boolean }) {
  const people = osoba(a.pokrivenost.popunjeno);
  const hourly = a.osnovaCene === 'HOURLY';
  const priceLabel = hourly ? 'Dogovorena satnica' : a.osnovaCene === 'TOTAL' ? 'Dogovoreno ukupno' : 'Sačuvani iznos';
  const priceUnit = applicationPriceBasisText(a.osnovaCene);
  const scope = a.prihvacenObim;
  const term = agreementTerm(a), remote = a.rezim === 'DALJINSKI', amount = a.cena.prikaz;
  if (compact) {
    // The overview states the accepted count even for one person; compact chat can omit that repeated fact.
    const compactPeople = agreementPeople(a);
    return <View style={s.facts}>
      <AgreementFact art={remote ? 'remote' : 'pin'} label="Mesto" value={remote ? 'Na daljinu' : a.putanjaTekst || 'Mesto nije navedeno'} />
      <AgreementFact art="calendar" label="Termin" value={term.line} note={term.zone} />
      <AgreementFact art="money" label={amount ? priceLabel : 'Cena'} value={amount || BEZ_IZNOSA} basis={amount ? priceUnit : null} money={/\d/.test(amount)} />
      {compactPeople ? <AgreementFact art="users" label="Ljudi" value={compactPeople} /> : null}
      {scope ? longScope(scope)
        ? <Disclosure label="Obim zadatka" hint="Prihvaćeni opis zadatka" art="document">
          <T selectable>{scope}</T>
        </Disclosure>
        : <View accessible accessibilityLabel={`Obim zadatka: ${scope}`} style={s.acceptedScope}>
          <T variant="meta" tone="muted">Obim zadatka</T>
          <T selectable>{scope}</T>
        </View> : null}
    </View>;
  }
  const price = /\d/.test(amount);
  return <Section title="Uslovi">
    {a.verzija > 1 ? <T variant="meta" tone="muted" style={s.changedNote}>Uslovi su izmenjeni.</T> : null}
    <View style={s.acceptedFacts}>
      {price ? <MoneySummary label={priceLabel} amount={amount} basis={priceUnit} />
        : <FactRow art="money" label="Cena" value={amount || BEZ_IZNOSA} size="detail" />}
      <FactRow art={remote ? 'remote' : 'pin'} label="Mesto" value={agreementTaskPlace(a)} size="detail" />
      <FactRow art="calendar" label="Termin" value={termValue(a)} size="detail" />
      <FactRow art="users" label="Ljudi" value={people} size="detail" />
      {scope ? longScope(scope)
        ? <Disclosure label="Obim zadatka" hint="Prihvaćeni opis zadatka">
          <T selectable>{scope}</T>
        </Disclosure>
        : <View accessible accessibilityLabel={`Obim zadatka: ${scope}`} style={s.scope}>
          <T variant="meta" tone="muted">Obim zadatka</T>
          <T selectable>{scope}</T>
        </View> : null}
    </View>
  </Section>;
}

/** Combined context for compact chat and historical previews; the live overview draws its own sections. */
export function AgreementHero(props: Parameters<typeof AgreementTaskLink>[0]) {
  return <View style={s.context}><AgreementTaskLink {...props} /><AgreementTerms agreement={props.agreement} compact /></View>;
}

/**
 * Both sides of a group Dogovor, each with role and seats; you are marked in words. Rows of the one list (a face is the slot of
 * every row of it), no card and no line but the rows' own. A 1:1 Dogovor does not draw it: the bar names the one other person
 * (round-1 critique A13).
 */
export function AgreementPeople({ agreement }: { agreement: DogovorProjekcija }) {
  return <Section title="Ko je u Dogovoru">
    <View>
      {/* pkg024a: the read names each side's public profile, so the person you agreed to work with
          has a face here. Without that id there is nothing to read a photograph by, and the initials
          stay — an account id must never be handed to the media service in its place. */}
      {agreement.ucesnici.map((person, index) => <ListRow key={person.id} faceSlot last={index === agreement.ucesnici.length - 1}
        leading={person.profilId
          ? <ProfilePhoto profileId={person.profilId} size={56} fallback={<Avatar initials={person.inicijali} size={56} />} />
          : <Avatar initials={person.inicijali} size={56} />}
        title={person.ime}
        subtitle={`${person.uloga === 'narucilac' ? (person.viSte ? 'Vi · tražite pomoć' : 'Traži pomoć') : person.viSte ? 'Vi · uskačete' : 'Uskače'}${person.mesta !== null ? ` · ${osoba(person.mesta)}` : ''}`} />)}
    </View>
  </Section>;
}

/** A row that opens in place: the one `Disclosure`, closed until pressed; `expanded` is spoken. */
export function AgreementSection({ label, summary, art, children }: { label: string; summary?: string; art?: FactArtKind; children: ReactNode }) {
  return <Disclosure label={label} hint={summary} art={art}>{children}</Disclosure>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  hero: { minHeight: 48, justifyContent: 'center' },
  context: { gap: sys.space.base },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  taskCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  facts: { gap: sys.space.xs },
  acceptedFacts: { gap: sys.space.base },
  changedNote: { marginBottom: sys.space.xs },
  scope: { gap: sys.space.xs, paddingVertical: sys.space.md },
  acceptedScope: { gap: sys.space.xs, paddingTop: sys.space.sm },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md, minHeight: 36, paddingVertical: sys.space.xs },
  // The box is the drawing's own 24, so it does not spill 1 px over and under (review r4 rd, small note).
  factArt: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  factCopy: { flex: 1, minWidth: 0 },
  factValue: { color: sys.color.ink },
  factMoney: { color: sys.color.money, fontWeight: '700', fontVariant: ['tabular-nums'] },
});
