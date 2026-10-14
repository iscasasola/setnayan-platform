/**
 * the-yes-says-what-the-couple-heard.test.ts — AFTER AGREE, THE SUPPLIER IS TOLD WHAT THE COUPLE WAS ACTUALLY TOLD.
 *
 * Batch-5 supplier-needs audit (`SUPPLIER_NEEDS_CHECKLIST_2026-10-14.md` § B, F9, 2026-10-14): after Agree the
 * supplier always read "The couple has been told…" — but when the yes leaves a BILLED, UNPAID booking fee,
 * `vendorAgreeToLock` HOLDS the couple's "said yes" / "your booking is confirmed" back until the fee settles
 * (#6511, owner 2026-10-07). The sentence was false, and the supplier was never told that paying the fee is what
 * lets the couple know.
 *
 * ONE SOURCE: `feeBilledUnpaid` — the value the hold reads — also writes the redirect's `&fee=held`, and the three
 * pages that say the answer pass it back to `lockAgreeNotice`.
 *
 * SABOTAGE (2026-10-14): the redirect's `fee` flag no longer reads `feeBilledUnpaid` → test 2 RED; the `ok`
 * sentence ignores `feeHeld` → test 1 RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';
import { LOCK_AGREE_FEE_HELD, lockAgreeFeeHeld, lockAgreeNotice } from './lock-answer-notice';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string) => stripComments(readFileSync(resolve(WEB, rel), 'utf8'));

test('1 · a held-back yes says so and names the fee as the way to tell the couple; a told yes says it was told', () => {
  const held = lockAgreeNotice('ok', { feeHeld: true })!;
  assert.equal(held.tone, 'ok');
  assert.doesNotMatch(held.text, /has been told/i, 'the supplier is told the couple knows while the news is held back');
  assert.match(held.text, /Pay the booking fee/);
  assert.match(held.text, /tell the couple their booking is confirmed/);
  assert.deepEqual(held.door, { label: 'Pay the booking fee', href: '/vendor-dashboard/booking-fees' });
  for (const told of [lockAgreeNotice('ok', { feeHeld: false })!, lockAgreeNotice('ok')!]) {
    assert.match(told.text, /The couple has been told/);
    assert.equal(told.door, undefined);
  }
  assert.equal(lockAgreeFeeHeld(LOCK_AGREE_FEE_HELD), true);
  for (const other of [undefined, null, '', 'HELD', 'paid', ['held']]) assert.equal(lockAgreeFeeHeld(other), false);
});

test('2 · the redirect’s flag IS the hold: written from `feeBilledUnpaid`, the value that holds the couple’s news back', () => {
  const a = src('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const start = a.indexOf('export async function vendorAgreeToLock');
  const body = a.slice(start, a.indexOf('\n}\n', start));
  assert.ok(body.length > 500, 'vendorAgreeToLock moved — re-anchor, do not drop');
  // The hold: one variable, set only from the mint's answer, and it gates both pieces of couple news.
  assert.match(body, /let feeBilledUnpaid = false;/);
  assert.equal((body.match(/(?<!let )feeBilledUnpaid = /g) ?? []).length, 1, 'the hold is decided in more than one place');
  assert.match(body, /feeBilledUnpaid = mintLeftAnUnpaidBill\(mint\.fee\?\.status\);/);
  assert.match(body, /if \(feeBilledUnpaid\) \{/, 'the couple’s "said yes" is no longer held by it');
  assert.match(body, /feeBilledUnpaid \? \{ emit: async \(\) => \{\} \} : undefined/, 'the "booking confirmed" notice is no longer held by it');
  // …and the supplier's sentence reads the SAME value.
  assert.match(body, /const feeHeld = flag === 'ok' && feeBilledUnpaid \? `&fee=\$\{LOCK_AGREE_FEE_HELD\}` : '';/);
  assert.match(body, /redirect\(`\$\{back\}\?lock_agree=\$\{flag\}\$\{competing\}\$\{feeHeld\}`\);/);
});

test('3 · every page that says the answer reads the flag back (Today · the customer card · the thread); the thread draws the Pay door', () => {
  const readers: Record<string, RegExp> = {
    'app/vendor-dashboard/page.tsx': /feeHeld: lockAgreeFeeHeld\(search\.fee\)/,
    'app/vendor-dashboard/clients/[eventId]/page.tsx': /feeHeld: lockAgreeFeeHeld\(search\.fee\)/,
    'app/vendor-dashboard/messages/[threadId]/page.tsx': /feeHeld: lockAgreeFeeHeld\(sp\?\.fee\)/,
  };
  for (const [rel, re] of Object.entries(readers)) assert.match(src(rel), re, `${rel} says "the couple has been told" without asking whether it was`);
  assert.match(src('app/vendor-dashboard/messages/[threadId]/page.tsx'), /lockAnswer\.door \?[\s\S]{0,200}href=\{lockAnswer\.door\.href\}/);
  // Today and the card draw the new bill with its own Pay right there (`BookingFeeBills`).
  assert.match(src('app/vendor-dashboard/page.tsx'), /<BookingFeeBills/);
  assert.match(src('app/vendor-dashboard/clients/[eventId]/page.tsx'), /<BookingFeeBills/);
});
