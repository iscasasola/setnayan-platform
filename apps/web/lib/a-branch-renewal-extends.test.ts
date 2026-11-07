/**
 * A BRANCH RENEWAL EXTENDS ITS WINDOW — IT NEVER RESETS IT.
 *
 * Owner 2026-08-27: *"subscription will only extend their plans for an additional
 * 28 days … or 1 year."* The branch add-on once wrote `now + 28 days` with no read
 * of what the branch already had, so renewing early threw the remaining days away
 * (20 left + a renewal gave 28 from today, not 48).
 *
 * These assertions lived in `custom-plan-term-and-extend.test.ts` until the Custom
 * supplier plan was retired from the app (2026-11-06); the branch half is kept here
 * because the branch add-on is Ultra's and stays.
 *
 * Run: pnpm --filter @setnayan/web test:unit
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { extendedExpiryFrom } from './term-extends';
import { stripComments } from './strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTIVATION = readFileSync(join(HERE, 'sku-activation.ts'), 'utf8');
const DAY = 24 * 60 * 60 * 1000;

test('REGRESSION: a branch renewal EXTENDS its window, it does not reset it', () => {
  const now = Date.parse('2026-08-27T00:00:00.000Z');
  const twentyLeft = now + 20 * DAY;
  assert.equal(
    Date.parse(extendedExpiryFrom(now, twentyLeft, 28)),
    twentyLeft + 28 * DAY,
    'an early branch renewal must ADD 28 days to the 20 remaining, giving 48',
  );
  assert.notEqual(
    Date.parse(extendedExpiryFrom(now, twentyLeft, 28)),
    now + 28 * DAY,
    'the branch window was RESET — the remaining 20 days were discarded',
  );
});

test('a lapsed or brand-new window starts from now — same as GREATEST(now(), …)', () => {
  const now = Date.parse('2026-08-27T00:00:00.000Z');
  assert.equal(Date.parse(extendedExpiryFrom(now, null, 28)), now + 28 * DAY);
  assert.equal(Date.parse(extendedExpiryFrom(now, now - 90 * DAY, 28)), now + 28 * DAY);
});

test('the branch hook reads its prior window before writing a new one', () => {
  // The branch has no expiry column, so the ONLY way to extend is to read the
  // prior paid order. A regression that drops that read resets again, silently.
  const code = stripComments(ACTIVATION);
  const branchBlock = code.slice(code.indexOf('branchIdFromServiceKey(ctx.serviceKey)'));
  assert.match(
    branchBlock.slice(0, 2000),
    /extendedExpiryFrom\(/,
    'the branch hook no longer derives its expiry — it is resetting again',
  );
  assert.ok(
    !/new Date\(Date\.now\(\) \+ 28 \* 24 \* 60 \* 60 \* 1000\)/.test(code),
    'a hard-coded 28-day reset is back in sku-activation.ts',
  );
});
