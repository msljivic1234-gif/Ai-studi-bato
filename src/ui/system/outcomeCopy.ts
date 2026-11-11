import type { FactArtKind } from './FactArt';

/**
 * What the app says when something did not go as asked (UI/UX pass 2026-10-08, F8b; text revision 2026-10-07, finding 4 and the
 * vocabulary table). The words were written screen by screen: "Proveri ishod", "Učitaj sačuvano stanje", "Osveži stanje", "Prikaži
 * aktuelno stanje" were 36 different buttons for one idea, and about 350 sentences said "ishod nije potvrđen", "sačuvano stanje" or
 * "zahtev" in a language nobody speaks. This is the one table. A screen imports a line from here; it does not write its own.
 *
 * THE FIVE SITUATIONS, told apart by what the app KNOWS (never by what it fears):
 *
 *   failed       it knows nothing was saved ("Nije uspelo", the button is `retry`);
 *   uncertain    it asked, and no answer came back, so it does not know ("Ne znamo da li je uspelo", the one button is `check`);
 *   offline      the phone has no connection ("Nema internet veze");
 *   unavailable  the connection is fine and the service is not ("Usluga trenutno nije dostupna");
 *   cannotLoad   a read that did not arrive, cause not known yet ("Ne možemo da učitamo Dogovore").
 *
 * Writing `failed` for something that may have been saved is a lie that gets a person to send a task twice; when in doubt it is
 * `uncertain`, and the person is given the one button that finds out.
 *
 * Wording can evolve with the product. Keep the known/unknown distinction and the
 * recovery action's meaning; title punctuation, synonyms and repeated command
 * words are editorial choices rather than executable visual restrictions.
 */

/** The three buttons of the app's trouble states, each one verb. The same word on every screen. */
export const OUTCOME_ACTION = {
  /** A write that did not go through, or a read that did not arrive: do it again. */
  retry: 'Pokušajte ponovo',
  /** The app is not sure a write went through: find out. The ONE button of `uncertain`. */
  check: 'Proverite',
  /** What is on the screen may be old: read it again (a list, a Dogovor, a task). */
  refresh: 'Osvežite',
} as const;

/** What a screen reader hears on the check button, which has to carry its visible word (`Proveri`) and say what is checked. */
export const CHECK_SPOKEN = 'Proverite šta je sačuvano';

/** The title and the sentence of a state, and the button that goes with it. */
export type OutcomeWords = { readonly title: string; readonly copy: string; readonly action: string };

export const OUTCOME = {
  /** The app knows nothing was saved. */
  failed: { title: 'Nije uspelo', copy: 'Ništa nije sačuvano.', action: OUTCOME_ACTION.retry },
  /**
   * The app sent something and no answer came back, so it cannot say whether it was saved. The sentence is the reason, not an order
   * (the order is the button), and it is short because the title already says what is not known. A flow that is sure its send cannot be
   * doubled may add that ("Neće se poslati dvaput."); this line does not promise what it cannot know.
   */
  uncertain: { title: 'Ne znamo da li je uspelo', copy: 'Odgovor nije stigao.', action: OUTCOME_ACTION.check },
  /** The phone has no connection. */
  offline: { title: 'Nema internet veze', copy: 'Uključite Wi-Fi ili mobilne podatke.', action: OUTCOME_ACTION.retry },
  /** The connection is there; the service is not answering. It is not the person's phone, and the words say so. */
  unavailable: { title: 'Usluga trenutno nije dostupna', copy: 'Nije do Vašeg telefona. Sačekajte malo.', action: OUTCOME_ACTION.retry },
} as const satisfies Record<string, OutcomeWords>;

/** While a check is running: the one sentence the screen reader hears and the button's busy state stands for. */
export const CHECKING = 'Proveravamo…';

/**
 * A read that did not arrive when the cause is not known yet ("Ne možemo da učitamo Dogovore"). `what` is the thing, ALREADY in the
 * accusative ("Dogovore", "zadatke", "obaveštenja", "podešavanja"): the table cannot decline a noun, so the screen that knows it passes
 * it. When the data layer can tell a cut connection from a service that is down, the screen uses `OUTCOME.offline` or
 * `OUTCOME.unavailable` instead; until then this is the honest line, and its sentence names the one thing a person can check.
 */
export function cannotLoad(what: string): OutcomeWords {
  return { title: `Ne možemo da učitamo ${what}`, copy: 'Proverite vezu.', action: OUTCOME_ACTION.retry };
}

/**
 * The strip under the bar when a read failed but the screen still has what it loaded before (R31, composition spec T7). It is a line,
 * not a screen: the last thing the person saw stays.
 */
export const OFFLINE_LINE = {
  /** There is something to show: say that it is the last thing that was loaded. */
  withLast: 'Nema veze. Prikazano je poslednje učitano.',
  /** There is nothing to show yet. */
  bare: 'Nema veze.',
  action: OUTCOME_ACTION.refresh,
} as const;

/**
 * What a person did when the app does not know whether it worked: the subject of an `uncertain` state, each with its own title (the
 * verb has to agree with the noun, so the table spells them out) and the picture that stands for it. `generic` for one nobody listed.
 * The sentence and the button are the same for all of them: `OUTCOME.uncertain.copy` and `OUTCOME_ACTION.check`.
 */
export type UncertainSubject = 'generic' | 'application' | 'withdrawal' | 'selection' | 'publication' | 'taskCancel' | 'agreementCancel'
  | 'agreementChange' | 'agreementDone' | 'message' | 'problem' | 'review' | 'terms' | 'request';

export const UNCERTAIN_ABOUT: Readonly<Record<UncertainSubject, { readonly title: string; readonly art: FactArtKind }>> = {
  generic: { title: OUTCOME.uncertain.title, art: 'info' },
  application: { title: 'Ne znamo da li je prijava stigla', art: 'applications' },
  withdrawal: { title: 'Ne znamo da li je prijava povučena', art: 'applications' },
  selection: { title: 'Ne znamo da li je prijava izabrana', art: 'applications' },
  publication: { title: 'Ne znamo da li je zadatak objavljen', art: 'publish' },
  taskCancel: { title: 'Ne znamo da li je zadatak otkazan', art: 'tasks' },
  agreementCancel: { title: 'Ne znamo da li je Dogovor otkazan', art: 'agreements' },
  agreementChange: { title: 'Ne znamo da li je izmena Dogovora poslata', art: 'agreements' },
  agreementDone: { title: 'Ne znamo da li je završetak potvrđen', art: 'agreements' },
  message: { title: 'Ne znamo da li je poruka poslata', art: 'chat' },
  problem: { title: 'Ne znamo da li je problem prijavljen', art: 'support' },
  review: { title: 'Ne znamo da li je ocena sačuvana', art: 'star' },
  terms: { title: 'Ne znamo da li su uslovi prihvaćeni', art: 'document' },
  request: { title: 'Ne znamo da li je zahtev poslat', art: 'document' },
};
