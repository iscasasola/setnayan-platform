/**
 * cardRecordEnabled() — the launch flag for the compiled service-card record.
 * Ships DARK: OFF by default, ON only for the exact truthy strings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cardRecordEnabled } from './card-record-flag';

const KEY = 'NEXT_PUBLIC_CARD_RECORD_ENABLED';

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

test('OFF by default (unset → no record section, no extra query — ships dark)', () => {
  withEnv(undefined, () => assert.equal(cardRecordEnabled(), false));
});

test('ON for the truthy strings', () => {
  withEnv('true', () => assert.equal(cardRecordEnabled(), true));
  withEnv('1', () => assert.equal(cardRecordEnabled(), true));
  withEnv('TRUE', () => assert.equal(cardRecordEnabled(), true));
});

test('OFF for anything else', () => {
  withEnv('false', () => assert.equal(cardRecordEnabled(), false));
  withEnv('yes', () => assert.equal(cardRecordEnabled(), false));
  withEnv('on', () => assert.equal(cardRecordEnabled(), false));
  withEnv('', () => assert.equal(cardRecordEnabled(), false));
});
