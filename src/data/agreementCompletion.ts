import type { Ishod } from './ports';

/** Known refusals of rpc_mark_work_done and rpc_confirm_completion (P0E and the
 * pre-V3 pending-change guard). Only these symbolic names become public codes and
 * copy; SQLSTATE, details, hints and provider text never leave the adapter. This
 * module stays dependency-free so the screen can own denial copy without loading
 * the Supabase client. */
export const completionErrors: Readonly<Record<string, string>> = Object.freeze({
  AUTH_REQUIRED: 'Prijavi se da nastaviš.',
  ACCOUNT_CLOSING: 'Radnja je zaustavljena zbog postupka zatvaranja naloga. Osveži prikaz.',
  INTERACTION_BLOCKED: 'Ova radnja nije dostupna zbog blokiranja između učesnika. Za pomoć otvori podršku.',
  AGREEMENT_NOT_FOUND: 'Dogovor nije dostupan.',
  NEED_NOT_FOUND: 'Zadatak ovog Dogovora nije dostupan.',
  AGREEMENT_NEED_MISMATCH: 'Dogovor nije dostupan. Osveži prikaz.',
  EXECUTION_NOT_FOUND: 'Stanje izvršenja Dogovora nije dostupno. Osveži prikaz.',
  EXECUTION_VERSION_MISMATCH: 'Dogovor je promenjen. Osveži važeće uslove pre završetka.',
  ONLY_REQUESTER_CAN_CONFIRM_COMPLETION: 'Završetak potvrđuje osoba koja je objavila zadatak.',
  ONLY_WORKER_CAN_MARK_DONE: 'Završetak može da označi samo osoba koja radi zadatak.',
  AGREEMENT_CANCELLED: 'Dogovor je otkazan. Završetak više nije moguć.',
  AGREEMENT_ALREADY_COMPLETED: 'Dogovor je već završen. Osveži njegov status.',
  AGREEMENT_NOT_ACTIVE: 'Dogovor više nije aktivan. Osveži njegov status.',
  COMPLETION_NOT_CONFIRMABLE: 'Dogovor trenutno nije u stanju za potvrdu završetka. Osveži njegov status.',
  EXECUTION_NOT_MARKABLE_DONE: 'Završetak trenutno nije moguće označiti. Osveži status Dogovora.',
  COMPLETION_STATE_CORRUPT: 'Stanje završetka nije čitljivo. Osveži status Dogovora.',
  COMPLETION_TRANSITION_RACE: 'Dogovor se upravo promenio. Osveži status pre novog pokušaja.',
  AGREEMENT_CHANGE_PENDING: 'Najpre odgovori na postojeći predlog izmene.',
});

/** Screen-owned copy for a known completion denial; any other code stays generic. */
export function completionDenial(kod: string): string | null {
  return Object.prototype.hasOwnProperty.call(completionErrors, kod) ? completionErrors[kod] : null;
}

/** Legacy-shaped adapters (the worker mark) surface the same known denials. */
export function completionFailure<T>(error: unknown): Ishod<T> | null {
  const name = error !== null && typeof error === 'object' ? (error as { message?: unknown }).message : undefined;
  return typeof name === 'string' && Object.prototype.hasOwnProperty.call(completionErrors, name)
    ? { ok: false, kod: name, poruka: completionErrors[name] } : null;
}
