/**
 * M01 — PROJECTION FOUNDATION
 *
 * Ekrani ne čitaju sirove redove. Čitaju ove projekcije, vezane za ulogu.
 *
 * Pravilo iz V8: ekran nikad ne vidi sirovu transportnu vrstu, sirovu reviziju,
 * matcher skor, redove potvrda niti unutrašnjost privatnih grantova.
 * Ako projekcija to ne nosi, ekran to ne sme da prikaže.
 */

export type Uloga = 'narucilac' | 'uskocer';

/** Novčani iznos nikad ne putuje kao broj bez valute. */
export type Novac = {
  iznos: number;
  valuta: string;
  /** Već formatirano za prikaz — ekran ne formatira sam. */
  prikaz: string;
};

export type Pokrivenost = {
  ukupno: number;
  popunjeno: number;
  preostalo: number;
  /** Udeo 0..1, za traku napretka. */
  udeo: number;
};

/* ---------------------------------------------------------------- Potreba */

/**
 * The states a Task can be in, as a list a running program can ask about.
 *
 * The type alone was not enough: a route that needed to check "is this a state I know?" built a
 * Record of all six mapped to Serbian words, and used only `Object.hasOwn` on it. The words were
 * never read, and they had already drifted from the ones the screen shows — 'Nacrt' where the Task
 * detail says 'Privatan nacrt'. A list of strings the program can read is what that check wanted.
 *
 * The type is derived from the list so the two cannot disagree.
 */
export const STANJA_POTREBE = [
  'NACRT',
  'OBJAVLJENA',
  'CEKA_PRIJAVE',
  'DELIMICNO_POPUNJENA',
  'POPUNJENA',
  'ZATVORENA',
] as const;

export type StanjePotrebe = (typeof STANJA_POTREBE)[number];

export type RezimCene = 'MY_PRICE' | 'OFFERS';

/** Existing fn_need_urgency result; missing means unobserved, never active. */
export type NeedUrgencyProjection = { level: 'NORMAL'; expiresAt: null } | { level: 'HITNO'; expiresAt: string };

/** Exact current Need schedule columns; absence never means a guessed interval. */
export type NeedScheduleProjection = {
  kind: 'FIXED_WINDOW' | 'FLEXIBLE' | 'REMOTE_ANYTIME' | 'TODAY_FLEXIBLE' | 'TOMORROW_FLEXIBLE' | 'WEEK_FLEXIBLE';
  startsAt: string | null;
  endsAt: string | null;
};

/** Existing public Need columns/relations; private addresses and pins are absent. */
export type NeedDetailProjection = {
  kategorija: string;
  geografija: import('./needFactsV2').NeedTaskGeography | null;
  rezimLokacije: import('./needFactsV2').NeedTaskGeographyMode | null;
  zahtevi: { vestine: string[]; alati: string[]; vozila: string[]; dozvole: string[];
    bitniUslovi: string[] | null; iskustvoGodina: number | null; potvrdjenIdentitet: boolean };
};

export type PotrebaProjekcija = {
  id: string;
  /** Owner read's update instant; Home uses it only to keep a recent draft in "Čeka te". Older readers may omit it. */
  azurirano?: string;
  urgency?: NeedUrgencyProjection;
  /** Tačna revizija. Izbor mora da se veže za nju. */
  revizija: number;
  naslov: string;
  opis: string;
  stanje: StanjePotrebe;
  pokrivenost: Pokrivenost;
  vremeTekst: string;
  /** Javno bezbedna geografija. Tačna adresa NIJE ovde. */
  podrucjeTekst: string;
  /** Gruba tacka sa same potrebe, ~1km. Isti par koji javni citac salje kao `pin`. */
  priblizno?: { lat: number; lng: number } | null;
  taskCountryCode?: string;
  taskTimezone?: string;
  schedule?: NeedScheduleProjection;
  uslovi: string[];
  brojPrijava: number;
  /** Server-owned selectable count. Absent/null is unknown, never the historical total. */
  brojPrijavaZaIzbor?: number | null;
  /** Server-owned publication instant. Null/absent for draft or unknown. */
  objavljeno?: string | null;
  /** Number of attached photos. */
  brojFotografija?: number;
  rezimCene?: RezimCene;
  /** Sta cena znaci: TOTAL = ceo zadatak, PER_PERSON = jedno mesto, HOURLY = po osobi po satu. null/undefined = postojece znacenje. */
  osnovaCene?: "TOTAL" | "PER_PERSON" | "HOURLY" | null;
  ponudjenaCena?: Novac;
  /** Missing only for earlier saved/mock projections; never infer missing topology. */
  detalji?: NeedDetailProjection;
};

/* --------------------------------------------------------------- Prilika */

/**
 * Prilika je Potreba kako je vidi Uskočer.
 * Očišćena od PII, bez pravog broja prijava (da ne obeshrabruje).
 */
export type PrilikaProjekcija = {
  id: string;
  /** Public task revision for read invalidation; older projections may omit it. */
  revision?: number;
  urgency?: NeedUrgencyProjection;
  naslov: string;
  opis?: string;
  detalji?: NeedDetailProjection;
  statusTekst: string;
  /** Task-level read gate only; recheck its server deadline before navigation. Not worker eligibility. */
  primaNovePrijave?: boolean;
  /** Public server-owned deadline. Null means no cutoff; undefined means unknown. */
  rokZaPrijaveIso?: string | null;
  podrucjeTekst: string;
  taskCountryCode?: string;
  taskTimezone?: string;
  schedule?: NeedScheduleProjection;
  vremeTekst: string;
  pokrivenost: Pokrivenost;
  uslovi: string[];
  /** Bezbedan profile id za P0C-01 public-profile RPC/deep link; nije account id. */
  narucilacProfilId: string;
  /** Asset iz već pročitanog javnog profila; bajtovi i dalje traže autorizaciju uz profilId. Bez URL-a ili Storage putanje. */
  narucilacAvatarId?: string | null;
  narucilacIme: string;
  narucilacOcena: string | null;
  /**
   * How many reviews the rating stands on, as the public profile read says it: 0 = none yet, null/absent = not known
   * (the read failed or does not disclose reviews). Never guessed, so "5,0" from one review cannot pass for fifty.
   */
  narucilacBrojOcena?: number | null;
  /** Približna tačka za mapu. Tačna lokacija se otkriva tek po pravilima Dogovora. */
  priblizno: { lat: number; lng: number } | null;
  rezimCene?: RezimCene;
  /** Sta cena znaci: TOTAL = ceo zadatak, PER_PERSON = jedno mesto, HOURLY = po osobi po satu. null/undefined = postojece znacenje. */
  osnovaCene?: "TOTAL" | "PER_PERSON" | "HOURLY" | null;
  ponudjenaCena?: Novac;
};

/* ---------------------------------------------------------------- Prijava */

export type StanjeProfila = 'DRAFT' | 'ACTIVE' | 'SUSPENDED';

export type RadnikProfilProjekcija = {
  workAreas?:import('./workerAreas').WorkerArea[];
  id: string;
  ime: string;
  grad: string;
  biografija: string;
  vestine: string[];
  alati: string[];
  vozila: string[];
  /** Owned, self-declared values; required even when empty, never evidence of verification. */
  licence: string[];
  stanje: StanjeProfila;
  dostupanOdmah: boolean;
  radijusKm: number;
  /** Present only after authoritative capacity readback; never inferred from a vehicle. */
  kapacitetTima?: number;
  capacityRevision?: string;
};

/**
 * RU-5 / P0C-01 global public profile is deliberately compact.
 * It is NOT the internal Worker matching profile and must never grow by copying
 * operational fields from app_profiles. Task-relevant capability evidence
 * belongs to the concrete Application/snapshot authority.
 */
export type JavniProfilPoverenje = {
  ocenaProsek: number | null;
  brojRecenzija: number | null;
  zavrseniBroj: number;
  identitetVerifikovan: boolean;
  ocenaDostupna: boolean;
  recenzijeDostupne: boolean;
  verifikacijaIdentitetaDostupna: boolean;
};

export type JavniProfilProjekcija = {
  profilId: string;
  uloga: Uloga;
  ime: string | null;
  avatarPutanja: string | null;
  grad: string | null;
  naslov: string | null;
  biografija: string | null;
  poverenje: JavniProfilPoverenje;
};

/** RU-5 / P0D-01 — server-owned Requester candidate lifecycle. */
export type StanjePrijave =
  | 'SELECTABLE'
  | 'STALE'
  | 'OVERFILL'
  | 'SELECTED'
  | 'WITHDRAWN'
  | 'CLOSED'
  | 'FULL';

export type DokazPrijave = {
  sema: 'LEGACY_UNPROVEN' | 'APPLICATION_V1_SELF_DECLARED';
  kapacitetTima: number | null;
  vestine: string[] | null;
  alati: string[] | null;
  licence: string[] | null;
  vozila: string[] | null;
};

export type KandidatProjekcija = {
  /** Id prijave, ne id osobe. Izbor bira prijavu. */
  prijavaId: string;
  /** Current RPC values for this exact application; absent only in historical projections. */
  potrebaRevizija?: number;
  predlozeniPocetak?: string | null;
  predlozeniKraj?: string | null;
  /** Bezbedan profile id za javni profil; nikada auth/account id. */
  radnikProfilId: string;
  /** Tačna verzija/hash prijave. Izbor se vezuje baš za njih. */
  verzija: number;
  hash: string;
  ime: string;
  inicijali: string;
  ocenaTekst: string;
  recenzijeTekst: string;
  cena: Novac;
  /** Immutable unit: HOURLY is RSD per person per hour; TOTAL covers the application. Missing legacy basis is unknown. */
  osnovaCene?: 'TOTAL' | 'HOURLY' | null;
  pokrivaMesta: number;
  preostaloMesta: number;
  dolazakTekst: string;
  prevozTekst: string;
  napomena: string;
  stanje: StanjePrijave;
  /** Server-confirmed overlap; no identity/details of the other agreement. */
  terminZauzet?: boolean;
  mozeIzabrati: boolean;
  dokazPrijave: DokazPrijave;
  /**
   * Zašto je predložen — ljudski razlog, nikad procenat.
   * P0D-01 ne izmišlja ranking; null znači da nema kanonskog razloga.
   */
  razlogPreporuke: string | null;
};

export type StanjeMojePrijave =
  | 'SUBMITTED'
  | 'VIEWED'
  | 'SHORTLISTED'
  | 'STALE_REVIEW_REQUIRED'
  | 'WITHDRAWN'
  | 'SELECTED'
  | 'CLOSED';

/**
 * EX-04 S2 (B10): the facts of the task that an application card needs and the whole-list read never carried (R18-E03): the full term, the execution mode,
 * the zone the term is written in, and what the price is for. Present only on the paged read; every field is the task's own column, never inferred.
 */
export type ApplicationTaskFacts = {
  raspored: NeedScheduleProjection;
  rezimLokacije: import('./needFactsV2').NeedTaskGeographyMode | null;
  vremenskaZona: string | null;
  rezimCene: RezimCene;
  osnovaCene: 'TOTAL' | 'PER_PERSON' | 'HOURLY' | null;
  potrebnoMesta: number;
};

/** RU-5 / P0C-03 — Worker-facing own Application lifecycle DTO. */
export type MojaPrijavaProjekcija = {
  /** Paged read only (EX-04 S2); absent from the whole-list read, which keeps its older wording of place and time. */
  zadatak?: ApplicationTaskFacts;
  prijavaId: string;
  potrebaId: string;
  potrebaRevizija: number;
  prijavaRevizija: number;
  prijavaVerzija: number;
  stanje: StanjeMojePrijave;
  /** The server asks for explicit review of legacy price metadata, even without a task edit. */
  osnovicaZaProveru?: boolean;
  terminZauzet?: boolean;
  naslov: string;
  opis: string;
  cena: Novac;
  /** Immutable unit: HOURLY is RSD per person per hour; TOTAL covers the application. Missing legacy basis is unknown. */
  osnovaCene?: 'TOTAL' | 'HOURLY' | null;
  pokrivaMesta: number;
  napomena: string;
  podrucjeTekst: string;
  vremeTekst: string;
  dogovorId: string | null;
  promenjenaPotreba: boolean;
  mozePovuci: boolean;
  traziPaznju: boolean;
};

/* --------------------------------------------------------------- Dogovor */

/** M07: merdevine Krenuo/Stigao su penzionisane. Ovo je ceo skup. */
export type StanjeDogovora =
  | 'CONFIRMED'
  | 'AWAITING_REQUESTER'
  | 'COMPLETED'
  | 'CANCELLED';

export type UcesnikProjekcija = {
  /** Id NALOGA. Ne sme se koristiti za citanje fotografije. */
  id: string;
  /** Javni profilni id te strane, iz pkg024a. null = server ga nije poslao; tada NEMA fotografije. */
  profilId: string | null;
  ime: string;
  inicijali: string;
  uloga: Uloga;
  mesta: number | null;
  viSte: boolean;
  /** Telefon je eksplicitna usmerena saglasnost. null = nije podeljen VAMA. */
  telefon: string | null;
};

/**
 * M04 — režim izvršenja određuje da li tačna lokacija uopšte postoji.
 * Daljinski Dogovor nema fizičku adresu i ne sme da je traži.
 */
export type RezimIzvrsenja = 'FIZICKI' | 'DALJINSKI' | 'PREUZIMANJE_DOSTAVA';

/**
 * Deljenje je USMERENO. To što sam ja podelio svoj broj ne znači da vidim njihov,
 * i obrnuto. Jedno polje za oba smera bi bila tiha greška u privatnosti.
 */
export type KontaktProjekcija = {
  /** Podelio sam SVOJ broj sa drugom stranom. */
  mojTelefonPodeljen: boolean;
  /** Njihov broj — postoji samo ako su ga oni podelili SA MNOM. */
  njihovTelefon: string | null;
  /** Ima li ovaj režim uopšte tačnu lokaciju. */
  lokacijaPostoji: boolean;
  /** Tačna adresa — tek kada pravila Dogovora to dozvole. */
  tacnaLokacija: string | null;
  /** Email nije standardno deljeno polje. Stoji ovde da se ne bi „slučajno" dodao. */
  readonly emailNijeDeljen: true;
};

/**
 * PKG-007: serverske dozvole za završetak Dogovora (actionState iz rpc_get_agreement_workspace),
 * vezane za ovaj nalog i važeću verziju. Klijent ih nikad ne izvodi iz statusa i uloge.
 * `null` znači da server nije potvrdio dozvole (lista, stariji ili neispravan odgovor) —
 * ekran tada ne nudi završetak dok se prikaz ne osveži.
 */
export type DogovorRadnje = {
  /** Uskočer sme da označi završetak: CONFIRMED, bez predloga izmene na čekanju. */
  mozeOznacitiZavrsetak: boolean;
  /** Naručilac sme da potvrdi završetak: CONFIRMED ili AWAITING_REQUESTER, bez predloga na čekanju. */
  mozePotvrditiZavrsetak: boolean;
  /** Predlog izmene čeka odgovor; server tada odbija oba završetka. */
  izmenaNaCekanju: boolean;
  /**
   * Šta taj predlog menja i ko na njega odgovara. `null` kada predloga nema ili kada njegov sadržaj
   * nije čitljiv: tada ekran kaže da predlog postoji i vodi na Izmene, a sadržaj ne izmišlja.
   */
  predlogIzmene: PredlogIzmeneSazetak | null;
};

export type PredlogIzmeneSazetak = {
  id: string;
  /** Predložio ovaj nalog; tada odgovara druga strana. */
  moj: boolean;
  mozeOdgovoriti: boolean;
  mozePovuci: boolean;
  razlog: string | null;
  /** Samo ono što se razlikuje od prihvaćenih uslova, već formatirano za prikaz. */
  izmene: { polje: 'Cena' | 'Termin' | 'Obim'; sada: string; predlog: string }[];
};

export type DogovorProjekcija = {
  id: string;
  /** Prihvaćena verzija je autoritativna. */
  verzija: number;
  naslov: string;
  stanje: StanjeDogovora;
  cena: Novac;
  /** Immutable unit: HOURLY is RSD per person per hour; TOTAL covers the application. Missing legacy basis is unknown. */
  osnovaCene?: 'TOTAL' | 'HOURLY' | null;
  vremeTekst: string;
  /** Validated start from accepted terms only; never the source task's current start. Absent when terms were not read. */
  prihvacenPocetak?: string | null;
  /** Full accepted scope, within the server's 4,000-code-point bound. Absent when terms were not read. */
  prihvacenObim?: string | null;
  putanjaTekst: string;
  pokrivenost: Pokrivenost;
  ucesnici: UcesnikProjekcija[];
  rezim: RezimIzvrsenja;
  kontakt: KontaktProjekcija;
  /** M04: chat radi nezavisno od grantova za privatne podatke. */
  chatDostupan: boolean;
  /**
   * M07: server drži prozor; klijent ga samo prikazuje.
   * Nikad ne računati rok na klijentu — sat na telefonu nije autoritet.
   */
  rokPotvrdeIso: string | null;
  /** Otvoren problem blokira automatsko zatvaranje. */
  problemOtvoren: boolean;
  /** Ocena je moguća tek posle kanonskog završetka, ne pre. */
  ocenaMoguca: boolean;
  /** List enrichment only. A failed/missing receipt does not establish rating eligibility or history. */
  stanjeProvereOcene?: 'DUE' | 'NOT_DUE' | 'UNAVAILABLE';
  /** Hronologija je deo Pregleda, ne treći tab. */
  hronologija: { vremeTekst: string; tekst: string }[];
  /** PKG-007: serverske dozvole za završetak; `null` = nepotvrđene, završetak se ne nudi. */
  radnje: DogovorRadnje | null;
  /**
   * PKG-023a: početak posla sa Zadatka, ISO ili `null` kada čitač ne daje termin.
   * Nije prihvaćeni termin Dogovora; za njegov redosled koristi se `prihvacenPocetak`.
   */
  pocinje: string | null;
  /** PKG-023a: predlog izmene koji čeka odgovor; `null` kad nijedan ne čeka. */
  izmenaCeka: { predlogId: string; mojPredlog: boolean } | null;
  /**
   * PKG-048: Zadatak i Prijava iz kojih je Dogovor nastao. `null` kada server još ne vraća vezu —
   * stariji odgovor ne sme da napravi dugme koje ne vodi nigde.
   */
  izvor: { zadatakId: string | null; prijavaId: string | null };
  /**
   * Tačan dogovoreni termin iz prihvaćenih uslova (`proposed_start_at` / `proposed_end_at`): oba kraja kao tačni
   * trenuci, početak pre kraja. `null` kada Dogovor nema tačan termin; polje izostaje kada čitač to nije rekao, pa
   * Kalendar tada ne tvrdi da je dan prazan (vlasnikov korak 10, kritika A15).
   */
  tacanTermin?: { pocetak: string; kraj: string } | null;
};

/* ------------------------------------------------- AI nacrt Potrebe (R02) */

/**
 * Preslikano iz donorovog `ai_structured_facts` — KEEP odluka.
 * Taj model već nosi tačno ono što kanon traži, pa se ne izmišlja nov.
 *
 * Pravilo: AI_PROPOSED → HUMAN_CONFIRMED → CANONICAL_SAVED.
 * AI ne sme da izmisli činjenicu i sačuva je kao korisnikovu potvrđenu.
 */
export type StatusCinjenice = 'POTVRDJENO' | 'ZAKLJUCENO' | 'TRAZI_POTVRDU' | 'NEPOZNATO';

/** Poreklo je odvojeno od statusa — po njemu se vidi šta je AI zaključio. */
export type IzvorCinjenice = 'KORISNIK' | 'PROFIL' | 'AI_ZAKLJUCAK' | 'SISTEM';

export type KljucCinjenice =
  | 'naslov'
  | 'opis'
  | 'kategorija'
  | 'datum'
  | 'vreme'
  | 'polaziste'
  | 'odrediste'
  | 'osoba'
  | 'vozilo'
  | 'uslovi';

export type Cinjenica = {
  id: string;
  kljuc: KljucCinjenice;
  /** Već formatirano za prikaz — kartica ne formatira sama. */
  prikaz: string;
  status: StatusCinjenice;
  izvor: IzvorCinjenice;
  /** Citat iz razgovora na osnovu kog je zaključeno. Bez njega nema provere. */
  citat: string | null;
};

export type OdlukaBezbednosti = 'ALLOW' | 'CLARIFY' | 'REVIEW' | 'BLOCK';

/**
 * JEDNO autoritativno stanje nacrta.
 *
 * Chat i live kartica su DVE PROJEKCIJE ovoga — ne dva stanja.
 * Ako korisnik kaže „ipak u 18h", stara činjenica se potiskuje, a obe
 * projekcije odmah vide isto. Paralelno stanje za karticu je zabranjeno.
 */
export type NacrtPotrebeProjekcija = {
  razgovorId: string;
  /** Samo aktuelne — potisnute se ne projektuju. */
  cinjenice: Cinjenica[];
  /** Šta AI još ne zna, pa mora ciljano da pita. */
  nedostaje: KljucCinjenice[];
  /** Server je autoritet; UI prikazuje ishod bez internog obrazloženja. */
  bezbednost: OdlukaBezbednosti;
  bezbednostPoruka: string | null;
  /** Objava je moguća tek kad je sve što je obavezno potvrđeno. */
  spremnoZaObjavu: boolean;
};

export type PorukaRazgovora = {
  id: string;
  odAI: boolean;
  telo: string;
  /** Činjenice koje je ova poruka predložila — veza chata i kartice. */
  predlozene: string[];
};

export type PorukaProjekcija = {
  id: string;
  /** Authorized immutable metadata, independently bound to this canonical row. */
  fotografije?: readonly { assetId: string; width: number; height: number; byteSize: number; contentType: 'image/jpeg' }[];
  /** A voice message: authorized metadata only (never a path or URL); the bytes come through the authenticated playback read. Empty body, no photos. */
  glas?: Readonly<{ assetId: string; trajanjeMs: number; velicina: number }>;
  /** Exact version persisted with this message; never the current Agreement version. */
  dogovorVerzija?: number;
  clientMessageId?: string | null;
  posiljalacAccountId?: string;
  posiljalacIme: string;
  moja: boolean;
  telo: string;
  vremeTekst: string;
  /** null means no authoritative read receipt exists. */
  procitano: boolean | null;
};
