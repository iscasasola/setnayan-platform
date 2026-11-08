import { displayServiceLabel } from '@/lib/vendors';

/**
 * 🏪 SUPPLIERS ON THIS EVENT — the brief's `vendor_roster` (`get_vendor_event_brief`), worded for Details (v113
 * `sups`; B1 step 6.6). The RPC strips the key before the shop is booked, so ABSENT is "not shown to you yet", never
 * "no suppliers": `undefined` → the section is not drawn at all. Malformed entries are dropped, never guessed at (the
 * same reading `supplier-desk.server.ts` gives the key).
 */
export type SupplierRow = { key: string; name: string; service: string };

export function supplierRows(roster: unknown): SupplierRow[] | undefined {
  if (!Array.isArray(roster)) return undefined;
  return roster
    .filter((r): r is { vendor_name: string; category: string } => Boolean(r) && typeof r === 'object' && typeof (r as { vendor_name?: unknown }).vendor_name === 'string' && typeof (r as { category?: unknown }).category === 'string')
    .map((r, i) => ({
      key: `${r.category}:${r.vendor_name}:${i}`,
      name: r.vendor_name,
      service: displayServiceLabel(r.category),
    }));
}
