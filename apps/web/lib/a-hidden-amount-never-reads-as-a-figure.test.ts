/**
 * A HIDDEN AMOUNT NEVER READS AS A FIGURE — #5936, controller audit on PR #7560 (Fix B).
 *
 * `event_vendor_money_read` hands a Suppliers-only delegate every booking with `money_shown: false` and the amounts
 * NULL. The dashboard's Budget tile summed those as 0 and drew a Suppliers-only coordinator "₱2,499 committed so far"
 * when the couple's real figure was ₱152,499. This proves the tile's rule has a HIDDEN state, and that the dashboard
 * draws it as "—" and never prints a peso figure in it.
 *
 * Run (from apps/web): tsx --test lib/a-hidden-amount-never-reads-as-a-figure.test.ts
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import {
  anyBookingAmountHidden,
  budgetTileCommitted,
  COMMITTED_HIDDEN_LINE,
} from './budget-tile-committed';

describe('the Budget tile has three honest states', () => {
  // The audit's world: ₱150,000 of contracted bookings the delegate may not read + a ₱2,499 paid order.
  const hiddenRows = [
    { status: 'contracted', total_cost_php: null, money_shown: false },
    { status: 'deposit_paid', total_cost_php: null, money_shown: false },
  ];
  const ordersOnlyCentavos = 249_900; // what the sum came to with the hidden bookings read as 0

  it('a Suppliers-only delegate: hidden — never the ₱2,499 the orders alone sum to', () => {
    assert.equal(anyBookingAmountHidden(hiddenRows), true);
    const r = budgetTileCommitted({
      vendorsMeasured: true,
      ordersMeasured: true,
      amountsHidden: anyBookingAmountHidden(hiddenRows),
      centavos: ordersOnlyCentavos,
    });
    assert.deepEqual(r, { state: 'hidden' });
    assert.ok(!('centavos' in r), 'a hidden read carries no figure to print');
  });

  it('the host (amounts shown) reads the real figure', () => {
    const shown = hiddenRows.map((r) => ({ ...r, total_cost_php: 75_000, money_shown: true }));
    assert.equal(anyBookingAmountHidden(shown), false);
    assert.deepEqual(
      budgetTileCommitted({ vendorsMeasured: true, ordersMeasured: true, amountsHidden: false, centavos: 15_249_900 }),
      { state: 'measured', centavos: 15_249_900 },
    );
  });

  it('a refused read is "unread", not hidden and not a figure', () => {
    for (const [vendorsMeasured, ordersMeasured] of [[false, true], [true, false]] as const) {
      assert.deepEqual(
        budgetTileCommitted({ vendorsMeasured, ordersMeasured, amountsHidden: true, centavos: 0 }),
        { state: 'unread' },
      );
    }
  });

  it('a row with no money_shown (an admin-client read) is not hidden', () => {
    assert.equal(anyBookingAmountHidden([{}, { money_shown: true }]), false);
    assert.equal(anyBookingAmountHidden([]), false);
  });
});

describe('the dashboard draws the hidden state as "—"', () => {
  const SRC = stripComments(
    readFileSync(path.join(__dirname, '../app/dashboard/[eventId]/_components/event-dashboard.tsx'), 'utf8'),
  );

  it('the tile reads committed through the rule, with the reader\'s money_shown', () => {
    assert.match(SRC, /amountsHidden:\s*anyBookingAmountHidden\(eventVendors\)/);
    assert.match(SRC, /const committedMeasured = committed\.state === 'measured'/);
  });

  it('a hidden committed renders "—" and the hidden line — no formatPeso in that branch', () => {
    const at = SRC.indexOf("committed.state === 'hidden' ? (");
    assert.ok(at > 0, 'the Budget tile has no hidden branch');
    const branch = SRC.slice(at, SRC.indexOf(') : budgetTargetCentavos', at));
    assert.ok(branch.length > 0, 'could not slice the hidden branch');
    assert.match(branch, /data-committed="hidden"/);
    assert.match(branch, /COMMITTED_HIDDEN_LINE/);
    assert.doesNotMatch(branch, /formatPeso|committedCentavos|budgetPct/, 'the hidden branch prints a figure');
    assert.doesNotMatch(COMMITTED_HIDDEN_LINE, /₱|\d/);
  });

  it('the tile still renders for a delegate whose amounts are hidden (so the absence is stated, not silent)', () => {
    assert.match(SRC, /if \(committed\.state === 'hidden' \|\| committedCentavos > 0/);
  });
});
