import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { closureBlockerLabels, closureClassLabels, erasureAdapter, erasureExceptionLabels, type ClosureExecutionReview,
  type ClosureExecutionState } from '../../data/closureExecutionClientService';
import { vreme } from '../../lib/vreme';
import { InlineNote, PlainRow } from '../privacy/InlineNote';
import { SettingsAction, SettingsGroup, SettingsInfo, SettingsRow, SettingsText as T } from '../settings/SettingsPresentation';
import { FactArt, type FactArtKind } from '../system/FactArt';
import { FlowFooter } from '../system/FlowFooter';
import { plural } from '../system/plural';
import { Screen } from '../system/Screen';
import { ScreenChrome } from '../system/ScreenChrome';
import { StateView } from '../system/StateView';
import { sys } from '../system/tokens';
import { V2Action } from '../v2/V2Action';
import { QuietReadState } from '../v2/QuietReadState';
import type { ClosureIntent } from './closureIntent';

export const closureDuration = (n: number) => n % 86400 === 0 ? plural(n / 86400, 'dan', 'dana', 'dana')
  : n % 3600 === 0 ? plural(n / 3600, 'sat', 'sata', 'sati') : plural(n, 'sekunda', 'sekunde', 'sekundi');

/**
 * The messages that mean "not confirmed yet, the same request waits" (the owner's closure copy, word for word). They
 * wait for the person, so they are drawn as waiting; every other message of the flow is a failed read or command.
 * `CAUGHT` is the flow's word for a command whose outcome could not be read: it waits only while a saved start or
 * preparation is there to check (round 5c review); without one it is a failure.
 */
export const closureUnconfirmedCopy = {
  START: 'Ne znamo da li je zahtev za zatvaranje poslat. Sačuvan je na telefonu; možete da ga pošaljete ponovo.',
  PREPARE: 'Ne znamo da li je priprema počela. Možete da pokušate ponovo.',
  CAUGHT: 'Ne znamo stanje zahteva. Proverite ga ponovo.',
} as const;

/** Where a blocker can be resolved. A blocker with no place of its own is a plain line. */
export type ClosureBlockerPlace = 'dogovori' | 'zadaci' | 'prijave';
const blockerPlace: Readonly<Record<string, ClosureBlockerPlace>> = { ACTIVE_AGREEMENT: 'dogovori', OPEN_TASK: 'zadaci', ACTIVE_APPLICATION: 'prijave' };

/**
 * The frame of the closure flow: one job, one way out (the X), the flow's name, the scroll and an optional pinned foot. It is the
 * system's flow screen (`Screen kind="flow"`: the edge of 20, the blocks 24 apart) and the system's foot (`FlowFooter`, the one line
 * above it); SettingsScreen has no flow variant, so the flow draws its bar here.
 *
 * The X is spoken "Zatvori pregled": a bare "Zatvori" inside "Zatvaranje naloga" could be heard as the closing itself
 * (round 5 review). It only leaves the flow.
 */
export function ClosureFrame({ onClose, closeDisabled = false, footer, children }: {
  onClose: () => void; closeDisabled?: boolean; footer?: ReactNode; children: ReactNode;
}) {
  return <Screen kind="flow" keyboardAvoiding={false}
    header={<ScreenChrome variant="flow" title="Zatvaranje naloga" closeLabel="Zatvori pregled" disabled={closeDisabled} onClose={onClose} />}
    footer={footer ? <FlowFooter testID="closure-footer">{footer}</FlowFooter> : undefined}>{children}</Screen>;
}

/**
 * The irreversible command: outlined in the danger colour on white, 54 high like the primary. It is never green (green
 * is the safe way forward) and never a filled red block (that would shout before the consequences are read).
 *
 * When it cannot be used now it is grey with its reason beside it (`unavailable`, the owner's rule: a grey button always
 * says why), never missing without a word: the outline goes to the quiet line and the words to the muted ink.
 */
export function DangerAction({ label, onPress, busy, loading = false, unavailable = null }: {
  label: string; onPress: () => void; busy: boolean; loading?: boolean; unavailable?: string | null;
}) {
  return <V2Action label={label} kind="destructive" disabled={busy || unavailable !== null} loading={loading} onPress={onPress} reason={unavailable ?? undefined}
    style={[s.danger, { borderColor: (busy || unavailable !== null) && !loading ? sys.color.line : sys.color.danger }]} />;
}

export type ClosureModel = {
  busy: boolean;
  /** Which command of this flow is running, so only its own button shows the spinner. */
  working: 'prepare' | 'start' | 'retry' | 'refresh' | 'logout' | null;
  message: string; review: ClosureExecutionReview | null; intent: ClosureIntent | null;
  state: ClosureExecutionState | null; absent: boolean;
};
export type ClosureCommands = {
  onClose: () => void; onPrepare: () => void; onAskStart: () => void; onRetry: () => void; onRefresh: () => void;
  onLogout: () => void; onSupport: () => void; onBlocker: (place: ClosureBlockerPlace) => void; onExport: () => void;
};

/**
 * Zatvaranje naloga as a flow (round 5, owner step 11b): the consequences first, then the one way to start. Every word
 * is the owner's closure copy, kept verbatim; only the layout changed. Presentation only: every command is the dialog's
 * own, fenced there.
 */
export function ClosureView({ model, commands }: { model: ClosureModel; commands: ClosureCommands }) {
  const { busy, working, message, review, intent, state, absent } = model;
  const terminal = state?.state === 'CLOSED';
  const erasure = (state?.adapterVersion ?? review?.adapterVersion) === erasureAdapter;
  const pendingExceptions = state?.exceptions ?? review?.exceptions ?? [];
  const retained = (terminal ? state?.retainedDatasets : review?.retainedDatasets) ?? [];
  // The words of the check follow what it checks: a request already made is checked ("Proveri stanje zahteva"); before anything is
  // started there is no request, only the review, which is read again ("Osveži pregled") or looked at again once the
  // obligations are met ("Proveri ponovo").
  const check = (kind: 'primary' | 'secondary' | 'quiet', label = 'Proveri stanje zahteva') => <SettingsAction key="check" label={label} kind={kind}
    disabled={busy} loading={working === 'refresh'} onPress={commands.onRefresh} />;

  if (!review && !state && !intent) {
    if (!busy && message) return <ClosureFrame onClose={commands.onClose}>
      <StateView kind="error" art="lock" title="Stanje zatvaranja nije učitano" body={message}
        primary={{ label: 'Pokušaj ponovo', onPress: commands.onRefresh, disabled: busy }} />
    </ClosureFrame>;
    return <ClosureFrame onClose={commands.onClose}>
      <QuietReadState art="lock" title="Proveravamo stanje…" body="Čitamo ograničenja i sačuvani zahtev za zatvaranje." />
    </ClosureFrame>;
  }

  const art: FactArtKind = terminal ? 'check' : state ? 'clock' : 'lock';
  // Before anything is started the first words under the title are what happens (the consequence), so the header says no
  // sentence of its own there: an orientation line above the consequence only delays it.
  const header = <View style={s.header}>
    <FactArt kind={art} size={64} muted={terminal} />
    <T variant="title" accessibilityRole="header">{terminal ? 'Nalog je zatvoren.' : state ? 'Zahtev je pokrenut.' : 'Pregled pre zatvaranja.'}</T>
    {terminal || state ? <T variant="copy" tone="muted">{terminal ? 'Pristup nalogu je ugašen. Potvrda ispod opisuje završene radnje i podatke koji se čuvaju.'
      : 'Zahtev je u redu za obradu. Pristup je ograničen dok se pokrenuti zahtev proverava i završava.'}</T> : null}
  </View>;
  // One look for "failed" (round 5 review): the "not confirmed yet" messages wait for the person (the caught one only
  // while a saved start or preparation waits for its check); every other message here is a read or a command that failed.
  const waiting = message === closureUnconfirmedCopy.START || message === closureUnconfirmedCopy.PREPARE
    || (!!intent && message === closureUnconfirmedCopy.CAUGHT);
  const note = message ? <InlineNote tone={waiting ? 'warn' : 'danger'} alert>{message}</InlineNote> : null;
  const retention = retained.length ? <SettingsGroup title="Rokovi čuvanja">
    {retained.map((d, index) => <SettingsInfo key={d.dataClass} title={closureClassLabels[d.dataClass]} last={index === retained.length - 1}>
      {`Ograničeno čuvanje: ${closureDuration(d.retentionSeconds)} od pokretanja zahteva.`}
    </SettingsInfo>)}
  </SettingsGroup> : null;
  const exceptions = erasure && pendingExceptions.length > 0 ? <SettingsGroup title="Pre konačnog zatvaranja">
    <View style={s.block}>
      <T variant="copy">Ovi izdvojeni podaci još zahtevaju rešavanje. Nepovezani obični podaci mogu se ukloniti dok ta provera traje.</T>
      <View>{pendingExceptions.map((code, index) =>
        <PlainRow key={code} label={erasureExceptionLabels[code]} last={index === pendingExceptions.length - 1} />)}</View>
      <SettingsAction label="Otvori privatnu podršku" kind="secondary" disabled={busy} onPress={commands.onSupport} />
    </View>
  </SettingsGroup> : null;

  if (state) {
    const steps = erasure && !terminal && state.totalSteps ? { done: state.completedSteps ?? 0, total: state.totalSteps } : null;
    return <ClosureFrame onClose={commands.onClose} footer={terminal ? <>
      <SettingsAction label="Odjavi se sa ovog uređaja" disabled={busy} loading={working === 'logout'} onPress={commands.onLogout} />
      {check('quiet')}
    </> : <>
      {check('primary')}
      <SettingsAction label="Odjavi se sa ovog uređaja" kind="quiet" disabled={busy} loading={working === 'logout'} onPress={commands.onLogout} />
    </>}>
      {header}{note}
      <SettingsGroup title={terminal ? 'Završene radnje' : 'Obrada je u toku'}><View style={s.block}>
        <T variant="copy">{terminal ? 'Podaci za prijavu su uklonjeni i sesije su završene. Fotografije i datoteke naloga su obrisane.'
          : 'Zatvaranje još nije završeno. Nepotvrđen mrežni odgovor ne znači da su podaci obrisani.'}</T>
        {erasure ? <T variant="copy">{terminal ? 'Obični lični i privatni podaci aplikacije su uklonjeni. Ostaju minimalni pseudonimni zapisi potrebni za potvrde radnji i tehničku evidenciju.'
          : state.ordinaryContentErased ? 'Obični podaci aplikacije su uklonjeni. Podaci za prijavu još nisu potvrđeno obrisani i nalog nije zatvoren.'
            : 'Obični podaci aplikacije se postupno uklanjaju. Završetak se potvrđuje tek posle svih provera.'}</T>
          : <T variant="copy">Identifikator naloga i evidencije obuhvaćene objavljenim pravilima ostaju ograničeno dostupni tokom propisanog čuvanja.</T>}
        {steps ? <View style={s.progress}>
          {/* Static: the count is a fact, so the bar is drawn where it is and never slides. */}
          <View style={s.track} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
            <View style={[s.fill, { width: `${Math.round(100 * Math.min(1, steps.done / steps.total))}%` }]} />
          </View>
          <T variant="note" tone="muted">{`Provereni koraci: ${steps.done} od ${steps.total}.`}</T>
        </View> : null}
        {terminal ? <T variant="note" tone="muted">{`Završeno: ${vreme(state.closedAt)}`}</T> : null}
      </View></SettingsGroup>
      {exceptions}
      {retention}
    </ClosureFrame>;
  }

  if (intent) {
    // An unconfirmed command: the same key waits for a read, and a replay is offered only once the read finds it absent.
    const replay = absent ? intent.kind === 'START'
      ? <DangerAction label="Pošalji zahtev za zatvaranje ponovo" busy={busy} loading={working === 'retry'} onPress={commands.onRetry} />
      : <SettingsAction label="Pripremi ponovo" kind="secondary" disabled={busy} loading={working === 'retry'} onPress={commands.onRetry} /> : null;
    return <ClosureFrame onClose={commands.onClose} footer={replay ? <>{replay}{check('quiet')}</> : check('primary')}>
      {header}{note}{exceptions}{retention}
    </ClosureFrame>;
  }

  const ready = review!;
  if (!ready.ready) {
    const preparation = ready.code === 'CLOSURE_PREPARATION_REQUIRED';
    const policyMissing = ready.code === 'CLOSURE_POLICY_NOT_READY';
    return <ClosureFrame onClose={commands.onClose} footer={preparation ? <>
      <SettingsAction label="Pripremi pregled" disabled={busy} loading={working === 'prepare'} onPress={commands.onPrepare} />
      {check('quiet', 'Proveri ponovo')}
    </> : check('secondary', 'Proveri ponovo')}>
      {header}{note}
      <T variant="copy">{policyMissing ? (erasure ? 'Provereni postupak zatvaranja trenutno nije dostupan. Sačuvani podaci nisu označeni kao obrisani.'
        : 'Zatvaranje naloga trenutno nije dostupno. Potpuna pravila zatvaranja i čuvanja još nisu objavljena.')
        : preparation ? 'Pripremi pregled trenutnih obaveza pre zatvaranja.' : 'Najpre reši obaveze navedene ispod.'}</T>
      {ready.blockers.length ? <SettingsGroup title="Obaveze">{ready.blockers.map((code, index) => {
        const place = blockerPlace[code], last = index === ready.blockers.length - 1;
        return place ? <SettingsRow key={code} compact last={last} label={closureBlockerLabels[code]} disabled={busy}
          onPress={() => commands.onBlocker(place)} />
          : <PlainRow key={code} label={closureBlockerLabels[code]} last={last} />;
      })}</SettingsGroup> : null}
      {exceptions}{retention}
      {/* The irreversible command is always the last thing on the screen: when it cannot be used it stands here grey, with the reason beside it. */}
      <DangerAction label="Pokreni zatvaranje naloga" busy={busy} onPress={commands.onAskStart}
        unavailable={policyMissing ? 'Zatvaranje trenutno nije dostupno.' : preparation ? 'Najpre pripremi pregled.' : 'Najpre reši obaveze navedene iznad.'} />
    </ClosureFrame>;
  }

  return <ClosureFrame onClose={commands.onClose}>
    {header}{note}
    {/* The consequence comes first, in the owner's words; everything that can be done instead (keep a copy) and the command itself follow it. */}
    <SettingsGroup title="Posle pokretanja"><View style={s.block}>
      <T variant="copy">{erasure ? 'Pristup običnim funkcijama se ograničava. Uklanjaju se nezaštićene datoteke, obični lični i privatni podaci, pa podaci za prijavu i sesije. Minimalni pseudonimni zapisi potvrda ostaju. Izdvojeni dokazi se zasebno rešavaju; ako postoje, konačno zatvaranje čeka njihovu proveru. Pokrenuto uklanjanje ne možeš poništiti iz aplikacije.'
        : 'Pristup nalogu se gasi. Podaci za prijavu, aktivne sesije i datoteke naloga biće uklonjeni. Identifikator i evidencije iz pregleda ostaju u skladu sa pravilima čuvanja. Pokrenuto zatvaranje ne možeš otkazati iz aplikacije.'}</T>
    </View></SettingsGroup>
    {exceptions}{retention}
    <SettingsGroup title="Tvoji podaci">
      <SettingsRow compact last label="Izvoz podataka" detail="Pogledaj zahtev, pripremu i dostupnost svoje kopije." disabled={busy}
        onPress={commands.onExport} />
    </SettingsGroup>
    {/* At the end of the scroll, not pinned: the consequences above are passed on the way to it. The command is the very last
        thing; the quiet refresh stands above it, so nothing follows the irreversible step. */}
    <View style={s.end}>
      {check('quiet', 'Osveži pregled')}
      <DangerAction label="Pokreni zatvaranje naloga" busy={busy} loading={working === 'start'} onPress={commands.onAskStart} />
    </View>
  </ClosureFrame>;
}

const s = StyleSheet.create({
  header: { gap: sys.space.sm },
  block: { gap: sys.space.sm },
  progress: { gap: sys.space.sm, paddingTop: sys.space.xs },
  track: { height: sys.space.sm, borderRadius: sys.radius.pill, backgroundColor: sys.color.control, overflow: 'hidden' },
  fill: { height: sys.space.sm, borderRadius: sys.radius.pill, backgroundColor: sys.color.green },
  end: { gap: sys.space.sm },
  danger: { minHeight: 54, borderRadius: sys.radius.primary, borderWidth: 1, backgroundColor: sys.color.surface },
});
