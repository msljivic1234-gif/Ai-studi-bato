/**
 * EX-04 TEST INSTRUMENT, NOT A PRODUCT VALUE (owner decision 2026-10-01, "opcija A"): lets the physical-device check cross the page boundary of the three paged personal lists
 * (S1 "Moji zadaci", S2 "Moje prijave", S4 "Prijave za zadatak") with the data a test account really has (at most 19 tasks, 4 applications and 2 candidates against product pages
 * of 30, 30 and 50).
 *
 * One compile-time variable, `EXPO_PUBLIC_EX04_TEST_PAGE_LIMIT`, read ONLY from the DEV APK workflow while the check runs; it is absent from `eas.json`, `app.json`, every other workflow
 * and every release profile (`ex04-test-page-limit-guard.test.ts` pins that). A build without it - which is every build but the test build - takes `undefined` here and the pagers keep the
 * product limits (OWN_TASKS_PAGE_LIMIT, OWN_APPLICATIONS_PAGE_LIMIT, CANDIDATES_PAGE_LIMIT) byte for byte. Anything but a whole number from 1 to 10 is ignored the same way.
 *
 * S4: no task of the test data has more than two candidates, so a page limit of 2 would never have a second page there; the candidate list therefore reads pages of one less than the
 * test value (never below 1) - with the owner-approved value 2 that is pages of 1, so two candidates are two pages.
 */
export const EX04_TEST_PAGE_LIMIT_MIN = 1;
export const EX04_TEST_PAGE_LIMIT_MAX = 10;

export function ex04TestPageLimit(raw: unknown = process.env.EXPO_PUBLIC_EX04_TEST_PAGE_LIMIT): number | undefined {
  if (typeof raw !== 'string' || !/^(?:10|[1-9])$/.test(raw)) return undefined;
  return Number(raw);
}

export function ex04TestCandidatesPageLimit(raw: unknown = process.env.EXPO_PUBLIC_EX04_TEST_PAGE_LIMIT): number | undefined {
  const value = ex04TestPageLimit(raw);
  return value === undefined ? undefined : Math.max(1, value - 1);
}
