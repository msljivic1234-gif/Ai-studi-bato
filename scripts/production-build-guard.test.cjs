'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const eas = require('../eas.json');
const { assertProductionTarget, assertDevBuildContract } = require('./build-contract.cjs');
const { validatePreview } = require('./check-eas-preview.cjs');
const preview = { ...eas.build.preview.env, EAS_BUILD_PROFILE: 'preview', EAS_BUILD_PLATFORM: 'android' };

test('the reviewed DEV preview still passes its build contract', () => {
  assert.doesNotThrow(() => assertProductionTarget(preview));
  assert.doesNotThrow(() => assertDevBuildContract(preview));
  assert.throws(() => assertDevBuildContract({ ...preview, EXPO_PUBLIC_SUPABASE_URL: 'https://different.supabase.co' }), /confirmed canonical DEV/);
});
for (const target of [{ EAS_BUILD_PROFILE: 'production' }, { USKOCI_OTA_TARGET: 'production' }]) {
  test(`production ${Object.keys(target)[0]} cannot bypass readiness with the old override`, () => {
    for (const override of [undefined, 'true', 'false']) {
      const env = { ...preview, ...target, USKOCI_ALLOW_STORE_BUILD: override };
      assert.throws(() => assertProductionTarget(env), /USKOCI_PRODUCTION_NOT_CONFIGURED/);
      assert.throws(() => assertDevBuildContract(env), /USKOCI_PRODUCTION_NOT_CONFIGURED/);
      assert.throws(() => validatePreview({ env }), /USKOCI_PRODUCTION_NOT_CONFIGURED/);
    }
  });
}
test('the retained store profile has no DEV endpoint, DEV client key or bypass', () => {
  const profile = eas.build.production;
  assert.equal(profile.android.buildType, 'app-bundle');
  assert.equal(profile.distribution, 'store');
  for (const key of ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_ANON_KEY', 'USKOCI_ALLOW_STORE_BUILD'])
    assert.equal(Object.hasOwn(profile.env, key), false);
});
function resolveConfig(env, packageName, check) {
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const app = require('./app.json').expo;
    app.android.package = ${JSON.stringify(packageName)};
    const resolved = require('./app.config.js')({config:app});
    ${check}
  `], { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8' });
  return result;
}
test('actual isolated QA config retains its identity, embedded source and no Firebase', () => {
  const result = resolveConfig({ ...preview, USKOCI_PUSH_PROOF_BUILD: '0', EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL: '0' },
    'rs.uskoci.preview.qa', `
      assert.equal(resolved.android.package,'rs.uskoci.preview.qa');
      assert.equal(resolved.updates.enabled,false);
      assert.equal(resolved.updates.checkAutomatically,'NEVER');
      assert.equal(resolved.updates.useEmbeddedUpdate,true);
      assert.equal(resolved.android.googleServicesFile,undefined);
    `);
  assert.equal(result.status, 0, result.stderr);
});
test('actual Expo production config fails before building even with old override', () => {
  const result = resolveConfig({ ...preview, EAS_BUILD_PROFILE: 'production', USKOCI_OTA_TARGET: 'production', USKOCI_ALLOW_STORE_BUILD: 'true' },
    'rs.uskoci.preview', '');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /USKOCI_PRODUCTION_NOT_CONFIGURED/);
});
test('the isolated QA package still rejects preview push-proof flags', () => {
  const result = resolveConfig(preview, 'rs.uskoci.preview.qa', '');
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /DEV_AUTO_PUSH_REQUIRES_ISOLATED_PREVIEW_PUSH_PROOF_BUILD|USKOCI_PUSH_PROOF_BUILD_REQUIRES_PREVIEW_PACKAGE/);
});
