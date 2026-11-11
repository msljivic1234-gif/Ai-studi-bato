import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import type { DogovorProjekcija } from '../../contracts/projections';
import { agreementClientService } from '../../data/agreementClientService';
import type { SupportPayloads, SupportReference, SupportTopic } from '../../data/supportCaseTypes';
import { positiveInteger, uuid } from '../../data/serverReceipt';
import { sesijaSada } from '../../store/sesija';
import { ProductSheet } from '../product/ProductSheet';
import { SettingsAction, SettingsGroup, SettingsRow, SettingsText as T } from '../settings/SettingsPresentation';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { StateView } from '../system/StateView';
import { SuccessMark } from '../system/SuccessMark';
import { layout, ruleWidth } from '../system/layout';
import { sys } from '../system/tokens';
import { SupportChoiceRow, SupportField, SupportFrame, SupportLoading, SupportNote, SupportPrivacy, SupportTopicDisclosure, supportLabel, supportTime } from './SupportPresentation';
import type { SupportPreset } from './bugReportPreset';
import { SupportRecoveryPanel } from './SupportRecoveryPanel';
import { supportMessageShown, supportMessageTone } from './supportCopy';
import { useSupportController } from './useSupportController';
import { clearSupportNewDraft, readSupportNewDraft, rememberSupportNewDraft, supportNewDraftScope } from './supportNewDraft';

type CreateTopic = SupportPayloads['CREATE']['topic'];
const topics: CreateTopic[] = ['TECHNICAL', 'COLLABORATION', 'NO_SHOW', 'SERVICE_COMPLAINT', 'CONTENT_NOTICE', 'PRIVACY_RIGHTS', 'OTHER'];
export function supportRouteReference(params: { contextKind?: unknown; contextId?: unknown; contextRevision?: unknown }): SupportReference | null | 'INVALID' {
  if (params.contextKind === undefined && params.contextId === undefined && params.contextRevision === undefined) return null;
  if (!['TASK', 'AGREEMENT', 'AGREEMENT_MESSAGE', 'GROUP_MESSAGE', 'TASK_REVIEW', 'SAFETY_REPORT'].includes(params.contextKind as string)
    || !uuid(params.contextId) || params.contextId !== params.contextId.toLowerCase()) return 'INVALID';
  const versioned = ['TASK', 'AGREEMENT', 'AGREEMENT_MESSAGE'].includes(params.contextKind as string);
  const revision = versioned && typeof params.contextRevision === 'string' && /^[1-9][0-9]{0,9}$/.test(params.contextRevision)
    ? Number(params.contextRevision) : null;
  if (versioned ? !positiveInteger(revision) : params.contextRevision !== undefined) return 'INVALID';
  return { kind: params.contextKind as SupportReference['kind'], id: params.contextId, revision };
}
const channel = (topic: SupportTopic): SupportPayloads['CREATE']['channel'] =>
  ['COLLABORATION', 'NO_SHOW', 'PUBLICATION_REVIEW'].includes(topic) ? 'TASK'
    : ['CONTENT_NOTICE', 'PRIVACY_RIGHTS'].includes(topic) ? 'LEGAL_PRIVACY' : 'SERVICE';
const PAGE = 50;
type ReadAgreements = () => Promise<DogovorProjekcija[]>;

export function SupportNewScreen({ reference, preset, initialTopic }: { reference: SupportReference | null | 'INVALID'; preset?: SupportPreset; initialTopic?: 'NO_SHOW' }) {
  const model = useSupportController({ type: 'NEW' });
  return <SupportNewView model={model} reference={reference} preset={preset} initialTopic={initialTopic} />;
}

/**
 * Novi zahtev (round 5, owner step 11b): a topic chosen like a radio, the context it came from as an attachment, the
 * words, and the send pinned in the footer with the reason it is grey. The unsent words live in account/context-bound RAM
 * across ordinary blur/background, while intentional Back asks before discarding. The service owns submitted journals.
 */
export function SupportNewView({ model, reference, preset, initialTopic, readAgreements = () => agreementClientService.mojiDogovori({ includeRatings: false }) }: {
  model: ReturnType<typeof useSupportController>; reference: SupportReference | null | 'INVALID';
  initialTopic?: 'NO_SHOW';
  /** The first words of the request (a bug report knows its build). The request cannot be sent until the person has added to them. */ preset?: SupportPreset;
  /** Where the person's own Dogovori come from (the gallery hands in fixtures). */ readAgreements?: ReadAgreements;
}) {
  const { state, navigate } = model;
  const draftScope = supportNewDraftScope(model.accountId, model.accountRevision, reference, preset, initialTopic);
  useEffect(() => { if (state.receipt?.kind === 'CREATE') clearSupportNewDraft(draftScope); }, [draftScope, state.receipt]);
  const back = () => navigate(() => router.canGoBack() ? router.back() : router.replace('/podrska'));
  const busy = state.phase === 'LOADING' || state.phase === 'SENDING';
  if (reference === 'INVALID') return <SupportFrame title="Novi zahtev" onBack={back}>
    <StateView kind="error" title="Kontekst zahteva nije ispravan" body="Ponovo otvorite podršku iz zadatka ili Dogovora."
      primary={{ label: 'Otvorite podršku', onPress: () => navigate(() => router.replace('/podrska')) }} />
  </SupportFrame>;
  if (state.receipt) {
    const receipt = state.receipt;
    // Replace, not push: this screen resets on its next focus, so Back from the case would land on an empty form.
    return <SupportFrame title="Novi zahtev" onBack={back} footer={<SettingsAction label="Otvorite zahtev" disabled={busy}
      onPress={() => navigate(() => router.replace({ pathname: '/podrska/[id]', params: { id: receipt.caseId } }))} />}>
      <View style={s.receipt}>
        <SuccessMark fresh size={64} />
        <T variant="title" accessibilityRole="header" accessibilityLiveRegion="polite">{`Potvrđen zahtev #${receipt.caseNumber}`}</T>
        <T variant="note" tone="muted">{`Primljeno: ${supportTime(receipt.createdAt)}`}</T>
        {/* Where the answer will be, and nothing about when: no response time is promised. */}
        <T variant="copy" tone="muted">Odgovor ćete naći u Podršci.</T>
      </View>
    </SupportFrame>;
  }
  if (state.capabilities && !state.capabilities.canCreate) return <SupportFrame title="Novi zahtev" onBack={back}>
    <SupportRecoveryPanel model={model} receipt={false} />
    <StateView kind="empty" art="info" title="Novi zahtev trenutno nije dostupan ovom nalogu."
      body="Sačuvane zahteve možete ponovo da proverite iz podrške." />
  </SupportFrame>;
  if (!model.focused) return <SupportFrame title="Novi zahtev" onBack={back}><SupportLoading /></SupportFrame>;
  return <NewContents key={`${model.accountId}:${model.accountRevision}:${model.incarnationId}:${reference ? `${reference.kind}:${reference.id}:${reference.revision}` : 'NONE'}:${initialTopic ?? ''}`}
    model={model} initialReference={reference} initialTopic={initialTopic} preset={preset} readAgreements={readAgreements} back={back} draftScope={draftScope} />;
}

function Attachment({ art, label, last }: { art: FactArtKind; label: string; last: boolean }) {
  return <View style={s.attachment}><FactArt kind={art} size={24} /><T variant="bodyStrong" style={s.grow}>{label}</T>
    {last ? null : <View pointerEvents="none" style={s.rule} />}</View>;
}

function NewContents({ model, initialReference, initialTopic, preset, readAgreements, back, draftScope }: {
  model: ReturnType<typeof useSupportController>; initialReference: SupportReference | null; initialTopic?: 'NO_SHOW'; preset?: SupportPreset; readAgreements: ReadAgreements; back: () => void; draftScope: string;
}) {
  const { state, current: parentCurrent, controller, navigate } = model;
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const current = () => alive.current && parentCurrent();
  const [remembered] = useState(() => readSupportNewDraft(draftScope));
  // A context selected from a list must be chosen again after reload: retain words, not an unchecked old Agreement revision.
  useEffect(() => () => {
    const now = sesijaSada();
    if (now.user?.id !== model.accountId || now.accountRevision !== model.accountRevision) clearSupportNewDraft(draftScope);
  }, [draftScope, model.accountId, model.accountRevision]);
  const [topic, setTopic] = useState<CreateTopic>(remembered?.topic ?? (initialReference?.kind === 'TASK_REVIEW' ? 'PUBLICATION_REVIEW'
    : initialReference?.kind === 'AGREEMENT' ? initialTopic ?? 'COLLABORATION' : 'TECHNICAL'));
  const [topicsExpanded, setTopicsExpanded] = useState(false);
  const [context, setContext] = useState<SupportReference | null>(initialReference);
  const [selectedEvidence, setSelectedEvidence] = useState<SupportReference | null>(
    initialReference && ['AGREEMENT_MESSAGE', 'GROUP_MESSAGE'].includes(initialReference.kind) ? initialReference : null);
  const [contextTitle, setContextTitle] = useState<string | null>(null);
  const [title, setTitle] = useState(remembered?.title ?? preset?.title ?? ''),
    [body, setBody] = useState(remembered?.body ?? preset?.body ?? ''), [desired, setDesired] = useState(remembered?.desired ?? '');
  // What the person has added to the words they were given: nothing of the preset is a report until they have written under it.
  const written = preset ? body.trim() !== preset.body.trim() : !!body.trim();
  const [choices, setChoices] = useState<DogovorProjekcija[] | null>(null), [choosing, setChoosing] = useState(false), [choiceError, setChoiceError] = useState('');
  const [choicePage, setChoicePage] = useState(0);
  const confirm = useConfirmSheet();
  const disabled = state.phase !== 'READY' || !state.capabilities?.canCreate || !!state.pending || choosing;
  const draftView = useMemo(() => ({}), [topic, context, title, body, desired, disabled, selectedEvidence]);
  const latestDraft = useRef(draftView); latestDraft.current = draftView;
  const requiresAgreement = topic === 'COLLABORATION' || topic === 'NO_SHOW';
  const valid = !!title.trim() && Array.from(title).length <= 200 && !!body.trim() && Array.from(body).length <= 4000
    && written && Array.from(desired).length <= 1000 && (!requiresAgreement || context?.kind === 'AGREEMENT')
    && (topic !== 'PUBLICATION_REVIEW' || context?.kind === 'TASK_REVIEW');
  // The send button is grey until the form is complete, and a grey button always says why (round 5 review): first what
  // holds the whole screen (an unconfirmed send, a read in progress or failed), then what the form still lacks. While it
  // sends it is not grey: it keeps its words with a spinner. Only its own send spins it: a stop or a replay of an
  // unconfirmed send spins its own button in the panel above, and this one waits grey with its reason (round 5c review).
  const sending = state.phase === 'SENDING' && state.command === 'SEND';
  const lacking = valid ? null : requiresAgreement && context?.kind !== 'AGREEMENT' ? 'Izaberite Dogovor iznad da bi zahtev mogao da se pošalje.'
    : topic === 'PUBLICATION_REVIEW' && context?.kind !== 'TASK_REVIEW' ? 'Ovu temu otvarate iz pregledane odluke o zadatku.'
      : !title.trim() || !body.trim() ? 'Za slanje su potrebni naslov i opis.'
        : !written ? 'Dopišite šta se desilo pre slanja.' : 'Skratite tekst do dozvoljene dužine.';
  const missing = sending || (!disabled && valid) ? null
    : state.pending ? 'Najpre proverite prethodno slanje.'
      : state.phase === 'LOADING' ? 'Učitavamo sačuvano stanje…'
        : state.phase === 'ERROR' ? 'Stanje zahteva nije učitano.'
          : lacking ?? (choosing ? 'Učitavamo Vaše Dogovore…' : null);
  // Words the screen wrote itself are not the person's: leaving with only those asks nothing.
  const dirty = (title !== (preset?.title ?? '') && !!title) || (body !== (preset?.body ?? '') && !!body) || !!desired;
  useEffect(() => {
    if (!current()) return;
    // A durable send/UNKNOWN is reconciled by its journal; no text can become a fresh command after a restart.
    if (state.pending || state.phase === 'SENDING') { clearSupportNewDraft(draftScope); return; }
    if (dirty) rememberSupportNewDraft(draftScope, { topic, title, body, desired });
    else clearSupportNewDraft(draftScope);
  }, [current, draftScope, dirty, state.pending, state.phase, topic, title, body, desired]);
  // Leaving with typed words asks first, in every state that keeps them on screen. Not while a send is running or
  // unconfirmed: those words may already have reached support, so "neće biti sačuvan" would not be true.
  const guarded = dirty && !state.pending && state.phase !== 'SENDING';
  // While the screen reads, an untouched form waits behind a placeholder; typed words stay in sight (and in memory).
  const hideForm = (state.phase === 'LOADING' || state.phase === 'ERROR') && !dirty && !state.pending;
  async function loadAgreements() {
    if (!current() || disabled) return;
    setChoosing(true); setChoiceError('');
    try { const result = await readAgreements();
      if (!current()) return;
      setChoices(result.filter(item => uuid(item.id) && positiveInteger(item.verzija))); setChoicePage(0);
    } catch { if (current()) setChoiceError('Dogovori nisu učitani. Pokušaj ponovo.'); }
    finally { if (current()) setChoosing(false); }
  }
  // The words exist only in memory: leaving with some asks first. An unsent form with nothing typed leaves at once.
  const discard = (go: () => void) => {
    if (!current()) return;
    const discardAndLeave = () => { clearSupportNewDraft(draftScope); go(); };
    if (guarded) confirm.ask({ title: 'Odbaciti zahtev?', message: 'Uneti tekst neće biti sačuvan.',
      confirmLabel: 'Odbaci', cancelLabel: 'Nastavi pisanje', tone: 'danger', onConfirm: discardAndLeave });
    else discardAndLeave();
  };
  // The question may outlive the render that asked it (a reload that settles while it is open), so its answer leaves
  // through the latest render's exits, not the ones it was asked with, which would be fenced out (round 5c review).
  const exits = useRef({ back, navigate }); exits.current = { back, navigate };
  const leave = () => discard(() => exits.current.back());
  // The (app) navigator is Tabs with a history back behaviour, so a screen being removed is never announced there: the
  // hardware Back (and Android's back gesture) is heard directly while this screen has focus, as on Dostupnost. The
  // question's own sheet takes Back before this does.
  const latest = useRef({ guarded, leave }); latest.current = { guarded, leave };
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!latest.current.guarded) return false;
      latest.current.leave();
      return true;
    });
    return () => subscription.remove();
  }, []));
  const send = () => { if (current() && latestDraft.current === draftView && !disabled && valid) void controller?.submit('CREATE', {
    channel: channel(topic), topic, title, body, desiredOutcome: desired.trim() ? desired : null, context,
    evidence: selectedEvidence ? [selectedEvidence] : [],
  }, state); };
  const contextName = (kind: SupportReference['kind']) => kind === 'TASK_REVIEW' ? 'Pregledana odluka o zadatku' : kind === 'TASK' ? 'Izabrani zadatak'
    : kind === 'AGREEMENT_MESSAGE' ? 'Izabrana poruka iz Dogovora' : kind === 'GROUP_MESSAGE' ? 'Izabrana grupna poruka' : 'Namerno izabrana referenca';
  const sameAsEvidence = !!context && !!selectedEvidence && context.kind === selectedEvidence.kind && context.id === selectedEvidence.id;
  // The context is said once as an attachment row (not twice when it is the chosen message itself), but the sentence
  // about what is and is not attached stays whenever a context goes with the request (round 5 review: it had vanished
  // in the usual case, a request opened from a Dogovor message).
  const contextNote = !requiresAgreement && !!context;
  const showContext = contextNote && !sameAsEvidence;
  const page = choices?.slice(choicePage * PAGE, (choicePage + 1) * PAGE) ?? [];
  // A refused or failed command is drawn as failed; a word about a send whose outcome is unconfirmed as waiting (round 5
  // review). The absent-confirmation words are the recovery panel's own, so they are not said twice (round 5c review).
  const messageTone = supportMessageTone(state);
  // A grey send says why in the foot's own line ABOVE it, where it reads as the cause and not as the next thing (owner's phone, 8 Oct 2026: it stood under the button).
  return <SupportFrame title="Novi zahtev" onBack={leave} footerReason={hideForm ? null : missing} footer={hideForm ? undefined
    : <SettingsAction label="Pošalji privatni zahtev" loading={sending} disabled={disabled || !valid} onPress={send} />}>
    <SupportRecoveryPanel model={model} receipt={false} />
    {state.phase === 'LOADING' && hideForm ? <SupportLoading />
      : state.phase === 'ERROR' && hideForm ? <StateView kind="error" title="Stanje zahteva nije učitano" body={state.message ?? undefined}
        quiet={{ label: 'Proveri dostupnost', onPress: () => { if (model.current()) void controller?.load(); } }} />
      : state.phase === 'ERROR' ? <>
        {state.message ? <SupportNote tone="danger">{state.message}</SupportNote> : null}
        <SettingsAction label="Proveri dostupnost" kind="quiet" onPress={() => { if (model.current()) void controller?.load(); }} />
      </> : supportMessageShown(state) ? <SupportNote tone={messageTone === 'success' ? 'info' : messageTone}>{state.message}</SupportNote> : null}
    <View style={hideForm ? s.hidden : s.form}>
      <SupportPrivacy />
      <SettingsGroup title="Tema zahteva">
        <SupportTopicDisclosure selectedLabel={supportLabel(topic)} expanded={topicsExpanded} disabled={disabled}
          onToggle={() => { if (current() && !disabled) setTopicsExpanded(open => !open); }}>
        <View accessibilityRole="radiogroup" accessibilityLabel="Tema zahteva">
        {(initialReference?.kind === 'TASK_REVIEW' ? ['PUBLICATION_REVIEW' as const, ...topics] : topics).map((value, index, all) =>
          <SupportChoiceRow key={value} kind="radio" label={supportLabel(value)} selected={topic === value} last={index === all.length - 1} disabled={disabled}
            onPress={() => { if (current() && !disabled) { setTopic(value); setTopicsExpanded(false); setChoices(null);
              if ((value === 'COLLABORATION' || value === 'NO_SHOW') && context?.kind !== 'AGREEMENT') setContext(null);
              else if (value === 'PUBLICATION_REVIEW') setContext(initialReference); } }} />)}
        </View>
        </SupportTopicDisclosure>
      </SettingsGroup>
      {requiresAgreement ? <SettingsGroup title="Dogovor na koji se zahtev odnosi"><View style={s.inCard}>
        {context?.kind === 'AGREEMENT' ? <T variant="bodyStrong">{contextTitle ?? 'Izabran Dogovor'}</T>
          : <T tone="muted">Izaberi jedan od svojih Dogovora.</T>}
        <T variant="note" tone="muted">Podrška dobija izabrani Dogovor i osnovne podatke o njemu. Razgovor se ne kopira automatski.</T>
        <SettingsAction label="Izaberi Dogovor" kind="quiet" loading={choosing} disabled={disabled} onPress={() => { void loadAgreements(); }} />
        {choiceError ? <T variant="note" accessibilityRole="alert" tone="danger">{choiceError}</T> : null}
        {/* Choosing this topic with no agreements made the send button unreachable, with nothing anywhere saying why:
            the requirement is stated here and the way out is beside it. */}
        {choices && !choices.length ? <>
          <T>Ova tema traži Dogovor, a ti još nemaš nijedan.</T>
          <SettingsAction label="Izaberi drugu temu" kind="quiet" disabled={disabled}
            onPress={() => { if (current() && !disabled) { setTopic('OTHER'); setContext(null); setContextTitle(null); setChoices(null); } }} />
        </> : null}
      </View></SettingsGroup> : null}
      {contextNote || selectedEvidence ? <SettingsGroup title="Prilog"><View style={s.inCardList}>
        {showContext ? <Attachment art={context!.kind === 'TASK' || context!.kind === 'TASK_REVIEW' ? 'document' : 'chat'}
          label={contextName(context!.kind)} last={!selectedEvidence} /> : null}
        {selectedEvidence ? <Attachment art="chat" label={selectedEvidence.kind === 'AGREEMENT_MESSAGE' ? 'Poruka iz privatnog Dogovora' : 'Poruka iz grupnog razgovora'} last /> : null}
        <View style={s.inCard}>
          {contextNote ? <T variant="note" tone="muted">Uz zahtev se šalje ovaj kontekst. Ostali razgovori i privatni podaci nisu automatski priloženi.</T> : null}
          {selectedEvidence ? <>
            <T variant="note" tone="muted">Prilaže se samo namerno izabrana poruka, čak i ako zahtev povežeš sa Dogovorom.</T>
            <SettingsAction label="Ukloni izabranu poruku iz zahteva" kind="quiet" disabled={disabled}
              onPress={() => { if (current() && !disabled) {
                if (context?.kind === selectedEvidence.kind && context.id === selectedEvidence.id) setContext(null);
                setSelectedEvidence(null);
              } }} />
          </> : null}
        </View>
      </View></SettingsGroup> : null}
      {topic === 'PRIVACY_RIGHTS' ? <View style={s.rights}>
        <SupportNote>Ovde možeš da pošalješ zahtev u vezi sa svojim pravima. Slobodna poruka ne izvršava izvoz ili zatvaranje naloga.</SupportNote>
        {/* This screen starts empty on its next focus, so leaving it here with typed words asks first, as Back does. */}
        <SettingsAction label="Otvori izvoz i zatvaranje naloga" kind="quiet" disabled={disabled}
          onPress={() => discard(() => exits.current.navigate(() => router.push('/profil/privatnost')))} />
      </View> : null}
      <SupportField label="Kratak naslov" value={title} onChange={value => { if (current() && !disabled) setTitle(value); }} maximum={200} disabled={disabled} />
      <SupportField label="Opis zahteva" value={body} onChange={value => { if (current() && !disabled) setBody(value); }} maximum={4000} multiline disabled={disabled} />
      <SupportField label="Željeni ishod" value={desired} onChange={value => { if (current() && !disabled) setDesired(value); }} maximum={1000} multiline optional disabled={disabled} />
    </View>
    {choices && choices.length ? <ProductSheet title="Tvoji Dogovori" onClose={() => { if (alive.current) setChoices(null); }}>
      {dismiss => <View>
        {/* The agreed time under the title, as the Dogovor itself shows it: two Dogovori with one title differ by it. */}
        {page.map((item, index) => <SettingsRow key={item.id} label={item.naslov || 'Dogovor'} detail={item.vremeTekst || undefined}
          last={index === page.length - 1} disabled={disabled}
          onPress={() => { if (current() && !disabled) { setContext({ kind: 'AGREEMENT', id: item.id.toLowerCase(), revision: item.verzija });
            setContextTitle(item.naslov || 'Dogovor'); dismiss(); } }} />)}
        <View style={s.pager}>
          {choicePage > 0 ? <SettingsAction label="Prethodni Dogovori" kind="quiet" disabled={disabled} onPress={() => { if (current()) setChoicePage(value => value - 1); }} /> : null}
          {choices.length > (choicePage + 1) * PAGE ? <SettingsAction label="Još Dogovora" kind="quiet" disabled={disabled} onPress={() => { if (current()) setChoicePage(value => value + 1); }} /> : null}
        </View>
      </View>}
    </ProductSheet> : null}
    {confirm.sheet}
  </SupportFrame>;
}

const s = StyleSheet.create({
  grow: { flex: 1, minWidth: 0 },
  // The divider between two attachments is a rule of 1 dp, not a border: the same line every row of the app draws.
  rule: { position: 'absolute', left: 0, right: 0, bottom: 0, height: ruleWidth, backgroundColor: sys.color.line },
  receipt: { alignItems: 'flex-start', gap: sys.space.md, paddingVertical: sys.space.xl },
  form: { gap: sys.space.base },
  hidden: { display: 'none' },
  inCard: { paddingVertical: sys.space.md, gap: sys.space.sm },
  inCardList: { paddingTop: sys.space.xs },
  attachment: { minHeight: layout.rowMinPlain, paddingVertical: sys.space.md, flexDirection: 'row', alignItems: 'center', gap: sys.space.md },
  rights: { gap: sys.space.xs },
  pager: { flexDirection: 'row', flexWrap: 'wrap', gap: sys.space.sm, justifyContent: 'space-between', paddingTop: sys.space.sm },
});
