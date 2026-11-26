/**
 * Final check 25 Nov, area 8, A8·A-1: approving a payment whose own row can't be read is refused ("couldn't check")
 * and approves nothing. Before the fix the read's error was dropped, `mine` was null, the whole duplicate-reference
 * check was skipped, and the row was flipped to `matched`. Reverting the fix fails this test.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const here = dirname(fileURLToPath(import.meta.url));
const src = stripComments(readFileSync(resolve(here, 'actions.ts'), 'utf8'));
const start = src.indexOf('export async function approvePaymentCore(');
const body = src.slice(start, src.indexOf('\nexport ', start + 10));

test('A-1 · the payment row read binds its error', () => {
  assert.ok(start >= 0, 'approvePaymentCore exists');
  assert.match(
    body,
    /const \{ data: me, error: meErr \} = await admin\s*\.from\('payments'\)\s*\.select\('order_id, reference_number'\)/,
    'the read of the payment’s own row must keep its error',
  );
});

test('A-1 · a refused read refuses the approval before the row is used or flipped', () => {
  const check = body.search(/if \(meErr\) \{\s*return \{\s*ok: false,\s*duplicate: true,\s*blocking: true,/);
  assert.ok(check >= 0, 'an unread row returns a blocking refusal');
  assert.ok(check < body.indexOf('const mine'), 'before `mine` can be null and skip the duplicate check');
  const flip = body.indexOf("status: 'matched'");
  assert.ok(flip < 0 || check < flip, 'before anything is approved');
  assert.match(body.slice(check, check + 400), /Couldn’t check this payment/, 'the admin is told it could not check');
});
