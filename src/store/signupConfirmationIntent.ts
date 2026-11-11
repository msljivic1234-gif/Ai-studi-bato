import type { SignupReturnKind } from '../data/signupConfirmationReturn';

/** Only a safe outcome category survives routing; never a URL, token, email or provider message. */
export interface SignupConfirmationIntent { readonly id: number; readonly kind: SignupReturnKind }
let current: SignupConfirmationIntent | null = null;
let revision = 0;
const listeners = new Set<() => void>();

export const signupConfirmationIntent = {
  snapshot: (): SignupConfirmationIntent | null => current,
  serverSnapshot: (): null => null,
  publish(kind: SignupReturnKind): void {
    current = { id: ++revision, kind };
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
      queueMicrotask(() => {
        if (!listeners.size && current?.id === released) current = null;
      });
    };
  },
};
