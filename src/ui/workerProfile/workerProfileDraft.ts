import type { RadnikProfilProjekcija } from '../../contracts/projections';
import type { AzurirajProfilKomanda } from '../../data/ports';
import { capabilityTerms } from '../../lib/capabilityTerms';

export type WorkerDraft = { workAreas?:import('../../contracts/workerAreas').WorkerArea[]; ime: string; grad: string; biografija: string; vestine: string[]; alati: string[];
  vozila: string[]; licence: string[]; capacity: string; capacityRevision: string | null; radius: string; dostupanOdmah: boolean; newSkill: string; newTool: string; newVehicle: string; newLicense: string };
export function workerDraft(profile: RadnikProfilProjekcija | null): WorkerDraft {
  return profile ? { ...(profile.workAreas?{workAreas:profile.workAreas}:{}),ime: profile.ime, grad: profile.grad, biografija: profile.biografija, vestine: [...profile.vestine],
    alati: [...profile.alati], vozila: [...profile.vozila], licence: [...profile.licence], radius: String(profile.radijusKm), dostupanOdmah: profile.dostupanOdmah,
    capacity: profile.kapacitetTima === undefined ? '' : String(profile.kapacitetTima), capacityRevision: profile.capacityRevision ?? null,
    newSkill: '', newTool: '', newVehicle: '', newLicense: '' }
    : { capacity: '', capacityRevision: null, ime: '', grad: '', biografija: '', vestine: [], alati: [], vozila: [], licence: [], radius: '', dostupanOdmah: false, newSkill: '', newTool: '', newVehicle: '', newLicense: '' };
}
const equal = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
/**
 * The name a save writes into the work profile (owner, 8 Oct 2026, "Može, dobro vam jedno ime za sve."): the ACCOUNT's name, which "Lični podaci" is the
 * one place to change. The work profile takes it where it has no name yet (the first save creates the profile under it), and ALWAYS when the profile is
 * activated (`rpc_complete_worker_profile` refuses a profile without a name, DISPLAY_NAME_REQUIRED, and it must not go live under another name than the
 * account's). A profile that already carries a name keeps it on an ordinary save: it is changed by the person's own "Koristi „<ime naloga>“" or by saving
 * the name in "Lični podaci", never silently by a save of the skills. Without an account name (not readable, or the account has none) the profile's own
 * name is what there is.
 */
export function nameForSave(draftName: string, initialName: string, activate: boolean, accountName: string | null | undefined): string {
  const account = accountName?.trim() ?? '', own = draftName.trim();
  if (!account) return own;
  return activate || initialName.trim().length === 0 ? account : own;
}
/**
 * The command that saves a draft. `accountName` is the name of the account (see `nameForSave`): there is no field for the name in the work profile, so
 * the name written is that one; left out, the draft's own name is written as it always was.
 */
export function workerCommand(draft: WorkerDraft, initial: WorkerDraft, activate: boolean, accountName?: string | null): { command?: AzurirajProfilKomanda; expected?: AzurirajProfilKomanda; error?: string } {
  if ([draft.newSkill, draft.newTool, draft.newVehicle, draft.newLicense].some(value => value.trim())) return { error: 'Uneta stavka još nije dodata. Dodaj je u listu pre čuvanja.' };
  if (draft.grad !== initial.grad || draft.radius !== initial.radius || draft.dostupanOdmah !== initial.dostupanOdmah) {
    return { error: 'Mesto i radijus menjaj u području rada, a dostupnost u podešavanju dostupnosti.' };
  }
  // Deprecated server fields are retained for compatibility, never edited or re-saved by this personal profile.
  if (draft.capacity !== initial.capacity || !equal(draft.licence, initial.licence) || draft.newLicense.trim()) {
    return { error: 'Licence i kapacitet tima više se ne podešavaju u profilu.' };
  }
  const lists = { vestine: capabilityTerms(draft.vestine), alati: capabilityTerms(draft.alati), vozila: capabilityTerms(draft.vozila) };
  if (Object.values(lists).some(value => value === null)) return { error: 'Svaka lista može imati do 50 stavki, do 500 znakova po stavci.' };
  const values = { ime: nameForSave(draft.ime, initial.ime, activate, accountName), grad: draft.grad.trim(), biografija: draft.biografija.trim(),
    vestine: lists.vestine!, alati: lists.alati!, vozila: lists.vozila!, radijusKm: Number(draft.radius), dostupanOdmah: draft.dostupanOdmah };
  // The name is not typed in the work profile any more, so what is missing is said where it is done: the name in "Lični podaci", the skill here, the place in the area.
  if (activate && values.ime.length < 2) return { error: 'Za aktivaciju dodaj ime u „Lični podaci“.' };
  if (activate && !values.vestine.length) return { error: 'Za aktivaciju dodaj bar jednu veštinu.' };
  if (activate && values.grad.length < 2 && !initial.workAreas?.length) return { error: 'Za aktivaciju potvrdite područje rada u razgovoru.' };
  const before = { ...initial, radijusKm: Number(initial.radius) };
  const command: AzurirajProfilKomanda = { zavrsi: activate };
  // Only changed fields are written. A location edit elsewhere cannot be
  // silently overwritten by untouched inputs from this retained form.
  for (const key of Object.keys(values) as (keyof typeof values)[]) {
    if (!['grad', 'radijusKm', 'dostupanOdmah'].includes(key) && !equal(values[key], before[key])) Object.assign(command, { [key]: values[key] });
  }
  // Activation confirms the visible profile, including unchanged fields. A
  // concurrent edit must not turn a different profile into a claimed success.
  return { command, expected: activate ? { ...values, zavrsi: true } : command };
}
export function workerReadbackMatches(profile: RadnikProfilProjekcija | null, command: AzurirajProfilKomanda, expectedId: string | null): boolean {
  if (!profile || (expectedId !== null && profile.id !== expectedId) || (command.zavrsi && profile.stanje !== 'ACTIVE')) return false;
  return (Object.keys(command) as (keyof AzurirajProfilKomanda)[]).every(key => key === 'zavrsi' || key === 'capacityRevision' ||
    equal(command[key], profile[key as keyof RadnikProfilProjekcija]));
}
