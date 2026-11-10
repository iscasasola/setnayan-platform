/**
 * plan-table-data — the full plan comparison, Free · Verified · Solo · Pro · Ultra, as DATA (Build 6 Lane J). Shared by
 * /for-suppliers and /for-coordinators (the owner's "one plans widget for both pages", DECISION_LOG 2026-11-05), drawn
 * by `supplier-plan-table.tsx`. Its own module so /for-coordinators can read it without importing /for-suppliers'
 * sample shop (that page's sample is "Setnayan Weddings", owner 2026-11-06).
 *
 * PURE: no I/O, no env. 🔒 supplier-plan-table-tells-the-truth.test.ts
 */
import { formatCount } from '@/lib/format-number';
import { LOCKS, LOCK_KEYS, canUse, type LockDef, type LockKey } from '@/lib/locks';
import { PLAN_LIMITS, limitOf, limitWords, type PlanLimitKey } from '@/lib/plan-sheet';
import { tierPaysGiftPrice } from '@/lib/shop-gifts';
import {
  SPECIALIZED_TOOLS_INCLUDED_TIERS,
  SPECIALIZED_TOOLS_MIN_TIER,
  SPECIALIZED_TOOLS_SKU_CODE,
} from '@/lib/specialized-tools-access';
import { vendorAddonSkuCode } from '@/lib/vendor-addon-tier-pricing';
import { FREE_HELPER_SEATS } from '@/lib/vendor-free-helper';
import { allowance } from '@/lib/vendor-plan-rows';
import { TIER_CAPS, TIER_LABEL, isTierAtLeast, type VendorTier } from '@/lib/vendor-tier-caps';
import { ULTRA_ADDON_ORDER, canBuyUltraAddOn, ultraAddOnSku, type UltraAddOnKind } from '@/lib/vendor-ultra-addons';

/**
 * Free's search line: the 7 Nov rule the database applies (`vendor_profiles.is_findable`, lib/findable-shop.ts) — an
 * unverified shop shows in search until its first inquiry, then waits for Verified. Both front pages say these words.
 */
export const FREE_FINDABLE = 'found until your first inquiry';

/** The paid plans a shop grows into, in order. */
const GROW_TIERS = ['solo', 'pro', 'enterprise'] as const;

/** The plan name a person reads — Verified for the free verified step, Ultra for `enterprise`. */
function planName(t: VendorTier): string {
  return t === 'verified' ? 'Verified' : TIER_LABEL[t];
}

/* ───────────────────────── THE PLAN TABLE: Free · Verified · Solo · Pro · Ultra (Build 6 Lane J) ───────────────────────── */

/**
 * The full side-by-side comparison (owner 10 Nov 2026: *"update the full FREE vs VERIFIED vs SOLO vs PRO vs ULTRA for
 * suppliers on the for suppliers page"*; DECISION_LOG 2026-11-10 "BOTH PLAN TABLES ARE REDRAWN TO THE RULINGS").
 *
 * 🔑 EVERY CELL IS WHAT THE APP APPLIES TODAY — read from the code that enforces it, never from the old copy:
 *   · the six limits a shop presses past → `limitOf` / `limitWords` (lib/plan-sheet.ts, Build 5 Lane B) — the SAME
 *     numbers the plan sheet asks "Upgrade to X to take up to N" with; team seats and the waiting list go through the
 *     flag-aware `allowance`, so while the plan paywall (`VENDOR_TIER_FEATURE_GATE`) is off the table prints what the
 *     actions actually let a shop do, not a cap nobody enforces;
 *   · plan features → `TIER_CAPS` (lib/vendor-tier-caps.ts);
 *   · the tools unlock → `SPECIALIZED_TOOLS_MIN_TIER` / `SPECIALIZED_TOOLS_INCLUDED_TIERS`;
 *   · gift price vs list price → `tierPaysGiftPrice` (lib/shop-gifts.ts, the one the purchase asks);
 *   · Deep Search · chatbot → the SKU each plan is CHARGED from (`vendorAddonSkuCode`), priced by the catalogue;
 *   · Ultra's add-ons → `canBuyUltraAddOn` + the SKU each one charges (`ultraAddOnSku`);
 *   · the locks → `LOCKS` + `canUse` (lib/locks.ts). ⚠ ONLY a lock whose server gate exists (`server !== null`) is
 *     printed: a ruled lock the app does not apply yet would be a promise the shop can walk straight through. The rest
 *     join the table by themselves the day their gate lands (the guard lists them).
 *   · every peso → `bySku` / the plan prices the page read from `vendor_billing_catalog`; a missing row prints "—".
 * PURE: no I/O, no env. 🔒 supplier-front-reads-its-numbers.test.ts + supplier-plan-table-tells-the-truth.test.ts.
 */
/** The locks the app ENFORCES (a server gate exists). A ruled lock with no gate yet is not printed — see above. */
export const APPLIED_LOCKS: readonly LockKey[] = LOCK_KEYS.filter((k) => (LOCKS[k] as LockDef).server !== null);
/** The ruled locks the app does NOT enforce yet — named in the PR, printed nowhere, joining the table on their own. */
export const UNAPPLIED_LOCKS: readonly LockKey[] = LOCK_KEYS.filter((k) => (LOCKS[k] as LockDef).server === null);

export const TABLE_TIERS: readonly VendorTier[] = ['free', 'verified', 'solo', 'pro', 'enterprise'];

/** A cell: `yes` / `no` draw a mark (with words for a screen reader), `lock` draws 🔒 + its words, `text` prints words. */
export type TableCell = { kind: 'yes' | 'no' | 'lock' | 'text'; text: string };
export type TableRow = {
  key: string;
  label: string;
  /** A locked row's Problem → Solution line (owner 10 Nov: "always show the Problem and Solution"). */
  why?: { problem: string; solution: string };
  cells: Record<VendorTier, TableCell>;
};
export type TableGroup = { title: string; rows: TableRow[] };

/** Prices the page read, by plan and by SKU. `null` = unread → "—". */
export type PlanTablePrices = {
  monthly: Partial<Record<VendorTier, string | null>>;
  annual: Partial<Record<VendorTier, string | null>>;
  bySku: Readonly<Record<string, string | null>>;
};

const DASH = '—';
const yes = (text = 'Yes'): TableCell => ({ kind: 'yes', text });
const no = (text = 'No'): TableCell => ({ kind: 'no', text });
const words = (text: string): TableCell => ({ kind: 'text', text });
const each = (f: (t: VendorTier) => TableCell): Record<VendorTier, TableCell> =>
  Object.fromEntries(TABLE_TIERS.map((t) => [t, f(t)])) as Record<VendorTier, TableCell>;
const has = (on: boolean): TableCell => (on ? yes() : no());

/** The table's own plan names (Free · Verified · Solo · Pro · Ultra). */
export function tableTierName(t: VendorTier): string {
  return planName(t);
}

/** A limit cell, through the plan sheet's own reader. 0 reads "None" (a plan without it), reach 0 reads Free's rule. */
function limitCell(t: VendorTier, key: PlanLimitKey, paywallOn: boolean): TableCell {
  const v = limitOf(t, key, paywallOn);
  if (key === 'reach' && v === 0) return words(FREE_FINDABLE.replace(/^f/, 'F'));
  if (v === 0) return no('None');
  return words(limitWords(key, v));
}

export function planTable(input: { paywallOn: boolean; prices: PlanTablePrices }): TableGroup[] {
  const { paywallOn, prices } = input;
  const sku = (code: string): string => prices.bySku[code] ?? DASH;
  /** "₱499 / 4 weeks" — or just "—" when the row could not be read (never a suffix on nothing). */
  const per = (code: string, tail: string): string => (prices.bySku[code] ? `${prices.bySku[code]}${tail}` : DASH);

  const limits: TableRow[] = PLAN_LIMITS.map((l) => ({
    key: `limit:${l.key}`,
    label: l.key === 'reach' ? 'Shown in search' : l.title,
    cells: each((t) => limitCell(t, l.key, paywallOn)),
  }));
  limits.push({
    key: 'limit:waitlist',
    label: 'Waiting list, per date',
    cells: each((t) => {
      const v = allowance(TIER_CAPS[t].waitlistAcceptances, 'waitlistAcceptances', paywallOn);
      return v > 0 ? words(formatCount(v)) : no('None');
    }),
  });
  if (FREE_HELPER_SEATS > 0) {
    limits.push({ key: 'limit:helper', label: 'Free Helper on the event day', cells: each(() => words(formatCount(FREE_HELPER_SEATS))) });
  }

  const free = (t: VendorTier) => t === 'free' || t === 'verified';
  const price: TableRow[] = [
    { key: 'price:4w', label: 'Every 4 weeks', cells: each((t) => (free(t) ? words('Free') : words(prices.monthly[t] ?? DASH))) },
    { key: 'price:yr', label: 'A year', cells: each((t) => (free(t) ? words('Free') : words(prices.annual[t] ?? DASH))) },
  ];

  const toolsBuy = sku(SPECIALIZED_TOOLS_SKU_CODE);
  const tools: TableRow[] = [
    {
      key: 'tool:specialized',
      label: 'Specialized tools',
      cells: each((t) =>
        SPECIALIZED_TOOLS_INCLUDED_TIERS.includes(t)
          ? yes('All included')
          : isTierAtLeast(t, SPECIALIZED_TOOLS_MIN_TIER)
            ? words(toolsBuy === DASH ? 'Free set · the rest to buy' : `Free set · all for ${toolsBuy} / 4 weeks`)
            : words('Free set'),
      ),
    },
    { key: 'tool:address', label: 'Your own web address', cells: each((t) => has(TIER_CAPS[t].customWebsiteName)) },
    { key: 'tool:premium', label: 'Premium two-column page', cells: each((t) => has(TIER_CAPS[t].premiumPage)) },
    { key: 'tool:video', label: 'Video links in your forms', cells: each((t) => has(TIER_CAPS[t].formVideoLinks)) },
    { key: 'tool:uploads', label: 'Uploads in your forms', cells: each((t) => has(TIER_CAPS[t].formMediaUploads)) },
    { key: 'tool:trends', label: 'Trends on your own numbers', cells: each((t) => has(TIER_CAPS[t].performanceTrends)) },
    { key: 'tool:intel', label: 'Market Intelligence: your category vs peers', cells: each((t) => has(TIER_CAPS[t].marketIntel)) },
    { key: 'tool:theft', label: 'Reverse-image theft watch', cells: each((t) => has(TIER_CAPS[t].theftWatch)) },
  ];

  const money: TableRow[] = [
    { key: 'money:gift', label: 'Setnayan gifts you buy', cells: each((t) => words(tierPaysGiftPrice(t) ? 'Gift price' : 'List price')) },
    {
      key: 'money:deep',
      label: 'Deep Search',
      cells: each((t) => words(per(vendorAddonSkuCode('deep_search_about_you', t), ' a search'))),
    },
    {
      key: 'money:chatbot',
      label: 'AI chatbot',
      cells: each((t) => words(per(vendorAddonSkuCode('ai_chatbot_basic', t), ' / 4 weeks'))),
    },
  ];

  const verify: TableRow[] = APPLIED_LOCKS.map((k) => {
    const def: LockDef = LOCKS[k];
    return {
      key: `lock:${k}`,
      label: def.name,
      why: { problem: def.problem, solution: def.solution },
      cells: each((t) => {
        const r = canUse(k, { verified: t !== 'free', tier: t });
        if (r.ok) return yes('Open');
        return { kind: 'lock', text: r.needs === 'verify' ? 'Opens once Verified' : `Opens on ${planName(r.plan as VendorTier)}` };
      }),
    };
  });

  return [
    { title: 'Price', rows: price },
    { title: 'How much you can take on', rows: limits },
    { title: 'Tools', rows: tools },
    { title: 'Money', rows: money },
    ...(verify.length ? [{ title: 'Getting verified', rows: verify }] : []),
  ];
}

/**
 * "Bigger than Ultra? Add more." — EVERY add-on the top plan may buy (owner 2026-11-06: *"add categories limit, add
 * service cards limit, team seat, branches, wait list, booked limit per date"*), each priced by the SKU its purchase
 * charges. The page listed two of the six until Lane J. An add-on no Grow plan may buy is left out; a price that could
 * not be read prints "Price unavailable", never a guess. Kept OUT of the plan table so nothing is said twice.
 */
export function addonLines(bySku: Readonly<Record<string, string | null>>): { kind: UltraAddOnKind; label: string; price: string }[] {
  return ULTRA_ADDON_ORDER.filter((kind) => GROW_TIERS.some((t) => canBuyUltraAddOn(kind, t))).map((kind) => ({
    kind,
    label: ULTRA_ADDON_LABEL[kind],
    price: bySku[ultraAddOnSku(kind)] ?? 'Price unavailable',
  }));
}

/** Ultra's add-ons as the table names them — the add-on module's own purchase labels. */
const ULTRA_ADDON_LABEL: Record<UltraAddOnKind, string> = {
  category: '+1 category',
  service_card: '+1 service card per category',
  seat: '+1 team seat',
  branch: '+1 branch',
  waitlist: '+1 waiting-list place per date',
  booking_per_date: '+1 booking per date per card',
};
