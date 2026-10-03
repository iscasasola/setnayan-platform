/**
 * packageCreditEnabled() — the package CREDIT model, ARMED BY DEFAULT.
 *
 * ⚖ Owner tracker d8 (2026-10-02): turn it ON, with a kill switch — the same
 * shape as the free-transport flag. Unset (production) must read ON; only an
 * explicit `0` / `false` / `off` turns it off. If this ever regressed to a
 * launch flag (OFF unless 'true'), production would silently go back to the
 * legacy model, because production never sets the variable.
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

test('packageCreditEnabled: ON when unset — production never sets it (owner d8)', () => {
  withEnv(undefined, () => assert.equal(packageCreditEnabled(), true));
  withEnv('', () => assert.equal(packageCreditEnabled(), true));
});

test('packageCreditEnabled: any yes-ish value keeps it ON', () => {
  for (const value of ['true', 'True', '1', 'yes', 'on']) {
    withEnv(value, () =>
      assert.equal(packageCreditEnabled(), true, `expected ON for ${JSON.stringify(value)}`),
    );
  }
});

test('packageCreditEnabled: the kill switch — 0 / false / off, any case, any spacing', () => {
  for (const value of ['0', 'false', 'FALSE', 'off', ' Off ']) {
    withEnv(value, () =>
      assert.equal(packageCreditEnabled(), false, `expected OFF for ${JSON.stringify(value)}`),
    );
  }
});
