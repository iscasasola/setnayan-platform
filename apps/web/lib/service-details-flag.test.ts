/**
 * serviceDetailsEnabled() — the launch flag for the per-service details sheet
 * + the per-service inquiry focus + the lock modal's "ask instead" action.
 * Ships DARK: OFF by default, ON only for the exact truthy strings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serviceDetailsEnabled } from './service-details-flag';

const KEY = 'NEXT_PUBLIC_SERVICE_DETAILS_ENABLED';

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

test('OFF by default (unset → static card, composer untouched, no extra query)', () => {
  withEnv(undefined, () => assert.equal(serviceDetailsEnabled(), false));
});

test('ON for the truthy strings', () => {
  withEnv('true', () => assert.equal(serviceDetailsEnabled(), true));
  withEnv('1', () => assert.equal(serviceDetailsEnabled(), true));
  withEnv('TRUE', () => assert.equal(serviceDetailsEnabled(), true));
});

test('OFF for anything else', () => {
  withEnv('false', () => assert.equal(serviceDetailsEnabled(), false));
  withEnv('yes', () => assert.equal(serviceDetailsEnabled(), false));
  withEnv('on', () => assert.equal(serviceDetailsEnabled(), false));
  withEnv('', () => assert.equal(serviceDetailsEnabled(), false));
});
