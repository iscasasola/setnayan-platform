/**
 * one-set-of-books.test.ts — BA8's fence.
 *
 * `SETNAYAN_AI` sells, verbatim on its buy page: *"Warns you before you go
 * over budget"* — *"It adds up what you've committed against your target while
 * there's still room to trim."* That sentence is GRD-05 (`overBudgetTrigger`),
 * and until BA8 the guard the couple PAID ₱1,499 for added the money up
 * ITSELF: paid/fulfilled `orders` plus `contracted`-or-better
 * `event_vendors.total_cost_php`. `/budget` has asked `resolveEventMoney`
 * since BUD-2.
 *
 * Two additions over one fact. So a couple could be warned by one number and
 * reassured by another on the next screen — and the number they paid for was
 * the narrower one: it could not see a locked package's agreed total (R4), a
 * vendor's catalogue line items, a manual line on an off-platform supplier, a
 * change-order credit, transport, crew meals (R5), a supplier-less
 * `event_costs` row (BA7), or a payment logged against a vendor nothing was
 * agreed with.
 *
 * ─── WHY A GUARD AND NOT JUST THE UNIT TESTS ──────────────────────────────
 * The old formula was not a bug anyone typed. It was the Overview's formula,
 * copied — the reasonable thing to do when you need a committed total and one
 * is already lying around three files away. It will be reasonable again. The
 * only thing that makes it stop is a test that fails the moment the two
 * numbers can differ, so it is asserted four ways, each facing a different way
 * of undoing it:
 *
 *   1 · ARITHMETIC — over row fixtures carrying money through EVERY source the
 *       resolver knows, the guard's committed total equals the one
 *       `/budget`'s strip prints. Driven through `computeEventMoney`, not a
 *       hand-written `EventMoney`, so a change to the resolver moves both
 *       sides together or fails here.
 *   2 · FIRE STATE — GRD-05 fires exactly when `EventMoney.isOverBudget`, and
 *       the peso figure in its copy is `overBudgetByPhp`. Equal totals with
 *       different thresholds would still tell the couple two stories.
 *   3 · SHAPE — `SnapshotBudget` carries no field that is not the resolver's,
 *       so there is nowhere for a second number (a `pendingPhp`, an estimate)
 *       to be smuggled back in.
 *   4 · SOURCE — BOTH surfaces that run this trigger build `budget:` through
 *       `budgetFromEventMoney` and nothing else. Properties 1-3 are blind to a
 *       caller that stops asking.
 *
 * ⚠ WHAT THIS DOES NOT SAY. It does not say GRD-05 should reach email. GRD-01
 * is the one guard on the notification email allowlist; GRD-05 stays in-app
 * (`ai_guard_alert`). That is a §4.1 restraint decision, not this file's.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import {
  computeEventMoney,
  type EventCostMoneyRow,
  type EventMoney,
  type LineItemMoneyRow,
  type OrderMoneyRow,
  type PaymentMoneyRow,
  type VendorMoneyRow,
} from './budget-truth';
import type { VendorPricingLookup } from './budget';
import { budgetStripMoney } from './budget-page-money';
import { budgetFromEventMoney } from './setnayan-ai-snapshot';
import { overBudgetTrigger, type PlanningSnapshot } from './setnayan-ai-triggers';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/**
 * ⚠ ONE comment stripper (`lib/strip-comments.ts`), never a local regex — the
 * obvious two-replace version blanks real code, and a source guard reading
 * blanked source passes while asserting nothing.
 * `scripts/lint-one-comment-stripper.mjs` enforces it.
 */
const code = (src: string): string => stripComments(readFileSync(resolve(WEB, src), 'utf8'));
const count = (hay: string, re: RegExp): number => hay.match(re)?.length ?? 0;

// ── fixture builders ────────────────────────────────────────────────────────

const vendor = (o: Partial<VendorMoneyRow> & { vendor_id: string; status: string }) =>
  ({
    event_id: 'evt',
    category: null,
    vendor_name: null,
    total_cost_php: null,
    transport_php: null,
    food_allowance_php: null,
    covers_plan_groups: [],
    archived_at: null,
    voided_by_fraud: false,
    package_role: null,
    event_vendor_package_id: null,
    deposit_paid_php: null,
    ...o,
  }) as unknown as VendorMoneyRow;

type Case = {
  name: string;
  /** What this case would have been INVISIBLE to before BA8, if anything. */
  blindSpot?: string;
  targetCentavos: number | null;
  vendors: VendorMoneyRow[];
  lineItems?: LineItemMoneyRow[];
  payments?: PaymentMoneyRow[];
  orders?: OrderMoneyRow[];
  costs?: EventCostMoneyRow[];
  packageLockedCentavos?: Map<string, number>;
};

/**
 * One case per source of money the resolver counts — i.e. per way the two
 * books could have disagreed. Amounts are deliberately unequal so a formula
 * that silently drops one shows up as a number, not as a rounding wobble.
 */
const CASES: Case[] = [
  {
    name: 'nothing at all',
    targetCentavos: 50_000_00,
    vendors: [],
  },
  {
    name: 'no target set — nothing to be over',
    targetCentavos: null,
    vendors: [vendor({ vendor_id: 'v1', status: 'contracted', total_cost_php: 900_000 })],
  },
  {
    name: 'the legacy headline (what the old formula COULD see)',
    targetCentavos: 100_000_00,
    vendors: [
      vendor({ vendor_id: 'v1', status: 'contracted', category: 'catering', total_cost_php: 225_000 }),
      vendor({ vendor_id: 'v2', status: 'considering', category: 'florist', total_cost_php: 80_000 }),
    ],
  },
  {
    name: 'a vendor itemised into line items',
    blindSpot: 'the old formula read total_cost_php and never the itemisation',
    targetCentavos: 100_000_00,
    vendors: [vendor({ vendor_id: 'v1', status: 'contracted', category: 'catering' })],
    lineItems: [
      { line_item_id: 'li1', vendor_id: 'v1', label: 'Plated dinner', amount_php: 200_000, due_date: null },
      { line_item_id: 'li2', vendor_id: 'v1', label: 'Service charge', amount_php: 25_000, due_date: null },
    ] as unknown as LineItemMoneyRow[],
  },
  {
    name: 'a change-order CREDIT (negative line)',
    blindSpot: 'a credit could not reduce the guard’s total — it warned on money already given back',
    targetCentavos: 100_000_00,
    vendors: [vendor({ vendor_id: 'v1', status: 'contracted', category: 'catering', total_cost_php: 225_000 })],
    lineItems: [
      { line_item_id: 'li1', vendor_id: 'v1', label: 'Headcount reduction', amount_php: -40_000, due_date: null },
    ] as unknown as LineItemMoneyRow[],
  },
  {
    name: 'transport + crew meals (R5)',
    blindSpot: 'both columns were invisible to the guard',
    targetCentavos: 100_000_00,
    vendors: [
      vendor({
        vendor_id: 'v1',
        status: 'contracted',
        category: 'photographer',
        total_cost_php: 80_000,
        transport_php: 6_500,
        food_allowance_php: 3_200,
      }),
    ],
  },
  {
    name: 'a LOCKED package with no headline written (R4)',
    blindSpot: 'the agreed total lives on event_vendor_packages; the guard read total_cost_php and saw ₱0',
    targetCentavos: 100_000_00,
    vendors: [
      vendor({
        vendor_id: 'v1',
        status: 'contracted',
        category: 'photographer',
        package_role: 'anchor',
        event_vendor_package_id: 'bk1',
      }),
    ],
    packageLockedCentavos: new Map([['bk1', 175_000_00]]),
  },
  {
    name: 'a supplier-less cost — event_costs (BA7)',
    blindSpot: 'rings, the licence fee, ang pao — money with nobody on the other side of it',
    targetCentavos: 100_000_00,
    vendors: [],
    costs: [
      { cost_id: 'c1', plan_group_id: 'rings', label: 'Wedding bands', amount_php: 45_000, paid_php: 45_000, due_date: null },
      { cost_id: 'c2', plan_group_id: null, label: 'Marriage licence', amount_php: 2_100, paid_php: 0, due_date: null },
    ] as unknown as EventCostMoneyRow[],
  },
  {
    name: 'a Setnayan order the couple PAID for',
    targetCentavos: 100_000_00,
    vendors: [],
    orders: [
      { order_id: 'o1', description: 'Setnayan AI', service_key: 'SETNAYAN_AI', requested_total_php: 2_499, confirmed_total_php: null, status: 'paid', vendor_profile_id: null },
    ] as unknown as OrderMoneyRow[],
  },
  {
    name: 'a SUBMITTED order — applied for, not approved',
    blindSpot: 'the old guard added this on top of committed as `pending`; the resolver files it as an estimate',
    targetCentavos: 100_000_00,
    vendors: [],
    orders: [
      { order_id: 'o1', description: 'Live Studio', service_key: 'LIVE_STUDIO', requested_total_php: 3_000, confirmed_total_php: null, status: 'submitted', vendor_profile_id: null },
    ] as unknown as OrderMoneyRow[],
  },
  {
    name: 'a VENDOR-payer booking fee stamped with this event_id',
    blindSpot: 'the vendor’s own 1% fee would have been billed to the couple’s guard',
    targetCentavos: 100_000_00,
    vendors: [],
    orders: [
      { order_id: 'o1', description: 'Booking fee', service_key: 'vendor_booking_fee', requested_total_php: 4_500, confirmed_total_php: null, status: 'paid', vendor_profile_id: 'vp1' },
    ] as unknown as OrderMoneyRow[],
  },
  {
    name: 'an ARCHIVED vendor carrying money (R8)',
    blindSpot: 'a rejected supplier’s cost',
    targetCentavos: 100_000_00,
    vendors: [
      vendor({ vendor_id: 'v1', status: 'contracted', category: 'florist', total_cost_php: 78_000, archived_at: '2026-06-25T05:07:39Z' }),
      vendor({ vendor_id: 'v2', status: 'contracted', category: 'catering', total_cost_php: 30_000 }),
    ],
  },
  {
    name: 'a `covered` package member contributes ₱0 (R3)',
    targetCentavos: 100_000_00,
    vendors: [
      vendor({ vendor_id: 'v1', status: 'contracted', category: 'photographer', package_role: 'anchor', total_cost_php: 175_000 }),
      vendor({ vendor_id: 'v2', status: 'contracted', category: 'videographer', package_role: 'covered', total_cost_php: 95_000 }),
    ],
  },
  {
    name: 'money paid to a vendor nothing was ever agreed with',
    blindSpot: 'an unbooked payment — real pesos, no commitment row',
    targetCentavos: 100_000_00,
    vendors: [vendor({ vendor_id: 'v1', status: 'considering', category: 'catering' })],
    payments: [
      { payment_id: 'p1', vendor_id: 'v1', line_item_id: null, amount_php: 15_000, paid_at: '2026-06-01' },
    ] as unknown as PaymentMoneyRow[],
  },
  {
    name: 'the whole ledger at once — over target, several buckets',
    targetCentavos: 930_000_00,
    vendors: [
      vendor({ vendor_id: 'v1', status: 'deposit_paid', category: 'catering', total_cost_php: 225_000, deposit_paid_php: 67_500 }),
      vendor({ vendor_id: 'v2', status: 'contracted', category: 'videographer', total_cost_php: 95_000, transport_php: 4_000 }),
      vendor({ vendor_id: 'v3', status: 'contracted', category: 'florist', total_cost_php: 78_000 }),
      vendor({ vendor_id: 'v4', status: 'considering', category: 'photographer', total_cost_php: 90_000 }),
      vendor({ vendor_id: 'v5', status: 'contracted', category: 'photographer', package_role: 'anchor', event_vendor_package_id: 'bk1' }),
    ],
    lineItems: [
      { line_item_id: 'li1', vendor_id: 'v3', label: 'Ceremony florals', amount_php: 70_000, due_date: '2026-11-25' },
      { line_item_id: 'li2', vendor_id: 'v3', label: 'Bouquets', amount_php: 8_000, due_date: '2026-11-25' },
    ] as unknown as LineItemMoneyRow[],
    payments: [
      { payment_id: 'p1', vendor_id: 'v1', line_item_id: null, amount_php: 67_500, paid_at: '2026-06-01' },
    ] as unknown as PaymentMoneyRow[],
    orders: [
      { order_id: 'o1', description: 'Setnayan AI', service_key: 'SETNAYAN_AI', requested_total_php: 2_499, confirmed_total_php: null, status: 'paid', vendor_profile_id: null },
    ] as unknown as OrderMoneyRow[],
    costs: [
      { cost_id: 'c1', plan_group_id: 'rings', label: 'Bands', amount_php: 45_000, paid_php: 45_000, due_date: null },
    ] as unknown as EventCostMoneyRow[],
    packageLockedCentavos: new Map([['bk1', 400_000_00]]),
  },
];

const resolve_ = (c: Case): EventMoney =>
  computeEventMoney({
    targetCentavos: c.targetCentavos,
    vendors: c.vendors,
    lineItems: c.lineItems ?? [],
    payments: c.payments ?? [],
    orders: c.orders ?? [],
    costs: c.costs ?? [],
    pricing: new Map() as VendorPricingLookup,
    packageLockedCentavos: c.packageLockedCentavos ?? new Map(),
    benchmarks: [],
    // Fixed clock — the fixtures carry due dates, and `due` banding must not
    // make this suite depend on the day it runs.
    now: new Date('2026-09-03T00:00:00+08:00'),
  });

const snapOf = (budget: PlanningSnapshot['budget']): PlanningSnapshot => ({
  eventType: 'wedding',
  payments: [],
  statutory: [],
  shortlist: [],
  priceChanges: [],
  contracts: [],
  inquiries: [],
  budget,
  dateClusters: [],
  scheduleClash: [],
  availability: [],
});

// ── 1 · ARITHMETIC ──────────────────────────────────────────────────────────

for (const c of CASES) {
  test(`the guard and /budget agree on committed — ${c.name}`, () => {
    const money = resolve_(c);
    const guard = budgetFromEventMoney(money);
    // What `/budget`'s "Current commitments" strip prints, through the page's
    // own core, in the state production runs in (the flag is ON since
    // 2026-09-02). `legacyCommittedPhp` is deliberately absurd: if the strip
    // ever falls back to it, this test must not quietly agree.
    const page = budgetStripMoney({
      enabled: true,
      money,
      legacyCommittedPhp: -999_999,
      targetCentavos: c.targetCentavos,
    });

    if (guard === null) {
      assert.equal(
        money.targetPhp,
        null,
        `GRD-05 went silent on "${c.name}" while a target exists. Silence is ` +
          `only honest when there is nothing to be over.`,
      );
      return;
    }
    assert.equal(
      guard.committedPhp,
      page.committedPhp,
      `TWO SETS OF BOOKS. On "${c.name}" the paid guard says ` +
        `₱${guard.committedPhp} committed and /budget says ₱${page.committedPhp}` +
        (c.blindSpot ? ` — ${c.blindSpot}` : '') +
        `. Both must come from resolveEventMoney and nothing else.`,
    );
    assert.equal(guard.totalPhp, page.targetPhp, `target diverged on "${c.name}"`);
  });
}

// ── 2 · FIRE STATE ──────────────────────────────────────────────────────────

for (const c of CASES) {
  test(`GRD-05 fires exactly when /budget says over — ${c.name}`, () => {
    const money = resolve_(c);
    const fired = overBudgetTrigger(snapOf(budgetFromEventMoney(money)));

    assert.equal(
      fired.length > 0,
      money.isOverBudget,
      `On "${c.name}" GRD-05 ${fired.length > 0 ? 'FIRES' : 'is silent'} while ` +
        `/budget says ${money.isOverBudget ? 'over budget' : 'within budget'}. ` +
        `§18.5 rule 4 gives "over budget" one meaning; a guard with its own ` +
        `threshold is the same defect as a guard with its own total.`,
    );

    if (fired.length > 0) {
      const printed = Number(String(fired[0]!.slots.over_amount ?? '').replace(/,/g, ''));
      assert.equal(
        printed,
        Math.round(money.overBudgetByPhp),
        `On "${c.name}" the alert says ₱${printed} over and /budget says ` +
          `₱${money.overBudgetByPhp}.`,
      );
    }
  });
}

/**
 * The old formula, transcribed once — `Σ (confirmed ?? requested)` over
 * paid/fulfilled orders, plus `Σ total_cost_php` over unarchived
 * contracted-or-better vendors, plus `submitted`/`awaiting_payment` orders as
 * `pending`. It is DELETED from the app, so this is a historical record rather
 * than a mirror of shipped code and cannot drift out of step with it.
 *
 * Its purpose is to answer, in the file rather than in a PR body, the one
 * question the owner asked before approving this: does the guard get LOUDER or
 * QUIETER, and because of what? Each row states the direction and the reason.
 */
const LOCKED = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);
const n = (v: unknown): number => {
  const x = Number(v ?? 0);
  return Number.isFinite(x) ? x : 0;
};
function oldGuardTotalPhp(c: Case): number {
  const orders = (c.orders ?? [])
    .filter((o) => o.status === 'paid' || o.status === 'fulfilled')
    .reduce((s2, o) => s2 + n(o.confirmed_total_php ?? o.requested_total_php), 0);
  const vendors = c.vendors
    .filter((v) => v.archived_at == null && LOCKED.has(v.status as string))
    .reduce((s2, v) => s2 + n(v.total_cost_php), 0);
  const pending = (c.orders ?? [])
    .filter((o) => o.status === 'submitted' || o.status === 'awaiting_payment')
    .reduce((s2, o) => s2 + n(o.requested_total_php), 0);
  return orders + vendors + pending;
}

/** Which way the guard's number moves, per case. `same` = no live change. */
const DIRECTION: Record<string, 'up' | 'down' | 'same'> = {
  'nothing at all': 'same',
  'no target set — nothing to be over': 'same',
  'the legacy headline (what the old formula COULD see)': 'same',
  'a vendor itemised into line items': 'up',
  'a change-order CREDIT (negative line)': 'down',
  'transport + crew meals (R5)': 'up',
  'a LOCKED package with no headline written (R4)': 'up',
  'a supplier-less cost — event_costs (BA7)': 'up',
  'a Setnayan order the couple PAID for': 'same',
  'a SUBMITTED order — applied for, not approved': 'down',
  // The old formula had no payer discriminator, so the VENDOR's own fee was
  // being counted against the COUPLE's budget: ₱4,500 → ₱0.
  'a VENDOR-payer booking fee stamped with this event_id': 'down',
  'an ARCHIVED vendor carrying money (R8)': 'same',
  'a `covered` package member contributes ₱0 (R3)': 'down',
  'money paid to a vendor nothing was ever agreed with': 'up',
  'the whole ledger at once — over target, several buckets': 'up',
};

for (const c of CASES) {
  test(`the number moves the way the owner was told — ${c.name}`, () => {
    const now = budgetFromEventMoney(resolve_(c))?.committedPhp ?? 0;
    const before = c.targetCentavos === null ? 0 : oldGuardTotalPhp(c);
    const moved = now > before ? 'up' : now < before ? 'down' : 'same';
    assert.equal(
      moved,
      DIRECTION[c.name],
      `"${c.name}" now moves the guard's total ${moved} (₱${before} → ₱${now}), ` +
        `not ${DIRECTION[c.name]}. This table is what the owner signed off on: ` +
        `if the direction genuinely changed, change the row and say so — do not ` +
        `let it change silently.`,
    );
  });
}

test('a couple whose committed money is ALL invisible to the old formula is warned', () => {
  // The complement to every equality above: prove the fixtures can actually
  // separate the two formulas, or "they agree" is vacuous. This ledger is
  // entirely line items, a locked package, crew meals and a supplier-less
  // cost — the old guard's `Σ total_cost_php of contracted vendors` reads ₱0
  // against a ₱300,000 target and says nothing at all.
  const money = resolve_({
    name: 'all-invisible',
    targetCentavos: 300_000_00,
    vendors: [
      vendor({ vendor_id: 'v1', status: 'contracted', category: 'catering', food_allowance_php: 9_000 }),
      vendor({ vendor_id: 'v2', status: 'contracted', category: 'photographer', package_role: 'anchor', event_vendor_package_id: 'bk1' }),
    ],
    lineItems: [
      { line_item_id: 'li1', vendor_id: 'v1', label: 'Plated dinner', amount_php: 240_000, due_date: null },
    ] as unknown as LineItemMoneyRow[],
    costs: [
      { cost_id: 'c1', plan_group_id: 'rings', label: 'Bands', amount_php: 45_000, paid_php: 0, due_date: null },
    ] as unknown as EventCostMoneyRow[],
    packageLockedCentavos: new Map([['bk1', 175_000_00]]),
  });

  const legacyTotalCostPhp = 0; // Σ total_cost_php over contracted vendors: both null
  assert.equal(legacyTotalCostPhp < money.committed, true);
  assert.equal(money.isOverBudget, true);
  assert.equal(overBudgetTrigger(snapOf(budgetFromEventMoney(money))).length, 1);
});

// ── 3 · SHAPE ───────────────────────────────────────────────────────────────

test('SnapshotBudget carries no field the resolver does not have', () => {
  const money = resolve_(CASES[CASES.length - 1]!);
  const guard = budgetFromEventMoney(money)!;
  assert.deepEqual(
    Object.keys(guard).sort(),
    ['committedPhp', 'topDriverCategory', 'totalPhp'],
    `SnapshotBudget's shape changed. Every field must be a field of ` +
      `EventMoney; a new one is a number only this guard knows, which is how ` +
      `\`pendingPhp\` used to make GRD-05 warn about money /budget never printed.`,
  );
});

test('the trigger reads the snapshot’s committed total, not an addition of its own', () => {
  const src = code('lib/setnayan-ai-triggers.ts');
  const body = src.slice(src.indexOf('export function overBudgetTrigger'));
  const fn = body.slice(0, body.indexOf('\n}') + 2);
  assert.match(
    fn,
    /const\s+over\s*=\s*b\.committedPhp\s*-\s*b\.totalPhp\s*;/,
    'overBudgetTrigger must compare committed against the target and nothing ' +
      'else — that difference IS EventMoney.overBudgetByPhp.',
  );
  assert.equal(
    /b\.committedPhp\s*\+/.test(fn),
    false,
    'Something is being added to committed inside GRD-05 again.',
  );
});

// ── 4 · SOURCE ──────────────────────────────────────────────────────────────

/**
 * Both surfaces that run GRD-05. The notification sweep and the Overview's
 * "Sai on watch" rail are two renders of ONE trigger — fixing only the first
 * would leave the couple warned by an email-shaped number and reassured by a
 * card-shaped one, which is the original defect with a shorter walk.
 */
const GRD05_SURFACES = [
  'lib/setnayan-ai-snapshot.ts',
  'app/dashboard/[eventId]/_components/event-dashboard.tsx',
];

/**
 * `budgetFromEventMoney`'s own body legitimately writes `committedPhp:` — it
 * is the mapper. Cut it out and scan what is left, so the window this property
 * looks through is exactly where a hand-rolled second assembly would live.
 */
function withoutTheMapper(src: string): string {
  const start = src.indexOf('export function budgetFromEventMoney');
  if (start < 0) return src;
  const end = src.indexOf('\n}', start);
  return src.slice(0, start) + (end < 0 ? '' : src.slice(end + 2));
}

for (const file of GRD05_SURFACES) {
  test(`${file} builds GRD-05's budget through budgetFromEventMoney`, () => {
    const src = code(file);
    assert.ok(
      /budgetFromEventMoney\s*\(/.test(src),
      `${file} runs the over-budget guard but no longer maps the resolver into ` +
        `it. Whatever it feeds \`budget:\` is a second set of books.`,
    );
    // Nothing else may produce a SnapshotBudget. An object literal carrying
    // `committedPhp:` outside the mapper is a hand-assembled one.
    const handRolled = count(withoutTheMapper(src), /\bcommittedPhp\s*:/g);
    assert.equal(
      handRolled,
      0,
      `${file} assembles committedPhp by hand in ${handRolled} place(s). The ` +
        `guard's total comes from resolveEventMoney or it comes from a formula ` +
        `that will drift from /budget the day either one moves.`,
    );
  });
}

test('the mapper-blind window can still SEE a hand-rolled assembly', () => {
  // The slice above is the kind of window that goes blind and keeps passing.
  // Prove it does not: a second assembly appended after the mapper must be
  // visible to the same scan the property runs.
  const sabotaged = code('lib/setnayan-ai-snapshot.ts') + '\nconst x = { committedPhp: 1 };\n';
  assert.equal(count(withoutTheMapper(sabotaged), /\bcommittedPhp\s*:/g), 1);
  // …and the mapper's own line is genuinely excluded, or the property above is
  // asserting on a blank.
  assert.equal(count(code('lib/setnayan-ai-snapshot.ts'), /\bcommittedPhp\s*:/g), 1);
});

test('lib/setnayan-ai-snapshot.ts asks the resolver, and reads no target of its own', () => {
  const src = code('lib/setnayan-ai-snapshot.ts');
  assert.ok(
    /resolveEventMoney\s*\(\s*admin\s*,\s*eventId\s*\)/.test(src),
    'buildPlanningSnapshot must call resolveEventMoney(admin, eventId).',
  );
  assert.equal(
    /estimated_budget_centavos/.test(src),
    false,
    'The snapshot reads the couple’s target directly again. The resolver ' +
      'returns it as EventMoney.targetPhp; two reads of one target is how two ' +
      'books start.',
  );
});

test('the Overview rail resolves money only when the viewer may read the budget', () => {
  // `resolveEventMoney` reads `events_host`, which admits a MODERATOR as well
  // as the couple. Ungated, this rail would print the couple's target and
  // committed total to a delegate they never gave budget access to.
  const src = code('app/dashboard/[eventId]/_components/event-dashboard.tsx');
  assert.match(
    src,
    /budgetVisibility\.mayRead\s*\?[\s\S]{0,160}?resolveEventMoney\s*\(/,
    'The Overview must gate resolveEventMoney on budgetVisibility.mayRead.',
  );
});
