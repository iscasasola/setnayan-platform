/**
 * canvasMakerEnabled() — the launch flag for the zero-step service card maker.
 * Ships DARK: OFF by default, ON only for the exact truthy strings.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canvasMakerEnabled } from './canvas-maker-flag';

const KEY = 'NEXT_PUBLIC_CANVAS_MAKER_ENABLED';

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

test('OFF by default (unset → the shipped wizard renders — ships dark)', () => {
  withEnv(undefined, () => assert.equal(canvasMakerEnabled(), false));
});

test('ON for the truthy strings', () => {
  withEnv('true', () => assert.equal(canvasMakerEnabled(), true));
  withEnv('1', () => assert.equal(canvasMakerEnabled(), true));
  withEnv('TRUE', () => assert.equal(canvasMakerEnabled(), true));
});

test('OFF for anything else', () => {
  withEnv('false', () => assert.equal(canvasMakerEnabled(), false));
  withEnv('yes', () => assert.equal(canvasMakerEnabled(), false));
  withEnv('on', () => assert.equal(canvasMakerEnabled(), false));
  withEnv('', () => assert.equal(canvasMakerEnabled(), false));
});
