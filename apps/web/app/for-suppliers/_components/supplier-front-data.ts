/**
 * supplier-front-data — what the /for-suppliers page SAYS that is a fact about the app, derived from where the app
 * keeps it. The words are the owner-approved prototype's (`prototypes/for_suppliers_2026-11-06/index.html`,
 * approved 6 Nov 2026, DECISION_LOG "SUPPLIER FRONT PAGE (/for-suppliers): ONE STORY FOR EVERYONE — APPROVED");
 * every NUMBER and every PLAN NAME next to a feature is read, never typed (README § "Where every number comes from"):
 *
 *   · reach · categories · cards · seats · branches · waiting list  → `TIER_CAPS` (lib/vendor-tier-caps.ts)
 *   · which plan a Solo / Pro / Ultra line sits under                 → the Plans page's own rows,
 *                                                                       `VENDOR_TIER_SECTIONS` (vendor-benefits.ts)
 *   · which plan first has a fold line ("Pro+")                       → the same rows, or `firstPlanWith(TIER_CAPS)`
 *   · the 3D seat-plan logo                                           → `boothTierCanBrand` (booth-branding-tier-gate)
 *   · plan prices, the year price, the branch + seat add-ons          → the catalog, read by the page (getVendorPrices)
 *   · the booking fee                                                  → the live schedule, read by the page
 *
 * Pure module (no React, no I/O) — `supplier-front-reads-its-numbers.test.ts` runs it.
 */
import { VENDOR_TIER_SECTIONS } from '@/app/_components/home/vendor-benefits';
import { boothTierCanBrand } from '@/lib/booth-branding-tier-gate';
import { countNoun, formatCount } from '@/lib/format-number';
import { MILESTONE_THRESHOLDS } from '@/lib/service-card-record';
import { FREE_HELPER_SEATS } from '@/lib/vendor-free-helper';
import {
  PORTFOLIO_FREE_BASE,
  TIER_CAPS,
  canBuyExtraBranches,
  canBuyExtraSeats,
  TIER_LABEL,
  firstPlanWith,
  isTierAtLeast,
  type TierCaps,
  type VendorTier,
} from '@/lib/vendor-tier-caps';
import { LOCKS, LOCK_KEYS, canUse, type LockDef, type LockKey } from '@/lib/locks';
import { PLAN_LIMITS, limitOf, limitWords, type PlanLimitKey } from '@/lib/plan-sheet';
import { allowance } from '@/lib/vendor-plan-rows';
import { tierPaysGiftPrice } from '@/lib/shop-gifts';
import {
  SPECIALIZED_TOOLS_INCLUDED_TIERS,
  SPECIALIZED_TOOLS_MIN_TIER,
  SPECIALIZED_TOOLS_SKU_CODE,
} from '@/lib/specialized-tools-access';
import { vendorAddonSkuCode } from '@/lib/vendor-addon-tier-pricing';
import { ULTRA_ADDON_ORDER, canBuyUltraAddOn, ultraAddOnSku, type UltraAddOnKind } from '@/lib/vendor-ultra-addons';

/** The three paid plans, in the order the Grow step shows them. `enterprise` is the code key; people read "Ultra". */
export const GROW_TIERS = ['solo', 'pro', 'enterprise'] as const;
export type GrowTier = (typeof GROW_TIERS)[number];

/**
 * THE SAMPLE SHOP the page shows and links to (owner 6 Nov: *"Use setnayan. production … across the whole
 * frontpage"*; a dot is not allowed in a shop address, `VENDOR_SLUG_RE`, so the hyphen).
 * ⚠ The demo shop in production is still `setnaprod` — every code on this page scans to a dead address until the
 * owner renames it (shop settings; slug forwarding keeps the old link). Flagged in the PR, not done here.
 */
export const SAMPLE_SHOP = { slug: 'setnayan-production', name: 'Setnayan Productions' } as const;

/** The plan name a person reads for a code key — Verified for the free verified step, Ultra for `enterprise`. */
function planName(t: VendorTier): string {
  return t === 'verified' ? 'Verified' : TIER_LABEL[t];
}

/** "20 km" / "nationwide" from a radius (Ultra is `Infinity`). */
function reach(km: number, nationwide = 'nationwide'): string {
  return Number.isFinite(km) ? `${formatCount(km)} km` : nationwide;
}

/** The pill beside a feature: "Verified", "Solo+", "Pro+", or "Ultra" (nothing is above Ultra on this page). */
export function planPill(t: VendorTier | null): string {
  if (t === null || t === 'free') return 'Free';
  if (t === 'verified') return 'Verified';
  if (t === 'enterprise') return planName('enterprise');
  return `${planName(t)}+`;
}

/** The plan whose Plans-page rows (`VENDOR_TIER_SECTIONS`) carry a row matching `row`, or null when none does. */
export function tierOfPlansRow(row: RegExp): VendorTier | null {
  const hit = VENDOR_TIER_SECTIONS.find((s) => s.groups.some((g) => g.items.some((i) => row.test(i.n))));
  return hit ? hit.tier : null;
}

/* ───────────────────────── the steps: Free → Verified → Grow ───────────────────────── */

/**
 * "1 category · 1 service card · found until your first inquiry" — Free's line, from its caps. The search half is the
 * 7 Nov rule the database applies (`vendor_profiles.is_findable`, lib/findable-shop.ts): an unverified shop shows in
 * search until its first inquiry, then waits for Verified. (It said "not in search yet" until Lane J — false since 7 Nov.)
 */
export const FREE_FINDABLE = 'found until your first inquiry';
export function freeSpec(): string {
  const c = TIER_CAPS.free;
  return `${countNoun(c.parentCategories, 'category', 'categories')} · ${countNoun(c.servicesPerLeaf, 'service card', 'service cards')} · ${FREE_FINDABLE}`;
}

/** "20 km around you · the Verified seal · get paid in the app" — Verified's line. */
export function verifiedSpec(): string {
  return `${reach(TIER_CAPS.verified.serviceRadiusKm)} around you · the Verified seal · get paid in the app`;
}

/**
 * A paid plan's spec line, e.g. Pro: "100 km · 8 categories · 10 service cards each · 5 team seats · 3 branches ·
 * waiting list, 1 a date". A part a plan does not have (Solo's branches, Solo's waiting list) is left out, as the
 * prototype leaves it out.
 */
export function growSpec(t: GrowTier): string {
  const c: TierCaps = TIER_CAPS[t];
  const parts = [
    reach(c.serviceRadiusKm, 'Nationwide'),
    countNoun(c.parentCategories, 'category', 'categories'),
    `${countNoun(c.servicesPerLeaf, 'service card', 'service cards')} each`,
    countNoun(c.agentAccounts, 'team seat', 'team seats'),
  ];
  if (c.branchesIncluded > 0) parts.push(countNoun(c.branchesIncluded, 'branch', 'branches'));
  if (c.waitlistAcceptances > 0) parts.push(`waiting list, ${formatCount(c.waitlistAcceptances)} a date`);
  return parts.join(' · ');
}

/** "Everything in Verified, plus" — the plan below, by the Grow order. */
export function growPlus(t: GrowTier): string {
  const below: Record<GrowTier, VendorTier> = { solo: 'verified', pro: 'solo', enterprise: 'pro' };
  return `Everything in ${planName(below[t])}, plus`;
}

/**
 * The lines each paid plan ADDS — the prototype's words, each tied to the Plans page row it summarises. The plan a
 * line is shown under is WHERE THAT ROW LIVES, so moving a row on the Plans page moves it here (the owner's
 * 2026-11-05 "same as the Plans" rule: one source for both pages). `lead` lines are drawn bold.
 */
export const GROW_LINES: ReadonlyArray<{ text: string; tail?: string; lead?: true; row: RegExp }> = [
  { text: 'Your own web address', lead: true, row: /^Your own web address$/ },
  { text: 'Personalize your page: intro, accent colour, featured services, sections', row: /^Personalize your public page$/ },
  { text: 'Quote-to-booking funnel', row: /^Quote-to-booking funnel$/ },
  { text: 'Won and lost reasons', row: /^Won & lost reasons$/ },
  { text: 'Your own reply and booking metrics', row: /^Your own funnel metrics$/ },
  { text: 'Earnings dashboard', row: /^Earnings dashboard$/ },
  { text: 'Recap sharing to your Facebook Page', row: /^Recap sharing$/ },
  { text: 'Your logo on the couple’s 3D seat plan (3D Booth add-on)', row: /3D seat plan/ },
  { text: 'Premium two-column page', tail: ' with a sticky Inquire rail', lead: true, row: /^Premium two-column page$/ },
  { text: 'One business identity for your whole crew', row: /^One clean business identity$/ },
  { text: 'Demand Radar', row: /^Demand Radar$/ },
  { text: 'Reverse-image theft watch', row: /^Reverse-image theft watch$/ },
  { text: 'Custom /your-name address and full written reviews', row: /^Custom slug \+ full written reviews$/ },
  { text: 'Featured in Stories', row: /^Featured in Stories$/ },
  { text: 'Editorial and article spotlights', row: /^Editorial & article spotlights$/ },
  { text: 'Priority support', row: /^Priority support$/ },
  { text: 'Flagship page with video films', lead: true, row: /^Flagship page \+ video films$/ },
  { text: 'Multi-admin for your team', row: /multi-admin/ },
  { text: 'Market Intelligence: your category vs peers', row: /^Market Intelligence/ },
  { text: 'Front-of-line dispute handling', row: /^Front-of-line dispute handling$/ },
];

export type GrowLine = { text: string; tail?: string; lead: boolean };

/**
 * The lines shown under one paid plan. A line whose Plans-page row is gone is dropped (never shown under a guess);
 * the 3D seat-plan line additionally sits under the FIRST plan `boothTierCanBrand` opens, so the gate and the page
 * cannot disagree.
 */
export function growLines(t: GrowTier): GrowLine[] {
  const firstBooth = GROW_TIERS.find((g) => boothTierCanBrand(g)) ?? null;
  return GROW_LINES.filter((l) => {
    const at = l.row.source.includes('3D') ? firstBooth : tierOfPlansRow(l.row);
    return at === t;
  }).map((l) => ({ text: l.text, tail: l.tail, lead: l.lead === true }));
}

/** The papers Verified asks for, as the step says them. `REQUIRED_DOC_COUNT` holds the count (see the test). */
export const VERIFIED_PAPERS = ['DTI or SEC', 'BIR 2303', 'Permit', 'Bank proof'] as const;

/* ───────────────────────── reach, the free base, the badges ───────────────────────── */

/** "20 km around you, 30 km on Solo, 100 km on Pro, nationwide on Ultra" — the ⓘ under the QR codes. */
export function reachSentence(): string {
  const head = `${reach(TIER_CAPS.verified.serviceRadiusKm)} around you`;
  const rest = GROW_TIERS.map((t) => `${reach(TIER_CAPS[t].serviceRadiusKm)} on ${planName(t)}`);
  return [head, ...rest.slice(0, -1)].join(', ') + `, ${rest[rest.length - 1]}`;
}

/** Verified's own reach, for "Shown in search 20 km around you". */
export const VERIFIED_REACH = reach(TIER_CAPS.verified.serviceRadiusKm);

/** The free photo base ("50 portfolio photos"). */
export const FREE_PHOTOS = formatCount(PORTFOLIO_FREE_BASE);

/** "10 · 50 · 100 · 500 · 1,000 · 5,000 · 10,000" — where a badge climbs. */
export const BADGE_STEPS = MILESTONE_THRESHOLDS.map((n) => formatCount(n)).join(' · ');
export const BADGE_FIRST = formatCount(MILESTONE_THRESHOLDS[0]);
export const BADGE_LAST = formatCount(MILESTONE_THRESHOLDS[MILESTONE_THRESHOLDS.length - 1]);

/* ───────────────────────── Everything you get (the fold) ───────────────────────── */

export type FoldLine = { text: string; pill: string };
export type FoldGroup = { title: string; lines: FoldLine[] };

const seatsFrom = firstPlanWith((c) => c.agentAccounts > 0);
const reachGrowsFrom = firstPlanWith((c) => c.serviceRadiusKm > TIER_CAPS.verified.serviceRadiusKm);
const waitlistFrom = firstPlanWith((c) => c.waitlistAcceptances > 0);
const branchesFrom = firstPlanWith((c) => c.branchesIncluded > 0);

/**
 * The five groups behind "Everything you get" — the prototype's lines and counts (9 · 11 · 6 · 6 · 9). A line marked
 * Free is free on every plan; a plan pill is READ (the Plans-page row's plan, or the first plan whose caps carry it).
 */
export function foldGroups(): FoldGroup[] {
  const free = (text: string): FoldLine => ({ text, pill: 'Free' });
  const at = (text: string, t: VendorTier | null): FoldLine => ({ text, pill: planPill(t) });
  return [
    {
      title: 'Get found',
      lines: [
        free('Your public page, auto-built, ready for Google'),
        free(`${FREE_PHOTOS} portfolio photos`),
        free('Six QR codes: Shortlist, Check a date, My page, Booked, Crew, Review'),
        at(`Shown in search ${VERIFIED_REACH} around you`, 'verified'),
        at('Wider search reach as you grow', reachGrowsFrom),
        at('Your own web address', tierOfPlansRow(/^Your own web address$/)),
        at('Featured in Stories, editorial spotlights', tierOfPlansRow(/^Featured in Stories$/)),
        free('NFC tags, door sticker, ready-made printed pieces'),
      ],
    },
    {
      title: 'Get booked',
      lines: [
        free('One inbox; only inquiries that match what you do'),
        free('Quote in the chat: flat, per guest, per hour'),
        free('Reservation → progress → balance on one timeline, with proof'),
        free('Paid straight to your GCash or bank'),
        free('Discounts, perks and the Setnayan gift on your cards'),
        free('Give Setnayan gifts (like Papic) with your quote; you buy the stock'),
        free('Double-booking guard'),
        free('A day check before you accept, so two events never clash'),
        free('Inquiries, payments and schedule changes reach your phone as notices'),
        at('Waiting list per date', waitlistFrom),
        free('Meetings: in person, or a call on your own phone or Viber'),
      ],
    },
    {
      title: 'Work together',
      lines: [
        free('Their event opens to you once booked'),
        free('Your moment on their schedule, one tap to approve'),
        free('Headcount live from RSVPs'),
        free("Your questions travel to the couple's page"),
        free('Contract on record, change-order trail'),
        free('Import past clients'),
      ],
    },
    {
      title: 'Run the day',
      lines: [
        free('Now · Next · Arrived, status buttons'),
        free('Saved for no signal'),
        free('Crew code, one per event'),
        at('Team seats, each with their own login', seatsFrom),
        free('Review QR and live reviews'),
        free('Tools by your type: production sheet, shot list, song desk, script, seat plan, mood board'),
      ],
    },
    {
      title: 'Grow',
      lines: [
        free(`Badges from ${BADGE_FIRST} to ${BADGE_LAST} events; stars; years`),
        free('Returning-client mark and discount'),
        free('Reviews with "Verified booking"; right of reply'),
        free('Price-position meter, profile score'),
        at('Earnings dashboard, won and lost reasons', tierOfPlansRow(/^Earnings dashboard$/)),
        at('Reverse-image theft watch', tierOfPlansRow(/^Reverse-image theft watch$/)),
        at('Branches under one shop', branchesFrom),
        at('Market Intelligence', tierOfPlansRow(/^Market Intelligence/)),
        free('Gifts per badge'),
      ],
    },
  ];
}

/* ───────────────────────── illustrations (NOT prices) ───────────────────────── */

/**
 * The four "Your price, your way" cards. ⚠ THESE ARE ILLUSTRATIONS, NOT PRICES FROM THE APP — the page says so in
 * the card section's ⓘ ("Examples above are illustrations, not prices from the app."). They are the only peso
 * figures typed for this page, and they live here, in one named place, so the guard can tell them apart.
 */
export const PRICE_SHAPE_EXAMPLES = {
  perGuest: { rate: 850, n: 150, step: 10, min: 10, max: 1000 },
  perHour: { rate: 4000, n: 5, step: 1, min: 2, max: 12 },
  bySize: {
    start: 1,
    list: [
      { label: 'Small tent · 100 guests', value: 18000 },
      { label: 'Medium tent · 200 guests', value: 32000 },
      { label: 'Large tent · 300 guests', value: 45000 },
    ],
  },
  onePrice: {
    start: 0,
    list: [
      { label: 'Full day', value: 45000 },
      { label: 'Full day + drone', value: 53000 },
      { label: 'Full day + drone + album', value: 60000 },
    ],
  },
} as const;

/** The fee slider's travel — an example booking price the visitor drags, not a price. */
export const FEE_SLIDER = { min: 10000, max: 1000000, step: 5000, start: 300000 } as const;

/* ───────────────────────── small read facts the page prints ───────────────────────── */

/** "More seats from Solo" — the first plan whose caps carry a team seat. Null if no plan does. */
export const MORE_SEATS_FROM: string | null = seatsFrom ? `More seats from ${planName(seatsFrom)}` : null;

/**
 * "Every plan, Free included, comes with one free Helper for the event day." — from `FREE_HELPER_SEATS`
 * (lib/vendor-free-helper.ts). Null when the free Helper is switched off (`0`), so the line is not printed.
 */
export function helperLine(): string | null {
  const n = FREE_HELPER_SEATS;
  if (n <= 0) return null;
  const helpers = n === 1 ? 'one free Helper' : `${formatCount(n)} free Helpers`;
  return `Every plan, Free included, comes with ${helpers} for the event day.`;
}

/** The plans that may buy an extra branch AND an extra seat (today only Ultra) — `canBuyExtra*` in vendor-tier-caps. */
export const ADDON_TIERS: GrowTier[] = GROW_TIERS.filter((t) => canBuyExtraBranches(t) && canBuyExtraSeats(t));

/** "Bigger than Ultra? Add more." — the top plan's name. */
export const ADDONS_HEAD = `Bigger than ${planName(GROW_TIERS[GROW_TIERS.length - 1]!)}? Add more.`;

/** "Per 4 weeks. Only Ultra can add these." */
export function addonsFine(): string {
  return `Per 4 weeks. Only ${ADDON_TIERS.map(planName).join(' and ')} can add these.`;
}

/** The plan name a person reads ("Ultra" for `enterprise`), for the page's tabs. */
export function growName(t: GrowTier): string {
  return planName(t);
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
