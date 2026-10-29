/**
 * A REFUSED PAYMENT PLAN IS SEEN, AND AN EMPTY AMOUNT NEVER LOOKS FILLED.
 * (measured 2026-10-29 on a real ₱395,000 stylist booking)
 *
 * The couple typed ₱10,000 + ₱197,000 and left the Balance row's amount EMPTY.
 * Its placeholder read "50" beside a "%" picker, so it looked like 50 %. The
 * server refused the plan (`buildCouplePaymentPlan`) and the sheet stayed
 * open with the reason — but the reason was drawn in the scroll, under the
 * plan, the heads-up and the link block, out of sight. The couple asked
 * "did this work?". The refusal reached the DOM and never reached their eyes.
 *
 * Three promises, each held here:
 *  1. the alert is drawn INSIDE the pinned footer, beside Save;
 *  2. the amount placeholder is never a bare number;
 *  3. the plan's total line names what is left (or over), not only two figures.
 *
 * ⚠ ANCHORED: each check first proves its anchor exists, so a rename cannot
 * leave it passing over nothing.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MODAL = readFileSync(path.join(HERE, 'new-manual-vendor-modal.tsx'), 'utf8');
const ROWS = readFileSync(path.join(HERE, 'payment-plan-rows.tsx'), 'utf8');

describe('a refused plan is seen', () => {
  it('draws the save refusal inside the pinned footer, beside Save', () => {
    const footerAt = MODAL.indexOf('className="sticky bottom-0');
    const alertAt = MODAL.indexOf('role="alert"');
    const saveAt = MODAL.indexOf("'Save changes'");
    assert.ok(footerAt > -1, 'anchor lost: the pinned footer');
    assert.ok(alertAt > -1, 'anchor lost: the role="alert" refusal');
    assert.ok(saveAt > -1, 'anchor lost: the Save changes label');
    assert.ok(
      alertAt > footerAt && alertAt < saveAt,
      'the save refusal is no longer inside the pinned footer — a couple who ' +
        'presses Save mid-plan cannot see why it did not save.',
    );
  });
});

describe('an empty amount never looks filled', () => {
  it('the amount placeholder is not a bare number', () => {
    const input = /name="plan_value"[\s\S]*?\/>/.exec(ROWS)?.[0];
    assert.ok(input, 'anchor lost: the plan_value input');
    const ph = /placeholder="([^"]*)"/.exec(input)?.[1];
    assert.ok(ph !== undefined, 'anchor lost: the plan_value placeholder');
    assert.doesNotMatch(
      ph,
      /^\s*[\d.,%₱\s]+\s*$/,
      `the amount placeholder "${ph}" reads like a typed value — an empty row looks filled.`,
    );
  });

  it('the total line says what is left or over', () => {
    assert.match(ROWS, /left`/, 'the total no longer names what is left to schedule');
    assert.match(ROWS, /over`/, 'the total no longer names how far over the price it is');
  });
});
