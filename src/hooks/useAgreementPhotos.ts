import { useCallback, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { agreementPhotoClientService, type AgreementPhotoUpload, type AgreementUploadRef } from '../data/agreementPhotoClientService';
import { agreementPhotoJournal } from '../data/agreementPhotoJournal';
import type { OutboxSnapshot } from '../data/agreementOutbox';
import type { AgreementMessageCommand } from '../contracts/agreementMessages';
import { pickPreparedPhoto, photoSelectionMessage, type PhotoSource, type PreparedPhoto } from '../features/media/nativePhotoPicker';
import { noviUuidZahtevId } from '../lib/idempotencija';
import { sesijaSada, useSesija } from '../store/sesija';


type Item = { ref: AgreementUploadRef; receipt: AgreementPhotoUpload | null };
type State = { loaded: boolean; busy: boolean; items: readonly Item[]; saved: readonly AgreementPhotoUpload[]; message: string | null; sending?: string | null };
export function useAgreementPhotos(accountId: string, agreementId: string, agreementVersion: number | null, writable: boolean,
  outbox: { getSnapshot(): Pick<OutboxSnapshot, 'capturing' | 'entries'> }) {
  const { accountRevision } = useSesija();
  const live = useRef({ agreementVersion, writable, outbox }); live.current = { agreementVersion, writable, outbox };
  const identity = useMemo(() => ({ accountId, accountRevision, agreementId }), [accountId, accountRevision, agreementId]);
  const focus = useRef<object | null>(null), operation = useRef<object | null>(null), navigate = useRef(false);
  const prepared = useRef(new Map<string, PreparedPhoto>()), abort = useRef<AbortController | null>(null);
  const [state, setState] = useState<State>({ loaded: false, busy: false, items: [], saved: [], message: null });
  const latest = useRef(state); latest.current = state;
  const owns = () => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const apply = (patch: Partial<State>) => setState(old => { const next = { ...old, ...patch }; latest.current = next; return next; });
  async function read(current: () => boolean) {
    if (!current()) return;
    const refs = await agreementPhotoJournal.load(accountId, agreementId);
    if (!current()) return;
    const items: Item[] = []; let unknown = false;
    for (const ref of refs) {
      const receipt = await agreementPhotoClientService.read(ref, identity);
      if (!current()) return;
      if (receipt.ok && (receipt.podatak.state === 'CANCELLED' || receipt.podatak.state === 'FAILED' || receipt.podatak.attachedMessageId)) {
        await agreementPhotoJournal.clear(accountId, ref, current); prepared.current.delete(ref.clientRequestId);
        if (!current()) return;
      } else {
        items.push({ ref, receipt: receipt.ok ? receipt.podatak : null });
        if (!receipt.ok) unknown = true;
      }
    }
    const inventory = await agreementPhotoClientService.list(agreementId, identity);
    if (!current()) return;
    if (!inventory.ok) { apply({ loaded: false, items, saved: [], message: inventory.poruka }); return; }
    apply({ loaded: true, items, saved: inventory.podatak.filter(upload => !items.some(item => item.ref.clientRequestId === upload.clientRequestId)),
      ...(unknown ? { message: 'Ne znamo da li je fotografija poslata. Osveži fotografije pre novog izbora.' } : {}) });
  }
  useFocusEffect(useCallback(() => {
    const token = {}; focus.current = token; operation.current = token; navigate.current = false;
    const current = () => focus.current === token && owns();
    apply({ loaded: false, busy: true, items: [], saved: [], message: null, sending: null });
    void read(current).catch(() => { if (current()) apply({ loaded: false, message: 'Sačuvani izbor nije učitan. Osveži fotografije.' }); })
      .finally(() => { if (current()) { operation.current = null; apply({ busy: false }); } });
    return () => { if (focus.current === token) focus.current = null; operation.current = null; abort.current?.abort(); prepared.current.clear(); };
  }, [identity]));
  const renderedFocus = focus.current;
  const current = () => !!renderedFocus && focus.current === renderedFocus && owns() && !navigate.current;
  async function run(work: (isCurrent: () => boolean) => Promise<void>) {
    if (!current() || operation.current) return;
    const token = {}; operation.current = token; apply({ busy: true, message: null });
    const valid = () => current() && operation.current === token;
    try { await work(valid); } catch { if (valid()) apply({ loaded: false, message: 'Ishod nije potvrđen. Proveri fotografije pre novog pokušaja.' }); }
    finally { if (valid()) { operation.current = null; apply({ busy: false, sending: null }); } }
  }
  async function upload(ref: AgreementUploadRef, photo: PreparedPhoto, valid: () => boolean) {
    await agreementPhotoJournal.save(accountId, ref, valid);
    if (!valid()) return;
    if (!live.current.writable || live.current.agreementVersion !== ref.agreementVersion) {
      apply({ message: 'Osveži uslove Dogovora pre slanja fotografije.' }); await read(valid); return;
    }
    const controller = new AbortController(); abort.current = controller;
    // The journal owns the request before the first pixel is sent. The preview stays in this focused visit's memory.
    apply({ sending: ref.clientRequestId, message: 'Šaljemo fotografiju…',
      items: [...latest.current.items.filter(item => item.ref.clientRequestId !== ref.clientRequestId), { ref, receipt: null }] });
    const result = await agreementPhotoClientService.upload(ref, photo.bytes, identity, controller.signal);
    if (!valid()) return;
    apply({ sending: null, message: result.ok ? null : result.poruka });
    await read(valid);
  }
  const reserved = (item: Item) => !!item.receipt?.assetId && live.current.outbox.getSnapshot().entries.some(entry => entry.command.photos?.assetIds.includes(item.receipt!.assetId!));
  const editable = state.loaded && !state.busy && writable;
  const pending = state.items.some(item => !item.receipt || !['READY', 'CANCELLED', 'FAILED'].includes(item.receipt.state));
  const unreserved = state.items.filter(item => !reserved(item));
  function capture(): AgreementMessageCommand['photos'] | null {
    if (!current() || operation.current || !live.current.writable || !latest.current.loaded) return null;
    const selected = latest.current.items.filter(item => !reserved(item));
    if (selected.length < 1 || selected.some(item => item.receipt?.state !== 'READY' || item.receipt.attachedMessageId
      || item.ref.agreementVersion !== live.current.agreementVersion || !item.receipt.assetId)) return null;
    return { agreementVersion: live.current.agreementVersion!, assetIds: selected.map(item => item.receipt!.assetId!) };
  }
  return { ...state, agreementId, available: editable && !pending && state.items.length < 6,
    selected: unreserved, hasSelection: unreserved.length > 0, ready: !!capture(), capture,
    versionConflict: unreserved.some(item => item.ref.agreementVersion !== agreementVersion),
    canSubmit: () => current() && !operation.current && live.current.writable && latest.current.loaded
      && (latest.current.items.every(reserved) || capture() !== null),
    canRetry: (id: string) => prepared.current.has(id), reserved,
    preview: (id: string) => current() ? prepared.current.get(id)?.bytes : undefined,
    refresh: () => run(read),
    restore: (clientRequestId: string) => run(async valid => {
      if (live.current.outbox.getSnapshot().capturing || !latest.current.loaded || latest.current.items.length >= 6) return;
      const upload = latest.current.saved.find(item => item.clientRequestId === clientRequestId); if (!upload) return;
      const ref = { agreementId, agreementVersion: upload.agreementVersion, clientRequestId };
      await agreementPhotoJournal.save(accountId, ref, valid); await read(valid);
    }),
    pick: (source: PhotoSource) => run(async valid => {
      if (live.current.outbox.getSnapshot().capturing || !latest.current.loaded || !live.current.writable || !live.current.agreementVersion || latest.current.items.length >= 6
        || latest.current.items.some(item => !item.receipt || item.receipt.state !== 'READY')) return;
      const version = live.current.agreementVersion;
      let photo: PreparedPhoto | null;
      try { photo = await pickPreparedPhoto(source, valid, () => { if (valid()) apply({ message: 'Pripremamo fotografiju…' }); }); }
      catch (error) { if (valid()) apply({ message: photoSelectionMessage(error) }); return; }
      if (!valid()) return;
      if (!photo) { apply({ message: null }); return; }
      const ref = { agreementId, agreementVersion: version, clientRequestId: noviUuidZahtevId() };
      prepared.current.set(ref.clientRequestId, photo); await upload(ref, photo, valid);
    }),
    retry: (ref: AgreementUploadRef) => run(async valid => {
      const item = latest.current.items.find(item => item.ref.clientRequestId === ref.clientRequestId), photo = prepared.current.get(ref.clientRequestId);
      if (!item || !photo || reserved(item) || live.current.outbox.getSnapshot().capturing) return;
      // Read first. A dispatched unknown request never allocates another key or
      // asserts absence; the server also refuses a second Storage dispatch.
      const receipt = await agreementPhotoClientService.read(item.ref, identity); if (!valid()) return;
      if (receipt.ok && receipt.podatak.state === 'ABSENT') await upload(item.ref, photo, valid);
      else await read(valid);
    }),
    remove: (ref: AgreementUploadRef) => run(async valid => {
      const item = latest.current.items.find(item => item.ref.clientRequestId === ref.clientRequestId);
      if (!item || reserved(item) || live.current.outbox.getSnapshot().capturing) return;
      const result = await agreementPhotoClientService.cancel(item.ref, identity); if (!valid()) return;
      if (!result.ok) { apply({ message: result.poruka }); return; }
      if (result.podatak.state === 'CANCELLED' || result.podatak.attachedMessageId) {
        await agreementPhotoJournal.clear(accountId, item.ref, valid); prepared.current.delete(item.ref.clientRequestId);
      }
      await read(valid);
    }),
  };
}
export type AgreementPhotosController = ReturnType<typeof useAgreementPhotos>;
