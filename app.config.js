'use strict';
const { buildIdentity } = require('./scripts/build-identity.cjs');
const { assertProductionTarget } = require('./scripts/build-contract.cjs');

// Expo supplies normalized app.json, including each disposable workflow's
// package/label overrides. Never replace those with the preview identity.
// The Google Play identity (owner, 2026-09-23: "rs.uskoci"). Only the EAS production profile, the store app bundle,
// takes it; the preview APK and every CI build keep the package they are given. A package is permanent in Play Console.
const STORE_PACKAGE = 'rs.uskoci';
const PREVIEW_RUNTIME = 'uskoci-v1-preview-r1';
const PRODUCTION_RUNTIME = 'uskoci-v1-production-r1';
const UPDATE_URL = 'https://u.expo.dev/1e6cc490-9851-4741-9226-128612122db6';
const NEARBY_PERMISSION = 'USKOČI koristi jednu lokaciju kada izaberete „U blizini”, kako bi prikazao mapu zadataka u Vašoj okolini.';

module.exports = ({ config }) => {
  assertProductionTarget(process.env);
  const profile = process.env.EAS_BUILD_PROFILE;
  const otaTarget = process.env.USKOCI_OTA_TARGET;
  if (profile && otaTarget && ((profile === 'production') !== (otaTarget === 'production'))) {
    throw new Error('USKOCI_OTA_TARGET_PROFILE_MISMATCH');
  }
  const production = profile === 'production' || otaTarget === 'production';
  const channel = production ? 'production' : 'preview';
  const runtimeVersion = production ? PRODUCTION_RUNTIME : PREVIEW_RUNTIME;
  const android = { ...config.android };
  // Expo's template includes overlay access, but USKOČI has no draw-over-other-apps feature.
  android.blockedPermissions = [...new Set([...(android.blockedPermissions ?? []), 'android.permission.SYSTEM_ALERT_WINDOW'])];
  if (production) android.package = STORE_PACKAGE;
  android.permissions = [...new Set([...(android.permissions ?? []),
    'android.permission.ACCESS_FINE_LOCATION', 'android.permission.ACCESS_COARSE_LOCATION'])];
  const ios = { ...config.ios, infoPlist: { ...config.ios?.infoPlist,
    NSLocationWhenInUseUsageDescription: NEARBY_PERMISSION,
  } };
  const inertPlugin = './plugins/withFirebaseEnrollmentDisabled.js';
  const pushProof = process.env.USKOCI_PUSH_PROOF_BUILD === '1';
  const devAutoPush = process.env.EXPO_PUBLIC_USKOCI_DEV_AUTO_PUSH_ENROLL === '1';
  const plugins = (config.plugins ?? []).filter(plugin =>
    (Array.isArray(plugin) ? plugin[0] : plugin) !== inertPlugin);
  const mapPlugin = '@maplibre/maplibre-react-native';
  const photoPlugin = 'expo-image-picker';
  const locationPlugin = 'expo-location';
  if (!plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === locationPlugin)) {
    // A single foreground observation on explicit Nearby. No background tracking, service or motion permission.
    plugins.push([locationPlugin, {
      locationWhenInUsePermission: NEARBY_PERMISSION,
      locationAlwaysPermission: false,
      locationAlwaysAndWhenInUsePermission: false,
      motionUsagePermission: false,
      isIosBackgroundLocationEnabled: false,
      isAndroidBackgroundLocationEnabled: false,
      isAndroidForegroundServiceEnabled: false,
      isAndroidMotionActivityEnabled: false,
    }]);
  }
  if (!plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === photoPlugin)) {
    plugins.push([photoPlugin, {
      photosPermission: 'Izaberite fotografiju za svoj zadatak ili profil.',
      cameraPermission: 'USKOČI koristi kameru kada želite da dodate fotografiju zadatka ili profila.',
      microphonePermission: 'Držite mikrofon za razgovor sa USKOČI asistentom. Puštanje završava transkript koji možete da izmenite; poruku šaljete tek kada izaberete Pošalji.',
    }]);
  }
  if (!plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === mapPlugin)) {
    plugins.push(mapPlugin);
  }
  // A02/A03 (owner, 2026-10-02): foreground-only voice. Both background services are explicitly disabled.
  const audioPlugin = 'expo-audio';
  if (!plugins.some(plugin => (Array.isArray(plugin) ? plugin[0] : plugin) === audioPlugin)) {
    plugins.push([audioPlugin, {
      microphonePermission: 'Mikrofon se koristi samo dok držite dugme za snimanje glasovne poruke u razgovoru o Dogovoru.',
      recordAudioAndroid: true,
      enableBackgroundRecording: false,
      enableBackgroundPlayback: false,
    }]);
  }
  if (devAutoPush && (!pushProof || production || android.package !== 'rs.uskoci.preview'
    || process.env.EXPO_PUBLIC_SUPABASE_URL !== 'https://leqcwgzvjsxugfgzdmth.supabase.co')) {
    throw new Error('DEV_AUTO_PUSH_REQUIRES_ISOLATED_PREVIEW_PUSH_PROOF_BUILD');
  }
  if (pushProof && android.package !== 'rs.uskoci.preview') {
    throw new Error('USKOCI_PUSH_PROOF_BUILD_REQUIRES_PREVIEW_PACKAGE');
  }
  if (android.package === 'rs.uskoci.preview') {
    android.googleServicesFile = './config/firebase/google-services.json';
    // Ordinary preview builds stay consent-safe and provider-inert. The dedicated
    // push proof is the only build that may initialise Firebase Messaging.
    if (!pushProof) plugins.push(inertPlugin);
  } else {
    // Preview Firebase has no Android client for proof/dev/unknown packages.
    delete android.googleServicesFile;
  }
  // The side-by-side QA APK must keep the exact bundle being attested, even online.
  // Ordinary preview builds retain their existing OTA channel and behaviour.
  const isolatedQa = android.package === 'rs.uskoci.preview.qa';
  const updates = { ...config.updates, url: UPDATE_URL, enabled: !isolatedQa,
    checkAutomatically: isolatedQa ? 'NEVER' : 'ON_LOAD', fallbackToCacheTimeout: 0,
    requestHeaders: { ...(config.updates?.requestHeaders ?? {}), 'expo-channel-name': channel } };
  if (isolatedQa) updates.useEmbeddedUpdate = true;
  return { ...config, android, ios, plugins, runtimeVersion, updates, extra: { ...config.extra,
    uskociBuild: { ...buildIdentity({ root: __dirname, version: config.version }), runtimeVersion, updateChannel: channel },
  } };
};

module.exports.otaConfig = { PREVIEW_RUNTIME, PRODUCTION_RUNTIME, UPDATE_URL };
