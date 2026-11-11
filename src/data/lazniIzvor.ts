/**
 * Lažni izvor — ista vrata kroz koja će ići Supabase.
 *
 * Namerno nije "samo mock": poštuje idempotenciju, odbija zastarelu reviziju i
 * pri izboru stvarno pravi Dogovor sa pokrivenošću i aktiviranim Povezivanjem.
 * Ako to ne radi ovde, ekran nikad neće biti napisan da to obradi, pa će pući
 * onog dana kad se uključi pravi server.
 *
 * M02 pravilo: izbor atomski pravi CONFIRMED Dogovor. Nema treće potvrde.
 */

import type {
  DogovorProjekcija,
  JavniProfilProjekcija,
  KontaktProjekcija,
  RezimIzvrsenja,
  KandidatProjekcija,
  Novac,
  MojaPrijavaProjekcija,
  PorukaProjekcija,
  PotrebaProjekcija,
  PrilikaProjekcija,
} from '../contracts/projections';
import { noTaskRelations, taskRelationIndex } from './taskRelation';
import type { Ishod, IzborKomanda, IzmenaKomanda, PodnesiPrijavuKomanda, PovuciPrijavuKomanda, Izvor } from './ports';
import { osoba } from '../ui/system/plural';
import { novac } from '../lib/novac';
import { composeHome } from './homeSnapshot';
import { hasNeedAttention, initialMarketplaceView, isOwnedNeed, marketplaceItems, ownedTaskCounts } from './marketplaceView';
import { applicationCounts } from './myApplicationsView';
import { applicationRank, ownApplicationsScopeRank } from './ownApplicationsPage';
import { dogovorenoVreme } from '../lib/dogovorenoVreme';
import { sesijaSada } from '../store/sesija';

const rsd = (iznos: number): Novac => ({
  iznos,
  valuta: 'RSD',
  prikaz: novac(iznos),
});

function pokrivenost(ukupno: number, popunjeno: number) {
  const preostalo = Math.max(0, ukupno - popunjeno);
  return { ukupno, popunjeno, preostalo, udeo: ukupno ? popunjeno / ukupno : 0 };
}

const UKUPNO_MESTA = 2;
const NARUCILAC_PROFIL_ID = 'narucilac-milos';

type Kandidat = Omit<
  KandidatProjekcija,
  'stanje' | 'preostaloMesta' | 'napomena' | 'mozeIzabrati' | 'dokazPrijave' | 'razlogPreporuke'
>;

const POCETNI_KANDIDATI: Kandidat[] = [
  { prijavaId: 'p-marko', radnikProfilId: 'radnik-marko', verzija: 2, hash: 'h-marko-2', ime: 'Marko Ilić', inicijali: 'MI', ocenaTekst: '5,0', recenzijeTekst: '11 recenzija', cena: rsd(5200), pokrivaMesta: 2, dolazakTekst: 'Sutra · 17:00', prevozTekst: 'Kombi' },
  { prijavaId: 'p-jelena', radnikProfilId: 'radnik-jelena', verzija: 1, hash: 'h-jelena-1', ime: 'Jelena Marković', inicijali: 'JM', ocenaTekst: '4,9', recenzijeTekst: '32 recenzije', cena: rsd(4800), pokrivaMesta: 2, dolazakTekst: 'Sutra · 16:30', prevozTekst: 'Kombi' },
  { prijavaId: 'p-nikola', radnikProfilId: 'radnik-nikola', verzija: 1, hash: 'h-nikola-1', ime: 'Nikola Petrović', inicijali: 'NP', ocenaTekst: '—', recenzijeTekst: 'Nov na USKOČI', cena: rsd(4500), pokrivaMesta: 1, dolazakTekst: 'Sutra · posle 15h', prevozTekst: 'Kombi' },
  { prijavaId: 'p-ivana', radnikProfilId: 'radnik-ivana', verzija: 1, hash: 'h-ivana-1', ime: 'Ivana Kostić', inicijali: 'IK', ocenaTekst: '4,9', recenzijeTekst: '27 recenzija', cena: rsd(2300), pokrivaMesta: 1, dolazakTekst: 'Sutra · posle 15h', prevozTekst: 'Bez vozila' },
  { prijavaId: 'p-ana', radnikProfilId: 'radnik-ana', verzija: 1, hash: 'h-ana-1', ime: 'Ana Vasić', inicijali: 'AV', ocenaTekst: '4,8', recenzijeTekst: '19 recenzija', cena: rsd(4600), pokrivaMesta: 1, dolazakTekst: 'Sutra · 16:00', prevozTekst: 'Automobil' },
];

/* -------------------------------------------------------------- stanje */

type Alokacija = {
  dogovorId: string;
  prijavaId: string;
  mesta: number;
  /** Povezivanje za V1 ima cenu 0 — ali se i dalje beleži, kao potrošnja po pokrivenoj osobi. */
  povezivanjeIznos: number;
};

type Deljenje = {
  /** Ja sam podelio SVOJ broj. */
  jaPodelio: boolean;
  /** Druga strana je podelila SVOJ broj sa mnom. */
  oniPodelili: boolean;
  lokacijaOtkrivena: boolean;
};

type Zavrsetak = {
  stanje: 'CONFIRMED' | 'AWAITING_REQUESTER' | 'COMPLETED';
  /** Server postavlja rok. Klijent ga NE računa. */
  rokPotvrdeMs: number | null;
  problemOtvoren: boolean;
};

type Stanje = {
  potrebaRevizija: number;
  kandidati: Kandidat[];
  deljenje: Record<string, Deljenje>;
  zavrsetak: Record<string, Zavrsetak>;
  /** Serverski sat. Testovi ga pomeraju; klijent ga nikad ne dira. */
  sadaMs: number;
  alokacije: Alokacija[];
  dogovorVerzija: Record<string, number>;
  idempotencija: Map<string, string>;
  povlacenja: Map<string, string>;
  povucenePrijave: Set<string>;
  prijavaRevizije: Record<string, number>;
  poruke: Record<string, PorukaProjekcija[]>;
  brojac: number;
  profil: import('../contracts/projections').RadnikProfilProjekcija;
};

const POCETNO: Stanje = {
  potrebaRevizija: 3,
  kandidati: POCETNI_KANDIDATI,
  deljenje: {},
  zavrsetak: {},
  sadaMs: Date.UTC(2026, 7, 29, 12, 0, 0),
  alokacije: [],
  dogovorVerzija: {},
  idempotencija: new Map(),
  povlacenja: new Map(),
  povucenePrijave: new Set(),
  prijavaRevizije: {},
  poruke: {},
  brojac: 0,
  profil: {
    id: 'moj-profil-1',
    ime: 'Ti',
    grad: 'Beograd',
    biografija: 'Ja sam majstor',
    vestine: [],
    alati: [],
    vozila: [],
    licence: [],
    stanje: 'DRAFT',
    dostupanOdmah: false,
    radijusKm: 10,
  },
};

let stanje: Stanje = struktuiraj(POCETNO);

function struktuiraj(s: Stanje): Stanje {
  return {
    potrebaRevizija: s.potrebaRevizija,
    kandidati: s.kandidati.map(k => ({ ...k, cena: { ...k.cena } })),
    deljenje: JSON.parse(JSON.stringify(s.deljenje)),
    zavrsetak: JSON.parse(JSON.stringify(s.zavrsetak)),
    sadaMs: s.sadaMs,
    alokacije: [...s.alokacije],
    dogovorVerzija: { ...s.dogovorVerzija },
    idempotencija: new Map(s.idempotencija),
    povlacenja: new Map(s.povlacenja),
    povucenePrijave: new Set(s.povucenePrijave),
    prijavaRevizije: { ...s.prijavaRevizije },
    poruke: { ...s.poruke },
    brojac: s.brojac,
    profil: JSON.parse(JSON.stringify(s.profil)),
  };
}

/** Samo za testove — vraća izvor na poznato stanje. */
export function resetujLazniIzvor() {
  stanje = struktuiraj(POCETNO);
}

const PROZOR_MS = 48 * 3600 * 1000;

function zavrsetakZa(id: string): Zavrsetak {
  return stanje.zavrsetak[id] ?? { stanje: 'CONFIRMED', rokPotvrdeMs: null, problemOtvoren: false };
}

/**
 * Serverski tick. Zatvara Dogovore kojima je prozor istekao I nisu blokirani
 * problemom. Ovo radi server, ne ekran — zato je ovde, a ne u komponenti.
 */
function serverskiTick() {
  for (const [id, z] of Object.entries(stanje.zavrsetak)) {
    if (z.stanje !== 'AWAITING_REQUESTER') continue;
    if (z.problemOtvoren) continue;
    if (z.rokPotvrdeMs !== null && stanje.sadaMs >= z.rokPotvrdeMs) {
      stanje.zavrsetak[id] = { ...z, stanje: 'COMPLETED', rokPotvrdeMs: null };
    }
  }
}

/** Samo za testove — pomera serverski sat i pušta tick. */
export function pomeriServerskiSat(sati: number) {
  stanje.sadaMs += sati * 3600 * 1000;
  serverskiTick();
}

/** Samo za testove — simulira da je Naručilac materijalno izmenio Potrebu. */
export function izmeniPotrebuMaterijalno() {
  stanje.potrebaRevizija += 1;
}

function popunjeno() {
  return stanje.alokacije.reduce((n, a) => n + a.mesta, 0);
}

/** Ljudski razlog, nikad procenat. M09 zabranjuje sirov matcher skor u UI. */
function razlog(k: Kandidat, preostalo: number): string {
  if (k.pokrivaMesta >= preostalo && k.ocenaTekst !== '—') return 'pokriva sva preostala mesta, najviša ocena';
  if (k.pokrivaMesta >= preostalo) return 'pokriva sva preostala mesta';
  return 'najbolji sklop ocene i dolaska';
}

const kasnjenje = () => new Promise((r) => setTimeout(r, 60));

/**
 * Režim pripada Dogovoru, ne aplikaciji. Daljinski Dogovor nema fizičku adresu
 * i ne sme da je traži — zato se ovo pita po Dogovoru, a ne globalno.
 */
function rezimZa(_dogovorId: string): RezimIzvrsenja {
  return 'FIZICKI';
}

function deljenjeZa(dogovorId: string): Deljenje {
  return stanje.deljenje[dogovorId] ?? { jaPodelio: false, oniPodelili: false, lokacijaOtkrivena: false };
}

function kontaktZa(dogovorId: string): KontaktProjekcija {
  const d = deljenjeZa(dogovorId);
  const lokacijaPostoji = rezimZa(dogovorId) !== 'DALJINSKI';
  return {
    mojTelefonPodeljen: d.jaPodelio,
    // Njihov broj se vidi SAMO ako su ga oni podelili. Moje deljenje ovde ne učestvuje.
    njihovTelefon: d.oniPodelili ? '+381 63 555 0142' : null,
    lokacijaPostoji,
    tacnaLokacija: lokacijaPostoji && d.lokacijaOtkrivena ? 'Bulevar oslobođenja 76, 4. sprat' : null,
    emailNijeDeljen: true,
  };
}

function dogovorIz(a: Alokacija): DogovorProjekcija {
  const k = stanje.kandidati.find((c) => c.prijavaId === a.prijavaId)!;
  const z = zavrsetakZa(a.dogovorId);
  // Every Dogovor in this test double comes from the double's own user choosing a candidate for the
  // double's own task, so that user is its requester. It used to follow the app's global mode.
  const jaSamNarucilac = true;
  return {
    id: a.dogovorId,
    verzija: stanje.dogovorVerzija[a.dogovorId] ?? 1,
    naslov: 'Prenos ormara sa Limana na Detelinaru',
    stanje: z.stanje,
    cena: k.cena,
    vremeTekst: k.dolazakTekst,
    putanjaTekst: 'Liman → Detelinara',
    pokrivenost: pokrivenost(UKUPNO_MESTA, popunjeno()),
    // M01: projekcija je vezana za ulogu. Isti Dogovor, druga strana —
    // bez ijedne grane `if (uloga)` u komponenti.
    ucesnici: [
      {
        id: 'narucilac',
        ime: jaSamNarucilac ? 'Ti' : 'Miloš',
        profilId: jaSamNarucilac ? 'profil-vi' : 'profil-ms',
        inicijali: jaSamNarucilac ? 'VI' : 'MŠ',
        uloga: 'narucilac',
        mesta: null,
        viSte: jaSamNarucilac,
        telefon: null,
      },
      {
        id: k.prijavaId,
        ime: jaSamNarucilac ? k.ime : 'Ti',
        profilId: jaSamNarucilac ? k.radnikProfilId : 'profil-vi',
        inicijali: jaSamNarucilac ? k.inicijali : 'VI',
        uloga: 'uskocer',
        mesta: a.mesta,
        viSte: !jaSamNarucilac,
        telefon: null,
      },
    ],
    rezim: rezimZa(a.dogovorId),
    kontakt: kontaktZa(a.dogovorId),
    // M04: chat ne zavisi od grantova za privatne podatke.
    chatDostupan: true,
    rokPotvrdeIso: z.rokPotvrdeMs === null ? null : new Date(z.rokPotvrdeMs).toISOString(),
    problemOtvoren: z.problemOtvoren,
    // Ocena tek posle kanonskog završetka — ne pre.
    ocenaMoguca: z.stanje === 'COMPLETED',
    // PKG-007: isto pravilo kao serverski actionState; lažni izvor ne modelira predloge na čekanju.
    radnje: {
      mozeOznacitiZavrsetak: !jaSamNarucilac && z.stanje === 'CONFIRMED',
      mozePotvrditiZavrsetak: jaSamNarucilac && (z.stanje === 'CONFIRMED' || z.stanje === 'AWAITING_REQUESTER'),
      izmenaNaCekanju: false,
      predlogIzmene: null,
    },
    hronologija: [
      { vremeTekst: 'sada', tekst: 'Dogovor je potvrđen' },
      {
        vremeTekst: 'sada',
        tekst:
          a.povezivanjeIznos === 0
            ? `Povezivanje aktivirano · bez naknade · ${osoba(a.mesta)}`
            : `Povezivanje aktivirano · ${a.povezivanjeIznos}`,
      },
    ],
    pocinje: null,
    izmenaCeka: null,
    // PKG-048: the double's Dogovor also comes from a Zadatak and a Prijava, so the source rows appear here too.
    izvor: { zadatakId: 'ormar', prijavaId: a.prijavaId },
    // Owner step 10: the double's term is the candidate's arrival in words (`vremeTekst`), never an exact window, so the
    // calendar counts this Dogovor under "Bez tačnog termina" instead of placing it on a day.
    tacanTermin: null,
  };
}

async function potrebaProjekcija(): Promise<PotrebaProjekcija> {
  const p = pokrivenost(UKUPNO_MESTA, popunjeno());
  return {
    id: 'ormar',
    revizija: stanje.potrebaRevizija,
    naslov: 'Prenos ormara sa Limana na Detelinaru',
    opis: 'Preuzeti, preneti i uneti veliki ormar na drugoj lokaciji.',
    stanje: p.preostalo === 0 ? 'POPUNJENA' : p.popunjeno > 0 ? 'DELIMICNO_POPUNJENA' : 'CEKA_PRIJAVE',
    pokrivenost: p,
    vremeTekst: 'Sutra · posle 15h',
    podrucjeTekst: 'Liman → Detelinara',
    uslovi: ['Kombi', '4. sprat', 'Nema lifta'],
    brojPrijava: stanje.kandidati.length,
  };
}

function fakePublicProfile(profileId: string): JavniProfilProjekcija | null {
  if (profileId === NARUCILAC_PROFIL_ID) {
    return {
      profilId: profileId,
      uloga: 'narucilac',
      ime: 'Miloš',
      avatarPutanja: null,
      grad: 'Novi Sad',
      naslov: null,
      biografija: null,
      poverenje: {
        ocenaProsek: 4.9,
        brojRecenzija: 18,
        zavrseniBroj: 7,
        identitetVerifikovan: false,
        ocenaDostupna: true,
        recenzijeDostupne: true,
        verifikacijaIdentitetaDostupna: false,
      },
    };
  }

  const kandidat = stanje.kandidati.find((k) => k.radnikProfilId === profileId);
  if (!kandidat && profileId !== stanje.profil.id) return null;
  const ime = kandidat?.ime ?? stanje.profil.ime;
  return {
    profilId: profileId,
    uloga: 'uskocer',
    ime,
    avatarPutanja: null,
    grad: kandidat ? 'Novi Sad' : stanje.profil.grad,
    naslov: null,
    biografija: kandidat ? null : stanje.profil.biografija,
    poverenje: {
      ocenaProsek: null,
      brojRecenzija: null,
      zavrseniBroj: 0,
      identitetVerifikovan: false,
      ocenaDostupna: false,
      recenzijeDostupne: false,
      verifikacijaIdentitetaDostupna: false,
    },
  };
}

/* --------------------------------------------------------------- izvor */

export const lazniIzvor: Izvor = {
  async paznjaZaPocetnu() {
    // Explicit test source only; production never derives attention from these local lists.
    const [needs, applications, agreements] = await Promise.all([
      lazniIzvor.mojePotrebe(), lazniIzvor.mojePrijave(), lazniIzvor.mojiDogovori()]);
    const home = composeHome({ needs: { kind: 'known', value: needs }, applications: { kind: 'known', value: applications },
      agreements: { kind: 'known', value: agreements } });
    return { rows: home.attention, more: home.attentionMore, asOf: new Date().toISOString() };
  },
  poreklo: 'lazni',

  async mojePotrebe() {
    await kasnjenje();
    return [await potrebaProjekcija()];
  },

  // EX-04 S1: the same sets, counted and paged by the client's own rules over the local list (the cursor is a position here, never a timestamp).
  async mojePotrebeStrana(request) {
    await kasnjenje();
    const all = await lazniIzvor.mojePotrebe({ includeUrgency: false });
    const section = { ALL: 'all', ACTIVE: 'active', DRAFTS: 'drafts', HISTORY: 'history' } as const;
    const inScope = request.scope === 'WAITING' ? all.filter(hasNeedAttention)
      : marketplaceItems(all, { ...initialMarketplaceView(), section: section[request.scope] }, true).filter(isOwnedNeed);
    const start = request.cursor ? Number(request.cursor.at) : 0, items = inScope.slice(start, start + request.limit), end = start + items.length;
    return { items, hasMore: end < inScope.length, counts: request.cursor ? null : ownedTaskCounts(all),
      cursor: items.length ? { at: String(end), id: items[items.length - 1].id } : null, asOf: new Date().toISOString() };
  },

  async potreba(id) {
    await kasnjenje();
    return id === 'ormar' ? potrebaProjekcija() : null;
  },

  async otvorenePrilike() {
    await kasnjenje();
    return [
      {
        id: 'ormar',
        naslov: 'Prenos ormara sa Limana na Detelinaru',
        statusTekst: 'Tražim ponude',
        podrucjeTekst: 'Liman → Detelinara',
        vremeTekst: 'Sutra · posle 15h',
        pokrivenost: pokrivenost(UKUPNO_MESTA, popunjeno()),
        uslovi: ['Kombi', '4. sprat', 'Nema lifta'],
        narucilacProfilId: NARUCILAC_PROFIL_ID,
        narucilacIme: 'Miloš',
        narucilacOcena: '4,9',
        // The same 18 reviews the fake public profile of this requester says it stands on.
        narucilacBrojOcena: 18,
        priblizno: { lat: 45.2396, lng: 19.8227 },
      } satisfies PrilikaProjekcija,
    ];
  },

  async prilikeZaPocetnu(options) {
    if (options?.signal?.aborted) throw new Error('HOME_OPPORTUNITIES_READ_ABORTED');
    // The only current fake fixture belongs to this requester; it is not an opportunity for them.
    const [rows, own] = await Promise.all([this.otvorenePrilike(options), this.mojePotrebe({ includeUrgency: false })]);
    if (options?.signal?.aborted) throw new Error('HOME_OPPORTUNITIES_READ_ABORTED');
    const ownIds = new Set(own.map(row => row.id));
    return rows.filter(row => !ownIds.has(row.id) && row.primaNovePrijave !== false).slice(0, 3);
  },

  async otvorenaPrilika(id, options) {
    // The explicit fake source uses its existing fixture IDs (for example "ormar").
    // Its revision belongs to the same simulated task state, never to a real DEV row.
    const owner = sesijaSada();
    const assertCurrent = () => {
      if (options?.signal?.aborted) throw new Error('EXACT_OPPORTUNITY_READ_ABORTED');
      const current = sesijaSada();
      if (current.user?.id !== owner.user?.id || current.accountRevision !== owner.accountRevision) throw new Error('AUTH_ACCOUNT_CHANGED');
    };
    assertCurrent();
    if (typeof id !== 'string' || !id) throw new Error('EXACT_OPPORTUNITY_ID_INVALID');
    const rows = await this.otvorenePrilike(options);
    assertCurrent();
    const item = rows.find(row => row.id === id) ?? null;
    return { item: item ? { ...item, revision: stanje.potrebaRevizija } : null, asOf: new Date(stanje.sadaMs).toISOString() };
  },

  async prilika(id) {
    const sve = await this.otvorenePrilike();
    return sve.find((p) => p.id === id) ?? null;
  },

  // EX-04 S4: the same applications a page at a time, in the local order (the cursor is a position here, never a timestamp).
  async prijaveZaPotrebuStrana(potrebaId, request) {
    const all = await lazniIzvor.prijaveZaPotrebu(potrebaId);
    const start = request.cursor ? Number(request.cursor.at) : 0, items = all.slice(start, start + request.limit), end = start + items.length;
    const last = items[items.length - 1];
    return { items, hasMore: end < all.length, counts: request.cursor ? null : { total: all.length },
      cursor: last ? { at: String(end), id: last.prijavaId } : null, asOf: new Date().toISOString() };
  },

  async prijaveZaPotrebu() {
    await kasnjenje();
    const preostalo = Math.max(0, UKUPNO_MESTA - popunjeno());
    const izabraniIds = stanje.alokacije.map((a) => a.prijavaId);
    const slobodni = stanje.kandidati.filter((k) => !izabraniIds.includes(k.prijavaId));

    return stanje.kandidati.map((k) => {
      const izabran = izabraniIds.includes(k.prijavaId);
      const prviSlobodan = slobodni[0]?.prijavaId === k.prijavaId;
      const kandidatStanje = izabran
        ? 'SELECTED'
        : preostalo === 0
          ? 'FULL'
          : k.pokrivaMesta > preostalo
            ? 'OVERFILL'
            : 'SELECTABLE';
      return {
        ...k,
        preostaloMesta: preostalo,
        napomena: '',
        stanje: kandidatStanje,
        mozeIzabrati: kandidatStanje === 'SELECTABLE',
        dokazPrijave: {
          sema: 'LEGACY_UNPROVEN',
          kapacitetTima: null,
          vestine: null,
          alati: null,
          licence: null,
          vozila: null,
        },
        razlogPreporuke: kandidatStanje === 'SELECTABLE' && prviSlobodan ? razlog(k, preostalo) : null,
      } satisfies KandidatProjekcija;
    });
  },

  /** PKG-023b, from the same rows the demo already holds: one answer per task asked about. */
  async odnosiPremaZadacima(idovi: readonly string[]) {
    await kasnjenje();
    const asked = [...new Set(idovi.filter((id): id is string => typeof id === 'string' && id.length > 0))];
    if (asked.length === 0) return noTaskRelations;
    const mine = new Set((await lazniIzvor.mojePotrebe()).map(row => row.id));
    const applications = await lazniIzvor.mojePrijave();
    const items = asked.flatMap<unknown>(needId => {
      if (mine.has(needId)) return [{ needId, relation: 'OWNER', applicationId: null, applicationState: null, agreementId: null }];
      const application = applications.find(row => row.potrebaId === needId);
      return application ? [{ needId, relation: 'APPLIED', applicationId: application.prijavaId,
        applicationState: application.stanje, agreementId: application.dogovorId ?? null }] : [];
    });
    return taskRelationIndex(items, asked);
  },

  async mojePrijave(): Promise<MojaPrijavaProjekcija[]> {
    await kasnjenje();
    return stanje.kandidati
      .filter((k) => k.radnikProfilId === stanje.profil.id)
      .map((k) => {
        const allocation = stanje.alokacije.find((a) => a.prijavaId === k.prijavaId);
        const submittedRevision = stanje.prijavaRevizije[k.prijavaId] ?? stanje.potrebaRevizija;
        const withdrawn = stanje.povucenePrijave.has(k.prijavaId);
        const stale = !allocation && !withdrawn && submittedRevision !== stanje.potrebaRevizija;
        const stanjePrijave = allocation ? 'SELECTED' : withdrawn ? 'WITHDRAWN' : stale ? 'STALE_REVIEW_REQUIRED' : 'SUBMITTED';
        return {
          prijavaId: k.prijavaId,
          potrebaId: 'ormar',
          potrebaRevizija: stanje.potrebaRevizija,
          prijavaRevizija: submittedRevision,
          prijavaVerzija: k.verzija,
          stanje: stanjePrijave,
          naslov: 'Prenos ormara sa Limana na Detelinaru',
          opis: 'Prenos ormara',
          cena: k.cena,
          pokrivaMesta: k.pokrivaMesta,
          napomena: '',
          podrucjeTekst: 'Liman, Novi Sad',
          vremeTekst: k.dolazakTekst,
          dogovorId: allocation?.dogovorId ?? null,
          promenjenaPotreba: stale,
          mozePovuci: !allocation && !withdrawn && !stale,
          traziPaznju: !!allocation || stale,
        } satisfies MojaPrijavaProjekcija;
      });
  },

  // EX-04 S2: the same sets, counted and paged by the client's own rules over the local list, in the server's order (what waits for me, the open ones, the rest;
  // inside a rank the local order). The cursor is a position here, never a timestamp.
  async mojePrijaveStrana(request) {
    await kasnjenje();
    const all = await lazniIzvor.mojePrijave();
    const ranked = all.map((row, index) => ({ row, index })).sort((a, b) => applicationRank(a.row) - applicationRank(b.row) || a.index - b.index).map(entry => entry.row);
    const wanted = ownApplicationsScopeRank(request.scope), inScope = wanted === null ? ranked : ranked.filter(row => applicationRank(row) === wanted);
    const start = request.cursor ? Number(request.cursor.at) : 0, items = inScope.slice(start, start + request.limit), end = start + items.length;
    const last = items[items.length - 1];
    return { items, hasMore: end < inScope.length, counts: request.cursor ? null : applicationCounts(all),
      cursor: last ? { at: String(end), id: last.prijavaId, rank: applicationRank(last) } : null, asOf: new Date().toISOString() };
  },

  async mojiDogovori() {
    await kasnjenje();
    return stanje.alokacije.map(dogovorIz);
  },

  async dogovor(id) {
    await kasnjenje();
    const a = stanje.alokacije.find((x) => x.dogovorId === id);
    return a ? dogovorIz(a) : null;
  },

  async poruke(dogovorId) {
    await kasnjenje();
    return stanje.poruke[dogovorId] ?? [];
  },

  /* ------------------------------------------------------------ komande */

  async podnesiPrijavu(k: PodnesiPrijavuKomanda): Promise<Ishod<{ prijavaId: string; verzija: number; hash: string }>> {
    await kasnjenje();
    if (k.potrebaRevizija !== stanje.potrebaRevizija) {
      return {
        ok: false,
        kod: "STALE_REVIEW_REQUIRED",
        naslov: "Potreba je izmenjena",
        poruka: "Potreba je promenjena. Osveži pregled prilike.",
      };
    }
    if (k.cenaRsd <= 0) {
      return {
        ok: false,
        kod: "INVALID_PRICE",
        naslov: "Neispravna cena",
        poruka: "Cena mora biti veća od 0 RSD.",
      };
    }
    const prijavaId = `prijava-${stanje.brojac + 1}`;
    stanje.brojac += 1;
    const hash = `hash_${prijavaId}_v1`;
    stanje.prijavaRevizije[prijavaId] = k.potrebaRevizija;
    stanje.kandidati.push({
      prijavaId,
      radnikProfilId: stanje.profil.id,
      verzija: 1,
      hash,
      ime: "Ti",
      inicijali: "VI",
      ocenaTekst: "Novo",
      recenzijeTekst: "Nema ocena",
      cena: { iznos: k.cenaRsd, valuta: "RSD", prikaz: novac(k.cenaRsd) },
      pokrivaMesta: k.pokrivenaMesta,
      dolazakTekst: dogovorenoVreme(k.predlozeniPocetak, "Dogovor"),
      prevozTekst: "Dogovor",
    });
    return {
      ok: true,
      podatak: {
        prijavaId,
        verzija: 1,
        hash,
      },
    };
  },

  async povuciPrijavu(k: PovuciPrijavuKomanda): Promise<Ishod<{ stanje: 'WITHDRAWN'; verzija: number }>> {
    await kasnjenje();
    const signature = `${k.prijavaId}|${k.potrebaRevizija}|${k.prijavaVerzija}|${k.razlog ?? ''}`;
    const previous = stanje.povlacenja.get(k.clientRequestId);
    if (previous && previous !== signature) {
      return { ok: false, kod: 'IDEMPOTENCY_KEY_REUSED', poruka: 'Isti zahtev ne može da se koristi za drugačije povlačenje.' };
    }
    const kandidat = stanje.kandidati.find((x) => x.prijavaId === k.prijavaId && x.radnikProfilId === stanje.profil.id);
    if (!kandidat) return { ok: false, kod: 'RESPONSE_NOT_FOUND', poruka: 'Prijava ne postoji.' };
    if (stanje.alokacije.some((a) => a.prijavaId === k.prijavaId)) {
      return { ok: false, kod: 'RESPONSE_ALREADY_SELECTED', poruka: 'Izabrana Prijava se više ne može povući.' };
    }
    if ((stanje.prijavaRevizije[k.prijavaId] ?? stanje.potrebaRevizija) !== k.potrebaRevizija || kandidat.verzija !== k.prijavaVerzija) {
      return { ok: false, kod: 'STALE_REVIEW_REQUIRED', poruka: 'Prijava ili Potreba su promenjene. Osveži pregled.' };
    }
    stanje.povlacenja.set(k.clientRequestId, signature);
    stanje.povucenePrijave.add(k.prijavaId);
    return { ok: true, podatak: { stanje: 'WITHDRAWN', verzija: kandidat.verzija } };
  },

  async izaberiPrijavu(k: IzborKomanda): Promise<Ishod<{ dogovorId: string }>> {
    await kasnjenje();

    // Idempotencija: ponovljen zahtev vraća ISTI Dogovor, ne pravi drugi.
    const vec = stanje.idempotencija.get(k.clientRequestId);
    if (vec) return { ok: true, podatak: { dogovorId: vec } };

    // Tačna revizija Potrebe. Ako se promenila, izbor se ne izvršava tiho.
    if (k.potrebaRevizija !== stanje.potrebaRevizija) {
      return {
        ok: false,
        kod: 'STALE_REVIEW_REQUIRED',
        naslov: 'Potreba je izmenjena',
        poruka: 'Prijave su ponovo na proveri jer je Potreba promenjena. Pogledaj ih ponovo pre izbora.',
      };
    }

    const kandidat = stanje.kandidati.find((c) => c.prijavaId === k.prijavaId);
    if (!kandidat) return { ok: false, kod: 'NOT_FOUND', poruka: 'Prijava više ne postoji.' };

    // Tačna verzija i hash prijave.
    if (kandidat.verzija !== k.prijavaVerzija || kandidat.hash !== k.prijavaHash) {
      return {
        ok: false,
        kod: 'STALE_REVIEW_REQUIRED',
        naslov: 'Prijava je izmenjena',
        poruka: 'Prijava je izmenjena posle tvog pregleda. Proveri je ponovo.',
      };
    }

    if (stanje.alokacije.some((a) => a.prijavaId === k.prijavaId)) {
      return { ok: false, kod: 'ALREADY_SELECTED', naslov: 'Već izabran', poruka: 'Ta prijava je već izabrana.' };
    }

    if (popunjeno() + kandidat.pokrivaMesta > UKUPNO_MESTA) {
      return {
        ok: false,
        kod: 'OVERFILL',
        naslov: 'Previše mesta',
        poruka: 'Ta prijava pokriva više mesta nego što je preostalo.',
      };
    }

    // Atomski: Dogovor + pokrivenost + Povezivanje sa cenom 0. Bez treće potvrde.
    stanje.brojac += 1;
    const dogovorId = `d-${stanje.brojac}`;
    stanje.alokacije.push({
      dogovorId,
      prijavaId: k.prijavaId,
      mesta: kandidat.pokrivaMesta,
      povezivanjeIznos: 0,
    });
    stanje.dogovorVerzija[dogovorId] = 1;
    stanje.poruke[dogovorId] = [];
    stanje.idempotencija.set(k.clientRequestId, dogovorId);

    return { ok: true, podatak: { dogovorId } };
  },

  async oznaciPrijavuVidjenom() {
    return { ok: true, podatak: null };
  },

  async oznaciPorukeProcitanim() {
    return 0;
  },

  async predloziIzmenu(k: IzmenaKomanda) {
    await kasnjenje();
    const trenutna = stanje.dogovorVerzija[k.dogovorId];
    if (trenutna === undefined) return { ok: false, kod: 'NOT_FOUND', poruka: 'Dogovor ne postoji.' };
    if (k.ocekivanaVerzija !== trenutna) {
      return {
        ok: false,
        kod: 'VERSION_CONFLICT',
        naslov: 'Dogovor je u međuvremenu promenjen',
        poruka: 'Osveži Dogovor pa pokušaj ponovo.',
      };
    }
    return { ok: true, podatak: { predlogId: `pred-${k.dogovorId}-${trenutna}` } };
  },

  async odgovoriNaIzmenu(predlogId, prihvatam) {
    await kasnjenje();
    if (!prihvatam) return { ok: true, podatak: null };
    const dogovorId = predlogId.split('-').slice(1, -1).join('-');
    if (stanje.dogovorVerzija[dogovorId] === undefined) {
      return { ok: false, kod: 'NOT_FOUND', poruka: 'Predlog ne postoji.' };
    }
    // v+1 odmah. Stara verzija ostaje nepromenljiva. Nema petlje potvrda.
    stanje.dogovorVerzija[dogovorId] += 1;
    return { ok: true, podatak: null };
  },

  async posaljiPoruku(dogovorId, telo) {
    await kasnjenje();
    const lista = stanje.poruke[dogovorId] ?? [];
    const id = `m-${dogovorId}-${lista.length + 1}`;
    stanje.poruke[dogovorId] = [
      ...lista,
      { id, posiljalacIme: 'Ti', moja: true, telo, vremeTekst: 'sada', procitano: false },
    ];
    return { ok: true, podatak: { porukaId: id } };
  },

  async otkaziDogovor(dogovorId) {
    await kasnjenje();
    const pre = stanje.alokacije.length;
    // M06: oslobađa se SAMO ta alokacija, ne cela Potreba.
    stanje.alokacije = stanje.alokacije.filter((a) => a.dogovorId !== dogovorId);
    if (stanje.alokacije.length === pre) {
      return { ok: false, kod: 'NOT_FOUND', poruka: 'Dogovor ne postoji.' };
    }
    return { ok: true, podatak: null };
  },

  async oznaciZavrsetak(dogovorId) {
    await kasnjenje();
    if (!stanje.alokacije.some((a) => a.dogovorId === dogovorId)) {
      return { ok: false, kod: 'NOT_FOUND', poruka: 'Dogovor ne postoji.' };
    }
    const z = zavrsetakZa(dogovorId);
    if (z.stanje === 'COMPLETED') {
      return { ok: false, kod: 'ALREADY_COMPLETED', naslov: 'Već je završen', poruka: 'Ovaj Dogovor je već zatvoren.' };
    }
    // Nema merdevina Krenuo/Stigao — ovo je prvi i jedini korak Uskočera.
    const rok = stanje.sadaMs + PROZOR_MS;
    stanje.zavrsetak[dogovorId] = { ...z, stanje: 'AWAITING_REQUESTER', rokPotvrdeMs: rok };
    return { ok: true, podatak: { rokPotvrdeIso: new Date(rok).toISOString() } };
  },

  async potvrdiZavrsetak(dogovorId) {
    await kasnjenje();
    if (!stanje.alokacije.some((a) => a.dogovorId === dogovorId)) {
      return { ok: false, kod: 'NOT_FOUND', poruka: 'Dogovor ne postoji.' };
    }
    // Naručilac može da potvrdi i pre nego što Uskočer bilo šta označi.
    const z = zavrsetakZa(dogovorId);
    const ponovljeno = z.stanje === 'COMPLETED';
    stanje.zavrsetak[dogovorId] = { ...z, stanje: 'COMPLETED', rokPotvrdeMs: null };
    return { ok: true, podatak: { zavrsenoIso: new Date(stanje.sadaMs).toISOString(), ponovljeno } };
  },

  async prijaviProblem(dogovorId, opis) {
    await kasnjenje();
    if (!opis.trim()) {
      return { ok: false, kod: 'EMPTY', naslov: 'Opiši problem', poruka: 'Bez opisa ne možemo da pomognemo.' };
    }
    const z = zavrsetakZa(dogovorId);
    if (z.stanje === 'COMPLETED') {
      return { ok: false, kod: 'ALREADY_COMPLETED', naslov: 'Već je završen', poruka: 'Dogovor je zatvoren.' };
    }
    // Problem blokira automatsko zatvaranje po isteku prozora.
    stanje.zavrsetak[dogovorId] = { ...z, problemOtvoren: true };
    return { ok: true, podatak: null };
  },

  async podeliTelefon(dogovorId) {
    await kasnjenje();
    if (!stanje.alokacije.some((a) => a.dogovorId === dogovorId)) {
      return { ok: false, kod: 'NOT_FOUND', poruka: 'Dogovor ne postoji.' };
    }
    const d = deljenjeZa(dogovorId);
    // Deli se SAMO moj broj. Njihov ostaje netaknut.
    stanje.deljenje[dogovorId] = { ...d, jaPodelio: true };
    return { ok: true, podatak: null };
  },

  async opoziviTelefon(dogovorId) {
    await kasnjenje();
    const d = deljenjeZa(dogovorId);
    stanje.deljenje[dogovorId] = { ...d, jaPodelio: false };
    return { ok: true, podatak: null };
  },

  // The demo does not invent authoritative grants or private location receipts.
  async lokacijskaDozvola() { return { ok: false, kod: 'DEMO_LOCATION_UNAVAILABLE', poruka: 'Privatna lokacija nije dostupna u probnom prikazu.' }; },
  async podeliTacnuLokaciju() { return { ok: false, kod: 'DEMO_LOCATION_UNAVAILABLE', poruka: 'Privatna lokacija nije dostupna u probnom prikazu.' }; },
  async opoziviTacnuLokaciju() { return { ok: false, kod: 'DEMO_LOCATION_UNAVAILABLE', poruka: 'Privatna lokacija nije dostupna u probnom prikazu.' }; },
  async otkrijTacnuLokaciju() { return { ok: false, kod: 'DEMO_LOCATION_UNAVAILABLE', poruka: 'Privatna lokacija nije dostupna u probnom prikazu.' }; },

  async mojRadnikProfil() {
    await kasnjenje();
    return stanje.profil;
  },

  async javniProfil(profileId) {
    await kasnjenje();
    return fakePublicProfile(profileId.trim());
  },

  async azurirajRadnikProfil(k) {
    await kasnjenje();
    if (k.ime !== undefined) stanje.profil.ime = k.ime;
    if (k.grad !== undefined) stanje.profil.grad = k.grad;
    if (k.biografija !== undefined) stanje.profil.biografija = k.biografija;
    if (k.vestine !== undefined) stanje.profil.vestine = k.vestine;
    if (k.alati !== undefined) stanje.profil.alati = k.alati;
    if (k.vozila !== undefined) stanje.profil.vozila = k.vozila;
    if (k.licence !== undefined) stanje.profil.licence = k.licence;
    if (k.radijusKm !== undefined) stanje.profil.radijusKm = k.radijusKm;
    if (k.dostupanOdmah !== undefined) stanje.profil.dostupanOdmah = k.dostupanOdmah;
    if (k.zavrsi) stanje.profil.stanje = 'ACTIVE';
    return { ok: true, podatak: null };
  },
};

/** Samo za testove — simulira da je DRUGA strana podelila svoj broj. */
export function drugaStranaPodeliTelefon(dogovorId: string) {
  const d = stanje.deljenje[dogovorId] ?? { jaPodelio: false, oniPodelili: false, lokacijaOtkrivena: false };
  stanje.deljenje[dogovorId] = { ...d, oniPodelili: true };
}
