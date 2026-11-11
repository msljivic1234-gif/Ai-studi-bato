import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import type { AuthAvailability } from '../contracts/authAvailability';
import { authAvailabilityClientService } from '../data/authAvailabilityClientService';

type AvailabilityState =
  | { status: 'loading'; data: null }
  | { status: 'error'; data: null }
  | { status: 'ready'; data: AuthAvailability };

export function useAuthAvailability(enabled: boolean) {
  const [state, setState] = useState<AvailabilityState>({ status: 'loading', data: null });
  const revision = useRef(0);
  const active = useRef(false);
  const pending = useRef<AbortController | null>(null);
  const currentData = useRef<AuthAvailability | null>(null);
  const current = useCallback(() => currentData.current, []);
  const cancel = useCallback(() => {
    revision.current++;
    currentData.current = null;
    pending.current?.abort();
    pending.current = null;
  }, []);
  const retry = useCallback(async () => {
    if (!active.current) return;
    cancel();
    const ownRevision = revision.current;
    const controller = new AbortController();
    pending.current = controller;
    setState({ status: 'loading', data: null });
    const current = () => active.current && ownRevision === revision.current && !controller.signal.aborted;
    try {
      const data = await authAvailabilityClientService.read(controller.signal);
      if (current()) {
        currentData.current = data;
        setState({ status: 'ready', data });
      }
    } catch {
      if (current()) setState({ status: 'error', data: null });
    } finally {
      if (pending.current === controller) pending.current = null;
    }
  }, [cancel]);
  useEffect(() => {
    active.current = enabled;
    if (!enabled) return;
    void retry();
    const subscription = AppState.addEventListener('change', value => {
      if (value === 'active') {
        active.current = true;
        void retry();
      } else {
        active.current = false;
        cancel();
        setState({ status: 'loading', data: null });
      }
    });
    return () => { active.current = false; cancel(); subscription.remove(); };
  }, [enabled, retry, cancel]);
  return { ...state, retry, current };
}
