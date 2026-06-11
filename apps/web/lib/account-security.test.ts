/**
 * Unit suite for the account-security pure helpers. The load-bearing
 * invariants: the return-path allowlist can never be escaped (open-redirect
 * guard on the shared change-password / sign-out-others actions), password
 * validation mirrors the original /dashboard/profile rules, and the
 * post-reset role routing matches the three doorways.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  accountHomePath,
  isAuthRateLimitError,
  safeSecurityReturnPath,
  validateNewPassword,
} from './account-security';

// ── safeSecurityReturnPath — allowlist, never user-controlled ───────────────

test('safeSecurityReturnPath: allowlisted surfaces pass through', () => {
  assert.equal(safeSecurityReturnPath('/dashboard/profile'), '/dashboard/profile');
  assert.equal(
    safeSecurityReturnPath('/vendor-dashboard/profile'),
    '/vendor-dashboard/profile',
  );
});

test('safeSecurityReturnPath: anything else falls back to the customer profile', () => {
  assert.equal(safeSecurityReturnPath('https://evil.com'), '/dashboard/profile');
  assert.equal(safeSecurityReturnPath('//evil.com'), '/dashboard/profile');
  assert.equal(safeSecurityReturnPath('/admin'), '/dashboard/profile');
  assert.equal(
    safeSecurityReturnPath('/dashboard/profile?x=1'),
    '/dashboard/profile',
  );
  assert.equal(safeSecurityReturnPath(null), '/dashboard/profile');
  assert.equal(safeSecurityReturnPath(undefined), '/dashboard/profile');
  assert.equal(safeSecurityReturnPath(42), '/dashboard/profile');
});

// ── validateNewPassword — mirrors the original changePassword rules ─────────

test('validateNewPassword: min 8 + confirm match', () => {
  assert.equal(validateNewPassword('short', 'short'), 'Password must be at least 8 characters');
  assert.equal(validateNewPassword('longenough', 'different1'), 'Passwords do not match');
  assert.equal(validateNewPassword('longenough', 'longenough'), null);
  // Exactly 8 chars is valid (>= 8, not > 8).
  assert.equal(validateNewPassword('12345678', '12345678'), null);
});

// ── accountHomePath — three doorways ────────────────────────────────────────

test('accountHomePath: vendor → /vendor-dashboard · admin → /admin · else /dashboard', () => {
  assert.equal(accountHomePath('vendor'), '/vendor-dashboard');
  assert.equal(accountHomePath('admin'), '/admin');
  assert.equal(accountHomePath('customer'), '/dashboard');
  assert.equal(accountHomePath(null), '/dashboard');
  assert.equal(accountHomePath(undefined), '/dashboard');
});

// ── isAuthRateLimitError — friendly message gate on /forgot-password ────────

test('isAuthRateLimitError: 429 + Supabase rate-limit phrasings detected', () => {
  assert.equal(isAuthRateLimitError(429, 'whatever'), true);
  assert.equal(
    isAuthRateLimitError(
      undefined,
      'For security purposes, you can only request this after 52 seconds.',
    ),
    true,
  );
  assert.equal(isAuthRateLimitError(undefined, 'Email rate limit exceeded'), true);
  assert.equal(isAuthRateLimitError(400, 'Too many requests'), true);
});

test('isAuthRateLimitError: ordinary errors are NOT rate limits (stay neutral)', () => {
  // "User not found"-shaped errors must collapse to the neutral sent state.
  assert.equal(isAuthRateLimitError(400, 'User not found'), false);
  assert.equal(isAuthRateLimitError(undefined, undefined), false);
  assert.equal(isAuthRateLimitError(500, 'Internal server error'), false);
});
