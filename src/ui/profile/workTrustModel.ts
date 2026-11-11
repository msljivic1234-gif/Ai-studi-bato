import type { PublicWorkTrust } from '../../data/workTrustClientService';
import { zadataka } from '../system/plural';

/**
 * What the trust numbers of the profile SAY (PROFILE-TRUST, 2026-10-07; R30). The server decides what a person may see and returns
 * it (`workTrustClientService`); this file only turns what came back into the words and rows a screen draws, and it never adds
 * a figure of its own: no percentage is computed here (the server's definition is "finished ÷ (finished + cancelled by the worker)",
 * a count the public read does not carry), and a part the server did not return is left out, not replaced by a placeholder.
 * No sentence promises anonymity (owner decision A10).
 */

const MONTHS_OF = ['januara', 'februara', 'marta', 'aprila', 'maja', 'juna', 'jula', 'avgusta', 'septembra', 'oktobra', 'novembra', 'decembra'];
/** "oktobra 2026" from the first day of the month the server returns ("2026-10-01"); anything that is not such a date says nothing. */
export function monthYear(memberSince: string | null | undefined): string | null {
  const match = typeof memberSince === 'string' ? /^(\d{4})-(\d{2})(?:-\d{2}.*)?$/.exec(memberSince) : null;
  const month = match ? Number(match[2]) : 0;
  return match && month >= 1 && month <= 12 ? `${MONTHS_OF[month - 1]} ${match[1]}` : null;
}
/** "Na USKOČI-ju od oktobra 2026": the one phrase for how long a person has been here. */
export const memberSincePhrase = (memberSince: string | null | undefined): string | null => {
  const when = monthYear(memberSince);
  return when ? `Na USKOČI-ju od ${when}` : null;
};

/** The name of the reliability fact everywhere it is said. */
export const RELIABILITY_LABEL = 'Dolazi kako je dogovoreno';

/** What the percentage is made of, said once under the figures of the person's own statistics. */
export const RELIABILITY_MEANING = 'Računa se iz završenih Dogovora i onih koje otkažeš ti. Otkazivanje druge strane se ne računa.';
/** What a visitor reads when the server has no percentage yet: a sentence about the person, not about the reader. */
export const RELIABILITY_FEW = 'Još nema dovoljno Dogovora za procenat';

/* ---------------------------------------------------------------------------------------------------- a public profile */

/** What the public trust block adds to a profile, for a viewer the server allows it: a part is absent when the server did not return it. */
export type PublicTrustFacts = {
  /** "Dogovoreno 12 zadataka". */ agreed: string | null;
  reliability: { kind: 'percent'; percent: number } | { kind: 'few' } | null;
  /** "Na USKOČI-ju od oktobra 2026". */ since: string | null;
};
/**
 * The facts the sheet shows beside the rating and "Završeno N". HIDDEN (the default today: only the person themself reads these) is
 * NOTHING: no row, no placeholder, no word about what is hidden. `null` and a missing answer are nothing as well.
 */
export function publicTrustFacts(trust: PublicWorkTrust | null | undefined): PublicTrustFacts | null {
  if (!trust || trust.reliabilityState === 'HIDDEN') return null;
  return {
    agreed: trust.agreedCount === null ? null : `Dogovoreno ${zadataka(trust.agreedCount)}`,
    reliability: trust.reliabilityState === 'AVAILABLE' && trust.reliabilityPercent !== null ? { kind: 'percent', percent: trust.reliabilityPercent }
      : { kind: 'few' },
    since: memberSincePhrase(trust.memberSince),
  };
}
