import { useCallback, useMemo } from 'react';
import { requesterProfileClientService } from '../../data/requesterProfileClientService';
import { useFocusedResource } from '../../hooks/useFocusedResource';

/** The name of the ACCOUNT as the screens that need it can hold it: still reading, not readable, or read (and `null` when the account has none). */
export type AccountName = { state: 'loading' } | { state: 'error'; retry: () => void }
  | { state: 'ready'; name: string | null; /** The account's own profile row (the one the photo belongs to), when the read returned it. */ profileId?: string | null };

/**
 * The one name of a person (owner, 8 Oct 2026: "Može, dobro vam jedno ime za sve."): the name of the account, which "Lični podaci" is the only
 * place to change. The work profile and the conversation with the assistant used to ask for a name of their own, so the owner was "Milos" on one
 * screen and "Pera peric" on the next; they now read THIS name (the same read as "Lični podaci", so the same word everywhere) and take it as
 * the name of the work profile. Read again whenever the screen is focused again, so a name changed in "Lični podaci" is what the next screen
 * says; a name that could not be read is `error` and never a name made up.
 */
export function useAccountName(): AccountName {
  const load = useCallback(async () => {
    const result = await requesterProfileClientService.read();
    if (!result.ok) throw new Error(result.kod);
    const name = result.podatak.displayName.trim();
    return { name: name.length ? name : null, profileId: result.podatak.profileId ?? null };
  }, []);
  const resource = useFocusedResource(load);
  const { loading, error, data, refresh } = resource;
  return useMemo<AccountName>(() => loading ? { state: 'loading' } : error ? { state: 'error', retry: () => { void refresh(); } }
    : { state: 'ready', name: data?.name ?? null, profileId: data?.profileId ?? null }, [loading, error, data, refresh]);
}
