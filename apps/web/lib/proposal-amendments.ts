// Shared types + pure math for bundled proposal amendments (negotiation Phase 3).
// An amendment carries many items shown against the current proposal → new total.
// Pure module — safe on client + server.

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

export function pesoLabel(n: number): string {
  const sign = n < 0 ? '−' : '';
  return `${sign}₱${Math.abs(n).toLocaleString('en-PH')}`;
}
