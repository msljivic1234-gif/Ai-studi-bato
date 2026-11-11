import { sesijaSada } from '../store/sesija';
import type { Uloga } from '../contracts/projections';
import { supabaseKlijent } from './supabaseClient';

export type OwnProfileIdentity = {
  accountId: string;
  profileId: string;
  kind: 'REQUESTER' | 'WORKER';
  ime: string | null;
  grad: string | null;
  /** Only meaningful for the work profile: whether tasks can be offered to this account at all. */
  stanje: 'DRAFT' | 'ACTIVE' | 'SUSPENDED' | null;
};

const optionalText = (value: unknown) => typeof value === 'string' && value.trim() ? value.trim() : null;

/** Own identity only. Public trust and other accounts use their separate RPC projection. */
export const ownProfileClientService = {
  async read(accountId: string, intent: Uloga): Promise<OwnProfileIdentity | null> {
    if (!accountId) throw new Error('AUTH_REQUIRED');
    const start = sesijaSada();
    if (!start.user) throw new Error('AUTH_REQUIRED');
    const current = () => sesijaSada().user?.id === accountId && sesijaSada().accountRevision === start.accountRevision;
    if (!current()) throw new Error('PROFILE_ACCOUNT_CHANGED');
    const kind = intent === 'narucilac' ? 'REQUESTER' : 'WORKER';
    const supabase = supabaseKlijent();
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (!current()) throw new Error('PROFILE_ACCOUNT_CHANGED');
      if (authError || !userData.user) throw new Error('AUTH_REQUIRED');
      if (userData.user.id !== accountId) throw new Error('PROFILE_ACCOUNT_CHANGED');

      const { data, error } = await supabase.from('app_profiles')
        .select('id,account_id,kind,display_name,city,profile_status')
        .eq('account_id', userData.user.id)
        .eq('kind', kind)
        .maybeSingle();
      if (!current()) throw new Error('PROFILE_ACCOUNT_CHANGED');
      if (error) throw new Error('OWN_PROFILE_READ_FAILED');
      if (!data) return null;
      if (data.account_id !== accountId || data.kind !== kind || typeof data.id !== 'string' || !data.id) {
        throw new Error('OWN_PROFILE_INVALID_SCOPE');
      }
      return {
        accountId,
        profileId: data.id,
        kind,
        ime: optionalText(data.display_name),
        grad: optionalText(data.city),
        stanje: data.profile_status === 'DRAFT' || data.profile_status === 'ACTIVE' || data.profile_status === 'SUSPENDED'
          ? data.profile_status : null,
      };
    } catch (error) {
      if (!current()) throw new Error('PROFILE_ACCOUNT_CHANGED');
      if (error instanceof Error && ['AUTH_REQUIRED', 'PROFILE_ACCOUNT_CHANGED', 'OWN_PROFILE_READ_FAILED', 'OWN_PROFILE_INVALID_SCOPE'].includes(error.message)) throw error;
      throw new Error('OWN_PROFILE_READ_FAILED');
    }
  },
};
