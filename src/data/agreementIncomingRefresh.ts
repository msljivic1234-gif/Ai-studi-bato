type Subscription = { remove: () => void };
export type IncomingNotifications = {
  addNotificationReceivedListener: (listener: (value: unknown) => void) => Subscription;
  addNotificationsDroppedListener: (listener: () => void) => Subscription;
};

/** Push is only an invalidation hint. The caller re-reads canonical text/photo rows;
 * this controller never merges a payload, sends a command or acknowledges a message.
 * No timer runs without a hint. Bursts share one active read and one trailing read.
 */
export function createAgreementIncomingRefresh({ refresh, isCurrent }: {
  refresh: () => Promise<void>; isCurrent: () => boolean;
}) {
  let alive = true, pending = false, flight = false, nextReadAt = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const seen = new Set<string>();
  const current = () => alive && isCurrent();
  function drain() {
    if (!current() || !pending || flight || timer !== undefined) return;
    const delay = nextReadAt - Date.now();
    if (delay > 0) {
      timer = setTimeout(() => { timer = undefined; drain(); }, delay);
      return;
    }
    pending = false; flight = true; nextReadAt = Date.now() + 2_000;
    // Re-check after the microtask boundary; an account or focus change can retire
    // an otherwise valid hint before the caller starts any network read.
    void Promise.resolve().then(() => {
      if (!current()) return;
      // Hints received before this read starts are covered by it. Hints arriving
      // after dispatch still retain one trailing read, including another source.
      pending = false;
      return refresh();
    })
      .catch(() => undefined) // The owned resource exposes failure; a hint is never an unhandled rejection.
      .finally(() => { flight = false; drain(); });
  }
  return {
    hint(identifier?: string) {
      if (!current()) return;
      if (identifier !== undefined) {
        if (!identifier || identifier.length > 256 || seen.has(identifier)) return;
        seen.add(identifier);
        if (seen.size > 128) seen.delete(seen.values().next().value!);
      }
      pending = true; drain();
    },
    stop() {
      alive = false; pending = false; seen.clear();
      if (timer !== undefined) { clearTimeout(timer); timer = undefined; }
    },
  };
}

/** Returns disposal before the native module resolves. A late module resolution,
 * retained native callback or failed/partial subscription cannot revive its owner.
 */
export function subscribeAgreementIncomingRefresh({ load, identifier, refresh, isCurrent, onHint }: {
  load: () => Promise<IncomingNotifications>;
  identifier: (value: unknown) => string | null;
  refresh: () => Promise<void>; isCurrent: () => boolean;
  /** Optional shared owner; its caller owns coalescing and disposal. */
  onHint?: (identifier?: string) => void;
}): () => void {
  let alive = true;
  const subscriptions: Subscription[] = [];
  const current = () => alive && isCurrent();
  const coordinator = onHint ? undefined : createAgreementIncomingRefresh({ refresh, isCurrent: current });
  const hint = onHint ?? coordinator!.hint;
  const stop = () => {
    alive = false; coordinator?.stop();
    for (const subscription of subscriptions.splice(0)) {
      try { subscription.remove(); } catch { /* Ownership is already retired even if native removal fails. */ }
    }
  };
  void Promise.resolve().then(() => current() ? load() : null).then(native => {
    if (!native || !current()) return;
    subscriptions.push(native.addNotificationReceivedListener(value => {
      if (!current()) return;
      const id = identifier(value);
      if (id !== null) hint(id);
    }));
    if (!current()) { stop(); return; }
    subscriptions.push(native.addNotificationsDroppedListener(() => {
      if (current()) hint();
    }));
    if (!current()) stop();
  }).catch(stop);
  return stop;
}
