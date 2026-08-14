/**
 * budget-parity — the BUD-1 parity harness.
 *
 *   pnpm --filter @setnayan/web exec tsx scripts/budget-parity.ts
 *   pnpm --filter @setnayan/web exec tsx scripts/budget-parity.ts --json path/to/capture.json
 *
 * WHY THIS EXISTS
 * ───────────────
 * Seven surfaces compute "the budget" with five incompatible formulas. BUD-2
 * through BUD-8 move them, one at a time, onto `resolveEventMoney`. This
 * harness is how each of those PRs proves it changed the number TO THE RIGHT
 * ONE rather than merely changing it: run it before and after, and the row for
 * the surface you touched must move from a non-zero delta to zero (or to a
 * delta you can name out loud).
 *
 * It prints, per event, what each surface prints TODAY beside what the
 * resolver says, and the difference:
 *
 *   · `/budget` strip · "Committed"       page.tsx:165-181
 *   · `/budget` live card · "Total to pay" lib/budget.ts:676-682 (totals.budget)
 *   · Checklist health · "committed"      lib/checklist-budget.ts:186-206
 *   · Allocation planner · cushion        lib/budget-allocation.ts:268 + -data.ts:325-327
 *   · Merkado "Your team" · Chosen/Range  lib/vendors-plan-budget.ts:866-895
 *
 * Each `legacy*` function below is a VERBATIM transcription of the shipped
 * arithmetic at the cited line — deliberately not a refactor, and deliberately
 * not importing the real modules (several are `server-only` and pull a
 * Supabase client). If a shipped formula changes, the transcription must be
 * updated with it or this harness stops being evidence.
 *
 * DATA
 * ────
 * Default input is `scripts/fixtures/budget-parity-prod.json` — a read-only
 * capture of the two prod events that carry money (2026-07-27), with business
 * names redacted and every amount, status and relationship verbatim. Pass
 * `--json <file>` to run against a fresh capture in the same shape; the SQL
 * that produces it is documented at the bottom of this file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  computeEventMoney,
  checkMoneyInvariant,
  type LineItemMoneyRow,
  type OrderMoneyRow,
  type PaymentMoneyRow,
  type VendorMoneyRow,
} from '../lib/budget-truth';
import type { VendorPricingLookup } from '../lib/budget';

type Capture = {
  capturedFrom: string;
  redaction?: string;
  benchmarksNote?: string;
  /** `budget_leaf_benchmarks` WHERE is_active — drives the unknown-vs-₱0 rule. */
  benchmarks?: Array<{ plan_group_id: string; benchmark_php: number | null }>;
  events: Array<{
    slug: string;
    note?: string;
    targetCentavos: number | null;
    vendors: VendorMoneyRow[];
    lineItems: LineItemMoneyRow[];
    payments: PaymentMoneyRow[];
    orders: OrderMoneyRow[];
  }>;
};

const CONFIRMED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);
const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

// ── Legacy formula #1 ────────────────────────────────────────────────────────
// app/dashboard/[eventId]/budget/page.tsx:165-181 — the strip's "Committed".
// Σ paid|fulfilled orders + Σ total_cost_php of vendors at contracted+.
// Blind to: line items, transport, crew meals, archived_at, package_role.
function legacyStripCommitted(e: Capture['events'][number]): number {
  const orders = e.orders
    .filter((o) => o.status === 'paid' || o.status === 'fulfilled')
    .reduce((acc, o) => acc + num(o.confirmed_total_php ?? o.requested_total_php), 0);
  const vendors = e.vendors.reduce((acc, v) => {
    if (!CONFIRMED.has(v.status as string)) return acc;
    return acc + num(v.total_cost_php);
  }, 0);
  return orders + vendors;
}

// ── Legacy formula #2 ────────────────────────────────────────────────────────
// lib/budget.ts:625-682 — snapshot.totals, which feeds the live card's
// "Total to pay" AND (byte-identically) the Merkado Budget lens.
//
// ⚠ BUD-8 (2026-08-14): the Merkado lens is now WIRED to the resolver behind
// `NEXT_PUBLIC_BUDGET_TRUTH_ENABLED`, exactly as `/budget` has been since BUD-2.
// This transcription is still what BOTH surfaces print in production, because
// that flag is OFF — so their rows below measure the gap that CLOSES the moment
// it is switched on, not an outstanding defect. Deliberately not "fixed" to
// print `ok`: this harness is evidence only while it transcribes the legacy
// arithmetic verbatim, and editing the measuring stick to agree with the code
// would destroy the only reason to run it.
// Runs over EVERY vendor regardless of status; note the `> 0` branch tests
// (R12) and the per-vendor `Math.max(0, …)` clamp with unclamped sums (R11).
function legacyLiveCard(e: Capture['events'][number]): {
  budget: number;
  paid: number;
  remaining: number;
} {
  let budget = 0;
  let paid = 0;
  let remaining = 0;
  for (const v of e.vendors) {
    const myLineItems = e.lineItems.filter((li) => li.vendor_id === v.vendor_id);
    const myPayments = e.payments.filter((p) => p.vendor_id === v.vendor_id);
    // The fixtures carry no vendor_packages / vendor_services rows, so
    // vendorControlledTotal is 0 — same as prod today (0 package bookings).
    const vendorControlledTotal = 0;
    const manualItemized = myLineItems.reduce((acc, li) => acc + num(li.amount_php), 0);
    const headline = num(v.total_cost_php);
    let itemizedTotal: number;
    if (vendorControlledTotal > 0 && manualItemized > 0) {
      itemizedTotal = vendorControlledTotal + manualItemized;
    } else if (vendorControlledTotal > 0) {
      itemizedTotal = vendorControlledTotal;
    } else if (manualItemized > 0) {
      itemizedTotal = manualItemized;
    } else {
      itemizedTotal = headline;
    }
    const paidTotal = myPayments.reduce((acc, p) => acc + num(p.amount_php), 0);
    budget += itemizedTotal;
    paid += paidTotal;
    remaining += Math.max(0, itemizedTotal - paidTotal);
  }
  return { budget, paid, remaining };
}

// ── Legacy formula #3 ────────────────────────────────────────────────────────
// lib/checklist-budget.ts:186-206 — the checklist health card's "committed".
// `if (groups.length === 0) continue;` drops every commitment whose
// covers_plan_groups is empty — R2, the ₱810,000 defect.
function legacyChecklistCommittedPhp(e: Capture['events'][number]): number {
  let centavos = 0;
  for (const v of e.vendors) {
    if (!CONFIRMED.has(v.status as string)) continue;
    const groups = Array.isArray(v.covers_plan_groups) ? v.covers_plan_groups : [];
    if (groups.length === 0) continue; // ← the skip
    const totalPhp =
      num(v.total_cost_php) + num(v.transport_php) + num(v.food_allowance_php);
    centavos += Math.round(totalPhp * 100);
  }
  return centavos / 100;
}

// ── Legacy formula #4 ────────────────────────────────────────────────────────
// lib/budget-allocation-data.ts:325-327 hardcodes `fixedPhp: null` and
// `pinnedAmountPhp: null`, so the planner's cushion (budget-allocation.ts:268)
// is computed as if the couple had booked NOTHING. The committed money it
// cannot see is exactly the resolver's `committed`.
function legacyPlannerSeesCommittedPhp(): number {
  return 0;
}

// ── Legacy formula #5 ────────────────────────────────────────────────────────
// lib/vendors-plan-budget.ts:866-895 — the "Your team" tiles.
// Chosen = Σ locked picks' rolled cost. Range = cheapest→priciest across the
// shortlist, sub-bucketed by canonical service. `budgetStatus` keys off
// rangeHi, the PRICIEST shortlist end — which is why it can read red purely
// because an expensive option was shortlisted.
function legacyAccordion(e: Capture['events'][number]): {
  chosenPhp: number;
  rangeLoPhp: number;
  rangeHiPhp: number;
} {
  const rolled = (v: VendorMoneyRow): number =>
    num(v.total_cost_php) + num(v.transport_php) + num(v.food_allowance_php);
  let chosen = 0;
  for (const v of e.vendors) {
    if (CONFIRMED.has(v.status as string)) chosen += rolled(v);
  }
  // Per-canonical-service span: locked → fixed point, otherwise min..max.
  const byService = new Map<string, VendorMoneyRow[]>();
  for (const v of e.vendors) {
    if (rolled(v) <= 0) continue;
    const arr = byService.get(v.category as string);
    if (arr) arr.push(v);
    else byService.set(v.category as string, [v]);
  }
  let lo = 0;
  let hi = 0;
  for (const group of byService.values()) {
    const locked = group.filter((v) => CONFIRMED.has(v.status as string)).map(rolled);
    if (locked.length > 0) {
      const fixed = locked.reduce((s, c) => s + c, 0);
      lo += fixed;
      hi += fixed;
    } else {
      const costs = group.map(rolled);
      lo += Math.min(...costs);
      hi += Math.max(...costs);
    }
  }
  return { chosenPhp: chosen, rangeLoPhp: lo, rangeHiPhp: hi };
}

// ── Reporting ────────────────────────────────────────────────────────────────

const php = (n: number): string =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const pad = (s: string, w: number): string => (s.length >= w ? s : s + ' '.repeat(w - s.length));
const padL = (s: string, w: number): string => (s.length >= w ? s : ' '.repeat(w - s.length) + s);

function row(surface: string, shows: string, today: number, resolver: number): string {
  const delta = today - resolver;
  const mark = delta === 0 ? '  ok  ' : delta > 0 ? ' OVER ' : ' UNDER';
  return (
    `  ${pad(surface, 34)}${pad(shows, 18)}` +
    `${padL(php(today), 14)}${padL(php(resolver), 14)}${padL(php(delta), 14)} ${mark}`
  );
}

function main(): void {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const jsonFlag = process.argv.indexOf('--json');
  const file =
    jsonFlag >= 0 && process.argv[jsonFlag + 1]
      ? path.resolve(process.argv[jsonFlag + 1]!)
      : path.join(here, 'fixtures', 'budget-parity-prod.json');

  const capture = JSON.parse(fs.readFileSync(file, 'utf8')) as Capture;

  console.log('');
  console.log('BUD-1 · budget parity harness');
  console.log(`source: ${capture.capturedFrom}`);
  if (capture.redaction) console.log(`        ${capture.redaction}`);
  console.log('');

  let anyDelta = false;
  let anyViolation = false;

  for (const e of capture.events) {
    const money = computeEventMoney({
      targetCentavos: e.targetCentavos,
      vendors: e.vendors,
      lineItems: e.lineItems,
      payments: e.payments,
      orders: e.orders,
      pricing: new Map() as VendorPricingLookup,
      packageLockedCentavos: new Map(),
      benchmarks: capture.benchmarks ?? [],
    });

    console.log(`━━ event ${e.slug} ${'━'.repeat(Math.max(0, 62 - e.slug.length))}`);
    if (e.note) console.log(`   ${e.note}`);
    console.log('');
    console.log(
      `  ${pad('SURFACE', 34)}${pad('WHAT IT PRINTS', 18)}` +
        `${padL('TODAY', 14)}${padL('RESOLVER', 14)}${padL('DELTA', 14)}`,
    );

    const strip = legacyStripCommitted(e);
    const card = legacyLiveCard(e);
    const checklist = legacyChecklistCommittedPhp(e);
    const planner = legacyPlannerSeesCommittedPhp();
    const acc = legacyAccordion(e);

    const rows = [
      row('/budget strip', 'Committed', strip, money.committed),
      row('/budget live card', 'Total to pay', card.budget, money.committed),
      row('/budget live card', 'Paid', card.paid, money.paid),
      row('/budget live card', 'Remaining', card.remaining, money.stillOwed),
      row('Merkado Budget lens', 'To go', card.remaining, money.stillOwed),
      row('Checklist health', 'Committed', checklist, money.committed),
      row('Allocation planner', 'Sees committed', planner, money.committed),
      row('Your team · Chosen', 'Chosen', acc.chosenPhp, money.committed),
      row('Your team · Range high', 'Range hi', acc.rangeHiPhp, money.committed + money.estimated),
    ];
    for (const r of rows) {
      console.log(r);
      if (!r.endsWith('ok  ')) anyDelta = true;
    }

    console.log('');
    console.log(
      `  resolver · target ${money.targetPhp === null ? '—' : php(money.targetPhp)} · ` +
        `committed ${php(money.committed)} · paid ${php(money.paid)} · ` +
        `still owed ${php(money.stillOwed)} · overpaid ${php(money.overpaid)} · ` +
        `estimated ${php(money.estimated)}`,
    );
    console.log(
      `  over budget: ${money.isOverBudget ? `YES by ${php(money.overBudgetByPhp)}` : 'no'}` +
        ` · lines ${money.lines.length} · buckets ${money.byBucket.length}`,
    );

    const violation = checkMoneyInvariant(money);
    if (violation) {
      anyViolation = true;
      console.log(`  ✗ INVARIANT: ${violation}`);
    } else {
      console.log(
        `  ✓ invariant: committed ${php(money.committed)} + overpaid ${php(money.overpaid)}` +
          ` = paid ${php(money.paid)} + still owed ${php(money.stillOwed)}`,
      );
    }

    if (money.sources.length > 0) {
      console.log('');
      console.log('  provenance:');
      for (const s of money.sources) {
        console.log(
          `    ${pad(s.label, 34)}${pad(s.kind, 11)}${padL(php(s.amountPhp), 14)}  ` +
            `${s.rowCount} row${s.rowCount === 1 ? '' : 's'} · ${s.table}` +
            `${s.isEstimate ? '  [ESTIMATE — must be marked]' : ''}`,
        );
      }
    }
    if (money.warnings.length > 0) {
      console.log('');
      console.log('  warnings:');
      for (const w of money.warnings) {
        console.log(
          `    ${pad(w.code, 28)}${w.message}` +
            (w.amountPhp !== undefined ? ` (${php(w.amountPhp)})` : ''),
        );
      }
    }
    console.log('');
  }

  console.log(
    anyViolation
      ? '✗ at least one event failed the invariant — do NOT ship.'
      : '✓ every event satisfies committed + overpaid = paid + still owed.',
  );
  if (anyDelta) {
    console.log(
      'ℹ non-zero deltas above are what each surface prints TODAY (flag OFF) ' +
        'beside what the resolver says.\n' +
        '  WIRED to the resolver already: /budget strip · /budget live card ' +
        '(BUD-2) · Checklist health (BUD-3) · Merkado Budget lens (BUD-8).\n' +
        '  For those, the delta is the jump that happens when ' +
        'NEXT_PUBLIC_BUDGET_TRUTH_ENABLED is switched on — NOT an unfixed surface.\n' +
        '  Still on their own arithmetic: Allocation planner · Your team.',
    );
  }
  console.log('');
  if (anyViolation) process.exitCode = 1;
}

main();

/*
 * ── Re-capturing from prod ───────────────────────────────────────────────────
 * Read-only. Redact names; keep every amount, status and relationship.
 *
 *   select v.vendor_id, v.event_id, v.category, v.status, v.total_cost_php,
 *          v.transport_php, v.food_allowance_php, v.deposit_paid_php,
 *          v.covers_plan_groups, v.archived_at, v.voided_by_fraud,
 *          v.package_role, v.event_vendor_package_id, v.marketplace_vendor_id
 *     from event_vendors v where v.event_id = :event_id;
 *
 *   select line_item_id, vendor_id, label, amount_php, due_date
 *     from event_vendor_line_items where event_id = :event_id;
 *
 *   select payment_id, vendor_id, line_item_id, amount_php, paid_at
 *     from event_vendor_payments where event_id = :event_id;
 *
 *   select order_id, description, service_key, requested_total_php,
 *          confirmed_total_php, status
 *     from orders where event_id = :event_id;
 *
 *   select estimated_budget_centavos from events where event_id = :event_id;
 */
