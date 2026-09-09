/**
 * a-settled-delta-must-not-erase-the-headline.test.ts
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * "Accepting a Deal doesn't reach the couple's budget" is true, and the obvious
 * fix — copy `accept_change_order` and settle the net delta into
 * `event_vendor_line_items` — is WORSE THAN THE BUG. This file is the
 * measurement that says so, kept executable so nobody has to take it on trust.
 *
 * `computeEventMoney` treats `event_vendor_line_items` as the couple's ITEMISED
 * BREAKDOWN of a supplier's cost, with `event_vendors.total_cost_php` as the
 * FALLBACK when no breakdown exists. Its own branch is explicit: once any manual
 * line exists, `priceC` is left at 0 and only the lines are billed.
 *
 * So appending a −₱15,000 settlement line to a supplier billed by HEADLINE does
 * not reduce ₱100,000 to ₱85,000. It DELETES the ₱100,000 and bills −₱15,000.
 * Test 1 measures exactly that.
 *
 * On a PACKAGE ANCHOR the same write is correct — that branch bills the agreed
 * total AND rides the lines on top ("change-order credits ride ON TOP", its own
 * comment). Test 2 measures that, because a guard that only shows the failing
 * case invites "then just always use a line item".
 *
 * 🔴 THE SHIPPED CHANGE ORDER ALREADY CARRIES THIS. `accept_change_order`
 * (20270320861005, re-signed by 20270323841750) writes exactly such a line on
 * accept, with no package-anchor condition. It is latent, not theoretical: it
 * is unobserved only because production holds zero change orders. Named here
 * rather than fixed, because repairing it changes what a real couple's budget
 * reports and is the owner's call, not a side effect of a chat change.
 *
 * ── What actually happens to an accepted Deal today ─────────────────────────
 * Accepting is an AGREEMENT, not a settlement, and that is the design: the card
 * then shows the couple a "🔒 Lock this deal — ₱85,000" button, and `lockDeal`
 * writes the agreed total to `event_vendors.total_cost_php` through the shared
 * `bookVendorAtChatLock`. An ABSOLUTE write, so locking twice cannot double
 * count. For a not-yet-booked supplier the money lands correctly.
 *
 * ⚠ THE REAL HOLE, AND IT IS THE COMMON CASE. `planChatLockBooking` returns
 * `refresh_fee_only` for every CONFIRMED_LOCK_STATUSES row — `contracted`
 * included — so an ALREADY-BOOKED supplier's price is deliberately never
 * rewritten ("a rewrite would diverge the displayed total from the charged
 * base"). But `lockDeal` still stamps `locked_at`, still freezes
 * `chat_threads.agreed_price_centavos` at the NEW total, and the card still
 * tells the couple "🔒 Deal locked — price frozen." The payment session then
 * holds ₱85,000 while the budget holds ₱100,000 — two live numbers disagreeing,
 * with the reassuring one on screen. A mid-plan change on a booked supplier is
 * the single likeliest use of a Deal, so this is the default path, not an edge.
 *
 * Fixing it means either rewriting a booked total (which moves the base the
 * booking fee was charged on) or making a delta line safe on a headline-billed
 * supplier (which changes what every couple's budget reports). Both are money
 * decisions, so both are raised to the owner rather than taken here.
 *
 * 🛡 Test 3 pins the Deal accept path AWAY from the ledger, so the harmful fix
 * cannot land by accident while that decision is open.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  computeEventMoney,
  type LineItemMoneyRow,
  type MoneyInputs,
  type VendorMoneyRow,
} from '@/lib/budget-truth';
import type { VendorPricingLookup } from '@/lib/budget';
import { CONFIRMED_LOCK_STATUSES, planChatLockBooking } from '@/lib/chat-lock-booking';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIONS = join(HERE, '../app/_components/negotiation-actions.ts');

const NOW = new Date('2026-06-01T00:00:00Z');

const inputs = (over: Partial<MoneyInputs> = {}): MoneyInputs => ({
  now: NOW,
  targetCentavos: null,
  vendors: [],
  lineItems: [],
  payments: [],
  orders: [],
  costs: [],
  pricing: new Map() as VendorPricingLookup,
  packageLockedCentavos: new Map(),
  benchmarks: [],
  ...over,
});

const vendor = (over: Partial<VendorMoneyRow> & { vendor_id: string }): VendorMoneyRow => ({
  event_id: 'e1',
  category: 'photographer',
  vendor_name: 'Kasal Studios',
  status: 'contracted',
  total_cost_php: null,
  transport_php: null,
  food_allowance_php: null,
  deposit_paid_php: null,
  covers_plan_groups: [],
  archived_at: null,
  voided_by_fraud: false,
  package_role: null,
  event_vendor_package_id: null,
  marketplace_vendor_id: null,
  ...over,
});

/** The one line an "accept settles the net delta" build would write. */
const settlementLine = (amountPhp: number): LineItemMoneyRow => ({
  line_item_id: 'settled-1',
  vendor_id: 'a',
  label: 'Deal S89M-XXXXXXXXXX',
  amount_php: amountPhp,
  due_date: null,
});

test('a settlement delta ERASES a headline-billed supplier — the reason we do not write one', () => {
  const before = computeEventMoney(
    inputs({ vendors: [vendor({ vendor_id: 'a', total_cost_php: 100_000 })] }),
  );
  assert.equal(before.committed, 100_000, 'baseline: the headline is what the couple owes');

  const after = computeEventMoney(
    inputs({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 100_000 })],
      lineItems: [settlementLine(-15_000)],
    }),
  );

  // THE MEASUREMENT. Not 85,000 — the ₱100,000 headline is gone entirely and
  // the couple is billed the delta alone.
  assert.equal(
    after.committed,
    -15_000,
    'If this is no longer −15000, computeEventMoney changed how a manual line ' +
      'interacts with the headline. Re-read the branch: if a delta now RIDES ON ' +
      'a headline (85000), settling a Deal into event_vendor_line_items became ' +
      'safe and this whole file — and the change-order note in it — needs revisiting.',
  );
  assert.notEqual(
    after.committed,
    85_000,
    'A settled delta must not be assumed to add to the headline.',
  );
});

test('the same write is CORRECT on a package anchor — the lines ride on top', () => {
  const anchor = computeEventMoney(
    inputs({
      vendors: [
        vendor({
          vendor_id: 'a',
          total_cost_php: 100_000,
          package_role: 'anchor',
          event_vendor_package_id: 'pkg1',
        }),
      ],
      lineItems: [settlementLine(-15_000)],
    }),
  );
  assert.equal(
    anchor.committed,
    85_000,
    'The package-anchor branch is the one place a settled delta behaves. If this ' +
      'breaks, the asymmetry this file documents is gone.',
  );
});

test('accepting a Deal must NOT write the budget ledger while that decision is open', () => {
  const src = stripComments(readFileSync(ACTIONS, 'utf8'));

  // Anchor first: if the accept path were renamed, "no ledger write" would pass
  // vacuously on a file that no longer contains the path at all.
  assert.equal(
    (src.match(/export async function respondAmendmentFromChat\b/g) ?? []).length,
    1,
    'respondAmendmentFromChat is gone — this guard is blind. Re-anchor it.',
  );
  assert.equal(
    (src.match(/event_vendor_line_items/g) ?? []).length,
    0,
    'negotiation-actions.ts now writes event_vendor_line_items. Test 1 measures ' +
      'what that does to a headline-billed supplier: it deletes their price. If ' +
      'the owner has ruled on the settlement question, update this file WITH the ' +
      'headline case handled — do not just delete the assertion.',
  );
});

test('an already-booked supplier never has their agreed total rewritten', () => {
  // The mechanism behind the hole named in this file's header. Pinned so that
  // if someone makes a booked row rewritable, they meet this note first — that
  // write moves the base the booking fee was charged on.
  assert.ok(
    CONFIRMED_LOCK_STATUSES.has('contracted'),
    'contracted left CONFIRMED_LOCK_STATUSES — a booked supplier can now be ' +
      'repriced by a chat lock, which changes the booking-fee base.',
  );
  for (const status of CONFIRMED_LOCK_STATUSES) {
    assert.equal(
      planChatLockBooking({
        marketplaceVendorId: 'vp1',
        verified: true,
        currentStatus: status,
      }),
      'refresh_fee_only',
      `A lock on a '${status}' supplier must not rewrite their total.`,
    );
  }
  // And the contrast: an unbooked supplier IS priced by the lock, which is how
  // an accepted Deal reaches the budget on the normal path.
  assert.equal(
    planChatLockBooking({
      marketplaceVendorId: 'vp1',
      verified: true,
      currentStatus: 'considering',
    }),
    'book',
    'The unbooked path must still write the negotiated total, or an accepted ' +
      'Deal reaches the budget by no route at all.',
  );
});
