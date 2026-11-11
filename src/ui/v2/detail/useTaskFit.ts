import { useEffect, useRef, useState } from 'react';
import type { PrilikaProjekcija, DogovorProjekcija } from '../../../contracts/projections';
import type { Izvor } from '../../../data/ports';
import type { TaskRelation } from '../../../data/taskRelation';
import { sesijaSada } from '../../../store/sesija';
import { taskFit, type TaskFitContext } from './taskFit';

/**
 * R25: what my own plans and work area say about the task I am reading, read once beside the task and never in front of it. The reads are optional: the page is complete
 * without them, a failed or slow one leaves its row out (the page says nothing about what it could not read), and an answer that lands after the person left, after the task
 * changed or under another account is dropped. Only a task that is somebody else's and that I have not applied to has a "before you apply" to speak of.
 */
export function useTaskFit({ prilika, relation, izvor, accountId, accountRevision }: {
  prilika: PrilikaProjekcija | null; relation: TaskRelation; izvor: Pick<Izvor, 'mojiDogovori'>; accountId: string | undefined; accountRevision: number;
}): TaskFitContext | undefined {
  const [read, setRead] = useState<{ key: string; fit: TaskFitContext } | null>(null);
  const key = prilika && accountId && relation.kind === 'NONE' && prilika.primaNovePrijave !== false ? JSON.stringify([
    accountId, accountRevision, prilika.id, prilika.revision,
    prilika.schedule?.kind, prilika.schedule?.startsAt, prilika.schedule?.endsAt,
    prilika.priblizno?.lat, prilika.priblizno?.lng, prilika.detalji?.rezimLokacije,
  ]) : null;
  const live = useRef({ prilika, izvor, key }); live.current = { prilika, izvor, key };
  useEffect(() => {
    // Retiring a read also retires its result, even if the same task returns after a refresh.
    setRead(null);
    const task = live.current.prilika;
    if (!key || !accountId || !task) return;
    let alive = true;
    const same = () => alive && live.current.key === key && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
    const agreements = async (): Promise<readonly DogovorProjekcija[] | null> => {
      try { return typeof live.current.izvor.mojiDogovori === 'function' ? await live.current.izvor.mojiDogovori({ includeRatings: false }) : null; } catch { return null; }
    };
    // The location service is required when the read is made, not with the screen: it brings the whole transport with it (and its listeners), and a task that is not open to this person never needs it.
    const workArea = async () => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { workerLocationClientService } = require('../../../data/locationClientService') as typeof import('../../../data/locationClientService');
        const result = await workerLocationClientService.read();
        const position = result?.ok && result.podatak.accountId === accountId ? result.podatak.approximatePosition : null;
        return position ? { lat: position.latitude, lng: position.longitude } : null;
      } catch { return null; }
    };
    void Promise.all([agreements(), workArea()]).then(([held, area]) => {
      if (!same()) return;
      const fit = taskFit({ schedule: task.schedule, pin: task.priblizno, remote: task.detalji?.rezimLokacije === 'REMOTE', agreements: held, workArea: area });
      setRead(fit.overlapTitle || typeof fit.distanceKm === 'number' ? { key, fit } : null);
    });
    return () => { alive = false; };
  }, [key, accountId, accountRevision]);
  return read && read.key === key ? read.fit : undefined;
}
