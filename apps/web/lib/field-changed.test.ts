/**
 * 🔒 A7-22 (final check 25 Nov): a save writes a field only when it CHANGED from what the posting form read — so the
 * self-added supplier card can never write a blank address or payment note over one the page did not show.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { fieldChanged } from './field-changed';

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(o)) f.set(k, v);
  return f;
};

test('only the phone changed → the address and the payment note are left out', () => {
  const f = fd({ address_was: '12 Rizal St', payment_method_note_was: 'GCash 0917' });
  assert.equal(fieldChanged(f, 'address_was', '12 Rizal St'), false);
  assert.equal(fieldChanged(f, 'payment_method_note_was', 'GCash 0917'), false);
});

test('a real change is written; clearing a read value is a change', () => {
  const f = fd({ address_was: '12 Rizal St' });
  assert.equal(fieldChanged(f, 'address_was', '14 Rizal St'), true);
  assert.equal(fieldChanged(f, 'address_was', null), true);
});

test('blank and spaces read as none on both sides', () => {
  assert.equal(fieldChanged(fd({ address_was: '  ' }), 'address_was', null), false);
});

test('a form that posts no _was keeps today\'s behaviour (written)', () => {
  assert.equal(fieldChanged(fd({}), 'address_was', '12 Rizal St'), true);
});

test('the save and the card are wired to it', () => {
  const web = process.cwd();
  const act = stripComments(readFileSync(join(web, 'app/dashboard/[eventId]/vendors/[vendorId]/workspace/actions.ts'), 'utf8'));
  assert.match(act, /if \(fieldChanged\(formData, 'address_was', address\.value\)\) update\.address = address\.value;/);
  assert.match(act, /carriesMethodNote && fieldChanged\(formData, 'payment_method_note_was', paymentMethodNote\)/);
  assert.doesNotMatch(act, /const update: Record<string, unknown> = \{\s*address: address\.value,/, 'the address is written unconditionally again');
  const card = stripComments(readFileSync(join(web, 'app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/self-added-contact-card.tsx'), 'utf8'));
  assert.match(card, /fd\.set\('address_was', initialAddress \?\? ''\);/);
  assert.match(card, /fd\.set\('payment_method_note_was', initialPaymentMethodNote \?\? ''\);/);
});
