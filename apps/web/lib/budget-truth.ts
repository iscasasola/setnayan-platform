/**
 * budget-truth — THE money resolver.  (BUD-1 · Explore_Replan_BUILD_SPEC_2026-07-27 §18.1)
 *
 * ─── Why this file exists ─────────────────────────────────────────────────
 * Seven surfaces compute "the budget" with five incompatible formulas, and on
 * prod they disagree ON THE SAME SCREEN: `/budget` prints "Total to pay
 * ₱80,000" eight inches above "Committed ₱0" plus the empty state "You're
 * still choosing vendors" — and the ₱80,000 vendor's card is not rendered, so
 * the couple cannot find, edit or delete the number driving their own
 * headline. (Verified prod event 044f7e64…: one `considering` vendor with
 * total_cost_php = 80000. The live card sums EVERY vendor's itemized total;
 * the strip sums only `contracted`+ vendors; the card list renders only
 * `contracted`+ vendors. Three different row sets, one screen.)
 *
 * `resolveEventMoney()` is the one calculator every surface asks instead.
 * BUD-1 ships it READ-ONLY: no schema, no UI, nothing wired. BUD-2..BUD-10
 * move each surface onto it, one PR at a time, with the parity harness
 * (`scripts/budget-parity.ts`) proving each move changed the number TO THE
 * RIGHT ONE rather than merely changing it.
 *
 * ─── The counting law ─────────────────────────────────────────────────────
 * One peso, one row, one `costKey`. The resolver:
 *   · excludes `event_vendors.archived_at IS NOT NULL`                (R8)
 *   · excludes `event_vendors.voided_by_fraud = true`
 *   · excludes `package_role = 'covered'` rows — they contribute ₱0    (R3)
 *   · never mixes a vendor's headline with their line items            (R12)
 *   · reads the AGREED package total, never Σ replacement values       (R4)
 *   · counts transport + crew meals, which `/budget` cannot see today  (R5)
 *   · reconciles paid vs owed explicitly instead of clamping silently  (R11)
 *
 * ─── The honesty rules (§18.5) this file enforces ─────────────────────────
 *  2/3. Estimates NEVER enter `committed` or `stillOwed`. They live in
 *       `estimated`, every line carries `kind: 'estimated'`, and `sources[]`
 *       tells a caller which pesos are guesses so it can mark them.
 *  4.   "Over budget" has ONE meaning and only this resolver may say it:
 *       what the couple has actually AGREED exceeds their target. Exposed as
 *       `isOverBudget` / `overBudgetByPhp`. A shortlist range or a benchmark
 *       projection is NOT this.
 *  5.   Unknown is unknown, never ₱0. Buckets carry `hasBenchmark`; the
 *       unseeded leaves are named in `warnings[]` so a caller prints
 *       "no typical price yet" instead of a confident wrong total.
 *  6.   The totals must reconcile. See THE INVARIANT below.
 *  8.   Nothing disappears silently — archived / fraud-voided / covered rows
 *       that carried money are named in `warnings[]`, not just dropped.
 *
 * ─── THE INVARIANT ────────────────────────────────────────────────────────
 *      committed + overpaid === paid + stillOwed
 *
 * ⚠ §18.5 rule 6 writes this as "Committed = Paid + Still owed + Overpaid".
 *   That form is MIS-SIGNED and cannot hold: with committed ₱100k and paid
 *   ₱120k it claims 100 = 120 + 0 + 20. The reconciling identity — same three
 *   figures, same intent ("never let three headline figures quietly stop
 *   adding up") — is `committed = paid + stillOwed − overpaid`, i.e. the form
 *   asserted above. `checkMoneyInvariant()` enforces it on every result and
 *   the unit suite asserts it on every fixture.
 *
 * ─── Units ────────────────────────────────────────────────────────────────
 * Everything is computed in INTEGER CENTAVOS internally so the invariant is
 * exact (no float drift across 40+ rows), and exposed in PHP on the public
 * shape — matching `event_vendors.total_cost_php` / `orders.*_total_php`,
 * which are NUMERIC PESOS. `events.estimated_budget_centavos` is the one
 * centavos column and is converted on the way in.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  buildVendorPricingLookup,
  type VendorControlledLineItem,
  type VendorPricingLookup,
  type VendorPriceSource,
} from './budget';
import { CONFIRMED_VENDOR_STATUSES } from './events';
// The one definition of "due soon" / "overdue". It lives with the guard that
// ALERTS on it (`TRIGGER_THRESHOLDS` is that file's documented home for the
// restraint dials) and is read here by the calculator that COUNTS it, so the
// page and the email cannot drift apart. The edge only points this way:
// setnayan-ai-triggers is pure and clock-free, while this file reaches a
// database — importing this one there would drag Supabase into the digest.
import {
  TRIGGER_THRESHOLDS,
  daysUntilDue,
  paymentDueState,
  type PaymentDueState,
} from './setnayan-ai-triggers';
import { PLAN_GROUPS } from './wedding-plan-groups';
import type { EventVendorRow, VendorCategory } from './vendors';

// ── Public shape ─────────────────────────────────────────────────────────────

/**
 * Where one peso came from. Every line and every `sources[]` note carries one,
 * so a caller can label an estimate as an estimate without re-deriving it.
 */
export type MoneySource =
  /** `orders` row — a Setnayan SKU the couple bought from us. Read-only. */
  | 'setnayan_order'
  /** `event_vendors.total_cost_php` on a `package_role = 'anchor'` row. */
  | 'vendor_package'
  /** `vendor_services.starting_price_php` — a published list price, an ESTIMATE. */
  | 'vendor_service_listing'
  /** `event_vendor_line_items.amount_php` (signed; negative = credit). */
  | 'vendor_line_item'
  /** `event_vendors.total_cost_php` — the legacy headline. */
  | 'vendor_headline'
  /** `event_vendors.transport_php`. */
  | 'vendor_transport'
  /** `event_vendors.food_allowance_php`. */
  | 'vendor_crew_meal'
  /** `event_vendor_payments.amount_php` on a vendor nothing was agreed with. */
  | 'vendor_unbooked_payment';

export type MoneyKind = 'committed' | 'estimated';

/** One row of the couple's ledger. */
export type MoneyLine = {
  /** Stable dedup key — the counting law's "one peso, one row, one costKey". */
  costKey: string;
  label: string;
  /** Plan-group id, `'setnayan_services'`, or `'other'`. Never empty. */
  bucket: string;
  /** PHP. Signed — a change-order credit is negative. */
  amountPhp: number;
  kind: MoneyKind;
  /** PHP actually handed over against THIS line. 0 on estimates. */
  paidPhp: number;
  /** PHP still owed on this line (≥ 0). 0 on estimates. */
  stillOwedPhp: number;
  source: MoneySource;
  /** The db id this line traces to (order_id / vendor_id / line_item_id / …). */
  sourceRef: string;
  vendorId: string | null;
  vendorName: string | null;
  /** True when the couple cannot edit it here (Setnayan orders, vendor catalogue). */
  readOnly: boolean;
  dueDate: string | null;
  /**
   * Whole days from `now` to `dueDate` — negative once the date has passed.
   * `null` when the line carries no due date at all.
   */
  daysUntilDue: number | null;
  /**
   * Where this line stands against its own due date. `'none'` covers the two
   * cases with no milestone to miss: an undated line, and an ESTIMATE (nobody
   * has agreed to pay it, so it cannot be late). `'settled'` is a dated
   * commitment with nothing still owed — the date passing does not make a paid
   * milestone overdue.
   */
  dueState: MoneyDueState;
};

/** @see MoneyLine.dueState */
export type MoneyDueState = PaymentDueState | 'settled' | 'none';

/**
 * Still-owed money split by how its due date stands to today. DISJOINT — one
 * line lands in exactly one band, so `overduePhp + dueSoonPhp + upcomingPhp +
 * laterPhp` is the whole dated, unpaid ledger and nothing is counted twice.
 *
 * ⚠ `overduePhp` is the number this whole type exists for. Before it, a
 * payment the couple had already missed was absent from every roll-up on the
 * page and from every alert — it did not render as a warning, it rendered as
 * nothing, exactly like an event with no payments due at all.
 */
export type MoneyDue = {
  /** Still owed on milestones whose due date has PASSED. */
  overduePhp: number;
  overdueCount: number;
  /** Still owed within `TRIGGER_THRESHOLDS.paymentDueWindowDays` (due today counts). */
  dueSoonPhp: number;
  dueSoonCount: number;
  /** Still owed after that window but inside `paymentHorizonDays`. */
  upcomingPhp: number;
  upcomingCount: number;
  /** Still owed beyond the horizon. */
  laterPhp: number;
  laterCount: number;
};

export type MoneyBucket = {
  bucketId: string;
  label: string;
  committedPhp: number;
  paidPhp: number;
  stillOwedPhp: number;
  overpaidPhp: number;
  /** Estimates only — never folded into `committedPhp`. */
  estimatedPhp: number;
  /**
   * false → this leaf has NO seeded benchmark. §18.5 rule 5: a caller must
   * print "no typical price yet", never ₱0.
   */
  hasBenchmark: boolean;
  benchmarkPhp: number | null;
  /** This bucket's share of the dated ledger — same bands as `EventMoney.due`. */
  due: MoneyDue;
};

export type MoneyWarningCode =
  /** A vendor has been handed more money than was ever agreed. §18.5 rule 6. */
  | 'overpaid_vendor'
  /** `deposit_paid_php` disagrees with the itemized payment log. R6. */
  | 'unreconciled_deposit'
  /** Money paid to a vendor still at `considering` / `shortlisted`. */
  | 'payment_without_commitment'
  /** A committed vendor with no recorded price at all. */
  | 'committed_without_price'
  /** Credits exceed charges — this vendor is net-negative. R12. */
  | 'net_credit_vendor'
  /** Archived (rejected) rows carrying money were excluded. R8. */
  | 'archived_excluded'
  /** Fraud-voided rows carrying money were excluded. */
  | 'fraud_voided_excluded'
  /** `package_role='covered'` rows contributed ₱0 by design. R3. */
  | 'package_covered_zeroed'
  /** A locked package with no agreed total anywhere. R4. */
  | 'package_total_missing'
  /** Plan groups with money (or in scope) and no seeded benchmark. §18.5 rule 5. */
  | 'benchmark_unseeded'
  /** A Setnayan order sits in a status that is neither agreed nor cancelled. */
  | 'order_not_yet_agreed'
  /** A payment milestone's due date has passed and money is still owed on it. */
  | 'payment_overdue'
  /** A vendor-payer booking fee stamped with this event_id was kept out. */
  | 'vendor_payer_order_excluded'
  /** Should never fire. If it does, the totals stopped adding up. */
  | 'invariant_violation';

export type MoneyWarning = {
  code: MoneyWarningCode;
  /** Plain-English, safe to render. Never contains an amount the caller can't verify. */
  message: string;
  amountPhp?: number;
  vendorId?: string;
  vendorName?: string;
  bucket?: string;
  /** Plan-group ids, for `benchmark_unseeded`. */
  bucketIds?: string[];
};

/** One provenance note per contributing source — §18.5 rule 2's raw material. */
export type MoneySourceNote = {
  source: MoneySource;
  label: string;
  /** The table the pesos were read out of. */
  table: string;
  kind: MoneyKind;
  amountPhp: number;
  rowCount: number;
  /** true → a caller MUST render this with the estimate mark. */
  isEstimate: boolean;
};

export type EventMoney = {
  /** `events.estimated_budget_centavos` in PHP. null = no target set. */
  targetPhp: number | null;
  /** Guesses. NEVER part of `committed` or `stillOwed`. §18.5 rule 3. */
  estimated: number;
  /** What the couple has actually AGREED to pay. */
  committed: number;
  /** What has actually been handed over. */
  paid: number;
  /** `committed − paid`, floored per vendor at 0. */
  stillOwed: number;
  /** Money handed over beyond what was agreed. §18.5 rule 6. */
  overpaid: number;
  /**
   * §18.5 rule 4 — the ONE meaning of "over budget": what the couple has
   * actually agreed exceeds their target. Not a shortlist range, not a
   * benchmark projection, not a slider deviation.
   */
  isOverBudget: boolean;
  overBudgetByPhp: number;
  /** The dated ledger, banded. `due.overduePhp` is money already missed. */
  due: MoneyDue;
  byBucket: MoneyBucket[];
  lines: MoneyLine[];
  sources: MoneySourceNote[];
  warnings: MoneyWarning[];
};

// ── Inputs to the pure core ──────────────────────────────────────────────────

export type VendorMoneyRow = Pick<
  EventVendorRow,
  'vendor_id' | 'event_id' | 'category' | 'vendor_name' | 'status' | 'total_cost_php'
> & {
  transport_php?: number | null;
  food_allowance_php?: number | null;
  deposit_paid_php?: number | null;
  covers_plan_groups?: string[] | null;
  archived_at?: string | null;
  voided_by_fraud?: boolean | null;
  package_role?: string | null;
  event_vendor_package_id?: string | null;
  marketplace_vendor_id?: string | null;
};

export type LineItemMoneyRow = {
  line_item_id: string;
  vendor_id: string;
  label: string;
  amount_php: number | string | null;
  due_date: string | null;
};

export type PaymentMoneyRow = {
  payment_id: string;
  vendor_id: string;
  line_item_id: string | null;
  amount_php: number | string | null;
  paid_at: string;
};

export type OrderMoneyRow = {
  order_id: string;
  description: string | null;
  service_key: string | null;
  requested_total_php: number | string | null;
  confirmed_total_php: number | string | null;
  status: string;
  /** Set on vendor-billing orders. Present so the payer can be discriminated. */
  vendor_profile_id?: string | null;
};

/**
 * ⚠ MONEY LEAK GUARD — `orders` holds BOTH sides of the marketplace.
 *
 * `booking-fee-lock.server.ts:129-160` writes the VENDOR's booking-fee charge
 * into `orders` stamped with the COUPLE's `event_id` (payer = the vendor's
 * `user_id`, `vendor_profile_id` set, `service_key` `vendor_`-prefixed). So a
 * naive `orders WHERE event_id = …` would print the vendor's 5%→1% fee inside
 * the couple's own budget.
 *
 * The discriminator is the shipped `vendor_` service-key convention — every
 * vendor-billing order uses it and no customer SKU does (customer keys are
 * UPPER_SNAKE like `SETNAYAN_AI`); it is the same prefix `lib/orders.ts`
 * `isVatInclusiveServiceKey` keys off, and it already carries a unit test.
 * Keyed off the prefix rather than the `vendor_profile_id` FK deliberately: a
 * future couple-payer flow for a vendor booking would legitimately carry the
 * FK, and must still reach the couple's ledger.
 */
export function isVendorPayerOrder(o: Pick<OrderMoneyRow, 'service_key'>): boolean {
  return typeof o.service_key === 'string' && o.service_key.startsWith('vendor_');
}

export type BenchmarkMoneyRow = {
  plan_group_id: string;
  benchmark_php: number | null;
};

export type MoneyInputs = {
  targetCentavos: number | null;
  vendors: VendorMoneyRow[];
  lineItems: LineItemMoneyRow[];
  payments: PaymentMoneyRow[];
  orders: OrderMoneyRow[];
  /** From `buildVendorPricingLookup` — the vendor-authored catalogue half. */
  pricing: VendorPricingLookup;
  /**
   * `event_vendor_packages.total_locked_centavos` keyed by booking_id — the
   * fallback agreed total for an anchor row whose `total_cost_php` is NULL.
   */
  packageLockedCentavos: Map<string, number>;
  /** Active `budget_leaf_benchmarks` rows — drives `hasBenchmark`. §18.5 rule 5. */
  benchmarks: BenchmarkMoneyRow[];
  /** Plan-group ids in scope for this event, so unseeded leaves can be named. */
  scopePlanGroupIds?: string[];
  /**
   * The instant "overdue" is measured against. Injected, never read from the
   * clock inside the core, so every due-date boundary (-1 · 0 · +1 · +7 · +8 ·
   * +30 · +31) is testable and the parity harness stays deterministic.
   * Omitted → `new Date()`, which is what `resolveEventMoney` passes anyway.
   */
  now?: Date;
};

// ── Small helpers ────────────────────────────────────────────────────────────

const CONFIRMED = new Set<string>(CONFIRMED_VENDOR_STATUSES as readonly string[]);

/** Setnayan order statuses that mean "the couple has agreed to this price". */
const ORDER_COMMITTED_STATUSES = new Set(['paid', 'fulfilled', 'awaiting_payment']);
/** …and the subset where the money has actually moved. */
const ORDER_PAID_STATUSES = new Set(['paid', 'fulfilled']);
/**
 * Applied but not yet approved. Per the SKU activation gate (activation is on
 * ADMIN APPROVAL, never on submission) this is NOT a commitment — it enters
 * `estimated` so the couple sees the number without being told they owe it.
 */
const ORDER_ESTIMATE_STATUSES = new Set(['submitted']);

export const OTHER_BUCKET = 'other';
export const SETNAYAN_BUCKET = 'setnayan_services';

const BUCKET_LABEL: Record<string, string> = {
  [OTHER_BUCKET]: 'Other',
  [SETNAYAN_BUCKET]: 'Setnayan services',
};
const BUCKET_BY_CATEGORY = new Map<string, string>();
for (const group of PLAN_GROUPS) {
  BUCKET_LABEL[group.id] = group.label;
  for (const cat of group.categories) {
    if (!BUCKET_BY_CATEGORY.has(cat)) BUCKET_BY_CATEGORY.set(cat, group.id);
  }
}

export function bucketLabel(bucketId: string): string {
  return BUCKET_LABEL[bucketId] ?? bucketId;
}

/**
 * Which bucket a vendor's money lands in.
 *
 * `covers_plan_groups[0]` is the booking plan group and wins. When it's empty
 * we map the vendor_category — this is the half `checklist-budget.ts:186`
 * throws away (`if (groups.length === 0) continue;`), which is why ₱810,000 of
 * real commitments currently register as ₱0 on the health card (R2). Nothing
 * is ever skipped here; an unmappable category falls into `'other'` and is
 * still counted.
 */
export function bucketForVendor(
  // Minimal shape on purpose: BUD-3's checklist rows carry only these two
  // fields, and the whole point of that slice is that BOTH surfaces attribute
  // a vendor's money the same way. A wider parameter would have forced a
  // second mapping, which is the defect.
  v: Pick<VendorMoneyRow, 'covers_plan_groups' | 'category'>,
): string {
  const groups = Array.isArray(v.covers_plan_groups) ? v.covers_plan_groups : [];
  const primary = groups.find((g) => typeof g === 'string' && g.length > 0);
  if (primary) return primary;
  return BUCKET_BY_CATEGORY.get(v.category as VendorCategory) ?? OTHER_BUCKET;
}

const toCentavos = (v: number | string | null | undefined): number => {
  if (v === null || v === undefined) return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
};
const toPhp = (centavos: number): number => Math.round(centavos) / 100;

// ── The pure core ────────────────────────────────────────────────────────────

type WorkingLine = MoneyLine & {
  /** Integer centavos — the internal unit, so the invariant is exact. */
  amountC: number;
  paidC: number;
  owedC: number;
  /** Credit applied against this charge line (centavos, ≥ 0). */
  creditC: number;
};

type DueAcc = {
  overdueC: number;
  overdueCount: number;
  dueSoonC: number;
  dueSoonCount: number;
  upcomingC: number;
  upcomingCount: number;
  laterC: number;
  laterCount: number;
};

const emptyDueAcc = (): DueAcc => ({
  overdueC: 0,
  overdueCount: 0,
  dueSoonC: 0,
  dueSoonCount: 0,
  upcomingC: 0,
  upcomingCount: 0,
  laterC: 0,
  laterCount: 0,
});

const dueFromAcc = (a: DueAcc): MoneyDue => ({
  overduePhp: toPhp(a.overdueC),
  overdueCount: a.overdueCount,
  dueSoonPhp: toPhp(a.dueSoonC),
  dueSoonCount: a.dueSoonCount,
  upcomingPhp: toPhp(a.upcomingC),
  upcomingCount: a.upcomingCount,
  laterPhp: toPhp(a.laterC),
  laterCount: a.laterCount,
});

type BucketAcc = {
  committedC: number;
  paidC: number;
  owedC: number;
  overpaidC: number;
  estimatedC: number;
  due: DueAcc;
};

/**
 * Pure — no I/O. Every unit test and the parity harness drive THIS; the
 * exported `resolveEventMoney` is a thin fetch-then-delegate wrapper so the
 * arithmetic can be exercised without a database.
 */
export function computeEventMoney(inputs: MoneyInputs): EventMoney {
  const warnings: MoneyWarning[] = [];
  const lines: WorkingLine[] = [];

  let committedC = 0;
  let estimatedC = 0;
  let paidC = 0;
  let owedC = 0;
  let overpaidC = 0;

  const buckets = new Map<string, BucketAcc>();
  const bucket = (id: string): BucketAcc => {
    let b = buckets.get(id);
    if (!b) {
      b = {
        committedC: 0,
        paidC: 0,
        owedC: 0,
        overpaidC: 0,
        estimatedC: 0,
        due: emptyDueAcc(),
      };
      buckets.set(id, b);
    }
    return b;
  };

  const pushLine = (
    l: Omit<WorkingLine, 'amountPhp' | 'paidPhp' | 'stillOwedPhp' | 'daysUntilDue' | 'dueState'>,
  ) => {
    const line: WorkingLine = {
      ...l,
      amountPhp: toPhp(l.amountC),
      paidPhp: toPhp(l.paidC),
      stillOwedPhp: toPhp(l.owedC),
      // Placeholders. The real values are stamped in section 3b, AFTER the
      // per-vendor settlement below has decided what is still owed on each
      // line — a milestone whose date passed but whose money was handed over
      // is settled, not overdue.
      daysUntilDue: null,
      dueState: 'none',
    };
    lines.push(line);
    return line;
  };

  // ── 1 · Which vendor rows are allowed to spend the couple's money ────────
  const liveVendors: VendorMoneyRow[] = [];
  let archivedC = 0;
  let archivedCount = 0;
  let fraudC = 0;
  let fraudCount = 0;
  let coveredC = 0;
  let coveredCount = 0;

  for (const v of inputs.vendors) {
    const rowMoneyC =
      toCentavos(v.total_cost_php) +
      toCentavos(v.transport_php) +
      toCentavos(v.food_allowance_php);

    // R8 — archived (rejected) vendors still spend the couple's money on six
    // surfaces today. They stop here, and they are NAMED, not silently
    // dropped (§18.5 rule 8).
    if (v.archived_at) {
      archivedCount += 1;
      archivedC += rowMoneyC;
      continue;
    }
    if (v.voided_by_fraud) {
      fraudCount += 1;
      fraudC += rowMoneyC;
      continue;
    }
    // R3 — the package cascade writes one `anchor` row plus one `covered` row
    // per bundled service. Counting all of them bills the package N+1 times.
    // `package_role` has been written since 20271009160000 and read by NOTHING.
    if (v.package_role === 'covered') {
      coveredCount += 1;
      coveredC += rowMoneyC;
      continue;
    }
    liveVendors.push(v);
  }

  if (archivedCount > 0) {
    warnings.push({
      code: 'archived_excluded',
      message:
        `${archivedCount} removed vendor${archivedCount === 1 ? '' : 's'} ` +
        `no longer count${archivedCount === 1 ? 's' : ''} toward your budget.`,
      amountPhp: toPhp(archivedC),
    });
  }
  if (fraudCount > 0) {
    warnings.push({
      code: 'fraud_voided_excluded',
      message: `${fraudCount} booking${fraudCount === 1 ? '' : 's'} voided for fraud were excluded.`,
      amountPhp: toPhp(fraudC),
    });
  }
  if (coveredCount > 0) {
    warnings.push({
      code: 'package_covered_zeroed',
      message:
        `${coveredCount} service${coveredCount === 1 ? '' : 's'} are already inside a ` +
        `package you locked — they are counted once, in the package price.`,
      amountPhp: toPhp(coveredC),
    });
  }

  const liveVendorIds = new Set(liveVendors.map((v) => v.vendor_id));
  const lineItemsByVendor = new Map<string, LineItemMoneyRow[]>();
  for (const li of inputs.lineItems) {
    if (!liveVendorIds.has(li.vendor_id)) continue;
    const arr = lineItemsByVendor.get(li.vendor_id);
    if (arr) arr.push(li);
    else lineItemsByVendor.set(li.vendor_id, [li]);
  }
  const paymentsByVendor = new Map<string, PaymentMoneyRow[]>();
  for (const p of inputs.payments) {
    if (!liveVendorIds.has(p.vendor_id)) continue;
    const arr = paymentsByVendor.get(p.vendor_id);
    if (arr) arr.push(p);
    else paymentsByVendor.set(p.vendor_id, [p]);
  }

  // ── 2 · Setnayan-booked spend (R7's raw material) ────────────────────────
  // Today this lands in exactly ONE statistic on ONE page. Here it becomes
  // read-only LINE ROWS, so it is visible in every total, every bucket and
  // every export the moment BUD-2..BUD-8 wire their surface up.
  let vendorPayerC = 0;
  let vendorPayerCount = 0;
  for (const o of inputs.orders) {
    const amountC = toCentavos(o.confirmed_total_php ?? o.requested_total_php);
    if (amountC === 0) continue;
    // The vendor's booking fee is stamped with the couple's event_id but is
    // NOT the couple's money. See isVendorPayerOrder.
    if (isVendorPayerOrder(o)) {
      vendorPayerCount += 1;
      vendorPayerC += amountC;
      continue;
    }
    const label = o.description || o.service_key || 'Setnayan service';

    if (ORDER_COMMITTED_STATUSES.has(o.status)) {
      const isPaid = ORDER_PAID_STATUSES.has(o.status);
      pushLine({
        costKey: `order:${o.order_id}`,
        label,
        bucket: SETNAYAN_BUCKET,
        amountC,
        kind: 'committed',
        paidC: isPaid ? amountC : 0,
        owedC: isPaid ? 0 : amountC,
        creditC: 0,
        source: 'setnayan_order',
        sourceRef: o.order_id,
        vendorId: null,
        vendorName: null,
        readOnly: true,
        dueDate: null,
      });
      committedC += amountC;
      paidC += isPaid ? amountC : 0;
      owedC += isPaid ? 0 : amountC;
      const b = bucket(SETNAYAN_BUCKET);
      b.committedC += amountC;
      b.paidC += isPaid ? amountC : 0;
      b.owedC += isPaid ? 0 : amountC;
    } else if (ORDER_ESTIMATE_STATUSES.has(o.status)) {
      pushLine({
        costKey: `order:${o.order_id}`,
        label,
        bucket: SETNAYAN_BUCKET,
        amountC,
        kind: 'estimated',
        paidC: 0,
        owedC: 0,
        creditC: 0,
        source: 'setnayan_order',
        sourceRef: o.order_id,
        vendorId: null,
        vendorName: null,
        readOnly: true,
        dueDate: null,
      });
      estimatedC += amountC;
      bucket(SETNAYAN_BUCKET).estimatedC += amountC;
      warnings.push({
        code: 'order_not_yet_agreed',
        message: `"${label}" is applied for but not confirmed yet — shown as an estimate.`,
        amountPhp: toPhp(amountC),
        bucket: SETNAYAN_BUCKET,
      });
    }
    // draft / cancelled / refunded / lapsed → not money. Nothing is owed and
    // nothing was kept.
  }
  if (vendorPayerCount > 0) {
    warnings.push({
      code: 'vendor_payer_order_excluded',
      message:
        `${vendorPayerCount} vendor-billing charge${vendorPayerCount === 1 ? '' : 's'} on ` +
        `this event are the vendor's to pay, not yours — excluded.`,
      amountPhp: toPhp(vendorPayerC),
      bucket: SETNAYAN_BUCKET,
    });
  }

  // ── 3 · Vendor spend ─────────────────────────────────────────────────────
  for (const v of liveVendors) {
    const bucketId = bucketForVendor(v);
    const b = bucket(bucketId);
    const myLineItems = lineItemsByVendor.get(v.vendor_id) ?? [];
    const myPayments = paymentsByVendor.get(v.vendor_id) ?? [];
    const pricing = inputs.pricing.get(v.vendor_id);
    const priceSource: VendorPriceSource = pricing?.priceSource ?? 'manual';
    const controlled: VendorControlledLineItem[] = pricing?.items ?? [];
    const isCommitted = CONFIRMED.has(v.status as string);

    // Money actually handed over. `event_vendor_payments` is the itemized log;
    // `event_vendors.deposit_paid_php` is the legacy single-number field.
    //
    // ⚠ R6's proposed backfill (deposit_paid_php → payments) would DOUBLE-COUNT
    //   on live data: on prod event 947e7bab… all three deposits (₱67,500 /
    //   ₱24,000 / ₱20,000 = ₱111,500) already exist as payment rows of exactly
    //   the same amount on exactly the same vendors. So the itemized log WINS
    //   whenever it exists; the legacy field is a fallback, never additive.
    const paymentsC = myPayments.reduce((acc, p) => acc + toCentavos(p.amount_php), 0);
    const depositC = toCentavos(v.deposit_paid_php);
    const vendorPaidC = myPayments.length > 0 ? paymentsC : depositC;
    if (myPayments.length > 0 && depositC > paymentsC) {
      warnings.push({
        code: 'unreconciled_deposit',
        message:
          `${v.vendor_name}'s recorded deposit is larger than the payments logged ` +
          `against them — the payment log is what we count.`,
        amountPhp: toPhp(depositC - paymentsC),
        vendorId: v.vendor_id,
        vendorName: v.vendor_name,
        bucket: bucketId,
      });
    }

    // ── The price. Precedence is preserved from lib/budget.ts (~:636-645) —
    //    catalogue items win, manual line items add on top, the legacy
    //    headline is the fallback — with two corrections:
    //
    //    R4 · a locked PACKAGE bills the AGREED total (event_vendors
    //         .total_cost_php on the anchor row, or the booking's
    //         total_locked_centavos), never Σ replacement_value_centavos of
    //         its items — those are inclusions, and they bill optional /
    //         conditional items the couple never bought.
    //    R12 · the branch test is `!== 0`, not `> 0`. With `> 0` a credit-only
    //         manual line is silently discarded on a package vendor, and
    //         credits exceeding charges revert a vendor to their stale headline.
    const manualC = myLineItems.reduce((acc, li) => acc + toCentavos(li.amount_php), 0);
    const headlineC = toCentavos(v.total_cost_php);
    const controlledC = controlled.reduce((acc, it) => acc + toCentavos(it.amount_php), 0);
    const isPackageAnchor =
      v.package_role === 'anchor' ||
      (priceSource === 'package' && Boolean(v.event_vendor_package_id));

    let priceC = 0;
    let priceKind: MoneySource = 'vendor_headline';
    let priceLabel = v.vendor_name;
    let priceRef = v.vendor_id;
    let priceReadOnly = false;
    let useLineItems = false;

    if (isPackageAnchor) {
      const lockedC = inputs.packageLockedCentavos.get(v.event_vendor_package_id ?? '') ?? 0;
      priceC = headlineC !== 0 ? headlineC : lockedC;
      priceKind = 'vendor_package';
      priceLabel = `${v.vendor_name} — package`;
      priceReadOnly = true;
      if (priceC === 0) {
        warnings.push({
          code: 'package_total_missing',
          message: `${v.vendor_name}'s locked package has no agreed total recorded.`,
          vendorId: v.vendor_id,
          vendorName: v.vendor_name,
          bucket: bucketId,
        });
      }
      // Manual line items on a package vendor are genuine extras / change-order
      // credits and ride ON TOP of the agreed total. R12: `!== 0`.
      useLineItems = manualC !== 0;
    } else if (priceSource === 'service' && controlledC !== 0 && !isCommitted) {
      // §18.1: a marketplace service's published `starting_price_php` is an
      // ESTIMATE until the vendor is contracted.
      priceC = controlledC;
      priceKind = 'vendor_service_listing';
      priceLabel = `${v.vendor_name} — from their listed price`;
      priceRef = controlled[0]!.source_id;
      priceReadOnly = true;
    } else if (controlledC !== 0 && manualC !== 0) {
      priceC = controlledC;
      priceKind = priceSource === 'service' ? 'vendor_service_listing' : 'vendor_package';
      priceLabel = `${v.vendor_name} — from their catalogue`;
      priceRef = controlled[0]!.source_id;
      priceReadOnly = true;
      useLineItems = true;
    } else if (controlledC !== 0) {
      priceC = controlledC;
      priceKind = priceSource === 'service' ? 'vendor_service_listing' : 'vendor_package';
      priceLabel = `${v.vendor_name} — from their catalogue`;
      priceRef = controlled[0]!.source_id;
      priceReadOnly = true;
    } else if (manualC !== 0) {
      // R12 — `!== 0`, so a net credit is honoured instead of reverting to the
      // stale headline.
      useLineItems = true;
    } else {
      priceC = headlineC;
    }

    const kind: MoneyKind = isCommitted ? 'committed' : 'estimated';
    const vendorLines: WorkingLine[] = [];

    if (priceC !== 0) {
      vendorLines.push(
        pushLine({
          costKey: `vendor:${v.vendor_id}:price`,
          label: priceLabel,
          bucket: bucketId,
          amountC: priceC,
          kind,
          paidC: 0,
          owedC: 0,
          creditC: 0,
          source: priceKind,
          sourceRef: priceRef,
          vendorId: v.vendor_id,
          vendorName: v.vendor_name,
          readOnly: priceReadOnly,
          dueDate: null,
        }),
      );
    }
    if (useLineItems) {
      for (const li of myLineItems) {
        const c = toCentavos(li.amount_php);
        if (c === 0) continue;
        vendorLines.push(
          pushLine({
            costKey: `line:${li.line_item_id}`,
            label: li.label,
            bucket: bucketId,
            amountC: c,
            kind,
            paidC: 0,
            owedC: 0,
            creditC: 0,
            source: 'vendor_line_item',
            sourceRef: li.line_item_id,
            vendorId: v.vendor_id,
            vendorName: v.vendor_name,
            readOnly: false,
            dueDate: li.due_date,
          }),
        );
      }
    }

    // R5 — transport + crew meals. Merkado and the checklist count these;
    // `/budget` cannot see them at all (`lib/budget.ts:568` names only
    // total_cost_php). They are emitted as their OWN lines with their own
    // source, so §18.6 owner-decision #1 ("is Committed = package + transport
    // + crew meals?") can be answered by re-reading `sources[]` — nobody ever
    // needs to re-compute the total to change the answer.
    const transportC = toCentavos(v.transport_php);
    if (transportC !== 0) {
      vendorLines.push(
        pushLine({
          costKey: `vendor:${v.vendor_id}:transport`,
          label: `${v.vendor_name} — transportation`,
          bucket: bucketId,
          amountC: transportC,
          kind,
          paidC: 0,
          owedC: 0,
          creditC: 0,
          source: 'vendor_transport',
          sourceRef: v.vendor_id,
          vendorId: v.vendor_id,
          vendorName: v.vendor_name,
          readOnly: false,
          dueDate: null,
        }),
      );
    }
    // `crew_meal_covered = true` already NULLs the allowance at write time, so
    // no extra branch is needed here.
    const crewMealC = toCentavos(v.food_allowance_php);
    if (crewMealC !== 0) {
      vendorLines.push(
        pushLine({
          costKey: `vendor:${v.vendor_id}:crew_meal`,
          label: `${v.vendor_name} — crew meals`,
          bucket: bucketId,
          amountC: crewMealC,
          kind,
          paidC: 0,
          owedC: 0,
          creditC: 0,
          source: 'vendor_crew_meal',
          sourceRef: v.vendor_id,
          vendorId: v.vendor_id,
          vendorName: v.vendor_name,
          readOnly: false,
          dueDate: null,
        }),
      );
    }

    // ── Not booked yet → the money is an ESTIMATE (§18.5 rule 3) ───────────
    if (!isCommitted) {
      const estC = vendorLines.reduce((acc, l) => acc + l.amountC, 0);
      estimatedC += estC;
      b.estimatedC += estC;

      if (vendorPaidC > 0) {
        // Money handed to a vendor the couple hasn't marked as booked. The
        // PAID amount is real and must be counted; the rest of their quote
        // stays an estimate. Committing the whole quote here would tell the
        // couple they owe money nobody has agreed to.
        pushLine({
          costKey: `vendor:${v.vendor_id}:paid-unbooked`,
          label: `${v.vendor_name} — already paid`,
          bucket: bucketId,
          amountC: vendorPaidC,
          kind: 'committed',
          paidC: vendorPaidC,
          owedC: 0,
          creditC: 0,
          source: 'vendor_unbooked_payment',
          sourceRef: v.vendor_id,
          vendorId: v.vendor_id,
          vendorName: v.vendor_name,
          readOnly: true,
          dueDate: null,
        });
        committedC += vendorPaidC;
        paidC += vendorPaidC;
        b.committedC += vendorPaidC;
        b.paidC += vendorPaidC;
        warnings.push({
          code: 'payment_without_commitment',
          message:
            `You've paid ${v.vendor_name} but they aren't marked as booked yet — ` +
            `only the amount you paid is counted.`,
          amountPhp: toPhp(vendorPaidC),
          vendorId: v.vendor_id,
          vendorName: v.vendor_name,
          bucket: bucketId,
        });
      }
      continue;
    }

    // ── Booked → real money. Settle credits, then payments ────────────────
    const vendorCommittedC = vendorLines.reduce((acc, l) => acc + l.amountC, 0);

    if (vendorCommittedC === 0 && vendorPaidC === 0) {
      warnings.push({
        code: 'committed_without_price',
        message: `${v.vendor_name} is booked but has no price recorded yet.`,
        vendorId: v.vendor_id,
        vendorName: v.vendor_name,
        bucket: bucketId,
      });
    }
    if (vendorCommittedC < 0) {
      warnings.push({
        code: 'net_credit_vendor',
        message:
          `${v.vendor_name}'s credits are larger than their charges — ` +
          `they owe you the difference.`,
        amountPhp: toPhp(-vendorCommittedC),
        vendorId: v.vendor_id,
        vendorName: v.vendor_name,
        bucket: bucketId,
      });
    }

    // The HEADLINE settlement is per-vendor and NET, which is what makes the
    // invariant exact for every sign of every input:
    //     committed + overpaid === paid + stillOwed
    // (max(0, c−p) + c ≡ max(0, p−c) + p for all real c, p.)
    const vendorOwedC = Math.max(0, vendorCommittedC - vendorPaidC);
    const vendorOverpaidC = Math.max(0, vendorPaidC - vendorCommittedC);
    committedC += vendorCommittedC;
    paidC += vendorPaidC;
    owedC += vendorOwedC;
    overpaidC += vendorOverpaidC;
    b.committedC += vendorCommittedC;
    b.paidC += vendorPaidC;
    b.owedC += vendorOwedC;
    b.overpaidC += vendorOverpaidC;

    if (vendorOverpaidC > 0 && vendorCommittedC >= 0) {
      warnings.push({
        code: 'overpaid_vendor',
        message:
          `${v.vendor_name} has been paid more than their recorded total — ` +
          `check the amount or add the missing line.`,
        amountPhp: toPhp(vendorOverpaidC),
        vendorId: v.vendor_id,
        vendorName: v.vendor_name,
        bucket: bucketId,
      });
    }

    // ── Per-line decomposition (display only; the headline above is
    //    authoritative). Credits cancel charges first, then payments carrying
    //    a `line_item_id` retire that milestone, then anything unattributed
    //    (catalogue-item payments stash `vc:`/`pkg:` refs and land with
    //    line_item_id = NULL — R13) spills over the remaining charges in
    //    order. Honest per-line "still owed" without R13's schema fix, which
    //    is BUD-8's. ──────────────────────────────────────────────────────
    const charges = vendorLines.filter((l) => l.amountC > 0);
    let creditPool = vendorLines
      .filter((l) => l.amountC < 0)
      .reduce((acc, l) => acc - l.amountC, 0);
    for (const l of charges) {
      if (creditPool <= 0) break;
      const take = Math.min(l.amountC, creditPool);
      l.creditC += take;
      creditPool -= take;
    }

    const byLineItemId = new Map<string, WorkingLine>();
    for (const l of charges) {
      if (l.source === 'vendor_line_item') byLineItemId.set(l.sourceRef, l);
    }
    let pool = 0;
    for (const p of myPayments) {
      const c = toCentavos(p.amount_php);
      if (c === 0) continue;
      const target = p.line_item_id ? byLineItemId.get(p.line_item_id) : undefined;
      if (target) target.paidC += c;
      else pool += c;
    }
    // Only when the itemized log is empty does the legacy single-number field
    // stand in — never additive (see the double-count note above).
    if (myPayments.length === 0 && depositC > 0) pool += depositC;

    // A payment attributed to one line can itself exceed it; spill the excess.
    for (const l of charges) {
      const cap = Math.max(0, l.amountC - l.creditC);
      if (l.paidC > cap) {
        pool += l.paidC - cap;
        l.paidC = cap;
      }
    }
    for (const l of charges) {
      const room = l.amountC - l.creditC - l.paidC;
      if (room <= 0 || pool <= 0) continue;
      const take = Math.min(room, pool);
      l.paidC += take;
      pool -= take;
    }
    for (const l of vendorLines) {
      l.owedC = Math.max(0, l.amountC - l.creditC - l.paidC);
      l.paidPhp = toPhp(l.paidC);
      l.stillOwedPhp = toPhp(l.owedC);
    }
  }

  // ── 3b · The dated ledger — what is late, and what is about to be ────────
  //
  // Runs AFTER every vendor's settlement above, because "overdue" is a claim
  // about money STILL OWED, not about a date. A milestone that came and went
  // and was paid is `settled`; only a date that passed with money outstanding
  // is `overdue`.
  //
  // The bands come from `paymentDueState` in lib/setnayan-ai-triggers.ts —
  // the same function GRD-01 filters on. That is the whole point: the number
  // this page prints and the number that email names are computed by one
  // definition, so they cannot drift.
  const now = inputs.now ?? new Date();
  const dueTotal = emptyDueAcc();
  let overdueLines = 0;
  for (const l of lines) {
    // An estimate has no milestone to miss — nobody has agreed to pay it, so
    // it can never be late (§18.5 rule 3, applied to dates instead of pesos).
    if (l.kind === 'estimated' || !l.dueDate) continue;
    const d = daysUntilDue(l.dueDate, now);
    l.daysUntilDue = Number.isFinite(d) ? d : null;
    if (l.owedC <= 0) {
      l.dueState = 'settled';
      continue;
    }
    if (!Number.isFinite(d)) continue; // unparseable date → 'none', never late
    const state = paymentDueState(d);
    l.dueState = state;
    const b = bucket(l.bucket).due;
    switch (state) {
      case 'overdue':
        dueTotal.overdueC += l.owedC;
        dueTotal.overdueCount += 1;
        b.overdueC += l.owedC;
        b.overdueCount += 1;
        overdueLines += 1;
        break;
      case 'due_soon':
        dueTotal.dueSoonC += l.owedC;
        dueTotal.dueSoonCount += 1;
        b.dueSoonC += l.owedC;
        b.dueSoonCount += 1;
        break;
      case 'upcoming':
        dueTotal.upcomingC += l.owedC;
        dueTotal.upcomingCount += 1;
        b.upcomingC += l.owedC;
        b.upcomingCount += 1;
        break;
      case 'later':
        dueTotal.laterC += l.owedC;
        dueTotal.laterCount += 1;
        b.laterC += l.owedC;
        b.laterCount += 1;
        break;
    }
  }
  if (overdueLines > 0) {
    // NAMED, not merely counted — a bare figure is one a caller can forget to
    // read, which is the same silence this file exists to end.
    //
    // ⚠ BE HONEST ABOUT WHAT THIS REACHES TODAY. Measured 2026-09-02 against
    // origin/main: `EventMoney.warnings` has NO renderer on any surface —
    // `grep -rn '\.warnings' app lib` finds one hit and it belongs to the
    // vendor canvas, not to this type. So this sentence is not yet in front of
    // a couple; the thing that actually reaches a human today is GRD-01, which
    // now fires on overdue. The warning is emitted so the surface that wires
    // `due` up gets the wording with it, rather than re-inventing it.
    warnings.push({
      code: 'payment_overdue',
      message:
        `${overdueLines} payment${overdueLines === 1 ? '' : 's'} ` +
        `${overdueLines === 1 ? 'is' : 'are'} past ${overdueLines === 1 ? 'its' : 'their'} ` +
        `due date and still showing as unpaid.`,
      amountPhp: toPhp(dueTotal.overdueC),
    });
  }

  // ── 4 · Buckets ──────────────────────────────────────────────────────────
  const benchmarkByGroup = new Map<string, number | null>();
  for (const bm of inputs.benchmarks) benchmarkByGroup.set(bm.plan_group_id, bm.benchmark_php);

  const byBucket: MoneyBucket[] = Array.from(buckets.entries())
    .map(([id, x]) => {
      const bm = benchmarkByGroup.get(id);
      return {
        bucketId: id,
        label: bucketLabel(id),
        committedPhp: toPhp(x.committedC),
        paidPhp: toPhp(x.paidC),
        stillOwedPhp: toPhp(x.owedC),
        overpaidPhp: toPhp(x.overpaidC),
        estimatedPhp: toPhp(x.estimatedC),
        // §18.5 rule 5 — a leaf with a NULL benchmark is UNKNOWN, not ₱0.
        hasBenchmark: bm !== null && bm !== undefined,
        benchmarkPhp: bm ?? null,
        due: dueFromAcc(x.due),
      };
    })
    .sort((a, b2) => {
      const diff = b2.committedPhp + b2.estimatedPhp - (a.committedPhp + a.estimatedPhp);
      return diff !== 0 ? diff : a.label.localeCompare(b2.label);
    });

  // Name the unseeded leaves. 12 of 26 benchmark leaves are NULL — including
  // Ceremony Venue, a Tier-2 category — and they currently contribute ₱0 to
  // the buffer, silently. A caller can now print "no typical price yet".
  const scope = new Set<string>([...(inputs.scopePlanGroupIds ?? []), ...buckets.keys()]);
  const unseeded: string[] = [];
  for (const id of scope) {
    if (id === SETNAYAN_BUCKET || id === OTHER_BUCKET) continue;
    const bm = benchmarkByGroup.get(id);
    if (bm === null || bm === undefined) unseeded.push(id);
  }
  unseeded.sort();
  if (unseeded.length > 0) {
    warnings.push({
      code: 'benchmark_unseeded',
      message:
        `No typical price is published yet for ${unseeded.length} ` +
        `categor${unseeded.length === 1 ? 'y' : 'ies'} — ` +
        `${unseeded.length === 1 ? 'it shows' : 'they show'} as unknown, not ₱0.`,
      bucketIds: unseeded,
    });
  }

  // ── 5 · Provenance ───────────────────────────────────────────────────────
  const sourceAcc = new Map<string, MoneySourceNote>();
  for (const l of lines) {
    const meta = SOURCE_META[l.source];
    const key = `${l.source}:${l.kind}`;
    let note = sourceAcc.get(key);
    if (!note) {
      note = {
        source: l.source,
        label: meta.label,
        table: meta.table,
        kind: l.kind,
        amountPhp: 0,
        rowCount: 0,
        // An estimated line is ALWAYS an estimate regardless of its table —
        // that is the whole point of §18.5 rule 2.
        isEstimate: meta.isEstimate || l.kind === 'estimated',
      };
      sourceAcc.set(key, note);
    }
    note.amountPhp += l.amountPhp;
    note.rowCount += 1;
  }
  const sources = Array.from(sourceAcc.values())
    .map((s) => ({ ...s, amountPhp: Math.round(s.amountPhp * 100) / 100 }))
    .sort((a, b2) => b2.amountPhp - a.amountPhp);

  const targetPhp = inputs.targetCentavos !== null ? inputs.targetCentavos / 100 : null;
  const committed = toPhp(committedC);
  const overBudgetBy = targetPhp !== null ? committed - targetPhp : 0;

  const money: EventMoney = {
    targetPhp,
    estimated: toPhp(estimatedC),
    committed,
    paid: toPhp(paidC),
    stillOwed: toPhp(owedC),
    overpaid: toPhp(overpaidC),
    // §18.5 rule 4 — the ONE meaning, said in exactly one place.
    isOverBudget: targetPhp !== null && overBudgetBy > 0,
    overBudgetByPhp: Math.max(0, Math.round(overBudgetBy * 100) / 100),
    due: dueFromAcc(dueTotal),
    byBucket,
    lines: lines.map(stripWorking),
    sources,
    warnings,
  };

  const violation = checkMoneyInvariant(money);
  if (violation) money.warnings.push({ code: 'invariant_violation', message: violation });
  return money;
}

const SOURCE_META: Record<
  MoneySource,
  { label: string; table: string; isEstimate: boolean }
> = {
  setnayan_order: {
    label: 'Booked with Setnayan',
    table: 'orders',
    isEstimate: false,
  },
  vendor_package: {
    label: 'Package price you locked',
    table: 'event_vendors.total_cost_php (package anchor)',
    isEstimate: false,
  },
  vendor_service_listing: {
    label: "Vendor's listed starting price",
    table: 'vendor_services.starting_price_php',
    isEstimate: true,
  },
  vendor_line_item: {
    label: 'Your itemized costs',
    table: 'event_vendor_line_items',
    isEstimate: false,
  },
  vendor_headline: {
    label: 'Vendor totals you recorded',
    table: 'event_vendors.total_cost_php',
    isEstimate: false,
  },
  vendor_transport: {
    label: 'Transportation',
    table: 'event_vendors.transport_php',
    isEstimate: false,
  },
  vendor_crew_meal: {
    label: 'Crew meals',
    table: 'event_vendors.food_allowance_php',
    isEstimate: false,
  },
  vendor_unbooked_payment: {
    label: 'Paid to vendors not yet booked',
    table: 'event_vendor_payments',
    isEstimate: false,
  },
};

function stripWorking(l: WorkingLine): MoneyLine {
  const { amountC: _a, paidC: _p, owedC: _o, creditC: _c, ...rest } = l;
  void _a;
  void _p;
  void _o;
  void _c;
  return rest;
}

/**
 * THE INVARIANT — `committed + overpaid === paid + stillOwed`.
 *
 * Returns null when the totals reconcile, or a human-readable description of
 * the discrepancy. Never throws: a render must not die because the arithmetic
 * drifted — it must SAY so (that is exactly the defect this file exists to
 * kill). Callers get it as an `invariant_violation` warning; the unit suite
 * asserts it on every fixture and a mutation test proves the assertion bites.
 *
 * ⚠ §18.5 rule 6 writes this as "Committed = Paid + Still owed + Overpaid".
 *   That form is mis-signed — see the file header.
 */
export function checkMoneyInvariant(money: EventMoney): string | null {
  const lhs = Math.round((money.committed + money.overpaid) * 100);
  const rhs = Math.round((money.paid + money.stillOwed) * 100);
  if (lhs === rhs) return null;
  return (
    `Budget totals do not reconcile: committed ₱${money.committed} + overpaid ` +
    `₱${money.overpaid} ≠ paid ₱${money.paid} + still owed ₱${money.stillOwed} ` +
    `(off by ₱${Math.abs(lhs - rhs) / 100}).`
  );
}

// ── The I/O wrapper ──────────────────────────────────────────────────────────

const VENDOR_SELECT =
  'vendor_id,public_id,event_id,category,vendor_name,contact_email,contact_phone,status,' +
  'total_cost_php,transport_php,food_allowance_php,deposit_paid_php,covers_plan_groups,' +
  'archived_at,voided_by_fraud,package_role,notes,created_at,marketplace_vendor_id,' +
  'event_vendor_package_id';

/** PostgREST's "relation does not exist" — graceful-degrade, same as lib/budget.ts. */
function isMissingRelation(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42P01';
}
/** PostgREST's "column does not exist" — a migration hasn't landed in this env. */
function isMissingColumn(error: { code?: string } | null | undefined): boolean {
  return error?.code === '42703';
}

/**
 * THE resolver. Every surface that prints a peso asks this and nothing else.
 *
 * Read-only: it issues SELECTs and returns arithmetic. It writes nothing,
 * caches nothing, and never throws on a missing table or column — a budget
 * page that renders a warning is strictly better than one that 500s.
 */
export async function resolveEventMoney(
  supabase: SupabaseClient,
  eventId: string,
): Promise<EventMoney> {
  const [eventRes, vendorsRes, lineItemsRes, paymentsRes, ordersRes, benchmarksRes] =
    await Promise.all([
      // SEC-2b: events_host, not events — estimated_budget_centavos is
      // SELECT-denied to `authenticated` on the base table by 20271008731642.
      supabase
        .from('events_host')
        .select('event_id, estimated_budget_centavos')
        .eq('event_id', eventId)
        .maybeSingle(),
      supabase
        .from('event_vendors')
        .select(VENDOR_SELECT)
        .eq('event_id', eventId)
        .order('created_at', { ascending: true }),
      supabase
        .from('event_vendor_line_items')
        .select('line_item_id,vendor_id,label,amount_php,due_date')
        .eq('event_id', eventId)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true }),
      supabase
        .from('event_vendor_payments')
        .select('payment_id,vendor_id,line_item_id,amount_php,paid_at')
        .eq('event_id', eventId)
        .order('paid_at', { ascending: false }),
      // R7 — the "booked with us" half. Today this reaches exactly one stat on
      // one page; here it becomes ledger rows.
      supabase
        .from('orders')
        .select(
          'order_id,description,service_key,requested_total_php,confirmed_total_php,status,vendor_profile_id',
        )
        .eq('event_id', eventId),
      supabase
        .from('budget_leaf_benchmarks')
        .select('plan_group_id, benchmark_php')
        .eq('is_active', true),
    ]);

  // Migration-drift fallback: the vendor SELECT names columns added late
  // (voided_by_fraud, package_role). On an un-migrated env PostgREST 42703s
  // the WHOLE query, which would zero the budget rather than degrade it.
  let vendorRows = (vendorsRes.data ?? []) as unknown as VendorMoneyRow[];
  if (vendorsRes.error && isMissingColumn(vendorsRes.error)) {
    const retry = await supabase
      .from('event_vendors')
      .select('*')
      .eq('event_id', eventId)
      .order('created_at', { ascending: true });
    vendorRows = (retry.data ?? []) as unknown as VendorMoneyRow[];
  }

  const lineItems = (lineItemsRes.data ?? []) as unknown as LineItemMoneyRow[];
  const payments = (paymentsRes.data ?? []) as unknown as PaymentMoneyRow[];
  const orders =
    ordersRes.error && isMissingRelation(ordersRes.error)
      ? []
      : ((ordersRes.data ?? []) as unknown as OrderMoneyRow[]);
  const benchmarks =
    benchmarksRes.error && isMissingRelation(benchmarksRes.error)
      ? []
      : ((benchmarksRes.data ?? []) as unknown as BenchmarkMoneyRow[]);

  // The vendor-authored catalogue half — reuse the shipped resolver rather
  // than re-deriving package / service pricing (Rule 0: extend, never re-draw).
  const pricing = await buildVendorPricingLookup(
    supabase,
    eventId,
    vendorRows as unknown as EventVendorRow[],
  ).catch(() => new Map() as VendorPricingLookup);

  // R4's fallback — the agreed total locked at booking time, for an anchor row
  // whose total_cost_php was never written.
  const bookingIds = Array.from(
    new Set(
      vendorRows
        .map((v) => v.event_vendor_package_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0),
    ),
  );
  const packageLockedCentavos = new Map<string, number>();
  if (bookingIds.length > 0) {
    const res = await supabase
      .from('event_vendor_packages')
      .select('booking_id, total_locked_centavos, status')
      .in('booking_id', bookingIds);
    for (const row of (res.data ?? []) as Array<{
      booking_id: string;
      total_locked_centavos: number | string | null;
      status: string;
    }>) {
      if (row.status !== 'locked') continue;
      packageLockedCentavos.set(row.booking_id, Number(row.total_locked_centavos ?? 0));
    }
  }

  const targetCentavos =
    (eventRes.data as { estimated_budget_centavos?: number | null } | null)
      ?.estimated_budget_centavos ?? null;

  return computeEventMoney({
    targetCentavos: targetCentavos === null ? null : Number(targetCentavos),
    vendors: vendorRows,
    lineItems,
    payments,
    orders,
    pricing,
    packageLockedCentavos,
    benchmarks,
    // The clock enters here and nowhere else — the core stays deterministic.
    now: new Date(),
  });
}
