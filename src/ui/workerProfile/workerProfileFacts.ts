import type { WorkerAiProfile } from '../../data/workerAiClientService';

/**
 * What the worker profile may SAY about itself (owner, 2026-10-07: the profile text says truthfully what its data is used for).
 *
 * Every sentence about an effect depends on something the server really does today. Where the owner has decided on a
 * different behaviour that the server does not have yet, the decision is a named switch here, off, so the screens keep
 * saying what is true and the day the server package is applied is a one-line change in this file.
 */

/**
 * Owner 2026-10-07: tools and vehicles are information, never a condition (PUT_RADNIKA_NACRT_20261007, point 5).
 *
 * ON since MATCH-V1 is applied to canonical DEV (ledger 231, 2026-10-07): `private.match_detail_without_calendar` no longer
 * treats a missing required tool or vehicle as a hard blocker, so such a task is offered and `rpc_submit_response` accepts the
 * application. Before that (final check 2026-10-07, finding G1) the switch was off, because the words would have promised what
 * the server did not do. A server without MATCH-V1 (a future production project) needs this off again.
 */
export const TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY = true;

/**
 * The "Za mene" switch on the map and the list (owner 2026-10-07; final check finding G4). ON since DISCOVERY-ZAMENE is applied
 * to canonical DEV (ledger 232, 2026-10-07): the server reads the optional filter key `forMe` (`DiscoveryChipRow` draws its
 * switch from it, and the Zadaci request carries the key only while it is on). A server without the package refuses the key
 * (`P6_INVALID_FILTER`), so a build for such a server (a future production project) needs this off again: a profile screen
 * must not promise a list that does not exist.
 */
export const FOR_ME_SWITCH_EXISTS = true;

/**
 * What the "Dostupnost" row of the work profile says (UX plan 3.8, 2026-10-07: "Raspored" is the name of the planner, so the row that
 * opens the availability must not send a person looking for a "raspored"; owner's phone 8 Oct 2026: "Mogu odmah · dostupnost" said the
 * same thing twice). One name for the one status, everywhere: "Mogu odmah" (J2). A row says its state only when it has one: with the
 * status off there is nothing to say under "Dostupnost" (the sentence "Pogledaj i uredi dostupnost" only described the row).
 */
export const availabilityRowDetail = (availableNow: boolean): string | undefined => availableNow ? 'Mogu odmah' : undefined;

/** How many kinds of work the card others see names before it says how many more. */
export const SKILLS_IN_CARD = 3;
/** The longest stretch of one kind of work said in the card's line; the whole list is one tap away, in "Šta radiš". */
const SKILL_CLIP = 28;

/**
 * The kinds of work as the ONE short line of the card "Kako te vide kad uskačeš" (approved draft of 8 Oct 2026, P3): the first three and how many more
 * ("Moleraj · Selidbe · Nošenje +2"). Nothing is added and nothing is made up: no kinds, no line.
 */
export function skillsLine(skills: readonly string[]): string {
  const words = skills.map(skill => skill.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const clip = (word: string) => { const letters = Array.from(word); return letters.length <= SKILL_CLIP ? word : `${letters.slice(0, SKILL_CLIP - 1).join('').trimEnd()}…`; };
  const shown = words.slice(0, SKILLS_IN_CARD).map(clip).join(' · ');
  return words.length > SKILLS_IN_CARD ? `${shown} +${words.length - SKILLS_IN_CARD}` : shown;
}

/** The parts of the profile a person can correct in one step. */
export type WorkerAiPart = 'identity' | 'skills' | 'area' | 'time' | 'tools';

/** The group titles of the review, and of the editors they open. */
export const WORKER_PART_TITLE: Readonly<Record<WorkerAiPart, string>> = {
  identity: 'O meni', skills: 'Usluge koje nudite', area: 'Područje', time: 'Kada imate vremena', tools: 'Alat i vozilo',
};

/** What the conversation has captured so far, from the draft itself (never from how many questions were asked). */
export type CapturedPart = { key: 'skills' | 'area' | 'time'; label: string; done: boolean };
export function capturedParts(profile: WorkerAiProfile): CapturedPart[] {
  const place = profile.location, week = profile.availability;
  return [
    { key: 'skills', label: 'Usluge', done: profile.skills.length > 0 },
    // Activation needs a country and a city (rpc_complete_worker_profile), so a place is captured only when both are there.
    { key: 'area', label: 'Područje', done: !!place.operatingCountryCode && place.city.trim().length > 0 },
    { key: 'time', label: 'Vreme', done: week.availableNow || week.rules.length > 0 || week.windows.length > 0 },
  ];
}

/** "veštine, područje i vreme": a list of lower-case words the Serbian way. */
const said = (labels: readonly string[]) => labels.length < 2 ? labels[0] ?? ''
  : `${labels.slice(0, -1).join(', ')} i ${labels[labels.length - 1]}`;
/** The one spoken sentence of the progress strip: what the draft holds and what it does not. */
export function capturedSpeech(parts: readonly CapturedPart[]): string {
  const have = parts.filter(part => part.done).map(part => part.label.toLowerCase());
  const missing = parts.filter(part => !part.done).map(part => part.label.toLowerCase());
  return [have.length ? `U nacrtu profila: ${said(have)}.` : 'U nacrtu profila još nema ničega.',
    missing.length ? `Još nema: ${said(missing)}.` : null].filter(Boolean).join(' ');
}

/** The sentence under "Alat i vozilo": what the two lists really do. */
export function toolsAndVehiclesNote(informationOnly: boolean = TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY): string {
  return informationOnly
    ? 'Samo informacija: ne utiču na pretragu ni na obaveštenja.'
    : 'Ako zadatak traži alat ili vozilo koje nemate na spisku, taj zadatak Vam se ne nudi i ne možete da se prijavite na njega.';
}
/** One row of "Na šta utiče" in the saved profile. `opens` names the screen a row leads to; no row is a dead control. */
export type ProfileEffect = { key: 'notifications' | 'public' | 'forMe'; title: string; detail: string;
  art: 'bell' | 'eye' | 'tasks'; opens?: 'notifications' };
/**
 * Only effects that exist today:
 * - the notifications about tasks that match the skills, the area and the time (new tasks are queued when they are
 *   published or changed; saving the profile queues the open ones again);
 * - the public profile, which shows the name, "O meni" and the city of the work profile to whoever opens it.
 * "Zadaci · Za mene" joins when the switch exists.
 */
export function profileEffects(forMeSwitchExists: boolean = FOR_ME_SWITCH_EXISTS): ProfileEffect[] {
  const rows: ProfileEffect[] = [
    { key: 'notifications', title: 'Obaveštenja', detail: 'Novi i već otvoreni zadaci koji Vam odgovaraju', art: 'bell', opens: 'notifications' },
    { key: 'public', title: 'Javni profil', detail: 'Ime, „O meni“ i grad vide osobe koje otvore Vaš profil', art: 'eye' },
  ];
  if (forMeSwitchExists) rows.push({ key: 'forMe', title: 'Zadaci · Za mene', detail: 'Lista po Vašem području i vremenu', art: 'tasks' });
  return rows;
}

/** The sentence about a team of more than one person, which is said in the offer and nowhere in the profile. */
export const PEOPLE_COUNT_NOTE = 'Ako za neki zadatak obezbeđujete više ljudi, njihov broj navodite u toj ponudi.';

/**
 * What stands behind the "ⓘ" in the bar of the work profile (owner's phone, 8 Oct 2026: too much explaining text on the screen; analysis rule J5).
 * "Na šta utiče" used to be a group of rows of its own; it is now these sentences, each of which stands on its own ("Obaveštenja: novi i već otvoreni
 * zadaci koji ti odgovaraju."). While the profile is changed by hand (`equipment`) the lists of tools and vehicles have no "Oprema ⓘ" beside them, so
 * what they do and the people count are said here too. Only what is true today: the effects are `profileEffects`, the note is `toolsAndVehiclesNote`.
 */
export function workerProfileInfoLines(equipment: boolean = false, forMeSwitchExists: boolean = FOR_ME_SWITCH_EXISTS,
  informationOnly: boolean = TOOLS_AND_VEHICLES_ARE_INFORMATION_ONLY): string[] {
  const lines = profileEffects(forMeSwitchExists).map(effect => `${effect.title}: ${effect.detail.charAt(0).toLocaleLowerCase('sr-Latn-RS')}${effect.detail.slice(1)}.`);
  if (equipment) lines.push(toolsAndVehiclesNote(informationOnly), PEOPLE_COUNT_NOTE);
  return lines;
}
