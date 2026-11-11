import type { NeedSearchState, ReopenSearchCommand, ReopenSearchReceipt, ReopenSearchReadback } from '../contracts/needSearchRecovery';
import type { Ishod } from './ports';
import { decodeNeedSearchState, decodeReopenSearchReadback, decodeReopenSearchReceipt, reopenSearchArgs,
  validReopenSearchCommand } from './needSearchRecoveryContract';
import { failure, readReceipt, uuid, type ReceiptAccount } from './serverReceipt';

/** EX-06E R3 is applied on canonical DEV. Production must receive the same verified migration before release. */
export const SEARCH_RECOVERY_ERRORS: Readonly<Record<string, string>> = {
  AUTH_REQUIRED: 'Prijavite se da nastavite.',
  NEED_NOT_FOUND: 'Zadatak nije dostupan.',
  NEED_NOT_OWNED: 'Ovo nije Vaš zadatak.',
  ACCOUNT_CLOSING: 'Potraga ne može da se otvori dok je zatvaranje naloga u toku.',
  STALE_REVIEW_REQUIRED: 'Zadatak je promenjen. Pregledajte aktuelno stanje.',
  STALE_SEARCH_STATE: 'Odluka o potrazi je u međuvremenu promenjena. Pregledajte aktuelno stanje.',
  NO_REMAINING_SEARCH: 'Sva potrebna mesta su već dogovorena.',
  REMAINING_SEARCH_ALREADY_OPEN: 'Potraga je već otvorena. Osvežite prikaz.',
  NEED_REMAINING_SEARCH_NOT_REOPENABLE: 'Ovaj zadatak više ne može da nastavi potragu.',
  REMAINING_SEARCH_REOPEN_WINDOW_CLOSED: 'Vreme za ovu potragu je prošlo. Proverite zadatak i svoje Dogovore.',
  IDEMPOTENCY_KEY_REUSED: 'Zahtev ne odgovara ranijoj radnji. Pregledajte aktuelno stanje.',
  SEARCH_CLOSURE_WITNESS_REQUIRED: 'Ponovo učitajte stanje potrage.',
  SEARCH_RECEIPT_INPUT_INVALID: 'Prethodni zahtev nije potpun. Osvežite prikaz.',
  CLIENT_REQUEST_ID_INVALID: 'Zahtev nije ispravan. Ponovo otvorite zadatak.',
  NEED_ID_REVISION_REQUIRED: 'Ponovo otvorite zadatak.',
};

export const knownSearchRecoveryRefusal = (code: string) =>
  Object.prototype.hasOwnProperty.call(SEARCH_RECOVERY_ERRORS, code);

const invalid = () => failure('SEARCH_RECOVERY_INVALID_INPUT', 'Ponovo otvori zadatak i pregledaj stanje potrage.');

export const needSearchRecoveryClientService = {
  read(needId: string, account: ReceiptAccount): Promise<Ishod<NeedSearchState>> {
    if (!uuid(needId)) return Promise.resolve(invalid());
    return readReceipt({
      account,
      rpc: 'rpc_get_need_search_state',
      args: { p_need_id: needId },
      decode: raw => decodeNeedSearchState(raw, needId),
      errors: SEARCH_RECOVERY_ERRORS,
      fallback: 'SEARCH_STATE_UNAVAILABLE',
      invalid: 'SEARCH_STATE_INVALID_RESPONSE',
      readTransportUnavailable: 'SEARCH_STATE_TRANSPORT_UNAVAILABLE',
    });
  },

  readReceipt(command: ReopenSearchCommand, account: ReceiptAccount): Promise<Ishod<ReopenSearchReadback>> {
    if (!validReopenSearchCommand(command)) return Promise.resolve(invalid());
    return readReceipt({
      account,
      rpc: 'rpc_get_reopen_remaining_search_receipt',
      args: reopenSearchArgs(command),
      decode: raw => decodeReopenSearchReadback(raw, command),
      errors: SEARCH_RECOVERY_ERRORS,
      fallback: 'SEARCH_RECEIPT_UNAVAILABLE',
      invalid: 'SEARCH_RECEIPT_INVALID_RESPONSE',
      readTransportUnavailable: 'SEARCH_RECEIPT_TRANSPORT_UNAVAILABLE',
    });
  },

  reopen(command: ReopenSearchCommand, account: ReceiptAccount): Promise<Ishod<ReopenSearchReceipt>> {
    if (!validReopenSearchCommand(command)) return Promise.resolve(invalid());
    return readReceipt({
      account,
      rpc: 'rpc_reopen_remaining_search',
      args: reopenSearchArgs(command),
      write: true,
      decode: raw => decodeReopenSearchReceipt(raw, command),
      errors: SEARCH_RECOVERY_ERRORS,
      fallback: 'SEARCH_REOPEN_UNCONFIRMED',
      invalid: 'SEARCH_REOPEN_INVALID_RESPONSE',
    });
  },
};
