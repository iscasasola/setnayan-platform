/**
 * "Get your invite link" on /for-suppliers reaches the invite link.
 *
 * Until 2026-11-05 the button was a bare `/open-shop` for everybody: a
 * registered supplier landed on Today, never on /vendor-dashboard/invite, and a
 * new one was never carried there after opening a shop.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { shopConsolePath } from '@/lib/shop-console-path';
import { inviteLinkHref, INVITE_LINK_PATH } from './_components/vendor-grow-sections';

test('"Get your invite link" goes to the invite page for a supplier, and through /open-shop for everyone else', () => {
  assert.equal(inviteLinkHref(true), INVITE_LINK_PATH);
  // 📣 Shop › Promote since 2026-11-05 — the Shortlist invite code moved there from Customers › QR codes.
  assert.equal(INVITE_LINK_PATH, '/vendor-dashboard/shop/promote');
  const href = inviteLinkHref(false);
  assert.equal(href, '/open-shop?next=%2Fvendor-dashboard%2Fshop%2Fpromote');
  // …and /open-shop accepts exactly that next.
  const next = new URL(href, 'https://x.invalid').searchParams.get('next');
  assert.equal(shopConsolePath(next), INVITE_LINK_PATH);
});

/*
 * 2026-11-06: the owner-approved page (`prototypes/for_suppliers_2026-11-06`) has NO "Get your invite link" button —
 * the Shortlist code is shown as a sample in "One QR for every moment", and every action is "Create your shop free".
 * The old assertion read `app/for-suppliers/page.tsx`, a file that has not existed since the page moved into the shell
 * (2026-11-04). What is checked now is what the page draws: no invite button that could lead nowhere, and every CTA
 * goes to /open-shop (which sends a supplier who already has a shop on to their console).
 */
test('the approved page draws no invite button, and every CTA opens a shop', () => {
  const page = readFileSync('app/(shell)/for-suppliers/page.tsx', 'utf8');
  assert.doesNotMatch(page, /<VendorGrowAI\b/, 'the old invite section is mounted again');
  assert.match(page, /<SupplierFrontPage\b/, 'anti-vacuity: the page no longer draws the approved page');
  const front = readFileSync('app/for-suppliers/_components/supplier-front-page.tsx', 'utf8');
  assert.doesNotMatch(front, /Get your invite link/);
  assert.match(front, /const OPEN_SHOP = '\/open-shop';/);
  assert.match(front, /const CTA = 'Create your shop free';/);
  assert.ok((front.match(/href=\{OPEN_SHOP\}/g) ?? []).length >= 3, 'the hero, Plans and the close each carry the CTA');
});
