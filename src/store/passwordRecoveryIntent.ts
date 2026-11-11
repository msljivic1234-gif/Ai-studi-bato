/** A transient callback handoff, never persisted, logged, or a marketplace session. */
export interface PasswordRecoveryIntent { readonly id: number; readonly link: string }
let current: PasswordRecoveryIntent | null = null;
let revision = 0;
const listeners = new Set<() => void>();

export const passwordRecoveryIntent = {
  snapshot: (): PasswordRecoveryIntent | null => current,
  serverSnapshot: (): null => null,
  publish(link: string): void {
    current = { id: ++revision, link: link.length <= 24_576 ? link : '' };
    for (const listener of listeners) listener();
  },
  clear(expectedId: number): void {
    if (current?.id !== expectedId) return;
    current = null;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      const released = current?.id;
      // React Strict Mode re-subscribes in the same turn. Dispose only after
      // the last actual consumer leaves, without erasing a newer callback.
      queueMicrotask(() => {
        if (!listeners.size && current?.id === released) current = null;
      });
    };
  },
};
