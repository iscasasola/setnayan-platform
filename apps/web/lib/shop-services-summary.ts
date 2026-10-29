/**
 * 🧰 SHOP › SERVICES, ONE ROW PER SERVICE (supplier dashboard v13, APPROVED 2026-10-29; prototype `shopServices()`).
 *
 * A "service" here is what the shop covers — one `vendor_coverages` row (Admin's tier-3 Service, the old "leaf") — and
 * its cards are the `vendor_services` rows filed under it (`coverage_id`), exactly as the cards list below already
 * groups them. Nothing new is stored: this only counts what exists.
 *
 *   · LIVE = at least one of its cards is switched on (`is_active`, the card's own switch). "Ready" = built, none on.
 *     ⚠ "BUILD ALL, SHOW ONE" (DECISION_LOG 2026-10-29) wants exactly one live service while a shop is unverified, and
 *     each plan's allowance set in Admin. No allowance exists in Admin yet, so this NEVER invents one and never limits
 *     anything — it reports what is on.
 *   · TOOLS = the day-of tools every event booked for this service starts with — the SHIPPED defaults
 *     (`lib/vendor-dayof-modules.ts`, the same resolver the Hub uses), worked out per service instead of per shop. The
 *     scanner is the one tool that scans a guest (`qr_scanner`). A supplier picking their own per service (DECISION_LOG
 *     2026-10-29 "A SUPPLIER'S TOOLS + SCANNER ARE SET ONCE PER SERVICE") needs somewhere to keep it — not built; the
 *     line says what arrives, never a choice it cannot save.
 *
 * Pure: the page reads, this words. 🔒 lib/shop-services-summary.test.ts
 */
import { DAY_OF_MODULES, familiesForServices, resolveDayOfFamily, type DayOfFamily } from '@/lib/vendor-dayof-modules';
import { serviceReach } from '@/lib/service-reach';
import type { ServicePricingRow } from '@/lib/smart-sort';
import { formatCount } from '@/lib/format-number';
import type { PinFigure } from '@/lib/pin-figure';

export type ShopCardLite = ServicePricingRow & {
  vendor_service_id: string;
  coverage_id: number | null;
  category: string;
  is_active: boolean;
};

export type ShopCoverageLite = { id: number; canonical_service: string };

export type ShopServiceRow = {
  /** `cov-<id>`, or `none` for cards filed under no service. */
  key: string;
  label: string;
  cards: number;
  live: boolean;
  /** The lowest "from" price among its cards, in pesos — null when no card has a price. */
  fromPhp: number | null;
  /** The first card's id — where the row's link lands in the cards list (`#svc-<id>`). */
  firstCardId: string | null;
  tools: string[];
  /** The scanner's word, or null = this service has no scanner. */
  scanner: string | null;
};

const SCANNER_ID = 'qr_scanner';

/** The tools an event booked for these service keys starts with — the Hub's own defaults, per service. */
export function serviceToolsOf(keys: readonly string[]): { tools: string[]; scanner: string | null } {
  let fams: Set<DayOfFamily> = familiesForServices(keys);
  // The Hub's own fallback for a shop whose services name no family: it runs as `setup` (`resolveDayOfFamily`).
  if (fams.size === 0) fams = new Set([resolveDayOfFamily(keys)]);
  const on = DAY_OF_MODULES.filter((m) => m.defaultOnFor.some((f) => fams.has(f)));
  return {
    tools: on.filter((m) => m.id !== SCANNER_ID).map((m) => m.label),
    scanner: on.find((m) => m.id === SCANNER_ID)?.label ?? null,
  };
}

export function shopServiceRows(
  coverages: readonly ShopCoverageLite[],
  cards: readonly ShopCardLite[],
  labelOf: (canonicalService: string) => string,
): ShopServiceRow[] {
  const row = (key: string, label: string, mine: ShopCardLite[], keys: string[]): ShopServiceRow => {
    const prices = mine.map((c) => serviceReach(c).startsAtPhp).filter((p): p is number => p != null);
    const { tools, scanner } = serviceToolsOf(keys);
    return {
      key,
      label,
      cards: mine.length,
      live: mine.some((c) => c.is_active),
      fromPhp: prices.length ? Math.min(...prices) : null,
      firstCardId: mine[0]?.vendor_service_id ?? null,
      tools,
      scanner,
    };
  };
  const known = new Set(coverages.map((c) => c.id));
  const out = coverages.map((cov) => {
    const mine = cards.filter((c) => c.coverage_id === cov.id);
    return row(`cov-${cov.id}`, labelOf(cov.canonical_service), mine, [cov.canonical_service, ...new Set(mine.map((c) => c.category))]);
  });
  // Cards filed under no service (older cards) still count — one row, so the total never hides them.
  const loose = cards.filter((c) => c.coverage_id == null || !known.has(c.coverage_id));
  if (loose.length) out.push(row('none', 'Not filed under a service', loose, [...new Set(loose.map((c) => c.category))]));
  return out;
}

const HERE = '/vendor-dashboard/shop#shop-services';

/** Services' three figures — services · live · tools ready. `null` rows = the read failed: every figure "—", never 0. */
export function servicesFigures(rows: readonly ShopServiceRow[] | null): PinFigure[] {
  const n = (v: number) => formatCount(v);
  const live = rows ? rows.filter((r) => r.live).length : null;
  return [
    { key: 'services', value: rows ? n(rows.length) : null, word: rows?.length === 1 ? 'service' : 'services', href: HERE },
    { key: 'live', value: live === null ? null : n(live), word: 'live', hot: Boolean(rows && rows.length > 0 && live === 0), href: HERE },
    {
      key: 'tools',
      value: rows ? n(rows.reduce((s, r) => s + r.tools.length + (r.scanner ? 1 : 0), 0)) : null,
      word: 'tools ready',
      short: 'tools',
      href: HERE,
    },
  ];
}
