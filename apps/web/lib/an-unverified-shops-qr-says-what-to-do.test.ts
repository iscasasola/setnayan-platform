/**
 * ✅ AN UNVERIFIED SHOP'S LOCKED QR SAYS WHAT TO DO (supplier gate audit G8, 2026-11-02). `issueLockedQr` made a code
 * for any shop; the couple's scan then hit the verified-booking trigger and was told "Something went wrong". Held:
 *   1 · the issue refuses BEFORE it writes a token, with `not_verified`, and the QR page words it (with the door to
 *       Your documents) — and shows that line instead of the deal form;
 *   2 · the couple's claim maps the trigger's `vendor_not_verified` to its own sentence, never the generic error.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { LOCKED_QR_NEEDS_VERIFIED, LOCKED_QR_SHOP_NOT_VERIFIED } from './vendor-verification';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the issue refuses an unverified shop before any token is written, and the page says what to do', () => {
  const src = read('app/vendor-dashboard/invite/actions.ts');
  const fn = src.slice(src.indexOf('export async function issueLockedQr('));
  const gate = fn.indexOf('isMarketplaceVendorBookable(supabase, vendorProfileId)');
  const write = fn.indexOf(".from('vendor_locked_qr_tokens')");
  assert.ok(gate >= 0 && write > gate, 'issueLockedQr must ask whether the shop is verified before it writes the code');
  assert.match(fn, /isMarketplaceVendorBookable\(supabase, vendorProfileId\)\)\) fail\('not_verified'\)/);

  const page = read('app/vendor-dashboard/invite/page.tsx');
  assert.match(page, /not_verified: LOCKED_QR_NEEDS_VERIFIED/, 'the refusal must have its words, not "Could not make the code"');
  assert.match(page, /if \(!issued && !verified\) \{/, 'an unverified shop is told before it fills the deal form');
  assert.match(page, /\/vendor-dashboard\/profile#docs/, 'and is pointed at Your documents');
  assert.match(LOCKED_QR_NEEDS_VERIFIED, /Your documents/);
});

test('2 · the couple’s scan of an unverified shop’s code is named, not "something went wrong"', () => {
  const src = read('app/vendor/lock/[token]/actions.ts');
  assert.match(src, /\/vendor_not_verified\/\.test\(error\.message \?\? ''\) \? 'not_verified' : 'error'/);
  const page = read('app/vendor/lock/[token]/page.tsx');
  assert.match(page, /not_verified: LOCKED_QR_SHOP_NOT_VERIFIED/);
  assert.ok(LOCKED_QR_SHOP_NOT_VERIFIED.length > 40);
});
