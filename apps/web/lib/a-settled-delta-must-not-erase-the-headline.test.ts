/**
 * a-settled-delta-must-not-erase-the-headline.test.ts
 *
 * ── ⚖ SETTLED 2026-09-09 — READ THIS BEFORE THE REST ────────────────────────
 * This file was the MEASUREMENT that raised a question to the owner. He has
 * answered it: **"Both, shown separately"** — after a lock, the agreed total
 * UPDATES and the change stays visible as its own line. The repair shipped in
 * migration 20271218458148 + `lib/agreed-total-and-its-changes.ts`, and its own
 * guard is `agreed-total-and-its-changes.test.ts`.
 *
 * The tests below are KEPT, not deleted, and every one of them still passes —
 * because the rule they measure never changed, it was made SPECIFIC:
 *
 *   · an UNFLAGGED line item is a BREAKDOWN, and a breakdown still stands IN
 *     PLACE OF the headline. Test 1 measures that, and it must keep passing:
 *     all 12 suppliers carrying line items in production sum to their headline
 *     exactly, so making breakdowns ride on top doubles every one of them.
 *   · a line carrying `is_change_delta = TRUE` rides ON TOP. That is the new
 *     behaviour, and it is pinned in the other file, not this one.
 *
 * ⇒ So the sentence this file used to end on — "settling a Deal into
 *   event_vendor_line_items is worse than the bug" — is now HALF true, and the
 *   surviving half is the important one. See test 3.
 *
 * ── Why this file exists ────────────────────────────────────────────────────
 * `computeEventMoney` treats an UNFLAGGED `event_vendor_line_items` row as the
 * couple's ITEMISED BREAKDOWN of a supplier's cost, with
 * `event_vendors.total_cost_php` as the FALLBACK when no breakdown exists. Its
 * branch is explicit: once any breakdown line exists, `priceC` is left at 0 and
 * only the lines are billed.
 *
 * So appending a −₱15,000 line WITHOUT the change flag to a supplier billed by
 * HEADLINE does not reduce ₱100,000 to ₱85,000. It DELETES the ₱100,000 and
 * bills −₱15,000. Test 1 measures exactly that, and that is still the correct
 * behaviour for a line the couple typed themselves.
 *
 * On a PACKAGE ANCHOR the same write is correct — that branch bills the agreed
 * total AND rides the lines on top. Test 2 measures that, because a guard that
 * only shows the failing case invites "then just always use a line item".
 *
 * ✅ THE SHIPPED CHANGE ORDER NO LONGER CARRIES THIS. `accept_change_order`
 * stamps `is_change_delta = TRUE`, so its settlement row rides on top instead
 * of replacing the price. It was latent, never observed — production has held
 * zero change orders throughout.
 *
 * ── What happens to an accepted Deal today ──────────────────────────────────
 * Accepting is an AGREEMENT, not a settlement, and that is the design: the card
 * then shows the couple a "🔒 Lock this deal — ₱85,000" button, and `lockDeal`
 * writes the agreed total to `event_vendors.total_cost_php` through the shared
 * `bookVendorAtChatLock`. An ABSOLUTE write, so locking twice cannot double
 * count.
 *
 * ✅ AND THE ALREADY-BOOKED CASE IS CLOSED TOO (2026-09-09, separately). The
 * `refresh_fee_only` branch used to write nothing, so a mid-plan deal on a
 * BOOKED supplier froze a new price on the thread while `/budget` kept the old
 * one. That branch now reprices the row. Both arms of the Deal path therefore
 * reach the budget by an ABSOLUTE write.
 *
 * 🛡 WHICH IS EXACTLY WHY TEST 3 STILL STANDS, with a NEW reason. A delta line
 * from the Deal path is no longer unsafe because it erases a headline — it is
 * unsafe because the Deal path ALREADY writes the new absolute total, so a
 * delta riding on top of it would be counted TWICE. Change orders settle as
 * deltas; Deals settle as absolute rewrites. One settlement per path.
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

test('an UNFLAGGED line replaces a headline-billed supplier — a breakdown, not a change', () => {
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

  // THE MEASUREMENT. Not 85,000 — an UNFLAGGED line is the couple's own
  // itemisation, so the ₱100,000 headline is superseded by it.
  //
  // ⚠ THIS MUST KEEP PASSING. It is the production-safety half of the
  // 2026-09-09 ruling: every supplier carrying line items in prod today sums to
  // their headline EXACTLY, so if an unflagged line ever starts riding ON TOP
  // (85000 here), all 12 of them double. The line that rides on top is the one
  // carrying `is_change_delta`, and only accept_change_order may set it.
  assert.equal(
    after.committed,
    -15_000,
    'An unflagged line item began riding ON TOP of the headline. That doubles ' +
      'every supplier in production that carries a breakdown. The rider is the ' +
      'FLAGGED line — see agreed-total-and-its-changes.test.ts.',
  );
  assert.notEqual(
    after.committed,
    85_000,
    'A breakdown line must not be assumed to add to the headline.',
  );

  // …and the flagged twin, so the asymmetry is visible in one place.
  const flagged = computeEventMoney(
    inputs({
      vendors: [vendor({ vendor_id: 'a', total_cost_php: 100_000 })],
      lineItems: [{ ...settlementLine(-15_000), is_change_delta: true }],
    }),
  );
  assert.equal(
    flagged.committed,
    85_000,
    'A settled CHANGE must adjust the agreed total (owner 2026-09-09).',
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
    'negotiation-actions.ts now writes event_vendor_line_items. Since 2026-09-09 ' +
      'the Deal path ALREADY writes the new agreed total absolutely (bookVendorAtChatLock, ' +
      'both the first-lock and the already-booked-reprice arms), so a delta line ' +
      'here would be counted TWICE — once in the rewritten total_cost_php and ' +
      'again as a rider. Change orders settle as deltas; Deals settle as absolute ' +
      'rewrites. One settlement per path.',
  );
});

test('an already-booked supplier is repriced, never re-BOOKED, by a chat lock', () => {
  // ⚠ CORRECTED 2026-09-10. This used to be titled "never has their agreed
  // total rewritten", which stopped being true on 2026-09-09: the
  // `refresh_fee_only` branch now DOES reprice the row. What the PLAN still
  // guarantees — and what is pinned here — is that a booked supplier is never
  // re-BOOKED by a chat lock: no status flip, no fee call, no
  // linked_vendor_profile_id, no selection_match_rank. Only the price moves,
  // and the owner ruled on the fee base moving with it.
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
