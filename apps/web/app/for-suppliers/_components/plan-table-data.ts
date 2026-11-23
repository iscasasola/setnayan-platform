/**
 * plan-table-data — the full plan comparison, Free · Plus · Pro · Ultra (Verified joins Free, 2026-11-14), as DATA (Build 6 Lane J). Shared by
 * /for-suppliers and /for-coordinators (the owner's "one plans widget for both pages", DECISION_LOG 2026-11-05), drawn
 * by `supplier-plan-table.tsx`. Its own module so /for-coordinators can read it without importing /for-suppliers'
 * sample shop (that page's sample is "Setnayan Weddings", owner 2026-11-06).
 *
 * PURE: no I/O, no env. 🔒 supplier-plan-table-tells-the-truth.test.ts
 */
import { formatCount } from '@/lib/format-number';
import { storageWords } from '@/lib/downgrade-limits';
import { LOCKS, LOCK_KEYS, canUse, type LockDef, type LockKey } from '@/lib/locks';
import { PLAN_LIMITS, limitOf, limitWords, type PlanLimitKey } from '@/lib/plan-sheet';
import { SPECIALIZED_TOOLS_INCLUDED_TIERS } from '@/lib/specialized-tools-access';
import { vendorAddonSkuCode } from '@/lib/vendor-addon-tier-pricing';
import { PLAN_CHATBOT_LEVEL } from '@/lib/vendor-ai-level';
import { FREE_HELPER_SEATS } from '@/lib/vendor-free-helper';
import { allowance } from '@/lib/vendor-plan-rows';
import { TIER_CAPS, TIER_LABEL, WAITLIST_SETTING_MAX, type VendorTier } from '@/lib/vendor-tier-caps';
import { ULTRA_ADDON_ORDER, canBuyUltraAddOn, ultraAddOnSku, type UltraAddOnKind } from '@/lib/vendor-ultra-addons';

/**
 * Free's search line: the 15 Nov rule the database applies (`vendor_profiles.is_findable`, lib/findable-shop.ts) — an
 * unverified shop is reached by its own link and QR (and booked there); Verified adds Discover and Suppliers › Find.
 * Both front pages say these words.
 */
export const FREE_FINDABLE = 'found by your own link and QR';

/** The Plans table's reach cell — the same on every plan since 2026-11-19 (no plan ceiling; verification is the gate). */
export const PLAN_TABLE_REACH = 'Once verified · you set how far';

/** The paid plans a shop grows into, in order. */
const GROW_TIERS = ['solo', 'pro', 'enterprise'] as const;

/** The plan name a person reads — Verified for the free verified step, Ultra for `enterprise`. */
function planName(t: VendorTier): string {
  return t === 'verified' ? 'Verified' : TIER_LABEL[t];
}

/* ───────────────────────── THE PLAN TABLE: Free · Plus · Pro · Ultra (Build 6 Lane J; simpler plans 2026-11-14) ───────────────────────── */

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
 *   · the tools unlock → `SPECIALIZED_TOOLS_INCLUDED_TIERS` (included from Plus since 2026-11-14 — no longer sold);
 *   · the chatbot → `PLAN_CHATBOT_LEVEL` (lib/vendor-ai-level.ts — the same table the inbox's gate reads);
 *   · gifts → the SAME list price on every plan (📦 2026-11-14 / 2026-11-17: one price per gift; the buy-10-get-1
 *     bundles are open to every shop — lib/shop-gifts.ts), so no plan buys gifts for less;
 *   · Deep Search → the SKU each plan is CHARGED from (`vendorAddonSkuCode`), priced by the catalogue;
 *   · storage → `TIER_CAPS.storageBytes` in `storageWords` (owner 2026-11-22 "FINAL LADDER": the plans ARE storage sizes);
 *   · no add-on row: nothing is sold on top of a plan since 2026-11-22 (`canBuyUltraAddOn` says no for all six);
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

/**
 * The four columns — Free · Plus · Pro · Ultra (owner 2026-11-14, DECISION_LOG "SIMPLER SUPPLIER PLANS" item 6:
 * "Verified joins Free" — the badge and the checks are unchanged; the table stops drawing it as a fifth plan). Where
 * Verified differs from Free (search reach), the Free cell says both.
 */
export const TABLE_TIERS: readonly VendorTier[] = ['free', 'solo', 'pro', 'enterprise'];

/** The words under the Free column's name. */
export const FREE_COLUMN_NOTE = 'Verified once your papers are approved';

/** A cell: `yes` / `no` draw a mark (with words for a screen reader), `lock` draws 🔒 + its words, `text` prints words. */
export type TableCell = { kind: 'yes' | 'no' | 'lock' | 'text'; text: string };
export type TableRow = {
  key: string;
  label: string;
  /** Small words under the row name (the per-service count's explanation). */
  note?: string;
  /** A locked row's Problem → Solution line (owner 10 Nov: "always show the Problem and Solution"). */
  why?: { problem: string; solution: string };
  cells: Record<VendorTier, TableCell>;
};
export type TableGroup = { title: string; rows: TableRow[] };

/** Prices the page read, by plan and by SKU. `null` = unread → "—". */
export type PlanTablePrices = {
  /** Monthly only — no yearly supplier plan (owner 2026-11-22). */
  monthly: Partial<Record<VendorTier, string | null>>;
  bySku: Readonly<Record<string, string | null>>;
};

const DASH = '—';
const yes = (text = 'Yes'): TableCell => ({ kind: 'yes', text });
const no = (text = 'No'): TableCell => ({ kind: 'no', text });
const words = (text: string): TableCell => ({ kind: 'text', text });
const each = (f: (t: VendorTier) => TableCell): Record<VendorTier, TableCell> =>
  Object.fromEntries(TABLE_TIERS.map((t) => [t, f(t)])) as Record<VendorTier, TableCell>;
const has = (on: boolean): TableCell => (on ? yes() : no());

/** The table's own plan names (Free · Plus · Pro · Ultra). */
export function tableTierName(t: VendorTier): string {
  return planName(t);
}

/** A limit cell, through the plan sheet's own reader. 0 reads "None" (a plan without it). */
function limitCell(t: VendorTier, key: PlanLimitKey, paywallOn: boolean): TableCell {
  const v = limitOf(t, key, paywallOn);
  if (t === 'free') {
    // Verified joins Free: where the verified step's number differs, the Free cell says both.
    const ver = limitOf('verified', key, paywallOn);
    const freeWords = v === 0 ? 'None' : limitWords(key, v);
    if (ver !== v) return words(`${freeWords}; ${ver === 0 ? 'none' : limitWords(key, ver)} once Verified`);
    return v === 0 ? no('None') : words(freeWords);
  }
  if (v === 0) return no('None');
  return words(limitWords(key, v));
}

/** The chatbot a plan includes (lib/vendor-ai-level.ts `PLAN_CHATBOT_LEVEL` — the gate the inbox reads). */
function chatbotCell(t: VendorTier): TableCell {
  const level = PLAN_CHATBOT_LEVEL[t] ?? 'none';
  if (level === 'advanced') return yes('Smarter level: your voice, the couple’s language');
  if (level === 'basic') return yes('Included');
  // Verified joins Free (owner 21 Nov: "AI Chatbot is for verified and up"): the Free cell says where it opens.
  if (t === 'free' && (PLAN_CHATBOT_LEVEL.verified ?? 'none') !== 'none') return { kind: 'lock', text: 'Opens once Verified' };
  return no('Not included');
}

export function planTable(input: { paywallOn: boolean; prices: PlanTablePrices }): TableGroup[] {
  const { paywallOn, prices } = input;
  /** "₱499 a search" — or just "—" when the row could not be read (never a suffix on nothing). */
  const per = (code: string, tail: string): string => (prices.bySku[code] ? `${prices.bySku[code]}${tail}` : DASH);

  // 💾 Storage first — what the plans are sold by (owner 2026-11-22 "FINAL LADDER"). Verified joins Free: its 1 GB is said
  // in the Free cell, like every other limit where the verified step differs.
  const storageCell = (t: VendorTier): TableCell => {
    const w = (b: number | null) => (b === null ? DASH : storageWords(b));
    const own = TIER_CAPS[t].storageBytes;
    const ver = TIER_CAPS.verified.storageBytes;
    return words(t === 'free' && ver !== own ? `${w(own)}; ${w(ver)} once Verified` : w(own));
  };
  const limits: TableRow[] = [
    { key: 'limit:storage', label: 'Storage for your files', cells: each(storageCell) },
    ...PLAN_LIMITS.map((l) => ({
      key: `limit:${l.key}`,
      label: l.title,
      cells: each((t) => limitCell(t, l.key, paywallOn)),
    })),
  ];
  // 🔓 REACH IS THE SAME ON EVERY PLAN (owner 2026-11-19: *"ok unlock the range. not plan dependend anymore."* · *"Free
  // Unverified account will have a range of 0km."*). One row, one sentence, no km per plan.
  limits.push({ key: 'limit:reach', label: 'Shown in search', cells: each(() => words(PLAN_TABLE_REACH)) });
  limits.push({
    key: 'limit:waitlist',
    label: 'Waiting list, per date',
    // No plan limit since 2026-11-18 (ruling 32) — the shop sets its own number, up to the setting's ceiling.
    cells: each((t) => {
      const v = allowance(TIER_CAPS[t].waitlistAcceptances, 'waitlistAcceptances', paywallOn);
      return v >= WAITLIST_SETTING_MAX ? words('No plan limit') : v > 0 ? words(formatCount(v)) : no('None');
    }),
  });
  if (FREE_HELPER_SEATS > 0) {
    limits.push({ key: 'limit:helper', label: 'Free Helper on the event day', cells: each(() => words(formatCount(FREE_HELPER_SEATS))) });
  }

  const free = (t: VendorTier) => t === 'free' || t === 'verified';
  const price: TableRow[] = [
    { key: 'price:4w', label: 'Every 4 weeks', cells: each((t) => (free(t) ? words('Free') : words(prices.monthly[t] ?? DASH))) },
  ];

  const tools: TableRow[] = [
    {
      key: 'tool:specialized',
      label: 'Specialized tools',
      cells: each((t) => (SPECIALIZED_TOOLS_INCLUDED_TIERS.includes(t) ? yes('All included') : words('Free set'))),
    },
    { key: 'tool:chatbot', label: 'AI chatbot', cells: each(chatbotCell) },
    { key: 'tool:address', label: 'Your own web address', cells: each((t) => has(TIER_CAPS[t].customWebsiteName)) },
    { key: 'tool:premium', label: 'Premium two-column page', cells: each((t) => has(TIER_CAPS[t].premiumPage)) },
    { key: 'tool:video', label: 'Video links in your forms', cells: each((t) => has(TIER_CAPS[t].formVideoLinks)) },
    { key: 'tool:uploads', label: 'Uploads in your forms', cells: each((t) => has(TIER_CAPS[t].formMediaUploads)) },
    { key: 'tool:trends', label: 'Trends on your own numbers', cells: each((t) => has(TIER_CAPS[t].performanceTrends)) },
    { key: 'tool:intel', label: 'Market Intelligence: your category vs peers', cells: each((t) => has(TIER_CAPS[t].marketIntel)) },
    { key: 'tool:theft', label: 'Reverse-image theft watch', cells: each((t) => has(TIER_CAPS[t].theftWatch)) },
  ];

  const buy: TableRow[] = [
    {
      key: 'buy:deep',
      label: 'Deep Search',
      cells: each((t) => words(per(vendorAddonSkuCode('deep_search_about_you', t), ' a search'))),
    },
    { key: 'money:gift', label: 'Setnayan gifts you buy', cells: each(() => words('List price')) },
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
    { title: 'Buy more', rows: buy },
    ...(verify.length ? [{ title: 'Getting verified', rows: verify }] : []),
  ];
}

/**
 * What is LEFT TO BUY on top of a plan: nothing since owner 2026-11-22 "FINAL LADDER" (no add-ons — Pro and Ultra have
 * no seat or branch limit), so this lists none today; it still reads `canBuyUltraAddOn`, so a ruling that sells one
 * again lists it by itself. Each priced by the SKU its purchase charges; a price
 * that could not be read prints "Price unavailable", never a guess.
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
  service_card: '+1 service card',
  seat: '+1 team seat',
  branch: '+1 branch',
  waitlist: '+1 waiting-list place per date',
  booking_per_date: '+1 booking per date per card',
};
