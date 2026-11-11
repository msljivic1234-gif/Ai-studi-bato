import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { LegalBundleStatus, LegalDocument, LegalDocumentKind } from '../../contracts/legal';
import type { ProcessorLegalRole, ProcessorMapProvider } from '../../contracts/processorMap';
import { legalClientService } from '../../data/legalClientService';
import { sesijaSada } from '../../store/sesija';
import { InlineNote } from '../privacy/InlineNote';
import { ProductSheet } from '../product/ProductSheet';
import { SettingsAction, SettingsGroup, SettingsRow, SettingsScreen, SettingsText as T } from '../settings/SettingsPresentation';
import { Disclosure } from '../system/Disclosure';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { brandAction, sys } from '../system/tokens';
import { QuietReadState } from '../v2/QuietReadState';
import { V2Action } from '../v2/V2Action';
import { boundedLegalRead, legalHttpsUrl, reviewedDocuments, type LegalReviewState } from './legalReview';

const legalTitle = (kind: LegalDocumentKind) => kind === 'TERMS' ? 'Uslovi korišćenja' : 'Politika privatnosti';
export const processorRoles: Record<ProcessorLegalRole, string> = { PROCESSOR: 'Obrađivač', SUBPROCESSOR: 'Podobrađivač', INDEPENDENT_CONTROLLER: 'Samostalni rukovalac' };
/** The one honest sentence when the documents are not published (and nothing is offered in their place). */
export const LEGAL_NOT_PUBLISHED = 'Uslovi korišćenja i Politika privatnosti još nisu objavljeni.';
const LEGAL_UNAVAILABLE = 'Dokumenti trenutno nisu dostupni.';

export function LegalDocumentRows({ bundle, onOpen, disabled = false, refresh }: {
  bundle: LegalBundleStatus | null; onOpen: (document: LegalDocument) => void; disabled?: boolean;
  /** One word at the end of the title ("Osveži"): the whole screen's re-read, said where its documents are. */
  refresh?: { label: string; onPress: () => void; accessibilityLabel?: string };
}) {
  const documents = reviewedDocuments(bundle);
  // The documents are rows with no picture, like the providers' rows under them: one edge for the words of the whole screen.
  return documents ? <SettingsGroup title="Objavljeni dokumenti" action={refresh}>{documents.map((document, index) =>
    <SettingsRow compact key={document.kind} label={legalTitle(document.kind)} detail="Otvara se u pregledaču"
      onPress={() => onOpen(document)} disabled={disabled} last={index === 1} />)}</SettingsGroup>
    // Not green: "not published" and "not available" are not good news, so they sit on the quiet wash.
    : <InlineNote tone="neutral" art="document" artMuted>{bundle ? LEGAL_NOT_PUBLISHED : LEGAL_UNAVAILABLE}</InlineNote>;
}

/**
 * The state of a screen that has nothing to read BECAUSE IT COULD NOT READ (composition spec T7): a column on the screen's own centre
 * line, a picture of 96, one title, one sentence and the one green retry, about a third of the way down. A screen whose documents are simply
 * not published is NOT this: that is one calm line at the top (owner's phone, 8 Oct 2026: a whole screen and a "Proveri ponovo" for one sentence).
 */
function CenteredState({ art, title, body, primary }: {
  art: FactArtKind; title: string; body?: string;
  primary?: { label: string; onPress: () => void; disabled?: boolean };
}) {
  return <View style={s.centered} accessibilityLiveRegion="polite">
    <FactArt kind={art} size={96} />
    <T variant="title" accessibilityRole="header" style={s.centerText}>{title}</T>
    {body ? <T variant="copy" tone="muted" style={[s.centerText, s.centerBody]}>{body}</T> : null}
    {primary ? <V2Action label={primary.label} onPress={primary.onPress} disabled={primary.disabled} style={[brandAction, s.centerAction]} /> : null}
  </View>;
}

/** An error line where the thing that failed is: under the documents for a link, above the button for a command. */
function ErrorLine({ children }: { children: string }) {
  return <T variant="note" tone="danger" accessibilityRole="alert" accessibilityLiveRegion="polite">{children}</T>;
}

/** One published fact of a provider: the name above, the published text under it, in reading size. */
function Fact({ label, value }: { label: string; value: string }) {
  return <View style={s.fact}><T variant="note" tone="muted">{label}</T><T selectable>{value}</T></View>;
}

function ProviderDisclosure({ provider, onOpenUrl, divider = true }: { provider: ProcessorMapProvider; onOpenUrl: (url: string) => void; divider?: boolean }) {
  const facts = ([
    ['Svrha obrade', provider.purpose], ['Podaci koji se obrađuju', provider.dataCategories.join(', ')],
    ['Regioni obrade', provider.processingRegions], ['Prenos podataka', provider.crossBorderTransfer ? provider.transferMechanism : 'Bez međunarodnog prenosa prema objavljenoj mapi.'],
    ['Čuvanje i brisanje', provider.retentionDeletionTerms], ['Podobrađivači', provider.subprocessorTerms],
    ['Osnov obrade', provider.legalBasisReference], ['Ugovor o obradi', provider.dpaReference],
  ] as const).filter(([, value]) => !!value);
  return <Disclosure divider={divider} label={provider.providerDisplayName} hint={`${provider.legalEntityName} · ${processorRoles[provider.legalRole]}`}>
    {facts.map(([label, value]) => <Fact key={label} label={label} value={value} />)}
    <SettingsAction label={`Obaveštenje o privatnosti · ${provider.providerDisplayName}`} kind="quiet" onPress={() => onOpenUrl(provider.privacyNoticeUrl)} />
  </Disclosure>;
}

/**
 * Pravila i saglasnosti (round 5, owner step 11b): whether the current documents are accepted, the two documents, and
 * who processes the data, each provider folded to its name until opened. The one command (the explicit acceptance) is
 * the footer's, with its error right above it. Documents that are not published are ONE line, "Uslovi korišćenja i Politika
 * privatnosti još nisu objavljeni.", with no button: the screen is read again by pulling it (owner's phone, 8 Oct 2026: the whole screen
 * held that one sentence and "Proveri ponovo"; a standing "Osveži" at the title of the documents is gone for the same reason).
 * Presentation only: the route owns the controller, the fences and the link opening; every legal word is the owner's, verbatim.
 */
export function LegalReviewView({ state, onBack, action, actionReason = null, linkError, onOpen, onOpenUrl, onRefresh }: {
  state: LegalReviewState; onBack: () => void;
  /** The footer command for this state, or null (documents not published, or already accepted). */ action: ReactNode;
  /** Why that command cannot be pressed yet: a quiet line above it, in the system foot (never under the button). */ actionReason?: string | null;
  linkError: string | null; onOpen: (document: LegalDocument) => void; onOpenUrl: (url: string) => void; onRefresh: () => void;
}) {
  const documents = reviewedDocuments(state.bundle);
  const receiptCurrent = state.receipt && documents && documents[0].sha256 === state.receipt.termsSha256 && documents[1].sha256 === state.receipt.privacySha256;
  const confirmed = state.bundle?.acceptedCurrentBundle || !!receiptCurrent;
  const processors = state.processors?.ready ? state.processors : null;
  // The first read has nothing to show yet; a re-read keeps what was read on screen, with the refresh at the end at work.
  const firstRead = state.loading && !state.bundle && !state.processors;
  const processorGroup = processors ? <SettingsGroup title="Obrađivači podataka">
    {processors.providers.map((provider, index) => <ProviderDisclosure key={provider.providerCode} provider={provider} onOpenUrl={onOpenUrl} divider={index > 0} />)}
  </SettingsGroup> : null;
  return <SettingsScreen title="Pravila i saglasnosti" onBack={onBack} footerReason={actionReason}
    refresh={{ onRefresh: () => { if (!state.busy && !state.loading) onRefresh(); }, busy: state.loading }}
    footer={action ? <>{state.error ? <ErrorLine>{state.error}</ErrorLine> : null}{action}</> : null}>
    {firstRead ? <QuietReadState title="Učitavamo pravne dokumente" body="Proveravamo objavljene verzije pre prikaza." art="document" /> : <>
      {!action && state.error && documents ? <InlineNote tone="danger">{state.error}</InlineNote> : null}
      {/* A record, not a celebration: the state of the acceptance stands above what it is about. */}
      {confirmed ? <InlineNote tone="neutral" art="check" alert>Prihvaćene su trenutne verzije dokumenata.</InlineNote>
        : state.receipt ? <InlineNote tone="neutral" art="info">Prethodno prihvatanje je potvrđeno. Učitaj trenutne dokumente ponovo.</InlineNote> : null}
      {documents ? <>
        <View style={s.documents}>
          <LegalDocumentRows bundle={state.bundle} disabled={state.busy} onOpen={onOpen} />
          {linkError ? <ErrorLine>{linkError}</ErrorLine> : null}
        </View>
        {processorGroup ?? <InlineNote tone="quiet" art={null}>{state.processorError ?? 'Podaci o obrađivačima još nisu objavljeni.'}</InlineNote>}
      </> : <>
        {/* Nothing to read: ONE honest sentence (the pull of the screen looks again), or, when the read FAILED, the sentence and its retry. No
            row for a document that does not exist, no empty group for who processes the data, and no accept action (the route draws none
            without documents). */}
        {state.bundle
          ? <InlineNote tone="neutral" art="document" artMuted>{LEGAL_NOT_PUBLISHED}</InlineNote>
          : <CenteredState art="document" title="Dokumenti nisu dostupni" body={state.error ?? LEGAL_UNAVAILABLE}
            primary={{ label: 'Pokušaj ponovo', onPress: onRefresh, disabled: state.busy || state.loading }} />}
        {processorGroup}
      </>}
    </>}
  </SettingsScreen>;
}

/**
 * Public read-only sheet (the sign-up screen, once the documents are published). Closing it leaves every Auth field and
 * checkbox in place. It reads anonymously and never records consent: there is no accept action in it.
 */
export function PublicLegalModal({ kind, onClose }: { kind: LegalDocumentKind | null; onClose: () => void }) {
  return kind ? <ProductSheet title={legalTitle(kind)} closeLabel="Zatvori" onClose={onClose}>
    {() => <PublicLegalContents />}
  </ProductSheet> : null;
}
export const PublicLegalSheet = PublicLegalModal;

function PublicLegalContents() {
  const [bundle, setBundle] = useState<LegalBundleStatus | null>(null), [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null); const scope = useRef<object | null>(null);
  const owner = useRef(sesijaSada()); const opening = useRef(false);
  const current = (token: object | null) => !!token && scope.current === token &&
    sesijaSada().user?.id === owner.current.user?.id && sesijaSada().accountRevision === owner.current.accountRevision;
  const read = useCallback(async () => {
    const token = {}; scope.current = token; setLoading(true); setError(null); setBundle(null);
    try { const result = await boundedLegalRead(() => legalClientService.readBundle());
      if (!current(token)) return;
      if (result.ok) setBundle(result.podatak); else setError(result.poruka);
    } catch { if (current(token)) setError('Dokumenti trenutno nisu dostupni. Pokušaj ponovo.'); }
    finally { if (current(token)) setLoading(false); }
  }, []);
  useEffect(() => { void read(); return () => { scope.current = null; }; }, [read]);
  const open = async (document: LegalDocument) => {
    const token = scope.current, url = legalHttpsUrl(document.url);
    if (!current(token) || !url || opening.current) return;
    opening.current = true; setError(null);
    try { await Linking.openURL(url); }
    catch { if (current(token)) setError('Dokument nije otvoren. Pokušaj ponovo.'); }
    finally { opening.current = false; }
  };
  return <PublicLegalBody loading={loading} bundle={bundle} error={error} onOpen={doc => { void open(doc); }} onRefresh={() => { void read(); }} />;
}

/** The sheet's content, drawn from what it has read (the gallery draws it from fixtures). */
export function PublicLegalBody({ loading, bundle, error, onOpen, onRefresh }: {
  loading: boolean; bundle: LegalBundleStatus | null; error: string | null; onOpen: (document: LegalDocument) => void; onRefresh: () => void;
}) {
  return <View style={s.sheet}>
    {/* The invitation to read is only said when there is something to read. */}
    {!loading && reviewedDocuments(bundle) ? <T variant="copy" tone="muted">Otvori objavljene dokumente. Kad ih pročitaš, nastavi sa popunjavanjem.</T> : null}
    {loading ? <QuietReadState title="Učitavamo pravne dokumente" body="Proveravamo objavljene verzije pre prikaza." art="document" />
      : <LegalDocumentRows bundle={bundle} onOpen={onOpen} />}
    {error ? <ErrorLine>{error}</ErrorLine> : null}
    {!loading ? <SettingsAction label="Osveži dokumente" kind="quiet" onPress={onRefresh} /> : null}
  </View>;
}

const s = StyleSheet.create({
  fact: { gap: sys.space.xs },
  documents: { gap: sys.space.sm },
  sheet: { gap: sys.space.base },
  // Composition spec T7: a column on the centre line, about a third of the way down.
  centered: { alignItems: 'center', gap: sys.space.base, paddingTop: sys.space.huge, paddingBottom: sys.space.xxl },
  centerText: { textAlign: 'center' },
  centerBody: { maxWidth: 280 },
  centerAction: { alignSelf: 'stretch' },
});
