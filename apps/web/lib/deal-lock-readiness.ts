/**
 * CAN THIS DEAL BE LOCKED? — the one rule both the chat card and the lock
 * action ask. Pure (no I/O, no `server-only`), so node:test can import it.
 *
 * 🔴 THE DEFECT THIS CLOSES (found 2026-09-10). A Deal can be struck in chat
 * BEFORE the supplier has sent a formal quote — `createAmendmentFromChat`
 * records it with no base proposal, which is correct: a couple may ask for a
 * discount or a freebie at any point in the conversation. But the card still
 * offered "🔒 Lock this deal", and `lockDeal`:
 *   · skipped the booking (it needs a concrete number, and there was none),
 *   · still stamped the Deal locked and froze the thread at a NULL price,
 *   · still told the supplier "Couple accepted: Deal locked",
 * and the card then said "Price agreed and frozen at this amount." Nobody was
 * booked, no price was saved, and both people were told it was locked.
 *
 * ⚖ THE RULE: a Deal is lockable only when it has a real total — a quoted base
 * price plus its changes — that is not below zero. Anything else is refused
 * BEFORE any write, with a sentence that says what to do next.
 *
 * ⛔ Deliberately NOT here: whether the supplier can be booked (verification,
 * the one-per-category rule, the handshake). Those stay in the shared lock core,
 * which runs only once this rule has said yes.
 */
import { newTotalPhp } from '@/lib/proposal-amendments';

export type DealLockReadiness =
  | { lockable: true; totalPhp: number; centavos: number }
  /** No formal quote behind the Deal — nothing to lock a price onto. */
  | { lockable: false; reason: 'no_quote' }
  /** The changes take the total below zero — not a price anybody can book at. */
  | { lockable: false; reason: 'below_zero' };

export function dealLockReadiness(
  baseTotalCentavos: number | null | undefined,
  items: { amount_php: number | null }[],
): DealLockReadiness {
  const total = newTotalPhp(baseTotalCentavos, items);
  if (total == null || !Number.isFinite(total)) return { lockable: false, reason: 'no_quote' };
  if (total < 0) return { lockable: false, reason: 'below_zero' };
  return { lockable: true, totalPhp: total, centavos: Math.round(total * 100) };
}

/**
 * What each side reads in place of the Lock button when the Deal cannot be
 * locked. The couple is told to ask for the quote; the supplier is told to send
 * it. Neither sentence may say "locked" or "frozen" — nothing is.
 */
export function dealNotLockableLine(
  reason: 'no_quote' | 'below_zero',
  viewerRole: 'couple' | 'vendor',
  counterpartyLabel?: string | null,
): string {
  const them =
    counterpartyLabel?.trim() || (viewerRole === 'couple' ? 'the supplier' : 'the couple');
  if (reason === 'below_zero') {
    return viewerRole === 'couple'
      ? 'These changes take the total below zero, so this deal can’t be locked. Agree a new deal first.'
      : 'These changes take the total below zero, so the couple can’t lock this deal. Agree a new deal first.';
  }
  return viewerRole === 'couple'
    ? `This deal has no quoted price yet, so it can’t be locked. Ask ${them} to send their quote first, then agree the deal on it.`
    : `This deal has no quoted price yet, so ${them} can’t lock it. Send your proposal first, then agree the deal on it.`;
}

/** The refusal `lockDeal` shows the couple if the button is pressed anyway
 *  (a stale page, a replayed form). Same meaning as the card's line. */
export function dealLockRefusal(reason: 'no_quote' | 'below_zero'): string {
  return reason === 'no_quote'
    ? 'This deal has no quoted price yet, so nothing was locked. Ask the supplier to send their quote first.'
    : 'These changes take the total below zero, so nothing was locked. Agree a new deal first.';
}
