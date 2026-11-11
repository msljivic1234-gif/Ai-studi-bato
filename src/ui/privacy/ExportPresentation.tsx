import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import type { DataExportPreparation, DataExportStatus } from '../../contracts/dataExport';
import { vreme } from '../../lib/vreme';
import { SettingsGroup, SettingsScreen, SettingsText as T } from '../settings/SettingsPresentation';
import { Glyph } from '../system/Glyph';
import { ListRow } from '../system/ListRow';
import { StateView } from '../system/StateView';
import { STATUS_TONES, StatusMark, type StatusShape, type StatusTone } from '../system/StatusChip';
import { sys } from '../system/tokens';
import { QuietReadState } from '../v2/QuietReadState';
import { InlineNote, QuietLine } from './InlineNote';

export const exportPreparationCopy: Record<NonNullable<DataExportPreparation['code']>, string> = {
  POLICY_NOT_READY: 'Priprema kopije trenutno nije dostupna. Vaš zahtev ostaje zabeležen.',
  BUSY: 'Kopija se priprema. Proverite stanje kasnije.',
  RETRY_REQUIRED: 'Priprema nije završena. Proverite stanje pa pokušajte ponovo.',
  NOT_AVAILABLE: 'Ova kopija se ne može sačuvati.',
};

/** A file size as a person reads it, never in bytes (forensic analysis: no technical text): "12 KB", "1,4 MB". */
export const exportSizeLabel = (count: number) => count < 1024 ? 'manje od 1 KB' : count < 1024 * 1024 ? `${Math.round(count / 1024)} KB`
  : `${(count / (1024 * 1024)).toLocaleString('sr-Latn-RS', { maximumFractionDigits: 1 })} MB`;

/**
 * Where the person's copy is, as one of eight phases. Every request status maps to exactly one, so the steps can never
 * say "not requested" beside a request that exists, draw a cancelled request as the active step, or draw a failure as a
 * step still to come (round 5: the old step copy did all three).
 *
 * READY splits by what the server verified: a copy that can be saved now, one that was never verified (an old READY
 * receipt), and one whose availability has run out (`artifact && expires <= now`, even before the status says so).
 */
export type ExportPhase = 'NONE' | 'REQUESTED' | 'PROCESSING' | 'READY_AVAILABLE' | 'READY_UNAVAILABLE' | 'EXPIRED' | 'FAILED' | 'CANCELLED';
export function exportPhase(status: DataExportStatus | null | undefined, now: number): ExportPhase {
  const request = status?.request;
  if (!status || !request) return 'NONE';
  const artifact = status.fulfillment;
  const expires = artifact ? Date.parse(artifact.artifactExpiresAt) : NaN;
  switch (request.status) {
    case 'REQUESTED': return 'REQUESTED';
    case 'PROCESSING': return 'PROCESSING';
    case 'CANCELLED': return 'CANCELLED';
    case 'FAILED': return 'FAILED';
    case 'EXPIRED': return 'EXPIRED';
    case 'READY':
      if (artifact && expires <= now) return 'EXPIRED';
      return status.downloadAvailable === true && artifact?.artifactAvailable === true && Number.isFinite(expires) && expires > now
        ? 'READY_AVAILABLE' : 'READY_UNAVAILABLE';
    default: return 'NONE';
  }
}

/**
 * The phase as the app's one kind of chip (plan 2.2: a mark and a word, never colour alone). The shared `StatusChip` has no key
 * for a data export (its table is for tasks and applications), so this draws the same chip from the same mark and tones, with
 * the export's own words. "Spremno" is said only for a copy that can be saved right now: a copy that was never verified, one
 * whose availability has run out and one that failed are each said as what they are, never as something waiting to be saved.
 */
export const EXPORT_CHIPS: Readonly<Record<ExportPhase, { word: string; shape: StatusShape; tone: StatusTone }>> = {
  NONE: { word: 'Nije traženo', shape: 'ring', tone: 'neutral' },
  REQUESTED: { word: 'Zahtev poslat', shape: 'ring', tone: 'neutral' },
  PROCESSING: { word: 'U pripremi', shape: 'dot', tone: 'green' },
  READY_AVAILABLE: { word: 'Spremno', shape: 'check', tone: 'green' },
  READY_UNAVAILABLE: { word: 'Nije dostupno', shape: 'dash', tone: 'grey' },
  EXPIRED: { word: 'Isteklo', shape: 'dash', tone: 'grey' },
  FAILED: { word: 'Nije uspelo', shape: 'dash', tone: 'grey' },
  CANCELLED: { word: 'Otkazano', shape: 'dash', tone: 'grey' },
};
export function ExportStatusChip({ phase }: { phase: ExportPhase }) {
  const { word, shape, tone } = EXPORT_CHIPS[phase], palette = STATUS_TONES[tone];
  return <View testID="status-chip" accessible accessibilityRole="text" accessibilityLabel={word} style={[s.chip, { backgroundColor: palette.ground }]}>
    <StatusMark shape={shape} tone={tone} />
    <T variant="label" style={[s.chipWord, { color: palette.word }]}>{word}</T>
  </View>;
}

type StepState = 'done' | 'current' | 'pending' | 'stopped';
type Step = { label: string; state: StepState; copy: string; meta?: string[] };
// "na redu", not "u toku": the current step is also a preparation not started yet ("Priprema još nije pokrenuta.") and a
// copy waiting to be saved, where "u toku" would state something that is not happening (round 5 review).
const spoken: Record<StepState, string> = { done: 'završeno', current: 'na redu', pending: 'sledi', stopped: 'zaustavljeno' };

/** The three steps of a phase, in the owner's words. */
export function exportSteps(phase: ExportPhase, status: DataExportStatus | null | undefined): Step[] {
  const request = status?.request, artifact = status?.fulfillment;
  const requested: Step = { label: 'Zahtev', state: 'done', copy: 'Zahtev je zabeležen na tvom nalogu.',
    meta: request ? [vreme(request.requestedAt)].filter(Boolean) : undefined };
  const waiting: Step = { label: 'Preuzimanje', state: 'pending', copy: 'Dostupno kada kopija bude spremna.' };
  const prepared: Step = { label: 'Priprema kopije', state: 'done', copy: 'Obrada je završena.' };
  switch (phase) {
    case 'REQUESTED': return [requested, { label: 'Priprema kopije', state: 'current', copy: 'Priprema još nije pokrenuta.' }, waiting];
    case 'PROCESSING': return [requested, { label: 'Priprema kopije', state: 'current', copy: 'Kopija se priprema.' }, waiting];
    case 'READY_AVAILABLE': return [requested, prepared, { label: 'Preuzimanje', state: 'current', copy: 'Kopija je dostupna. Izaberi fasciklu za čuvanje.',
      meta: artifact ? [`Dostupno do ${vreme(Date.parse(artifact.artifactExpiresAt))}.`, `Datoteka JSON · ${exportSizeLabel(artifact.byteLength)}`] : undefined }];
    // Not a step still to come: this copy cannot be saved and the footer offers a new one (round 5 review).
    case 'READY_UNAVAILABLE': return [requested, prepared, { label: 'Preuzimanje', state: 'stopped', copy: exportPreparationCopy.NOT_AVAILABLE }];
    case 'EXPIRED': return [requested, prepared, { label: 'Preuzimanje', state: 'stopped', copy: 'Dostupnost kopije je istekla.' }];
    case 'FAILED': return [requested, { label: 'Priprema kopije', state: 'stopped', copy: 'Priprema nije završena.' }, waiting];
    case 'CANCELLED': return [{ ...requested, state: 'stopped', copy: 'Zahtev je otkazan.' },
      { label: 'Priprema kopije', state: 'pending', copy: 'Priprema počinje nakon tvog zahteva.' }, waiting];
    default: return [{ label: 'Zahtev', state: 'pending', copy: 'Kopija podataka tvog naloga.' },
      { label: 'Priprema kopije', state: 'pending', copy: 'Priprema počinje nakon tvog zahteva.' }, waiting];
  }
}

/**
 * The steps of the copy as one vertical track: a 24 px marker column joined by a 2 px line, then the step's name and one
 * line of what it means now. Done is a green disc with a check, the current step a green ring with a dot, a step to come
 * a grey ring, a stopped step a grey disc with an X; the state is also spoken, never colour alone. Nothing here moves:
 * every line states a fact.
 */
export function ExportStepper({ steps }: { steps: Step[] }) {
  return <View>
    {steps.map((step, index) => {
      const last = index === steps.length - 1;
      return <View key={step.label} style={s.step} accessible
        accessibilityLabel={[`${step.label}, ${spoken[step.state]}.`, step.copy, ...(step.meta ?? [])].join(' ')}>
        <View style={s.rail}>
          <Marker state={step.state} />
          {last ? null : <View style={[s.connector, step.state === 'done' && s.connectorDone]} />}
        </View>
        <View style={[s.stepCopy, !last && s.stepGap]}>
          <T variant="bodyStrong" tone={step.state === 'pending' ? 'muted' : 'ink'}>{step.label}</T>
          <T variant="note" tone="muted">{step.copy}</T>
          {step.meta?.map(line => <T key={line} variant="note">{line}</T>)}
        </View>
      </View>;
    })}
  </View>;
}

function Marker({ state }: { state: StepState }) {
  if (state === 'done') return <View style={[s.marker, s.markerDone]}><Glyph name="check" size={16} tone="onGreen" /></View>;
  if (state === 'stopped') return <View style={[s.marker, s.markerStopped]}><Glyph name="close" size={16} tone="muted" /></View>;
  if (state === 'current') return <View style={[s.marker, s.markerCurrent]}><View style={s.dot} /></View>;
  return <View style={[s.marker, s.markerPending]} />;
}

/** A notice's colour says what happened; its words are the screen's own. */
export type NoticeTone = 'success' | 'danger' | 'ink';
export function ExportNoticeLine({ text, tone }: { text: string; tone: NoticeTone }) {
  return <T variant="note" tone={tone === 'success' ? 'success' : tone === 'danger' ? 'danger' : 'ink'} accessibilityLiveRegion="polite"
    accessibilityRole={tone === 'danger' ? 'alert' : undefined}>{text}</T>;
}

/**
 * Izvoz podataka (round 5, owner step 11b; UI/UX pass 2026-10-08, F6, composition spec 4.15): the copy's state as the content of one
 * section, with no card around it: its status chip and the steps of the copy as one track; the one action for this state pinned in the foot
 * with the outcome line right above it; and the rare withdrawals in the scroll as red rows (a command, not a way onward).
 *
 * Until a copy has been asked for there is nothing to track, so there is no chip "Nije traženo" and no three grey steps that said what had not
 * happened (owner's phone, 8 Oct 2026): the screen is ONE sentence and the green action, and the steps appear once the request is sent. The
 * state is read again by pulling the screen, not by a standing "Osveži" (the retry of a failed read keeps its button). Presentation only: the
 * route owns every read, command, fence and label of the foot's action.
 */
export function ExportScreenView({ onBack, loading, failure, status, preparation, now, busy, notice, primary,
  onCancel, onRevoke, onRefresh, refreshDisabled }: {
  onBack: () => void; loading: boolean;
  /** The screen could not read, or must read before anything else: the one way forward is a refresh. */
  failure: { title: string; body: string } | null;
  status: DataExportStatus | null; preparation: DataExportPreparation | null;
  now: number; busy: boolean; notice: { text: string; tone: NoticeTone } | null; primary: ReactNode;
  onCancel: () => void; onRevoke: () => void; onRefresh: () => void; refreshDisabled: boolean;
}) {
  const request = status?.request;
  const noticeLine = notice ? <ExportNoticeLine text={notice.text} tone={notice.tone} /> : null;
  const phase = exportPhase(status, now);
  // A re-read keeps what was read on screen: it is the pull of the screen, and does nothing while another read is at work.
  return <SettingsScreen title="Izvoz podataka" onBack={onBack} footer={primary ? <>{noticeLine}{primary}</> : null}
    refresh={{ onRefresh: () => { if (!busy && !loading && !refreshDisabled) onRefresh(); }, busy: loading }}>
    {notice && !primary ? noticeLine : null}
    {/* The first read has no result yet. A re-read keeps the steps on screen while the pull shows it works. */}
    {loading && !status ? <QuietReadState title="Učitavamo stanje izvoza" body="Proveravamo zahtev i dostupnost kopije pre prikaza." art="download" />
      // The sentences of a failure end in "Osveži stanje.", so the one retry says the same words.
      : failure ? <StateView kind="error" art="download" title={failure.title} body={failure.body}
        primary={{ label: 'Osveži stanje', onPress: onRefresh, disabled: refreshDisabled }} />
      : phase === 'NONE' ? <StateView kind="empty" art="download" title="Zatražite kopiju podataka svog naloga i preuzmite je kad bude spremna." />
      : <>
        <SettingsGroup title="Vaša kopija">
          <View style={s.track}>
            <ExportStatusChip phase={phase} />
            <ExportStepper steps={exportSteps(phase, status)} />
          </View>
        </SettingsGroup>
        {preparation?.kind === 'NOT_READY' ? <InlineNote tone="warn" alert>{exportPreparationCopy[preparation.code ?? 'NOT_AVAILABLE']}</InlineNote> : null}
        {/* About keeping a copy: said only when there is a copy to keep. */}
        {phase === 'READY_AVAILABLE' ? <QuietLine art="shield">Izvoz je vezan za Vaš nalog. Čuvajte kopiju na mestu kome samo Vi imate pristup.</QuietLine> : null}
        {request?.status === 'REQUESTED' || (request?.status === 'READY' && status?.fulfillment && phase !== 'EXPIRED') ? <View>
          {request?.status === 'REQUESTED' ? <ListRow title="Otkaži zahtev" tone="danger" disabled={busy} onPress={onCancel} last /> : null}
          {/* A copy whose availability has run out is not there to withdraw: no command is offered over a file that does not exist. */}
          {request?.status === 'READY' && status?.fulfillment && phase !== 'EXPIRED' ? <ListRow title="Opozovi kopiju" tone="danger" disabled={busy} onPress={onRevoke} last /> : null}
        </View> : null}
      </>}
  </SettingsScreen>;
}

const s = StyleSheet.create({
  track: { gap: sys.space.base },
  // The shared chip's measure (StatusChip): the mark, then the word, on the tone's soft ground; never a touch target.
  chip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: sys.space.xs, paddingVertical: sys.space.xs,
    paddingLeft: sys.space.sm, paddingRight: sys.space.md, borderRadius: sys.radius.pill },
  chipWord: { letterSpacing: 0 },
  step: { flexDirection: 'row', gap: sys.space.md },
  rail: { width: 24, alignItems: 'center' },
  connector: { width: 2, flex: 1, minHeight: 16, marginVertical: sys.space.xs, backgroundColor: sys.color.line, borderRadius: sys.radius.pill },
  connectorDone: { backgroundColor: sys.color.green },
  stepCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  stepGap: { paddingBottom: sys.space.base },
  marker: { width: 24, height: 24, borderRadius: sys.radius.pill, alignItems: 'center', justifyContent: 'center' },
  markerDone: { backgroundColor: sys.color.green },
  markerCurrent: { backgroundColor: sys.color.surface, borderWidth: 2, borderColor: sys.color.green },
  markerPending: { backgroundColor: sys.color.surface, borderWidth: 2, borderColor: sys.color.lineStrong },
  markerStopped: { backgroundColor: sys.color.iconWell },
  dot: { width: 8, height: 8, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
});
