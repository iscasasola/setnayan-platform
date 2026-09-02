/**
 * no-quotes-on-the-budget-page.test.ts — BA2's fence.
 *
 * OWNER RULING, 2026-09-02, verbatim: *"no quotes here. we only add the
 * finalized budgets. on the marketplace, this is where they can add and
 * subtract the other vendors to help them find the better option for them."*
 *
 * `/dashboard/[eventId]/budget` prints money the couple has AGREED to. A
 * shortlisted supplier's ₱80,000 is a guess; it belongs in the Merkado, beside
 * the other candidates, where subtracting one is the point.
 *
 * WHY A GUARD AND NOT JUST THE UNIT TESTS
 * ───────────────────────────────────────
 * The widening this reverses (BUD-2) was a *correct* answer to a real defect —
 * R1, where a headline included a vendor the couple could not open. It is the
 * kind of change a future session re-derives from first principles and puts
 * back, in good faith, in an afternoon. So the narrowing is asserted three
 * ways, each facing a different way of undoing it:
 *
 *   1 · BEHAVIOUR — `vendorsToItemize` refuses every unconfirmed status, for a
 *       vendor carrying money in EVERY way the snapshot can carry it.
 *   2 · SHAPE — `budgetStripMoney` has no estimate-shaped field, in BOTH flag
 *       states, so the strip has nothing to print even if someone tries.
 *   3 · SOURCE — the page's rendered list comes from `vendorsToItemize` and
 *       from nothing else. Property 1 is blind to a page that stops calling it.
 *
 * ⚠ WHAT THIS DOES NOT SAY. It does not say an estimate is worthless, and it
 * must never be read as licence to stop computing one: `resolveEventMoney`
 * still returns `estimated`, `MoneyBucket.estimatedPhp` is still per-category,
 * and the checklist still reads them. This is a display rule for ONE surface.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { budgetStripMoney, vendorsToItemize } from './budget-page-money';
import { CONFIRMED_VENDOR_STATUSES } from './events';
import { LOCKED_VENDOR_STATUSES } from './shortlist-taxonomy';
import { lockRequestStateOf } from './lock-request-state';
import type { EventMoney } from './budget-truth';
import type { VendorBudgetSummary } from './budget';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const PAGE = 'app/dashboard/[eventId]/budget/page.tsx';

/** Strip comments — a docblock naming a helper must not read as calling it. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function count(haystack: string, re: RegExp): number {
  return haystack.match(re)?.length ?? 0;
}

/**
 * The statuses `/budget` treats as finalized — mirrored from the page's own
 * CONFIRMED_STATUS_SET so the fixtures below exercise the real predicate.
 */
const isConfirmed = (s: string) =>
  s === 'contracted' || s === 'deposit_paid' || s === 'delivered' || s === 'complete';

/** Every status a vendor can sit at BEFORE the money is agreed. */
const UNCONFIRMED = ['considering', 'shortlisted', 'inquired', 'quoted', 'declined'];

/**
 * A vendor carrying money through EVERY channel the snapshot has: the legacy
 * headline, a manual itemization, a logged payment, and a payments array. One
 * narrowed test would pass while another channel quietly re-opened the door.
 */
function richVendor(status: string): VendorBudgetSummary {
  return {
    vendor: {
      vendor_id: `v-${status}`,
      status,
      total_cost_php: 80_000,
      vendor_name: `Vendor ${status}`,
    },
    lineItems: [],
    payments: [{ payment_id: 'p1', amount_php: 5_000 }],
    itemizedTotal: 80_000,
    paidTotal: 5_000,
    remaining: 75_000,
    priceSource: 'manual',
    vendorControlledItems: [],
  } as unknown as VendorBudgetSummary;
}

// ── 1 · BEHAVIOUR ───────────────────────────────────────────────────────────

for (const status of UNCONFIRMED) {
  test(`a "${status}" vendor carrying ₱80,000 gets NO card on /budget`, () => {
    const shown = vendorsToItemize({ vendors: [richVendor(status)], isConfirmed });
    assert.equal(
      shown.length,
      0,
      `"${status}" is a quote, not a commitment. Owner 2026-09-02: "no quotes ` +
        `here. we only add the finalized budgets." Comparing candidates is the ` +
        `Merkado's job — do not widen this list to bring it back.`,
    );
  });
}

test('a contracted vendor carrying the SAME money does get a card', () => {
  // The complement matters: a filter that returns nothing would pass every
  // assertion above while breaking the page outright.
  const shown = vendorsToItemize({ vendors: [richVendor('contracted')], isConfirmed });
  assert.equal(shown.length, 1);
});

// ── 2 · SHAPE ───────────────────────────────────────────────────────────────

const MONEY_80K_ESTIMATED: EventMoney = {
  targetPhp: 500_000,
  estimated: 80_000,
  committed: 0,
  paid: 0,
  stillOwed: 0,
  overpaid: 0,
  isOverBudget: false,
  overBudgetByPhp: 0,
  byBucket: [],
  lines: [],
  sources: [],
  warnings: [],
};

for (const enabled of [true, false]) {
  test(`flag ${enabled ? 'ON' : 'OFF'}: the strip carries no estimate to print`, () => {
    const strip = budgetStripMoney({
      enabled,
      money: MONEY_80K_ESTIMATED,
      legacyCommittedPhp: 0,
      targetCentavos: 50_000_000,
    });
    const estimateKeys = Object.keys(strip).filter((k) => /estimat/i.test(k));
    assert.deepEqual(
      estimateKeys,
      [],
      `BudgetStripMoney gained ${estimateKeys.join(', ')}. The strip's job is ` +
        `finalized money; an estimate field here is the "₱X more is still an ` +
        `estimate" hint growing back.`,
    );
    // And the number itself never leaks into the one figure that IS printed.
    assert.equal(strip.committedPhp, 0);
  });
}

// ── 3 · SOURCE ──────────────────────────────────────────────────────────────

test('the /budget vendor list is derived ONLY through vendorsToItemize', () => {
  const src = code(readFileSync(resolve(WEB, PAGE), 'utf8'));

  assert.equal(
    count(src, /\bconst\s+finalizedVendors\s*=\s*vendorsToItemize\s*\(/g),
    1,
    `${PAGE} must build its vendor list with vendorsToItemize(). An inline ` +
      `filter is a second display rule, and the two disagree the day one moves.`,
  );

  // Nothing else may turn the raw snapshot into a list. `.reduce(` is allowed:
  // that is the legacy committed total, which is arithmetic, not a card.
  const rawListings = count(src, /\bsnapshot\.vendors\s*\.\s*(filter|map|slice|concat)\s*\(/g);
  assert.equal(
    rawListings,
    0,
    `${PAGE} builds a list straight off snapshot.vendors (${rawListings} place(s)). ` +
      `Every rendered row goes through vendorsToItemize() or an unconfirmed ` +
      `supplier's quote is back on the page.`,
  );
});

test('the /budget page never reads the resolver’s estimate', () => {
  const src = code(readFileSync(resolve(WEB, PAGE), 'utf8'));
  // `estimated_budget_centavos` / `estimated_pax` are the couple's own target
  // and guest count — deliberately NOT matched here. What must not appear is
  // the resolver's guess-at-vendor-money.
  for (const re of [/\bestimatedPhp\b/, /\bmoney\.estimated\b/, /\bstripMoney\.estimated/]) {
    assert.ok(
      !re.test(src),
      `${PAGE} reads ${re.source} — /budget prints finalized money only (BA2).`,
    );
  }
});

// ── 4 · "ONLY LOCKED SERVICES CAN SHOW HERE" ────────────────────────────────
/**
 * Owner, 2026-09-02, refining the ruling above: *"only locked services can show
 * here"* — *"that is my point, not quotations created on the shortlist."*
 *
 * MEASURED, and the answer is that the app already had THREE names for this one
 * four-value list, in three files, with nothing holding them together:
 *
 *   · `CONFIRMED_VENDOR_STATUSES` (`lib/events.ts`) — what `/budget` filters on
 *   · `LOCKED_VENDOR_STATUSES` (`lib/shortlist-taxonomy.ts`) — what the Merkado
 *     calls the same fact
 *   · a private `CONFIRMED` set inside `lib/lock-request-state.ts`, THE one place
 *     the lock state is derived
 *
 * They agree today. Nothing made them: no test named two of them together, so a
 * fifth status added to one list would leave `/budget` and the Merkado
 * disagreeing about which suppliers are locked — each passing its own suite.
 * That is the two-mechanisms-one-fact defect, and it sits directly under the
 * owner's sentence, so it is closed here rather than noted.
 *
 * ⚠ THERE IS NO SECOND LOCK AXIS. `lockRequestStateOf` returns `locked` for any
 * confirmed status unconditionally — *"a real booking outranks any marker it
 * happens to carry"* — so a row cannot be contracted-but-not-locked, and a
 * `lock_request_state` of `agreed` WITHOUT a confirmed status is `cancelled`,
 * never `locked`. "Locked" and "contracted+" are one set, not two.
 */

const isConfirmedStatus = (s: string) =>
  (CONFIRMED_VENDOR_STATUSES as readonly string[]).includes(s);

test('“locked” is ONE list — /budget’s filter and the Merkado’s cannot drift apart', () => {
  assert.deepEqual(
    [...CONFIRMED_VENDOR_STATUSES].sort(),
    [...LOCKED_VENDOR_STATUSES].sort(),
    `/budget admits CONFIRMED_VENDOR_STATUSES and the Merkado calls LOCKED_VENDOR_STATUSES ` +
      `the same fact. They have diverged. Until they agree, the two surfaces disagree about ` +
      `which suppliers are booked — and each still passes its own suite.`,
  );
});

for (const handshake of [true, false]) {
  test(`a supplier gets a /budget card IFF the lock resolver calls it locked (handshake ${handshake ? 'ON' : 'OFF'})`, () => {
    // The owner's sentence, executable. Not "contracted-ish" — locked, as the
    // ONE place that derives lock state defines it.
    const statuses = [...UNCONFIRMED, ...CONFIRMED_VENDOR_STATUSES];
    for (const status of statuses) {
      const carded =
        vendorsToItemize({
          vendors: [richVendor(status)],
          isConfirmed: isConfirmedStatus,
        }).length === 1;
      const locked =
        lockRequestStateOf({ status, lock_request_state: null }, handshake) === 'locked';
      assert.equal(
        carded,
        locked,
        `"${status}": /budget ${carded ? 'shows' : 'hides'} it but the lock resolver says ` +
          `${locked ? 'locked' : 'not locked'}. Owner 2026-09-02: "only locked services can ` +
          `show here" — the budget page and the lock state must name the same bookings.`,
      );
    }
  });
}

test('a shortlist quotation is never locked, however it was agreed', () => {
  // `lock_request_state: 'agreed'` WITHOUT a confirmed status is a supplier who
  // said yes to an ask the booking never completed. It is not money the couple
  // owes, and it does not belong on this page.
  assert.notEqual(
    lockRequestStateOf({ status: 'shortlisted', lock_request_state: 'agreed' }, true),
    'locked',
  );
  assert.equal(
    vendorsToItemize({ vendors: [richVendor('shortlisted')], isConfirmed: isConfirmedStatus })
      .length,
    0,
  );
});
