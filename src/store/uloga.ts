import { useSyncExternalStore } from 'react';
import { izvor as defaultIzvor } from '../data';
import type { Izvor } from '../data/ports';

/**
 * The data source the app reads through. This file also used to hold the app's global mode
 * ("uloga": MENI TREBA / JA MOGU), a per-account preference that chose the tab shell, stood in the
 * cache identity of every screen and gated what a person could do. Owner decision 1 of 2026-09-19
 * removed it: one account owns tasks, applies to others and holds Dogovori on both sides at once,
 * and what it is to a thing is read from that thing. The file keeps its name because forty
 * modules import the source from here; `src/store/__tests__/v3-no-global-mode.test.ts` keeps the
 * mode from coming back.
 */
let trenutniIzvor: Izvor = defaultIzvor;
const pretplatnici = new Set<() => void>();

export function postaviIzvor(i: Izvor) {
  if (trenutniIzvor === i) return;
  trenutniIzvor = i;
  pretplatnici.forEach((f) => f());
}

export function izvorSada(): Izvor {
  return trenutniIzvor;
}

export function useIzvor(): Izvor {
  return useSyncExternalStore(
    (f) => {
      pretplatnici.add(f);
      return () => pretplatnici.delete(f);
    },
    izvorSada,
    izvorSada,
  );
}
