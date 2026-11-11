import type { PhotoSource } from '../../features/media/nativePhotoPicker';
import type { ConfirmRequest } from '../system/ConfirmSheet';
import { plural } from '../system/plural';

/**
 * The words of adding photos, said the same way in the task conversation, its photo screen and the Dogovor (owner,
 * 2026-10-07: "chat should use ready-made elements, e.g. adding photos must make sense"). Every place that adds, removes,
 * resends or explains a photo takes its words from here, so the two chats can never drift apart again ("Izaberi iz
 * galerije" / "Fotografiši" in one, "Galerija" / "Kamera" in the other, until this file).
 */

/** The most photos a task draft or one Dogovor message can carry (the server holds the same limit). */
export const PHOTO_LIMIT = 6;

export const PHOTO_SOURCE_WORDS: Readonly<Record<PhotoSource, string>> = { LIBRARY: 'Galerija', CAMERA: 'Kamera' };

export const PHOTO_WORDS = {
  /** The "+" and the sheet it opens. */
  add: 'Dodaj fotografije',
  /** Same-key resend of a photo whose outcome was not confirmed. */
  retry: 'Pošalji ponovo',
  /** The server-owned way out of an unconfirmed send. */
  cancel: 'Odustani od slanja',
  /** A read of what the server holds now. */
  check: 'Proveri fotografije',
  /** A photo the server could not process. The read model carries no reason (technical or content), so none is invented. */
  failed: 'Fotografija nije obrađena. Pokušaj ponovo ili izaberi drugu.',
} as const;

export type PhotoScope = 'TASK' | 'AGREEMENT';

/** The one limits sentence, word for word what each surface promised before (privacy text), now said the same way. */
export function photoLimits(scope: PhotoScope): string {
  return scope === 'TASK'
    ? `Do ${PHOTO_LIMIT} fotografija, do 10 MB po slici. Uklanjamo metapodatke i smanjujemo slike. Nacrt vidiš samo ti; fotografije postaju dostupne uz objavljen zadatak.`
    : `Do ${PHOTO_LIMIT} fotografija uz poruku, do 10 MB po slici. Fotografije su privatne za ovaj Dogovor; uklanjamo metapodatke.`;
}

/** The task photos' processing notice, word for word (privacy text). It stands before every pick of a task photo. */
export const TASK_PHOTO_NOTICE = 'Izabrane fotografije šaljemo Google Gemini servisu radi provere sadržaja pre objave. Obrada može biti van Evrope i uključuje privremene bezbednosne zapise kod Google-a.';

/** Serbian count of photos, by the one plural rule: 1 fotografija, 2 fotografije, 5 fotografija. */
export const photoCount = (count: number): string => plural(count, 'fotografija', 'fotografije', 'fotografija');

/** What the gallery row promises: as many as are still free, or one. */
export function librarySubtitle(remaining: number): string {
  return remaining > 1 ? `Izaberi do ${photoCount(remaining)}` : 'Izaberi jednu fotografiju';
}

/** Removing a saved photo asks first; the sheet stays open until the removal settles. */
export function removalRequest(scope: PhotoScope, onConfirm: () => void | Promise<unknown>): ConfirmRequest {
  return { title: 'Ukloniti fotografiju?', message: scope === 'TASK' ? 'Fotografija se uklanja iz nacrta zadatka.'
    : 'Fotografija se uklanja iz poruke koju pripremaš.', confirmLabel: 'Ukloni', tone: 'danger', onConfirm };
}
