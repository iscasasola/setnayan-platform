// Shared types + pure math for bundled proposal amendments (negotiation Phase 3).
// An amendment carries many items shown against the current proposal → new total.
// Pure module — safe on client + server.

import { formatPhp } from './php';

export type AmendmentItemKind = 'discount' | 'addon' | 'freebie' | 'request';
export type AmendmentStatus = 'proposed' | 'accepted' | 'declined' | 'withdrawn';

export const AMENDMENT_ITEM_KINDS: readonly AmendmentItemKind[] = [
  'discount',
  'addon',
  'freebie',
  'request',
] as const;

export const ITEM_KIND_LABEL: Record<AmendmentItemKind, string> = {
  discount: 'Discount',
  addon: 'Add-on',
  freebie: 'Freebie',
  request: 'Request',
};

/** A money line carries a magnitude the caller entered; freebie/request don't. */
export function isMoneyKind(kind: AmendmentItemKind): boolean {
  return kind === 'discount' || kind === 'addon';
}

/** Convert a positive magnitude + kind into the signed amount stored on the row:
 *  discount → negative, add-on → positive, freebie/request → null (₱0). */
export function signedAmount(kind: AmendmentItemKind, magnitude: number | null | undefined): number | null {
  if (!isMoneyKind(kind)) return null;
  if (magnitude == null || !Number.isFinite(magnitude) || magnitude <= 0) return null;
  const m = Math.round(magnitude * 100) / 100;
  return kind === 'discount' ? -m : m;
}

/** Net pesos delta of a bundle (money items only; freebie/request contribute 0). */
export function netDeltaPhp(items: { amount_php: number | null }[]): number {
  return items.reduce((sum, i) => sum + (i.amount_php ?? 0), 0);
}

/** New total in pesos = base proposal total (centavos) + net delta. Null when
 *  there's no base proposal to amend. */
export function newTotalPhp(
  baseTotalCentavos: number | null | undefined,
  items: { amount_php: number | null }[],
): number | null {
  if (baseTotalCentavos == null) return null;
  return Math.round(baseTotalCentavos) / 100 + netDeltaPhp(items);
}

/**
 * A SIGNED AMENDMENT DELTA — `-1837.5` → `"−₱1,837.50"`.
 *
 * 🔴 THIS USED A BARE `toLocaleString('en-PH')`, which is Intl's default: at
 * most THREE decimals, and a dropped trailing zero. So a ₱1,837.50 change read
 * **−₱1,837.5** — the exact third spelling
 * `app/vendor-dashboard/booking-fees/the-exact-peso-reaches-every-surface.test.ts`
 * calls out by name. It renders `proposal_amendment_items.amount_php` and
 * `event_vendor_line_items.amount_php`, both `NUMERIC(12,2)`, on the couple's
 * itemization card and in the chat amendment card — money that moves their
 * agreed total.
 *
 * The magnitude now goes through the app's one money formatter; only the sign
 * (a typographic MINUS, U+2212, not a hyphen) is local to this surface.
 */
export function pesoLabel(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}${formatPhp(Math.abs(n))}`;
}
