/** One wall-clock budget for catalog bootstrap, provider rounds and final
 * verification. The caller keeps its original signal for the atomic completion
 * and receipt tail; disposing research must not cancel that confirmed writer. */
export function createResearchDeadline(parent: AbortSignal, startedAt: number) {
  const controller = new AbortController();
  const end = startedAt + 42000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const stop = () => controller.abort();
  const remainingMs = () => Math.max(0, end - Date.now());
  parent.addEventListener('abort', stop, { once: true });
  if (parent.aborted || remainingMs() <= 0) stop();
  else timer = setTimeout(stop, remainingMs());
  return {
    signal: controller.signal,
    remainingMs,
    dispose() {
      clearTimeout(timer);
      parent.removeEventListener('abort', stop);
      controller.abort();
    },
  };
}
