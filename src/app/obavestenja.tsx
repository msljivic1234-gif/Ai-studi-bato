import { useCallback, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, Stack, useFocusEffect } from 'expo-router';
import { GearSix } from 'phosphor-react-native';
import type { InboxItem, InboxRole } from '../contracts/inbox';
import { useInbox } from '../hooks/useInbox';
import { useMessagePushIngress } from '../hooks/useMessagePushIngress';
import { applyLocalReads } from '../ui/notifications/inboxCopy';
import { InboxList } from '../ui/notifications/InboxPresentation';
import { useInboxReads } from '../ui/notifications/useInboxReads';
import { DetailTopBar } from '../ui/system/DetailTopBar';
import { PorukaHost, poruka } from '../ui/system/Poruka';
import { ChromeIconButton } from '../ui/system/ScreenChrome';
import { layout } from '../ui/system/layout';
import { sys } from '../ui/system/tokens';
import { T } from '../ui/Text';
import { V2Action } from '../ui/v2/V2Action';

/**
 * The inbox. The list is drawn by `InboxList` (day groups, white cards, a dot for unread); this route owns what
 * a row does: the model resolves it, and the landing below goes exactly where the event points. Message events are
 * acknowledged only by the measured conversation, never by this navigation. The
 * route literals stay in this file: the control table (scripts/control/osvezi.mjs) checks them here.
 *
 * T4a, 2026-10-07: a row can also be settled without being opened (the swipe on the row). That uses the very call a tapped
 * row uses to read itself, kept beside the model (`useInboxReads`) because the model has no command for "read, do not open";
 * its confirmed result is laid over the model's page, and the outcome is said once in a `Poruka`. This screen lies ABOVE the
 * tab navigator that mounts the `Poruka` host, so it mounts its own.
 */
export default function Obavestenja() {
  const [role,setRole] = useState<InboxRole|null>(null);
  const {state,model} = useInbox(role);
  const insets = useSafeAreaInsets();
  const navigating = useRef(false);
  const focus = useRef<object | null>(null);
  const [renderedFocus,setRenderedFocus] = useState<object | null>(null);
  const ingress = useMessagePushIngress(target => {
    if (focus.current === null || navigating.current || !model.canNavigate()) return;
    navigating.current = true;
    if (target.kind === 'OPPORTUNITY') router.replace({pathname:'/prilike/[id]',params:{id:target.needId}});
    else if (target.kind === 'APPLICATION') router.replace({pathname:'/potrebe/[id]/kandidati',params:{id:target.needId,prijavaId:target.responseId}});
    else if (target.kind === 'GROUP_MESSAGE') router.replace({pathname:'/dogovor/[id]/grupa',params:{id:target.agreementId,groupId:target.groupId,messageId:target.messageId,sequence:target.sequence}});
    else router.replace({pathname:'/dogovor/[id]',params:{id:target.agreementId,tab:'poruke',messageId:target.messageId}});
  });
  useFocusEffect(useCallback(() => {
    const visit = {}; focus.current=visit; setRenderedFocus(visit); navigating.current=false;
    return () => { if (focus.current===visit) { focus.current=null; navigating.current=true; } };
  },[model]));
  const current = () => renderedFocus!==null && focus.current===renderedFocus && model.canNavigate() && !navigating.current;
  const navigate = (action: () => void) => { if (!current()) return; ingress.cancel(); navigating.current=true; action(); };
  // The settings open on the set the list is filtered to ("Moje prijave" opens that set); "Sve" leaves the screen's own.
  const settings = () => navigate(() => role
    ? router.push({pathname:'/profil/obavestenja',params:{skup:role}}) : router.push('/profil/obavestenja'));
  async function open(item: InboxItem) {
    if (!current()) return;
    ingress.cancel();
    const target = await model.open(item);
    if (!target || target.kind==='UNAVAILABLE' || !current()) return;
    // A question resolves to the Zadatak it belongs to, because the Need id is the only one the
    // server hands out for a CLARIFICATION. "Neko je postavio pitanje" then opened the task and left
    // the question to be found inside it. The event type says what it was about, so the landing does
    // too — for both sides, since answering and being answered are the same screen.
    const questions = item.eventType.startsWith('CLARIFICATION_');
    // A cancelled Zadatak is not a place to stand: the person who applied to it came to see what
    // happened to their own offer, so they land on it rather than on a task that no longer takes any.
    const cancelledTask = item.eventType === 'NEED_CANCELLED';
    const needTarget = (id: string, own: boolean) => questions ? {pathname:'/pitanja-zadatka' as const,params:{needId:id,own:own?'1':'0'}}
      : own ? {pathname:'/potrebe/[id]/pregled' as const,params:{id}}
      : cancelledTask ? {pathname:'/moje-prijave' as const,params:{}} : {pathname:'/prilike/[id]' as const,params:{id}};
    // Inside a Dogovor the event says which part of it the person came for. Everything else keeps the
    // overview, which is where the next step is stated.
    const agreementTarget = (id: string) => item.eventType === 'AGREEMENT_CHANGE_PROPOSED'
      ? {pathname:'/dogovor/[id]/izmene' as const,params:{id}}
      : {pathname:'/dogovor/[id]' as const,params:{id}};
    const go = () => { switch (target.kind) {
      case 'GROUP_MESSAGE': router.push({pathname:'/dogovor/[id]/grupa',params:{id:target.id,groupId:target.groupId,messageId:target.messageId,sequence:target.sequence}}); break;
      case 'AGREEMENT_MESSAGE': router.push({pathname:'/dogovor/[id]',params:{id:target.id,tab:'poruke',messageId:target.messageId}}); break;
      case 'AGREEMENT': router.push(agreementTarget(target.id)); break;
      case 'APPLICATIONS': router.push({pathname:'/moje-prijave',params:{prijavaId:target.id}}); break;
      case 'CANDIDATE': router.push({pathname:'/potrebe/[id]/kandidati',params:{id:target.id,prijavaId:target.responseId}}); break;
      case 'CANDIDATES': router.push({pathname:'/potrebe/[id]/kandidati',params:{id:target.id}}); break;
      case 'OWN_NEED': router.push(needTarget(target.id,true)); break;
      case 'OPPORTUNITY': router.push(needTarget(target.id,false)); break;
    } };
    // The destination is the thing the event is about, and what the person is to that thing is said
    // on its own screen (owner decision 1, 2026-09-19). There used to be a sheet here asking to
    // switch the whole app into the other mode before an item of "the other intent" could open.
    navigate(go);
  }
  // The rows are memoised, so they get one stable handler that always runs the latest `open`.
  const latestOpen = useRef(open); latestOpen.current = open;
  const onOpen = useCallback((item: InboxItem) => { void latestOpen.current(item); }, []);
  // Settling ONE row without opening it (the swipe). The check is the screen's own `current()` read at the moment of use, so a
  // press that outlives its visit, its account or its set does nothing; the outcome is said once, after the server confirmed it.
  const latestCurrent = useRef(current); latestCurrent.current = current;
  const owns = useCallback(() => latestCurrent.current(), []);
  const reads = useInboxReads(model, owns);
  const latestMarkRead = useRef(reads.markRead); latestMarkRead.current = reads.markRead;
  const onMarkRead = useCallback((item: InboxItem) => {
    void latestMarkRead.current(item).then(done => { if (done) poruka.show({ text: 'Označeno kao pročitano.', confirmed: true }); });
  }, []);
  // The page as the person sees it: what the server confirmed as read one by one laid over the model's page, the row being
  // settled shown as at work, and a failed command said in the same notice an unconfirmed action always uses.
  const view = useMemo(() => {
    const laid = applyLocalReads(state, reads.stamps);
    const acting = laid.acting ?? reads.pending, error = laid.error ?? (reads.failed ? 'action' as const : null);
    return acting === laid.acting && error === laid.error ? laid : { ...laid, acting, error };
  }, [state, reads.stamps, reads.pending, reads.failed]);
  return <SafeAreaView style={styles.screen}>
    <Stack.Screen options={{headerShown:false}}/>
    <DetailTopBar title="Obaveštenja"
      onBack={()=>navigate(()=>router.canGoBack()?router.back():router.replace('/'))}
      right={<ChromeIconButton label="Podesi obaveštenja" icon={GearSix} onPress={settings} />} />
    {ingress.phase ? <View style={styles.opening} accessibilityLiveRegion="polite">
      {ingress.phase === 'loading' ? <View style={styles.openingLine}><ActivityIndicator color={sys.color.green} />
        <T variant="copy">Otvaramo obaveštenje…</T></View> : <>
        <T variant="copy" accessibilityRole="alert">{ingress.phase === 'error' ? 'Nismo uspeli da otvorimo obaveštenje. Proverite vezu i pokušajte ponovo.' : 'Ovo obaveštenje više nije dostupno.'}</T>
        {ingress.phase === 'error' ? <V2Action label="Pokušajte ponovo" onPress={ingress.retry} compact /> : null}
      </>}
      <V2Action label="Prikaži obaveštenja" kind="quiet" onPress={ingress.cancel} compact />
    </View> : null}
    {/* One list for every filter: it stays mounted, so the tab just pressed keeps a screen reader's focus; the list itself
        treats a filter's first page as what was there, not as arrivals. */}
    <InboxList state={view} role={role} onRole={next=>{if(current()){ingress.cancel();setRole(next);}}} onOpen={onOpen} onMarkRead={onMarkRead}
      onReadAll={()=>{if(current()){ingress.cancel();reads.forgetFailure();void model.readAll();}}}
      onRefresh={()=>{if(current()){ingress.cancel();reads.forgetFailure();void model.refresh();}}}
      onMore={()=>{if(current()){ingress.cancel();void model.more();}}} onSettings={settings} />
    <PorukaHost clearance={insets.bottom} />
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  screen:{flex:1,backgroundColor:sys.color.ground},
  // The notice of a message being opened stands on the same edge as the list under it (20), and 8 and 12 apart like everything else.
  opening:{paddingHorizontal:layout.gutter,paddingBottom:sys.space.base,gap:sys.space.sm},
  openingLine:{flexDirection:'row',alignItems:'center',gap:sys.space.md},
});
