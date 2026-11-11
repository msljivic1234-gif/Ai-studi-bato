'use strict';

const { AndroidConfig, withAndroidManifest } = require('expo/config-plugins');

// Client configuration is not consent or token-lifecycle implementation.
// Keep both documented Firebase auto-registration prerequisites disabled.
module.exports = config => withAndroidManifest(config, mod => {
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
  for (const name of ['firebase_messaging_auto_init_enabled', 'firebase_analytics_collection_enabled']) {
    AndroidConfig.Manifest.addMetaDataItemToMainApplication(application, name, 'false');
  }
  return mod;
});
