import { useState, type ComponentProps, type ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import type { DogovorProjekcija, UcesnikProjekcija } from '../../contracts/projections';
import { readableTitle } from '../../data/needDetailPresentation';
import { AgreementChat } from '../AgreementChat';
import { ProfilePhoto } from '../media/ContextPhotos';
import { Press } from '../Press';
import { Avatar } from '../system/Avatar';
import { layout } from '../system/layout';
import { chrome, ChromeIconButton } from '../system/ScreenChrome';
import { useTextScale } from '../system/textScale';
import { sys } from '../system/tokens';
import { T } from '../Text';
import { AgreementHero, AgreementTabs, agreementRole } from './AgreementPresentation';

type Props = {
  agreement: DogovorProjekcija;
  person?: UcesnikProjekcija;
  onOverview: () => void;
  /** Inbox entry returns to the inbox; the task identity still opens accepted terms. */
  onBack?: () => void;
  channels?: ReactNode;
  /**
   * The Dogovor's "···" menu (change terms, share the number, report a problem, cancel, and "Prijavi ili blokiraj osobu"): the conversation's
   * own, since the overview has none - its actions are rows of the page (J15) and the person is one tap from them, on the Pregled tab. Absent
   * when the Dogovor offers none. Drawn in the full bar only: with the keyboard up the bar keeps Back and "Uslovi", and the menu is one
   * dismissal of the keyboard away.
   */
  onMore?: () => void;
  waiting?: string | null;
  chat: ComponentProps<typeof AgreementChat>;
};

/**
 * The keyboard owns the screen boundary in the route. This frame measures the space left inside it, so secondary
 * context can yield before it crowds the transcript or the writing controls. At large text the person's full name,
 * role and accepted terms join the history scroll; the short bar always retains Back and the accepted overview.
 * The chat itself never remounts when that composition changes: its draft, selected message and photo tray survive.
 * With room, the bar is the person, the task and "···", and the same Pregled | Poruke tabs as the overview stand under it
 * (proposal R1), so the two halves of a Dogovor are one tap apart from either side.
 */
export function AgreementThreadPresentation({ agreement, person, onOverview, onBack = onOverview, onMore, channels, waiting = null, chat }: Props) {
  const { height } = useWindowDimensions();
  const scale = useTextScale();
  const [availableHeight, setAvailableHeight] = useState<number | null>(null);
  const compact = scale >= 1.6 || (availableHeight ?? height) < 560;
  const title = readableTitle(agreement.naslov);
  const initials = person ? <Avatar initials={person.inicijali} size={40} /> : null;
  const context = compact ? <View testID="agreement-thread-context" style={s.context}>
    {person ? <View style={s.person}>
      {person.profilId ? <ProfilePhoto profileId={person.profilId} size={40} fallback={initials} /> : initials}
      <View style={s.personCopy}>
        <T accessibilityRole="header" variant="bodyStrong">{person.ime}</T>
        {agreementRole(person) ? <T variant="note" tone="muted">{agreementRole(person)}</T> : null}
      </View>
    </View> : null}
    <AgreementHero agreement={agreement} />
    {waiting ? <T variant="bodyStrong" style={s.waiting}>{waiting}</T> : null}
  </View> : null;

  return <View testID="agreement-thread-frame" style={s.frame} onLayout={({ nativeEvent }) => {
    const next = Math.round(nativeEvent.layout.height);
    if (next > 0) setAvailableHeight(current => current === next ? current : next);
  }}>
    {compact ? <View testID="agreement-thread-compact-bar" style={s.bar}>
      <ChromeIconButton label="Nazad" glyph="back" onPress={onBack} />
      <View style={s.barTitle}>
        <T accessibilityRole="header" accessibilityLabel={person ? `Poruke: ${person.ime}` : 'Poruke'} variant="bodyStrong" numberOfLines={1}>
          {person && scale < 1.6 ? person.ime : 'Poruke'}
        </T>
        {scale < 1.6 ? <T variant="meta" tone="muted" numberOfLines={1}>{title}</T> : null}
      </View>
      <Press accessibilityRole="button" accessibilityLabel={`Uslovi Dogovora: ${title}${waiting ? `. ${waiting}` : ''}`}
        accessibilityHint="Otvara pregled prihvaćenih uslova i narednih koraka." onPress={onOverview} haptic="select" hitSlop={0} style={s.overview}>
        {waiting ? <View style={s.dot} /> : null}
        <T variant="note" tone="green">Uslovi</T>
      </Press>
    </View> : <>
      <View testID="agreement-thread-full-bar" style={s.bar}>
        <ChromeIconButton label="Nazad" glyph="back" onPress={onBack} />
        {person ? person.profilId ? <ProfilePhoto profileId={person.profilId} size={40} fallback={initials} /> : initials : null}
        {/* The person alone cannot identify a conversation when we share several jobs. Keep this exact task
            beside the person, with one explicit way back to its accepted terms (the Pregled tab says the same below). */}
        <Press accessibilityRole="button" accessibilityLabel={`Dogovor: ${title}${person ? `. ${person.ime}` : ''}`}
          accessibilityHint="Otvara pregled prihvaćenih uslova i narednih koraka."
          onPress={onOverview} haptic="select" hitSlop={0} style={s.threadIdentity}>
          {/* The name in the type the bar of Pregled gives it (the chrome's title), and the task under it in the chrome's own second line, so the
              bar does not change its look when the tab does. */}
          <View style={s.identity}>
            <T accessibilityRole="header" variant="title" numberOfLines={1}>{person?.ime || 'Poruke'}</T>
            <T variant="meta" tone="muted" numberOfLines={1}>{title}</T>
          </View>
        </Press>
        <Press accessibilityRole="button" accessibilityLabel={`Uslovi Dogovora: ${title}${waiting ? `. ${waiting}` : ''}`}
          accessibilityHint="Otvara pregled prihvaćenih uslova i narednih koraka." onPress={onOverview} haptic="select" hitSlop={0} style={s.overview}>
          {waiting ? <View style={s.dot} /> : null}
          <T variant="note" tone="green">Uslovi</T>
        </Press>
        {onMore ? <ChromeIconButton glyph="more" label="Više radnji" hint="Izmena uslova, deljenje broja, prijava problema, otkazivanje, blokiranje osobe"
          onPress={onMore} /> : null}
      </View>
      <View testID="agreement-thread-tabs" style={s.hiddenTabs} accessibilityElementsHidden={true} importantForAccessibility="no-hide-descendants"><AgreementTabs tab="poruke" onChange={tab => { if (tab === 'pregled') onOverview(); }} /></View>
      {waiting ? <View style={s.waitingRow}><T variant="note" style={s.waiting}>{waiting}</T></View> : null}
    </>}
    {channels ? <View style={s.tabs}>{channels}</View> : null}
    <AgreementChat {...chat} compact={compact} context={context} sender={message => {
      const member = agreement.ucesnici.find(item => message.posiljalacAccountId ? item.id === message.posiljalacAccountId : item.viSte === message.moja);
      const fallback = <Avatar initials={member?.inicijali ?? null} size={40} />;
      return <View style={[s.sender, message.moja && s.senderMine]}>
        {member?.profilId ? <ProfilePhoto profileId={member.profilId} size={40} fallback={fallback} /> : fallback}
        <T variant="note" tone="muted">{member?.ime || (message.moja ? 'Vi' : message.posiljalacIme || 'Sagovornik')}</T>
      </View>;
    }} />
  </View>;
}

const s = StyleSheet.create({
  frame: { flex: 1, minHeight: 0 },
  // The bar, the tabs and the sentence about what waits stand on the edge of every screen (`layout.gutter`, the chrome's own), so the arrow
  // back is where it is on Pregled: it does not jump when the tab changes. The list of messages (16) and the composer (12) are the
  // conversation's one recognised exception (`layout.chatList`, `layout.chatComposer`).
  bar: { flexDirection: 'row', alignItems: 'center', gap: chrome.gap, paddingHorizontal: chrome.paddingHorizontal, paddingVertical: chrome.paddingVertical,
    backgroundColor: sys.conversation.ground },
  barTitle: { flex: 1, minWidth: 0 },
  tabs: { paddingHorizontal: layout.gutter, paddingBottom: sys.space.sm, backgroundColor: sys.conversation.ground },
  hiddenTabs: { height: 0, opacity: 0, overflow: 'hidden', position: 'absolute' },
  identity: { flex: 1, minWidth: 0 },
  threadIdentity: { flex: 1, minWidth: 0, minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  overview: { minHeight: layout.touch, minWidth: layout.touch, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: sys.space.xs,
    paddingHorizontal: sys.space.md, borderRadius: sys.radius.pill, borderWidth: 1, borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.warn },
  waitingRow: { paddingHorizontal: layout.gutter, paddingBottom: sys.space.sm },
  // The context joins the history's scroll at a large text size; it is parted from the first message by space, not by a line.
  context: { gap: sys.space.base, paddingBottom: layout.section, marginBottom: sys.space.md },
  person: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  sender: { flexDirection: 'row', alignItems: 'center', gap: sys.space.sm, paddingVertical: sys.space.xs },
  senderMine: { alignSelf: 'flex-end' },
  personCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  waiting: { color: sys.color.warn },
});
