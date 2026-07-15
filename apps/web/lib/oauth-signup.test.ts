import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseOAuthAccountType,
  buildOAuthCallbackUrl,
  shouldPromoteToVendor,
  VENDOR_PROMOTE_WINDOW_MS,
} from './oauth-signup';

test('parseOAuthAccountType: only "vendor" is vendor; everything else is customer', () => {
  assert.equal(parseOAuthAccountType('vendor'), 'vendor');
  assert.equal(parseOAuthAccountType('customer'), 'customer');
  assert.equal(parseOAuthAccountType(''), 'customer');
  assert.equal(parseOAuthAccountType(null), 'customer');
  assert.equal(parseOAuthAccountType(undefined), 'customer');
  assert.equal(parseOAuthAccountType('VENDOR'), 'customer'); // exact match only
});

test('buildOAuthCallbackUrl: customer keeps next, no as=vendor', () => {
  const { next, url } = buildOAuthCallbackUrl({
    appUrl: 'https://x.test',
    rawNext: '/',
    accountType: 'customer',
  });
  assert.equal(next, '/');
  assert.equal(url, 'https://x.test/auth/callback?next=%2F');
  assert.ok(!url.includes('as=vendor'));
});

test('buildOAuthCallbackUrl: vendor with default next → /open-shop + as=vendor', () => {
  const { next, url } = buildOAuthCallbackUrl({
    appUrl: 'https://x.test',
    rawNext: '/',
    accountType: 'vendor',
  });
  assert.equal(next, '/open-shop');
  assert.ok(url.includes('next=%2Fopen-shop'));
  assert.ok(url.includes('as=vendor'));
});

test('buildOAuthCallbackUrl: vendor with an explicit next keeps it (only defaults the "/" case)', () => {
  const { next, url } = buildOAuthCallbackUrl({
    appUrl: 'https://x.test',
    rawNext: '/vendor-invite/abc',
    accountType: 'vendor',
  });
  assert.equal(next, '/vendor-invite/abc');
  assert.ok(url.includes('as=vendor'));
});

const NOW = 1_700_000_000_000;

test('shouldPromoteToVendor: brand-new customer with vendor intent → true', () => {
  assert.equal(
    shouldPromoteToVendor({
      intent: 'vendor',
      userCreatedAt: new Date(NOW - 3_000).toISOString(), // 3s ago
      currentAccountType: 'customer',
      now: NOW,
    }),
    true,
  );
});

test('shouldPromoteToVendor: no vendor intent → false', () => {
  assert.equal(
    shouldPromoteToVendor({ intent: null, userCreatedAt: new Date(NOW).toISOString(), currentAccountType: 'customer', now: NOW }),
    false,
  );
  assert.equal(
    shouldPromoteToVendor({ intent: 'customer', userCreatedAt: new Date(NOW).toISOString(), currentAccountType: 'customer', now: NOW }),
    false,
  );
});

test('shouldPromoteToVendor: established account (outside the window) is NEVER promoted', () => {
  assert.equal(
    shouldPromoteToVendor({
      intent: 'vendor',
      userCreatedAt: new Date(NOW - (VENDOR_PROMOTE_WINDOW_MS + 60_000)).toISOString(), // > window ago
      currentAccountType: 'customer',
      now: NOW,
    }),
    false,
    'a customer created long ago must not be hijacked into a vendor',
  );
});

test('shouldPromoteToVendor: an existing vendor/admin is never touched (customer-only)', () => {
  for (const t of ['vendor', 'admin']) {
    assert.equal(
      shouldPromoteToVendor({ intent: 'vendor', userCreatedAt: new Date(NOW).toISOString(), currentAccountType: t, now: NOW }),
      false,
      `${t} must be left alone`,
    );
  }
});

test('shouldPromoteToVendor: garbled / missing created_at → false (fail closed)', () => {
  assert.equal(shouldPromoteToVendor({ intent: 'vendor', userCreatedAt: null, currentAccountType: 'customer', now: NOW }), false);
  assert.equal(shouldPromoteToVendor({ intent: 'vendor', userCreatedAt: 'not-a-date', currentAccountType: 'customer', now: NOW }), false);
});

test('shouldPromoteToVendor: small future clock-skew still counts as brand-new', () => {
  assert.equal(
    shouldPromoteToVendor({ intent: 'vendor', userCreatedAt: new Date(NOW + 5_000).toISOString(), currentAccountType: 'customer', now: NOW }),
    true,
  );
});
