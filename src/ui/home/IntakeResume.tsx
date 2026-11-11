import { useCallback, useMemo, useRef, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { aiNeedV2Izvor } from '../../data';
import { OPEN_INTAKE_PAGE_SIZE, readIntakeLifecycle, type OpenIntake, type OpenIntakePage } from '../../data/aiOpenIntakes';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { sesijaSada, useSesija } from '../../store/sesija';
import { vreme } from '../../lib/vreme';
import { ProductSheet } from '../product/ProductSheet';
import { FactArt } from '../system/FactArt';
import { ListRow } from '../system/ListRow';
import { ChromeIconButton } from '../system/ScreenChrome';
import { Section } from '../system/Section';
import { useConfirmSheet } from '../system/ConfirmSheet';
import { T } from '../Text';
import { V2Action } from '../v2/V2Action';

const readFirstPage = () => aiNeedV2Izvor.listOpenIntakes();
type Removal = { item: OpenIntake; phase: 'unknown' | 'confirmed' | 'open'; message: string };
const hasUnresolvedRemoval = (removals: Map<string, Removal>) => [...removals.values()].some(value => value.phase !== 'open');
/** Keep recovery rows visible after a refresh/return, without exceeding a page. */
function withRemovals(page: OpenIntakePage, removals: Map<string, Removal>): OpenIntakePage {
  const extras = [...removals.values()].map(value => value.item).filter(item => !page.rows.some(row => row.id === item.id));
  if (!extras.length) return page;
  const kept = page.rows.slice(0, Math.max(0, OPEN_INTAKE_PAGE_SIZE - extras.length));
  return { rows: [...extras, ...kept], next: kept.length < page.rows.length ? kept.at(-1) ?? page.next : page.next };
}

/** A saved conversation is not yet a task. This independent read must never delay Home's real work. */
export function IntakeResume({ onOpen }: { onOpen: (id: string) => void }) {
  const resource = useFocusedResource(readFirstPage);
  const { user, accountRevision } = useSesija();
  // Retain an uncertain command across closing/reopening the sheet or backgrounding,
  // but never across account/session scope. No message content is retained here.
  const removals = useMemo(() => new Map<string, Removal>(), [user?.id, accountRevision]);
  const focus = useRef<object | null>(null), pending = useRef<string | null>(null);
  const [token, setToken] = useState<object | null>(null);
  const [sheet, setSheet] = useState<object | null>(null), sheetOwner = useRef<object | null>(null);
  useFocusEffect(useCallback(() => {
    const activate = () => { const owner = {}; focus.current = owner; setToken(owner); };
    activate();
    const retire = () => { focus.current = null; pending.current = null; sheetOwner.current = null; setSheet(null); };
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') activate();
      else retire();
    });
    return () => { subscription.remove(); retire(); };
  }, [user?.id, accountRevision]));
  const current = () => !!token && focus.current === token && !!user?.id && sesijaSada().user?.id === user.id
    && sesijaSada().accountRevision === accountRevision && AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
  const page = resource.data || removals.size ? withRemovals(resource.data ?? { rows: [], next: null }, removals) : null;
  const unresolvedRemoval = hasUnresolvedRemoval(removals);
  const openSheet = () => { if (current() && !sheetOwner.current) { const owner = {}; sheetOwner.current = owner; setSheet(owner); } };
  const single = page?.rows.length === 1 && !page.next ? page.rows[0] : null;
  const recoveredOpen = !!single && removals.get(single.id)?.phase === 'open';
  if (AppState.currentState === 'background' || AppState.currentState === 'inactive' || (!page?.rows.length && !resource.error)) return null;
  return <>
    <ListRow leading={<FactArt kind="chat" size={32} />} title={single?.title ?? 'Nastavi razgovor o zadatku'} last accessibilityLabel={single?.title ? `Nastavi razgovor: ${single.title}` : 'Nastavi razgovor o zadatku'}
      accessibilityHint={unresolvedRemoval ? 'Proveri stanje prethodnog napuštanja.' : recoveredOpen && resource.error ? 'Razgovor je potvrđen otvoren, ali lista trenutno nije dostupna.'
        : resource.error ? 'Razgovori nisu učitani. Pokušaj ponovo.'
        : page?.rows.length === 1 && !page.next ? `Otvara razgovor započet ${vreme(page.rows[0].createdAt)}.` : 'Otvara listu započetih razgovora.'}
      subtitle={unresolvedRemoval ? 'Prethodno napuštanje čeka proveru.' : recoveredOpen && resource.error ? 'Razgovor je otvoren · lista trenutno nije dostupna.'
        : resource.error ? 'Razgovori nisu učitani. Dodirni da pokušaš ponovo.'
        : page?.rows.length === 1 && !page.next ? `Započeto ${vreme(page.rows[0].createdAt)}` : 'Izaberi započeti razgovor.'}
      onPress={() => {
        if (!current()) return;
        if (unresolvedRemoval) { openSheet(); return; }
        if (resource.error && !recoveredOpen) { void resource.refresh(true); return; }
        if (page?.rows.length === 1 && !page.next) onOpen(page.rows[0].id);
        else openSheet();
      }} />
    {single && (!resource.error || recoveredOpen) ? <V2Action label="Upravljaj započetim razgovorima" kind="quiet" compact onPress={openSheet} /> : null}
    {sheet && page ? <ProductSheet title="Započeti razgovori" backdropHint="Zatvara listu razgovora." onClose={() => {
      if (sheetOwner.current !== sheet) return;
      const selected = pending.current; pending.current = null; sheetOwner.current = null; setSheet(null);
      if (selected && current()) onOpen(selected);
    }}>{dismiss => <IntakePages initial={page} current={current} removals={removals} onChanged={() => { if (current()) void resource.refresh(true); }} onSelect={id => {
      if (!current() || sheetOwner.current !== sheet || pending.current) return;
      pending.current = id; dismiss();
    }} />}</ProductSheet> : null}
  </>;
}

/** At most twenty rows mounted, with keyset paging. A failed page keeps the preceding rows and its retry. */
function IntakePages({ initial, current, onSelect, removals, onChanged }: {
  initial: OpenIntakePage; current: () => boolean; onSelect: (id: string) => void;
  removals: Map<string, Removal>; onChanged: () => void;
}) {
  const [page, setPage] = useState(initial), [cursors, setCursors] = useState<(OpenIntake | null)[]>([null]);
  const [busy, setBusy] = useState(false), [failed, setFailed] = useState(false);
  const [, changed] = useState(0), confirm = useConfirmSheet();
  const confirmation = useRef<object | null>(null);
  const flight = useRef<object | null>(null), alive = useRef(false), pageOwner = useRef<object>({});
  const pageToken = pageOwner.current;
  const visible = withRemovals(page, removals);
  const usable = () => current() && alive.current && pageOwner.current === pageToken;
  useFocusEffect(useCallback(() => {
    alive.current = true;
    return () => { alive.current = false; flight.current = null; };
  }, []));
  const move = async (nextCursors: (OpenIntake | null)[]) => {
    if (!current() || !alive.current || pageOwner.current !== pageToken || flight.current) return;
    const request = {}; flight.current = request; setBusy(true); setFailed(false);
    try {
      const next = await aiNeedV2Izvor.listOpenIntakes(nextCursors[nextCursors.length - 1]);
      if (!alive.current || flight.current !== request || !current()) return;
      pageOwner.current = {}; setPage(next); setCursors(nextCursors);
    } catch {
      if (alive.current && flight.current === request && current()) setFailed(true);
    } finally {
      if (alive.current && flight.current === request) { flight.current = null; setBusy(false); }
    }
  };
  const reconcile = async (item: OpenIntake, write: boolean) => {
    if (!usable() || flight.current || (write && hasUnresolvedRemoval(removals))) return;
    const request = {}; flight.current = request; setBusy(true); setFailed(false);
    const owns = () => usable() && flight.current === request;
    try {
      // Fresh metadata prevents a stale Home row from abandoning a now-bound or
      // already finished conversation. This read contains no messages/facts.
      let state = await readIntakeLifecycle(item.id);
      if (!owns()) return;
      if (write && state.status === 'OPEN' && state.boundNeedId === null) {
        removals.set(item.id, { item, phase: 'unknown', message: 'Ishod napuštanja nije potvrđen. Proveri stanje pre nastavka.' }); changed(n => n + 1);
        const result = await aiNeedV2Izvor.abandonConversation(item.id);
        if (!owns()) return;
        if (!result.ok) return; // A receipt error never authorizes a second write.
        state = await readIntakeLifecycle(item.id);
        if (!owns()) return;
      }
      if (state.status === 'OPEN' && state.boundNeedId === null) {
        if (write) {
          removals.set(item.id, { item, phase: 'unknown', message: 'Napuštanje još nije potvrđeno. Proveri stanje pre nastavka.' });
        } else {
          // This is an explicit read, not a write replay. A future removal needs
          // another user confirmation; the same callback cannot do both.
          // The lifecycle read is authoritative even if the paged list is stale or
          // the row has moved off its first page. Keep that proven OPEN row reachable.
          removals.set(item.id, { item, phase: 'open', message: '' });
        }
        changed(n => n + 1); return;
      }
      removals.set(item.id, { item, phase: 'confirmed', message: state.status === 'ABANDONED'
        ? 'Razgovor je napušten. Podaci nisu trajno obrisani. Osvežavamo listu.'
        : 'Ovaj razgovor više nije otvoren nacrt. Osvežavamo listu.' }); changed(n => n + 1);
      const next = await aiNeedV2Izvor.listOpenIntakes(cursors[cursors.length - 1]);
      if (!owns()) return;
      // Do not accept a contradictory list as proof that removal completed.
      if (next.rows.some(row => row.id === item.id)) return;
      removals.delete(item.id); pageOwner.current = {}; setPage(next); onChanged();
    } catch {
      if (owns()) {
        const prior = removals.get(item.id);
        if (prior?.phase === 'confirmed') removals.set(item.id, { ...prior, message: 'Razgovor više nije otvoren nacrt, ali lista nije osvežena. Proveri stanje.' });
        else if (!prior) removals.set(item.id, { item, phase: 'unknown', message: 'Stanje razgovora nije učitano. Proveri ponovo; ništa nećemo ponovo poslati.' });
        changed(n => n + 1);
      }
    } finally {
      if (alive.current && flight.current === request) { flight.current = null; setBusy(false); }
    }
  };
  const remove = (item: OpenIntake) => {
    if (!usable() || flight.current || hasUnresolvedRemoval(removals)) return;
    const decision = {}; confirmation.current = decision;
    confirm.ask({ title: 'Napustiti razgovor?',
      message: `Razgovor „${item.title ?? 'Razgovor o zadatku'}” više neće moći da se nastavi. Njegovi podaci se ovim ne brišu trajno.`,
      confirmLabel: 'Napusti razgovor', tone: 'danger',
      onCancel: () => { if (confirmation.current === decision) confirmation.current = null; },
      onConfirm: () => { if (confirmation.current !== decision) return; confirmation.current = null; return reconcile(item, true); } });
  };
  return <Section>
    <T variant="note" tone="muted" style={styles.intro}>Ovde su samo razgovori koje možeš da nastaviš. Napuštanjem nestaju iz ove liste, ali se ne brišu trajno.</T>
    {visible.rows.map(item => <View key={item.id}>
      <View style={styles.conversation}>
        <View style={styles.resumeTarget}>
          <ListRow title={item.title ?? 'Razgovor o zadatku'} subtitle={`Započeto ${vreme(item.createdAt)}`}
            accessibilityLabel={`Nastavi razgovor: ${item.title ?? 'Razgovor o zadatku'}. Započeto ${vreme(item.createdAt)}`}
            disabled={busy || (removals.has(item.id) && removals.get(item.id)?.phase !== 'open')} arrow={false} last
            onPress={() => { if (usable() && !flight.current && (!removals.has(item.id) || removals.get(item.id)?.phase === 'open')) onSelect(item.id); }} />
        </View>
        {(!removals.has(item.id) || removals.get(item.id)?.phase === 'open') ? <ChromeIconButton glyph="close" tone="danger" quiet caption="Napusti"
          label={`Napusti razgovor: ${item.title ?? 'Razgovor o zadatku'}`}
          hint="Otvara potvrdu. Razgovor se ne briše trajno."
          disabled={busy || hasUnresolvedRemoval(removals)} onPress={() => remove(item)} /> : null}
      </View>
      {removals.has(item.id) && removals.get(item.id)?.phase !== 'open' ? <>
        <T variant="note" accessibilityRole="alert">{removals.get(item.id)!.message}</T>
        <V2Action label="Proveri stanje razgovora" kind="quiet" compact disabled={busy} onPress={() => { void reconcile(item, false); }} />
      </> : null}
    </View>)}
    {!visible.rows.length ? <T variant="note">Ovde više nema otvorenih razgovora.</T> : null}
    {failed ? <T variant="note" accessibilityRole="alert">Razgovori nisu učitani. Pokušaj ponovo istim dugmetom.</T> : null}
    {cursors.length > 1 ? <V2Action label="Noviji razgovori" kind="secondary" disabled={busy} onPress={() => { void move(cursors.slice(0, -1)); }} /> : null}
    {visible.next ? <V2Action label="Stariji razgovori" kind="secondary" loading={busy} disabled={busy} onPress={() => { void move([...cursors, visible.next]); }} /> : null}
    {confirm.sheet}
  </Section>;
}

const styles = StyleSheet.create({
  intro: { marginBottom: 12 },
  conversation: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resumeTarget: { flex: 1, minWidth: 0 },
});
