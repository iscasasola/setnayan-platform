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
import { openShopLanding } from '@/lib/open-shop-landing';
import { inviteLinkHref, INVITE_LINK_PATH } from './_components/vendor-grow-sections';

test('"Get your invite link" goes to the invite page for a supplier, and through /open-shop for everyone else', () => {
  assert.equal(inviteLinkHref(true), INVITE_LINK_PATH);
  assert.equal(INVITE_LINK_PATH, '/vendor-dashboard/invite');
  const href = inviteLinkHref(false);
  assert.equal(href, '/open-shop?next=%2Fvendor-dashboard%2Finvite');
  // …and /open-shop accepts exactly that next.
  const next = new URL(href, 'https://x.invalid').searchParams.get('next');
  assert.equal(openShopLanding(next), INVITE_LINK_PATH);
});

test('the page decides from the viewer, and the button reads that decision', () => {
  const page = readFileSync('app/for-suppliers/page.tsx', 'utf8');
  assert.match(page, /<VendorGrowAI inviteHref=\{inviteLinkHref\(hasShop\)\} \/>/);
  const sections = readFileSync('app/for-suppliers/_components/vendor-grow-sections.tsx', 'utf8');
  const cta = sections.slice(sections.indexOf('Get your couples on Setnayan AI.'));
  assert.match(cta.slice(0, 1200), /<Link href=\{inviteHref\}[^>]*>\s*Get your invite link/);
});
