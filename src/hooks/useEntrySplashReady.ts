import { useCallback, useEffect, useRef, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { releaseEntrySplash } from '../bootstrap/entrySplashBootstrap';

export type EntrySplashReadiness = 'pending' | 'ready' | 'skip';

/** Entry requires prepared source artwork; this never controls Auth. */
export function useEntrySplashReady({ enabled = true, waitForScene = false }: {
  enabled?: boolean; waitForScene?: boolean;
} = {}) {
  const [laidOut, setLaidOut] = useState(false);
  const [sceneReady, setSceneReady] = useState(false);
  const [sceneWaitExpired, setSceneWaitExpired] = useState(false);
  const [readiness, setReadiness] = useState<EntrySplashReadiness>('pending');
  const mounted = useRef(true), skipLatched = useRef(false), sceneAcknowledged = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const onSceneReady = useCallback(() => {
    if (!mounted.current || skipLatched.current) return;
    sceneAcknowledged.current = true;
    setSceneReady(true);
  }, []);
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    if (event.nativeEvent.layout.width > 0 && event.nativeEvent.layout.height > 0) setLaidOut(true);
  }, []);

  useEffect(() => {
    if (!enabled || !laidOut || !waitForScene || sceneReady || skipLatched.current) return;
    const timeout = setTimeout(() => {
      if (!mounted.current || sceneAcknowledged.current) return;
      skipLatched.current = true;
      setReadiness('skip'); setSceneWaitExpired(true);
    }, 1000);
    return () => clearTimeout(timeout);
  }, [enabled, laidOut, waitForScene, sceneReady]);

  useEffect(() => {
    if (!enabled || !laidOut) return;
    if (waitForScene && !sceneReady) {
      if (!sceneWaitExpired) return;
      // This effect follows the React commit selecting static welcome. If the
      // UI observer failed, skip motion explicitly and give that static view a
      // draw opportunity before release. Never relabel this fallback as ready.
      let active = true;
      let frame = requestAnimationFrame(() => {
        if (!active) return;
        frame = requestAnimationFrame(() => {
          if (active) void releaseEntrySplash().catch(() => {});
        });
      });
      return () => { active = false; cancelAnimationFrame(frame); };
    }
    if (skipLatched.current) return;
    let active = true;
    let settled = false;
    let frame: number | undefined;
    const settle = (value: EntrySplashReadiness) => {
      if (!active || settled) return;
      settled = true;
      if (value === 'skip') skipLatched.current = true;
      clearTimeout(timeout);
      if (frame !== undefined) cancelAnimationFrame(frame);
      setReadiness(value);
    };
    // A broken native bridge must skip cosmetic motion rather than trap entry.
    // A timeout is never treated as evidence that the animation is visible.
    const timeout = setTimeout(() => settle('skip'), 1000);
    const reveal = async () => {
      try {
        // SDK57 hideAsync requests removal; disable its default 400ms exit fade.
        SplashScreen.setOptions({ duration: 0, fade: false });
        await releaseEntrySplash();
        if (!active || settled) return;
        // Entry holds the first nonempty source sample throughout this request.
        // SDK57 acknowledgement is not an overlay-removal fence. The clock also
        // waits for later UI frames before resuming the unchanged remaining time.
        frame = requestAnimationFrame(() => {
          if (!active || settled) return;
          frame = requestAnimationFrame(() => settle('ready'));
        });
      } catch {
        settle('skip');
      }
    };
    void reveal();
    return () => {
      active = false;
      clearTimeout(timeout);
      if (frame !== undefined) cancelAnimationFrame(frame);
    };
  }, [enabled, laidOut, sceneReady, waitForScene, sceneWaitExpired]);

  return { readiness, onLayout, onSceneReady };
}
