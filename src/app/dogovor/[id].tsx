import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, ScrollView, Platform, KeyboardAvoidingView, Keyboard, BackHandler, AppState, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import type { DogovorProjekcija } from '../../contracts/projections';
import type { Ishod } from '../../data/ports';
import { T } from '../../ui/Text';
import { layout } from '../../ui/system/layout';
import { sys } from '../../ui/system/tokens';
import { ActionSheet } from '../../ui/system/ActionSheet';
import { useReducedMotion } from '../../ui/system/motion';
import { PorukaHost } from '../../ui/system/Poruka';
import { V2Action } from '../../ui/v2/V2Action';
import { AgreementTabs, AgreementPersonBar, isNoTermText, type AgreementTab } from '../../ui/v2/AgreementPresentation';
import { WorkspaceFooter, agreementNextStep, agreementQuietLine, agreementStepsInfo, agreementWaitsForMe } from '../../ui/agreements/AgreementWorkspace';
import { AgreementCompletionReview } from '../../ui/agreements/AgreementCompletionReview';
import { AgreementOverview } from '../../ui/agreements/AgreementOverview';
import { ADDRESS_REQUEST_TEXT } from '../../ui/agreements/agreementContactModel';
import { AgreementProblemExits, AgreementStatusView, AgreementProblemForm, AgreementProblemNote, AgreementProblemUnknown, overviewContent } from '../../ui/agreements/AgreementOverviewParts';
import { cancellationDetailsOf } from '../../ui/agreements/agreementListModel';
import { agreementMenuActions } from '../../ui/agreements/agreementMenu';
import type { OwnRating } from '../../ui/agreements/agreementStepsModel';
import { ProductHeader } from '../../ui/product/ProductDetails';
import { useIzvor } from '../../store/uloga';
import { useAgreementHistory } from '../../hooks/useAgreementHistory';
import { useOwnedEditor } from '../../hooks/useOwnedEditor';
import { useAgreementOutbox } from '../../hooks/useAgreementOutbox';
import { useAgreementPhotos } from '../../hooks/useAgreementPhotos';
import { useAgreementIncomingRefresh } from '../../hooks/useAgreementIncomingRefresh';
import type { AgreementReadingPosition } from '../../ui/AgreementChat';
import { agreementMessageHistoryService } from '../../data/agreementMessageHistoryService';
import { useSesija, sesijaSada } from '../../store/sesija';
import { AgreementThreadPresentation } from '../../ui/v2/AgreementThreadPresentation';
import { GroupConversationEntry } from '../../ui/groups/GroupConversationEntry';
import { useGroupContext } from '../../ui/groups/useGroupContext';
import { ConversationChannels, privateConversationChoices } from '../../ui/groups/ConversationChannels';
import { needScheduleText } from '../../data/needDetailPresentation';
import { agreementProblemService, knownProblemRefusal, type AgreementProblemSnapshot } from '../../data/agreementClientService';
import { agreementCancellationService, cancellationOf, type AgreementCancellation } from '../../data/agreementCancellationClientService';
import { reviewsClientService } from '../../data/reviewsClientService';
import { completionDenial } from '../../data/agreementCompletion';
import { calendarInstant } from '../../lib/calendarTime';

/**
 * My rating of a finished Dogovor, from the review read the rating screen itself uses. `DUE` and `UNKNOWN` both keep
 * "Oceni saradnju" on offer (a read that did not answer must not hide the only way to rate); `GIVEN` and `CLOSED` are
 * the review read saying there is nothing left to rate, and the footer says the state in words (the type lives with the step bar).
 */
type ProblemWorkspace = DogovorProjekcija & {
  problemReport: AgreementProblemSnapshot['report'];
  problemReportState: AgreementProblemSnapshot['state'] | 'UNAVAILABLE';
  ownRating: OwnRating;
};
type CompletionReview = { agreement: ProblemWorkspace; focus: object; readEpoch: number };
async function bounded<T>(operation: () => Promise<T>, ms = 15_000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    // Caller timeout does not claim that the server cancelled or rejected a write.
    return await Promise.race([operation(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('AGREEMENT_REQUEST_UNCONFIRMED')), ms);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); }
}
function backToAgreements() { if (router.canGoBack()) router.back(); else router.replace('/dogovori'); }
function AgreementStatus(props: { loading?: boolean; error?: boolean; retry?: () => void }) { return <AgreementStatusView {...props} back={backToAgreements} />; }
export default function Dogovor() {
  // A notification about a message opens the conversation itself, not the overview it lives behind.
  const { id, tab, messageId, from } = useLocalSearchParams<{ id: string | string[]; tab?: string | string[]; messageId?: string | string[]; from?: string | string[] }>();
  const session = useSesija(), accountId = session.user?.id;
  if (typeof id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id) || !accountId) return <AgreementStatus />;
  if (messageId !== undefined && (typeof messageId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(messageId))) return <AgreementStatus />;
  return <DogovorContent key={`${accountId}:${session.accountRevision}:${id}`} id={id} accountId={accountId} accountRevision={session.accountRevision}
    fromInbox={from === 'poruke'} requestedTab={tab === 'poruke' ? 'poruke' : 'pregled'} requestedMessageId={tab === 'poruke' ? messageId?.toLowerCase() : undefined} />;
}
function DogovorContent({ id, accountId, accountRevision, requestedTab, requestedMessageId, fromInbox }: {
  id: string; accountId: string; accountRevision: number; requestedTab: AgreementTab; requestedMessageId?: string; fromInbox: boolean;
}) {
  const izvor = useIzvor();
  const [tab, updateTab] = useState<AgreementTab>(requestedTab);
  // A retained geometry callback from a prior Poruke visit cannot acknowledge a later visit.
  const chatVisit = useRef<object>({}), tabRef = useRef(tab);
  const setTab = useCallback((next: AgreementTab) => {
    if (next !== tabRef.current) { chatVisit.current = {}; tabRef.current = next; }
    updateTab(next);
  }, []);
  // The router may retain this account/Agreement while changing its tab intent.
  // Consume that change once; later renders/focus must preserve the user's tab.
  useEffect(() => { setTab(requestedTab); }, [requestedTab, requestedMessageId, setTab]);
  const renderedChatVisit = chatVisit.current;
  // Survives the foreground freshness gate and the Pregled/Poruke switch, but not
  // a different account incarnation or Agreement (the route content is keyed above).
  // An arriving P4 target creates a fresh bounded B3 window/geometry owner. It does
  // not remount the Agreement, workspace, photo intents or persistent send journal.
  // The router ID is only an intent: B3 must independently authorize the exact row.
  const chatReadingPosition = useMemo<{ current: AgreementReadingPosition }>(() => ({ current: requestedMessageId
    ? { following: false, offset: 0, anchor: { messageId: requestedMessageId, within: 0 } }
    : { following: true, offset: 0 } }), [requestedMessageId]);
  const [problemOpen, setProblemOpen] = useState(false), [problemText, setProblemText] = useState('');
  const [problemAttempt, setProblemAttempt] = useState<string | null>(null);
  const problemAttemptRef = useRef<string | null>(null);
  const [completionReview, setCompletionReview] = useState<CompletionReview | null>(null);
  const [completing, setCompleting] = useState(false);
  // The "···" menu of the conversation (the overview has none: its actions are rows of the page, J15), and where the page's own sections
  // stand so a menu entry can take the person to them.
  const [menuOpen, setMenuOpen] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const anchors = useRef<{ problem: number | null; place: number | null }>({ problem: null, place: null });
  // A menu entry chosen in the conversation names a section of the overview: it waits here until the overview has been laid out.
  const waitingAnchor = useRef<'problem' | 'place' | null>(null);
  // The footer's height, so the outcome bar (Poruka) floats above it.
  const [footerHeight, setFooterHeight] = useState(0);
  const reducedMotion = useReducedMotion();
  const completionDisplay = useRef<object | null>(null);
  const completionReviewRef = useRef<CompletionReview | null>(null), completionReadEpoch = useRef(0);
  const closeCompletionReview = useCallback(() => {
    completionReviewRef.current = null; setCompletionReview(null);
  }, []);
  const formFocus = useRef<object | null>(null);
  const [renderedFormFocus, setRenderedFormFocus] = useState<object | null>(null);
  useFocusEffect(useCallback(() => {
    const focus = {}; formFocus.current = focus;
    // Focus must reach effects and callbacks even before either independent read settles.
    setRenderedFormFocus(focus);
    return () => { if (formFocus.current === focus) {
      formFocus.current = null; closeCompletionReview();
      completionDisplay.current = null; setCompleting(false);
    } };
  }, [accountId, accountRevision, closeCompletionReview]));
  const ownsAccount = useCallback(() => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const read = useCallback(async (): Promise<Ishod<ProblemWorkspace | null>> => {
    // A review belongs to one exact read. Invalidate synchronously, before a refresh
    // can yield: neither a retained confirm nor a retained opener may reuse its terms.
    completionReadEpoch.current++; closeCompletionReview();
    if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvorite Dogovor.' };
    try {
      const data = await bounded(() => izvor.dogovor(id));
      if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvorite Dogovor.' };
      if (data && data.id !== id) return { ok: false, kod: 'INVALID_RESPONSE', poruka: 'Dogovor nije dostupan.' };
      if (!data) return { ok: true, podatak: null };
      // "Oceni saradnju" stayed on the footer after the rating was saved (phone, 2026-09-23): the workspace read does
      // not say whether MY review exists. The existing own-review read does; it is asked only for a finished Dogovor
      // I am a party of, inside this same guarded read, and like the problem details below it can never erase the
      // Agreement it describes: a read that fails leaves the rating on offer.
      let ownRating: OwnRating = 'NOT_APPLICABLE';
      if (data.stanje === 'COMPLETED' && data.ucesnici.some(party => party.viSte && party.id === accountId)) {
        // It runs after the workspace read, before the Dogovor first shows; a failed read changes nothing (the rating
        // stays on offer), so it gets 5 s rather than the 15 s a command gets.
        const review = await bounded(() => reviewsClientService.context(id, { accountId, accountRevision }), 5_000).catch(() => null);
        if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvorite Dogovor.' };
        ownRating = !review?.ok ? 'UNKNOWN' : review.podatak.review ? 'GIVEN' : review.podatak.eligible ? 'DUE' : 'CLOSED';
      }
      if (data.problemOtvoren) {
        const result = await agreementProblemService.read(id, data.verzija, data.ucesnici.map(party => party.id), { accountId, accountRevision })
          .catch(() => null);
        if (!ownsAccount()) return { ok: false, kod: 'ACCOUNT_CHANGED', poruka: 'Nalog je promenjen. Ponovo otvorite Dogovor.' };
        if (result?.ok && result.podatak.state === 'AVAILABLE') {
          return { ok: true, podatak: { ...data, problemReport: result.podatak.report, problemReportState: 'AVAILABLE', ownRating } };
        }
        // Optional report details cannot erase an independently read Agreement.
        // The base open flag remains authoritative; absent/conflicting detail is unknown.
        return { ok: true, podatak: { ...data, problemReport: null,
          problemReportState: result?.ok && result.podatak.state === 'LEGACY_UNAVAILABLE' ? 'LEGACY_UNAVAILABLE' : 'UNAVAILABLE', ownRating } };
      }
      return { ok: true, podatak: { ...data, problemReport: null, problemReportState: 'ABSENT', ownRating } };
    } catch { return { ok: false, kod: 'AGREEMENT_READ_FAILED', poruka: 'Dogovor nije učitan. Proverite vezu i pokušajte ponovo.' }; }
  }, [izvor, id, accountId, accountRevision, ownsAccount, closeCompletionReview]);
  const workspace = useOwnedEditor(read);
  const renderedCompletionRead = completionReadEpoch.current;
  const activeRef = useRef(!AppState.currentState || AppState.currentState === 'active');
  const freshRef = useRef(activeRef.current), resumeGeneration = useRef(0);
  const [foreground, setForeground] = useState(activeRef.current);
  const [resumeRequired, setResumeRequired] = useState(!activeRef.current);
  const [resumeEpoch, setResumeEpoch] = useState(0);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      // Android may repeat active without leaving the foreground (for example around microphone access).
      // It is not a new visit: keep chat controls and the current workspace until a real lifecycle edge.
      if (state === 'active' && activeRef.current) return;
      closeCompletionReview();
      chatVisit.current = {};
      activeRef.current = state === 'active';
      freshRef.current = false;
      resumeGeneration.current++;
      setResumeEpoch(resumeGeneration.current);
      setForeground(activeRef.current); setResumeRequired(true);
    });
    return () => { subscription.remove(); activeRef.current = false; freshRef.current = false; resumeGeneration.current++; };
  }, [closeCompletionReview]);
  useEffect(() => {
    // Wait for an in-flight mutation, then replace the pre-background snapshot.
    // A retained callback remains fenced throughout the resume read.
    if (!foreground || !resumeRequired || workspace.busy) return;
    let current = true;
    const generation = resumeGeneration.current;
    void workspace.refresh().then(() => {
      if (!current || !activeRef.current || generation !== resumeGeneration.current) return;
      freshRef.current = true; setResumeRequired(false);
    });
    return () => { current = false; };
  }, [foreground, resumeRequired, resumeEpoch, workspace.busy, workspace.refresh]);
  const messages = useAgreementHistory(accountId, accountRevision, id, chatReadingPosition);
  const dogovor = workspace.data;
  // When, by whom and why a cancelled Dogovor was cancelled (CANCEL-INFO): asked once the read says it is cancelled, in one call. A read that
  // fails, or has not come, leaves the step bar saying only "Otkazano" - nothing is guessed.
  const cancelled = dogovor?.stanje === 'CANCELLED';
  const [cancellation, setCancellation] = useState<AgreementCancellation | null>(null);
  useEffect(() => {
    if (!cancelled) return;
    let live = true;
    void agreementCancellationService.read([id], { accountId, accountRevision })
      .then(result => { if (live && result.ok) setCancellation(cancellationOf(result.podatak, id)); }).catch(() => undefined);
    return () => { live = false; };
  }, [cancelled, id, accountId, accountRevision]);
  // The adapter can only say "Ja" or "Sagovornik"; the workspace knows who the other person is, and a bubble
  // carries that name the way the header above it already does.
  const namedMessages = useMemo(() => (messages.data ?? []).map(message => {
    if (message.moja || !message.posiljalacAccountId) return message;
    const who = dogovor?.ucesnici.find(person => person.id === message.posiljalacAccountId)?.ime;
    return who ? { ...message, posiljalacIme: who } : message;
  }), [messages.data, dogovor?.ucesnici]);
  const enabled = foreground && !resumeRequired && !workspace.loading && !workspace.error && !workspace.busy && !workspace.uncertain;
  const writable = enabled && dogovor?.chatDostupan === true;
  // Frozen accepted people do not establish today's group membership. Read the
  // authorized group even for a legacy or initially one-person agreement.
  const groupModel = useGroupContext(id, enabled && !!dogovor
    && dogovor.ucesnici.some(party => party.viSte && party.id === accountId));
  const refreshIncoming = useCallback(async () => {
    if (tabRef.current === 'poruke') {
      await messages.refresh('silent');
    } else {
      await workspace.refresh();
    }
  }, [messages.refresh, workspace.refresh]);
  useAgreementIncomingRefresh({ accountId, accountRevision, agreementId: id, source: izvor,
    enabled: enabled && !!dogovor && (tab === 'pregled' || dogovor.chatDostupan === true)
      && dogovor.ucesnici.some(party => party.viSte && party.id === accountId),
    refresh: refreshIncoming });
  const { model: outbox, state: outboxState } = useAgreementOutbox(accountId, id, writable);
  const photos = useAgreementPhotos(accountId, id, dogovor?.verzija ?? null, writable, outbox);
  const osvezi = workspace.refresh;
  useEffect(() => {
    if (messages.data && !messages.error) void outbox.reconcile(messages.data
      .filter(message => !!message.clientMessageId && !!message.posiljalacAccountId)
      .map(message => ({ clientMessageId: message.clientMessageId!, senderAccountId: message.posiljalacAccountId!, messageId: message.id, body: message.telo,
        ...(message.fotografije?.length ? { photos: { agreementVersion: message.dogovorVerzija!, assetIds: message.fotografije.map(photo => photo.assetId) } } : {}) })));
  }, [messages.data, messages.error, outbox, outboxState.phase]);
  const deniedAttempt = outboxState.entries.filter(entry => entry.error === 'READ_ONLY' || entry.error === 'NOT_AVAILABLE')
    .map(entry => `${entry.command.clientMessageId}:${entry.attempt}`).join('|');
  useEffect(() => { if (deniedAttempt) void osvezi(); }, [deniedAttempt, osvezi]);
  // A page/window read never implies display. Only the current measured incoming rows
  // may reach B3a, with exact history/workspace/visit identity checked again at dispatch.
  const messageReadReady = tab === 'poruke' && !!dogovor && !workspace.loading && !workspace.error && !workspace.uncertain
    && dogovor.ucesnici.some(party => party.viSte && party.id === accountId)
    && foreground && !resumeRequired && !messages.loading && !messages.error && !!messages.data?.length;
  const chatAdmitted = !!dogovor && !workspace.loading && !workspace.error && !workspace.uncertain && foreground && !resumeRequired;
  const currentChat = useRef({ rows: messages.data, dogovor, ready: messageReadReady, admitted: chatAdmitted });
  currentChat.current = { rows: messages.data, dogovor, ready: messageReadReady, admitted: chatAdmitted };
  const displayedAcks = useRef<{ focus: object | null; visit: object; rows: typeof messages.data; ids: Set<string> }>(
    { focus: null, visit: renderedChatVisit, rows: null, ids: new Set() });
  const chatCurrent = () => tabRef.current === 'poruke' && chatVisit.current === renderedChatVisit
    && renderedFormFocus !== null && formFocus.current === renderedFormFocus && ownsAccount()
    && activeRef.current && freshRef.current && currentChat.current.dogovor === dogovor
    && currentChat.current.admitted
    && !workspace.loading && !workspace.error && !workspace.uncertain && !!dogovor
    && dogovor.ucesnici.some(party => party.viSte && party.id === accountId)
    && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const onDisplayedMessageIds = (ids: readonly string[]) => {
    const rows = messages.data;
    if (!chatCurrent() || !messageReadReady || !currentChat.current.ready || currentChat.current.rows !== rows || !rows) return;
    let acknowledged = displayedAcks.current;
    if (acknowledged.focus !== renderedFormFocus || acknowledged.visit !== renderedChatVisit || acknowledged.rows !== rows) {
      acknowledged = { focus: renderedFormFocus, visit: renderedChatVisit, rows, ids: new Set() };
      displayedAcks.current = acknowledged;
    }
    const displayed = [...new Set(ids)].filter(messageId => !acknowledged.ids.has(messageId) && rows.some(message => message.id === messageId
      && !message.moja && !!message.posiljalacAccountId && message.posiljalacAccountId !== accountId
      && dogovor!.ucesnici.some(party => party.id === message.posiljalacAccountId)));
    // Bound each write exactly as the server contract requires. No loaded-page sweep.
    void (async () => {
      for (let index = 0; index < displayed.length; index += 50) {
        if (!chatCurrent() || !currentChat.current.ready || currentChat.current.rows !== rows || displayedAcks.current !== acknowledged) return;
        const batch = displayed.slice(index, index + 50).filter(messageId => !acknowledged.ids.has(messageId));
        if (!batch.length) continue;
        batch.forEach(messageId => acknowledged.ids.add(messageId));
        const result = await agreementMessageHistoryService.markDisplayed(id, batch, { accountId, accountRevision }).catch(() => null);
        if (!result?.ok) batch.forEach(messageId => acknowledged.ids.delete(messageId));
      }
    })();
  };
  const refreshMessages = async () => { if (chatCurrent()) await messages.refresh(); };
  const loadOlderMessages = async () => { if (chatCurrent() && currentChat.current.rows === messages.data) await messages.loadOlder(); };
  const loadNewerMessages = async () => { if (chatCurrent() && currentChat.current.rows === messages.data) await messages.loadNewer(); };
  const showLatestMessages = async () => { if (chatCurrent() && currentChat.current.rows === messages.data) await messages.showLatest(); };
  const chatVisible = tab === 'poruke' && !!dogovor && foreground && !resumeRequired;
  useFocusEffect(useCallback(() => {
    if (Platform.OS !== 'android' || !chatVisible) return;
    let current = true;
    const focus = formFocus.current;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!current || !focus || formFocus.current !== focus || !ownsAccount() || !activeRef.current || !freshRef.current) return false;
      // Android normally lets the IME consume Back first. If it reaches JS while
      // the keyboard is still visible, keep that same keyboard-only first step.
      if (Keyboard.isVisible()) { Keyboard.dismiss(); return true; }
      // Poruke is an inner view of this route, not another navigator entry.
      // Returning to its overview must retain pending/unknown command owners.
      if (fromInbox) { if (router.canGoBack()) router.back(); else router.replace('/poruke'); }
      else setTab('pregled');
      return true;
    });
    return () => { current = false; subscription.remove(); };
  }, [chatVisible, ownsAccount, fromInbox]));
  // Back from the background the overview keeps its last content, read-only, with a quiet "Osvežavamo…" line, instead of a full
  // skeleton (plan 2.6). Nothing private stays on it until the fresh read lands (the contact section waits, the place is gone),
  // every command is fenced as before, and in the background itself nothing is drawn. The conversation, with its composer and
  // its outbox, waits for the fresh read in a skeleton as it always did.
  const keepsContent = foreground && resumeRequired && !!dogovor && tab === 'pregled';
  if (!foreground || (resumeRequired && !keepsContent)) return <AgreementStatus loading />;
  if (!dogovor) return <AgreementStatus loading={workspace.loading} error={!!workspace.error} retry={() => void osvezi()} />;

  // Party identity comes from the Agreement, not the user's currently selected intent.
  const me = dogovor.ucesnici.find(party => party.viSte && party.id === accountId);
  const worker = me?.uloga === 'uskocer', requester = me?.uloga === 'narucilac';
  const active = dogovor.stanje === 'CONFIRMED' || dogovor.stanje === 'AWAITING_REQUESTER';
  // PKG-007: the server's actionState (already excluding a pending change) is the only
  // completion authority; status and party stay a necessary display condition, never a
  // substitute. Missing or unconfirmed permissions fail closed until an explicit readback.
  const radnje = dogovor.radnje ?? null;
  const canComplete = active && !!me && !!radnje && (worker ? radnje.mozeOznacitiZavrsetak : requester && radnje.mozePotvrditiZavrsetak);
  const other = dogovor.ucesnici.find(party => !party.viSte);
  const formCurrent = () => enabled && !!me && ownsAccount() && activeRef.current && freshRef.current &&
    renderedFormFocus !== null && formFocus.current === renderedFormFocus;
  const report = dogovor.problemReport;
  const reportProblem = async () => {
    if (!formCurrent() || !active || dogovor.problemOtvoren || !(problemAttempt ?? problemText.trim())) return;
    await workspace.save(async () => {
      // Keep the original description after an unknown outcome. Only explicit
      // readback may reopen writes; a retry cannot silently replace this intent.
      const narrative = problemAttempt ?? problemText.trim();
      problemAttemptRef.current = narrative;
      setProblemAttempt(narrative);
      const receipt = await agreementProblemService.submit(id, narrative, { accountId, accountRevision });
      if (!receipt.ok) return knownProblemRefusal(receipt.kod) ? receipt
        : { ok: false, kod: 'PROBLEM_REPORT_UNCONFIRMED', poruka: 'Ne znamo da li je problem prijavljen. Osvežite Dogovor pa pokušajte ponovo.' };
      const next = await read();
      if (!next.ok) return next;
      const stored = next.podatak?.problemReport;
      if (!stored || stored.openedBy !== receipt.podatak.problemOpenedBy || calendarInstant(stored.openedAt) !== calendarInstant(receipt.podatak.problemOpenedAt)) {
        return { ok: false, kod: 'PROBLEM_REPORT_UNCONFIRMED', poruka: 'Ne znamo da li je problem prijavljen. Osvežite Dogovor.' };
      }
      return next;
    });
  };
  /** Takes the person to a section of this page (the menu's way to the problem form and to the place). */
  const scrollToAnchor = (name: 'problem' | 'place') => {
    // Chosen from the conversation (its bar has the "···"): the section lives in the overview, so go there first and
    // scroll when that section reports its place.
    if (tabRef.current !== 'pregled') { waitingAnchor.current = name; setTab('pregled'); return; }
    const y = anchors.current[name];
    if (y !== null) scroller.current?.scrollTo({ y: Math.max(0, y - sys.space.sm), animated: !reducedMotion });
  };
  const flushAnchor = (name: 'problem' | 'place') => {
    if (waitingAnchor.current !== name) return;
    waitingAnchor.current = null;
    scrollToAnchor(name);
  };
  const complete = async () => {
    if (!canComplete || !enabled || !me || !ownsAccount() || !activeRef.current || !freshRef.current) return;
    const display = {};
    try { await workspace.save(async () => {
      // Display ownership only: the existing editor still decides whether this write can start.
      completionDisplay.current = display; setCompleting(true);
      const result = await bounded<Ishod<unknown>>(() => worker ? izvor.oznaciZavrsetak(id) : izvor.potvrdiZavrsetak(id));
      // A known server denial keeps its own copy; anything else is an unconfirmed outcome.
      if (!result.ok) return { ok: false as const, kod: result.kod, poruka: completionDenial(result.kod) ?? 'Ne znamo da li je promena sačuvana. Osvežite Dogovor pa pokušajte ponovo.' };
      const next = await read();
      if (!next.ok) return next;
      // Only the server's own terminal readback confirms; an unchanged state stays unconfirmed.
      const state = next.podatak?.stanje;
      const confirmed = worker ? state === 'AWAITING_REQUESTER' || state === 'COMPLETED' : state === 'COMPLETED';
      // Said as what did not get written, never as the normal wait for the other side ("čeka potvrdu"; review r3b).
      if (!confirmed) return { ok: false as const, kod: 'COMPLETION_NOT_CONFIRMED', poruka: worker
        ? 'Nismo uspeli da zabeležimo da je zadatak gotov. Osvežite Dogovor pa pokušajte ponovo.' : 'Nismo uspeli da zabeležimo potvrdu završetka. Osvežite Dogovor pa pokušajte ponovo.' };
      return next;
    }); } finally {
      if (completionDisplay.current === display) { completionDisplay.current = null; setCompleting(false); }
    }
  };
  // This is presentation staging only. The existing completion command still
  // owns every permission, serialization, timeout and readback rule.
  const openCompletionReview = () => {
    if (!canComplete || !formCurrent() || completionReviewRef.current ||
      completionReadEpoch.current !== renderedCompletionRead) return;
    const review = { agreement: dogovor, focus: renderedFormFocus!, readEpoch: renderedCompletionRead };
    completionReviewRef.current = review; setCompletionReview(review);
  };
  const reviewingCompletion = completionReview !== null && completionReviewRef.current === completionReview &&
    completionReview.agreement === dogovor && completionReview.focus === formFocus.current &&
    completionReview.readEpoch === completionReadEpoch.current && canComplete && formCurrent();
  const confirmCompletionReview = () => {
    if (!reviewingCompletion || completionReviewRef.current !== completionReview || !formCurrent() ||
      completionReview!.readEpoch !== completionReadEpoch.current || completionReview!.focus !== formFocus.current) return;
    // Consume before the async command starts, so two taps cannot reuse this review.
    closeCompletionReview(); void complete();
  };
  const dismissCompletionReview = () => {
    if (completionReviewRef.current === completionReview) closeCompletionReview();
  };
  const deadline = dogovor.rokPotvrdeIso ? needScheduleText({ kind: 'FIXED_WINDOW', startsAt: null, endsAt: dogovor.rokPotvrdeIso }, 'Europe/Belgrade') : 'Rok trenutno nije dostupan';

  // ---- presentation (state above is untouched by PKG-011) ----
  // The words of the one action, and of the one that is its result: "Zadatak je gotov" is the worker's, "Potvrdi završetak" the
  // requester's - on the button, in the review it opens and in the sentences around them.
  const completeLabel = worker ? 'Zadatak je gotov' : 'Potvrdi završetak';
  // A quiet line, never a skeleton: the page is being read again (back from the background, or "Osveži") or is saving.
  const footerStatus = resumeRequired || workspace.loading ? 'Osvežavamo…'
    : workspace.busy && !completing ? 'Čuvamo promenu…' : null;
  const review = () => { if (formCurrent()) router.navigate({ pathname: '/oceni-dogovor', params: { agreementId: id } }); };
  // At most one brand action per state, and it is the only green thing on the screen: completion when the server allows it,
  // answering a proposal, or the rating. When nothing waits for the person there is NO button - the footer says the state in
  // one grey sentence. The conversation is not offered again: it is the Poruke tab at the top of the same screen.
  // A change proposal waiting for my answer blocks both completions, so answering it is the step.
  const pendingChange = active && me && radnje?.izmenaNaCekanju ? radnje.predlogIzmene : null;
  const changeWaits = active && me && !!radnje?.izmenaNaCekanju;
  const openChanges = () => { if (formCurrent()) router.push({ pathname: '/dogovor/[id]/izmene', params: { id } }); };
  // The rating is offered only while it can still be given: once the review read says it is saved (or closed), nothing waits
  // for the person and the footer says so. A read that did not answer keeps the offer; the rating screen re-reads.
  const ratingOpen = dogovor.ownRating === 'DUE' || dogovor.ownRating === 'UNKNOWN';
  const brand = canComplete ? { label: completeLabel, disabled: !enabled, onPress: openCompletionReview }
    : pendingChange?.mozeOdgovoriti ? { label: 'Odgovori na predlog', disabled: !enabled, onPress: openChanges }
      : dogovor.stanje === 'COMPLETED' && me && ratingOpen ? { label: 'Oceni saradnju', disabled: !enabled, onPress: review }
        : null;
  // The one place the state is said (round-1 critique A13); the words live beside the step card.
  const stepChange = { waits: !!changeWaits, mine: pendingChange ? pendingChange.moj : null };
  const quiet = brand ? null : agreementQuietLine({ state: dogovor.stanje, party: !!me, worker, otherName: other?.ime, change: stepChange, permissionsKnown: !!radnje });
  // What can be changed or cancelled: the rows "Izmeni uslove" and "Otkaži Dogovor" of the overview, and the same entries of the conversation's menu.
  const canChange = active && !!me && !(requester && dogovor.stanje === 'AWAITING_REQUESTER');
  const toChanges = (start: 'propose' | 'cancel') => { if (formCurrent()) router.push({ pathname: '/dogovor/[id]/izmene', params: { id, start } }); };
  /** The form takes the place of the row that opens it, at the end of the page, and the page goes there once it has a place. */
  const openProblemForm = () => {
    if (!formCurrent()) return;
    if (problemOpen) { scrollToAnchor('problem'); return; }
    waitingAnchor.current = 'problem'; setProblemOpen(true); setTab('pregled');
  };
  /** "Dogovorite se u Porukama": the conversation of this same screen. */
  const openMessages = () => { if (formCurrent()) setTab('poruke'); };
  /** "Zatraži adresu" (R03): the question is written into the conversation's draft - never sent for the person - and the conversation opens. */
  const requestAddress = () => {
    if (!formCurrent()) return;
    // Only into an empty draft that has been read: a draft the person already wrote is not touched.
    if (outboxState.phase === 'ready' && !outboxState.draft?.trim()) void outbox.setDraft(ADDRESS_REQUEST_TEXT);
    setTab('poruke');
  };
  /** "Prijavi nedolazak" (R04): support opens with this Dogovor and the matching topic selected. */
  const reportNoShow = () => {
    if (formCurrent()) router.push({ pathname: '/podrska/novi', params: { contextKind: 'AGREEMENT', contextId: id.toLowerCase(), contextRevision: String(dogovor.verzija), topic: 'NO_SHOW' } });
  };
  // The conversation's "···" (T3c): the overview shows every one of these as a row of the page (J15), so the menu is for the person who is in Poruke.
  const menuActions = agreementMenuActions({ party: !!me, hasOther: !!other, active, requester, canChange,
    hasLocation: dogovor.rezim !== 'DALJINSKI' && dogovor.kontakt.lokacijaPostoji,
    problemFree: !dogovor.problemOtvoren && !report, enabled }, {
    onChange: () => toChanges('propose'), onCancel: () => toChanges('cancel'),
    onLocation: () => scrollToAnchor('place'),
    onProblem: openProblemForm,
    onSafety: () => { if (other && formCurrent()) router.navigate({ pathname: '/bezbednost', params: { targetAccountId: other.id, agreementId: id } }); },
  });
  const nextStep = agreementNextStep({ state: dogovor.stanje, party: !!me, worker, change: stepChange,
    ownRating: dogovor.ownRating, problemOpen: dogovor.problemOtvoren, deadline });
  // How a Dogovor goes is behind an "ⓘ" at its head, for a side of a Dogovor that is still open (J5: one sentence on the page, the rest one tap away).
  const stepsInfo = active && me ? agreementStepsInfo({ worker }) : null;
  // The same step, said at the head of Poruke only when it is mine (review r4 rd): words, never an action.
  const waitingForMe = me ? agreementWaitsForMe({ state: dogovor.stanje, requester, change: stepChange, ownRating: dogovor.ownRating }) : null;
  // ---- a problem: the note about one that was reported (and the three ways on, R04), or the form that reports one ----
  const problemNote = report
    ? <AgreementProblemNote mine={report.openedBy === accountId} openedAt={report.openedAt} narrative={report.narrative} active={active}
      keptFirst={!!problemAttempt && problemAttempt !== report.narrative} />
    : dogovor.problemOtvoren
      ? <AgreementProblemUnknown legacy={dogovor.problemReportState === 'LEGACY_UNAVAILABLE'} disabled={!enabled}
        onRefresh={dogovor.problemReportState === 'UNAVAILABLE' ? () => void osvezi() : undefined} />
      : null;
  const problemExits = problemNote && active && me
    ? <AgreementProblemExits disabled={!enabled} onMessages={openMessages} onCancel={canChange ? () => toChanges('cancel') : undefined} onNoShow={reportNoShow} />
    : null;
  const problemForm = !problemNote && active && me && problemOpen
    ? <AgreementProblemForm value={problemText} editable={enabled && !problemAttempt} kept={!!problemAttempt} busy={workspace.busy} disabled={!enabled}
      onChange={value => { if (formCurrent() && !problemAttemptRef.current) setProblemText(value); }}
      canSend={enabled && !!(problemAttempt ?? problemText.trim())} onSend={() => { void reportProblem(); }}
      onCancel={() => { if (formCurrent() && !problemAttemptRef.current) setProblemOpen(false); }} />
    : null;
  /** A Dogovor with no term at all, agreed and with nothing else waiting: it says what is still to do, and where (R02). */
  const needsTerm = dogovor.stanje === 'CONFIRMED' && isNoTermText(dogovor.vremeTekst) && !!me && canChange && !changeWaits && !dogovor.problemOtvoren;
  const openTask = me && dogovor.izvor?.zadatakId ? () => {
    const needId = dogovor.izvor?.zadatakId;
    if (!needId || !formCurrent()) return;
    router.push(requester ? { pathname: '/potrebe/[id]/pregled', params: { id: needId } } : { pathname: '/prilike/[id]', params: { id: needId } });
  } : undefined;

  const openPrivateConversation = (targetId: string) => {
    if (!formCurrent() || !groupModel.current() || !groupModel.context
      || !privateConversationChoices(groupModel.context).some(choice => choice.id === targetId)) return;
    if (targetId === id) setTab('poruke');
    else router.push({ pathname: '/dogovor/[id]', params: { id: targetId, tab: 'poruke' } });
  };
  const channels = groupModel.context?.group ? <ConversationChannels context={groupModel.context} selected="private"
    error={groupModel.error}
    disabled={!enabled || groupModel.loadingMore} onPrivate={openPrivateConversation} onMore={() => void groupModel.more()}
    onGroup={() => { if (formCurrent() && groupModel.current()) router.push({ pathname: '/dogovor/[id]/grupa', params: { id } }); }} /> : null;

  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}>
    {reviewingCompletion ? <AgreementCompletionReview agreement={completionReview!.agreement} worker={worker}
      confirm={confirmCompletionReview} back={dismissCompletionReview} /> : null}
    {/* Keyboard screenY and this full-screen parent share the same origin. */}
    <KeyboardAvoidingView style={s.screen} enabled={tab === 'poruke' || problemOpen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      {tab === 'poruke' ? <AgreementThreadPresentation key={requestedMessageId ?? 'history'} agreement={dogovor} person={other}
        channels={channels}
        waiting={waitingForMe} onOverview={() => setTab('pregled')}
        // The conversation's own "···" (the overview has none, J15), so "Prijavi ili blokiraj osobu" and the rest are reachable while Poruke is shown.
        onMore={menuActions.length ? () => { if (ownsAccount()) setMenuOpen(true); } : undefined}
        onBack={fromInbox ? () => {
          if (renderedFormFocus !== null && formFocus.current === renderedFormFocus && ownsAccount() && activeRef.current && freshRef.current) {
            if (router.canGoBack()) router.back(); else router.replace('/poruke');
          }
        } : undefined}
        chat={{ messages: namedMessages, loading: messages.loading,
          error: messages.error, refreshing: messages.refreshing, refreshError: messages.refreshError,
          writable, terminal: !dogovor.chatDostupan, refresh: refreshMessages, refreshWorkspace: workspace.refresh, readingPosition: chatReadingPosition,
          hasOlder: !!messages.olderCursor, hasNewer: !!messages.newerCursor,
          loadingOlder: messages.loadingOlder, loadingNewer: messages.loadingNewer,
          historyError: !!messages.historyErrorDirection, historyErrorDirection: messages.historyErrorDirection,
          onLoadOlder: loadOlderMessages, onLoadNewer: loadNewerMessages, onShowLatest: showLatestMessages, onDisplayedMessageIds,
          outbox, state: outboxState, photos,
          voiceScope: { accountId, accountRevision, agreementId: id, version: dogovor.verzija, isCurrent: chatCurrent },
          support: { canAct: formCurrent, navigate: action => { if (formCurrent()) { formFocus.current = null; action(); } } } }} /> : <>
        {other ? <AgreementPersonBar person={other} back={backToAgreements} />
          : <ProductHeader back={backToAgreements} title="Dogovor" />}
        <View style={s.tabs}><AgreementTabs tab={tab} onChange={setTab} /></View>
        <ScrollView ref={scroller} keyboardShouldPersistTaps="handled" contentContainerStyle={overviewContent}>
          <AgreementOverview agreement={dogovor} step={nextStep} info={stepsInfo} party={!!me} enabled={enabled} concealed={resumeRequired}
            steps={{ state: dogovor.stanje, ownRating: dogovor.ownRating, cancellation: cancelled ? cancellationDetailsOf(cancellation, other?.ime) : null }}
            headExtra={<>
              {active && me && !radnje ? <View style={s.stack}>
                <T variant="note" tone="muted">Ne možemo da proverimo da li možete da završite zadatak. Osvežite Dogovor.</T>
                <V2Action label="Osvežite Dogovor" kind="quiet" disabled={!enabled} onPress={() => void osvezi()} />
              </View> : null}
              {changeWaits ? <View style={s.stack}>
                {pendingChange?.izmene.map(change => <View key={change.polje} style={s.change}>
                  <T variant="note" tone="muted">{change.polje}</T>
                  <T variant="body" style={s.ink}>{change.sada}</T>
                  <T variant="bodyStrong" style={s.ink}>{`→ ${change.predlog}`}</T>
                </View>)}
                {pendingChange?.razlog ? <T variant="note" tone="muted">Razlog: {pendingChange.razlog}</T> : null}
                {pendingChange?.mozeOdgovoriti ? null
                  : <V2Action label="Pogledajte predlog" kind="quiet" disabled={!enabled} onPress={openChanges} />}
              </View> : null}
            </>}
            problem={{ note: problemNote, exits: problemExits, form: problemForm }}
            groupReady={!!groupModel.context?.group} privatePartyName={other?.ime}
            group={me && enabled && (groupModel.context?.group || groupModel.error || !groupModel.context && dogovor.pokrivenost.ukupno !== 1)
              ? <GroupConversationEntry agreementId={id} model={groupModel} onPrivate={openPrivateConversation} /> : null}
            on={{
              // The requester has no screen that opens one Prijava by its id, so no "Tvoja prijava" row is drawn for them; once the worker says
              // done, the requester confirms or reports a problem (owner decision 2026-09-21), so nothing is left to change for them; a finished
              // or cancelled Dogovor has nothing left to change or cancel (emulator sweep, 2026-09-23).
              proposeTerm: needsTerm ? () => toChanges('propose') : undefined,
              openMessages, requestAddress,
              openTask,
              openApplication: worker && dogovor.izvor?.prijavaId ? () => {
                const prijavaId = dogovor.izvor?.prijavaId; if (!prijavaId || !formCurrent()) return;
                router.push({ pathname: '/moje-prijave', params: { prijavaId } });
              } : undefined,
              // The rows of the actions (J15) open the form they name, as the conversation's menu does; the hub is for answering a proposal.
              openChange: canChange ? () => toChanges('propose') : undefined,
              openCancel: canChange ? () => toChanges('cancel') : undefined,
              openProblem: active && me && !problemNote && !problemOpen ? openProblemForm : undefined,
              openSafety: me && other ? () => { if (formCurrent()) router.navigate({ pathname: '/bezbednost', params: { targetAccountId: other.id, agreementId: id } }); } : undefined,
              placeLayout: event => { anchors.current.place = event.nativeEvent.layout.y; flushAnchor('place'); },
              problemLayout: event => { anchors.current.problem = event.nativeEvent.layout.y; flushAnchor('problem'); },
            }} />
        </ScrollView>
        <WorkspaceFooter brand={brand} quiet={quiet} loading={canComplete && workspace.busy && completing} statusText={footerStatus}
          onLayout={event => setFooterHeight(Math.round(event.nativeEvent.layout.height))}
          notice={workspace.error || workspace.uncertain ? {
            message: workspace.error ?? 'Proveravamo da li je prethodna radnja uspela.',
            refresh: () => void osvezi(), refreshing: workspace.busy || workspace.loading,
          } : null} />
      </>}
    </KeyboardAvoidingView>
    {/* This screen covers the navigator that hosts the outcome bar, so it carries its own host, above its footer. Only the
        overview: the conversation has a composer in that place. */}
    {tab === 'pregled' ? <PorukaHost clearance={brand || quiet || footerStatus || workspace.error || workspace.uncertain ? footerHeight : 0} /> : null}
    {menuOpen && menuActions.length ? <ActionSheet label="Radnje Dogovora" actions={menuActions} onClose={() => setMenuOpen(false)} /> : null}
  </SafeAreaView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  ink: { color: sys.color.ink },
  // The tab strip stands on the same edge as the bar above it and the page below it (`layout.gutter`), so the arrow does not move between Pregled and Poruke.
  tabs: { paddingHorizontal: layout.gutter, paddingBottom: sys.space.md },
  // What a step is about, inside the step: a proposal's lines, or the way to read the permissions again.
  stack: { gap: sys.space.sm, marginTop: sys.space.xs }, change: { gap: sys.space.xs },
});
