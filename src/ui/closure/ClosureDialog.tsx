import { useCallback, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { AppState, Modal } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { sesijaSada, useSesija } from '../../store/sesija';
import { accountClosureClientService } from '../../data/accountClosureClientService';
import { closureExecutionClientService, type ClosureExecutionReview, type ClosureExecutionState,
  type ClosureStartIntent } from '../../data/closureExecutionClientService';
import { authClientService } from '../../data/authClientService';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { closureIntentJournal, type ClosureIntent } from './closureIntent';
import { SettingsRow } from '../settings/SettingsPresentation';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { useReducedMotion } from '../system/motion';
import { ClosureView, closureUnconfirmedCopy, type ClosureBlockerPlace, type ClosureModel } from './ClosurePresentation';

/**
 * The entry on Privatnost i podaci: a quiet row for something done once in a long while, with no red (the seriousness is
 * shown inside the flow, not by alarming the overview). The flow opens over the screen in the existing Modal host: a
 * route of its own (`/profil/zatvaranje`) needs a line in the tab layout, which belongs to another unit (round 5 note).
 */
export function ClosureEntry({ canOpen = () => true, disabled = false }: { canOpen?: () => boolean; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const requestClose = useRef<(() => void) | null>(null);
  const reduced = useReducedMotion();
  useFocusEffect(useCallback(() => () => setOpen(false), []));
  return <>
    <SettingsRow compact last label="Zatvaranje naloga"
      disabled={disabled} onPress={() => { if (!open && canOpen()) setOpen(true); }} />
    {open ? <Modal visible presentationStyle="fullScreen" animationType={reduced ? 'none' : 'fade'} onRequestClose={() => requestClose.current?.()}>
      <ClosureDialog onClose={() => setOpen(false)} closeRequestRef={requestClose} />
    </Modal> : null}
  </>;
}

type Working = ClosureModel['working'];

export function ClosureDialog({ onClose, closeRequestRef }: { onClose: () => void; closeRequestRef?: Ref<() => void> }) {
  const router = useRouter();
  const session = useSesija(), accountId = session.user?.id, accountRevision = session.accountRevision;
  const owner = { accountId: accountId ?? '', accountRevision };
  const focus = useRef<object | null>(null), locked = useRef(false), leaving = useRef(false);
  const [visit, setVisit] = useState<object | null>(null);
  const active = useRef(AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const [busy, setBusy] = useState(true), [message, setMessage] = useState('');
  const [review, setReview] = useState<ClosureExecutionReview | null>(null), [intent, setIntent] = useState<ClosureIntent | null>(null);
  const [state, setState] = useState<ClosureExecutionState | null>(null), [absent, setAbsent] = useState(false);
  const [working, setWorking] = useState<Working>(null);
  // The irreversible start is asked in a sheet. The sheet holds the answer it was given, so the answer is fenced by the
  // question's own token and by the review it asked about: a confirm kept across a refresh or a refocus starts nothing.
  const confirm = useConfirmSheet(), closeQuestion = confirm.close;
  const dialog = useRef<object | null>(null);
  const reviewRef = useRef(review); reviewRef.current = review;
  const retireQuestion = () => { dialog.current = null; closeQuestion(); };
  const live = (token: object | null) => token !== null && focus.current === token && !leaving.current && active.current && !!accountId
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;

  async function finishIntent(i: ClosureIntent, token: object) {
    if (!live(token)) return;
    await closureIntentJournal.clear(i.accountId, i.clientRequestId, () => live(token)); if (!live(token)) return;
    // A different dialog may have saved another intent. Clearing this key is
    // not permission to discard its successor or to start a new command.
    const pending = await closureIntentJournal.load(i.accountId); if (!live(token)) return;
    setIntent(pending); setAbsent(false); setReview(null); setState(null);
    if (pending) await readIntent(pending, token); else await readReview(token);
  }
  async function readIntent(i: ClosureIntent, token: object, knownRefusal = false) {
    if (i.kind === 'START') {
      const result = await closureExecutionClientService.read(i.clientRequestId, owner); if (!live(token)) return;
      if (!result.ok) { setMessage(result.poruka); return; }
      if (!result.podatak.found && knownRefusal) { await finishIntent(i, token); return; }
      setAbsent(!result.podatak.found); setState(result.podatak.execution);
      setMessage(result.podatak.found ? '' : closureUnconfirmedCopy.START);
    } else {
      const result = await accountClosureClientService.readReceipt(i.clientRequestId, owner); if (!live(token)) return;
      if (!result.ok) { setMessage(result.poruka); return; }
      if (!result.podatak.found && !knownRefusal) { setAbsent(true); setMessage(closureUnconfirmedCopy.PREPARE); return; }
      await finishIntent(i, token);
    }
  }
  async function readReview(token: object) {
    const result = await closureExecutionClientService.review(owner); if (!live(token)) return;
    if (!result.ok) { setMessage(result.poruka); return; }
    setReview(result.podatak);
  }
  async function restore(token: object) {
    if (!live(token)) return;
    retireQuestion();
    // Returning from the background must re-establish the current review/execution.
    // If that read fails, an old ready review cannot authorize another start.
    // The durable intent remains in its journal and is still reconciled below.
    setReview(null); setState(null); setAbsent(false);
    const saved = await closureIntentJournal.load(owner.accountId); if (!live(token)) return;
    setIntent(saved); setAbsent(false);
    if (saved) await readIntent(saved, token); else await readReview(token);
  }
  async function run(work: (token: object) => Promise<void>, doing: Working = null, token = visit) {
    if (!live(token) || locked.current) return;
    locked.current = true; setBusy(true); setWorking(doing); setMessage('');
    try { await work(token!); } catch { if (live(token)) setMessage(closureUnconfirmedCopy.CAUGHT); }
    finally { if (live(token)) { locked.current = false; setBusy(false); setWorking(null); } }
  }
  useFocusEffect(useCallback(() => {
    const token = {}; focus.current = token; setVisit(token); leaving.current = false; locked.current = true; setBusy(true); setWorking(null);
    void restore(token).catch(() => { if (live(token)) setMessage('Sačuvani zahtev trenutno nije dostupan. Pokušaj ponovo.'); })
      .finally(() => { if (live(token)) { locked.current = false; setBusy(false); setWorking(null); } });
    const subscription = AppState.addEventListener('change', next => {
      active.current = next === 'active';
      if (leaving.current) return;
      if (!active.current) { focus.current = null; locked.current = false; retireQuestion(); }
      // Back in the foreground the flow reads again, and says so on its own check button (round 5 review: every button
      // went grey with no spinner and no words).
      else if (focus.current === null) { const foreground = {}; focus.current = foreground; setVisit(foreground); void run(restore, 'refresh', foreground); }
    });
    return () => { focus.current = null; locked.current = false; retireQuestion(); subscription.remove(); };
  // Scope follows account incarnation; token refresh leaves the pending intent intact.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, accountRevision]));
  async function send(i: ClosureIntent, token: object) {
    if (!live(token)) return;
    const result = i.kind === 'START' ? await closureExecutionClientService.start(i, owner)
      : await accountClosureClientService.prepare({ expectedRevision: i.expectedRevision, clientRequestId: i.clientRequestId }, owner);
    if (!live(token)) return;
    if (!result.ok) setMessage(result.poruka);
    // These current SQL rejections happen before a fresh command is committed.
    // A transport/receipt failure stays UNKNOWN. Even a known rejection retires
    // its intent only after the owned, exact-key receipt lookup confirms absence.
    const knownRefusal = !result.ok && (result.kod === 'CLOSURE_REVISION_CONFLICT'
      || (i.kind === 'START' && (result.kod === 'CLOSURE_POLICY_NOT_READY' || result.kod === 'CLOSURE_BLOCKED')));
    await readIntent(i, token, knownRefusal);
  }
  const prepare = () => run(async token => {
    const status = await accountClosureClientService.read(owner); if (!live(token)) return;
    if (!status.ok) { setMessage(status.poruka); return; }
    const i: ClosureIntent = { kind: 'PREPARE', accountId: owner.accountId, clientRequestId: noviUuidZahtevId(), expectedRevision: status.podatak.revision };
    await closureIntentJournal.save(i); if (!live(token)) return;
    setIntent(i); await send(i, token);
  }, 'prepare');
  const start = () => run(async token => {
    if (!review?.ready || !review.requestId || !review.policySha256 || intent) return;
    const i: ClosureStartIntent = { kind: 'START', accountId: owner.accountId, clientRequestId: noviUuidZahtevId(), requestId: review.requestId,
      expectedRevision: review.revision, policySha256: review.policySha256 };
    await closureIntentJournal.save(i); if (!live(token)) return;
    setIntent(i); setAbsent(false); await send(i, token);
  }, 'start');
  // Deep read 8.18: the irreversible start used to be one tap. It asks once more, in a danger sheet.
  const askStart = () => {
    if (!live(visit) || busy || locked.current || intent || !review?.ready || dialog.current) return;
    const token = {}, asked = review; dialog.current = token;
    confirm.ask({ title: 'Zatvoriti nalog?', message: 'Posle ovog koraka nalog se zaključava i podaci se uklanjaju. To ne možeš da poništiš.',
      confirmLabel: 'Da, trajno zatvori nalog', cancelLabel: 'Odustani', tone: 'danger',
      onCancel: () => { if (dialog.current === token) dialog.current = null; },
      onConfirm: () => {
        if (dialog.current !== token || reviewRef.current !== asked || !live(visit)) return;
        dialog.current = null;
        // Returned, so the sheet stays busy until the start and its read have settled.
        return start();
      } });
  };
  const refresh = () => { if (!live(visit)) return; retireQuestion(); return run(async token => { setReview(null); await restore(token); }, 'refresh'); };
  const retry = () => run(async token => {
    if (!intent || !absent) return;
    await readIntent(intent, token); if (!live(token)) return;
    // A read immediately before replay might now find the receipt. Never rely on
    // stale React state; read again and submit only when this exact key is absent.
    const known = intent.kind === 'START' ? await closureExecutionClientService.read(intent.clientRequestId, owner)
      : await accountClosureClientService.readReceipt(intent.clientRequestId, owner);
    if (!live(token) || !known.ok || known.podatak.found) return;
    await send(intent, token);
  }, 'retry');
  const logout = () => run(async token => { if (!live(token)) return; await authClientService.signOutLocal(owner); }, 'logout');
  // Retire this visit before requesting unmount: repeated presses and a pending
  // persistence/read completion must not act during the native dismissal.
  const close = () => {
    if (!live(visit)) return false;
    leaving.current = true; focus.current = null; locked.current = false; retireQuestion(); onClose(); return true;
  };
  // Android Modal Back must retire the same scope before the host unmounts it.
  useImperativeHandle(closeRequestRef, () => () => { close(); });
  // The flow lies over the screen that opened it, so leaving it for another place closes it first.
  const support = () => { if (busy || locked.current || !close()) return; router.push('/podrska'); };
  const blocker = (place: ClosureBlockerPlace) => {
    if (busy || locked.current || !close()) return;
    if (place === 'dogovori') router.navigate('/dogovori'); else if (place === 'zadaci') router.navigate('/potrebe'); else router.navigate('/moje-prijave');
  };
  const exportData = () => { if (busy || locked.current || !close()) return; router.navigate('/profil/izvoz'); };
  return <>
    <ClosureView model={{ busy, working, message, review, intent, state, absent }} commands={{
      onClose: close, onPrepare: () => { void prepare(); }, onAskStart: askStart,
      onRetry: () => { void retry(); }, onRefresh: () => { void refresh(); }, onLogout: () => { void logout(); },
      onSupport: support, onBlocker: blocker, onExport: exportData,
    }} />
    {confirm.sheet}
  </>;
}
