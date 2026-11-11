import type { Ishod } from './ports';

// Transitional adapters still used by current screens share a strict public
// failure boundary. Only documented symbolic names may leave the adapter.
const COPY: Readonly<Record<string, string>> = Object.freeze({
  AUTH_REQUIRED: 'Prijavite se da biste nastavili.',
  NOT_OWNER: 'Ova radnja nije dostupna na ovom nalogu.',
  NOT_WORKER: 'Ovu radnju može da izvrši samo pomagač iz ovog Dogovora.',
  NOT_PARTY: 'Ova radnja je dostupna samo učesnicima Dogovora.',
  FORBIDDEN: 'Ova radnja nije dostupna na ovom nalogu.',
  AGREEMENT_NOT_FOUND: 'Dogovor nije dostupan.',
  AGREEMENT_NOT_ACTIVE: 'Dogovor više nije aktivan. Osvežite prikaz.',
  CHAT_NOT_AVAILABLE: 'Poruke trenutno nisu dostupne u ovom Dogovoru.',
  STALE_VERSION: 'Podaci su izmenjeni. Učitajte aktuelno stanje.',
  PROPOSAL_CLOSED: 'Predlog više ne čeka odgovor. Osvežite Dogovor.',
  VERSION_MISMATCH: 'Podaci su izmenjeni. Učitajte aktuelno stanje.',
  NEED_VERSION_MISMATCH: 'Zadatak je izmenjen. Pregledajte važeće uslove.',
  RESPONSE_VERSION_MISMATCH: 'Prijava je izmenjena. Učitajte njenu novu verziju.',
  STALE_REVIEW_REQUIRED: 'Zadatak je izmenjen. Pregledajte važeće uslove.',
  RESPONSE_NOT_OWNED: 'Ova prijava nije dostupna na ovom nalogu.',
  RESPONSE_NOT_WITHDRAWABLE: 'Prijavu sada nije moguće povući. Proverite aktuelno stanje.',
  RESPONSE_NOT_AWAITING_REVIEW: 'Prijava više ne čeka ovu proveru. Učitajte aktuelno stanje.',
  RESPONSE_ALREADY_CURRENT: 'Prijava je već usklađena. Učitajte aktuelno stanje.',
  RESPONSE_ALREADY_SELECTED: 'Prijava je već izabrana. Otvorite Dogovor.',
  APPLICATION_NOT_FOUND: 'Prijava nije dostupna.',
  RESPONSE_NOT_FOUND: 'Prijava nije dostupna.',
  NEED_NOT_FOUND: 'Zadatak nije dostupan.',
  NEED_NOT_OPEN: 'Zadatak više ne prima prijave.',
  NEED_CLOSED: 'Zadatak je zatvoren.',
  INVALID_PRICE: 'Proveri unetu cenu.',
  FIXED_PRICE_MISMATCH: 'Cena prijave mora da prati cenu i obračun iz zadatka. Izmeni prijavu prema aktuelnim uslovima.',
  FIXED_PRICE_NOT_READY: 'Cena zadatka trenutno nije spremna. Ponovo otvori zadatak.',
  TOTAL_PRICE_REQUIRES_ALL_SLOTS: 'Cena važi za ceo zadatak, pa prijava mora da pokrije sva mesta.',
  UNKNOWN_PRICE_BASIS: 'Način obračuna cene nije podržan u ovoj verziji aplikacije.',
  PROFILE_NOT_OWNED_BY_ACCOUNT: 'Ponovo otvori svoj radni profil pre prijave.',
  WORKER_PROFILE_NOT_READY: 'Dopuni radni profil pre ponovne potvrde prijave.',
  WORKER_NOT_ELIGIBLE: 'Radni profil ili dostupnost ne ispunjavaju aktuelne uslove zadatka.',
  TEAM_CAPACITY_EXCEEDED: 'Broj ljudi u prijavi premašuje kapacitet tvog radnog profila.',
  NEED_FULL: 'Sva mesta na ovom zadatku su popunjena.',
  NEED_REMAINING_CAPACITY_EXCEEDED: 'Broj ljudi premašuje preostala mesta na zadatku.',
  RESPONSE_WINDOW_EXPIRED: 'Rok za prijave je istekao.',
  NEED_EXECUTION_WINDOW_EXPIRED: 'Vreme za ovaj zadatak je prošlo. Nove prijave i izbor više nisu dostupni.',
  INVALID_PROPOSED_INTERVAL: 'Navedi početak i kraj termina; kraj mora biti posle početka.',
  AGREEMENT_CALENDAR_INTERVAL_INVALID: 'Proveri tačan početak i kraj predloženog termina.',
  NEED_FIXED_INTERVAL_INVALID: 'Termin zadatka nije potpun. Ponovo otvori zadatak.',
  IDEMPOTENCY_KEY_REUSED: 'Ovaj zahtev je već vezan za drugu ponudu. Proveri sačuvano stanje.',
  INVALID_COVERED_SLOTS: 'Proveri broj ljudi u prijavi.',
  INVALID_PROPOSED_WINDOW: 'Proveri početak i kraj ponuđenog termina.',
  SCOPE_NOTE_TOO_LONG: 'Napomena je predugačka. Skrati je pre slanja.',
  // Deep read 8.4: no screen can add a number yet, so the sentence must not send the person looking for one.
  PHONE_NOT_SET: 'Na tvom nalogu nema broja telefona, a upis broja još nije moguć u aplikaciji. Kontakt dogovori kroz poruke.',
  NO_ACTIVE_GRANT: 'Dozvola za prikaz više nije aktivna. Osveži Dogovor.',
  GRANT_NOT_OWNABLE: 'Podatak može da podeli samo njegov vlasnik.',
  GRANT_NOT_TO_COUNTERPARTY: 'Dozvola ne pripada drugom učesniku Dogovora.',
  REQUESTER_PROFILE_REQUIRED: 'Potreban je profil za objavu zadataka.',
  POLICY_BUNDLE_NOT_READY: 'Objava trenutno nije dostupna.',
  PACKAGE_4_NOT_READY: 'Objava trenutno nije dostupna.',
  AI_PUBLISH_BLOCKED: 'Objava trenutno nije dozvoljena.',
  AI_FACT_REVISION_NOT_READY: 'Učitaj aktuelni pregled pre izmene.',
  FACT_NOT_FOUND: 'Podatak više nije dostupan. Učitaj pregled ponovo.',
  FACT_SUPERSEDED: 'Podatak je izmenjen. Učitaj pregled ponovo.',
});

/** A refusal the server answered for a known reason: its sentence is the outcome, not an unknown one. */
export function knownLegacyRefusal(kod: string): boolean {
  return Object.prototype.hasOwnProperty.call(COPY, kod);
}

export function legacyRpcFailure<T>(error: unknown, fallbackCode: string, fallbackMessage: string): Ishod<T> {
  let name: unknown;
  try { name = error && typeof error === 'object' ? (error as { message?: unknown }).message : undefined; }
  catch { /* An opaque error is still an unconfirmed outcome. */ }
  if (typeof name === 'string' && Object.prototype.hasOwnProperty.call(COPY, name)) {
    return { ok: false, kod: name, poruka: COPY[name] };
  }
  // SQLSTATE, arbitrary message/details/hint, URLs and provider bodies are not
  // UI copy or public error codes. The supplied fallbacks are source constants.
  return { ok: false, kod: fallbackCode, poruka: fallbackMessage };
}
