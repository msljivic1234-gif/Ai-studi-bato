import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Press } from '../Press';
import { T } from '../Text';
import { FactArt } from '../system/FactArt';
import { layout } from '../system/layout';
import { sys } from '../system/tokens';
import type { ClosureExecutionState } from '../../data/closureExecutionClientService';
import type { AccountClosingStanding } from '../../data/accountClosingStanding';
import type { Ishod } from '../../data/ports';
import { vreme } from '../../lib/vreme';
import { PrimaryButton } from './AuthControls';

/** The signed-in account the check belongs to; null while signed out or on the public recovery link. */
export type AccountClosingScope = { accountId: string; accountRevision: number } | null;

export const accountClosingCopy = {
  title: 'Nalog se zatvara.',
  closedTitle: 'Nalog je zatvoren.',
  body: 'Zatvaranje ovog naloga je pokrenuto. Pristup je ograničen dok se zatvaranje proverava i završava.',
  // The two sentences below are the closure flow's own (ClosurePresentation), kept word for word.
  closedBody: 'Pristup nalogu je ugašen. Podaci za prijavu su uklonjeni i sesije su završene.',
  steps: (done: number, total: number) => `Provereni koraci: ${done} od ${total}.`,
  closedAt: (at: string) => `Završeno: ${vreme(at)}`,
  unavailable: 'Zadaci, prijave i Dogovori nisu dostupni dok traje zatvaranje.',
  check: 'Proveri stanje',
  support: 'Otvori privatnu podršku',
  signOut: 'Odjavi se sa ovog uređaja',
  checkFailed: 'Ne možemo da proverimo stanje. Pokušaj ponovo.',
  signOutFailed: 'Odjava trenutno nije uspela. Pokušaj ponovo.',
} as const;

type Found = { key: string; execution: ClosureExecutionState | null };

/**
 * After sign-in, and after every restore, the root asks once whether this account is closing (data/accountClosingStanding).
 * Only a confirmed ACCOUNT_CLOSING answer shows the closing state; an open account, an offline read or any other failure shows
 * nothing and blocks nothing, so an ordinary sign-in never waits for this read.
 *
 * The data modules are required when the read runs, not when the root layout loads: they pull the Supabase client, which the
 * root's own test harnesses keep out on purpose, and a failure to load them is "nothing known", like any failed read.
 */
export function useAccountClosing(scope: AccountClosingScope) {
  const key = scope ? `${scope.accountId}:${scope.accountRevision}` : null;
  const [found, setFound] = useState<Found | null>(null);
  const [working, setWorking] = useState<'check' | 'signOut' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  // One object per account incarnation: a read or a sign-out that outlives it changes nothing.
  const visit = useRef<{ scope: NonNullable<AccountClosingScope>; key: string } | null>(null);

  const read = useCallback(async (manual: boolean) => {
    const owner = visit.current;
    if (!owner) return;
    if (manual) { setWorking('check'); setMessage(null); }
    let result: Ishod<AccountClosingStanding> | null = null;
    try {
      const { readAccountClosingStanding } = require('../../data/accountClosingStanding') as typeof import('../../data/accountClosingStanding');
      const { closureIntentJournal } = require('../closure/closureIntent') as typeof import('../closure/closureIntent');
      result = await readAccountClosingStanding(owner.scope, async () => {
        const saved = await closureIntentJournal.load(owner.scope.accountId);
        return saved?.kind === 'START' ? saved.clientRequestId : null;
      });
    } catch { result = null; }
    if (visit.current !== owner) return;
    if (manual) setWorking(null);
    if (result?.ok) setFound(result.podatak.closing ? { key: owner.key, execution: result.podatak.execution } : null);
    else if (manual) setMessage(accountClosingCopy.checkFailed);
  }, []);

  useEffect(() => {
    setFound(null); setWorking(null); setMessage(null);
    if (!scope || !key) { visit.current = null; return; }
    const owner = { scope: { accountId: scope.accountId, accountRevision: scope.accountRevision }, key };
    visit.current = owner;
    void read(false);
    return () => { if (visit.current === owner) visit.current = null; };
    // The account incarnation is the scope: a token refresh is not a new account and asks nothing again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, read]);

  const check = useCallback(() => { if (!working) void read(true); }, [read, working]);

  const signOut = useCallback(async () => {
    const owner = visit.current;
    if (!owner || working) return;
    setWorking('signOut'); setMessage(null);
    try {
      const { authClientService } = require('../../data/authClientService') as typeof import('../../data/authClientService');
      await authClientService.signOutLocal(owner.scope);
    } catch {
      if (visit.current === owner) setMessage(accountClosingCopy.signOutFailed);
    } finally {
      if (visit.current === owner) setWorking(null);
    }
  }, [working]);

  const state = found && found.key === key ? found : null;
  return { closing: !!state, execution: state?.execution ?? null, working, message, check, signOut: () => { void signOut(); } };
}

/**
 * "Nalog se zatvara": what the guard has already decided, shown instead of a home screen whose every read it refuses. It
 * names the stage and, when this device started the closing, its progress; nothing about it is guessed. Private support is
 * the one place the guard still admits besides the closure itself, so it is offered while the closing runs.
 */
export function AccountClosingScreen({ execution, working, message, onCheck, onSupport, onSignOut }: {
  execution: ClosureExecutionState | null; working: 'check' | 'signOut' | null; message: string | null;
  onCheck: () => void; onSupport: () => void; onSignOut: () => void;
}) {
  const insets = useSafeAreaInsets();
  const closed = execution?.state === 'CLOSED';
  const busy = working !== null;
  const steps = !closed && execution?.totalSteps ? { done: execution.completedSteps ?? 0, total: execution.totalSteps } : null;
  return <View testID="account-closing-screen" accessibilityViewIsModal style={[s.screen, { paddingTop: insets.top }]}>
    <ScrollView contentContainerStyle={[s.scroll, { paddingBottom: Math.max(layout.zone, insets.bottom + sys.space.base) }]}>
      <View style={s.column}>
        <View style={s.well} accessible={false} importantForAccessibility="no-hide-descendants">
          {/* The closure flow's own pictures (ClosurePresentation): a clock while it runs, a quiet check once closed. */}
          <FactArt kind={closed ? 'check' : 'clock'} size={48} muted={closed} />
        </View>
        <T accessibilityRole="header" variant="title">{closed ? accountClosingCopy.closedTitle : accountClosingCopy.title}</T>
        <View accessibilityLiveRegion="polite" style={s.status}>
          <T variant="copy">{closed ? accountClosingCopy.closedBody : accountClosingCopy.body}</T>
          {steps ? <T variant="meta" tone="muted">{accountClosingCopy.steps(steps.done, steps.total)}</T> : null}
          {closed && execution?.closedAt ? <T variant="meta" tone="muted">{accountClosingCopy.closedAt(execution.closedAt)}</T> : null}
          {!closed ? <T variant="meta" tone="muted">{accountClosingCopy.unavailable}</T> : null}
        </View>
        {message ? <T accessibilityRole="alert" variant="note" tone="danger">{message}</T> : null}
        <View style={s.actions}>
          {closed ? <PrimaryButton title={accountClosingCopy.signOut} busy={working === 'signOut'} disabled={busy} onPress={onSignOut} />
            : <>
              <PrimaryButton title={accountClosingCopy.check} busy={working === 'check'} disabled={busy} onPress={onCheck} />
              <LinkAction label={accountClosingCopy.support} disabled={busy} onPress={onSupport} />
              <LinkAction label={accountClosingCopy.signOut} disabled={busy} onPress={onSignOut} />
            </>}
        </View>
      </View>
    </ScrollView>
  </View>;
}

function LinkAction({ label, disabled, onPress }: { label: string; disabled: boolean; onPress: () => void }) {
  return <Press accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={s.link}>
    <T variant="action" tone={disabled ? 'muted' : 'green'}>{label}</T>
  </Press>;
}

// A state of the app, told the way the others are: the 80 well with its picture, the title (21), the sentences 12 apart, and the
// actions 8 apart. The edge is the screen's own (20, it was 22) and the top is 24 under the status bar (it was 28).
const s = StyleSheet.create({
  screen: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: sys.color.surface },
  scroll: { flexGrow: 1, paddingHorizontal: layout.gutter, paddingTop: layout.section, alignItems: 'center' },
  column: { width: '100%', maxWidth: layout.maxWidth, gap: sys.space.base },
  well: { width: 80, height: 80, borderRadius: sys.radius.card, backgroundColor: sys.color.wash, alignItems: 'center', justifyContent: 'center' },
  status: { gap: sys.space.sm },
  actions: { gap: sys.space.sm, marginTop: sys.space.sm },
  link: { minHeight: layout.touch, justifyContent: 'center', alignSelf: 'flex-start' },
});
