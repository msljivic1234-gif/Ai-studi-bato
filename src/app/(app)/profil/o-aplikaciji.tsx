import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { AboutView } from '../../../ui/settings/AboutPresentation';

/**
 * What USKOČI is, the two ways into its rules, and the build detail support may ask for. The route owns the focus fence and the
 * navigation (one way onward per visit); what is drawn is `AboutView`.
 */
export default function AboutUskoci() {
  const focus = useRef<object | null>(null), navigating = useRef(false);
  const [token, setToken] = useState<object | null>(null);
  useFocusEffect(useCallback(() => { const token = {}; focus.current = token; navigating.current = false;
    setToken(token);
    return () => { if (focus.current === token) focus.current = null; };
  }, []));
  const navigate = (action: () => void) => { if (!token || focus.current !== token || navigating.current) return;
    navigating.current = true; action(); };
  return <AboutView onBack={() => navigate(() => router.canGoBack() ? router.back() : router.replace('/profil'))}
    onRules={() => navigate(() => router.push('/profil/pravna'))} onPrivacy={() => navigate(() => router.push('/profil/privatnost'))} />;
}
