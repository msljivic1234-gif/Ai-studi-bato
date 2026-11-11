import { useRef, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowClockwise } from 'phosphor-react-native';
import type { AgreementChangeSnapshot, AgreementChangeTerms } from '../../data/agreementClientService';
import { needScheduleText } from '../../data/needDetailPresentation';
import { DOGOVORENA_ZONA } from '../../lib/dogovorenoVreme';
import { applicationPriceBasisText, BEZ_IZNOSA, novac } from '../../lib/novac';
import { CivilField } from '../calendar/CalendarControls';
import { civilClock, civilDay, zonedParts } from '../calendar/calendarPresentation';
import { Press } from '../Press';
import { T } from '../Text';
import { withInter } from '../interFont';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { FlowFooter } from '../system/FlowFooter';
import { ChromeIconButton, ScreenChrome } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { SuccessMark } from '../system/SuccessMark';
import { brandAction, CHIP_CHOSEN_INSET, chipChosen, field, fieldBox, inset, sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { QuietReadState } from '../v2/QuietReadState';
import type { AgreementActionsState } from './AgreementActionsController';
import type { AgreementActionCommand } from './agreementActionsModel';

/** The form of a proposal or a cancellation, as the screen holds it. */
export type AgreementActionForm = { token: object; kind: 'PROPOSE' | 'CANCEL'; reentry: boolean; key: string;
  price: string; scope: string; reason: string; zone: string; startDate: string; startTime: string; endDate: string; endTime: string;
  priceChanged: boolean; scopeChanged: boolean; startChanged: boolean; endChanged: boolean };

/** The same zone the form types in, so the review and the fields cannot disagree: Serbian time for both parties
 * (owner decision 2026-09-21, deep read 8.27). */
const schedule = (terms: AgreementChangeTerms) => terms.startsAt === null && terms.endsAt === null ? 'Termin nije dogovoren'
  : needScheduleText({ kind: 'FIXED_WINDOW', startsAt: terms.startsAt, endsAt: terms.endsAt }, DOGOVORENA_ZONA);
const scopeText = (terms: AgreementChangeTerms) => terms.scopeNote || 'Nije dodat opis';
/**
 * A price as the terms say it: an amount above zero is written as one, anything else - a price that was never saved - is
 * "Iznos nije sačuvan", in words. A missing price never looks like an amount, and never reads "0 RSD".
 */
const priceText = (rsd: number, basis?: 'TOTAL' | 'HOURLY') => Number.isFinite(rsd) && rsd > 0
  ? `${novac(rsd)} ${applicationPriceBasisText(basis)}` : BEZ_IZNOSA;

/**
 * One fact of the terms. With `before`, the line under the value is the one mark of a change ("umesto 3.500 RSD") or
 * of none ("bez promene"); weight does not mark it, since the money value is bold whether it changed or not (round 6,
 * scene 09: the three facts carried three different emphases for one kind of difference). A price in words wears no
 * amount style.
 */
function Fact({ art, label, value, before }: { art: FactArtKind; label: string; value: string; before?: string | null }) {
  const compared = before !== undefined && before !== null, changed = compared && before !== value;
  const spoken = changed ? `${label}: ${value}, umesto ${before}` : compared ? `${label}: ${value}, bez promene` : `${label}: ${value}`;
  const amount = art === 'money' && value !== BEZ_IZNOSA;
  return <View style={s.fact} accessible accessibilityLabel={spoken}>
    <FactArt kind={art} size={24} cut="art" />
    <View style={s.factCopy}>
      <T variant="meta" tone="muted">{label}</T>
      <T variant={amount ? 'bodyStrong' : 'body'} style={amount ? s.money : undefined}>{value}</T>
      {changed ? <T variant="meta" tone="muted">umesto {before}</T> : compared ? <T variant="meta" tone="muted">bez promene</T> : null}
    </View>
  </View>;
}

/** Terms as three facts; with `base`, each is marked with what it replaces, or with "bez promene". */
function Terms({ terms, base }: { terms: AgreementChangeTerms | null; base?: AgreementChangeTerms | null }) {
  if (!terms) return <T variant="copy" tone="muted">Uslovi nisu dostupni za pregled.</T>;
  return <View style={s.facts}>
    <Fact art="money" label="Cena" value={priceText(terms.priceRsd, terms.priceBasis)} before={base ? priceText(base.priceRsd, base.priceBasis) : undefined} />
    <Fact art="calendar" label="Termin" value={schedule(terms)} before={base ? schedule(base) : undefined} />
    <Fact art="document" label="Obim" value={scopeText(terms)} before={base ? scopeText(base) : undefined} />
  </View>;
}

/** A reason is quoted the same way wherever it stands: on the hub under the proposal and on the review (scene 09). */
const Reason = ({ text }: { text: string }) => <View style={s.quote}><T variant="meta" tone="muted">Razlog</T><T variant="copy">{text}</T></View>;

const reviewTitle = (command: AgreementActionCommand) => command.kind === 'PROPOSE' ? 'Pregled predloga' : command.kind === 'CANCEL' ? 'Otkazivanje Dogovora'
  : command.kind === 'WITHDRAW' ? 'Povlačenje predloga' : command.accept ? 'Prihvatanje izmene' : 'Odbijanje predloga';
const actionLabel = (command: AgreementActionCommand) => command.kind === 'PROPOSE' ? 'Pošalji predlog izmene'
  : command.kind === 'CANCEL' ? 'Otkaži Dogovor' : command.kind === 'WITHDRAW' ? 'Povuci predlog' : command.accept ? 'Prihvati izmenu' : 'Odbij predlog';
/** Ending, withdrawing or refusing is drawn in the danger colour; proposing and accepting use the ink primary. */
const ending = (command: AgreementActionCommand) => command.kind === 'CANCEL' || command.kind === 'WITHDRAW' || (command.kind === 'RESPOND' && !command.accept);

/**
 * The words of a command in the states after it was sent, by the journal's kind: the state of not knowing, the two
 * outcomes, and the label of sending the same command again. The controller's own sentence ("Predlog izmene je
 * sačuvan.", "Ishod nije potvrđen…") is the record of what was read back; it is drawn under these as it is.
 */
const WORDS: Record<string, { unconfirmed: string; confirmed: string; rejected: string; again: string }> = {
  PROPOSE: { unconfirmed: 'Predlog izmene još nije potvrđen', confirmed: 'Predlog je poslat', rejected: 'Predlog nije poslat', again: 'Ponovo pošaljite predlog' },
  CANCEL: { unconfirmed: 'Otkazivanje još nije potvrđeno', confirmed: 'Otkazivanje je potvrđeno', rejected: 'Dogovor nije otkazan', again: 'Ponovo otkažite Dogovor' },
  WITHDRAW: { unconfirmed: 'Povlačenje predloga još nije potvrđeno', confirmed: 'Povlačenje je potvrđeno', rejected: 'Predlog nije povučen', again: 'Ponovo povucite predlog' },
  RESPOND: { unconfirmed: 'Odgovor na predlog još nije potvrđen', confirmed: 'Odgovor je poslat', rejected: 'Odgovor nije poslat', again: 'Ponovo pošaljite odgovor' },
};
const wordsFor = (kind: string | null) => (kind && WORDS[kind]) || { unconfirmed: 'Ne znamo da li je uspelo', confirmed: 'Potvrđeno', rejected: 'Nije uspelo', again: 'Pošaljite ponovo' };

export type AgreementActionsPresentationProps = {
  phase: AgreementActionsState['phase']; snapshot: AgreementChangeSnapshot | null; accountId: string;
  /** The form's own error, or the controller's. */ error: string | null; message: string | null;
  canRetry: boolean; needsReentry: boolean; journalKind: string | null;
  form: AgreementActionForm | null; review: AgreementActionCommand | null; proposed: AgreementChangeTerms | null;
  onBack: () => void; onRefresh: () => void; onOpenForm: (kind: 'PROPOSE' | 'CANCEL', reentry?: boolean) => void;
  onEdit: (patch: Partial<AgreementActionForm>) => void; onPrepareForm: () => void; onCloseForm: () => void;
  onPrepare: (command: AgreementActionCommand) => void; onSend: () => void; onCloseReview: () => void;
  onRetry: () => void; onAcknowledge: () => void;
};

/**
 * Changes and cancellation of a Dogovor as a serious flow (round 6): a hub with the terms in force and what waits, then
 * each command in two steps under the flow bar, the form and the review, with one decision per step pinned in the
 * flow's foot and the X as the way out. Presentation only: the screen owns the controller, its journal, the review
 * fences and every guard.
 */
export function AgreementActionsPresentation(p: AgreementActionsPresentationProps) {
  const busy = p.phase === 'LOADING' || p.phase === 'SENDING', sending = p.phase === 'SENDING', snapshot = p.snapshot;
  const { form, review } = p;
  let chrome, body, footer;
  if (form) {
    chrome = <ScreenChrome variant="flow" onClose={p.onCloseForm} closeLabel="Odustani od unosa" disabled={busy}
      title={form.reentry ? 'Ponovno slanje' : form.kind === 'CANCEL' ? 'Otkazivanje Dogovora' : 'Predlog izmene'} step="Korak 1 od 2" />;
    body = <Form form={form} base={snapshot?.terms ?? null} busy={busy} onEdit={p.onEdit} />;
    // The step's one decision, pinned under the scroll; what stopped it is said right under the button it stopped. A cancellation
    // needs its reason: until one is chosen the decision is grey, with the reason why (plan 2.3), not a press that answers with an error.
    const reasonMissing = form.kind === 'CANCEL' && !form.reason.trim();
    footer = <V2Action tone="neutral" label={form.kind === 'CANCEL' ? 'Pregledaj otkazivanje' : 'Pregledaj predlog'} style={brandAction}
      disabled={busy || reasonMissing} reason={reasonMissing && !busy ? (form.reentry ? 'Unesite razlog.' : 'Izaberite razlog.') : null}
      error={p.error} onPress={p.onPrepareForm} />;
  } else if (review) {
    chrome = <ScreenChrome variant="flow" onClose={p.onCloseReview} closeLabel="Odustani od radnje" disabled={busy}
      title={reviewTitle(review)} step={review.kind === 'PROPOSE' || review.kind === 'CANCEL' ? 'Korak 2 od 2' : undefined} />;
    body = <Review review={review} proposed={p.proposed} base={snapshot?.terms ?? null} snapshot={snapshot} />;
    footer = <V2Action tone="neutral" label={actionLabel(review)} kind={ending(review) ? 'destructive' : 'secondary'}
      style={ending(review) ? [s.danger, busy && !sending && s.dangerResting] : brandAction}
      loading={sending} disabled={busy && !sending} error={p.error} onPress={p.onSend} />;
  } else {
    // The refresh stays in the bar while the terms are being read, muted, never gone (scene 15): the bar does not change
    // shape between reading and read.
    chrome = <ScreenChrome variant="detail" onBack={p.onBack} title="Izmene i otkazivanje"
      right={p.phase === 'READY' || p.phase === 'ERROR' || p.phase === 'LOADING'
        ? <ChromeIconButton label="Osvežite uslove Dogovora" icon={ArrowClockwise} disabled={busy} onPress={p.onRefresh} /> : undefined} />;
    if (p.phase === 'LOADING' && !snapshot) {
      body = <QuietReadState art="document" title="Učitavamo važeće uslove…" body="Proveravamo trenutno stanje Dogovora." />;
    } else if (p.phase === 'ERROR' && !snapshot) {
      body = <StateView kind="error" art="document" title="Dogovor nije učitan" body={p.error ?? undefined}
        primary={{ label: 'Ponovo učitajte Dogovor', onPress: p.onRefresh }} />;
    } else if (p.phase === 'UNKNOWN') {
      const words = wordsFor(p.journalKind), reentry = p.needsReentry && (p.journalKind === 'PROPOSE' || p.journalKind === 'CANCEL');
      body = <View style={s.stack}>
        <View style={s.notice} accessibilityLiveRegion="polite">
          <T variant="bodyStrong">{words.unconfirmed}</T>
          {p.error ? <T variant="copy">{p.error}</T> : null}
        </View>
        <V2Action tone="neutral" label="Proverite da li je uspelo" style={brandAction} onPress={p.onRefresh} />
        {reentry
          ? <V2Action tone="neutral" label={p.journalKind === 'CANCEL' ? 'Ponovo unesite otkazivanje' : 'Ponovo unesite predlog'} disabled={!p.canRetry}
            reason={p.canRetry ? null : 'Prvo proverite da li je prethodna radnja uspela.'} onPress={() => p.onOpenForm(p.journalKind as 'PROPOSE' | 'CANCEL', true)} />
          : <V2Action tone="neutral" label={words.again} disabled={!p.canRetry || p.needsReentry} reason={!p.canRetry || p.needsReentry ? 'Prvo proverite da li je prethodna radnja uspela.' : null}
            onPress={p.onRetry} />}
      </View>;
    } else if (p.phase === 'CONFIRMED' || p.phase === 'REJECTED') {
      const words = wordsFor(p.journalKind), confirmed = p.phase === 'CONFIRMED', record = p.message ?? p.error;
      body = <View style={s.done}>
        {/* Only a confirmed command earns the check; a command the Dogovor settled otherwise is told plainly, not celebrated. */}
        <View style={s.mark}>{confirmed ? <SuccessMark fresh /> : <View style={s.art}><FactArt kind="info" size={40} /></View>}</View>
        <View style={s.doneCopy} accessibilityLiveRegion="polite">
          <T variant="title" accessibilityRole="header">{confirmed ? words.confirmed : words.rejected}</T>
          {record ? <T variant="copy">{record}</T> : null}
          {confirmed && p.journalKind === 'PROPOSE' ? <T variant="copy" tone="muted">Uslovi se menjaju tek kada druga strana prihvati predlog.</T> : null}
        </View>
        <V2Action tone="neutral" label="Prikaži aktuelni Dogovor" style={brandAction} onPress={p.onAcknowledge} />
      </View>;
    } else if (snapshot) {
      body = <Hub snapshot={snapshot} accountId={p.accountId} error={p.error} busy={busy} onOpenForm={p.onOpenForm} onPrepare={p.onPrepare} />;
    }
  }

  return <SafeAreaView edges={['top', 'bottom']} style={s.screen}><KeyboardAvoidingView style={s.screen} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
    {chrome}
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>{body}</ScrollView>
    {footer ? <FlowFooter>{footer}</FlowFooter> : null}
  </KeyboardAvoidingView></SafeAreaView>;
}

function Hub({ snapshot, accountId, error, busy, onOpenForm, onPrepare }: { snapshot: AgreementChangeSnapshot; accountId: string; error: string | null; busy: boolean;
  onOpenForm: AgreementActionsPresentationProps['onOpenForm']; onPrepare: AgreementActionsPresentationProps['onPrepare'] }) {
  const actions = snapshot.actions;
  // One primary decision: the other side's proposal, when one waits for my answer; otherwise proposing a change.
  const answerWaits = actions.canRespondChange && snapshot.proposals.some(proposal => proposal.proposedBy !== accountId);
  return <View style={s.stack}>
    {error ? <T variant="copy" tone="danger" accessibilityRole="alert">{error}</T> : null}
    {busy ? <T variant="meta" tone="muted" accessibilityLiveRegion="polite">Proveravamo važeće uslove…</T> : null}
    {/* Pending proposals lead with the next decision. Each fact already states what it replaces; the full current
        record stays open below, so moving it does not hide terms or suggest the proposal is already accepted. */}
    {snapshot.proposals.map(proposal => {
      const mine = proposal.proposedBy === accountId;
      // Every command here opens its review step, so it says the deed ("Prihvati izmenu"), not "look at accepting".
      return <View key={proposal.proposalId} style={s.proposal}>
        <T variant="heading" accessibilityRole="header">{mine ? 'Vaš predlog čeka odgovor' : snapshot.counterpartName ? `${snapshot.counterpartName} predlaže` : 'Predlog druge strane'}</T>
        <Terms terms={proposal.terms} base={snapshot.terms} />
        {proposal.reason ? <Reason text={proposal.reason} /> : null}
        {actions.canRespondChange && !mine ? <>
          <V2Action tone="neutral" label="Prihvati izmenu" style={brandAction} disabled={busy || !proposal.termsAvailable}
            reason={proposal.termsAvailable ? null : 'Uslovi predloga nisu dostupni za pregled.'} onPress={() => onPrepare({ kind: 'RESPOND', proposal, accept: true })} />
          <V2Action tone="neutral" label="Odbij predlog" kind="quiet" disabled={busy} onPress={() => onPrepare({ kind: 'RESPOND', proposal, accept: false })} />
        </> : null}
        {actions.canWithdrawChange && mine ? <V2Action tone="neutral" label="Povuci predlog" kind="quiet" disabled={busy} onPress={() => onPrepare({ kind: 'WITHDRAW', proposal })} /> : null}
      </View>;
    })}
    <View style={s.section}><T variant="heading" accessibilityRole="header">Važeći uslovi</T><Terms terms={snapshot.terms} /></View>
    {actions.canProposeChange && snapshot.terms || actions.canCancel ? <View style={[s.section, s.parted]}>
      {actions.canProposeChange && snapshot.terms ? <V2Action tone="neutral" label="Predloži izmenu" style={answerWaits ? undefined : brandAction}
        disabled={busy} onPress={() => onOpenForm('PROPOSE')} /> : null}
      {actions.canCancel ? <V2Action tone="neutral" label="Otkaži Dogovor" kind="destructive" disabled={busy} onPress={() => onOpenForm('CANCEL')} /> : null}
    </View> : null}
  </View>;
}

/** What the terms in force say for a field of the form, in the field's own writing; null where they say nothing. */
function baseFields(base: AgreementChangeTerms | null, zone: string) {
  const start = base?.startsAt ? zonedParts(new Date(base.startsAt), zone) : null;
  const end = base?.endsAt ? zonedParts(new Date(base.endsAt), zone) : null;
  return { price: base ? String(base.priceRsd) : null, scope: base?.scopeNote?.trim() || null,
    startDate: start?.date ?? null, startTime: start ? civilClock(start.time) : null, endDate: end?.date ?? null, endTime: end ? civilClock(end.time) : null };
}

/**
 * The reasons a Dogovor is cancelled for, in the words a person would say them (plan 2.3). The server takes the words as the
 * reason; "Drugo" asks for the person's own. No gendered participle: the reasons speak of the term, the task or the agreement.
 */
export const CANCEL_REASONS = ['Promenio se termin', 'Zadatak više nije potreban', 'Rešeno je drugačije', 'Ne mogu da ispoštujem dogovor',
  'Druga strana se ne javlja'] as const;

/** One reason, a pill: a chosen one wears the system's chosen-chip edge and a green word. At least 44 high. */
function ReasonChip({ label, on, disabled, onPress }: { label: string; on: boolean; disabled: boolean; onPress: () => void }) {
  return <Press accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: on, disabled }} disabled={disabled}
    haptic="select" onPress={onPress} style={[s.reason, on && s.reasonOn]}>
    <T variant="meta" style={[s.reasonText, on && s.reasonTextOn]}>{label}</T>
  </Press>;
}

function Form({ form, base, busy, onEdit }: { form: AgreementActionForm; base: AgreementChangeTerms | null; busy: boolean;
  onEdit: AgreementActionsPresentationProps['onEdit'] }) {
  // A form token owns this local reveal. A new form starts from its own source; once text was shown,
  // deleting it must not remove the focused input. Adjust before committing children, without a reset effect.
  const hasScope = form.scope.trim().length > 0;
  const currentScope = useRef({ token: form.token, busy });
  currentScope.current = { token: form.token, busy };
  const [scopeEditor, setScopeEditor] = useState({ token: form.token, open: hasScope });
  if (scopeEditor.token !== form.token || (hasScope && !scopeEditor.open)) {
    setScopeEditor({ token: form.token, open: hasScope });
  }
  const showScope = hasScope || (scopeEditor.token === form.token && scopeEditor.open);
  // A cancellation's reason is chosen from chips, and "Drugo" opens the field for the person's own words. A re-entered request
  // (the journal asks for the very same text again) keeps the plain field: its words must match the first attempt exactly.
  const choosing = form.kind === 'CANCEL' && !form.reentry;
  const [freeText, setFreeText] = useState({ token: form.token, open: false });
  if (freeText.token !== form.token) setFreeText({ token: form.token, open: false });
  const chosen = CANCEL_REASONS.find(reason => reason === form.reason) ?? null;
  const writing = chosen === null && (freeText.open || form.reason.trim().length > 0);
  const was = baseFields(base, form.zone);
  // Under a field whose value left the terms in force: what it replaces, so step 1 already shows the change (scene 11).
  const instead = (shown: boolean, text: string) => shown ? <T variant="meta" tone="muted" numberOfLines={2}>umesto {text}</T> : null;
  const input = (label: string, value: string, change: (text: string) => void, multiline = false, note?: ReactNode) => <View style={s.field}>
    <T variant="meta">{label}</T><TextInput accessibilityLabel={label} value={value} onChangeText={change} editable={!busy}
      multiline={multiline} maxLength={multiline ? 4000 : 100} style={[s.input, multiline && s.multiline]} />{note}</View>;
  const civil = (label: string, mode: 'date' | 'time', value: string, change: (text: string) => void, before: string | null) => <View style={s.field}>
    <CivilField label={label} mode={mode} value={value} disabled={busy} onChange={change} />
    {instead(before !== null && (mode === 'date' ? value !== before : civilClock(value) !== before), mode === 'date' ? civilDay(before ?? '') : before ?? '')}
  </View>;
  return <View style={s.stack}>
    {form.reentry ? <T variant="copy" tone="muted">Prethodni unos nije sačuvan na telefonu. Unesite iste podatke i isti razlog kao prvi put da bismo proverili da li je već stiglo.</T> : null}
    {form.kind === 'PROPOSE' ? <>
      <View style={s.field}>
        <T variant="meta">{base?.priceBasis === 'HOURLY' ? 'Satnica po osobi' : 'Cena'}</T>
        {/* The amount never stands without its currency: the row is the one field box, RSD inside it beside the number. */}
        <View style={s.amount}>
          <TextInput accessibilityLabel={base?.priceBasis === 'HOURLY' ? 'Predložena satnica po osobi u RSD po satu' : 'Predložena cena u RSD'} value={form.price} onChangeText={price => onEdit({ price, priceChanged: true })}
            editable={!busy} keyboardType="number-pad" maxLength={100} style={s.amountInput} />
          <T variant="bodyStrong" style={s.unit} importantForAccessibility="no" accessibilityElementsHidden>RSD</T>
        </View>
        {base?.priceBasis === 'HOURLY' ? <T variant="note" tone="muted">RSD po osobi po satu. Promena iznosa ne menja ovu osnovicu.</T> : null}
        {instead(was.price !== null && form.price.trim() !== was.price, base ? priceText(base.priceRsd, base.priceBasis) : '')}
      </View>
      {showScope ? input('Predloženi obim zadatka', form.scope, scope => onEdit({ scope, scopeChanged: true }), true,
        instead(was.scope !== null && form.scope.trim() !== was.scope, was.scope ?? ''))
        : <V2Action label="Dodaj opis obima zadatka" kind="quiet" tone="neutral" disabled={busy}
          onPress={() => { if (currentScope.current.token === form.token && !currentScope.current.busy) setScopeEditor({ token: form.token, open: true }); }} style={s.scopeEntry} />}
      <T variant="meta" tone="muted">Vreme unosiš po vremenu u Srbiji.</T>
      {civil('Datum početka', 'date', form.startDate, startDate => onEdit({ startDate, startChanged: true }), was.startDate)}
      {civil('Vreme početka', 'time', form.startTime, startTime => onEdit({ startTime, startChanged: true }), was.startTime)}
      {civil('Datum kraja', 'date', form.endDate, endDate => onEdit({ endDate, endChanged: true }), was.endDate)}
      {civil('Vreme kraja', 'time', form.endTime, endTime => onEdit({ endTime, endChanged: true }), was.endTime)}
    </> : null}
    {choosing ? <View style={s.field}>
      <T variant="meta">Razlog otkazivanja Dogovora</T>
      <View accessibilityRole="radiogroup" style={s.reasons}>
        {CANCEL_REASONS.map(reason => <ReasonChip key={reason} label={reason} on={chosen === reason} disabled={busy}
          onPress={() => { setFreeText({ token: form.token, open: false }); onEdit({ reason }); }} />)}
        <ReasonChip label="Drugo" on={writing} disabled={busy}
          onPress={() => { setFreeText({ token: form.token, open: true }); if (chosen) onEdit({ reason: '' }); }} />
      </View>
      {writing ? <TextInput accessibilityLabel="Razlog otkazivanja Dogovora" value={form.reason} onChangeText={reason => onEdit({ reason })}
        editable={!busy} multiline maxLength={4000} autoFocus style={[s.input, s.multiline]} /> : null}
    </View> : input(form.kind === 'CANCEL' ? 'Razlog otkazivanja Dogovora' : 'Razlog predloga — opciono', form.reason, reason => onEdit({ reason }), true)}
  </View>;
}

function Review({ review, proposed, base, snapshot }: { review: AgreementActionCommand; proposed: AgreementChangeTerms | null;
  base: AgreementChangeTerms | null; snapshot: AgreementChangeSnapshot | null }) {
  const reason = review.kind === 'PROPOSE' ? review.value.razlog : review.kind === 'CANCEL' ? review.reason : review.proposal.reason;
  const cancelContext = review.kind === 'CANCEL' && snapshot?.agreementId === review.agreementId
    && snapshot.agreementVersion === review.version ? snapshot : null;
  return <View style={s.stack}>
    {review.kind === 'CANCEL'
      // The three sentences are the cancellation's binding words; they stay exactly as written.
      ? <>
        <View style={s.section}>
          {/* No eyebrow over the title ("Dogovor koji otkazuješ"): the bar already says "Otkazivanje Dogovora". */}
          <T variant="heading" accessibilityRole="header">{cancelContext?.title || 'Naziv Dogovora nije dostupan'}</T>
          <Fact art="person" label="Sa kim" value={cancelContext?.counterpartName || 'Ime druge strane nije dostupno'} />
          <Fact art="calendar" label="Važeći termin" value={cancelContext?.terms ? schedule(cancelContext.terms) : 'Termin nije dostupan'} />
        </View>
        <T variant="copy">Dogovor se završava otkazivanjem. Deljeni kontakt i precizna lokacija se opozivaju. Radnja sama ne određuje krivicu ili dug.</T>
        <T variant="meta" tone="muted">Razlog koji navedeš druga strana dobija kao poruku o otkazivanju.</T>
      </>
      : <>
        <Terms terms={proposed} base={base} />
        <T variant="copy">{review.kind === 'PROPOSE' ? 'Uslovi se menjaju tek kada druga strana prihvati predlog.' : review.kind === 'WITHDRAW' ? 'Povlačiš svoj predlog. Važeći uslovi ostaju.' : review.accept ? 'Prihvatanjem odmah počinju da važe prikazani novi uslovi. Raspored se ponovo proverava.' : 'Odbijaš ovaj predlog. Važeći uslovi ostaju.'}</T>
      </>}
    {reason ? <Reason text={reason} /> : null}
  </View>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: sys.color.ground },
  content: { paddingHorizontal: sys.space.lg, paddingTop: sys.space.sm, paddingBottom: sys.space.xxl },
  stack: { gap: sys.space.base },
  section: { gap: sys.space.md },
  // Sections part by a hairline and air, never by a box around a box.
  parted: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: sys.color.cardLine, paddingTop: sys.space.base },
  proposal: { gap: sys.space.md, paddingBottom: sys.space.base, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: sys.color.line },
  facts: { gap: sys.space.base },
  fact: { flexDirection: 'row', alignItems: 'flex-start', gap: sys.space.md },
  factCopy: { flex: 1, minWidth: 0, gap: sys.space.xs },
  money: { color: sys.color.ink },
  notice: { ...inset, gap: sys.space.sm, backgroundColor: sys.color.warnSoft },
  quote: { gap: 2, paddingLeft: sys.space.md, borderLeftWidth: 3, borderLeftColor: sys.color.lineStrong },
  // The outcome: the mark on the left, the heading and its record, and the one way on, full width like every primary.
  done: { gap: sys.space.base, paddingTop: sys.space.xl },
  mark: { alignItems: 'flex-start' },
  doneCopy: { gap: sys.space.sm },
  scopeEntry: { alignSelf: 'flex-start', marginLeft: -sys.space.base },
  field: { gap: sys.space.xs },
  reasons: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, paddingVertical: sys.space.xs },
  // A free chip has a 1 px edge; a chosen one has the system's 2 px green edge and takes 1 px off its side padding, so its words stay put.
  reason: { minHeight: sys.touch.min, justifyContent: 'center', paddingHorizontal: 14, borderRadius: sys.radius.pill, borderWidth: 1,
    borderColor: sys.color.lineStrong, backgroundColor: sys.color.surface },
  reasonOn: { ...chipChosen, paddingHorizontal: 14 - CHIP_CHOSEN_INSET },
  reasonText: { color: sys.color.ink, fontWeight: '600' }, reasonTextOn: { color: sys.color.green },
  input: { ...field },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  // The price row is the field box itself; the number's input is borderless inside it and RSD closes the row.
  amount: { ...fieldBox, paddingVertical: 0, flexDirection: 'row', alignItems: 'center', gap: sys.space.sm },
  amountInput: withInter({ flex: 1, minWidth: 0, paddingVertical: 12, paddingHorizontal: 0, ...sys.type.body, color: sys.color.ink }),
  unit: { color: sys.color.ink },
  // The decision that ends or refuses keeps the primary's measure, drawn in the danger colour: its edge and its words.
  danger: { minHeight: brandAction.minHeight, borderRadius: brandAction.borderRadius, borderWidth: 1, borderColor: sys.color.danger },
  dangerResting: { borderColor: sys.color.lineStrong },
  art: { width: 64, height: 64, borderRadius: sys.radius.card, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
});
