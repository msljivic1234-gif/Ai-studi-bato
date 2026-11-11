import { useCallback } from 'react';
import { dataExportClientService } from '../../data/dataExportClientService';
import type { Ishod } from '../../data/ports';
import { legalClientService } from '../../data/legalClientService';
import { safetyClientService } from '../../data/safetyClientService';
import { supportCaseClientService } from '../../data/supportCaseClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';
import { sesijaSada } from '../../store/sesija';
import { blockedFrom, exportPhaseFrom, legalFrom, openSupportCases, type HubStates } from './hubStates';

/** The parts of the account whose state a row can say. */
export type HubStateKey = 'support' | 'blocked' | 'export' | 'legal';

/** One read that cannot hurt the screen: a failure or a refusal is "not known", never an error and never a made-up answer. */
async function known<T>(wanted: boolean, run: () => Promise<Ishod<T>>): Promise<T | undefined> {
  if (!wanted) return undefined;
  try { const result = await run(); return result.ok ? result.podatak : undefined; } catch { return undefined; }
}

/**
 * The state of the rows of the profile and of "Privatnost i podaci" (approved draft, 8 Oct 2026, P1 and P5): how many support requests are open, how many people
 * are blocked, where the export is, whether the legal documents are published and accepted. The reads are the app's own, each one independent: a part that cannot
 * be read has no word on its row (`HubStates` leaves it out) and the screen does not change. They run again whenever the screen is focused again, so a
 * block made on another screen is what the row says on the way back; the first read shows nothing, and later reads keep the last answer under them.
 */
export function useHubStates(keys: readonly HubStateKey[]): HubStates {
  const wanted = keys.join(',');
  const load = useCallback(async (): Promise<HubStates> => {
    const owner = sesijaSada(), accountId = owner.user?.id;
    if (!accountId) return {};
    const scope = { accountId, accountRevision: owner.accountRevision };
    const on = (key: HubStateKey) => wanted.split(',').includes(key);
    const [inbox, blocks, status, bundle] = await Promise.all([
      known(on('support'), () => supportCaseClientService.inbox('OWN', null, scope)),
      known(on('blocked'), () => safetyClientService.listMyBlocks(null)),
      known(on('export'), () => dataExportClientService.readStatus()),
      known(on('legal'), () => legalClientService.readBundle()),
    ]);
    return { support: openSupportCases(inbox), blocked: blockedFrom(blocks), exportPhase: exportPhaseFrom(status, Date.now()), legal: legalFrom(bundle) };
  }, [wanted]);
  const resource = useFocusedResource(load);
  return resource.data ?? {};
}
