import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Linking } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { LegalDocument } from '../../../contracts/legal';
import { legalClientService } from '../../../data/legalClientService';
import { processorMapClientService } from '../../../data/processorMapClientService';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../store/sesija';

import { LegalReviewView } from '../../../ui/legal/LegalDocuments';
import { LegalReviewController, legalHttpsUrl, reviewedDocuments, sessionLegalIntentJournal } from '../../../ui/legal/legalReview';
import { SettingsAction } from '../../../ui/settings/SettingsPresentation';

type LinkAttempt = { focus: object; timer?: ReturnType<typeof setTimeout> };
const LINK_OPEN_TIMEOUT_MS = 10000;
const LINK_UNCONFIRMED = 'Otvaranje dokumenta nije potvrđeno. Pokušajte ponovo.';

export default function PravnaDokumenta() {
  const { user, accountRevision } = useSesija();
  return <OwnedLegal key={`${user?.id ?? ''}:${accountRevision}`} />;
}
function OwnedLegal() {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const focus = useRef<object | null>(null), opening = useRef<LinkAttempt | null>(null), leaving = useRef(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const retireLink = useCallback(() => {
    const attempt = opening.current; opening.current = null;
    if (attempt?.timer !== undefined) clearTimeout(attempt.timer);
  }, []);
  const owner = useCallback(() => !!accountId && sesijaSada().user?.id === accountId &&
    sesijaSada().accountRevision === accountRevision, [accountId, accountRevision]);
  const controller = useMemo(() => new LegalReviewController({ isOwner: owner, newId: noviUuidZahtevId,
    intentJournal: sessionLegalIntentJournal(`${accountId ?? ''}:${accountRevision}`),
    readBundle: () => legalClientService.readBundle(), readProcessors: () => processorMapClientService.readStatus(),
    accept: (key, terms, privacy) => legalClientService.acceptReviewedBundle(key, terms, privacy),
    readAcceptance: key => legalClientService.readAcceptance(key) }), [owner, accountId, accountRevision]);
  const state = useSyncExternalStore(controller.subscribe, controller.snapshot, controller.snapshot);
  useFocusEffect(useCallback(() => {
    const token = {}; focus.current = token; leaving.current = false; setLinkError(null); controller.activate();
    return () => { if (focus.current === token) { focus.current = null; retireLink(); } controller.deactivate(); };
  }, [controller, retireLink]));
  const renderedFocus = focus.current;
  const current = () => !!renderedFocus && focus.current === renderedFocus && owner() && !leaving.current;
  const back = () => { if (!current()) return; leaving.current = true; retireLink(); controller.deactivate();
    if (router.canGoBack()) router.back(); else router.replace('/profil'); };
  const openUrl = (value: string) => {
    const url = legalHttpsUrl(value), token = focus.current;
    if (!current() || !token || !url || opening.current) return;
    const attempt: LinkAttempt = { focus: token }; opening.current = attempt; setLinkError(null);
    const settle = (unconfirmed: boolean) => {
      // A timed-out or blurred attempt cannot release a newer launch or change its feedback.
      if (opening.current !== attempt) return;
      retireLink();
      if (unconfirmed && focus.current === attempt.focus && current()) setLinkError(LINK_UNCONFIRMED);
    };
    attempt.timer = setTimeout(() => settle(true), LINK_OPEN_TIMEOUT_MS);
    try { void Promise.resolve(Linking.openURL(url)).then(() => settle(false), () => settle(true)); }
    catch { settle(true); }
  };
  const documents = reviewedDocuments(state.bundle);
  const receiptCurrent = state.receipt && documents && documents[0].sha256 === state.receipt.termsSha256 && documents[1].sha256 === state.receipt.privacySha256;
  const confirmed = state.bundle?.acceptedCurrentBundle || !!receiptCurrent;
  // The pressed command keeps its words while it runs, with a spinner: an acceptance in flight already counts as one to
  // read back (the controller marks it so before the write), and must not read "Proveri ishod" while it is still sending.
  const [working, setWorking] = useState<'accept' | 'read' | 'replay' | null>(null);
  const press = (kind: 'accept' | 'read' | 'replay', command: () => Promise<void>) => {
    setWorking(kind); void command().finally(() => setWorking(value => value === kind ? null : value));
  };
  const shown = state.busy ? working : null;
  // A grey action says why, in the foot's own line above it: while the documents are being read again nothing can be accepted.
  const reading = state.loading ? 'Učitavamo dokumente…' : null;
  const action = state.pending ? <SettingsAction label={shown === 'accept' ? 'Prihvati pregledane dokumente' : shown === 'read' ? 'Proveri da li je prihvaćeno'
    : shown === 'replay' ? 'Ponovi prethodno prihvatanje' : state.pending === 'READ_REQUIRED' ? 'Proveri da li je prihvaćeno' : 'Ponovi prethodno prihvatanje'}
    loading={state.busy} disabled={state.busy || state.loading}
    onPress={() => { if (!current()) return; if (state.pending === 'READ_REQUIRED') press('read', () => controller.readOutcome());
      else press('replay', () => controller.accept(state.bundle)); }} />
    : documents && !confirmed ? <SettingsAction label="Prihvati pregledane dokumente" loading={state.busy} disabled={state.busy || state.loading}
      onPress={() => { if (current()) press('accept', () => controller.accept(state.bundle)); }} /> : null;
  return <LegalReviewView state={state} onBack={back} action={action} actionReason={action ? reading : null} linkError={linkError}
    onOpen={(doc: LegalDocument) => { void openUrl(doc.url); }} onOpenUrl={url => { void openUrl(url); }}
    onRefresh={() => { if (current()) void controller.refresh(); }} />;
}
