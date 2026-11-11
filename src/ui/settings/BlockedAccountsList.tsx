import { StyleSheet, View } from 'react-native';
import type { MyBlockedAccounts } from '../../data/safetyClientService';
import { inicijali } from '../../lib/inicijali';
import { StateView } from '../system/StateView';
import { QuietReadState } from '../v2/QuietReadState';
import { SettingsText as T, SettingsGroup, SettingsPersonRow, SettingsAction } from './SettingsPresentation';

export type BlockedAccount = MyBlockedAccounts['items'][number];
/** A blocked person whose public name the server did not return; never letters or a name made up for them. */
export const UNKNOWN_BLOCKED_NAME = 'Ime nije dostupno';
export const blockedName = (item: BlockedAccount) => item.displayName ?? UNKNOWN_BLOCKED_NAME;

/**
 * The body of "Blokirane osobe" (step 11a, 2026-09-24), drawn from what the route read: one person row per blocked
 * person with their own "Odblokiraj", the shared empty, loading and error states, and the page controls. No sentence
 * explains the screen; the bar names it. Presentation only: the route owns the read, the question and the command.
 */
export function BlockedAccountsList({ data, loading, busy, error, uncertain, cursor, pending, notice = null, onOpen, onUnblock, onRefresh, onPage }: {
  data: MyBlockedAccounts | null; loading: boolean; busy: boolean; error: string | null; uncertain: boolean;
  /** The page being shown; null on the first one. */ cursor: string | null;
  /** The person whose unblock is in flight. */ pending: string | null;
  /** A confirmed outcome as a line in the list. The route says it in the outcome bar instead (`Poruka`) and leaves this out. */ notice?: string | null;
  onOpen: (item: BlockedAccount) => void; onUnblock: (item: BlockedAccount) => void; onRefresh: () => void;
  onPage: (cursor: string | null) => void;
}) {
  const items = data?.items ?? [];
  // An empty FIRST page with another after it is not "nobody blocked" (it happens after unblocking the only person on it
  // when the re-read got no answer): it says the page is empty, and the way to the next page follows; "Početak liste"
  // would lead to itself. A later page that is empty keeps the same sentence with its way back to the start of the list.
  const emptyPage = !loading && !error && data?.items.length === 0;
  const firstWithMore = emptyPage && !cursor && !!data?.nextCursor;
  const empty = emptyPage && !firstWithMore;
  const reading = busy || loading;
  // A refused or unknown outcome keeps every unblock waiting until the list is read again; the alert above says why. So
  // does a re-read that got no answer: the list stays on screen under its error, but it is not confirmed, and the
  // command would refuse to run on it (a confirmed "Odblokiraj" that silently does nothing). "Proveri listu" frees it.
  const locked = reading || uncertain || !!pending || !!error;
  return <>
    {notice ? <T tone="success" accessibilityLiveRegion="polite">{notice}</T> : null}
    {error && data ? <View style={s.notice}>
      <T tone="danger" accessibilityRole="alert">{error}</T>
      <SettingsAction kind="secondary" label="Proveri listu" disabled={reading} onPress={onRefresh} />
    </View> : null}
    {!data ? error
      ? <StateView kind="error" title="Lista nije učitana" body={error} primary={{ label: 'Pokušaj ponovo', onPress: onRefresh, disabled: reading }} />
      : <QuietReadState title="Učitavamo blokirane osobe" body="Proveravamo Vašu listu pre prikaza." art="lock" /> : null}
    {/* Nobody blocked is the good case. It says how a block happens, since nothing on this screen can start one, and it has no button:
        the screen is read again by pulling it, and a "Proveri ponovo" that only looked again was the one action of an empty screen. */}
    {firstWithMore ? <StateView kind="empty" art="shield" title="Na ovoj stranici nema više osoba." /> : null}
    {empty ? cursor
      ? <StateView kind="empty" art="shield" title="Na ovoj stranici nema više osoba."
          quiet={{ label: 'Početak liste', onPress: () => onPage(null), disabled: busy }} />
      : <StateView kind="empty" art="shield" title="Nema blokiranih osoba."
          body="Osobu blokirate ili prijavite sa njenog profila, iz zadatka ili iz Dogovora." /> : null}
    {items.length ? <SettingsGroup>{items.map((item, index) => {
      const name = blockedName(item);
      return <SettingsPersonRow key={item.targetAccountId} name={name} initials={inicijali(item.displayName)} last={index === items.length - 1}
        openHint="Otvara privatnu prijavu i blokiranje." onOpen={() => onOpen(item)}
        action={{ label: 'Odblokiraj', accessibilityLabel: `Odblokiraj, ${name}`, loading: pending === item.targetAccountId,
          disabled: locked, onPress: () => onUnblock(item) }} />;
    })}</SettingsGroup> : null}
    {data?.nextCursor ? <SettingsAction label="Sledeće osobe" kind="secondary" disabled={reading || !!pending}
      onPress={() => onPage(data.nextCursor)} /> : null}
    {cursor && !empty && items.length ? <SettingsAction label="Početak liste" kind="quiet" disabled={!!pending} onPress={() => onPage(null)} /> : null}
  </>;
}

const s = StyleSheet.create({
  notice: { gap: 8 },
});
