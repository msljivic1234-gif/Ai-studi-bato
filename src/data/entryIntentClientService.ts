import { povratniCilj, type GuestSessionIntent } from '../store/povratniCilj';
import { sesijaSada } from '../store/sesija';

/** Pre-auth UI intent only. Auth runtime completes it for the actual signed-in actor. */
export const entryIntentClientService = {
  async prepare(intent: GuestSessionIntent['intent'], selectionIsCurrent: () => boolean = () => true) {
    const owner = sesijaSada();
    let active = true;
    const current = () => active && selectionIsCurrent() && !owner.user && !sesijaSada().user && sesijaSada().accountRevision === owner.accountRevision;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const expiry = new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          active = false;
          reject(new Error('ENTRY_INTENT_STORAGE_TIMEOUT'));
        }, 5000);
      });
      const record = await Promise.race([
        povratniCilj.prepare({ intent, returnTarget: { kind: 'NONE' } }, current), expiry,
      ]);
      if (!record || !current()) throw new Error('AUTH_ACCOUNT_CHANGED');
    } finally {
      // The serialized store will roll back a timed-out late write before the
      // next queued intent. Timeout never grants a stale guest write authority.
      active = false;
      if (timer) clearTimeout(timer);
    }
  },
};
