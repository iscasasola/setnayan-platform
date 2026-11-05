/**
 * `/open-shop?next=` forwards an existing supplier ONLY to a Shop-console page.
 * Added 2026-11-05 with "Get your invite link" on /for-suppliers, which now
 * sends a signed-out visitor to `/open-shop?next=/vendor-dashboard/invite`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openShopLanding } from './open-shop-landing';

test('a console page in next is honoured verbatim', () => {
  assert.equal(openShopLanding('/vendor-dashboard/invite'), '/vendor-dashboard/invite');
  assert.equal(openShopLanding('/vendor-dashboard'), '/vendor-dashboard');
  assert.equal(openShopLanding('/vendor-dashboard/bookings?id=1'), '/vendor-dashboard/bookings?id=1');
});

test('anything else falls back to Today', () => {
  for (const bad of [undefined, '', '/dashboard', '/vendor-dashboardx', '//evil.com/vendor-dashboard', '/\\evil.com', 'https://evil.com/vendor-dashboard', ['/vendor-dashboard']]) {
    assert.equal(openShopLanding(bad), '/vendor-dashboard', `accepted ${JSON.stringify(bad)}`);
  }
});
