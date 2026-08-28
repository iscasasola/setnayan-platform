/**
 * isSupplierNightBeforeEmailEnabled() — S5 ships OFF. The owner gate (may we
 * email a supplier automatically at an address they never gave us?) is still
 * open, so this must default OFF and require the exact opt-in string — not
 * the `!== 'false'` shape used by safe, already-proven cleanup jobs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSupplierNightBeforeEmailEnabled } from './supplier-night-before-email-flag';

const KEY = 'SUPPLIER_NIGHT_BEFORE_EMAIL_ENABLED';

function withEnv(value: string | undefined, fn: () => void) {
  const prev = process.env[KEY];
  try {
    if (value === undefined) delete process.env[KEY];
    else process.env[KEY] = value;
    fn();
  } finally {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  }
}

test('OFF when unset — ships dark', () => {
  withEnv(undefined, () => assert.equal(isSupplierNightBeforeEmailEnabled(), false));
});

test('OFF for near-miss truthy values — only the exact string arms it', () => {
  withEnv('1', () => assert.equal(isSupplierNightBeforeEmailEnabled(), false));
  withEnv('TRUE', () => assert.equal(isSupplierNightBeforeEmailEnabled(), false));
  withEnv('yes', () => assert.equal(isSupplierNightBeforeEmailEnabled(), false));
});

test('ON only for the literal string "true"', () => {
  withEnv('true', () => assert.equal(isSupplierNightBeforeEmailEnabled(), true));
});
