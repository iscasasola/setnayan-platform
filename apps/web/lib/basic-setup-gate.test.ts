/**
 * 🧰 BASIC SETUP FIRST — owner, verbatim, 2026-10-29: *"we want them to complete the basic setup of their shop. Which
 * is a must before they can do anything."* — and the exceptions he named the same night: a coordinator must still run
 * the event ("fully access the event hub. Create schedules. Check guestlist, fix seat plan"), and nothing is a dead end.
 *
 * Properties:
 *   1 · ONE rule (`pageIsHeld` over `basicSetupHoldOf`): the shop pages are held while the shipped
 *       `businessProfileChecklist` is incomplete; Today, Your details, documents, Events you run, chat, the account and
 *       the page where a missing step is DONE stay open; the event itself (`/dashboard/<id>`) is never held;
 *   2 · who: an unverified shop's owner/admin only — a helper, a verified shop, an unread row are never held;
 *   3 · ONE place: the supplier layout decides once from the row it already read, wraps ONLY the page body (the top
 *       bar with sign-out and the bottom bar stay), and no page carries its own copy.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from './strip-comments';
import { BASIC_SETUP_HOME, OPEN_WHILE_SETTING_UP, basicSetupHoldOf, basicSetupLine, pageIsHeld } from './basic-setup-gate';
import { businessProfileChecklist, type VendorProfileRow } from './vendor-profile';

const WEB = join(import.meta.dirname, '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const shop = (over: Partial<VendorProfileRow> = {}): VendorProfileRow =>
  ({
    vendor_profile_id: 'v1',
    business_name: 'Glam by Ana',
    logo_url: 'r2://logo.png',
    business_owner_name: 'Ana Cruz',
    hq_address: '12 Mabini St, Quezon City',
    contact_phone: '+639171234567',
    contact_email: 'ana@example.com',
    in_business_since_year: 2019,
    services: ['hair_makeup'],
    ...over,
  }) as VendorProfileRow;

const holdFor = (row: VendorProfileRow, over: Partial<Parameters<typeof basicSetupHoldOf>[0]> = {}) =>
  basicSetupHoldOf({ measured: true, canManage: true, verified: false, checklist: businessProfileChecklist(row), ...over });

const NO_ADDRESS = holdFor(shop({ hq_address: null, logo_url: null }));

test('1 · an incomplete shop is held on the shop pages — services, the shop page, money', () => {
  assert.ok(NO_ADDRESS, 'an incomplete shop is not held');
  assert.deepEqual(NO_ADDRESS!.missing, ['logo', 'maps_pin']);
  for (const p of [
    '/vendor-dashboard/shop',
    '/vendor-dashboard/services/abc',
    '/vendor-dashboard/website',
    '/vendor-dashboard/payday',
    '/vendor-dashboard/earnings',
    '/vendor-dashboard/calendar',
    '/vendor-dashboard/on-the-day',
    '/vendor-dashboard/clients/e-1',
  ]) {
    assert.equal(pageIsHeld(p, NO_ADDRESS), true, `${p} is not held`);
  }
  assert.equal(pageIsHeld('/vendor-dashboard/customers', NO_ADDRESS, 'money'), true, 'Money is not held');
  assert.equal(basicSetupLine(NO_ADDRESS!), 'Left: Logo · Company address.');
});

test('1 · 🔑 the exceptions stay open — the setup itself, the events she runs, chat, the account', () => {
  const open = [
    BASIC_SETUP_HOME, // Today — the six steps
    `${BASIC_SETUP_HOME}/`,
    '/vendor-dashboard/profile', // Your details
    '/vendor-dashboard/verify', // documents
    '/vendor-dashboard/events', // Events you run
    '/vendor-dashboard/messages',
    '/vendor-dashboard/messages/t-1',
    '/vendor-dashboard/notifications',
    '/vendor-dashboard/settings',
    '/vendor-dashboard/settings/account',
    '/vendor-dashboard/help',
    '/vendor-dashboard/team',
    '/vendor-dashboard/subscription',
    '/vendor-dashboard/switch-shop',
    '/dashboard/e-1', // the event she runs — outside the supplier tree, never held
    '/dashboard/e-1/schedule',
    '/dashboard/e-1/guests',
  ];
  for (const p of open) assert.equal(pageIsHeld(p, NO_ADDRESS), false, `${p} is held — a dead end`);
  // Customers' People list is the chat inbox (`customerLandingHref('messages')`).
  assert.equal(pageIsHeld('/vendor-dashboard/customers', NO_ADDRESS, null), false);
  assert.equal(pageIsHeld('/vendor-dashboard/customers', NO_ADDRESS, 'people'), false);
  // A prefix is a path segment, never a string prefix.
  assert.equal(pageIsHeld('/vendor-dashboard/eventsx', NO_ADDRESS), true);
});

test('1 · the page where a missing step is done stays open — services are set on the shop’s Coverage', () => {
  const noServices = holdFor(shop({ services: [] }));
  assert.ok(noServices);
  assert.equal(pageIsHeld('/vendor-dashboard/shop', noServices), false, 'services missing, but Coverage is held');
  assert.equal(pageIsHeld('/vendor-dashboard/services', noServices), false);
  assert.equal(pageIsHeld('/vendor-dashboard/website', noServices), true);
});

test('2 · who is held: an unverified shop’s owner/admin — never a helper, a verified shop, or an unread row', () => {
  assert.equal(holdFor(shop()), null, 'a complete shop is held');
  const incomplete = shop({ hq_address: null });
  assert.ok(holdFor(incomplete));
  assert.equal(holdFor(incomplete, { canManage: false }), null, 'a helper cannot fill it in — holding them is a dead end');
  assert.equal(holdFor(incomplete, { verified: true }), null, 'a verified shop has no setup steps to go back to');
  assert.equal(holdFor(incomplete, { measured: false }), null, 'a read that did not happen locks nobody out');
  assert.equal(basicSetupHoldOf({ measured: true, canManage: true, verified: false, checklist: null }), null);
  assert.equal(pageIsHeld('/vendor-dashboard/shop', null), false, 'no hold → every page as it was');
});

test('3 · ONE place decides: the layout, from the row it already read, around the page body only', () => {
  const layout = src('app/vendor-dashboard/layout.tsx');
  assert.match(layout, /const setupHold = basicSetupHoldOf\(\{/);
  assert.match(layout, /measured: !!vendorProfile && !vendorProfile\.legacy_read && tierProbe\.dealFacts !== null,/);
  assert.match(layout, /canManage: canManageVendor\(vendorRole\),/);
  assert.match(layout, /checklist: vendorProfile \? businessProfileChecklist\(vendorProfile\) : null,/);
  assert.match(layout, /tierProbe\.dealFacts\?\.verification_state === 'verified'/);
  assert.equal([...layout.matchAll(/<BasicSetupHold\b/g)].length, 1);
  assert.match(layout, /<BasicSetupHold hold=\{setupHold\}>\{children\}<\/BasicSetupHold>/, 'the hold must wrap the page body only');
  // The top bar (sign-out under the avatar) and the bottom bar are outside it.
  const holdAt = layout.indexOf('<BasicSetupHold');
  assert.ok(layout.indexOf('<AccountSwitcher') < holdAt, 'the avatar (sign-out) moved inside the hold');
  assert.ok(layout.indexOf('<VendorBottomNav') > layout.indexOf('</BasicSetupHold>'), 'the bottom bar moved inside the hold');
  // The component only draws the rule; no page has its own copy.
  const hold = src('app/vendor-dashboard/_components/basic-setup-hold.tsx');
  assert.match(hold, /if \(!pageIsHeld\(pathname, hold, seg\) \|\| !hold\) return <>\{children\}<\/>;/);
  assert.match(hold, /href=\{BASIC_SETUP_HOME\}/, 'the one button does not go back to the setup');
  assert.ok(OPEN_WHILE_SETTING_UP.includes('/vendor-dashboard/events'));
});
