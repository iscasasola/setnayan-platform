/**
 * 🏷 A SHOP SETNAYAN SET UP CHANGES ITS NAME AND ADDRESS BY REQUEST — owner, verbatim, 2026-10-29: *"the name of her
 * shop is wrong so i want her to be able to send a request shop name change. I want her to create her address and
 * basic shop information … I will create their shop manually on the suppliers"*.
 *
 * Properties:
 *   1 · ONE rule (`identityLockOf`): a shop an admin pre-created for someone else may FILL a blank name/address but
 *       not overwrite a filled one; verified is unchanged (every identity field); a self-opened shop is unchanged
 *       (only the web address); the owner's own admin-made shop is not "set up by Setnayan";
 *   2 · the server refuses through that rule — the inline save asks `identityLockRefusal`, before any write;
 *   3 · the REQUEST is the shipped door (`requestProfileCorrection` → `vendor_correction_requests` →
 *       /admin/corrections) — no second request table, no second writer;
 *   4 · the screen says the same thing the server does: a request-only row is "Ask to change", a waiting one
 *       "Change asked · waiting", and the ask card offers exactly the rule's fields.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import {
  ADMIN_SET_UP_LOCK_ERROR,
  LOCKED_IDENTITY_FIELD_KEYS,
  VERIFIED_LOCK_ERROR,
  identityLockOf,
  identityLockRefusal,
  rowAsks,
} from './vendor-corrections';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const ADMIN = 'admin-uid';
const HER = 'her-uid';
const setUp = (over: Record<string, unknown> = {}) =>
  identityLockOf({
    public_visibility: 'coming_soon',
    created_by_admin_user_id: ADMIN,
    user_id: HER,
    business_name: 'Wrong Name Styling',
    hq_address: null,
    ...over,
  });

test('1 · a shop Setnayan set up: the name it typed asks; the blank address is hers to create', () => {
  const lock = setUp();
  assert.equal(lock.setUpBySetnayan, true);
  assert.deepEqual(lock.requestOnly, ['business_slug', 'business_name']);
  assert.equal(identityLockRefusal(lock, 'business_name'), ADMIN_SET_UP_LOCK_ERROR);
  assert.equal(identityLockRefusal(lock, 'maps_pin'), null, 'she must be able to CREATE her address');
  // Once the address is there, it asks too.
  const withAddress = setUp({ hq_address: '12 Mabini St, Quezon City' });
  assert.deepEqual(withAddress.requestOnly, ['business_slug', 'business_name', 'hq_address']);
  assert.equal(identityLockRefusal(withAddress, 'maps_pin'), ADMIN_SET_UP_LOCK_ERROR);
  // Everything else on the basic setup stays hers to fill in place.
  for (const f of ['business_owner_name', 'contact_phone', 'contact_email', 'in_business_since_year', 'logo']) {
    assert.equal(identityLockRefusal(withAddress, f), null, `${f} is refused on a set-up shop`);
  }
});

test('1 · a blank name on a set-up shop is hers to fill (never a dead row)', () => {
  assert.equal(identityLockRefusal(setUp({ business_name: '  ' }), 'business_name'), null);
});

test('1 · unchanged: a verified shop locks every identity field; a self-opened shop locks only its web address', () => {
  const verified = identityLockOf({ public_visibility: 'verified', created_by_admin_user_id: null, user_id: HER, business_name: 'X', hq_address: 'Y' });
  assert.deepEqual(verified.requestOnly, [...LOCKED_IDENTITY_FIELD_KEYS]);
  assert.equal(identityLockRefusal(verified, 'business_name'), VERIFIED_LOCK_ERROR);
  assert.equal(identityLockRefusal(verified, 'contact_phone'), VERIFIED_LOCK_ERROR);
  const own = identityLockOf({ public_visibility: 'coming_soon', created_by_admin_user_id: null, user_id: HER, business_name: 'X', hq_address: 'Y' });
  assert.equal(own.setUpBySetnayan, false);
  assert.deepEqual(own.requestOnly, ['business_slug']);
  assert.equal(identityLockRefusal(own, 'business_name'), null);
  assert.equal(identityLockRefusal(own, 'maps_pin'), null);
  // The owner's own admin-made shop (created_by = its owner) is not "set up by Setnayan" for anybody else.
  const mine = identityLockOf({ public_visibility: 'coming_soon', created_by_admin_user_id: HER, user_id: HER, business_name: 'X', hq_address: 'Y' });
  assert.equal(mine.setUpBySetnayan, false);
  assert.equal(identityLockRefusal(mine, 'business_name'), null);
  // A refused read (null row) locks nothing — the shipped defensive behaviour.
  assert.deepEqual(identityLockOf(null).requestOnly, ['business_slug']);
});

test('4 · the rows: a FILLED request-only row asks; once asked it waits; a blank one is a normal row', () => {
  const asks = { requestOnly: setUp().requestOnly, pending: [] as string[] };
  assert.equal(rowAsks('business_name', true, asks), 'ask');
  assert.equal(rowAsks('business_name', true, { ...asks, pending: ['business_name'] }), 'pending');
  assert.equal(rowAsks('business_name', false, asks), null, 'a blank name must stay fillable');
  assert.equal(rowAsks('maps_pin', true, asks), null, 'an address not on the list stays editable');
  assert.equal(rowAsks('contact_phone', true, asks), null);
  assert.equal(rowAsks('business_name', true, undefined), null, 'absent → every row as it was');
});

test('2 · the inline save refuses through the ONE rule, before any write', () => {
  const actions = src('app/vendor-dashboard/actions.ts');
  const fn = actions.slice(actions.indexOf('export async function updateVendorProfileField'));
  const refuseAt = fn.indexOf('identityLockRefusal(await fetchIdentityLock(supabase, shopId), field)');
  const switchAt = fn.indexOf('switch (field)');
  assert.ok(refuseAt > 0, 'the inline save no longer asks the shared rule');
  assert.ok(refuseAt < switchAt, 'the rule is asked after the patch is built');
  assert.match(fn.slice(refuseAt - 200, refuseAt + 200), /if \(refusal\) return \{ ok: false, error: refusal \};/);
  // The lock is read as the supplier through the self view — `created_by_admin_user_id` is off the table's allowlist.
  const lib = src('lib/vendor-corrections.ts');
  assert.match(lib, /\.from\('vendor_profiles_self'\)\s*\.select\('public_visibility, created_by_admin_user_id, user_id, business_name, hq_address'\)/);
  assert.match(src('lib/vendor-profile.ts'), /public_visibility,created_by_admin_user_id,/, 'the shop read no longer carries who set it up');
});

test('3 · the request is the SHIPPED door — the same action, table and admin queue', () => {
  const card = src('app/vendor-dashboard/shop/_components/request-correction-card.tsx');
  assert.match(card, /await requestProfileCorrection\(null, fd\)/);
  assert.match(card, /OTHER_LOCKED\.filter\(\(f\) => requestOnly\.includes\(f\)\)/, 'the card offers something other than the rule’s list');
  const actions = src('app/vendor-dashboard/actions.ts');
  const ask = actions.slice(actions.indexOf('export async function requestProfileCorrection'));
  assert.match(ask, /\.from\('vendor_correction_requests'\)\.insert\(/);
  // No second request table / action anywhere in the supplier tree.
  assert.doesNotMatch(src('lib/vendor-corrections.ts'), /\.insert\(/, 'the lock module grew a writer');
});

test('4 · Your details and Today’s setup both hand the rows the rule and the waiting asks', () => {
  const details = src('app/vendor-dashboard/profile/_components/details-screen.tsx');
  assert.match(details, /const asks = \{ requestOnly: d\.requestOnly, pending: d\.openCorrections\.map\(\(r\) => r\.field_key\) \};/);
  assert.equal([...details.matchAll(/asks=\{asks\}/g)].length, 4, 'a Your details fold draws name/address rows without the rule');
  assert.match(details, /requestOnly=\{d\.requestOnly\}/);
  const setup = src('app/vendor-dashboard/_components/supplier-setup-screen.tsx');
  assert.match(setup, /asks=\{d\.requestOnly \? \{ requestOnly: d\.requestOnly, pending: \(d\.openCorrections \?\? \[\]\)\.map\(\(r\) => r\.field_key\) \} : undefined\}/);
  const data = src('app/vendor-dashboard/profile/details-data.ts');
  assert.match(data, /const lock = identityLockOf\(profile\);/);
  assert.match(data, /requestOnly: lock\.requestOnly,/);
  const editor = src('app/vendor-dashboard/shop/_components/profile-checklist-editor.tsx');
  assert.match(editor, /rowAsks\(item\.key, item\.ok, asks\) \? \(\s*<RequestOnlyRow/);
  const row = src('app/vendor-dashboard/shop/_components/editable-row.tsx');
  assert.match(row, /href="\/vendor-dashboard\/profile#fix"/, 'Ask to change goes somewhere other than the ask card');
  assert.match(row, /Change asked · waiting/);
});
