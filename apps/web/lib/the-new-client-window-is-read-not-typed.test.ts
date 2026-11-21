/**
 * THE NEW-CLIENT FREE WINDOW IS READ, NEVER TYPED — and named only in the supplier's own app.
 *
 *   · specs DECISION_LOG 2026-11-16 "IMPORTED CLIENTS: A NEW ACCOUNT IS FREE FOR ONE YEAR WITH THAT SUPPLIER" — the
 *     window is 12 months from the import; it lives in `platform_settings.booking_fee_new_client_free_months`
 *     (migration 20271356623783) and reaches the app as the schedule's `newClientFreeMonths`.
 *   · 2026-11-19 "PROMOTION PAGES" (4) — "No number of months is named on any page": the public words name none.
 *
 * The SQL half (and the SQL ↔ TypeScript instants) is `tests/db/the-new-client-free-window-is-a-setting.db.test.ts`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FEE_FREE_CHIP,
  FEE_FREE_RULE,
  FEE_FREE_RULE_THIRD,
  FEE_FREE_RULE_TL,
  FEE_NEW_CLIENT_DETAIL,
  FEE_SCOPE,
  FEE_SCOPE_THIRD,
  feeFreeRuleInApp,
  feeNewClientLine,
} from './booking-fee-who-words';
import { BOOKING_FEE } from './booking-fee';
import { newClientWindowCovers } from './booking-fee-lock';
import { bookingFeeForecast } from './booking-fee-disclosure';

const ROOT = join(__dirname, '..');
const read = (p: string) => readFileSync(join(ROOT, p), 'utf8');
const DURATION = /\b(a|one|isang|\d+)\s+(years?|months?|taon|buwan)\b/i;

test('the public words name no length (PROMOTION PAGES (4))', () => {
  for (const [name, words] of Object.entries({
    FEE_FREE_RULE,
    FEE_FREE_RULE_TL,
    FEE_FREE_RULE_THIRD,
    FEE_SCOPE,
    FEE_SCOPE_THIRD,
    FEE_FREE_CHIP,
    FEE_NEW_CLIENT_DETAIL,
  })) {
    assert.doesNotMatch(words, DURATION, `${name} names a length: ${words}`);
  }
  // The owner's words, verbatim (19 Nov PROMOTION PAGES (4)).
  assert.ok(FEE_FREE_RULE.startsWith("New to Setnayan, or you're the first to bring their event? They book you free."));
});

test('the in-app words name the months they are handed — and none when the read failed', () => {
  assert.equal(feeNewClientLine(12), 'New to Setnayan through you? They book you free for 12 months.');
  assert.match(feeNewClientLine(1) ?? '', /for 1 month\.$/);
  for (const bad of [null, undefined, 0, -3, 1.5, Number.NaN]) {
    assert.equal(feeNewClientLine(bad as number), null, `months=${String(bad)}`);
    assert.equal(feeFreeRuleInApp(bad as number), FEE_FREE_RULE, `months=${String(bad)} fell back to a guessed length`);
  }
  assert.match(feeFreeRuleInApp(12), /free for 12 months\./);
  assert.match(feeFreeRuleInApp(7), /free for 7 months\./, 'the length is the setting’s, not a constant');
  // ≤ 12 words for the visible line (BUILD_RULES §2 "lines of 12 words or fewer").
  assert.ok((feeNewClientLine(12) ?? '').split(/\s+/).length <= 12);
});

test('no month count is typed into the words, the schedule default or the settings reader', () => {
  const words = read('lib/booking-fee-who-words.ts').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
  assert.doesNotMatch(words, /\b\d+\s+months?\b/, 'a number of months is typed into the words');
  assert.equal('newClientFreeMonths' in BOOKING_FEE, false, 'the code default carries a window length');
  const reader = read('lib/booking-fee-settings.server.ts');
  assert.match(reader, /booking_fee_new_client_free_months/, 'the settings read does not ask for the window');
});

test('the fee notice before Agree names the window in the supplier’s app, from the standing', () => {
  const withMonths = bookingFeeForecast({ kind: 'not_sourced', newClientFreeMonths: 12 }, 100_000);
  assert.ok(withMonths && withMonths.detail.includes('free for 12 months'), withMonths?.detail);
  const unread = bookingFeeForecast({ kind: 'not_sourced' }, 100_000);
  assert.ok(unread && unread.detail.includes(FEE_FREE_RULE) && !DURATION.test(unread.detail), unread?.detail);
  const server = read('lib/booking-fee-disclosure.server.ts');
  assert.match(server, /kind: 'not_sourced', newClientFreeMonths: months/, 'the standing does not carry the read length');
});

test('the Booking fees page shows the window line from the live schedule', () => {
  const page = read('app/vendor-dashboard/booking-fees/page.tsx');
  assert.match(page, /feeNewClientLine\(feeSchedule\?\.newClientFreeMonths\)/);
  assert.match(page, /freeRule=\{feeFreeRuleInApp\(feeSchedule\?\.newClientFreeMonths\)\}/);
});

test('newClientWindowCovers — strictly inside N calendar months; at N, after, or unread → the fee', () => {
  const at = '2027-11-20T08:00:00Z';
  assert.equal(newClientWindowCovers('2026-11-20T08:00:01Z', at, 12), true, 'a second inside');
  assert.equal(newClientWindowCovers('2026-11-20T08:00:00Z', at, 12), false, 'exactly 12 months');
  assert.equal(newClientWindowCovers('2026-11-20T07:59:59Z', at, 12), false, 'a second after');
  // 31 Aug − 6 months clamps to 28 Feb (as Postgres): an import on 28 Feb is exactly 6 months, 1 Mar is inside.
  assert.equal(newClientWindowCovers('2026-02-28T00:00:00Z', '2026-08-31T00:00:00Z', 6), false, 'clamped month end, exactly');
  assert.equal(newClientWindowCovers('2026-03-01T00:00:00Z', '2026-08-31T00:00:00Z', 6), true);
  assert.equal(newClientWindowCovers(null, at, 12), false);
  assert.equal(newClientWindowCovers('2027-11-01T00:00:00Z', at, null), false);
  assert.equal(newClientWindowCovers('2027-11-01T00:00:00Z', at, 0), false);
  assert.equal(newClientWindowCovers('nonsense', at, 12), false);
});
