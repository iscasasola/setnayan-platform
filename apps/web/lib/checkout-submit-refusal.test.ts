/**
 * 💸 A RETRY OF A LANDED ORDER IS TOLD SO IN PLAIN WORDS — AND STILL MAKES NO SECOND ORDER.
 *
 * The fault (release d2e38b7): a checkout submit that reached us but lost its
 * answer, sent again, was refused by `orders.reference_code UNIQUE` (correct —
 * that is the double-order guard) and the couple read the database's own
 * sentence. These pin (1) the words, (2) that the words never come from the
 * database, (3) that "already reached us" is said only for the buyer's OWN
 * order, and (4) that the guard which makes the retry safe is still there.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import {
  ORDER_NOT_CREATED,
  PAYMENT_NOT_LOGGED,
  isUniqueRefusal,
  orderAlreadyReceived,
  orderInsertRefusal,
} from './checkout-submit-refusal';

const HERE = dirname(fileURLToPath(import.meta.url));
const ACTION = stripComments(readFileSync(join(HERE, '../app/dashboard/[eventId]/checkout/actions.ts'), 'utf8'));
const DRAWER = stripComments(readFileSync(join(HERE, '../app/dashboard/[eventId]/_components/inline-checkout-drawer.tsx'), 'utf8'));

const RAW = 'duplicate key value violates unique constraint "orders_reference_code_key"';

test('a retry whose first send landed reads "already reached us", with the reference the couple used', () => {
  const line = orderInsertRefusal({ code: '23505' }, true, 'SN1A2B3C4D');
  assert.equal(line, orderAlreadyReceived('SN1A2B3C4D'));
  assert.match(line, /already reached us/);
  assert.match(line, /SN1A2B3C4D/);
  assert.doesNotMatch(line, /duplicate|constraint|violates|key/i);
});

test('a unique refusal on an order that is NOT this buyer\'s is never called theirs', () => {
  assert.equal(orderInsertRefusal({ code: '23505' }, false, 'SN1A2B3C4D'), ORDER_NOT_CREATED);
});

test('any other refusal is a plain try-again line, never the database text', () => {
  for (const err of [{ code: '23514' }, { code: null }, null, undefined]) {
    assert.equal(orderInsertRefusal(err, true, 'SN1A2B3C4D'), ORDER_NOT_CREATED);
  }
  for (const line of [ORDER_NOT_CREATED, PAYMENT_NOT_LOGGED]) {
    assert.doesNotMatch(line, /duplicate|constraint|violates|relation|column/i);
    assert.match(line, /nothing was charged here/);
  }
  assert.ok(isUniqueRefusal({ code: '23505' }) && !isUniqueRefusal({ code: '23503' }) && !isUniqueRefusal(null));
});

test('the submit action never hands a database message to the couple', () => {
  assert.doesNotMatch(ACTION, /reason:\s*orderErr\??\.message/, 'the orders refusal is shown raw again');
  assert.doesNotMatch(ACTION, /reason:\s*paymentErr\??\.message/, 'the payments refusal is shown raw again');
  assert.match(ACTION, /reason:\s*orderInsertRefusal\(orderErr,\s*landedForThisBuyer,\s*referenceCode\)/);
  assert.match(ACTION, /reason:\s*PAYMENT_NOT_LOGGED/);
  assert.ok(!ACTION.includes(RAW));
});

test('"already reached us" is decided by reading THIS buyer\'s order with THIS reference', () => {
  assert.match(
    ACTION,
    /const landedForThisBuyer = isUniqueRefusal\(orderErr\) && \(await orderLandedForBuyer\(moneyWriter, referenceCode, user\.id\)\);/,
    'the "already reached us" line is no longer gated on the unique refusal AND a read of the buyer\'s own order',
  );
  const read = /async function orderLandedForBuyer\([\s\S]*?\n\}/.exec(ACTION)?.[0] ?? '';
  assert.match(read, /\.eq\('reference_code', referenceCode\)/, 'the read is not keyed on the reference that was refused');
  assert.match(read, /\.eq\('user_id', userId\)/, 'the read is not scoped to the signed-in buyer — a stranger\'s order could be described as theirs');
  assert.match(read, /return !landedErr && Boolean\(landed\);/, 'a failed read must claim nothing');
});

test('the double-order guard the retry relies on is still there (no second order can be created)', () => {
  // One reference per drawer open, carried on every send…
  assert.match(DRAWER, /fd\.set\('preminted_reference', referenceCode\)/);
  // …accepted by the action as the order's reference_code, which is UNIQUE in the schema.
  assert.match(ACTION, /formData\.get\('preminted_reference'\)/);
  assert.match(ACTION, /reference_code: referenceCode/);
  const schema = readFileSync(join(HERE, '../../../supabase/migrations/20260513150000_iteration_0034_payments.sql'), 'utf8');
  assert.match(schema, /reference_code\s+TEXT NOT NULL UNIQUE/);
});
