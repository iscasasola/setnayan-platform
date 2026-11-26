/**
 * Final check 25 Nov, area 6, batch 1 — the claims the controller asked to see held (each fails if its fix is reverted).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { revalidateContractViews } from '@/lib/contract-views';
import { batchOrUnread, readWaivedForPage } from '@/lib/booking-fees-page-reads';
import { routes } from '@/lib/routes';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '../..', rel), 'utf8'));
const UNREADABLE = Symbol('unreadable');

test('A6-65 · none of the three pages sends a signed-out person to a bare /login', () => {
  for (const page of [
    'app/vendor-dashboard/contracts/[contractId]/page.tsx',
    'app/vendor-dashboard/contracts/new/page.tsx',
    'app/vendor-dashboard/disputes/page.tsx',
  ]) {
    const src = read(page);
    assert.doesNotMatch(src, /redirect\(\s*['"`]\/login['"`]\s*\)/, `${page} still has a bare redirect('/login')`);
    assert.match(src, /redirect\(\s*loginRedirectPath\(/, `${page} does not return the person to where they were`);
  }
});

test('A6-65 · the upload page’s return keeps the couple it was opened for (?event=)', () => {
  assert.match(read('app/vendor-dashboard/contracts/new/page.tsx'), /`\/vendor-dashboard\/contracts\/new\?event=\$\{encodeURIComponent\(prefillEventId\)\}`/);
});

test('A6-66 · publish/cancel re-draw the contract, Clients, and the couple’s Contracts, contract and Documents pages', () => {
  const seen: string[] = [];
  revalidateContractViews((p) => seen.push(p), 'c-1', 'e-1');
  assert.deepEqual(seen, [
    '/vendor-dashboard/contracts/c-1',
    '/vendor-dashboard/customers',
    routes.dashboard.contracts.index('e-1'),
    routes.dashboard.contracts.detail('e-1', 'c-1'),
    routes.dashboard.documents('e-1'),
  ]);
  assert.ok(!seen.includes('/vendor-dashboard/contracts'), 'the forward stub is not the list');
  const actions = read('app/vendor-dashboard/contracts/actions.ts');
  assert.equal((actions.match(/revalidateContractViews\(revalidatePath, contractId, row\.event_id\)/g) ?? []).length, 2);
});

test('A6-59 · an unread shop profile gives waived = null (said), never [] (silent)', async () => {
  let asked = false;
  const out = await readWaivedForPage(null, true, async () => ((asked = true), []), UNREADABLE);
  assert.equal(out, null);
  assert.equal(asked, false, 'no read is made for a shop that could not be read');
  assert.equal(await readWaivedForPage('vp-1', true, async () => UNREADABLE, UNREADABLE), null);
  assert.equal(await readWaivedForPage('vp-1', true, async () => { throw new Error('refused'); }, UNREADABLE), null);
  assert.deepEqual(await readWaivedForPage('vp-1', true, async () => [{ id: 1 }], UNREADABLE), [{ id: 1 }]);
  assert.deepEqual(await readWaivedForPage(null, false, async () => [], UNREADABLE), [], 'fee system dark: nothing to list');
  const page = read('app/vendor-dashboard/booking-fees/page.tsx');
  assert.match(page, /\(await readWaivedForPage\([\s\S]*?\)\) \?\? FEE_BILLS_UNREADABLE/);
  assert.match(page, /waived=\{waivedRead === FEE_BILLS_UNREADABLE \? null : waived\}/);
});

test('A6-60 · a rejecting fetchPaymentsForOrder gives BookingFeeReadFailed, never the error screen', async () => {
  let logged = false;
  const out = await batchOrUnread(() => Promise.all([Promise.reject(new Error('fetchPaymentsForOrder failed: refused')), Promise.resolve(1)]), () => (logged = true));
  assert.equal(out, null);
  assert.equal(logged, true);
  const src = read('app/vendor-dashboard/booking-fees/[orderId]/page.tsx');
  assert.match(src, /const batch = await batchOrUnread\(\s*\(\) =>\s*Promise\.all\(\[\s*fetchPaymentsForOrder\(supabase, orderId\)/);
  assert.match(src, /if \(!batch\) return <BookingFeeReadFailed orderId=\{orderId\} \/>/);
});

test('A6-B13 · some couples unnamed is said on the upload page, not a shorter list that reads as whole', () => {
  const page = read('app/vendor-dashboard/contracts/new/page.tsx');
  assert.match(page, /const someCouplesUnread = threadsMeasured && facts\.size < threadEventIds\.length/);
  assert.match(page, /someCouplesUnread=\{someCouplesUnread\}/);
  assert.match(read('app/vendor-dashboard/contracts/new/upload-body.tsx'), /someCouplesUnread \? \(\s*<ReadFailedNote mark="contract-some-couples">/);
});

test('A6-61(c) · the bill’s own charge row is read ONCE, its failure logged', () => {
  const src = readFileSync(join(__dirname, 'booking-fees/[orderId]/page.tsx'), 'utf8');
  assert.equal((src.match(/\.from\('booking_fee_charges'\)/g) ?? []).length, 1, 'booking_fee_charges is read more than once');
  assert.match(src, /\.select\('event_id, vendor_profile_id, kind, expires_at'\)/);
  assert.match(src, /if \(chargeErr\) logQueryError\(/);
});
