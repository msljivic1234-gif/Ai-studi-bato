'use strict';
const { execFileSync } = require('node:child_process');

const COMMIT = /^[0-9a-f]{40}$/;
const CANONICAL_HOST = 'leqcwgzvjsxugfgzdmth.supabase.co';

function backendTarget(value) {
  if (!value) return 'unconfigured';
  try {
    const url = new URL(value);
    if (url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) return 'other';
    if (url.protocol === 'https:' && url.hostname === CANONICAL_HOST && !url.port) return 'canonical';
    if (['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost', '10.0.2.2'].includes(url.hostname)) return 'local';
  } catch { /* Unknown deployment identity is not a canonical fallback. */ }
  return 'other';
}

/** Public, bounded build provenance only. It cannot activate a server capability. */
function buildIdentity({ root, version, environment = process.env, git = execFileSync }) {
  let sourceCommit = null;
  let sourceDirty = null;
  try {
    const options = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 2000 };
    const commit = git('git', ['rev-parse', 'HEAD'], options).trim();
    if (COMMIT.test(commit)) {
      sourceCommit = commit;
      sourceDirty = git('git', ['status', '--porcelain', '--untracked-files=normal'], options).trim().length > 0;
    }
  } catch { /* An exported source may have no .git directory. */ }
  if (!sourceCommit) {
    const declared = environment.USKOCI_BUILD_COMMIT || environment.EAS_BUILD_GIT_COMMIT_HASH || environment.GITHUB_SHA;
    if (typeof declared === 'string' && COMMIT.test(declared)) sourceCommit = declared;
  }
  return {
    schemaVersion: 1,
    version: typeof version === 'string' && version.length <= 64 && /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version) ? version : null,
    sourceCommit,
    sourceDirty,
    backendTarget: backendTarget(environment.EXPO_PUBLIC_SUPABASE_URL),
    // A client build never attests which DB migration or Edge release is live.
    backendRelease: null,
  };
}

module.exports = { buildIdentity, backendTarget };
