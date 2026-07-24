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

test("plausibilityScannerEnabled: ON only for the exact string 'true'", () => {
  withEnv('true', () => assert.equal(plausibilityScannerEnabled(), true));
});

test('plausibilityScannerEnabled: any other value stays OFF', () => {
  withEnv('false', () => assert.equal(plausibilityScannerEnabled(), false));
  withEnv('1', () => assert.equal(plausibilityScannerEnabled(), false));
  withEnv('TRUE', () => assert.equal(plausibilityScannerEnabled(), false, 'case-sensitive'));
  withEnv('', () => assert.equal(plausibilityScannerEnabled(), false));
});
