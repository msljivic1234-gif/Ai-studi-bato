// Count-only latency evidence. No prompts, IDs, coordinates, provider bodies or errors.
// A telemetry failure must never change the operation's result or retry it.
const phases = new Set(['PROVIDER', 'CATALOG_TOOLS', 'ADMISSION', 'ACCOUNTING',
  'NEED_FULL_CATALOG', 'NEED_TAXONOMY_VALIDATE', 'WORKER_FULL_CATALOG', 'WORKER_TAXONOMY_VALIDATE',
  'NEED_CATALOG_START', 'NEED_CATALOG_VERIFY', 'NEED_BG_ARCHITECT', 'NEED_COMPLETE', 'NEED_HINT_CAPTURE',
  'WORKER_CATALOG_START', 'WORKER_CATALOG_VERIFY', 'WORKER_BG_ARCHITECT', 'WORKER_COMPLETE', 'WORKER_HINT_CAPTURE']);
/** @template T
 * @param {string} phase
 * @param {() => Promise<T>} operation
 * @returns {Promise<T>}
 */
export async function measureAiPhase(phase, operation) {
  const started = Date.now();
  let succeeded = false;
  try {
    const result = await operation();
    succeeded = true;
    return result;
  } finally {
    try { console.info('AI_PHASE_MS', phases.has(phase) ? phase : 'UNKNOWN',
      Math.max(0, Date.now() - started), succeeded ? 'SUCCEEDED' : 'FAILED'); }
    catch { /* Logging never changes delivery or accounting. */ }
  }
}
