import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MarketplaceView } from '../data/marketplaceView';
import { maySeedWorkArea, workAreaBounds, type WorkAreaCamera } from '../data/discoveryWorkArea';
import { workerLocationClientService } from '../data/locationClientService';
import { sesijaSada } from '../store/sesija';
import { izvorSada } from '../store/uloga';

export const WORK_AREA_CAMERA_WAIT_MS = 4_000;
type Visit = { valid: boolean; dispatched: boolean; focus: object; timer?: ReturnType<typeof setTimeout> };

/** One optional owned read. It never blocks the task collection, asks for GPS, writes a profile or changes filters. */
export function useDiscoveryWorkArea({ accountId, accountRevision, source, focus, focusRef, view, publication }: {
  accountId: string | null; accountRevision: number; source: unknown; focus: object | null; focusRef: { readonly current: object | null };
  view: MarketplaceView; publication: boolean;
}) {
  const lifetime = useMemo(() => ({ started: false, retired: false, visit: null as Visit | null }), [accountId, accountRevision, source]);
  const live = useRef({ lifetime, focus, publication }); live.current = { lifetime, focus, publication };
  const [entry, setEntry] = useState<{ lifetime: typeof lifetime; visit: Visit; target: WorkAreaCamera } | null>(null);
  const entryRef = useRef(entry); entryRef.current = entry;
  const owns = useCallback(() => !!accountId && live.current.lifetime === lifetime && !lifetime.retired
    && live.current.focus !== null && focusRef.current === live.current.focus
    && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision && izvorSada() === source,
  [accountId, accountRevision, source, lifetime, focusRef]);
  const retire = useCallback(() => {
    if (live.current.lifetime !== lifetime) return;
    lifetime.retired = true;
    if (lifetime.visit) { lifetime.visit.valid = false; clearTimeout(lifetime.visit.timer); }
    setEntry(current => current?.lifetime === lifetime ? null : current);
  }, [lifetime]);
  useEffect(() => {
    if (!focus || !owns() || lifetime.started || publication || !maySeedWorkArea(view)) return;
    lifetime.started = true;
    const visit: Visit = { valid: true, dispatched: false, focus }; lifetime.visit = visit;
    const current = () => owns() && visit.valid && live.current.focus === focus && !live.current.publication;
    visit.timer = setTimeout(() => {
      visit.valid = false;
      setEntry(value => value?.visit === visit ? null : value);
    }, WORK_AREA_CAMERA_WAIT_MS);
    // Bound waiting, not server execution. A late reply after timeout/exit/new intent cannot move the camera.
    void Promise.resolve().then(() => {
      if (!current()) return null;
      visit.dispatched = true; return workerLocationClientService.read();
    }).then(result => {
      if (!current()) return;
      clearTimeout(visit.timer);
      if (!result?.ok || result.podatak.accountId !== accountId) { visit.valid = false; return; }
      const bounds = workAreaBounds(result.podatak);
      if (!bounds) { visit.valid = false; return; }
      setEntry({ lifetime, visit, target: { key: `${accountId}:${accountRevision}:${result.podatak.revision}`, bounds } });
    }, () => { clearTimeout(visit.timer); visit.valid = false; });
    return () => {
      visit.valid = false; clearTimeout(visit.timer);
      // StrictMode setup/cleanup replay before the first microtask must not consume the one real read.
      if (!visit.dispatched && !lifetime.retired && lifetime.visit === visit) lifetime.started = false;
    };
    // `view` is sampled once on entry: a measured initial camera is not a manual pan. Actual user intent retires above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, accountRevision, source, focus, publication, lifetime, owns]);
  const handled = useCallback((key: string) => {
    const value = entryRef.current;
    if (owns() && value?.lifetime === lifetime && value.target.key === key && value.visit.valid
      && value.visit.focus === live.current.focus) retire();
  }, [owns, lifetime, retire]);
  const target = entry?.lifetime === lifetime && entry.visit.valid && entry.visit.focus === focus
    && !publication && owns() ? entry.target : null;
  return { target, retire, handled };
}
