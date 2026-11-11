import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import type { SupportMode } from '../../data/supportCaseTypes';
import { SettingsAction, SettingsGroup, SettingsIntro, SettingsRow } from '../settings/SettingsPresentation';
import { Segmented } from '../system/Segmented';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import type { SupportState } from './SupportController';
import { SupportCaseRow, SupportFrame, SupportLoading, SupportNote, SupportPrivacy, supportLabel, supportStyles, supportTime } from './SupportPresentation';
import { SupportFaq } from './SupportFaq';
import { SupportRecoveryPanel } from './SupportRecoveryPanel';
import { supportMessageTone } from './supportCopy';
import { useSupportController } from './useSupportController';

export function SupportInboxScreen({ mode = 'OWN', onMode }: { mode?: SupportMode; onMode?: (mode: 'OPERATOR' | 'SAFETY') => void }) {
  const model = useSupportController({ type: 'INBOX', mode });
  return <SupportInboxView model={model} mode={mode} onMode={onMode} />;
}

/** Why the one green action is grey, when it is: said under it, never a bare grey button (owner's rule). */
const NEW_UNAVAILABLE = 'Novi zahtev trenutno nije dostupan ovom nalogu.';

/**
 * Podrška (round 5, owner step 11b; UI/UX pass 2026-10-07): the person's private requests as a list that says what each
 * is about, its state (the chip of the whole app) and when it last moved, with news as an orange dot; one way to start a
 * new request (the footer: grey with its reason when it cannot be used, never missing without a word); and, apart, the two
 * places for blocking and data rights. Authorised staff get the same list with a switch between their two inboxes.
 *
 * A refresh the person asked for (a pull of the screen, no standing word "Osveži") keeps the list and the footer on screen (the quiet read state is
 * for the first read and for a page that is being fetched, never a wipe of what was just read). With no requests the list says so in one
 * line, "Nema tvojih zahteva." (owner's phone, 8 Oct 2026: "Još nema primljenih zahteva" spoke of what support received, and these are the
 * person's own), and the green "Novi zahtev" under it is the way forward. The sentence about who reads a request is on the screen that
 * writes one, not on this list. Presentation over the controller's state: every command is the controller's, fenced by `current()` / `navigate()`.
 */
export function SupportInboxView({ model, mode, onMode }: {
  model: ReturnType<typeof useSupportController>; mode: SupportMode; onMode?: (mode: 'OPERATOR' | 'SAFETY') => void;
}) {
  const { state, controller, current, navigate } = model;
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  useEffect(() => { setCursors([null]); }, [model.incarnation]);
  // The last full read of THIS visit (a new focus, account or incarnation is a new visit and starts empty): a re-read
  // the person asked for draws it again instead of the first-read state. It is read-only here; every command still needs a READY state.
  const settled = useRef<{ incarnation: unknown; state: SupportState } | null>(null);
  // A new visit, a backgrounded app or another account drops it at once: a private list is never kept in memory past the
  // controller that read it (the controller wipes its own state on dispose, and this memory goes with it).
  if (settled.current && settled.current.incarnation !== model.incarnation) settled.current = null;
  if (state.phase === 'READY' && state.inbox && state.capabilities) settled.current = { incarnation: model.incarnation, state };
  const kept = state.phase === 'LOADING' && state.command === 'READ' && settled.current?.incarnation === model.incarnation ? settled.current.state : null;
  const shown = kept ?? state;
  const busy = state.phase === 'LOADING' || state.phase === 'SENDING', inbox = shown.inbox, capabilities = shown.capabilities;
  // Rows and ways onward wait only while something is being sent or read for the first time; a re-read keeps them usable.
  const locked = state.phase === 'SENDING' || (state.phase === 'LOADING' && !kept);
  const page = (cursor: string | null, back = false) => {
    if (!current() || busy) return;
    setCursors(previous => back ? previous.slice(0, -1) : [...previous, cursor]);
    void controller?.page(cursor, state);
  };
  const reload = () => { if (current()) void controller?.load(); };
  const messageTone = supportMessageTone(state);
  const newReason = busy ? 'Učitavamo zahteve…' : !capabilities?.canCreate ? NEW_UNAVAILABLE : state.pending ? 'Najpre proveri prethodno slanje.' : null;
  return <SupportFrame title={mode === 'OWN' ? 'Podrška' : mode === 'SAFETY' ? 'Bezbednosni zahtevi' : 'Zahtevi'}
    onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}
    // A failed list read has its own green retry in the error state; the footer's green action waits for the list, so the
    // screen never shows two primaries (round 5 review). When the account cannot start a request, or one waits to be
    // checked, the action stays and is grey with the reason beside it.
    refresh={{ onRefresh: () => { if (!busy) reload(); }, busy }}
    footer={mode === 'OWN' && capabilities && state.phase !== 'ERROR' ?
      <SettingsAction label="Novi zahtev" disabled={newReason !== null} reason={newReason} onPress={() => navigate(() => router.push('/podrska/novi'))} /> : undefined}>
    {mode !== 'OWN' && inbox?.operatorAvailable && onMode ? <Segmented appearance="underline" value={mode === 'SAFETY' ? 'SAFETY' : 'OPERATOR'}
      options={[{ key: 'OPERATOR', label: 'Svi zahtevi' }, { key: 'SAFETY', label: 'Bezbednosni zahtevi' }]}
      onChange={next => { if (current() && !busy) onMode(next); }} /> : null}
    {/* Staff need the rule of the list; a person's own list explains itself. */}
    {mode !== 'OWN' ? <SettingsIntro>Otvaranje predmeta ne znači da je obrada preuzeta. Preuzmi ga iz detalja kada započneš pregled.</SettingsIntro> : null}
    <SupportRecoveryPanel model={model} />
    {state.message && !state.pending && state.phase !== 'ERROR' ? <SupportNote tone={messageTone === 'success' ? 'info' : messageTone}>{state.message}</SupportNote> : null}
    {state.phase === 'LOADING' && !kept ? <SupportLoading />
      : state.phase === 'ERROR' ? <StateView kind="error" art="chat" title="Zahtevi nisu učitani" body={state.message ?? undefined}
        primary={{ label: 'Pokušaj ponovo', onPress: reload, disabled: busy }} />
      : inbox ? <SettingsGroup title={mode === 'OWN' ? 'Vaši zahtevi' : 'Zahtevi'}>
        {inbox.cases.length ? inbox.cases.map((item, index) => <SupportCaseRow key={item.id} topic={supportLabel(item.topic)} status={item.status}
          channel={item.channel} time={supportTime(item.updatedAt)} caseNumber={item.caseNumber} unread={item.unread}
          last={index === inbox.cases.length - 1} disabled={locked}
          onPress={() => navigate(() => router.push({ pathname: '/podrska/[id]', params: { id: item.id } }))} />)
          : mode === 'OWN'
            // One line and no action of its own: the green "Novi zahtev" below is the screen's one way forward.
            ? <StateView kind="empty" art="chat" compact title="Nema Vaših zahteva." />
            : <StateView kind="empty" art="chat" title="Nema zahteva na ovoj stranici." />}
        {cursors.length > 1 || inbox.nextBeforeCaseNumber ? <View style={supportStyles.pager}>
          {cursors.length > 1 ? <SettingsAction label="Prethodna stranica" kind="quiet" disabled={busy}
            onPress={() => page(cursors[cursors.length - 2], true)} /> : <View />}
          {inbox.nextBeforeCaseNumber ? <SettingsAction label="Stariji zahtevi" kind="quiet" disabled={busy}
            onPress={() => page(inbox.nextBeforeCaseNumber)} /> : null}
        </View> : null}
      </SettingsGroup> : null}
    {/* The questions people ask before they write: answered where they are asked, for the person's own list only. */}
    {mode === 'OWN' && state.phase !== 'ERROR' ? <SupportFaq /> : null}
    {mode !== 'OWN' ? <View style={s.privacy}><SupportPrivacy safety={mode === 'SAFETY'} /></View> : null}
    {capabilities?.operatorAvailable && mode === 'OWN' ? <SettingsGroup title="Ovlašćena obrada">
      <SettingsRow label="Otvori sve zahteve" detail="Pristup odobren ovom nalogu." disabled={locked} last
        onPress={() => navigate(() => router.push('/podrska/operator'))} />
    </SettingsGroup> : null}
    {mode === 'OWN' ? <SettingsGroup title="Bezbednost i podaci">
      <SettingsRow compact label="Blokirane osobe" disabled={locked}
        onPress={() => navigate(() => router.push('/profil/blokirani'))} />
      <SettingsRow compact label="Privatnost i podaci" disabled={locked} last
        onPress={() => navigate(() => router.push('/profil/privatnost'))} />
    </SettingsGroup> : null}
  </SupportFrame>;
}

const s = StyleSheet.create({ privacy: { gap: sys.space.sm } });
