import type { AiHistoryPurpose, AiHistoryRow } from '../../data/aiHistoryClientService';
import { sesijaSada } from '../../store/sesija';

export function historyPurposeLabel(purpose: AiHistoryPurpose): string {
  return purpose === 'NEED_INTAKE' ? 'Razgovori o zadacima' : 'Razgovori o radnom profilu';
}

export function historyStatusLabel(purpose: AiHistoryPurpose, row: AiHistoryRow): string {
  if (row.status === 'ABANDONED') return 'Razgovor napušten';
  if (row.status === 'COMPLETED') return purpose === 'PROFILE' && row.hasSavedProfile
    ? 'Profil sačuvan' : 'Razgovor završen';
  return purpose === 'PROFILE' ? 'Nacrt radnog profila'
    : row.titleSource === 'LINKED_TASK_TITLE' ? 'Izmena zadatka' : 'Započeti razgovor';
}

export function historyActionLabel(purpose: AiHistoryPurpose, row: AiHistoryRow): string | null {
  if (row.status === 'OPEN') {
    if (!row.canContinue) return null;
    return purpose === 'NEED_INTAKE' && row.titleSource === 'LINKED_TASK_TITLE' ? 'Nastavi izmenu' : 'Nastavi';
  }
  return row.canRead ? 'Pročitaj razgovor' : null;
}

export function historyDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('sr-Latn-RS', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return iso.slice(0, 10); }
}

/** A closed route is entered only from a server-admitted H1 row in this account generation.
 * H2 separately verifies ownership and closure on every page. Deep links without this admission
 * return to the list instead of guessing a conversation's visibility from its UUID.
 * The DEV H1 forward migration advertises canRead for eligible closed rows after H2 readback.
 * The client decoder admits that boolean only for closed rows; OPEN remains editor-only. */
type ClosedTicket = Readonly<{ accountId: string; accountRevision: number; purpose: AiHistoryPurpose; row: AiHistoryRow }>;
let closedTicket: ClosedTicket | null = null;

export function admitClosedHistory(purpose: AiHistoryPurpose, row: AiHistoryRow): boolean {
  const session = sesijaSada();
  if (!session.user?.id || row.status === 'OPEN' || !Boolean(row.canRead)) return false;
  closedTicket = { accountId: session.user.id, accountRevision: session.accountRevision, purpose, row };
  return true;
}

export function admittedClosedHistory(purpose: AiHistoryPurpose, conversationId: string): AiHistoryRow | null {
  const session = sesijaSada(), ticket = closedTicket;
  if (!ticket || ticket.accountId !== session.user?.id || ticket.accountRevision !== session.accountRevision
    || ticket.purpose !== purpose || ticket.row.conversationId !== conversationId
    || ticket.row.status === 'OPEN' || !Boolean(ticket.row.canRead)) return null;
  return ticket.row;
}

export function retireClosedHistory(): void { closedTicket = null; }
