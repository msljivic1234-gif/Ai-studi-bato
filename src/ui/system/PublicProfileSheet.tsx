import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { JavniProfilPoverenje, JavniProfilProjekcija } from '../../contracts/projections';
import type { PublicWorkTrust } from '../../data/workTrustClientService';
import { reviewCommentBuilt } from '../../data/reviewCommentGate';
import { inicijali } from '../../lib/inicijali';
import { tidyPlaceLabel } from '../location/placeText';
import { FigureCell, FigureRow, NEW_RATING, finishedFigure, ratingFigure, reliabilityFigure, type Figure } from '../profile/ProfileFigures';
import { memberSincePhrase, publicTrustFacts } from '../profile/workTrustModel';
import { ProductSheet } from '../product/ProductSheet';
import { T } from '../Text';
import { QuietReadState } from '../v2/QuietReadState';
import { Avatar, FaceEdge } from './Avatar';
import { FactArt } from './FactArt';
import { FactRow } from './FactRow';
import { layout } from './layout';
import { ListRow } from './ListRow';
import { StateView } from './StateView';
import { sys } from './tokens';

/** `notFound` is set only after a successful read returned no public projection; a failed read stays recoverable. */
export type PublicProfileState = { loading: boolean; data: JavniProfilProjekcija | null; notFound?: boolean } | null;
/** PKG-047 (F05): the one entry into report/block from a profile. The screen owns the read that turns
 *  this profile into the person behind it; the sheet only offers it and shows what came back. */
export type SafetyEntry = { onPress: () => void; busy: boolean; error: string | null };
/** The label of the safety entry, the same words as the "···" row of a task (review of step 5b). */
export const SAFETY_LABEL = 'Prijavi ili blokiraj osobu';

/**
 * The trust block of a worker profile (PROFILE-TRUST, 2026-10-07; R30), as the SERVER answered it (`rpc_public_work_trust_v1`):
 * how many Dogovori the person made and finished, how reliably they come as agreed (a percentage from five Dogovori) and since when
 * they are here. Who may read the last three is the owner's privacy decision, and the server answers it: for a visitor it is `HIDDEN`
 * today (only the person themself reads them), and the sheet then draws NOTHING about them: no row, no placeholder, no word about what
 * is hidden. The caller reads it (`usePublicWorkTrust`) and hands it in; without it the sheet is exactly what it was.
 */
export type PublicProfileTrust = PublicWorkTrust | null | undefined;

/** The face of the sheet: 72, centred, with the sticker edge (8 Oct 2026, "Lice i tri broja"; the owner's own profile has the same shape at 96). */
const FACE = 72;

/**
 * The rating of a person as a figure of the sheet: the average with the count it stands on, the words "Nova ocena" when the server says
 * there are no reviews, and NOTHING when it says neither (the rating is not available): a figure the server did not return is not drawn.
 */
export function publicRatingFigure(trust: JavniProfilPoverenje): Figure | null {
  if (trust.recenzijeDostupne && trust.brojRecenzija === 0) return NEW_RATING;
  if (trust.ocenaDostupna && typeof trust.ocenaProsek === 'number' && Number.isFinite(trust.ocenaProsek)) {
    const counted = trust.recenzijeDostupne && typeof trust.brojRecenzija === 'number' && trust.brojRecenzija > 0;
    return ratingFigure(trust.ocenaProsek, counted ? trust.brojRecenzija as number : null);
  }
  return null;
}
/** "Na USKOČI-ju od oktobra 2026", from an ISO date; anything that is not a date says nothing. */
export const memberSinceFact = memberSincePhrase;

/**
 * A person's public profile as a sheet over the screen it was opened from (owner decision 3, 2026-09-16; moved onto the
 * one sheet engine in step 7, 2026-09-24, where it was a hand-made page modal). The person's name is the sheet's title —
 * nothing above it says "Javni profil" once the name is known (owner rule, 2026-09-23: say who they are, not where you
 * are). Presentation over the existing `javniProfil` read: a rating, a review count or a verified identity appear solely
 * when the server marks them available. The caller owns the read and its guards.
 *
 * "Lice i tri broja" (owner's pick of 8 Oct 2026): the face at 72 with its sticker edge, centred, the person's own line under it
 * (`naslov`) and the city; then the three figures in one row (the rating, "završenih", "dolazi kako je dogovoreno": each only when the
 * server returned it), the person's own "O meni" when they wrote one, and the confirmations as `FactRow`s with their 2.5D pictures:
 * "Identitet je potvrđen" only when it is true, and what the trust read adds when the server lets this viewer have it ("Dogovoreno N
 * zadataka", "Na USKOČI-ju od ..."). Nothing here is a control except the safety entry, which is last and red: no row opens another
 * person's private received ratings; the existing public-comment reader is a separate, server-authorized list.
 *
 * Reporting and blocking are rare, so they close the sheet's content, apart from the facts by the sheet's own spacing and not by a
 * line: one row that names the person's action ("Prijavi ili blokiraj osobu") and says the report is private. The row keeps the
 * entry's busy and error states.
 */
export function PublicProfileSheet({ state, onClose, onRetry, photo, safety, trust }: {
  state: PublicProfileState; onClose: () => void; onRetry: () => void;
  /** The public portrait at the size asked for (72); its initials stand-in has the same size. */
  photo?: (profileId: string, size?: number) => ReactNode;
  safety?: SafetyEntry;
  /** The trust read of this person (see `PublicProfileTrust`). Left out, or HIDDEN: nothing of it is drawn. */
  trust?: PublicProfileTrust;
}) {
  if (!state) return null;
  const profile = state.loading ? null : state.data, facts = profile?.poverenje;
  const name = profile ? profile.ime?.trim() || 'Ime nije dostupno' : null;
  const initials = profile ? inicijali(profile.ime) : null;
  // Present only when the person wrote something; shown exactly as written.
  const about = profile?.biografija && profile.biografija.trim() ? profile.biografija : null;
  // The public sheet is also used by the offline Design Lab. Load the data-reading child only for an admitted profile in a D12 build.
  const CommentsSection = profile && reviewCommentBuilt()
    ? (require('../reviews/ReviewCommentsSection') as typeof import('../reviews/ReviewCommentsSection')).ReviewCommentsSection
    : null;
  return <ProductSheet title={name ?? 'Javni profil'} closeLabel="Zatvori javni profil" backdropHint="Zatvara javni profil." onClose={onClose}>
    {() => state.loading ? <QuietReadState art="person" title="Učitavamo javni profil…" body="Proveravamo podatke koji smeju da budu javni." />
      : !profile && state.notFound ? <StateView kind="empty" art="person" title="Javni profil nije pronađen."
        body="Nema podataka za javni prikaz ovog profila." />
      : !profile ? <StateView kind="error" title="Javni profil trenutno nije dostupan." body="Proveri vezu i pokušaj ponovo."
        primary={{ label: 'Pokušaj ponovo', onPress: onRetry }} />
      : <View style={s.content}>
        <View style={s.identity}>
          <View testID="public-profile-portrait" accessible={false} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <FaceEdge>{photo?.(profile.profilId, FACE) ?? <Avatar initials={initials} size={FACE} />}</FaceEdge>
          </View>
          {profile.naslov ? <T variant="heading" style={s.line}>{profile.naslov}</T> : null}
          {profile.grad ? <View style={s.place}><FactArt kind="pin" size={16} />
            <T variant="note" tone="muted" style={s.grow}>{tidyPlaceLabel(profile.grad)}</T></View> : null}
        </View>
        {facts ? <TrustFigures facts={facts} trust={trust} /> : null}
        {about ? <View style={s.section}>
          <T accessibilityRole="header" variant="heading" style={s.ink}>O meni</T>
          <T selectable variant="body" style={s.ink}>{about}</T>
        </View> : null}
        {facts ? <Confirmations facts={facts} trust={trust} /> : null}
        {/* The D12 server alone chooses which written reviews this visitor may read; a denied/null response draws nothing. */}
        {CommentsSection ? <CommentsSection profileId={profile.profilId}
          photo={photo ? (authorProfileId, size, fallback) => photo(authorProfileId, size) ?? fallback : undefined} /> : null}
        {safety ? <View>
          {/* A command with its words in red and its arrow: it opens the report, so the row says where it goes. */}
          <ListRow leading={<FactArt kind="shield" size={32} muted />} title={safety.busy ? 'Otvaramo…' : SAFETY_LABEL} tone="danger" arrow last
            subtitle="Osoba koju prijavljujete ne vidi prijavu." disabled={safety.busy} onPress={safety.onPress}
            accessibilityLabel={`${SAFETY_LABEL}: ${name}`}
            accessibilityHint="Otvara prijavu ili blokiranje osobe. Osoba koju prijavljujete ne vidi Vašu prijavu." />
          {safety.error ? <T accessibilityRole="alert" accessibilityLiveRegion="polite" variant="note" tone="danger">{safety.error}</T> : null}
        </View> : null}
      </View>}
  </ProductSheet>;
}

/**
 * The three figures of a person, in one row with no line and no box, each only when the server returned it: the rating ("4,8" with the
 * count it stands on, or "Nova ocena" while there is none), "završenih" (zero too, as zero: the server counted it) and how reliably they
 * come as agreed (a percentage from five Dogovori, or "Još nema procenta"; for a viewer who may not read it, nothing).
 */
function TrustFigures({ facts, trust }: { facts: JavniProfilPoverenje; trust?: PublicProfileTrust }) {
  const reliability = publicTrustFacts(trust)?.reliability;
  const cells: [string, Figure | null][] = [
    ['rating', publicRatingFigure(facts)],
    ['finished', finishedFigure(facts.zavrseniBroj)],
    ['reliability', reliability ? reliabilityFigure(reliability.kind === 'percent' ? reliability.percent : null) : null],
  ];
  return <FigureRow testID="public-profile-figures">
    {cells.map(([key, figure]) => figure ? <FigureCell key={key} figure={figure} testID={`public-profile-figure-${key}`} /> : null)}
  </FigureRow>;
}

/**
 * What the profile confirms, one `FactRow` each with its picture, in a group with the screen's own spacing between them (no line, no
 * box): a verified identity only when the server reports it, and what the trust read returned for a viewer it lets read it ("Dogovoreno N
 * zadataka", "Na USKOČI-ju od ..."). Neither the number of applications nor anything the server does not carry is here.
 */
function Confirmations({ facts, trust }: { facts: JavniProfilPoverenje; trust?: PublicProfileTrust }) {
  const verified = facts.verifikacijaIdentitetaDostupna && facts.identitetVerifikovan;
  const more = publicTrustFacts(trust);
  if (!verified && !more?.agreed && !more?.since) return null;
  return <View testID="public-profile-facts" style={s.facts}>
    {verified ? <FactRow size="detail" art="shield" testID="public-profile-fact-verified" value="Identitet je potvrđen" /> : null}
    {more?.agreed ? <FactRow size="detail" art="agreements" testID="public-profile-fact-agreed" value={more.agreed} /> : null}
    {more?.since ? <FactRow size="detail" art="calendar" testID="public-profile-fact-since" value={more.since} /> : null}
  </View>;
}

const s = StyleSheet.create({
  ink: { color: sys.color.ink },
  grow: { flexShrink: 1, minWidth: 0 },
  content: { gap: layout.section, paddingTop: sys.space.sm, paddingBottom: sys.space.sm },
  // The face, the person's own line and the city stand in one centred column: a long line wraps and stays centred.
  identity: { alignItems: 'center', gap: sys.space.sm },
  line: { color: sys.color.ink, textAlign: 'center' },
  place: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, maxWidth: '100%' },
  facts: { gap: layout.group },
  section: { gap: sys.space.md },
});
