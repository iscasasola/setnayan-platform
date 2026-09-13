/**
 * hubNamedGuestPreviewEnabled() — the named-guest preview ships DARK.
 * OFF by default, ON only for the exact truthy strings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hubNamedGuestPreviewEnabled } from './hub-named-guest-flag';

const KEY = 'NEXT_PUBLIC_HUB_NAMED_GUEST_PREVIEW_ENABLED';

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

test('OFF when unset — the privacy surface is dark until the owner rules', () => {
  withEnv(undefined, () => assert.equal(hubNamedGuestPreviewEnabled(), false));
});

test('ON for the truthy strings', () => {
  withEnv('true', () => assert.equal(hubNamedGuestPreviewEnabled(), true));
  withEnv('1', () => assert.equal(hubNamedGuestPreviewEnabled(), true));
  withEnv('TRUE', () => assert.equal(hubNamedGuestPreviewEnabled(), true));
});

test('OFF for anything else — a misspelt flag must never open it', () => {
  withEnv('false', () => assert.equal(hubNamedGuestPreviewEnabled(), false));
  withEnv('yes', () => assert.equal(hubNamedGuestPreviewEnabled(), false));
  withEnv('on', () => assert.equal(hubNamedGuestPreviewEnabled(), false));
  withEnv('', () => assert.equal(hubNamedGuestPreviewEnabled(), false));
});
