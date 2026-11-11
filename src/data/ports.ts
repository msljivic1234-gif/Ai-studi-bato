/**
 * M01 — portovi.
 *
 * Ekran zove ovo. Ispod može da stoji lažni izvor ili Supabase — ekran ne zna
 * razliku i ne sme da zna. Zamena izvora je zamena jednog fajla.
 *
 * Imena metoda prate stvarne LIVE RPC funkcije CLEAN servera, ne donorska
 * r24/r25 imena koja uzivo ne postoje: rpc_submit_response,
 * rpc_select_response, rpc_propose_agreement_change_v2, ...
 */

import type { ExactLocationReveal, LocationGrantState } from '../contracts/contact';
import type {
  DogovorProjekcija,
  JavniProfilProjekcija,
  MojaPrijavaProjekcija,
  KandidatProjekcija,
  PorukaProjekcija,
  PotrebaProjekcija,
  PrilikaProjekcija,
  RadnikProfilProjekcija,
} from '../contracts/projections';
import type { TaskRelationIndex } from './taskRelation';
import type { HomeAttentionPreview } from './homeSnapshot';
import type { CandidatesPage, CandidatesPageRequest } from './candidatesPage';
import type { OwnApplicationsPage, OwnApplicationsPageRequest } from './ownApplicationsPage';
import type { OwnTasksPage, OwnTasksPageRequest } from './ownTasksPage';

/** Svaka komanda vraća ovo. Nikad goli rezultat. */
export type Ishod<T> =
  | { ok: true; podatak: T }
  | { ok: false; kod: string; poruka: string; naslov?: string };

/** PKG-007: potvrda završetka koju je server sam vratio (`ponovljeno` = idempotentReplay). */
export type PotvrdaZavrsetka = { zavrsenoIso: string; ponovljeno: boolean };

/**
 * Idempotencija nije opcija. Isti key + isti semantički payload vraća isti
 * rezultat; isti key + drugačiji payload server odbija.
 */
export type Idempotentno = { clientRequestId: string };

/* --------------------------------------------------------------- čitanje */

/** One current public Discovery row, never an owner-detail fallback. Null is an admitted empty read. */
export type ExactPublicOpportunityRead = {
  item: (PrilikaProjekcija & { revision: number }) | null;
  asOf: string;
};

export interface PotrebeCitanje {
  /** Account-owned server attention; failure is unavailable, never an empty list. */
  paznjaZaPocetnu(): Promise<HomeAttentionPreview>;
  /** R03 — moje Potrebe. Defaults to urgency enrichment; count-only surfaces may leave it unobserved. */
  mojePotrebe(options?: { includeUrgency?: boolean; signal?: AbortSignal }): Promise<PotrebaProjekcija[]>;
  /** EX-04 S1 (A09) — one keyset page of my own tasks in one of the server's sets. Needs the ex04a server contract: a build flag keeps the screen on `mojePotrebe` until DEV has it. */
  mojePotrebeStrana(request: OwnTasksPageRequest, options?: { includeUrgency?: boolean }): Promise<OwnTasksPage>;
  /** R04 — radni prostor jedne Potrebe. */
  potreba(id: string): Promise<PotrebaProjekcija | null>;
  /** W03 — javno bezbedan skup za Lista | Mapa | Kombinovano. */
  otvorenePrilike(options?: { signal?: AbortSignal }): Promise<PrilikaProjekcija[]>;
  /** At most three public, other-owner tasks accepting applications; not a personal match or a total. */
  prilikeZaPocetnu(options?: { signal?: AbortSignal }): Promise<PrilikaProjekcija[]>;
  /** Exact public landing; requires the separately approved P0 server contract. Errors never become an empty read. */
  otvorenaPrilika(id: string, options?: { signal?: AbortSignal }): Promise<ExactPublicOpportunityRead>;
  /** W04 — dosije jedne Prilike. */
  prilika(id: string): Promise<PrilikaProjekcija | null>;
  /**
   * PKG-023b — šta sam ja zadacima koji su na ekranu, za najviše 100 njih u jednom pozivu.
   * Overlay pored javnog čitanja: odgovara samo pozivaocu i nikada nije deo javnog reda.
   * Neuspeh je UNKNOWN, nikad NONE.
   */
  odnosiPremaZadacima(idovi: readonly string[], options?: { signal?: AbortSignal }): Promise<TaskRelationIndex>;
}

export interface PrijaveCitanje {
  /** R05 — vlasnik kompletne liste prijava i kandidata. */
  prijaveZaPotrebu(potrebaId: string): Promise<KandidatProjekcija[]>;
  /** EX-04 S4 (A11) — one keyset page of the applications to one of my tasks, in the whole-list order. Needs the ex04d server contract: a build flag keeps the screen on `prijaveZaPotrebu` until DEV has it. */
  prijaveZaPotrebuStrana(potrebaId: string, request: CandidatesPageRequest): Promise<CandidatesPage>;
  /** W06 / P0C-03 — kanonska projekcija sopstvenih Prijava. */
  mojePrijave(): Promise<MojaPrijavaProjekcija[]>;
  /** EX-04 S2 (B10) — one keyset page of my own applications in one of the screen's sets, in the whole-list order. Needs the ex04b server contract: a build flag keeps the screen on `mojePrijave` until DEV has it. */
  mojePrijaveStrana(request: OwnApplicationsPageRequest): Promise<OwnApplicationsPage>;
}

export interface DogovoriCitanje {
  /** Defaults to reading my rating state. Non-rating surfaces may skip enrichment; all rows still load. */
  mojiDogovori(options?: { includeRatings?: boolean; signal?: AbortSignal }): Promise<DogovorProjekcija[]>;
  dogovor(id: string): Promise<DogovorProjekcija | null>;
  poruke(dogovorId: string, expectedAccountId?: string): Promise<PorukaProjekcija[]>;
}

/* --------------------------------------------------------------- komande */

export type PodnesiPrijavuKomanda = Idempotentno & {
  potrebaId: string;
  potrebaRevizija: number;
  radnikProfilId: string;
  pokrivenaMesta: number;
  cenaRsd: number;
  predlozeniPocetak: string | null;
  predlozeniKraj: string | null;
  napomena: string | null;
};

/**
 * M02 — atomski tačan izbor.
 *
 * Vezuje tačnu reviziju Potrebe i tačnu verziju/hash Prijave. Ako se bilo
 * šta od toga promenilo otkad je Naručilac gledao, server odbija —
 * to je STALE_REVIEW_REQUIRED, ne tiha izmena.
 *
 * Uspeh atomski pravi CONFIRMED Dogovor. Nema treće potvrde.
 */
export type PovuciPrijavuKomanda = Idempotentno & {
  prijavaId: string;
  potrebaRevizija: number;
  prijavaVerzija: number;
  razlog?: string | null;
};

export type IzborKomanda = Idempotentno & {
  potrebaId: string;
  potrebaRevizija: number;
  prijavaId: string;
  prijavaVerzija: number;
  prijavaHash: string;
  mesta: number;
};

/** M05 — predlog izmene. Prihvatanje odmah aktivira v+1, bez petlje potvrda. */
export type IzmenaKomanda = Idempotentno & {
  dogovorId: string;
  ocekivanaVerzija: number;
  izmena: {
    cenaIznos?: number;
    cenaValuta?: string;
    pocetakIso?: string;
    krajIso?: string;
    obim?: string;
  };
  razlog?: string;
};

export interface Komande {
  /** rpc_submit_response */
  podnesiPrijavu(k: PodnesiPrijavuKomanda): Promise<Ishod<{ prijavaId: string; verzija: number; hash: string; osnovaCene?: 'TOTAL' | 'HOURLY' }>>;

  /** P0C-03 — rpc_withdraw_response; stale-revision odluke ostaju RU-4 authority. */
  povuciPrijavu(k: PovuciPrijavuKomanda): Promise<Ishod<{ stanje: 'WITHDRAWN'; verzija: number }>>;

  /** rpc_select_response — izbor i Dogovor su jedna atomska serverska komanda */
  izaberiPrijavu(k: IzborKomanda): Promise<Ishod<{ dogovorId: string }>>;

  /** rpc_mark_response_viewed */
  oznaciPrijavuVidjenom(prijavaId: string): Promise<Ishod<null>>;

  /** rpc_mark_agreement_messages_read (PKG-050) — a person in the conversation has read its messages, so the
   *  "Nova poruka" events about this one Dogovor settle. Returns how many were unread; throws when unconfirmed. */
  oznaciPorukeProcitanim(dogovorId: string): Promise<number>;

  /** rpc_propose_agreement_change_v2 */
  predloziIzmenu(k: IzmenaKomanda): Promise<Ishod<{ predlogId: string }>>;

  /** rpc_respond_agreement_change */
  odgovoriNaIzmenu(predlogId: string, prihvatam: boolean): Promise<Ishod<null>>;

  /** @deprecated Non-writing compatibility stub; use agreementMessageClientService + a stable clientMessageId. */
  posaljiPoruku(dogovorId: string, telo: string): Promise<Ishod<{ porukaId: string }>>;

  /** M06 — jednostrano otkazivanje. Oslobađa samo tu alokaciju. */
  otkaziDogovor(dogovorId: string, razlog: string): Promise<Ishod<null>>;

  /**
   * M07 — Uskočer označava završetak; otvara serverski prozor od 48h.
   * Nema obaveznih koraka „Krenuo sam" i „Stigao sam" pre ovoga.
   */
  oznaciZavrsetak(dogovorId: string): Promise<Ishod<{ rokPotvrdeIso: string }>>;

  /**
   * M07 — Naručilac potvrđuje. Može i NEZAVISNO, pre nego što Uskočer
   * bilo šta označi — to je legitiman put, ne izuzetak.
   * PKG-007: server vraća terminalnu potvrdu (i za ponovljeni poziv);
   * prazan ACK nije završetak. Ekran završetak potvrđuje tek čitanjem COMPLETED.
   */
  potvrdiZavrsetak(dogovorId: string): Promise<Ishod<PotvrdaZavrsetka>>;

  /** M07 — prijavljen problem blokira automatsko zatvaranje po isteku prozora. */
  prijaviProblem(dogovorId: string, opis: string): Promise<Ishod<null>>;

  /**
   * M04 — deljenje telefona je usmereno i opozivo.
   * Deli SVOJ broj sa drugom stranom. Ne dobija njihov zauzvrat.
   */
  podeliTelefon(dogovorId: string): Promise<Ishod<null>>;

  /** OD-12: podeljen broj ostaje dok korisnik ne opozove ili Dogovor ne postane terminalan. */
  opoziviTelefon(dogovorId: string): Promise<Ishod<null>>;

  /** M04 — tačna lokacija je vezana za režim; daljinski Dogovor je nema. */
  lokacijskaDozvola(dogovorId: string): Promise<Ishod<LocationGrantState>>;
  podeliTacnuLokaciju(dogovorId: string): Promise<Ishod<null>>;
  opoziviTacnuLokaciju(dogovorId: string): Promise<Ishod<null>>;
  otkrijTacnuLokaciju(dogovorId: string): Promise<Ishod<ExactLocationReveal>>;
}

/* ----------------------------------------------------- Profil */

export interface ProfilCitanje {
  mojRadnikProfil(): Promise<RadnikProfilProjekcija | null>;
  /** RU-5 P0C-01 — strogo public-safe drugi profil; nikad raw app_profiles row. */
  javniProfil(profileId: string): Promise<JavniProfilProjekcija | null>;
}

export type AzurirajProfilKomanda = {
  ime?: string;
  grad?: string;
  biografija?: string;
  vestine?: string[];
  alati?: string[];
  vozila?: string[];
  licence?: string[]; // Self-declared resources, never verification authority.
  dostupanOdmah?: boolean;
  radijusKm?: number;
  kapacitetTima?: number;
  capacityRevision?: string; // Required together with an explicit team capacity edit.
  zavrsi?: boolean; // Setuje DRAFT u ACTIVE
};

export interface ProfilKomande {
  azurirajRadnikProfil(k: AzurirajProfilKomanda): Promise<Ishod<null>>;
}

/** Sve na jednom mestu — jedan objekat koji ekrani dobijaju. */
export interface Izvor extends PotrebeCitanje, PrijaveCitanje, DogovoriCitanje, Komande, ProfilCitanje, ProfilKomande {
  /** 'lazni' dok ne odobrimo Supabase; kasnije 'supabase'. */
  readonly poreklo: 'lazni' | 'supabase';
}
