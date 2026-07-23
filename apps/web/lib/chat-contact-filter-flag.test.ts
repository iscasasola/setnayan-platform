/**
 * chatContactFilterEnabled() — the launch flag for the chat off-platform-contact
 * filter. Ships DARK: OFF by default, ON only for the exact truthy strings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatContactFilterEnabled } from './chat-contact-filter-flag';

const KEY = 'NEXT_PUBLIC_CHAT_CONTACT_FILTER_ENABLED';

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

test('OFF by default (unset → disabled — ships dark)', () => {
  withEnv(undefined, () => assert.equal(chatContactFilterEnabled(), false));
});

test('ON for the truthy strings', () => {
  withEnv('true', () => assert.equal(chatContactFilterEnabled(), true));
  withEnv('1', () => assert.equal(chatContactFilterEnabled(), true));
  withEnv('TRUE', () => assert.equal(chatContactFilterEnabled(), true));
});

test('OFF for anything else', () => {
  withEnv('false', () => assert.equal(chatContactFilterEnabled(), false));
  withEnv('yes', () => assert.equal(chatContactFilterEnabled(), false));
  withEnv('', () => assert.equal(chatContactFilterEnabled(), false));
});
