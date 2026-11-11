'use strict';

// Public build requirements only. This does not attest a live backend release.
const DEV_URL = 'https://leqcwgzvjsxugfgzdmth.supabase.co';
const SIGNED_REVIEW_ENV = Object.freeze({
  EXPO_PUBLIC_USKOCI_NEED_SIGNED_REVIEW: 'true',
  EXPO_PUBLIC_USKOCI_WORKER_SIGNED_REVIEW: 'true',
  EXPO_PUBLIC_USKOCI_WORKER_CONFIRMED_MODES: 'true',
});
// EAS, CI and OTA must select the same bounded own-task/application/candidate readers.
const PAGED_READ_ENV = Object.freeze({
  EXPO_PUBLIC_EX04_OWN_TASKS_PAGED: '1',
  EXPO_PUBLIC_EX04_OWN_APPLICATIONS_PAGED: '1',
  EXPO_PUBLIC_EX04_CANDIDATES_PAGED: '1',
});
const REQUIRED_BUILD_ENV = Object.freeze({ ...SIGNED_REVIEW_ENV, ...PAGED_READ_ENV });

function assertProductionTarget(environment) {
  if (environment.EAS_BUILD_PROFILE === 'production' || environment.USKOCI_OTA_TARGET === 'production') {
    // A separate production project/client/readiness receipt has not been configured.
    // An environment override is not evidence that DEV is safe for a store app.
    throw new Error('USKOCI_PRODUCTION_NOT_CONFIGURED: configure and verify the separate production backend and release contract before a store build or production OTA.');
  }
}

function assertDevBuildContract(environment) {
  assertProductionTarget(environment);
  if (environment.EXPO_PUBLIC_SUPABASE_URL !== DEV_URL) {
    throw new Error('EXPO_PUBLIC_SUPABASE_URL must identify the confirmed canonical DEV project.');
  }
  for (const [key, value] of Object.entries(REQUIRED_BUILD_ENV)) {
    if (environment[key] !== value) throw new Error(`USKOCI_BUILD_CONTRACT_MISMATCH:${key}`);
  }
}

module.exports = { DEV_URL, SIGNED_REVIEW_ENV, PAGED_READ_ENV, REQUIRED_BUILD_ENV, assertProductionTarget, assertDevBuildContract };
if (require.main === module) {
  try {
    assertDevBuildContract(process.env);
    console.log('DEV build contract PASS: canonical target, signed AI review and bounded reader flags.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
