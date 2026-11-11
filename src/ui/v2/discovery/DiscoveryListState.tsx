import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { T } from '../../Text';
import { StateView } from '../../system/StateView';
import { sys } from '../../system/tokens';
import { QuietReadState } from '../QuietReadState';
import type { ReadFailureReason } from '../../../data/readFailure';

/**
 * What the list of Zadaci says when it has no cards to show, in one place (composition spec 2026-10-07, T7): reading, not read, nothing here,
 * nothing for these conditions, nothing at all. Every state has a sentence and a way on, with no machine
 * words, no "server". The map and the list always show every published task (owner, 2026-10-07), so an empty list is never about the
 * person's profile in ordinary map/list mode; the explicit 'Za mene' filter ALSO depends on confirmed offered work and matching eligibility.
 *
 * - `loading`   the first read is on its way: say what is being checked without drawing task-shaped placeholders.
 * - `error`     the read did not come back: one way on, to try again.
 * - `place`     the map's own area or one point leaves nothing, and the tasks are elsewhere on the map: one move, or one tap, away.
 * - `filtered`  the conditions leave nothing: take them away.
 * - `forMe`     "Za mene" leaves nothing: say what it looks at, and the way back to every task.
 * - `none`      nobody has published a task: read again, or publish one. A full-screen first encounter uses the hero; the map's sheet uses the
 *               compact state so the explanation and next actions fit above the navigation without taking the map away.
 */
export type DiscoveryListStateKind =
  | { kind: 'loading' }
  | { kind: 'error'; onRetry: () => void; errorReason?: ReadFailureReason }
  | { kind: 'place'; point: boolean; onShowAll: () => void }
  | { kind: 'filtered'; remote?: boolean; onClear: () => void }
  | { kind: 'forMe'; onShowAll: () => void; onWorkProfile?: () => void }
  | { kind: 'none'; onRefresh: () => void; onNew?: () => void };

export const LIST_STATE_WORDS = {
  loading: 'Učitavamo zadatke…',
  error: 'Ne možemo da učitamo zadatke',
  errorBody: 'Zadaci trenutno nisu dostupni. Pokušajte ponovo za trenutak.',
  retry: 'Pokušajte ponovo',
  showAll: 'Prikaži sve zadatke',
  pointTitle: 'Nema zadataka na ovom mestu', pointBody: 'Pomerite mapu ili prikažite sve zadatke.',
  areaTitle: 'Nema zadataka u ovoj oblasti', areaBody: 'Umanjite mapu ili je pomerite da vidite zadatke u okolini.',
  filteredTitle: 'Nema zadataka u ovom prikazu', filteredBody: 'Nijedan zadatak ne odgovara ovim uslovima.',
  remoteTitle: 'Nema zadataka na daljinu', remoteBody: 'Nijedan zadatak na daljinu ne odgovara ovim uslovima.',
  forMeTitle: 'Za sada nema zadataka za Vas', forMeBody: 'Gledamo potvrđene usluge koje nudite, područje i dostupnost. Ako ste upravo podesili profil, proverite da li su Vaše usluge sačuvane i potvrđene.',
  forMeEdit: 'Otvorite radni profil',
  noneTitle: 'Još niko nije tražio pomoć', noneBody: 'Čim neko objavi zadatak, pojaviće se ovde i na mapi.',
  refresh: 'Osvežite', publish: 'Objavite zadatak',
} as const;

const ERROR_BODY: Readonly<Record<ReadFailureReason, string>> = {
  AUTH_REQUIRED: 'Vaša prijava nije potvrđena. Pokušajte ponovo; ako se problem nastavi, prijavite se ponovo.',
  FORBIDDEN: 'Ovaj prikaz trenutno nije dostupan Vašem nalogu. Pristup možete ponovo proveriti.',
  CONTRACT: 'Zadaci trenutno ne mogu da se prikažu. Pokušajte ponovo za trenutak.',
  NETWORK: 'Veza nije uspostavljena. Proverite internet vezu i pokušajte ponovo.',
  TIMEOUT: 'Učitavanje traje duže nego što je očekivano. Pokušajte ponovo.',
  UNAVAILABLE: LIST_STATE_WORDS.errorBody,
};

export function DiscoveryListState({ state, clearAllLabel, compact = false }: {
  state: DiscoveryListStateKind;
  /** The one label of "take every condition away", shared with the search panel's foot. */
  clearAllLabel: string;
  compact?: boolean;
}) {
  const w = LIST_STATE_WORDS;
  switch (state.kind) {
    case 'loading': return compact ? <View testID="discovery-list-reading" accessibilityLiveRegion="polite" style={s.compactRead}>
      <ActivityIndicator size="small" color={sys.color.green} accessible={false} />
      <T variant="note" tone="muted" style={s.readText}>{w.loading}</T>
    </View> : <QuietReadState art="tasks" title={w.loading} body="Proveravamo zadatke u ovom prikazu." />;
    case 'error': return <StateView compact={compact} kind="error" art="tasks" title={w.error}
      body={state.errorReason && Object.prototype.hasOwnProperty.call(ERROR_BODY, state.errorReason) ? ERROR_BODY[state.errorReason] : w.errorBody}
      primary={{ label: w.retry, onPress: state.onRetry }} />;
    case 'place': return <StateView compact={compact} art="map" title={state.point ? w.pointTitle : w.areaTitle} body={state.point ? w.pointBody : w.areaBody}
      primary={{ label: w.showAll, onPress: state.onShowAll }} />;
    case 'filtered': return <StateView compact={compact} art={state.remote ? 'remote' : 'map'}
      title={state.remote ? w.remoteTitle : w.filteredTitle} body={state.remote ? w.remoteBody : w.filteredBody}
      primary={{ label: clearAllLabel, onPress: state.onClear }} />;
    case 'forMe': return <StateView compact={compact} art="tasks" title={w.forMeTitle} body={w.forMeBody}
      primary={{ label: w.showAll, onPress: state.onShowAll }}
      quiet={state.onWorkProfile ? { label: w.forMeEdit, onPress: state.onWorkProfile } : undefined} />;
    case 'none': return <StateView compact={compact} hero={!compact} art={compact ? null : 'map'} title={w.noneTitle} body={w.noneBody} primary={{ label: w.refresh, onPress: state.onRefresh }}
      quiet={state.onNew ? { label: w.publish, onPress: state.onNew } : undefined} />;
  }
}

const s = StyleSheet.create({
  compactRead: { minHeight: 88, paddingVertical: sys.space.base, alignItems: 'center', justifyContent: 'center', gap: sys.space.sm },
  readText: { textAlign: 'center' },
});
