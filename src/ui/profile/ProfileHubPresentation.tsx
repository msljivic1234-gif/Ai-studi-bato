import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { FactArt } from '../system/FactArt';
import { SettingsAction } from '../settings/SettingsPresentation';
import { Press } from '../Press';
import { T } from '../Text';
import { ruleWidth } from '../system/layout';
import { profileLift, sys } from '../system/tokens';
import { Avatar, FaceEdge } from '../system/Avatar';
import { Glyph } from '../system/Glyph';
import { Screen } from '../system/Screen';
import { Surface } from '../system/Surface';
import { V2Action } from '../v2/V2Action';
import { FigureRow } from './ProfileFigures';
import { AccountHeader } from './AccountHeader';
import type { HubWords } from './hubStates';

/**
 * Figma 2:126: an 88 dp face inside the identity card. The route uses this same
 * measure for both the real photo and its initials; native text stays scalable.
 */
export const PROFILE_AVATAR = 88;
/** The camera mark sits on the photo's edge: a 24 dp disc with a 16 dp glyph leaves the face visible. */
const BADGE = 24;

/** Every place the hub opens. The route turns a choice into navigation behind its own single-flight guard. */
export type ProfileHubPath = '/profil/radnik' | '/profil/podaci' | '/profil/obavestenja' | '/profil/privatnost' | '/profil/blokirani'
  | '/profil/podesavanja' | '/potrebe' | '/moje-prijave' | '/raspored' | '/profil/izvoz' | '/profil/pravna' | '/podrska' | '/profil/o-aplikaciji' | '/profil/lozinka' | '/profil/prijava-greske' | '/ai-istorija';

/** Who the person is, as the route read it: still reading, not readable, or read. */
export type ProfileHubIdentity =
  | { state: 'loading' }
  | { state: 'error'; retry: () => void }
  | { state: 'ready'; name: string | null; place: string | null;
      /** The photo or what stands in for it, using PROFILE_AVATAR. */ photo: ReactNode;
      /** The photo screen can be opened (a profile exists and the read settled). */ photoReady: boolean; openPhoto: () => void;
      /** The rating, the first of the figures under the name (a cell of their row), or nothing. */ reputation: ReactNode };

/** Identity and activity for one account. Account controls live in their dedicated settings route.
 * The route owns reads, navigation admission and public-profile privacy; this view only arranges them.
 */
export function ProfileHub({ identity, capabilityDetail, capabilityNeedsAttention = false, capabilityError = false, onRetryCapability,
  workSummary, stats, busy, open, onBack,
  onViewPublic, sheet, words = {} }: {
  identity: ProfileHubIdentity;
  /** What the work profile says about itself in one line (state, skills, area); left out while it reads, and when its state is not known. */
  capabilityDetail?: string;
  /** The work profile is not set up or is still a draft: an orange dot on its row says that something waits for the person. */
  capabilityNeedsAttention?: boolean;
  /** An optional work read failed; identity and other destinations stay available. */
  capabilityError?: boolean;
  /** Retry only the work read, without reloading identity or inventing an empty work profile. */
  onRetryCapability?: () => void;
  /** The second figure: how many Dogovori were finished (it opens them). */ workSummary?: ReactNode;
  /** The third figure: how reliably the person comes as agreed. */ stats?: ReactNode;
  busy: boolean;
  open: (path: ProfileHubPath) => void; onBack: () => void;
  /** Opens the public profile as other people read it. Left out (no profile to open yet): the row is not drawn. */ onViewPublic?: () => void;
  /** What stands over the screen once it is open (the public profile sheet). */ sheet?: ReactNode;
  /** The state of the rows that have one (open requests, blocked people, the export, the legal documents); a part left out has no word. */ words?: HubWords;
}) {
  const go = (path: ProfileHubPath) => () => open(path);
  return <Screen kind="detail" background="wash" contentStyle={s.content}
    header={<AccountHeader title="Moj profil" onBack={onBack} disabled={busy} />}>
    {/* Separate hosts keep loading semantics out of the ready/error identity after a native transition. */}
    {identity.state === 'loading' ? <View key="loading" testID="profile-identity"
      accessibilityLiveRegion="polite" accessibilityState={{ busy: true }} style={[s.identity, s.reading]}>
      <FactArt kind="person" size={64} />
      <T variant="heading" style={s.center}>Učitavamo profil…</T>
      <T variant="note" tone="muted" style={s.center}>Proveravamo Vaše podatke pre prikaza profila.</T>
    </View> : identity.state === 'error' ? <View key="error" testID="profile-identity" accessible={false}
      accessibilityRole="none" accessibilityLabel="" accessibilityState={{ busy: false }} style={s.identity}>
      <Avatar initials={null} size={PROFILE_AVATAR} />
      <T variant="bodyStrong" style={s.center}>Profil trenutno nije dostupan.</T>
      <T variant="note" tone="muted" style={s.center}>Proverite vezu pa pokušajte ponovo.</T>
      <View style={s.retry}><SettingsAction label="Pokušajte ponovo" kind="secondary" onPress={identity.retry} /></View>
    </View> : <View key="ready" testID="profile-identity" accessible={false}
      accessibilityRole="none" accessibilityLabel="" accessibilityState={{ busy: false }} style={s.identity}>
      {/* The photo itself opens the photo screen; the small camera badge says so without a second control. */}
      <Press accessibilityRole="button" accessibilityLabel="Fotografija profila" accessibilityHint="Otvara izbor fotografije profila."
        disabled={!identity.photoReady || busy} accessibilityState={{ disabled: !identity.photoReady || busy }} onPress={identity.openPhoto}
        haptic="select" scaleTo={sys.motion.scale.row} style={s.face}>
        <FaceEdge>{identity.photo}</FaceEdge>
        {identity.photoReady ? <View style={s.badge}><Glyph name="camera" size={16} /></View> : null}
      </Press>
      {identity.name ? <T variant="pageTitle" accessibilityRole="header" style={[s.center, s.name]}>{identity.name}</T>
        // A name that is not there is a plain line, not a second 28 px title: it must not read as the thing the screen is about.
        : <T variant="title" tone="muted" accessibilityRole="header" style={s.center}>Ime još nije uneto</T>}
      <View style={s.identityDetails}>
        <T tone="muted" style={[s.center, s.detail]}>Jedan nalog · obe mogućnosti</T>
        {identity.place ? <View style={s.city}><FactArt kind="pin" size={16} />
          <T tone="muted" style={[s.shrink, s.detail]}>{identity.place}</T></View> : null}
      </View>
      {/* These are live, independently read figures; no Figma demonstration ratings enter the app. */}
      {identity.reputation || workSummary || stats ? <View style={s.figures}>
        <FigureRow testID="profile-figures">{identity.reputation}{workSummary}{stats}</FigureRow>
      </View> : null}
      {onViewPublic ? <V2Action label="Pogledajte javni profil" tone="neutral" disabled={busy} onPress={onViewPublic}
        style={s.publicButton} labelStyle={s.linkTitle} /> : null}
    </View>}

    <ProfileLink label="Profil za uskakanje" subtitle="Usluge, područje i dostupnost" detail={capabilityDetail}
      attention={capabilityNeedsAttention} disabled={busy} onPress={go('/profil/radnik')}
      onRetry={capabilityError ? onRetryCapability : undefined} />
    <ProfileLink label="Moje prijave" subtitle="Pogledajte status i odgovore" disabled={busy} onPress={go('/moje-prijave')} />
    <ProfileLink label="Podešavanja" subtitle="Nalog, privatnost i obaveštenja" settings disabled={busy} onPress={go('/profil/podesavanja')} />
    <ProfileLink label="Pomoć i podrška" subtitle="Pronađite odgovor ili prijavite problem" detail={words.support} disabled={busy} onPress={go('/podrska')} />
    <ProfileLink label="Moj raspored" subtitle="Dogovori i dostupnost" disabled={busy} onPress={go('/raspored')} />
    {/* The prototype's generic activity card becomes the actual published-task destination.
        Finished collaborations remain reachable through their live figure above. */}
    <ProfileLink label="Moji zadaci" subtitle="Vaše objave i izbor ko uskače" disabled={busy} onPress={go('/potrebe')} />
    {sheet}
  </Screen>;
}

/** Figma profile destination cards, with the route retaining navigation admission. */
function ProfileLink({ label, subtitle, detail, attention, settings, disabled, onPress, onRetry }: {
  label: string; subtitle: string; detail?: string; attention?: boolean; settings?: boolean; disabled: boolean; onPress: () => void;
  onRetry?: () => void;
}) {
  const content = <>
    <View style={s.linkCopy}>
      <T tone={disabled ? 'muted' : 'ink'} style={s.linkTitle}>{label}</T>
      <T tone="muted" style={s.detail}>{detail || subtitle}</T>
    </View>
    {attention ? <View style={s.attention} /> : null}
    {onRetry ? null : <Glyph name={settings ? 'settings' : 'caret-right'} size={20} tone={disabled ? 'muted' : 'ink'} />}
  </>;
  if (onRetry) return <Surface kind="record" variant="elevated" style={s.link}>
    <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={[subtitle, detail].filter(Boolean).join('. ')}
      accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} haptic="select" scaleTo={sys.motion.scale.row} style={s.linkPrimary}>
      {content}
    </Press>
    <Press accessibilityRole="button" accessibilityLabel="Osvežite profil za uskakanje"
      accessibilityHint="Ponovo učitava stanje profila za uskakanje." accessibilityState={{ disabled }}
      disabled={disabled} onPress={onRetry} haptic="select" scaleTo={sys.motion.scale.row} style={s.retryWork}>
      <Glyph name="refresh" size={20} tone={disabled ? 'muted' : 'ink'} />
    </Press>
  </Surface>;
  return <Surface kind="record" variant="elevated" style={s.link} disabled={disabled} onPress={onPress}
    accessibilityLabel={label} accessibilityHint={[subtitle, detail].filter(Boolean).join('. ')}>
    {content}
  </Surface>;
}

const s = StyleSheet.create({
  content: { gap: 20 },
  identity: { ...profileLift, backgroundColor: sys.color.surface, borderRadius: 24, padding: 20, alignItems: 'center', gap: 16 },
  name: { fontSize: 26, lineHeight: 32, fontWeight: '700', letterSpacing: 0, maxWidth: '100%' },
  identityDetails: { gap: 4, alignItems: 'center', maxWidth: '100%' },
  figures: { alignSelf: 'stretch' },
  publicButton: { ...profileLift, alignSelf: 'stretch', minHeight: 54, borderWidth: 0, borderRadius: 16, padding: 16 },
  link: { ...profileLift, borderWidth: 0, borderRadius: 20, padding: 16, minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkCopy: { flex: 1, gap: 4 },
  linkPrimary: { flex: 1, minWidth: 0, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  retryWork: { width: 48, height: 48, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center',
    backgroundColor: sys.color.wash },
  linkTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0 },
  detail: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
  attention: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.orange },
  // The photo's own size and its edge (2 dp each side): the camera mark sits on the corner of this box.
  face: { alignSelf: 'center', borderRadius: sys.radius.pill },
  badge: { position: 'absolute', right: -sys.space.xs, bottom: -sys.space.xs, width: BADGE, height: BADGE, borderRadius: sys.radius.pill,
    backgroundColor: sys.color.surface, borderWidth: ruleWidth, borderColor: sys.color.cardLine, alignItems: 'center', justifyContent: 'center' },
  center: { textAlign: 'center' },
  city: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.xs, maxWidth: '100%' },
  shrink: { flexShrink: 1 },
  retry: { alignSelf: 'center', marginTop: sys.space.xs },
  reading: { minHeight: 284, justifyContent: 'center', paddingHorizontal: sys.space.xl },
});
