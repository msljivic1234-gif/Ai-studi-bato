import type { StanjeProfila } from '../../contracts/projections';
import { workerAreasLabel, type WorkerArea } from '../../contracts/workerAreas';
import { cityLabel } from './cityLabel';
import type { WorkerExecutionModeView } from '../../hooks/useWorkerExecutionModes';

/** The longest stretch of one skill said in the summary line; the whole list is one tap away, in the work profile. */
const SKILL_CLIP = 32;
const clip = (text: string): string => {
  const letters = Array.from(text.replace(/\s+/g, ' ').trim());
  return letters.length <= SKILL_CLIP ? letters.join('') : `${letters.slice(0, SKILL_CLIP).join('').trimEnd()}…`;
};

/** What the profile's row needs of a work profile: its state, its skills, its workAreas, its city and its radius. Anything it does not hold is not said. */
export type WorkProfileFacts = { stanje: StanjeProfila | null; vestine?: readonly string[]; grad?: string | null; radijusKm?: number | null; workAreas?: readonly WorkerArea[] };

/** The words of a state, as the adjective of "profil" (no grammatical gender of the person: "Aktivan" belongs to "radni profil"). */
const STATE_WORD: Record<StanjeProfila, string> = { ACTIVE: 'Aktivan', DRAFT: 'Nacrt', SUSPENDED: 'Suspendovan' };

/**
 * What the work profile says about itself in the ONE line under its row on the profile (owner's phone, 8 Oct 2026: "Profil je aktivan."
 * and two rows under it for the area and the week said less than this): state, first skill (and how many more), confirmed remote work
 * and an explicitly named area for visits. The area never reads as a limit on remote work. A part that does not exist is not said;
 * a draft with nothing at all is "Nacrt". No profile is "Još nije podešen"; a suspended one says what to do; a state the app does
 * not know says nothing (never "Aktivan").
 *
 * The long explanations that used to stand here ("Dok je nacrt, zadaci ti se ne nude.", "Bez njega ne možeš da se prijaviš na zadatak.") are
 * said where the profile is, on its own screen, and the orange dot on the row says that something waits.
 */
export function workProfileSummary(profile: WorkProfileFacts | null, executionModes?: WorkerExecutionModeView): string | undefined {
  if (!profile) return 'Još nije podešen';
  if (profile.stanje === null || STATE_WORD[profile.stanje] === undefined) return undefined;
  if (profile.stanje === 'SUSPENDED') return `${STATE_WORD.SUSPENDED}. Obratite se podršci.`;
  const skills = (profile.vestine ?? []).map(skill => skill.trim()).filter(Boolean);
  const areasText = profile.workAreas?.length ? workerAreasLabel(profile.workAreas) : '';
  const city = profile.grad?.trim() ? cityLabel(profile.grad) : '';
  const radius = typeof profile.radijusKm === 'number' && Number.isFinite(profile.radijusKm) && profile.radijusKm > 0 ? `${profile.radijusKm} km` : '';
  const areaDisplay = areasText || (city ? `${city}${radius ? `, do ${radius}` : ''}` : '');
  const modes = executionModes?.kind === 'confirmed' ? executionModes.modes : [];
  const onSite = modes.includes('ON_SITE'), remote = modes.includes('REMOTE');
  const showArea = (onSite || (!remote && !!areasText)) && !!areaDisplay;
  const parts = [STATE_WORD[profile.stanje],
    skills.length ? `${clip(skills[0])}${skills.length > 1 ? ` +${skills.length - 1}` : ''}` : '',
    remote ? 'Na daljinu' : '',
    showArea ? `Dolazak: ${areaDisplay}` : ''];
  return parts.filter(Boolean).join(' · ');
}
