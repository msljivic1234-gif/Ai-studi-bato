'use strict';

// Keep generated paths without parsing historical HTML during installation.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const targets = {
  'uskoci-entry-city.webp': 'assets/generated/uskoci-entry-city.webp',
  'uskoci-rounded.ttf': 'assets/generated/uskoci-rounded.ttf',
  'entryReferenceData.ts.txt': 'src/ui/referenceEntry/entryReferenceData.ts',
};
function syncEntryAssets(projectRoot = root) {
  const sourceRoot = path.join(projectRoot, 'assets/brand/reference-entry');
  const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'provenance.json'), 'utf8'));
  if (manifest.schemaVersion !== 1 || !Array.isArray(manifest.files) || manifest.files.length !== Object.keys(targets).length) throw new Error('ENTRY_ASSET_MANIFEST_INVALID');
  const seen = new Set();
  // Validate every input before writing any output; targets are code-owned.
  const prepared = manifest.files.map(item => {
    if (!Object.hasOwn(targets, item.name) || seen.has(item.name) || targets[item.name] !== item.target) throw new Error('ENTRY_ASSET_TARGET_INVALID');
    seen.add(item.name);
    const bytes = fs.readFileSync(path.join(sourceRoot, item.name));
    if (bytes.length !== item.bytes || crypto.createHash('sha256').update(bytes).digest('hex') !== item.sha256) throw new Error(`ENTRY_ASSET_HASH_MISMATCH:${item.name}`);
    return { target: path.join(projectRoot, targets[item.name]), bytes };
  });
  for (const item of prepared) {
    fs.mkdirSync(path.dirname(item.target), { recursive: true });
    if (!fs.existsSync(item.target) || !fs.readFileSync(item.target).equals(item.bytes)) fs.writeFileSync(item.target, item.bytes);
  }
  return prepared.length;
}
module.exports = { syncEntryAssets };
if (require.main === module) console.log(`[entry-assets] ${syncEntryAssets()} preserved resources verified; no HTML build input.`);
