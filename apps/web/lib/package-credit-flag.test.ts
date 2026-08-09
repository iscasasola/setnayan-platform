/**
 * packageCreditEnabled() — the package CREDIT model launch flag.
 *
 * Locks LAUNCH-flag semantics (OFF unless the exact string 'true'), which is
 * the opposite of a kill-switch. If this ever flipped to default-ON, every
 * package booking would start pricing on the new engine before any UI existed
 * to show a couple what their credit did.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { packageCreditEnabled } from './package-credit-flag';

const KEY = 'NEXT_PUBLIC_PACKAGE_CREDIT';

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

test('packageCreditEnabled: OFF when unset (dark by default)', () => {
  withEnv(undefined, () => assert.equal(packageCreditEnabled(), false));
});

test('packageCreditEnabled: ON for any spelling that means yes', () => {
  for (const value of ['true', 'True', 'TRUE', '1', 'yes', 'on']) {
    withEnv(value, () =>
      assert.equal(packageCreditEnabled(), true, `expected ON for ${JSON.stringify(value)}`),
    );
  }
});

test('packageCreditEnabled: near-misses stay OFF', () => {
  for (const value of ['', 'false', '0', 'no', 'off', 'ture', 'enabled']) {
    withEnv(value, () =>
      assert.equal(packageCreditEnabled(), false, `expected OFF for ${JSON.stringify(value)}`),
    );
  }
});
