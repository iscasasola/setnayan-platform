/**
 * makerStagesStudioEnabled() — the new Maker frame ships DARK for couples and
 * is ON for an internal viewer. Every truthy spelling `envFlagEnabled` reads
 * turns it on; a missing or misspelt value never does.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makerStagesStudioEnabled } from './maker-stages-studio-flag';

const KEY = 'NEXT_PUBLIC_MAKER_STAGES_STUDIO_ENABLED';

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

test('OFF when unset — a couple keeps the shipped Maker', () => {
  withEnv(undefined, () => assert.equal(makerStagesStudioEnabled({ internal: false }), false));
});

test('ON for every truthy spelling, any case, trimmed', () => {
  for (const v of ['true', '1', 'yes', 'on', 'TRUE', 'True', ' on ', 'YES\n']) {
    withEnv(v, () => assert.equal(makerStagesStudioEnabled({ internal: false }), true, `"${v}" did not turn it on`));
  }
});

test('OFF for anything else — a misspelt flag never opens it', () => {
  for (const v of ['', 'false', '0', 'no', 'off', 'enabled', 'tru', 'ON!']) {
    withEnv(v, () => assert.equal(makerStagesStudioEnabled({ internal: false }), false, `"${v}" turned it on`));
  }
});

test('ON for an internal viewer whatever the env says — the owner checks each PR on the live site', () => {
  for (const v of [undefined, '', 'false', 'off']) {
    withEnv(v, () => assert.equal(makerStagesStudioEnabled({ internal: true }), true));
  }
});
