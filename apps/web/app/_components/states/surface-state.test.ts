/**
 * The six-state resolver guard.
 *
 * The load-bearing rule: an RLS denial and an empty read are the SAME VALUE
 * (`count: 0`, no error) — a production desk once printed "no requests yet"
 * over three real pending rows. Empty must be UNREACHABLE unless the read
 * was positively proven permitted, so the sweep below tries every input
 * combination rather than a few hand-picked cases.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveSurfaceState } from './surface-state';

const BOOLS = [true, false, undefined] as const;
const PERMS = [true, false, null, undefined] as const;
const COUNTS = [0, 1, 37] as const;

test('states · empty is UNREACHABLE unless the read was positively proven permitted', () => {
  for (const loading of BOOLS)
    for (const error of BOOLS)
      for (const locked of BOOLS)
        for (const readPermitted of PERMS)
          for (const count of COUNTS) {
            const state = resolveSurfaceState({ loading, error, locked, readPermitted, count });
            if (state === 'empty') {
              assert.equal(
                readPermitted,
                true,
                `empty rendered with readPermitted=${String(readPermitted)} — ` +
                  `a denial and an empty read both return count 0; this must resolve to denied`,
              );
            }
          }
});

test('states · anything short of a literal true resolves to denied, never empty', () => {
  for (const readPermitted of [false, null, undefined] as const) {
    assert.equal(
      resolveSurfaceState({ readPermitted, count: 0 }),
      'denied',
      `readPermitted=${String(readPermitted)} with count 0 must render denied`,
    );
    // Even with rows visible, an unproven reader gets Denied — the rows may
    // be a partial, silently-filtered view.
    assert.equal(resolveSurfaceState({ readPermitted, count: 5 }), 'denied');
  }
});

test('states · the permitted path: 0 rows teaches, rows render', () => {
  assert.equal(resolveSurfaceState({ readPermitted: true, count: 0 }), 'empty');
  assert.equal(resolveSurfaceState({ readPermitted: true, count: 1 }), 'ideal');
});

test('states · precedence — loading, then error, then locked, then permission', () => {
  const base = { readPermitted: true, count: 3 } as const;
  assert.equal(
    resolveSurfaceState({ ...base, loading: true, error: true, locked: true }),
    'loading',
  );
  assert.equal(resolveSurfaceState({ ...base, error: true, locked: true }), 'error');
  assert.equal(resolveSurfaceState({ ...base, locked: true }), 'locked');
  // Locked is an entitlement fact and outranks the permission question: a
  // free-tier reader sees the gold gate, not a slate denial.
  assert.equal(
    resolveSurfaceState({ readPermitted: undefined, locked: true, count: 0 }),
    'locked',
  );
});
