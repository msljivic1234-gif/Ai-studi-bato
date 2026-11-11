import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { mediaClientService, type MediaAsset, type TaskPhotos } from '../../data/mediaClientService';
import { uuid } from '../../data/serverReceipt';
import { pickPreparedPhotos, photoSelectionMessage, photoSelectionSkipped, type PhotoSource, type PreparedPhoto } from '../../features/media/nativePhotoPicker';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../store/sesija';
import type { PhotoTone } from '../objava/TaskPhotosPresentation';
import type { AttachTileState } from './PhotoAttachTiles';
import { PHOTO_LIMIT, PHOTO_WORDS, photoCount } from './photoWords';

/**
 * The task draft's photos, one controller for the conversation's "+" and the task's photo screen (/fotografije-zadatka).
 * It is the screen's former upload path, moved and kept: the same server calls, the same durable journal and the same
 * recovery (PKG-008 / GAP-0036). What it adds is presentation of a sequence: several photos from one gallery pick go up
 * one after another, each under its own request identity, persisted before its bytes leave; and a photo still being
 * processed is checked again by itself for a bounded time instead of waiting for a manual "Osveži".
 *
 * - The journal key holds ONE request identity, never pixels, path or metadata. The next photo of a sequence starts only
 *   when the previous one has a settled outcome; an unconfirmed one stops the sequence and keeps its exits (same-key resend
 *   while its bytes are in memory, the server-owned cancel, a fresh read).
 * - Bytes live in memory for this visit only (focus); leaving drops them, and a sequence not yet sent says so on return.
 */

type Command = { id: string; photo?: PreparedPhoto };
export type TaskPhotoWork = 'PICK' | 'RETRY' | 'CANCEL' | 'REFRESH' | `REMOVE:${string}` | null;
/** One photo of the draft as the tiles draw it: a saved asset, the one being sent, or one waiting its turn. */
export type TaskPhotoItem = Readonly<{ key: string; requestId: string; assetId: string | null; state: AttachTileState; preview?: ArrayBuffer;
  /** What the X does: remove a saved photo, cancel the unconfirmed send, or drop one that has not left yet. */
  exit: 'REMOVE' | 'CANCEL' | 'DROP' | null;
  /** A tap resends: the unconfirmed one with the same identity, or a photo the server could not process, from its bytes. */
  retry: 'SAME' | 'AGAIN' | null }>;

/** Every 3 s while a photo is processed, for up to a minute; then the person checks again by hand. */
const POLL_MS = 3000, POLL_LIMIT = 20;
/** Upload refusals that say why the server could not process the photo (all technical; there is no content refusal here). */
const TECHNICAL = new Set(['MEDIA_FORMAT_UNSUPPORTED', 'MEDIA_DIMENSIONS_TOO_LARGE', 'MEDIA_SANITIZATION_FAILED', 'MEDIA_INPUT_INVALID']);
const settledState = (state: MediaAsset['state']) => state === 'READY' || state === 'FAILED';

export function useTaskPhotoUploads(conversationId: string | null) {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const key = accountId && conversationId ? `uskoci:media-upload:${accountId}:TASK:${conversationId}` : null;
  const focused = useRef<object | null>(null), operation = useRef(false), pending = useRef<Command | null>(null);
  const abort = useRef<AbortController | null>(null), leaving = useRef(false), bound = useRef<string | null>(null);
  const queue = useRef<Command[]>([]), kept = useRef(new Map<string, PreparedPhoto>());
  const failure = useRef<string | null>(null), skipped = useRef<string | null>(null), interrupted = useRef(0);
  const [photos, setPhotos] = useState<TaskPhotos | null>(null), [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null), [unconfirmed, setUnconfirmed] = useState(false);
  const [recovered, setRecovered] = useState(false), [canRetry, setCanRetry] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false), [processingPending, setProcessingPending] = useState(false);
  const [tone, setTone] = useState<PhotoTone>('info'), [working, setWorking] = useState<TaskPhotoWork>(null);
  const [queued, setQueued] = useState<readonly Command[]>([]), [sending, setSending] = useState<string | null>(null);
  // The sequence of one pick: how many photos it had and how many have gone. A ref for the commands, a state for the words.
  const sequence = useRef<{ total: number; done: number } | null>(null);
  const [batch, setBatchState] = useState<{ total: number; done: number } | null>(null);
  const setBatch = (next: { total: number; done: number } | null) => { sequence.current = next; setBatchState(next); };
  const readyInSequence = useRef(0);
  const [visit, setVisit] = useState(0), [pollRound, setPollRound] = useState(0), [pollSpent, setPollSpent] = useState(false);
  const say = (text: string | null, kind: PhotoTone = 'info') => { setMessage(text); setTone(kind); };
  const owns = useCallback(() => !!accountId && sesijaSada().user?.id === accountId
    && sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const setQueue = (next: Command[]) => { queue.current = next; setQueued(next); };

  const settle = async (asset: MediaAsset, current: () => boolean) => {
    if (!current() || asset.scope !== 'TASK' || asset.conversationId !== conversationId || asset.clientRequestId !== pending.current?.id) return;
    if (!asset.selected || settledState(asset.state)) {
      if (key) await AsyncStorage.removeItem(key);
      if (!current()) return;
      pending.current = null; setUnconfirmed(false); setCanRetry(false); setProcessingPending(false);
      if (asset.selected && asset.state === 'READY') { readyInSequence.current += 1; say('Fotografija je dodata privatnom nacrtu.', 'success'); }
      else if (asset.selected && asset.state === 'FAILED') say(failure.current ? `${failure.current} Izaberi drugu fotografiju.` : PHOTO_WORDS.failed, 'error');
      else say('Fotografija nije dodata. Možeš izabrati drugu.');
      failure.current = null;
    } else {
      // Admitted and still processing: the identity stays until the outcome is known, and the bounded check below asks again.
      setUnconfirmed(true); setProcessingPending(true); say('Ne znamo da li je fotografija obrađena.', 'error');
    }
  };
  const read = async (current: () => boolean) => {
    if (!conversationId || !key || !current()) return;
    const stored = await AsyncStorage.getItem(key);
    if (!current()) return;
    if (stored && !uuid(stored)) {
      // Not a command identity: it can never be reconciled or replayed, so it must not strand the picker.
      await AsyncStorage.removeItem(key);
      if (!current()) return;
      say('Zapis o slanju nije mogao da se pročita, pa je uklonjen. Ne znamo da li je fotografija stigla.');
    } else if (stored && !pending.current) pending.current = { id: stored };
    if (pending.current) {
      setUnconfirmed(true);
      const receipt = await mediaClientService.readUploadCommand(pending.current.id);
      if (!current()) return;
      if (receipt.ok) await settle(receipt.podatak, current);
      else {
        // PKG-008: absence alone is never success and never erases the identity. The owner keeps
        // the same-key retry while the bytes exist and always has the authoritative cancel below.
        const missing = receipt.kod === 'MEDIA_NOT_FOUND', retained = !!pending.current?.photo;
        setCanRetry(retained); setProcessingPending(false);
        say(!missing ? 'Ne znamo da li je slanje uspelo.'
          : retained ? 'Slanje još nije primljeno. Možeš da pošalješ istu fotografiju ponovo ili da odustaneš od slanja.'
            : 'Slanje još nije primljeno, a fotografija više nije na uređaju. Odustani od slanja pa izaberi fotografiju ponovo.', 'error');
      }
    }
    if (!current()) return;
    const result = await mediaClientService.readTaskPhotos(conversationId);
    if (!current()) return;
    if (result.ok) { setPhotos(result.podatak); setRecovered(true); }
    else { say(result.poruka, 'error'); setRecovered(false); }
  };
  useFocusEffect(useCallback(() => {
    const token = {}; focused.current = token; leaving.current = false;
    const current = () => focused.current === token && owns();
    // A different draft (or account) forgets what was shown; coming back to the same one keeps it until the read returns.
    if (bound.current !== key) { bound.current = key; setPhotos(null); }
    setVisit(value => value + 1);
    operation.current = true; setBusy(true); setRecovered(false);
    // Photos chosen but not yet sent when the screen was left are gone with their bytes; say so once on return.
    if (interrupted.current) {
      say(`Slanje je prekinuto pre kraja. Izaberi ponovo fotografije koje nisu poslate (${interrupted.current}).`); interrupted.current = 0;
    }
    void read(current).catch(() => { if (current()) say('Ne možemo da učitamo fotografije. Proveri vezu.', 'error'); })
      .finally(() => { if (current()) { operation.current = false; setBusy(false); } });
    return () => {
      if (focused.current === token) focused.current = null; abort.current?.abort();
      if (pending.current) pending.current = { id: pending.current.id };
      // Bytes never outlive the visit: the waiting photos and every kept preview are dropped.
      interrupted.current += queue.current.length; setQueue([]); kept.current.clear(); setSending(null); setBatch(null);
      operation.current = false; setBusy(false); setWorking(null);
    };
  }, [conversationId, key, owns]));
  const token = focused.current;
  const current = () => !!token && focused.current === token && owns() && !leaving.current;
  const begin = (what: TaskPhotoWork = null) => { if (!current() || operation.current) return false; operation.current = true; setBusy(true); setWorking(what); return true; };
  const finish = () => { if (current()) { operation.current = false; setBusy(false); setWorking(null); } };

  const send = async (command: Command) => {
    if (!conversationId || !key || !command.photo || !current()) return;
    await AsyncStorage.setItem(key, command.id);
    if (!current()) return;
    const controller = new AbortController(); abort.current = controller;
    const run = sequence.current;
    say(run && run.total > 1 ? `Šaljemo fotografije · ${Math.min(run.total, run.done + 1)} od ${run.total}` : 'Šaljemo fotografiju…', 'progress');
    const result = await mediaClientService.uploadTaskPhoto({ conversationId, clientRequestId: command.id,
      bytes: command.photo.bytes, contentType: command.photo.contentType }, { signal: controller.signal });
    if (!current()) return;
    if (result.ok) await settle(result.podatak, current);
    else { failure.current = TECHNICAL.has(result.kod) ? result.poruka : null; setUnconfirmed(true); say(result.poruka, 'error'); }
    await read(current);
  };
  /** The waiting photos go one by one; an unconfirmed one stops the sequence with its exits on screen. */
  const drain = async () => {
    let sent = 0;
    while (current() && !pending.current && queue.current.length) {
      const [command, ...rest] = queue.current; setQueue(rest);
      pending.current = command; setUnconfirmed(true); setSending(command.id);
      try { await send(command); } finally { if (current()) setSending(null); }
      if (!current()) return;
      sent += 1; const run = sequence.current; if (run) setBatch({ ...run, done: run.done + 1 });
    }
    if (!current() || pending.current || queue.current.length) return;
    // A sequence of several ends with one sentence; a single photo keeps the sentence its outcome already said.
    const run = sequence.current, added = readyInSequence.current;
    if (run && run.total > 1 && sent > 0 && added > 0) say([`Dodato u privatni nacrt: ${photoCount(added)}.`, skipped.current].filter(Boolean).join(' '), 'success');
    else if (skipped.current) say(skipped.current, 'error');
    skipped.current = null; readyInSequence.current = 0; setBatch(null);
  };
  const refresh = async () => { if (!begin('REFRESH')) return;
    try { await read(current); if (current() && !pending.current && queue.current.length) await drain(); }
    catch { if (current()) say('Ne možemo da učitamo fotografije. Proveri vezu.', 'error'); } finally { finish(); } };
  const list = photos?.photos ?? [];
  const pendingInList = !!pending.current && list.some(asset => asset.clientRequestId === pending.current?.id);
  const taken = list.length + (pending.current && !pendingInList ? 1 : 0) + queued.length;
  const remaining = Math.max(0, PHOTO_LIMIT - taken);
  const pick = async (source: PhotoSource) => {
    if (!recovered || !photos || !key || pending.current || queue.current.length) return;
    const free = PHOTO_LIMIT - photos.photos.length;
    if (free < 1 || !begin('PICK')) return;
    try {
      say(null); setPermissionDenied(false); skipped.current = null;
      const selection = await pickPreparedPhotos(source, current, { limit: free, onProcessing: (index, total) => {
        if (current()) say(total > 1 ? `Pripremamo fotografije · ${index} od ${total}` : 'Pripremamo fotografiju…', 'progress'); } });
      if (!selection || !current()) { if (current()) say(null); return; }
      // Each photo gets its request identity now; it is persisted only when its turn comes, before its bytes leave.
      const commands = selection.photos.slice(0, free).map(photo => ({ id: noviUuidZahtevId(), photo }));
      for (const command of commands) kept.current.set(command.id, command.photo);
      skipped.current = selection.rejected ? photoSelectionSkipped(selection.rejected, selection.firstError) : null;
      readyInSequence.current = 0; setBatch({ total: commands.length, done: 0 }); setPollRound(value => value + 1);
      setQueue(commands);
      await drain();
    } catch (error) { if (current()) { say(pending.current ? 'Ne znamo da li je slanje uspelo.' : photoSelectionMessage(error), 'error'); setUnconfirmed(!!pending.current);
      // Owner decision 4: a denied camera permission always leaves a way forward (settings or the gallery).
      setPermissionDenied(!pending.current && (error as { code?: string } | null)?.code === 'PERMISSION'); } }
    finally { finish(); }
  };
  const retry = async () => {
    if (!canRetry || !pending.current?.photo || !begin('RETRY')) return;
    try {
      const command = pending.current; setSending(command.id);
      await send(command);
      if (current()) setSending(null);
      if (current() && !pending.current && queue.current.length) await drain();
    } catch { if (current()) say('Ne znamo da li su fotografije poslate.', 'error'); } finally { if (current()) setSending(null); finish(); }
  };
  // PKG-008 / GAP-0036: the server owns the exit. A tombstone (absent key) or a
  // deselection (admitted key) is the only thing that retires the journal identity;
  // an unconfirmed cancellation keeps it, so nothing is erased on a missing row.
  const cancel = async () => {
    const command = pending.current;
    if (!command || !conversationId || !key || !begin('CANCEL')) return;
    try {
      abort.current?.abort();
      const result = await mediaClientService.cancelUploadCommand({ conversationId, clientRequestId: command.id });
      if (!current()) return;
      if (!result.ok) { say(result.poruka, 'error'); return; }
      await AsyncStorage.removeItem(key);
      if (!current()) return;
      pending.current = null; setUnconfirmed(false); setCanRetry(false); setProcessingPending(false); kept.current.delete(command.id);
      // Stopping one send stops the sequence it belonged to: the photos still waiting are not sent behind the person's back.
      const dropped = queue.current.length; setQueue([]); setBatch(null); skipped.current = null;
      say([result.podatak.previousState === null ? 'Slanje je otkazano. Fotografija koja stigne kasnije neće biti prihvaćena.'
        : 'Slanje je otkazano. Fotografija nije u nacrtu.', dropped ? `Ostale izabrane fotografije nisu poslate (${dropped}).` : null].filter(Boolean).join(' '), 'success');
      await read(current);
    } catch { if (current()) say('Ne znamo da li je otkazivanje uspelo.', 'error'); }
    finally { finish(); }
  };
  const remove = async (assetId: string) => {
    if (!recovered || pending.current || !conversationId || !begin(`REMOVE:${assetId}`)) return;
    try {
      const result = await mediaClientService.removeTaskPhoto({ conversationId, assetId });
      if (!current()) return;
      if (result.ok) { setPhotos(result.podatak); say('Fotografija je uklonjena iz nacrta.', 'success'); }
      else { setRecovered(false); say(result.poruka, 'error'); }
    } finally { finish(); }
  };
  /** A photo the server could not process goes out of the draft, and the same picture is sent again under a new identity. */
  const again = async (assetId: string) => {
    const asset = list.find(item => item.assetId === assetId && item.state === 'FAILED');
    const photo = asset ? kept.current.get(asset.clientRequestId) : undefined;
    if (!asset || !photo || !recovered || pending.current || queue.current.length || !conversationId || !begin('RETRY')) return;
    try {
      const result = await mediaClientService.removeTaskPhoto({ conversationId, assetId });
      if (!current()) return;
      if (!result.ok) { setRecovered(false); say(result.poruka, 'error'); return; }
      setPhotos(result.podatak); kept.current.delete(asset.clientRequestId);
      const command = { id: noviUuidZahtevId(), photo }; kept.current.set(command.id, photo);
      readyInSequence.current = 0; setBatch({ total: 1, done: 0 }); setPollRound(value => value + 1); setQueue([command]);
      await drain();
    } catch { if (current()) say(pending.current ? 'Ne znamo da li je slanje uspelo.' : 'Ne znamo da li su fotografije poslate.', 'error'); }
    finally { finish(); }
  };
  /** A photo that has not left the phone yet goes without a question: nothing about it was saved. */
  const drop = (requestId: string) => {
    if (!current()) return;
    setQueue(queue.current.filter(command => command.id !== requestId)); kept.current.delete(requestId);
    const run = sequence.current; if (run) setBatch({ ...run, total: Math.max(run.done, run.total - 1) });
  };
  /** The screen is being left: nothing that settles later may act on it. False when it already was (a second tap of Back). */
  const leave = () => { if (!current()) return false; leaving.current = true; return true; };

  // A photo still being processed is checked again by itself: every 3 s for up to a minute, only while this visit is in
  // front (not in the background), and never on top of another command.
  const processing = recovered && (list.some(asset => !settledState(asset.state)) || processingPending);
  // Forward navigation must not abandon a picked batch. Back remains available with its existing recovery journal.
  const continueReason = !conversationId ? null : busy ? working === 'PICK' || working === 'RETRY' ? 'Sačekaj da se pošalju izabrane fotografije.' : 'Proveravamo fotografije…'
    : !recovered ? 'Prvo učitaj fotografije.' : unconfirmed ? 'Proveri ili otkaži nepotvrđeno slanje.'
      : queued.length || sending ? 'Sačekaj da se pošalju izabrane fotografije.'
      : processing ? 'Fotografije se još obrađuju.' : list.some(asset => asset.state === 'FAILED')
        ? 'Ukloni fotografiju koja nije obrađena ili je pošalji ponovo.' : null;
  const latestContinueReason = useRef(continueReason); latestContinueReason.current = continueReason;
  const canContinue = () => current() && !operation.current && !pending.current && !queue.current.length && !latestContinueReason.current;
  const quiet = useRef<() => Promise<boolean>>(async () => false);
  quiet.current = async () => {
    if (!current() || operation.current) return false;
    operation.current = true;
    try { await read(current); } catch { /* The next check, or the person's own, reads again. */ }
    finally { if (current()) operation.current = false; }
    if (current() && !pending.current && queue.current.length && begin(null)) { try { await drain(); } finally { finish(); } }
    return true;
  };
  useEffect(() => { setPollSpent(false); }, [pollRound, visit]);
  useEffect(() => {
    if (!processing || !conversationId) return;
    let ticks = 0, timer: ReturnType<typeof setTimeout> | null = null, stopped = false;
    let active = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    const stop = () => { if (timer) clearTimeout(timer); timer = null; };
    const schedule = () => {
      stop(); if (stopped || !active) return;
      if (ticks >= POLL_LIMIT) { setPollSpent(true); return; }
      timer = setTimeout(() => { timer = null; ticks += 1; void quiet.current().finally(() => { if (!stopped) schedule(); }); }, POLL_MS);
    };
    const subscription = AppState.addEventListener('change', state => { active = state === 'active'; if (active) schedule(); else stop(); });
    schedule();
    return () => { stopped = true; stop(); subscription.remove(); };
  }, [processing, conversationId, visit, pollRound]);

  const pendingCommand = pending.current;
  const items: TaskPhotoItem[] = [
    ...list.map((asset): TaskPhotoItem => {
      const mine = !!pendingCommand && asset.clientRequestId === pendingCommand.id;
      const state: AttachTileState = asset.state === 'READY' ? { kind: 'READY', assetId: asset.assetId }
        : { kind: asset.state === 'FAILED' ? 'FAILED' : 'PROCESSING' };
      return { key: asset.assetId, requestId: asset.clientRequestId, assetId: asset.assetId, state,
        preview: kept.current.get(asset.clientRequestId)?.bytes, exit: mine ? 'CANCEL' : 'REMOVE',
        retry: asset.state === 'FAILED' && kept.current.has(asset.clientRequestId) ? 'AGAIN' : null };
    }),
    ...(pendingCommand && !pendingInList ? [{ key: `pending:${pendingCommand.id}`, requestId: pendingCommand.id, assetId: null,
      state: { kind: sending === pendingCommand.id ? 'SENDING' : 'UNCONFIRMED' } as AttachTileState,
      preview: (pendingCommand.photo ?? kept.current.get(pendingCommand.id))?.bytes, exit: 'CANCEL' as const,
      retry: sending !== pendingCommand.id && canRetry && !!pendingCommand.photo ? 'SAME' as const : null }] : []),
    ...queued.map((command): TaskPhotoItem => ({ key: `queued:${command.id}`, requestId: command.id, assetId: null,
      state: { kind: 'QUEUED' }, preview: command.photo?.bytes, exit: 'DROP', retry: null })),
  ];
  const full = taken >= PHOTO_LIMIT;
  // A grey add action always says why (owner rule); while one is at work its spinner says it.
  const addReason = !conversationId ? null : busy ? null : !recovered ? 'Fotografije još nisu učitane.'
    : unconfirmed ? 'Prvo završi ili otkaži nepotvrđeno slanje.' : queued.length ? 'Sačekaj da se pošalju izabrane fotografije.'
      : full ? 'Dodato je najviše fotografija. Ukloni jednu da dodaš drugu.' : null;
  return {
    conversationId, items, count: list.length, remaining, full, busy, working, message, tone, permissionDenied, unconfirmed, canRetry,
    loaded: recovered, sending: !!sending, batch,
    /** Before a conversation exists there is nothing to read: adding is open, and the first pick opens it. */
    canAdd: !conversationId || (!busy && recovered && !unconfirmed && !queued.length && !full),
    addReason, continueReason, canContinue,
    /** The read failed and nothing else explains the screen. */
    readError: !busy && !recovered && !!message && !!conversationId && !permissionDenied && !unconfirmed,
    /** A photo is still processing after the bounded checks: the person checks by hand. */
    checkByHand: processing && pollSpent,
    pick, retry, cancel, remove, again, drop, refresh, leave,
  };
}
export type TaskPhotosController = ReturnType<typeof useTaskPhotoUploads>;
