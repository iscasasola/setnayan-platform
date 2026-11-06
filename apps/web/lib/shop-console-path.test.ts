/**
 * A "where next" path is honoured ONLY when it is a Shop-console page.
 * Added 2026-11-05 for `/open-shop?next=` ("Get your invite link" on
 * /for-suppliers) and the vendor-dashboard sign-in bounce (deep links survive
 * login).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { shopConsolePath, requestPathOf } from './shop-console-path';

test('a console page in next is honoured verbatim', () => {
  assert.equal(shopConsolePath('/vendor-dashboard/invite'), '/vendor-dashboard/invite');
  assert.equal(shopConsolePath('/vendor-dashboard'), '/vendor-dashboard');
  assert.equal(shopConsolePath('/vendor-dashboard/bookings?id=1'), '/vendor-dashboard/bookings?id=1');
});

test('anything else falls back to Today', () => {
  for (const bad of [undefined, '', '/dashboard', '/vendor-dashboardx', '//evil.com/vendor-dashboard', '/\\evil.com', 'https://evil.com/vendor-dashboard', ['/vendor-dashboard']]) {
    assert.equal(shopConsolePath(bad), '/vendor-dashboard', `accepted ${JSON.stringify(bad)}`);
  }
});

test('the request path drops only Next’s _rsc buster', () => {
  assert.equal(requestPathOf({ pathname: '/vendor-dashboard/inbox/T1', search: '' }), '/vendor-dashboard/inbox/T1');
  assert.equal(
    requestPathOf({ pathname: '/vendor-dashboard/bookings', search: '?id=B1&_rsc=abc' }),
    '/vendor-dashboard/bookings?id=B1',
  );
});
