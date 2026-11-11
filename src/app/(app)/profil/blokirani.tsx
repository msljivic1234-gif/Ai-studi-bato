import { useCallback, useRef, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { safetyClientService, type AccountBlockReceipt } from '../../../data/safetyClientService';
import { useOwnedEditor } from '../../../hooks/useOwnedEditor';
import { noviUuidZahtevId } from '../../../lib/idempotencija';
import { sesijaSada, useSesija } from '../../../store/sesija';
import { announceBlockChange, blockWords } from '../../../ui/safety/blockOutcome';
import { useConfirmSheet } from '../../../ui/system/ConfirmSheet';
import { BlockedAccountsList, type BlockedAccount } from '../../../ui/settings/BlockedAccountsList';
import { SettingsScreen } from '../../../ui/settings/SettingsPresentation';

export default function BlockedAccounts() {
  const { user, accountRevision } = useSesija();
  return <OwnedBlocks key={`${user?.id}:${accountRevision}`} />;
}

/**
 * The people you block (step 11a, 2026-09-24; UI/UX pass 2026-10-07): each is a person row with their own "Odblokiraj",
 * asked once in the centred dialog (the person's name in its title and what follows in one sentence) before the command
 * goes. Opening the person still leads to the private report and the block itself. The unblock is the existing
 * revisioned, idempotent command: one request id per blocked revision, reused when the same unblock is tried again, and
 * nothing else is sent until the list has been read again after a refused or unknown outcome. The confirmed outcome is
 * said in the one outcome bar with "Vrati", which blocks the person again.
 */
function OwnedBlocks() {
  const { user, accountRevision } = useSesija(), accountId = user?.id;
  const [cursor, setCursor] = useState<string | null>(null);
  const read = useCallback(() => safetyClientService.listMyBlocks(cursor), [cursor]), editor = useOwnedEditor(read);
  const confirmation = useConfirmSheet();
  const commands = useRef(new Map<string, { revision: number; id: string }>());
  const focusLifetime = useRef({ epoch: 0, active: false });
  const [pending, setPending] = useState<string | null>(null);
  const closeConfirmation = confirmation.close;
  // A question left open is retired whenever its answer would land on a list that is no longer the one it was asked on.
  useFocusEffect(useCallback(() => {
    const epoch = ++focusLifetime.current.epoch;
    focusLifetime.current.active = true;
    return () => {
      if (focusLifetime.current.epoch === epoch) {
        focusLifetime.current.active = false;
        focusLifetime.current.epoch++;
      }
      closeConfirmation();
    };
  }, [closeConfirmation]));
  const refresh = () => { closeConfirmation(); void editor.refresh(); };
  const page = (next: string | null) => { closeConfirmation(); setCursor(next); };
  async function unblock(item: BlockedAccount) {
    if (!focusLifetime.current.active || !accountId) return;
    const lifetime = focusLifetime.current.epoch;
    const originCurrent = () => focusLifetime.current.active && focusLifetime.current.epoch === lifetime
      && sesijaSada().user?.id === accountId && sesijaSada().accountRevision === accountRevision;
    const target = item.targetAccountId;
    let command = commands.current.get(target);
    if (!command || command.revision !== item.revision) {
      command = { revision: item.revision, id: noviUuidZahtevId() };
      commands.current.set(target, command);
    }
    const frozen = command;
    // The page the question was asked on; `save` refuses to run on any other.
    const shown = editor.data;
    // The server's receipt for this unblock, if it gets one: it is what the outcome bar is said from.
    const done: { receipt?: AccountBlockReceipt } = {};
    setPending(target);
    try {
      await editor.save(async () => {
        const result = await safetyClientService.setBlock({ targetAccountId: target, blocked: false,
          expectedRevision: frozen.revision, clientRequestId: frozen.id });
        if (!result.ok) return result;
        done.receipt = result.podatak;
        commands.current.delete(target);
        // The receipt is the server's word that the block is gone. If the list cannot be read again right after it, the
        // unblock is still confirmed, so it is not reported as unconfirmed: the page shown stays, without that person.
        // Everyone else on it keeps the revision that was read, and any later command is checked against the server.
        const fallback = () => shown ? { ok: true as const, podatak: { ...shown, items: shown.items.filter(item => item.targetAccountId !== target) } } : null;
        try {
          const list = await safetyClientService.listMyBlocks(cursor);
          return list.ok ? list : fallback() ?? list;
        } catch (error) {
          const kept = fallback(); if (kept) return kept;
          throw error;
        }
      });
    } finally { if (originCurrent()) setPending(null); }
    // Said once the server has confirmed it, in the one outcome bar (the person's name when the server returned it), with the way to put it back.
    if (done.receipt && accountId && done.receipt.targetAccountId === target)
      announceBlockChange(done.receipt, { accountId, accountRevision }, {
        text: item.displayName ? `Blokiranje je uklonjeno: ${item.displayName}.` : blockWords.removed,
        stillCurrent: originCurrent,
        onSettled: () => { if (originCurrent()) void editor.refresh(); },
      });
  }
  const askUnblock = (item: BlockedAccount) => confirmation.ask({ title: item.displayName ? `Odblokirati ${item.displayName}?` : 'Odblokirati osobu?',
    message: 'Odblokiranje ne vraća ranije dozvole za deljenje kontakta ili tačne lokacije.', confirmLabel: 'Odblokiraj',
    onConfirm: () => unblock(item) });
  // The list is read again by pulling the screen (the spinner is the pull's own), not by a button on an empty screen.
  return <SettingsScreen title="Blokirane osobe" onBack={() => router.canGoBack() ? router.back() : router.replace('/profil')}
    refresh={{ onRefresh: () => { if (!editor.busy && !editor.loading && !pending) refresh(); }, busy: editor.loading }}>
    <BlockedAccountsList data={editor.data} loading={editor.loading} busy={editor.busy} error={editor.error} uncertain={editor.uncertain}
      cursor={cursor} pending={pending}
      onOpen={item => router.navigate({ pathname: '/bezbednost', params: { targetAccountId: item.targetAccountId } })}
      onUnblock={askUnblock} onRefresh={refresh} onPage={page} />
    {confirmation.sheet}
  </SettingsScreen>;
}
