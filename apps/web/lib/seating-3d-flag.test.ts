/**
 * seating3dEnabled() — the 3D Plan kill-switch used to flag-gate the 3D Booth
 * add-on's BUY (never sell a booth when 3D is switched off). Locks the
 * kill-switch semantics: ON by default, OFF only for the exact string 'false'.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seating3dEnabled } from './seating-3d-flag';

const KEY = 'NEXT_PUBLIC_SEATING_3D';

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

test('seating3dEnabled: ON by default (unset → enabled — it is a kill-switch)', () => {
  withEnv(undefined, () => assert.equal(seating3dEnabled(), true));
});

test("seating3dEnabled: OFF only for the exact string 'false'", () => {
  withEnv('false', () => assert.equal(seating3dEnabled(), false));
});

test('seating3dEnabled: any other value keeps 3D on', () => {
  withEnv('true', () => assert.equal(seating3dEnabled(), true));
  withEnv('0', () => assert.equal(seating3dEnabled(), true, "only 'false' kills it"));
  withEnv('', () => assert.equal(seating3dEnabled(), true));
});
