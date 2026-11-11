const fs = require('node:fs');
const path = require('node:path');
try {
  const envPath = path.resolve(__dirname, '.env');
  if (fs.existsSync(envPath)) {
    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
      if (match) {
        const key = match[1];
        let value = (match[2] || '').trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1);
        }
        if (!process.env[key]) {
          process.env[key] = value;
        }
      }
    }
  }
} catch (_e) {}

const { getDefaultConfig } = require('expo/metro-config');
const { createHash } = require('node:crypto');
const { resolve } = require('node:path');
const config = getDefaultConfig(__dirname);

// Shared/hoisted node_modules can give sibling checkouts the same transform
// key, although Expo Router embeds a different app root in _ctx.android.js.
// Keep Expo's version and cache stores; isolate transforms by the absolute
// project path used by Babel (not its realpath, which can collapse aliases).
const projectCacheId = createHash('sha256').update(resolve(config.projectRoot)).digest('hex');
config.cacheVersion = `${config.cacheVersion}:uskoci-project-${projectCacheId}`;

// Metro can read thousands of warm-cache entries concurrently even with one
// transform worker. Bound Windows disk opens without replacing Expo's cache,
// changing cached values, or swallowing a cache error. Other hosts stay default.
if (process.platform === 'win32') {
  let active = 0;
  const queue = [];
  const limit = 32;
  function drain() {
    while (active < limit && queue.length) {
      const { operation, resolve, reject } = queue.shift();
      active += 1;
      Promise.resolve().then(operation).then(resolve, reject).finally(() => {
        active -= 1;
        drain();
      });
    }
  }
  function bounded(operation) {
    return new Promise((resolve, reject) => {
      queue.push({ operation, resolve, reject });
      drain();
    });
  }
  config.cacheStores = config.cacheStores.map(store => ({
    name: store.name ?? store.constructor.name,
    get: key => bounded(() => store.get(key)),
    set: (key, value) => bounded(() => store.set(key, value)),
    clear: () => store.clear(),
  }));
}
module.exports = config;
