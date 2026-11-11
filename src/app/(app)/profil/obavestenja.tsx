import { useCallback, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { PushPreferences } from '../../../ui/notifications/PushPreferences';
import { useSesija, sesijaSada } from '../../../store/sesija';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';
import { DetailTopBar } from '../../../ui/system/DetailTopBar';
import { sys } from '../../../ui/system/tokens';
type ActionScope = { accountId: string; revision: number; leaving: boolean };

/**
 * The notification settings: ONE screen (the approved blueprint of 8 Oct 2026, P4). It used to have two tabs, "Moji zadaci" and "Moje
 * prijave", one for each of the two sets of settings the server keeps for the account, and every global block (the phone, the app's own
 * list, the quiet hours) stood in both. `PushPreferences` now reads and writes both sets, so there is nothing to choose here: no tab, no
 * caption, no set to remember. The inbox still hands over the set it was filtered to (`skup`); it is not read, since every set is on the screen.
 *
 * The bar says "Podešavanja": the screen is opened from Profil and from the gear of Obaveštenja, and the name it had ("Podešavanja
 * obaveštenja") wrapped to two lines on the owner's phone. Nothing here owns the data: this route owns only the leaving.
 */
export default function PushSettings() {
 const { user, accountRevision } = useSesija(); const accountId = user?.id;
 // Unsaved changes. Going back used to throw them away without a word.
 const [dirty, setDirty] = useState(false);
 // A save, or the phone switched on or off, is running: the screen stays until its outcome is read back.
 const [writing, setWriting] = useState(false);
 const confirm = useConfirmSheet();
 const owner = useRef<ActionScope | null>(null);
 const [renderedOwner, setRenderedOwner] = useState<ActionScope | null>(null);
 const view = useMemo(() => ({ dirty, writing }), [dirty, writing]);
 const latestView = useRef(view); latestView.current = view;
 const closeConfirm = confirm.close;
 useFocusEffect(useCallback(() => {
  const scope = accountId ? { accountId, revision: accountRevision, leaving: false } : null; owner.current = scope;
  setRenderedOwner(scope);
  // A question left open when the screen loses focus is retired, never answered later.
  return () => { if (owner.current === scope) owner.current = null; closeConfirm(); };
 }, [accountId, accountRevision, closeConfirm]));
 function current() {
  return renderedOwner !== null && !renderedOwner.leaving && owner.current === renderedOwner && latestView.current === view
   && renderedOwner.accountId === accountId && renderedOwner.revision === accountRevision
   && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
 }
 function back() {
  // An explicit Save/phone registration is still in flight; hardware/header Back
  // must not retire the only screen that owns its readback/unknown outcome.
  if (!current() || !renderedOwner || latestView.current.writing) return;
  // Native blur may follow another press: this visit dispatches its exit only once.
  renderedOwner.leaving = true;
  if (router.canGoBack()) router.back(); else router.replace('/profil');
 }
 /** Asks before unsaved changes are thrown away; the step itself runs its own checks when it is confirmed. */
 function discardThen(proceed: () => void) {
  if (!current() || latestView.current.writing) return;
  if (!dirty) { proceed(); return; }
  // "Odustani" could be read as giving up the changes; the way out of this question keeps them (as on Dostupnost).
  confirm.ask({ title: 'Odbaciti izmene?', message: 'Izmene vrsta obaveštenja i tihih sati nisu sačuvane.', confirmLabel: 'Odbaci izmene',
   cancelLabel: 'Nastavi uređivanje', tone: 'danger', onConfirm: () => { if (current()) proceed(); } });
 }
 const requestBack = () => discardThen(back);
 // Android's own Back asks the same question while something is unsaved; with nothing unsaved it leaves as always.
 const latestBack = useRef({ dirty, writing, requestBack }); latestBack.current = { dirty, writing, requestBack };
 useFocusEffect(useCallback(() => {
  const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
   if (latestBack.current.writing) return true;
   if (!latestBack.current.dirty) return false;
   latestBack.current.requestBack(); return true;
  });
  return () => subscription?.remove();
 }, []));
 return <SafeAreaView style={s.screen} edges={['top', 'bottom']}>
  <Stack.Screen options={{ headerShown: false }} />
  {/* The arrow says only "Nazad": this screen is opened from Profil and from the gear in Obaveštenja, so naming one of
      them would be wrong for the other. */}
  <DetailTopBar title="Podešavanja" onBack={requestBack} />
  <PushPreferences onDirtyChange={setDirty} onWritingChange={setWriting} />
  {confirm.sheet}
 </SafeAreaView>;
}
const s = StyleSheet.create({
 screen: { flex: 1, backgroundColor: sys.color.ground },
});
