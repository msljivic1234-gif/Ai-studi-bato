import type { Izvor } from '../../data/ports';

/**
 * What came of putting the account's name into the work profile:
 * - `none`: the account has no work profile, so there is nothing to write (a profile made later takes the account's name, `nameForSave`);
 * - `done`: the work profile carries the name, written now or already the same, and read back;
 * - `failed`: the read, the write or the readback did not confirm it. The caller SAYS so and offers the write again.
 */
export type WorkNameWrite = 'none' | 'done' | 'failed';

async function bounded<T>(request: () => Promise<T>, milliseconds: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([request(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('PROFILE_TIMEOUT')), milliseconds); })]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}

/**
 * ONE NAME (owner, 8 Oct 2026, "Može, dobro vam jedno ime za sve."): "Lični podaci" saves the account's name and, when the account has a work profile, the
 * same name into it. This is the second write. It goes through the existing writer of the work profile (`azurirajRadnikProfil`, which here carries only the
 * name and `zavrsi: false`, so it neither activates nor changes any other part) and is read back before it is called done: a name saved on one side and not on
 * the other is never left silent. Every failure, including a read that throws, is `failed`; nothing here throws.
 */
export async function writeWorkName(izvor: Pick<Izvor, 'mojRadnikProfil' | 'azurirajRadnikProfil'>, name: string,
  stillOwner: () => boolean = () => true, expectedWorkName?: string): Promise<WorkNameWrite> {
  const wanted = name.trim();
  if (!wanted || !stillOwner()) return 'failed';
  try {
    const before = await bounded(() => izvor.mojRadnikProfil(), 15_000);
    if (!stillOwner()) return 'failed';
    if (!before) return 'none';
    // A retry must not overwrite a newer name that another session saved after this screen's read.
    if (before.ime.trim() === wanted) return 'done';
    if (expectedWorkName !== undefined && before.ime.trim() !== expectedWorkName.trim()) return 'failed';
    const result = await bounded(() => {
      if (!stillOwner()) throw new Error('PROFILE_SCOPE_CHANGED');
      return izvor.azurirajRadnikProfil({ zavrsi: false, ime: wanted });
    }, 65_000);
    if (!stillOwner() || !result.ok) return 'failed';
    const after = await bounded(() => izvor.mojRadnikProfil(), 15_000);
    return stillOwner() && after && after.ime.trim() === wanted ? 'done' : 'failed';
  } catch { return 'failed'; }
}
