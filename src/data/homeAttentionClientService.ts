import type { HomeAttention, HomeAttentionPreview } from './homeSnapshot';
import type { Izvor } from './ports';
import { prijava } from '../ui/system/plural';
import { readReceipt, record, sameId, timestamp, uuid } from './serverReceipt';

const countKeys = ['attention', 'attentionMore', 'activeAgreements', 'agreementsMore',
  'ownActiveTasks', 'activeApplications', 'activities', 'activitiesMore'] as const;
const reasons = ['AGREEMENT_CONFIRM_COMPLETION', 'AGREEMENT_OPEN_PROBLEM',
  'APPLICATION_STALE', 'APPLICATION_ATTENTION', 'TASK_APPLICATIONS'] as const;

/** Facts and ordering belong to rpc_home_attention; wording and navigation belong to the client.
 * Unknown/malformed projections are unavailable, never empty and never reconstructed from a page. */
export function decodeHomeAttention(raw: unknown): HomeAttentionPreview | null {
  const data = record(raw), counts = record(data?.counts);
  if (!data || data.schemaVersion !== 1 || !timestamp(data.asOf) || !counts || !Array.isArray(data.items)
      || data.items.length > 3 || !countKeys.every(key => Number.isSafeInteger(counts[key]) && (counts[key] as number) >= 0)) return null;
  const c = counts as Record<typeof countKeys[number], number>;
  if (!Number.isSafeInteger(c.ownActiveTasks + c.activeApplications)
      || c.activities !== c.ownActiveTasks + c.activeApplications
      || c.attentionMore !== Math.max(0, c.attention - 3)
      || c.agreementsMore !== Math.max(0, c.activeAgreements - 2)
      || c.activitiesMore !== Math.max(0, c.activities - 5)
      || data.items.length !== Math.min(3, c.attention)) return null;
  const rows: HomeAttention[] = [], ids = new Set<string>();
  let lastPriority = 0;
  for (const value of data.items) {
    const row = record(value);
    if (!row || !uuid(row.subjectId) || !uuid(row.taskId) || typeof row.taskTitle !== 'string'
        || !reasons.includes(row.reason as typeof reasons[number])) return null;
    const id = row.subjectId.toLowerCase(), taskId = row.taskId.toLowerCase(), reason = row.reason;
    const application = reason === 'APPLICATION_STALE' || reason === 'APPLICATION_ATTENTION';
    const agreement = reason === 'AGREEMENT_CONFIRM_COMPLETION' || reason === 'AGREEMENT_OPEN_PROBLEM';
    if (!(timestamp(row.sortAt) || application && row.sortAt === null)) return null;
    const priority = reason === 'AGREEMENT_CONFIRM_COMPLETION' ? 1 : agreement ? 2 : application ? 3 : 4;
    if (priority < lastPriority || ids.has(`${id}:${reason}`)) return null;
    lastPriority = priority; ids.add(`${id}:${reason}`);
    if (agreement) {
      if (!sameId(row.agreementId, id) || row.applicationId !== null || row.applicationCount !== null || c.activeAgreements < 1) return null;
      const confirm = reason === 'AGREEMENT_CONFIRM_COMPLETION';
      rows.push({ id: `agreement:${id}:${confirm ? 'confirm' : 'problem'}`,
        title: confirm ? 'Potvrdi završetak' : 'Prijavljen je problem',
        taskTitle: row.taskTitle,
        detail: confirm ? 'Završetak je označen.' : 'Automatski završetak je zaustavljen.',
        target: { kind: 'AGREEMENT', agreementId: id } });
    } else if (application) {
      if (!sameId(row.applicationId, id) || row.agreementId !== null || row.applicationCount !== null || c.activeApplications < 1) return null;
      const stale = reason === 'APPLICATION_STALE';
      rows.push({ id: `application:${id}:${stale ? 'stale' : 'attention'}`,
        title: stale ? 'Zadatak je izmenjen' : 'Prijava traži Vašu pažnju',
        taskTitle: row.taskTitle,
        detail: stale ? 'Pregledajte izmene pre odluke o prijavi.' : 'Otvorite svoju prijavu.',
        target: { kind: 'APPLICATION', applicationId: id } });
    } else {
      if (taskId !== id || row.agreementId !== null || row.applicationId !== null || c.ownActiveTasks < 1
          || !Number.isSafeInteger(row.applicationCount) || (row.applicationCount as number) < 1) return null;
      rows.push({ id: `need:${id}:applications`, title: prijava(row.applicationCount as number),
        taskTitle: row.taskTitle, detail: 'Čeka Vaš izbor.', target: { kind: 'CANDIDATES', needId: id } });
    }
  }
  // EX-04 S3 (RC-03): the rating aggregate is optional (an older server has none) and strict when it is there: a count, and the id exactly when the count is one.
  let ratings: HomeAttentionPreview['ratings'];
  if (Object.prototype.hasOwnProperty.call(data, 'ratings')) {
    const r = record(data.ratings);
    if (!r || !Number.isSafeInteger(r.due) || (r.due as number) < 0 || (r.due === 1 ? !uuid(r.dueAgreementId) : r.dueAgreementId !== null)) return null;
    ratings = { due: r.due as number, agreementId: r.due === 1 ? r.dueAgreementId as string : null };
  }
  return { rows, more: c.attentionMore, asOf: data.asOf, ...(ratings ? { ratings } : {}) };
}

export const homeAttentionClientService: Pick<Izvor, 'paznjaZaPocetnu'> = {
  async paznjaZaPocetnu() {
    const result = await readReceipt({ rpc: 'rpc_home_attention', args: {}, decode: decodeHomeAttention,
      errors: {}, fallback: 'HOME_ATTENTION_UNAVAILABLE', invalid: 'HOME_ATTENTION_INVALID' });
    if (!result.ok) throw new Error(result.kod);
    return result.podatak;
  },
};
