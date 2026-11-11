import { safetyClientService, type AccountBlockReceipt } from '../../data/safetyClientService';
import { noviUuidZahtevId } from '../../lib/idempotencija';
import { sesijaSada } from '../../store/sesija';
import { poruka } from '../system/Poruka';

/**
 * What a block or an unblock says when the server has confirmed it, and how it is put back (UI/UX pass 2026-10-07, plan 2.3:
 * "Blokiraj osobu" and "Odblokiraj" end in the one outcome bar with a "Vrati" beside it, because each is the undo of the
 * other). Both places that change a block, the safety screen and the list of blocked people, say it the same way.
 */
export const blockWords = {
  saved: 'Blokiranje je sačuvano.',
  removed: 'Blokiranje je uklonjeno.',
  restored: 'Blokiranje je vraćeno.',
  /** The undo went out and the server did not confirm it: the person is told to look, never that it worked. */
  unconfirmed: 'Ne znamo da li je promena sačuvana. Osveži pa pokušaj ponovo.',
} as const;

/** The account that made the change. A "Vrati" pressed after the account changed under the bar does nothing at all. */
export type BlockOwner = { accountId: string; accountRevision: number };
type Receipt = Pick<AccountBlockReceipt, 'targetAccountId' | 'blocked' | 'revision'>;

const sameOwner = (owner: BlockOwner) => sesijaSada().user?.id === owner.accountId && sesijaSada().accountRevision === owner.accountRevision;

/**
 * Says a confirmed change in the outcome bar, with "Vrati". `text` is the sentence (the list of blocked people names the
 * person it removed); the haptic tick is the bar's own and goes with `confirmed`, which this is: the receipt is the server's
 * word. The undo is one new revisioned command from the receipt's revision (the server refuses it if the block moved on in
 * between), with a request id of its own; `onSettled` runs when it is over, whatever came of it, so the screen can read again.
 */
export function announceBlockChange(receipt: Receipt, owner: BlockOwner,
  { text, onSettled, stillCurrent }: { text?: string; onSettled?: () => void; stillCurrent?: () => boolean } = {}): void {
  // A valid receipt belongs to its original account/incarnation AND screen lifetime.
  // Without this check, a completed request can announce success on another user's screen.
  if (!sameOwner(owner) || (stillCurrent && !stillCurrent())) return;
  poruka.show({ text: text ?? (receipt.blocked ? blockWords.saved : blockWords.removed), confirmed: true,
    action: { label: 'Vrati', onPress: () => { void putBack(receipt, owner, onSettled, stillCurrent); } } });
}

async function putBack(receipt: Receipt, owner: BlockOwner, onSettled?: () => void, stillCurrent?: () => boolean): Promise<void> {
  if (!sameOwner(owner) || (stillCurrent && !stillCurrent())) return;
  let confirmed = false;
  try {
    const result = await safetyClientService.setBlock({ targetAccountId: receipt.targetAccountId, blocked: !receipt.blocked,
      expectedRevision: receipt.revision, clientRequestId: noviUuidZahtevId() });
    confirmed = result.ok;
  } catch { confirmed = false; }
  // The answer belongs to the account that asked: for anyone else the bar says nothing, and the screen is not told.
  if (!sameOwner(owner) || (stillCurrent && !stillCurrent())) return;
  poruka.show(confirmed ? { text: receipt.blocked ? blockWords.removed : blockWords.restored, confirmed: true } : { text: blockWords.unconfirmed });
  onSettled?.();
}
