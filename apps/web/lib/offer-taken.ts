import { formatCount } from './format-number';

/** PURE — the words for a used-up "first N couples" offer (lib/proposal-send.ts says them on both send paths). */

/**
 * 🧾 OWN-01: the database refuses a "first N couples" offer once N other couples have it (`OFFER_TAKEN`, migration
 * 20271346038449). Said as that — "try again" would never work — so the supplier takes the offer off and sends.
 */
export function offerTakenRefusal(err: { message?: string } | null | undefined): string | null {
  const m = /OFFER_TAKEN — "(.*)" was for the first (\d+) couple/.exec(err?.message ?? '');
  if (!m) return null;
  const n = Number(m[2]);
  return `“${m[1]}” was for the first ${n === 1 ? 'couple' : `${formatCount(n)} couples`}, and ${n === 1 ? 'they have' : 'they all have'} it. Take the offer off this quote, then send.`;
}
