import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Press } from '../Press';
import { T } from '../Text';
import { Glyph, type GlyphName } from '../system/Glyph';
import { Screen } from '../system/Screen';
import { sys } from '../system/tokens';
import { AccountHeader } from '../profile/AccountHeader';
import type { ProfileHubPath } from '../profile/ProfileHubPresentation';
import type { HubWords } from '../profile/hubStates';

/** Figma 2:144: compact account groups. Existing destinations and route admission stay intact. */
export function AccountSettings({ email, busy, logoutError, version, words, open, onBack, onLogout }: {
  email?: string | null; busy: boolean; logoutError: boolean; version?: string; words: HubWords;
  open: (path: ProfileHubPath) => void; onBack: () => void; onLogout: () => void;
}) {
  const row = (label: string, glyph: GlyphName, path: ProfileHubPath, detail?: string,
    tone: SettingsIconTone = 'green') =>
    <AccountRow label={label} detail={detail} disabled={busy} glyph={glyph} tone={tone} onPress={() => open(path)} />;
  return <Screen kind="detail" background="wash" contentStyle={s.content}
    header={<AccountHeader title="Podešavanja" onBack={onBack} disabled={busy} />}>
    <AccountGroup title="Nalog">
      {row('Lični podaci', 'profile', '/profil/podaci', 'Ime, fotografija i opis', 'info')}
      {row('Pristup nalogu', 'shield', '/profil/lozinka', 'Promena lozinke')}
    </AccountGroup>
    <AccountGroup title="Korisničko iskustvo">
      {row('AI razgovori', 'messages', '/ai-istorija', 'Zadaci i radni profil', 'violet')}
      {row('Obaveštenja', 'notifications', '/profil/obavestenja', 'Telefon, prijave i zadaci', 'orange')}
      {row('Privatnost i podaci', 'shield', '/profil/privatnost', 'Vidljivost, podaci i blokirane osobe', 'info')}
    </AccountGroup>
    <AccountGroup title="Pomoć">
      {row('Pomoć i podrška', 'messages', '/podrska', words.support ?? 'Odgovori i Vaši zahtevi', 'info')}
      {row('Prijavi grešku', 'info', '/profil/prijava-greske', undefined, 'orange')}
      {row('Pravila i saglasnosti', 'shield', '/profil/pravna', words.legal, 'violet')}
      {row('O aplikaciji', 'settings', '/profil/o-aplikaciji', version, 'muted')}
    </AccountGroup>
    <View style={s.exit}>
      {logoutError ? <T tone="danger" accessibilityRole="alert" style={s.detail}>Odjava nije uspela. Pokušajte ponovo.</T> : null}
      <Press accessibilityRole="button" accessibilityLabel={busy ? 'Sačekajte…' : 'Odjavi se'} accessibilityHint="Otvara potvrdu odjave."
        accessibilityState={{ disabled: busy, busy }}
        disabled={busy} onPress={onLogout} haptic="select" style={s.logout}>
        <Glyph name="logout" size={20} tone={busy ? 'muted' : 'ink'} />
        <T style={s.title} tone={busy ? 'muted' : 'ink'}>{busy ? 'Sačekaj…' : 'Odjavi se'}</T>
      </Press>
      {email ? <T style={[s.detail, s.email]} tone="muted">{email}</T> : null}
    </View>
  </Screen>;
}

function AccountGroup({ title, children }: { title: string; children: ReactNode }) {
  return <View style={s.group}>
    <T accessibilityRole="header" tone="muted" style={s.groupTitle}>{title}</T>
    <View style={s.panel}>{children}</View>
  </View>;
}

type SettingsIconTone = 'green' | 'info' | 'violet' | 'orange' | 'muted';
const iconSurface: Record<SettingsIconTone, string> = {
  green: sys.color.greenSoft, info: sys.color.infoSoft, violet: sys.color.violetSoft,
  orange: sys.color.orangeSoft, muted: sys.color.wash,
};

/** The whole row is one target; the leading symbol names its subject and the
 * trailing caret consistently tells the user that another screen opens. */
function AccountRow({ label, detail, glyph, tone, disabled, onPress }: {
  label: string; detail?: string; glyph: GlyphName; tone: SettingsIconTone; disabled: boolean; onPress: () => void;
}) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityHint={detail}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} haptic="select"
    scaleTo={sys.motion.scale.row} style={s.row}>
    <View style={[s.iconWell, { backgroundColor: disabled ? sys.color.wash : iconSurface[tone] }]}>
      <Glyph name={glyph} size={20} tone={disabled ? 'muted' : tone} />
    </View>
    <View style={s.copy}>
      <T tone={disabled ? 'muted' : 'ink'} style={s.title}>{label}</T>
      {detail ? <T tone="muted" style={s.detail}>{detail}</T> : null}
    </View>
    <Glyph name="caret-right" size={16} tone="muted" />
  </Press>;
}

const s = StyleSheet.create({
  content: { gap: 20 },
  group: { gap: 4 },
  groupTitle: { fontSize: 15, lineHeight: 20, fontWeight: '600', paddingHorizontal: 4 },
  panel: { padding: 4, borderRadius: 24, backgroundColor: sys.color.surface },
  row: { padding: 12, minHeight: 48, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWell: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  copy: { flex: 1, minWidth: 0, gap: 4 },
  title: { fontSize: 15, lineHeight: 20, fontWeight: '600', letterSpacing: 0, flexShrink: 1 },
  detail: { fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: 0 },
  exit: { gap: 4, alignItems: 'center' },
  logout: { minHeight: 48, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  email: { textAlign: 'center', maxWidth: '100%' },
});
