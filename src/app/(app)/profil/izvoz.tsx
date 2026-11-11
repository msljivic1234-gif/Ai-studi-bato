import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import type { DataExportFile, DataExportPreparation, DataExportStatus } from '../../../contracts/dataExport';
import { dataExportClientService as exports } from '../../../data/dataExportClientService';
import type { Ishod } from '../../../data/ports';
import { failure, sameId } from '../../../data/serverReceipt';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { saveDataExportFile } from '../../../lib/dataExportFile';
import { noviZahtevId } from '../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { SettingsAction as Button } from '../../../ui/settings/SettingsPresentation';
import { ExportScreenView, type NoticeTone } from '../../../ui/privacy/ExportPresentation';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';

type Snapshot = { status: DataExportStatus; preparation: DataExportPreparation | null };
const changed = () => failure('EXPORT_SCOPE_CHANGED', 'Ponovo otvori izvoz podataka.');

export default function IzvozPodataka() {
  const { user, accountRevision } = useSesija();
  return <OwnedExport key={`${user?.id ?? ''}:${accountRevision}`} />;
}
function OwnedExport() {
  const { user, accountRevision } = useSesija(); const accountId = user?.id;
  const identity = useMemo(() => ({}), [accountId, accountRevision]);
  const latestIdentity = useRef(identity); latestIdentity.current = identity;
  const focus = useRef<object | null>(null), navigating = useRef(false), dialog = useRef<object | null>(null);
  const download = useRef<AbortController | null>(null), pendingKey = useRef<string | null>(null);
  const [savingFile, setSavingFile] = useState(false), [notice, setNoticeState] = useState<{ text: string; tone: NoticeTone } | null>(null);
  // The words are the screen's own; the tone says whether it went through (green), failed (danger) or only happened (ink).
  const setNotice = (text: string | null, tone: NoticeTone = 'ink') => setNoticeState(text === null ? null : { text, tone });
  // Which of the footer's own writes is in flight, so that button shows it is working while every other one waits grey.
  // A request that repeats a retained key is 'replay': its button keeps "Ponovi isti zahtev" while it runs, the first
  // request keeps its own words (the key is retained before the write, so the label cannot be read from it then).
  const [working, setWorking] = useState<'request' | 'replay' | 'prepare' | null>(null);
  const [fileReadbackRequired, setFileReadbackRequired] = useState(false);
  const fileReadback = useRef(false);
  const requireFileReadback = (value: boolean) => { fileReadback.current = value; setFileReadbackRequired(value); };
  const [, tick] = useState(0);
  // Wherever the screen retires `dialog.current`, the open question it belonged to leaves the screen too.
  const confirmSheet = useConfirmSheet(), retireConfirmation = confirmSheet.close;
  useFocusEffect(useCallback(() => {
    const scope = {}; focus.current = scope; navigating.current = false; setSavingFile(false); setNotice(null);
    return () => { if (focus.current === scope) focus.current = null; dialog.current = null; retireConfirmation();
      download.current?.abort(); download.current = null; };
  }, [identity, retireConfirmation]));
  const owned = () => focus.current !== null && latestIdentity.current === identity && !!accountId
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
  const read = useCallback(async (): Promise<Ishod<Snapshot>> => {
    const scope = focus.current;
    const result = await exports.readStatus();
    if (!scope || focus.current !== scope || latestIdentity.current !== identity || sesijaSada().user?.id !== accountId
      || sesijaSada().accountRevision !== accountRevision) return changed();
    if (!result.ok) return result;
    requireFileReadback(false);
    if (pendingKey.current && result.podatak.request?.clientRequestId === pendingKey.current) pendingKey.current = null;
    return { ok: true, podatak: { status: result.podatak, preparation: null } };
  }, [identity, accountId, accountRevision]);
  const editor = useOwnedEditor(read), status = editor.data?.status, request = status?.request;
  const latestData = useRef(editor.data); latestData.current = editor.data;
  const renderedFocus = focus.current;
  const current = () => owned() && focus.current === renderedFocus && latestData.current === editor.data && !navigating.current;
  const canAct = () => current() && !!editor.data && !editor.busy && !editor.loading && !editor.uncertain && !fileReadback.current && !download.current;
  const busy = editor.busy || editor.uncertain || savingFile;
  const artifact = status?.fulfillment;
  const expires = artifact ? Date.parse(artifact.artifactExpiresAt) : NaN;
  const available = status?.downloadAvailable === true && request?.status === 'READY'
    && artifact?.artifactAvailable === true && Number.isFinite(expires) && expires > Date.now();
  useEffect(() => {
    if (!Number.isFinite(expires) || expires <= Date.now()) return;
    const timer = setTimeout(() => tick(value => value + 1), Math.min(expires - Date.now() + 1, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [expires]);
  const back = () => { if (!owned() || navigating.current) return; navigating.current = true; dialog.current = null; retireConfirmation();
    download.current?.abort(); if (router.canGoBack()) router.back(); else router.replace('/profil'); };
  const refresh = () => { if (!current() || editor.busy || download.current) return;
    dialog.current = null; retireConfirmation(); setNotice(null); void editor.refresh(); };
  // Both questions withdraw something (a request, a copy), so the confirm is drawn as the destructive one. The sheet
  // waits on the command it started and shows no outcome of its own: the notice below does.
  const ask = (title: string, copy: string, label: string, command: () => Promise<void>) => {
    if (!canAct() || dialog.current) return; const token = {}; dialog.current = token;
    const cancel = () => { if (dialog.current === token) dialog.current = null; };
    confirmSheet.ask({ title, message: copy, cancelLabel: 'Odustani', onCancel: cancel, confirmLabel: label, tone: 'danger', onConfirm: () => {
      if (dialog.current !== token || !canAct()) return; dialog.current = null; return command();
    } });
  };
  const requestExport = async () => {
    if (!canAct() || (request && ['REQUESTED', 'PROCESSING'].includes(request.status))) return;
    const replay = pendingKey.current !== null;
    const key = pendingKey.current ?? noviZahtevId('izvoz'); pendingKey.current = key;
    // Marked only once the editor has taken the write, so a refused second press never clears the first one's spinner.
    let started = false;
    try {
      await editor.save(async () => {
        started = true; setWorking(replay ? 'replay' : 'request');
        const result = await exports.requestExport(key);
        if (!current()) return changed(); if (!result.ok) return result;
        if (result.podatak.clientRequestId !== key) return failure('EXPORT_INVALID_RECEIPT', 'Ne znamo da li je zahtev poslat. Osveži stanje.');
        pendingKey.current = null; setNotice('Zahtev za izvoz je zabeležen.', 'success'); return read();
      });
    } finally { if (started) setWorking(null); }
  };
  const prepare = async () => {
    if (!canAct() || !request || !['REQUESTED', 'PROCESSING'].includes(request.status)) return;
    let started = false;
    try {
      await editor.save(async () => {
        started = true; setWorking('prepare');
        const result = await exports.prepareExport(request.receiptId);
        if (!current()) return changed(); if (!result.ok) return result;
        if (!sameId(result.podatak.receiptId, request.receiptId)) return failure('EXPORT_INVALID_RECEIPT', 'Ne znamo da li je priprema počela. Osveži stanje.');
        if (result.podatak.kind === 'NOT_READY') return { ok: true, podatak: { ...editor.data!, preparation: result.podatak } };
        setNotice(result.podatak.kind === 'PROCESSING' ? 'Priprema kopije je pokrenuta.' : 'Priprema je počela. Proveravamo da li je kopija spremna.', 'success');
        return read();
      });
    } finally { if (started) setWorking(null); }
  };
  const cancelRequest = () => {
    if (!request || request.status !== 'REQUESTED') return;
    ask('Otkaži zahtev?', 'Zahtev koji još nije preuzet u obradu biće otkazan.', 'Otkaži zahtev', async () => {
      await editor.save(async () => { const result = await exports.cancelExport(request.receiptId);
        if (!current()) return changed(); if (!result.ok) return result;
        if (!sameId(result.podatak.receiptId, request.receiptId) || result.podatak.status !== 'CANCELLED') return changed();
        setNotice('Zahtev je otkazan.', 'success'); return read(); });
    });
  };
  const revoke = () => {
    if (!request || request.status !== 'READY' || !artifact) return;
    ask('Opozovi kopiju?', 'Kopija više neće biti dostupna za preuzimanje. Već sačuvani fajlovi na vašem uređaju ostaju kod vas.', 'Opozovi kopiju', async () => {
      await editor.save(async () => { const result = await exports.revokeExport(request.receiptId);
        if (!current()) return changed(); if (!result.ok) return result;
        if (!sameId(result.podatak.receiptId, request.receiptId) || result.podatak.revoked !== true) return changed();
        setNotice('Preuzimanje kopije je opozvano.', 'success'); return read(); });
    });
  };
  const saveFile = async () => {
    if (!canAct() || !available || !request || !artifact || Date.now() >= expires) return;
    const controller = new AbortController(); download.current = controller; setSavingFile(true); setNotice(null);
    let bytes: DataExportFile | null = null;
    const ownsDownload = () => current() && download.current === controller && !controller.signal.aborted;
    const ownedDownload = () => ownsDownload() && Date.now() < expires;
    try {
      const result = await exports.downloadExport({ receiptId: request.receiptId, artifactGeneration: artifact.artifactGeneration }, controller.signal);
      if (!ownedDownload()) { if (result.ok) result.podatak.bytes.fill(0); return; }
      if (!result.ok) { requireFileReadback(true); setNotice(result.poruka, 'danger'); return; }
      bytes = result.podatak;
      if (!sameId(bytes.receiptId, request.receiptId) || !sameId(bytes.artifactGeneration, artifact.artifactGeneration)
        || bytes.byteLength !== artifact.byteLength || bytes.sha256 !== artifact.sha256 || bytes.md5 !== artifact.md5) {
        requireFileReadback(true); setNotice('Preuzeta kopija nije potvrđena. Osveži stanje.', 'danger'); return;
      }
      const saved = await saveDataExportFile({ artifact: bytes, isCurrent: ownedDownload, signal: controller.signal });
      // Expiry can require deletion after a local write. A failed deletion still matters to this owner;
      // only that warning survives expiry, never a saved claim or a result from a retired operation.
      if (!ownsDownload() || (Date.now() >= expires && !(saved.status === 'FAILED' && saved.code === 'CLEANUP_FAILED'))) return;
      const copy = saved.status === 'SAVED' ? 'Kopija je sačuvana u izabranoj fascikli.'
        : saved.status === 'DOWNLOAD_STARTED' ? 'Preuzimanje je počelo u pregledaču. Fajl potraži u preuzetim datotekama.'
          : saved.status === 'CANCELLED' ? 'Čuvanje je otkazano. Kopija nije sačuvana.'
            : saved.status === 'UNSUPPORTED' ? 'Čuvanje fajla nije podržano na ovom uređaju.'
              : saved.status === 'BUSY' ? 'Završi prethodni izbor fascikle pre novog pokušaja.'
                : saved.status === 'FAILED' && saved.code === 'EXISTS' ? 'Ova kopija već postoji u izabranoj fascikli. Izaberi drugu fasciklu.'
                  : saved.status === 'FAILED' && saved.code === 'CLEANUP_FAILED' ? 'Ne znamo da li je kopija sačuvana. U izabranoj fascikli može biti nepotpun fajl.'
                    : 'Čuvanje nije potvrđeno. Proveri stanje pa pokušaj ponovo.';
      setNotice(copy, saved.status === 'SAVED' ? 'success'
        : saved.status === 'DOWNLOAD_STARTED' || saved.status === 'CANCELLED' || saved.status === 'BUSY' ? 'ink' : 'danger');
    } catch { if (ownedDownload()) { requireFileReadback(true); setNotice('Preuzimanje nije potvrđeno. Proveri vezu pa pokušaj ponovo.', 'danger'); } }
    finally { bytes?.bytes.fill(0); if (download.current === controller) { download.current = null; if (current()) setSavingFile(false); } }
  };
  // A re-read the person asked for keeps the card and the footer on screen: the action waits grey and says why, so the layout
  // does not jump and nothing is pressed over a state that is being read. The footer is absent only when there is nothing
  // read to act on (the first read, a failed one, or one that must be read again before anything else).
  const readyView = !editor.error && !!status && !fileReadbackRequired;
  const rereading = editor.loading ? 'Učitavamo stanje…' : null;
  const primary = readyView ? available
    // The button whose own write is in flight keeps its words and shows a spinner (its green kept); the others wait grey
    // with theirs (round 5 review: the words no longer change while it works).
    ? <Button label="Preuzmi i sačuvaj" disabled={busy || editor.loading} loading={savingFile} reason={rereading}
      onPress={() => { void saveFile(); }} />
    : request && ['REQUESTED', 'PROCESSING'].includes(request.status)
      ? <Button label="Pripremi kopiju" disabled={busy || editor.loading} loading={editor.busy && working === 'prepare'} reason={rereading}
        onPress={() => { void prepare(); }} />
      // The retained key is set before the write, so while a first request runs its label is taken from `working`, not
      // from the key: the very first request never reads "Ponovi isti zahtev" beside its spinner.
      : <Button label={editor.busy && working === 'request' ? request ? 'Zatraži novu kopiju' : 'Zatraži izvoz'
          : pendingKey.current ? 'Pošalji ponovo' : request ? 'Zatraži novu kopiju' : 'Zatraži izvoz'} disabled={busy || editor.loading}
        loading={editor.busy && (working === 'request' || working === 'replay')} reason={rereading} onPress={() => { void requestExport(); }} />
    : null;
  const failed = editor.error || !status || fileReadbackRequired;
  return <><ExportScreenView onBack={back} loading={editor.loading} status={status ?? null} preparation={editor.data?.preparation ?? null}
    failure={editor.loading || !failed ? null : { title: fileReadbackRequired ? 'Proveri stanje izvoza' : 'Stanje izvoza nije učitano',
      body: editor.error ?? (fileReadbackRequired ? 'Učitaj trenutno stanje pre novog pokušaja.' : 'Stanje izvoza nije dostupno.') }}
    now={Date.now()} busy={busy} notice={notice} primary={primary}
    onCancel={cancelRequest} onRevoke={revoke} onRefresh={refresh} refreshDisabled={editor.busy} />{confirmSheet.sheet}</>;
}
