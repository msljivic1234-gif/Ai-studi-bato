// ONE source for how many people a task still needs, with the verb that agrees with the number ("Nedostaju još 2 osobe."): the own-task page
// says it too (plan 3.5), and the two must never say it two ways. It was "Nedostaje još 2 osobe" here.
import { missingPeople } from '../v2/ownTaskOverview';
import type { SearchRecoveryView } from './NeedSearchRecoveryController';

export type SearchRecoveryAction = 'REOPEN' | 'CHECK' | 'RETRY' | 'ACK' | 'AGREEMENTS';
export type SearchRecoveryCopy = {
  title: string;
  detail: string;
  art: 'users' | 'clock' | 'check' | 'info';
  quiet: boolean;
  primary: { label: string; action: SearchRecoveryAction; disabled?: boolean } | null;
  secondary?: { label: string; action: SearchRecoveryAction };
};

export function needSearchRecoveryCopy(view: SearchRecoveryView): SearchRecoveryCopy | null {
  if (view.phase === 'LOADING') return view.command
    ? { title: 'Proveravamo da li je uspelo', detail: 'Ništa se ne šalje ponovo.', art: 'info', quiet: true,
      primary: { label: 'Proveravamo…', action: 'CHECK', disabled: true } }
    : null;
  if (view.phase === 'SENDING') return {
    title: 'Otvaramo potragu', detail: 'Proveravamo potvrdu i trenutno stanje zadatka.', art: 'users', quiet: false,
    primary: { label: 'Proveravamo potvrdu…', action: 'CHECK', disabled: true },
  };
  if (view.phase === 'UNKNOWN') return {
    title: 'Da li je potraga otvorena?',
    detail: 'Ne znamo da li je potraga ponovo otvorena. Provera ništa ne šalje ponovo.',
    art: 'info',
    quiet: true,
    primary: { label: 'Proveri da li je uspelo', action: 'CHECK' },
    ...(view.retryAllowed ? { secondary: { label: 'Pošalji ponovo', action: 'RETRY' as const } } : {}),
  };
  if (view.phase === 'ERROR') return {
    title: 'Proveri stanje potrage',
    detail: 'Podaci trenutno nisu dostupni. Proveri vezu pa pokušaj ponovo.',
    art: 'info',
    quiet: true,
    primary: { label: 'Pokušaj ponovo', action: 'CHECK' },
  };
  if (view.phase === 'RESOLVED' && view.result === 'REFUSED') return {
    title: 'Potraga nije ponovo otvorena',
    detail: view.error ?? 'Pregledaj trenutno stanje pre sledeće radnje.',
    art: 'info',
    quiet: true,
    primary: { label: 'Prikaži trenutno stanje', action: 'ACK' },
  };

  const state = view.snapshot;
  if (!state) return null;
  if (view.phase === 'RESOLVED') {
    const currentlyOpen = state.searchAuthority === 'OPEN' && state.searchTimeAdmitted
      && ['PUBLISHED', 'SELECTION'].includes(state.status) && state.missingSlots > 0;
    return {
      title: currentlyOpen ? 'Potraga je ponovo otvorena' : 'Stanje potrage je promenjeno',
      detail: currentlyOpen ? missingPeople(state.missingSlots)
        : state.searchAuthority === 'CLOSED'
          ? 'Potraga je sada zatvorena, iako je ranije bila ponovo otvorena.'
          : 'Pregledaj trenutni zadatak i svoje Dogovore.',
      art: currentlyOpen ? 'check' : 'users',
      quiet: !currentlyOpen,
      primary: { label: 'Prikaži trenutno stanje', action: 'ACK' },
    };
  }

  if (state.reason === 'TASK_NOT_OPEN') return null;
  if (state.reason === 'ACCOUNT_CLOSING') return {
    title: 'Potraga nije dostupna',
    detail: 'Zatvaranje naloga je u toku. Postojeće Dogovore možete da proverite.',
    art: 'users',
    quiet: true,
    primary: state.activeAgreementCount ? { label: 'Otvori moje Dogovore', action: 'AGREEMENTS' } : null,
  };
  if (state.awaitingConfirmationCount || state.openProblemCount) return {
    title: state.openProblemCount ? 'Dogovor traži Vašu pažnju' : 'Potvrdite završetak zadatka',
    detail: state.openProblemCount ? 'Prvo proverite prijavljeni problem u Dogovoru.'
      : 'Završetak je označen. Proverite Dogovor pre sledećeg koraka.',
    art: 'users',
    quiet: false,
    primary: { label: 'Otvori moje Dogovore', action: 'AGREEMENTS' },
  };
  if (!state.searchTimeAdmitted) return {
    title: 'Vreme za potragu je prošlo',
    detail: state.activeAgreementCount ? 'Postojeći Dogovori ostaju. Proverite njihove termine i sledeći korak.'
      : 'Proverite zadatak. Novi termin se ne određuje automatski.',
    art: 'clock',
    quiet: true,
    primary: state.agreementCount ? { label: 'Otvori moje Dogovore', action: 'AGREEMENTS' } : null,
  };
  if (state.searchAuthority === 'CLOSED' && state.missingSlots > 0) return {
    title: 'Potraga je zatvorena',
    detail: missingPeople(state.missingSlots) + ' Ti odlučuješ kada nastavljamo.',
    art: 'users',
    quiet: false,
    primary: state.canReopen ? { label: 'Ponovo traži ljude', action: 'REOPEN', disabled: view.phase === 'REVIEW' } : null,
  };
  // Ordinary OPEN/FULL state already has clear task facts and actions.
  return null;
}
