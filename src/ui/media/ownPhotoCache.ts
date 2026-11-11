import { AppState } from 'react-native';
import type { MediaPreview } from '../../data/mediaClientService';
import { sesijaSada } from '../../store/sesija';

/**
 * The signed-in person's OWN photograph, remembered in memory and nowhere else.
 *
 * The owner's phone (8 Oct 2026) showed the face in the header and on the profile one moment and only the letter the stand-in draws the next,
 * because every visit to a screen read the picture again and drew the letter until it arrived. Reading a face takes two steps, and both are
 * remembered here: which picture the profile has (a short description) and then the picture itself (a data URI built from its bytes).
 *
 * What this is NOT: another person's photograph, a task's or a message's are never remembered (`AuthorizedPhoto` and `ProfilePhoto` ask for this
 * only when they are given `own`), and nothing is written to disk or to expo-image's cache.
 *
 * The rules, each one held by a test:
 * - A record belongs to one account, one account revision and one profile (a picture also to one asset). A record of another account or revision
 *   is never found, and is thrown away by the next record that is accepted. A new photograph is a new asset, so it is a new key.
 * - A description is not read again for `OWN_PHOTO_FRESH_MS`. Up to `OWN_PHOTO_KEEP_MS` it is still drawn while the profile is asked again, so the
 *   face is never replaced by a letter while the app stays in front; older than that it is forgotten. A profile without a photograph is not
 *   remembered, and the answer that says so also forgets the pictures it had.
 * - At most `OWN_PHOTO_MAX_ENTRIES` descriptions and pictures; the least recently used goes first. A picture too large to hold is not remembered.
 * - Leaving the foreground (AppState is not 'active') forgets everything, and a read that began before that cannot remember anything after it.
 * - `forget()` is for whoever knows the records are of no use: the screen that saves, replaces or removes the photograph (profil/fotografija), and the
 *   header when its account goes away (signed out, or another one signed in).
 */

/** A description is not read again within this time. */
export const OWN_PHOTO_FRESH_MS = 10 * 60_000;
/** Nothing older than this is drawn from memory. */
export const OWN_PHOTO_KEEP_MS = 30 * 60_000;
export const OWN_PHOTO_MAX_ENTRIES = 4;
/** About 2.2 MB of JPEG as a data URI. The server keeps a photograph far below this; a larger one is simply read again. */
const MAX_PICTURE_LENGTH = 3_000_000;

/** The authority a record is kept under: the account and the revision of its session. */
export type OwnPhotoScope = Readonly<{ accountId: string; accountRevision: number }>;
/** What the profile was last said to have, and whether that is recent enough not to be asked again. */
export type RememberedPhoto = Readonly<{ photo: MediaPreview; fresh: boolean }>;

type Entry = { scope: string; profileId: string; at: number };
type Description = Entry & { photo: MediaPreview };
type Picture = Entry & { assetId: string; uri: string };

const descriptions = new Map<string, Description>();
const pictures = new Map<string, Picture>();
/** Counts the times everything was forgotten: a read remembers only if none happened since it began. */
let generation = 0;
let watching = false;

const scopeKey = (scope: OwnPhotoScope) => `${scope.accountId}|${scope.accountRevision}`;
const pictureKey = (scope: string, profileId: string, assetId: string) => `${scope}|${profileId}|${assetId}`;

function forgetAll() {
  descriptions.clear(); pictures.clear(); generation++;
}

/** Subscribes once, when the first read begins; there is nothing to forget before that. Without AppState nothing could be forgotten, so nothing is remembered. */
function watch(): boolean {
  if (watching) return true;
  try {
    AppState.addEventListener('change', state => { if (state !== 'active') forgetAll(); });
    watching = true;
  } catch { watching = false; }
  return watching;
}

/** The test runner reports `currentState` as a function, and RN as nothing before it has heard from the OS: only these two mean "not in front". */
function inBackground() {
  const state = AppState.currentState as unknown;
  return state === 'background' || state === 'inactive';
}

/** The session the record would belong to is still the signed-in one, and nothing was forgotten since the read began. */
function accepts(scope: OwnPhotoScope, mark: number) {
  const session = sesijaSada();
  return watching && mark === generation && !inBackground()
    && !!session.user?.id && session.user.id === scope.accountId && session.accountRevision === scope.accountRevision;
}

/** An entry in its time, moved to the most recently used place. An entry from the future (the clock was set back) is not believed either. */
function lookup<E extends Entry>(map: Map<string, E>, key: string): { entry: E; age: number } | undefined {
  const entry = map.get(key);
  if (!entry) return undefined;
  const age = Date.now() - entry.at;
  map.delete(key);
  if (age < 0 || age > OWN_PHOTO_KEEP_MS) return undefined;
  map.set(key, entry);
  return { entry, age };
}

function store<E>(map: Map<string, E>, key: string, entry: E) {
  map.delete(key); map.set(key, entry);
  for (const oldest of map.keys()) { if (map.size <= OWN_PHOTO_MAX_ENTRIES) break; map.delete(oldest); }
}

/** Only one account is signed in at a time: whatever another scope left behind goes when a record of this one is accepted. */
function dropForeign(scope: string) {
  for (const [key, entry] of descriptions) if (entry.scope !== scope) descriptions.delete(key);
  for (const [key, entry] of pictures) if (entry.scope !== scope) pictures.delete(key);
}

export const ownPhotoCache = {
  /** The profile's photograph as it was last said to be, or nothing when that is not known (or too old to be drawn). */
  description(scope: OwnPhotoScope, profileId: string): RememberedPhoto | undefined {
    const found = lookup(descriptions, `${scopeKey(scope)}|${profileId}`);
    return found ? { photo: found.entry.photo, fresh: found.age <= OWN_PHOTO_FRESH_MS } : undefined;
  },

  /** The picture of exactly this asset, in this profile's context, or nothing. */
  image(scope: OwnPhotoScope, profileId: string, assetId: string): string | undefined {
    return lookup(pictures, pictureKey(scopeKey(scope), profileId, assetId))?.entry.uri;
  },

  /** Taken when a read begins and handed back with its answer. */
  mark(): number {
    watch();
    return generation;
  },

  /**
   * What the profile says it has. `null` is the authoritative "no photograph": nothing about this profile is remembered any more. A photograph
   * other than the one remembered replaces it and takes its pictures with it; the same photograph is confirmed, so its picture is as recent as
   * this answer.
   */
  rememberDescription(scope: OwnPhotoScope, profileId: string, photo: MediaPreview | null, mark: number) {
    if (!accepts(scope, mark)) return;
    const id = scopeKey(scope), now = Date.now();
    dropForeign(id);
    for (const [key, picture] of pictures) {
      if (picture.scope !== id || picture.profileId !== profileId) continue;
      if (photo && picture.assetId === photo.assetId) picture.at = now; else pictures.delete(key);
    }
    if (photo) store(descriptions, `${id}|${profileId}`, { scope: id, profileId, photo, at: now });
    else descriptions.delete(`${id}|${profileId}`);
  },

  rememberImage(scope: OwnPhotoScope, profileId: string, assetId: string, uri: string, mark: number) {
    if (!accepts(scope, mark) || uri.length > MAX_PICTURE_LENGTH) return;
    const id = scopeKey(scope);
    dropForeign(id);
    store(pictures, pictureKey(id, profileId, assetId), { scope: id, profileId, assetId, uri, at: Date.now() });
  },

  /** A picture that could not be drawn is not kept. */
  forgetImage(scope: OwnPhotoScope, profileId: string, assetId: string) {
    pictures.delete(pictureKey(scopeKey(scope), profileId, assetId));
  },

  /** Everything: the person changed or removed the photograph, or the app left the foreground. */
  forget: forgetAll,
};
