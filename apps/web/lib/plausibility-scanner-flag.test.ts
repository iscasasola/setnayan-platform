/**
 * plausibilityScannerEnabled() — the launch flag for the price-under-declaration
 * plausibility scanner. Locks the opt-in semantics: OFF by default (dark), ON
 * only for the exact string 'true'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plausibilityScannerEnabled } from './plausibility-scanner-flag';

const KEY = 'NEXT_PUBLIC_PLAUSIBILITY_SCANNER_ENABLED';

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

test('plausibilityScannerEnabled: OFF by default (unset → dark)', () => {
  withEnv(undefined, () => assert.equal(plausibilityScannerEnabled(), false));
});

test('plausibilityScannerEnabled: ON for any spelling that means yes', () => {
  for (const v of ['true', 'TRUE', 'True', '1', 'yes', 'on']) {
    withEnv(v, () => assert.equal(plausibilityScannerEnabled(), true, `"${v}" must enable`));
  }
});

test('plausibilityScannerEnabled: any other value stays OFF', () => {
  for (const v of ['false', '0', 'no', 'off', '', 'ture']) {
    withEnv(v, () => assert.equal(plausibilityScannerEnabled(), false, `"${v}" must stay OFF`));
  }
});
