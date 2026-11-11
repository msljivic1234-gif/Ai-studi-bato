import { NEED_FACT_SCHEMA_V2 } from '../contracts/needFactsV2';
import { sesijaSada } from '../store/sesija';
import { supabaseKlijent } from './supabaseClient';
import { readOwnedResult, record, sameId, timestamp, uuid } from './serverReceipt';

export type OpenIntake = { id: string; createdAt: string; title?: string };
export type OpenIntakePage = { rows: OpenIntake[]; next: OpenIntake | null };
export const OPEN_INTAKE_PAGE_SIZE = 20;
const FIELDS = ['id', 'account_id', 'purpose', 'status', 'fact_schema_version', 'bound_need_id', 'created_at'] as const;
const TITLE_FIELDS = ['account_id', 'conversation_id', 'fact_key', 'fact_schema_version', 'value_type', 'scope', 'status', 'fact_value', 'superseded_at'] as const;
const ownerNow = () => {
  const session = sesijaSada(), accountId = session.user?.id;
  if (!uuid(accountId) || !Number.isSafeInteger(session.accountRevision) || session.accountRevision < 0)
    throw new Error('Prijavi se da nastaviš.');
  return { accountId, accountRevision: session.accountRevision };
};
const assertOwner = (account: ReturnType<typeof ownerNow>) => {
  if (sesijaSada().user?.id !== account.accountId || sesijaSada().accountRevision !== account.accountRevision)
    throw new Error('Nalog je promenjen. Ponovo otvori započete razgovore.');
};

/** Metadata only: no prompts, addresses or message bodies on Home. Existing SELECT RLS still owns access.
 * Keep PostgreSQL's microseconds in the cursor; Date.toISOString() would skip rows born in the same millisecond. */
export async function listOpenIntakes(before: OpenIntake | null = null): Promise<OpenIntakePage> {
  if (before && (!uuid(before.id) || !timestamp(before.createdAt))) throw new Error('Ponovo otvori započete razgovore.');
  const account = ownerNow();
  const result = await readOwnedResult({ account, errors: {}, fallback: 'AI_INTAKE_LIST_UNAVAILABLE', invalid: 'AI_INTAKE_LIST_INVALID',
    request: () => {
      let query = supabaseKlijent().from('ai_conversations').select(FIELDS.join(','))
        .eq('account_id', account!.accountId).eq('purpose', 'NEED_INTAKE').eq('status', 'OPEN')
        .eq('fact_schema_version', NEED_FACT_SCHEMA_V2).is('bound_need_id', null)
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(OPEN_INTAKE_PAGE_SIZE + 1);
      // uuid/timestamp above accept no PostgREST punctuation: this raw filter cannot change its structure.
      if (before) query = query.or(`created_at.lt.${before.createdAt},and(created_at.eq.${before.createdAt},id.lt.${before.id})`);
      return query;
    },
    decode(raw): OpenIntakePage | null {
      if (!account || !Array.isArray(raw) || raw.length > OPEN_INTAKE_PAGE_SIZE + 1) return null;
      const rows: OpenIntake[] = [], seen = new Set<string>();
      for (const value of raw) {
        const row = record(value);
        if (!row || Object.keys(row).length !== FIELDS.length || !FIELDS.every(key => Object.hasOwn(row, key))
          || !uuid(row.id) || !sameId(row.account_id, account.accountId) || row.purpose !== 'NEED_INTAKE'
          || row.status !== 'OPEN' || row.fact_schema_version !== NEED_FACT_SCHEMA_V2 || row.bound_need_id !== null
          || !timestamp(row.created_at) || seen.has(row.id.toLowerCase())) return null;
        seen.add(row.id.toLowerCase()); rows.push({ id: row.id, createdAt: row.created_at });
      }
      const page = rows.slice(0, OPEN_INTAKE_PAGE_SIZE);
      return { rows: page, next: rows.length > OPEN_INTAKE_PAGE_SIZE ? page[page.length - 1] : null };
    },
  });
  if (!result.ok) throw new Error(result.poruka);
  const page = result.podatak;
  if (!page.rows.length) return page;
  // One confirmed public title per displayed conversation. Never fetch messages,
  // evidence, display_value or any private fact; older pages are not prefetched.
  const ids = page.rows.map(row => row.id), allowed = new Set(ids.map(id => id.toLowerCase()));
  const titles = await readOwnedResult({ account, errors: {}, fallback: 'AI_INTAKE_TITLES_UNAVAILABLE', invalid: 'AI_INTAKE_TITLES_INVALID',
    request: () => supabaseKlijent().from('ai_structured_facts').select(TITLE_FIELDS.join(','))
      .eq('account_id', account.accountId).in('conversation_id', ids).eq('fact_key', 'need.title')
      .eq('fact_schema_version', NEED_FACT_SCHEMA_V2).eq('value_type', 'TEXT').eq('scope', 'NEED_DRAFT')
      .eq('status', 'CONFIRMED').is('superseded_at', null).limit(OPEN_INTAKE_PAGE_SIZE + 1),
    decode(raw): Record<string, string> | null {
      if (!Array.isArray(raw) || raw.length > ids.length) return null;
      const found: Record<string, string> = {}, seen = new Set<string>();
      for (const value of raw) {
        const fact = record(value);
        if (!fact || Object.keys(fact).length !== TITLE_FIELDS.length || !TITLE_FIELDS.every(key => Object.hasOwn(fact, key))
          || !sameId(fact.account_id, account.accountId) || !uuid(fact.conversation_id) || !allowed.has(fact.conversation_id.toLowerCase())
          || seen.has(fact.conversation_id.toLowerCase()) || fact.fact_key !== 'need.title' || fact.fact_schema_version !== NEED_FACT_SCHEMA_V2
          || fact.value_type !== 'TEXT' || fact.scope !== 'NEED_DRAFT' || fact.superseded_at !== null
          || fact.status !== 'CONFIRMED') return null;
        const id = fact.conversation_id.toLowerCase(); seen.add(id);
        if (typeof fact.fact_value !== 'string' || !fact.fact_value.trim() || Array.from(fact.fact_value).length > 140 || fact.fact_value.includes('\0')) return null;
        found[id] = fact.fact_value.trim().replace(/\s+/g, ' ');
      }
      return found;
    },
  });
  assertOwner(account);
  // A failed optional title read must not hide otherwise valid saved drafts.
  return titles.ok ? { ...page, rows: page.rows.map(row => titles.podatak[row.id.toLowerCase()]
    ? { ...row, title: titles.podatak[row.id.toLowerCase()] } : row) } : page;
}

/** Readback for removal recovery; absence is not a successful abandonment receipt. */
export async function readIntakeLifecycle(id: string): Promise<{ id: string; status: 'OPEN' | 'COMPLETED' | 'ABANDONED'; boundNeedId: string | null }> {
  if (!uuid(id)) throw new Error('Ponovo otvori započete razgovore.');
  const account = ownerNow();
  const result = await readOwnedResult({ account, errors: {}, fallback: 'AI_INTAKE_STATE_UNAVAILABLE', invalid: 'AI_INTAKE_STATE_INVALID',
    request: () => supabaseKlijent().from('ai_conversations').select(FIELDS.join(','))
      .eq('id', id).eq('account_id', account.accountId).eq('purpose', 'NEED_INTAKE').eq('fact_schema_version', NEED_FACT_SCHEMA_V2).maybeSingle(),
    decode(raw): { id: string; status: 'OPEN' | 'COMPLETED' | 'ABANDONED'; boundNeedId: string | null } | null {
      const row = record(raw);
      if (!row || Object.keys(row).length !== FIELDS.length || !FIELDS.every(key => Object.hasOwn(row, key))
        || !sameId(row.id, id) || !sameId(row.account_id, account.accountId) || row.purpose !== 'NEED_INTAKE'
        || row.fact_schema_version !== NEED_FACT_SCHEMA_V2 || !timestamp(row.created_at)
        || (row.bound_need_id !== null && !uuid(row.bound_need_id))
        || (row.status !== 'OPEN' && row.status !== 'COMPLETED' && row.status !== 'ABANDONED')) return null;
      return { id: row.id, status: row.status, boundNeedId: row.bound_need_id as string | null };
    },
  });
  if (!result.ok) throw new Error(result.poruka);
  return result.podatak;
}
