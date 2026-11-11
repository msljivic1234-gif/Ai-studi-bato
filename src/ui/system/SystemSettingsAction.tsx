import { useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { V2Action } from '../v2/V2Action';

const FAILED = 'Otvaranje podešavanja nije potvrđeno. Pokušajte ponovo ili ih otvorite ručno.';
const openNativeSettings = () => Linking.openSettings();

/** Opening the OS page is not permission consent. The calling screen still reads
 * the actual permission on return. Keep a failed launch visible and retryable. */
export function SystemSettingsAction({ open = openNativeSettings }: { open?: () => void | Promise<void> }) {
  const [state, setState] = useState<'idle' | 'opening' | 'error'>('idle');
  const owner = useRef({ alive: false, sequence: 0, busy: false, timer: undefined as ReturnType<typeof setTimeout> | undefined });
  useEffect(() => {
    const lifetime = owner.current; lifetime.alive = true;
    return () => {
      lifetime.alive = false; lifetime.sequence++; lifetime.busy = false;
      if (lifetime.timer !== undefined) clearTimeout(lifetime.timer);
    };
  }, []);
  const launch = () => {
    const lifetime = owner.current;
    if (!lifetime.alive || lifetime.busy) return;
    lifetime.busy = true;
    const sequence = ++lifetime.sequence;
    setState('opening');
    const settle = (result: 'idle' | 'error') => {
      if (!lifetime.alive || lifetime.sequence !== sequence || !lifetime.busy) return;
      lifetime.busy = false;
      if (lifetime.timer !== undefined) clearTimeout(lifetime.timer);
      lifetime.timer = undefined;
      setState(result);
    };
    // A native bridge that never answers must not leave this action locked forever.
    lifetime.timer = setTimeout(() => settle('error'), 10000);
    try { Promise.resolve(open()).then(() => settle('idle'), () => settle('error')); }
    catch { settle('error'); }
  };
  return <V2Action label="Podešavanja telefona" onPress={launch} loading={state === 'opening'}
    error={state === 'error' ? FAILED : null} style={{ maxWidth: '100%', flexShrink: 1 }} />;
}
