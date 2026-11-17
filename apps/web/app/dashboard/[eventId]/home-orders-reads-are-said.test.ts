/**
 * Home's orders reads are measured, and a refusal is SAID (couple-dashboard audit, 2026-11-17).
 *
 * `event-dashboard.tsx` read paid and pending orders with `?? []` and never looked at the pending read's error:
 * a refusal dropped the "Settle a payment" row silently (the board could then say "Nothing needs a decision"),
 * and "Your services" said "0 orders · Nothing ordered yet" to a couple who had paid. Pinned in comment-free
 * source because the component is `server-only`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '_components/event-dashboard.tsx'), 'utf8'));

test('the pending-orders read is measured', () => {
  assert.match(src, /pendingOrdersMeasured\s*=\s*!pendingOrdersRes\.error/);
  assert.match(src, /servicesMeasured\s*=\s*ordersMeasured\s*&&\s*pendingOrdersMeasured/);
});

test('"Your services" never counts or empties an unmeasured list', () => {
  assert.match(src, /servicesMeasured \? `\$\{serviceRows\.length\}/, 'the badge prints a count it did not take');
  assert.match(src, /serviceRows\.length > 0 \? null : !servicesMeasured \?/, 'the empty copy shows over a refused read');
});

test('the board never says "nothing needs a decision" over a refused payments read', () => {
  assert.match(src, /\) : paymentsUnread \? null : \(\s*<div className="sn-tile text-sm text-ink\/55">\s*Nothing needs a decision/);
  assert.match(src, /data-home-payments-unread=""/);
  assert.doesNotMatch(src, /id: 'pay:unread'/, 'a couldn’t-load row is counted into "N open decisions"');
});
