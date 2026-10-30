/**
 * supplier-page-tours.ts — WHICH supplier page's first-visit spotlight a URL is on.
 *
 * Owner "Yes to all", 2026-10-22 (journey_fixes_2026-10-22.html § Supplier 3): a
 * spotlight tour on the first visit to Shop (3 stops), Customers › Dates (3),
 * Customers › Money (4) and the Hub (3), each AFTER `supplier_spotlight_v1` and
 * none repeating a stop it makes. The words are in `lib/tours.ts`.
 *
 * 🔑 WHY A PATH RULE AND NOT A MOUNT ON EACH PAGE. The Shop tour's first stop is
 * a doorway (Next walks into Shop › Page), and a tour mounted inside a page dies
 * with that page. So the four are mounted ONCE, in the supplier layout (which
 * outlives the navigation), and this decides — from the address alone — which
 * one belongs on screen. A page that is not one of the four draws none.
 *
 * Pure and dependency-light (the Customers segment rule is the page's own,
 * `customersSegmentOf`), so the layout's client half and the guard ask the same
 * function.
 */
import { customersSegmentOf } from '@/app/vendor-dashboard/customers/segments';

export const SUPPLIER_PAGE_TOURS = [
  'vendor_shop_v1',
  'vendor_dates_v1',
  'vendor_money_v1',
  'vendor_hub_v1',
  // Owner 2026-10-25, "the spotlight tour is missing so many parts for each page": Today's other parts, Customers ›
  // People, and Your collections.
  'vendor_today_v2',
  'vendor_people_v1',
  'vendor_collections_v1',
] as const;
export type SupplierPageTourKey = (typeof SUPPLIER_PAGE_TOURS)[number];

/** The Today tour goes first; a page tour waits until it is seen, so the two never stack. */
export const SUPPLIER_PAGE_TOURS_AFTER = 'supplier_spotlight_v1' as const;

/** Shop's sections but Gallery (`shop-sections.ts`, v13: Details · Services · Page · Analytics). Gallery — Your
 *  collections — has its own tour since 2026-10-25. */
const SHOP_PATHS = ['/vendor-dashboard/shop', '/vendor-dashboard/website', '/vendor-dashboard/profile', '/vendor-dashboard/performance'] as const;

const under = (path: string, root: string) => path === root || path.startsWith(`${root}/`);

export function supplierPageTourOn(
  pathname: string,
  search: Record<string, string | string[] | undefined>,
): SupplierPageTourKey | null {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/vendor-dashboard') return 'vendor_today_v2';
  if (path === '/vendor-dashboard/collections') return 'vendor_collections_v1';
  if (SHOP_PATHS.some((p) => under(path, p))) return 'vendor_shop_v1';
  if (path === '/vendor-dashboard/customers') {
    const seg = customersSegmentOf(search);
    if (seg === 'dates') return 'vendor_dates_v1';
    if (seg === 'money') return 'vendor_money_v1';
    // Events (People until 2026-10-30) — the tour keeps its key: it is the "seen" mark a supplier already holds.
    return 'vendor_people_v1';
  }
  if (path === '/vendor-dashboard/on-the-day') return 'vendor_hub_v1';
  return null;
}

/**
 * The page tours this person has still to meet: none until the Today tour is
 * seen, then each one not yet seen. NULL seen keys (the read failed) = none —
 * never replay a tour to someone who finished it.
 */
export function supplierPageToursDue(seen: ReadonlyArray<string> | null): SupplierPageTourKey[] {
  if (!seen || !seen.includes(SUPPLIER_PAGE_TOURS_AFTER)) return [];
  return SUPPLIER_PAGE_TOURS.filter((k) => !seen.includes(k));
}
