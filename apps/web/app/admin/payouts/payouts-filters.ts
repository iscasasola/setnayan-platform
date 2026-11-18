/**
 * Payouts' four filters and the address that holds them — shared by the page (server) and its Show & filter sheet
 * (client, `payouts-show-sort.tsx`). Moved out of `page.tsx` unchanged (admin clean port, 19 Nov 2026), plus `open`:
 * the payout a row opens (`?open=<payout_id>`), so a tap shows one payout on its own and "‹ Payouts" comes back to the
 * same filtered list.
 */
export type PayoutFilterKey = 'pending' | 'paid' | 'on_hold' | 'all';

export type PayoutFilters = { filter: PayoutFilterKey; vendor: string; from: string; to: string };

export const PAYOUT_FILTERS: ReadonlyArray<{ key: PayoutFilterKey; label: string }> = [
  { key: 'pending', label: 'Pending' },
  { key: 'paid', label: 'Paid' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'all', label: 'All' },
];

export function parsePayoutFilter(raw: string | undefined): PayoutFilterKey {
  if (raw === 'paid' || raw === 'on_hold' || raw === 'all') return raw;
  return 'pending';
}

export function payoutsHref({ filter, vendor, from, to, open }: PayoutFilters & { open?: string }): string {
  const params = new URLSearchParams();
  params.set('filter', filter);
  if (vendor) params.set('vendor', vendor);
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  if (open) params.set('open', open);
  const qs = params.toString();
  return qs ? `/admin/payouts?${qs}` : '/admin/payouts';
}
