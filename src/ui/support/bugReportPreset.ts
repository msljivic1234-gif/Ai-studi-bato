import { readBuildIdentity, type BuildIdentity } from '../../data/buildIdentity';

/** What a new support request starts with when it is opened as a bug report: a title and the first words of the description. */
export type SupportPreset = { title: string; body: string };

/** The line that says which build the report is about: the version, and the first seven letters of the source it was built from. */
export const buildLine = (build: BuildIdentity): string =>
  `Verzija aplikacije: ${build.version ?? 'nije zabeležena'}${build.sourceCommit ? ` (${build.sourceCommit.slice(0, 7)})` : ''}`;

/**
 * "Prijavi grešku u aplikaciji" (R23): a request for technical help that already knows which build it is about, so whoever tests the app
 * does not have to look it up and type it. The build is the app's own public version and the short name of its source; nothing about
 * the person, their account or their device goes in. The person adds what happened under "Šta se desilo:", and the request cannot be sent
 * until they have (the words that were there already are not a report).
 */
export function bugReportPreset(build: BuildIdentity = readBuildIdentity()): SupportPreset {
  return { title: 'Greška u aplikaciji', body: `${buildLine(build)}\n\nŠta se desilo:\n` };
}
