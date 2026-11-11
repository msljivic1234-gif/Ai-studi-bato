import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DogovorProjekcija } from '../../contracts/projections';
import { agreementClientService } from '../../data/agreementClientService';
import type { Ishod } from '../../data/ports';
import { reviewCommentsClientService } from '../../data/reviewCommentsClientService';
import type { ReviewContext } from '../../data/reviewsClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { GIVEN_STEP, afterNextGiven, afterRetryGiven, failedGiven, finishedAgreements, hasOlderGiven, newestFirst, nextGiven, readGivenStep, startGiven,
  type GivenRating, type GivenState } from './givenRatings';

/** The list of Dogovori is read with the same patience the Dogovori screen has. */
const AGREEMENTS_MS = 15_000;
async function within<T>(request: Promise<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([request, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('AGREEMENTS_READ_TIMEOUT')), AGREEMENTS_MS); })]); }
  finally { if (timer !== undefined) clearTimeout(timer); }
}

/** The two reads, as module constants: a hook whose defaults were new functions on every render would restart its walk on every render. */
const readAllAgreements = () => agreementClientService.mojiDogovori({ includeRatings: false });
const readReceipt = (agreementId: string) => reviewCommentsClientService.context(agreementId);

export type GivenRatingsView = {
  /** `loading` until the first step has answered; `error` when the list of Dogovori itself could not be read. */
  phase: 'loading' | 'error' | 'ready';
  rows: readonly GivenRating[];
  /** How many Dogovori could not be asked about, so the screen never reads them as "not rated". */ failedCount: number;
  /** Finished Dogovori that have not been asked about yet. */ older: boolean;
  /** A step is running: the next page, or the second try of the failed ones. */ working: 'more' | 'retry' | null;
  more: () => void; retryFailed: () => void; refresh: () => void;
};

/**
 * The ratings a person gave (T4a, 2026-10-07), read in steps from what the app already reads. It reads when it mounts (the screen
 * mounts it only when the person opens the tab), keeps what it has when the screen is left and entered again, and starts over only
 * when the set of finished Dogovori really changed: a refresh that returns the same ones is silent.
 */
export function useGivenRatings(readAgreements: () => Promise<DogovorProjekcija[]> = readAllAgreements,
  readContext: (agreementId: string) => Promise<Ishod<ReviewContext>> = readReceipt, refreshRevision = 0): GivenRatingsView {
  const load = useCallback(() => within(readAgreements()), [readAgreements]);
  const agreements = useFocusedResource(load);
  const finished = useMemo(() => agreements.data ? finishedAgreements(agreements.data) : null, [agreements.data]);
  // The set of finished Dogovori, by what it is, not by which array carried it.
  const key = finished ? finished.map(agreement => agreement.id).join('|') : null;
  const [held, setHeld] = useState<{ key: string; state: GivenState } | null>(null);
  const [working, setWorking] = useState<'first' | 'more' | 'retry' | null>(null);
  const run = useRef(0), busy = useRef(false), latest = useRef(held);
  latest.current = held;

  useEffect(() => {
    if (finished === null || key === null) return;
    const mine = ++run.current;
    busy.current = false;
    const state = startGiven(finished);
    const previous = latest.current?.key === key ? latest.current.state : null;
    // Refresh every already-opened step on a genuine screen return, even if the Agreement IDs are unchanged.
    // Preserve the last good rows until the new owner read answers, and never merge an old rating over the new one.
    const slice = nextGiven(state, Math.max(GIVEN_STEP, previous?.asked ?? 0));
    if (!previous) { setHeld({ key, state }); setWorking('first'); }
    else setWorking(null);
    void readGivenStep(slice, readContext, () => run.current === mine).then(step => {
      if (!step) return;
      const fresh = afterNextGiven(state, step, slice.length);
      // A failed context read is unknown, not proof that an existing rating disappeared.
      const retained = previous?.rows.filter(row => step.failed.includes(row.agreementId)
        && !fresh.rows.some(next => next.agreementId === row.agreementId)) ?? [];
      setHeld(current => current && current.key === key ? { key,
        state: { ...fresh, rows: retained.length ? newestFirst([...fresh.rows, ...retained]) : fresh.rows } } : current);
      setWorking(null);
    });
    return () => { run.current++; };
    // A different finished set or an explicit screen-return revision restarts the owner receipt read.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, readContext, refreshRevision]);

  const step = useCallback((kind: 'more' | 'retry') => {
    const current = latest.current;
    if (!current || busy.current) return;
    const slice = kind === 'more' ? nextGiven(current.state) : failedGiven(current.state);
    if (!slice.length) return;
    const mine = run.current;
    busy.current = true; setWorking(kind);
    void readGivenStep(slice, readContext, () => run.current === mine).then(done => {
      busy.current = false;
      if (!done) return;
      setHeld(now => now && now.key === current.key ? { key: now.key,
        state: kind === 'more' ? afterNextGiven(now.state, done, slice.length) : afterRetryGiven(now.state, done, slice.map(agreement => agreement.id)) } : now);
      setWorking(null);
    });
  }, [readContext]);

  const state = held && held.key === key ? held.state : null;
  const phase = agreements.error ? 'error' : agreements.loading || !state || working === 'first' ? 'loading' : 'ready';
  return {
    phase, rows: state?.rows ?? [], failedCount: state?.failed.length ?? 0, older: state ? hasOlderGiven(state) : false,
    working: working === 'more' || working === 'retry' ? working : null,
    more: () => step('more'), retryFailed: () => step('retry'), refresh: () => { void agreements.refresh('load'); },
  };
}
