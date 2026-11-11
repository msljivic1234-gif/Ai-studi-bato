import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { sesijaSada } from '../../store/sesija';
import { RefreshControl, StyleSheet, View, type ScrollView } from 'react-native';
import { router } from 'expo-router';
import type { SupportAction, SupportAppeal, SupportDecision, SupportDetail, SupportSnapshot } from '../../data/supportCaseTypes';
import { ProductSheet } from '../product/ProductSheet';
import { SettingsAction, SettingsGroup, SettingsText as T } from '../settings/SettingsPresentation';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { usePullRefresh } from '../system/usePullRefresh';
import { supportActionAllowed } from './SupportController';
import { SupportBubble, SupportChoiceRow, SupportComposer, SupportDecisionBlock, SupportField, SupportLoading, SupportPrivacy, SupportStatusChip,
  SupportSystemLine, SupportThreadFrame, supportLabel, supportStyles, supportTime } from './SupportPresentation';
import { SupportRecoveryPanel } from './SupportRecoveryPanel';
import { supportMessageShown, supportMessageTone } from './supportCopy';
import { useSupportController } from './useSupportController';
import { clearSupportReplyDraft, readSupportReplyDraft, rememberSupportReplyDraft, supportReplyDraftScope } from './supportReplyDraft';
import { SupportReferenceView, supportReferenceNames } from './SupportReferenceView';

type FormAction = 'REQUEST_INFO' | 'DECIDE' | 'APPEAL' | 'DECIDE_APPEAL';
type Model = ReturnType<typeof useSupportController>;
const REPLY_LIMIT = 4000;

export function SupportDetailScreen({ caseId }: { caseId: string }) {
  const model = useSupportController({ type: 'DETAIL', caseId });
  return <SupportDetailView model={model} caseId={caseId} />;
}

// One word for it everywhere: "ponovni pregled" (a "žalba" would promise a body that decides over support; there is none).
const appealState = (appeal: SupportAppeal) => appeal.status === 'RECEIVED' ? 'Zahtev za ponovni pregled je primljen'
  : appeal.status === 'IN_REVIEW' ? 'Ponovni pregled je u toku' : 'Ponovni pregled je završen';

/**
 * One support case as a conversation (round 5, owner step 11b): the person's own messages on the right, support's on
 * the left, a change of state as a quiet line, a decision as a block where it happened with its appeal beside it, and a
 * reply field pinned under the thread. Staff get their commands under the thread and in a sheet.
 *
 * Presentation over the controller's state. The reply's words are kept per case: an unconfirmed send keeps them, the
 * other side moving the case on (a reply, a claim) keeps them, only the person's own confirmed reply clears them (its
 * receipt names this case). An ordinary background/focus keeps unsent words in scoped RAM;
 * other accounts, cases and deliberate discard cannot inherit them. No case data is cached.
 */
export function SupportDetailView({ model, caseId }: { model: Model; caseId: string }) {
  const { state, current, controller, navigate } = model;
  const replyScope = supportReplyDraftScope(model.accountId, model.accountRevision, caseId);
  const [cursors, setCursors] = useState<string[]>(['0']);
  const [reply, setReply] = useState({ scope: '', key: '', text: '' });
  const [form, setForm] = useState<{ action: FormAction; targetId: string | null; key: string } | null>(null);
  const confirm = useConfirmSheet();
  useEffect(() => {
    setCursors(['0']);
    setReply(model.focused ? { scope: replyScope, key: caseId, text: readSupportReplyDraft(replyScope) } : { scope: '', key: '', text: '' });
    setForm(null);
  }, [model.incarnation, model.focused, replyScope, caseId]);
  useEffect(() => () => {
    const now = sesijaSada();
    if (now.user?.id !== model.accountId || now.accountRevision !== model.accountRevision) clearSupportReplyDraft(replyScope);
  }, [replyScope, model.accountId, model.accountRevision]);
  // `live` is the case the controller holds right now: it is null while a read runs, and every fence and command follows it.
  // `detail` is what is DRAWN: while the person's own refresh runs, the case they were reading stays on screen under the
  // spinner (read-only, every command waits grey) instead of being swapped for a skeleton. The first read has nothing to keep.
  const live = state.detail, busy = state.phase === 'LOADING' || state.phase === 'SENDING';
  const settled = useRef<{ incarnation: unknown; detail: SupportDetail } | null>(null);
  // A new visit, a backgrounded app or another account drops it at once: a private conversation is never kept in memory past
  // the controller that read it (the controller wipes its own state on dispose, and this memory goes with it).
  if (settled.current && settled.current.incarnation !== model.incarnation) settled.current = null;
  if (state.phase === 'READY' && live) settled.current = { incarnation: model.incarnation, detail: live };
  const kept = !live && state.phase === 'LOADING' && state.command === 'READ' && settled.current?.incarnation === model.incarnation ? settled.current.detail : null;
  const detail = live ?? kept;
  // `key` is one revision of the case (a stale press, the form sheet and the scroll follow it); the reply follows the case.
  const key = live ? `${live.case.id}:${live.case.revision}` : '';
  const replyKey = detail?.case.id ?? '';
  const replyText = detail && reply.scope === replyScope && reply.key === replyKey ? reply.text : '';
  // The person's own reply was confirmed: its words are sent, so they leave the field. A revision the other side made
  // (an operator's reply read on refresh) no longer wipes a half-typed reply (round 5 review).
  const receipt = state.receipt;
  useEffect(() => {
    if (receipt && receipt.caseId === caseId && (receipt.kind === 'AUTHOR_REPLY' || receipt.kind === 'OPERATOR_REPLY')) {
      clearSupportReplyDraft(replyScope);
      setReply({ scope: replyScope, key: '', text: '' });
    }
  }, [receipt, caseId, replyScope]);
  useEffect(() => {
    if (!model.focused || !current() || reply.scope !== replyScope || reply.key !== caseId) return;
    if (state.pending || state.phase === 'SENDING' || (receipt?.caseId === caseId
      && (receipt.kind === 'AUTHOR_REPLY' || receipt.kind === 'OPERATOR_REPLY'))) {
      clearSupportReplyDraft(replyScope); return;
    }
    if (reply.text) rememberSupportReplyDraft(replyScope, reply.text);
    else clearSupportReplyDraft(replyScope);
  }, [model.focused, current, reply, replyScope, caseId, receipt, state.pending, state.phase]);
  // A read that drops the case (a reload, a failed read after a send) takes the form sheet with it, so the sheet does
  // not come back by itself, empty, when the same revision returns (round 5 review).
  useEffect(() => { if (!live) setForm(null); }, [live]);
  // A question about this case belongs to the revision it was asked on: a new revision (or a dropped case) retires it.
  const closeQuestion = confirm.close;
  useEffect(() => { closeQuestion(); }, [key, closeQuestion]);
  const scroll = useRef<ScrollView>(null), scrolledTo = useRef<string | null>(null);
  const page = (cursor: string, back = false) => {
    if (!current() || busy) return;
    setCursors(previous => back ? previous.slice(0, -1) : [...previous, cursor]);
    void controller?.page(cursor, state);
  };
  const reload = () => { if (current()) void controller?.load(); };
  // The spinner of the pull is the pull's own: a read that starts by itself (a page, the screen coming back) must not raise Android's white disc.
  const pull = usePullRefresh(reload, state.phase === 'LOADING');
  const back = () => navigate(() => router.canGoBack() ? router.back() : router.replace('/podrska'));
  const leave = () => {
    if (!current()) return;
    const discardAndBack = () => { clearSupportReplyDraft(replyScope); back(); };
    if (replyText && !state.pending && state.phase !== 'SENDING') confirm.ask({
      title: 'Odbaciti napisanu dopunu?', message: 'Neposlata dopuna neće biti sačuvana.',
      confirmLabel: 'Odbaci', cancelLabel: 'Nastavi pisanje', tone: 'danger', onConfirm: discardAndBack,
    });
    else discardAndBack();
  };
  const allowed = (action: SupportAction) => !!detail && supportActionAllowed(detail, action);
  const actionsDisabled = state.phase !== 'READY' || !!state.pending;
  const open = (action: FormAction, id: string | null = null) => {
    if (!current() || actionsDisabled || !allowed(action)) return;
    setForm({ action, targetId: id, key });
  };
  // Closing a processed case is the one operator command that ends the person's chance to add to it, so it asks first, in the
  // centred dialog, with what follows said in one sentence. The answer is fenced like every other press of this screen: it
  // belongs to the render (and so the state and the revision) that asked, and a new revision retires the question.
  const askClose = () => {
    if (!current() || actionsDisabled || !allowed('CLOSE')) return;
    confirm.ask({ title: 'Zatvoriti predmet?', message: 'Predmet se zatvara i dopune više nisu moguće. Odluka i razgovor ostaju u istoriji.',
      confirmLabel: 'Zatvori predmet', tone: 'danger',
      onConfirm: () => { if (current() && allowed('CLOSE')) return controller?.submit('CLOSE', {}, state); } });
  };
  const author = detail?.viewerRole !== 'OPERATOR';
  const replyKind = author ? 'AUTHOR_REPLY' as const : 'OPERATOR_REPLY' as const;
  const canReply = allowed(replyKind);
  const replyTooLong = Array.from(replyText).length > REPLY_LIMIT;
  const canSend = !actionsDisabled && !!replyText.trim() && !replyTooLong;
  const draftView = useMemo(() => ({}), [replyText, actionsDisabled, key]);
  const latestDraft = useRef(draftView); latestDraft.current = draftView;
  const send = () => {
    if (!current() || latestDraft.current !== draftView || actionsDisabled || !detail || !allowed(replyKind) || !canSend) return;
    if (replyKind === 'AUTHOR_REPLY') void controller?.submit('AUTHOR_REPLY', { body: replyText, evidence: [] }, state);
    else void controller?.submit('OPERATOR_REPLY', { body: replyText }, state);
  };
  // One look for "failed": a failed mark or read is danger; a word about a reply still unconfirmed waits (round 5 review).
  const tone = supportMessageTone(state), messageTone = tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'ink';
  // The grey send area says why a written reply cannot go now.
  const replyReason = replyTooLong ? 'Skrati tekst pre slanja.' : state.pending ? 'Najpre proveri prethodno slanje.' : null;

  const thread: ReactNode[] = [];
  if (detail) {
    const decisions = new Map(detail.decisions.map(decision => [decision.id, decision]));
    const shown = new Set<string>();
    const decisionBlock = (decision: SupportDecision) => {
      shown.add(decision.id);
      const openAppeal = detail.appeals.some(appeal => appeal.decisionId === decision.id && appeal.status !== 'DECIDED');
      return <SupportDecisionBlock key={`decision:${decision.id}`} reconsideration={decision.reviewType === 'RECONSIDERATION'}
        outcome={decision.outcome} explanation={decision.explanation} time={supportTime(decision.createdAt)}>
        {detail.appeals.filter(appeal => appeal.decisionId === decision.id).map(appeal => <AppealLine key={appeal.id} appeal={appeal}
          detail={detail} model={model} disabled={actionsDisabled} onDecide={() => open('DECIDE_APPEAL', appeal.id)} />)}
        {allowed('APPEAL') && !openAppeal ? <SettingsAction label="Zatraži ponovni pregled" kind="quiet" disabled={actionsDisabled}
          onPress={() => open('APPEAL', decision.id)} /> : null}
      </SupportDecisionBlock>;
    };
    let previousAuthor: string | null = null;
    for (const event of detail.events) {
      const evidence = detail.evidence.filter(item => item.eventId === event.id)
        .map(item => <SupportReferenceView key={item.id} value={item.reference} caseId={caseId} />);
      const decision = (event.kind === 'DECIDE' || event.kind === 'DECIDE_APPEAL') && event.decisionId ? decisions.get(event.decisionId) : undefined;
      if (decision) { previousAuthor = null; if (!shown.has(decision.id)) thread.push(decisionBlock(decision)); continue; }
      if (event.body) {
        const first = previousAuthor !== event.authorRole; previousAuthor = event.authorRole;
        thread.push(<SupportBubble key={event.id} mine={event.authorRole === detail.viewerRole} sender={supportLabel(event.authorRole)} first={first}
          kindLabel={event.kind === 'REQUEST_INFO' || event.kind === 'APPEAL' ? supportLabel(event.kind) : undefined}
          body={event.body} time={supportTime(event.createdAt)}>{evidence}</SupportBubble>);
        continue;
      }
      previousAuthor = null;
      thread.push(<Fragment key={event.id}>
        <SupportSystemLine>{`${supportLabel(event.kind)} · ${supportTime(event.createdAt)}`}</SupportSystemLine>
        {evidence.length ? <View style={[s.evidence, event.authorRole === detail.viewerRole ? s.mineSide : s.theirsSide]}>{evidence}</View> : null}
      </Fragment>);
    }
    // A decision no event on this page points at is still shown, after the events, so nothing disappears.
    for (const decision of detail.decisions) if (!shown.has(decision.id)) thread.push(decisionBlock(decision));
    for (const appeal of detail.appeals) if (!decisions.has(appeal.decisionId)) thread.push(<View key={`appeal:${appeal.id}`} style={s.orphan}>
      <AppealLine appeal={appeal} detail={detail} model={model} disabled={actionsDisabled} onDecide={() => open('DECIDE_APPEAL', appeal.id)} /></View>);
  }

  const composer = <>
    <SupportRecoveryPanel model={model} caseId={caseId} />
    {supportMessageShown(state) && !(state.phase === 'ERROR' && !detail) ? <T variant="note" tone={messageTone === 'success' ? 'success' : messageTone === 'danger' ? 'danger' : 'ink'}
      accessibilityRole={messageTone === 'danger' ? 'alert' : undefined} accessibilityLiveRegion="polite">{state.message}</T> : null}
    {detail && canReply ? <>
      {replyTooLong ? <T variant="meta" tone="danger" accessibilityLiveRegion="polite">{`${Array.from(replyText).length} / ${REPLY_LIMIT} · Skrati tekst pre slanja.`}</T> : null}
      {/* The spinner is this reply's own: marking as read, a claim, a close, or a stop or replay of an unconfirmed reply
          run without it (round 5c review). */}
      <SupportComposer value={replyText} placeholder={author ? 'Napiši dopunu…' : 'Napiši odgovor…'} editable={!actionsDisabled}
        canSend={canSend} sending={state.phase === 'SENDING' && state.command === 'SEND' && state.pending?.kind === replyKind} onSend={send}
        reason={replyReason} maxLength={REPLY_LIMIT * 2}
        onChange={value => { if (current() && !actionsDisabled) setReply({ scope: replyScope, key: replyKey, text: value }); }} />
    </> : detail ? <T variant="meta" tone="muted" style={supportStyles.center}>{detail.case.status === 'CLOSED' ? 'Predmet je zatvoren.'
      : author ? 'Dopuna trenutno nije moguća.' : 'Odgovor trenutno nije moguć.'}</T> : null}
  </>;

  return <>
    <SupportThreadFrame title={detail?.case.title ?? 'Zahtev'} subtitle={detail ? `Zahtev #${detail.case.caseNumber}` : undefined} onBack={leave}
      strip={detail ? <>
        <SupportStatusChip status={detail.case.status} />
        <T variant="meta" tone="muted">{`${supportLabel(detail.case.topic)} · Primljeno ${supportTime(detail.case.createdAt)}`}</T>
      </> : null}
      refresh={<RefreshControl refreshing={pull.refreshing} onRefresh={pull.onRefresh} tintColor={sys.color.green} colors={[sys.color.green]} />}
      scrollRef={scroll} onContentSizeChange={() => {
        // The conversation opens at its newest line, and again after a confirmed reply; paging leaves the place alone.
        if (!live || scrolledTo.current === key) return; scrolledTo.current = key; scroll.current?.scrollToEnd?.({ animated: false });
      }}
      composer={composer}>
      {(state.phase !== 'LOADING' || kept) && !(state.phase === 'ERROR' && !detail) ? <View style={s.head}>
        <SettingsAction label="Osveži predmet" kind="quiet" disabled={busy} loading={state.phase === 'LOADING'} onPress={reload} />
      </View> : null}
      {!detail ? state.phase === 'LOADING' ? <SupportLoading />
        : state.phase === 'ERROR' ? <StateView kind="error" art="chat" title="Zahtev nije učitan" body={state.message ?? undefined}
          primary={{ label: 'Osveži predmet', onPress: reload, disabled: busy }} /> : null : <>
        {cursors.length > 1 ? <SettingsAction label="Prethodni događaji" kind="quiet" disabled={busy} onPress={() => page(cursors[cursors.length - 2], true)} /> : null}
        <View style={s.summary}>
          {detail.case.desiredOutcome ? <View style={s.fact}><T variant="note" tone="muted">Željeni ishod</T><T selectable>{detail.case.desiredOutcome}</T></View> : null}
          {'kind' in detail.case.context ? <SupportReferenceView value={detail.case.context as SupportSnapshot} caseId={caseId} /> : null}
          <SupportPrivacy safety={detail.case.channel === 'SAFETY'} />
        </View>
        {thread}
        {detail.nextAfterSequence ? <SettingsAction label="Sledeći događaji" kind="quiet" disabled={busy} onPress={() => page(detail.nextAfterSequence!)} /> : null}
        {detail.events.length ? <SettingsAction label="Označi prikazane događaje kao pročitane" kind="quiet" disabled={busy}
          onPress={() => { if (current()) void controller?.markRead(state); }} /> : null}
        {detail.viewerRole === 'OPERATOR' ? <View style={s.operator}>
          <T variant="meta" tone="muted">Operaterske radnje za ovaj nalog i trenutno stanje predmeta.</T>
          <View style={s.operatorActions}>
            {allowed('CLAIM') ? <SettingsAction label="Preuzmi predmet" kind="secondary" disabled={actionsDisabled}
              onPress={() => { if (current()) void controller?.submit('CLAIM', {}, state); }} /> : null}
            {allowed('REQUEST_INFO') ? <SettingsAction label="Zatraži dopunu" kind="quiet" disabled={actionsDisabled} onPress={() => open('REQUEST_INFO')} /> : null}
            {allowed('DECIDE') ? <SettingsAction label="Donesi odluku" kind="quiet" disabled={actionsDisabled} onPress={() => open('DECIDE')} /> : null}
            {allowed('CLOSE') ? <SettingsAction label="Zatvori obrađeni predmet" kind="quiet" disabled={actionsDisabled} onPress={askClose} /> : null}
          </View>
        </View> : null}
      </>}
    </SupportThreadFrame>
    {live && form && form.key === key && allowed(form.action) ? <SupportFormSheet key={`${key}:${form.action}:${form.targetId ?? ''}`}
      action={form.action} targetId={form.targetId} detail={live} model={model} onClose={() => setForm(null)} /> : null}
    {confirm.sheet}
  </>;
}

/** An appeal of a decision, and the commands staff have on it. */
function AppealLine({ appeal, detail, model, disabled, onDecide }: {
  appeal: SupportAppeal; detail: SupportDetail; model: Model; disabled: boolean; onDecide: () => void;
}) {
  const { state, current, controller } = model;
  const allowed = (action: SupportAction) => supportActionAllowed(detail, action);
  return <View style={s.appeal}>
    <T variant="note" tone="muted">{`${appealState(appeal)} · ${supportTime(appeal.createdAt)}`}</T>
    {allowed('CLAIM_APPEAL') && appeal.status === 'RECEIVED' ? <SettingsAction label="Preuzmi ponovni pregled" kind="secondary" disabled={disabled}
      onPress={() => { if (current()) void controller?.submit('CLAIM_APPEAL', { appealId: appeal.id }, state); }} /> : null}
    {allowed('DECIDE_APPEAL') && appeal.status === 'IN_REVIEW' ? <SettingsAction label="Odluči o ponovnom pregledu" kind="quiet" disabled={disabled}
      onPress={onDecide} /> : null}
  </View>;
}

/**
 * A command that needs words (an appeal, a request for more, a decision) in a sheet over the thread. Its words stay in
 * the sheet until the case confirms the command (a new revision closes it); an unconfirmed send keeps them.
 */
function SupportFormSheet({ action, targetId, detail, model, onClose }: {
  action: FormAction; targetId: string | null; detail: SupportDetail; model: Model; onClose: () => void;
}) {
  const { state, current, controller } = model;
  const [body, setBody] = useState(''), [reason, setReason] = useState(''), [outcome, setOutcome] = useState<'ACCEPTED' | 'REJECTED'>('ACCEPTED');
  const [evidenceIds, setEvidenceIds] = useState<string[]>([]);
  const disabled = state.phase !== 'READY' || !!state.pending;
  const draftView = useMemo(() => ({}), [action, targetId, body, reason, outcome, evidenceIds, disabled]);
  const latestDraft = useRef(draftView); latestDraft.current = draftView;
  const allowed = (kind: SupportAction) => supportActionAllowed(detail, kind);
  const deciding = action === 'DECIDE' || action === 'DECIDE_APPEAL';
  const valid = !!body.trim() && Array.from(body).length <= 4000 && (!deciding || /^[A-Z][A-Z0-9_]{0,63}$/.test(reason));
  const submit = () => {
    if (!current() || latestDraft.current !== draftView || disabled || !allowed(action) || !valid) return;
    if (action === 'APPEAL') { if (targetId) void controller?.submit(action, { decisionId: targetId, body }, state); }
    else if (action === 'DECIDE') void controller?.submit(action, { outcome, reasonCode: reason, body, evidenceIds, appealId: null }, state);
    else if (action === 'DECIDE_APPEAL') { if (targetId) void controller?.submit(action, { outcome, reasonCode: reason, body, evidenceIds, appealId: targetId }, state); }
    else void controller?.submit(action, { body }, state);
  };
  const why = disabled || valid ? null : !body.trim() ? (deciding ? 'Unesi obrazloženje pre čuvanja odluke.' : 'Unesi tekst pre slanja.')
    : Array.from(body).length > 4000 ? 'Skrati tekst do 4000 znakova.' : 'Oznaka razloga: velika slova, brojevi i donja crta, do 64 znaka.';
  return <ProductSheet title={action === 'APPEAL' ? 'Razlog za ponovni pregled' : deciding ? 'Obrazložena odluka' : 'Poruka u predmetu'}
    dirty={!!body || !!reason} dismissible={state.phase !== 'SENDING'} onClose={onClose}
    footer={() => <SettingsAction label={action === 'APPEAL' ? 'Pošalji zahtev za ponovni pregled' : deciding ? 'Sačuvaj odluku' : 'Pošalji poruku'}
      loading={state.phase === 'SENDING' && state.command === 'SEND' && state.pending?.kind === action} disabled={disabled || !valid} reason={why} onPress={submit} />}>
    {() => <View style={s.sheet}>
      {action === 'APPEAL' ? <T variant="note" tone="muted">Zahtev za ponovni pregled odnosi se na izabranu odluku. Ovo je ponovni pregled u okviru podrške; ne predstavlja nezavisan žalbeni organ.</T> : null}
      {deciding ? <>
        <View style={supportStyles.list} accessibilityRole="radiogroup" accessibilityLabel="Odluka o zahtevu">
          <SupportChoiceRow kind="radio" label="Prihvati zahtev" selected={outcome === 'ACCEPTED'} disabled={disabled} onPress={() => { if (current()) setOutcome('ACCEPTED'); }} />
          <SupportChoiceRow kind="radio" label="Odbij zahtev" selected={outcome === 'REJECTED'} disabled={disabled} last onPress={() => { if (current()) setOutcome('REJECTED'); }} />
        </View>
        <View>
          <SupportField label="Oznaka razloga" value={reason} onChange={value => { if (current() && !disabled) setReason(value); }} maximum={64} disabled={disabled} />
          <T variant="note" tone="muted" style={s.hint}>Velika slova A–Z, brojevi i donja crta. Oznaka opisuje odgovor; ne uvodi novo pravilo ili sankciju.</T>
        </View>
        {detail.evidence.length ? <SettingsGroup title="Dokazi na koje se odluka oslanja">
          {detail.evidence.map((item, index, all) => <SupportChoiceRow key={item.id} kind="check" label={supportReferenceNames[item.reference.kind]}
            detail={supportTime(item.createdAt)} selected={evidenceIds.includes(item.id)} last={index === all.length - 1} disabled={disabled}
            onPress={() => { if (current() && !disabled) setEvidenceIds(ids => ids.includes(item.id) ? ids.filter(id => id !== item.id) : [...ids, item.id]); }} />)}
        </SettingsGroup> : null}
      </> : null}
      <SupportField label={deciding ? 'Obrazloženje' : action === 'APPEAL' ? 'Razlog i nove činjenice' : 'Tekst poruke'} value={body}
        onChange={value => { if (current() && !disabled) setBody(value); }} maximum={4000} multiline disabled={disabled} />
      {state.message && (state.phase === 'ERROR' || state.pending) ? <T variant="note" tone={supportMessageTone(state) === 'danger' ? 'danger' : 'ink'}
        accessibilityRole="alert" accessibilityLiveRegion="polite">{state.message}</T> : null}
    </View>}
  </ProductSheet>;
}

const s = StyleSheet.create({
  head: { alignItems: 'flex-start' },
  // The request's own words and what it points at, parted from the thread under it by the space and not by a line.
  summary: { gap: sys.space.md, paddingBottom: sys.space.base },
  fact: { gap: sys.space.xs },
  evidence: { maxWidth: '82%', gap: sys.space.xs, marginTop: sys.space.xs },
  mineSide: { alignSelf: 'flex-end' },
  theirsSide: { alignSelf: 'flex-start' },
  orphan: { marginTop: sys.space.md },
  appeal: { gap: sys.space.xs, paddingTop: sys.space.sm },
  operator: { gap: sys.space.sm, marginTop: sys.space.xl },
  operatorActions: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm },
  sheet: { gap: sys.space.base },
  hint: { marginTop: -sys.space.md },
});
