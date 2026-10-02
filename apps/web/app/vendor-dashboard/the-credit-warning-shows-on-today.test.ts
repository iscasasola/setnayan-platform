/**
 * ⏳ THE CREDIT WARNING SHOWS ON TODAY (owner 2026-10-02, tracker d5: "warn a
 * supplier 7 days before a balance expires — one notice on their Today page +
 * email").
 *
 * The email + tray half ships already (`maybeSweepVendorCreditWarnings`, once
 * per term, `credit-warning-emails.test.ts` holds the allowlist). This pins the
 * Today half: the same rule, the same window, the same words, on the page.
 *
 * SABOTAGE (run 2026-10-02): deleting the `{creditNotice ? (` block from
 * page.tsx turns test 3 red ("Today does not draw the credit warning").
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CREDIT_WARNING_WINDOW_DAYS, creditWarningCopy, todayCreditNotice } from '@/lib/vendor-credit-warning';
import { stripComments } from '@/lib/strip-comments';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-10-02T04:00:00Z');
const at = (days: number) => new Date(NOW + days * DAY).toISOString();

test('1 · seven days, the same window as the email', () => {
  assert.equal(CREDIT_WARNING_WINDOW_DAYS, 7);
  assert.ok(todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(7) }, NOW), 'day 7 is inside');
  assert.ok(todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(1) }, NOW), 'day 1 is inside');
  assert.equal(todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(7.5) }, NOW), null, 'too early');
  assert.equal(todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(-1) }, NOW), null, 'already gone — not "about to"');
  assert.equal(todayCreditNotice({ creditPhp: 0, tierExpiresAt: at(3) }, NOW), null, 'no balance, nothing to say');
  assert.equal(todayCreditNotice({ creditPhp: 2500, tierExpiresAt: null }, NOW), null, 'nothing ends');
});

test('2 · the same words as the email, and a way to act', () => {
  const n = todayCreditNotice({ creditPhp: 2500, tierExpiresAt: at(3) }, NOW)!;
  const copy = creditWarningCopy({ creditPhp: 2500, tierExpiresAt: at(3) });
  assert.equal(n.title, copy.title);
  assert.equal(n.body, copy.body);
  assert.equal(n.href, '/vendor-dashboard/subscription');
  assert.ok(!/vendor/i.test(n.title + n.body), 'the words say "vendor"');
});

test('3 · Today reads the two columns on their own and draws the notice', () => {
  const page = stripComments(readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8'));
  assert.match(page, /\.select\('subscription_credit_php, tier_expires_at'\)/, 'the credit read is folded into another select');
  assert.match(page, /todayCreditNotice\(/);
  assert.match(page, /\{creditNotice \? \(/, 'Today does not draw the credit warning');
  assert.match(page, /if \(creditErr\) console\.error/, 'a failed read is silent');
});
