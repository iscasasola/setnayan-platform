/**
 * The create → onboarding honoree carry — freshness window.
 *
 * The storage half is guarded by `typeof window === 'undefined'` and cannot run
 * under node:test; the decision it turns on is this pure predicate, so that is
 * what is asserted — including the clock-went-backwards case, where a stamp from
 * the future must read as STALE rather than as freshly written.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  HONOREE_HANDOFF_TTL_MS,
  isHandoffFresh,
  stashHonoree,
  takeHonoree,
} from './honoree-handoff';

const NOW = 1_800_000_000_000;

test('a stamp inside the window is fresh', () => {
  assert.equal(isHandoffFresh(NOW, NOW), true);
  assert.equal(isHandoffFresh(NOW - 1000, NOW), true);
  assert.equal(isHandoffFresh(NOW - (HONOREE_HANDOFF_TTL_MS - 1), NOW), true);
});

test('a stamp at or past the window is stale', () => {
  assert.equal(isHandoffFresh(NOW - HONOREE_HANDOFF_TTL_MS, NOW), false);
  assert.equal(isHandoffFresh(NOW - 60 * 60 * 1000, NOW), false);
});

test('a stamp from the future is a clock change, not a fresh value', () => {
  assert.equal(isHandoffFresh(NOW + 1, NOW), false);
});

test('a non-numeric or absent stamp is never fresh', () => {
  assert.equal(isHandoffFresh(undefined, NOW), false);
  assert.equal(isHandoffFresh(null, NOW), false);
  assert.equal(isHandoffFresh('1800000000000', NOW), false);
  assert.equal(isHandoffFresh(Number.NaN, NOW), false);
});

// ── the CARRY itself (2026-08-01) ───────────────────────────────────────────
// The stash now carries WHICH alaga alongside the name, because a name is a
// weak key: renaming an alaga would otherwise change which events it caps
// against, and two alaga called "Maria" would share one in-planning slot. The
// storage half is guarded by `typeof window === 'undefined'`, so these tests
// install a minimal sessionStorage — the point is the SHAPE that crosses the
// hop, and that it still crosses exactly once.

type FakeGlobal = { window?: { sessionStorage: Storage } };

function withSessionStorage(run: (storage: Storage) => void): void {
  const store = new Map<string, string>();
  const fake = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  } as unknown as Storage;
  const g = globalThis as unknown as FakeGlobal;
  const had = 'window' in (globalThis as object);
  const prev = g.window;
  g.window = { sessionStorage: fake };
  try {
    run(fake);
  } finally {
    if (had) g.window = prev;
    else delete g.window;
  }
}

test('the carry brings the name AND the record it came from', () => {
  withSessionStorage(() => {
    stashHonoree('Nina', 'dep-9');
    assert.deepEqual(takeHonoree(), { name: 'Nina', dependentId: 'dep-9' });
  });
});

test('“You” / “Someone else” carry a name with no link, never a forged one', () => {
  withSessionStorage(() => {
    stashHonoree('Nina');
    assert.deepEqual(takeHonoree(), { name: 'Nina', dependentId: null });
    stashHonoree('Nina', '');
    assert.deepEqual(takeHonoree(), { name: 'Nina', dependentId: null });
    stashHonoree('Nina', null);
    assert.deepEqual(takeHonoree(), { name: 'Nina', dependentId: null });
  });
});

test('the stash is still READ ONCE — a link can never resurface in a later flow', () => {
  withSessionStorage(() => {
    stashHonoree('Nina', 'dep-9');
    assert.notEqual(takeHonoree(), null);
    assert.equal(takeHonoree(), null, 'a second read must find nothing');
  });
});

test('an empty name CLEARS the stash — an id with no name is never left behind', () => {
  withSessionStorage(() => {
    stashHonoree('Nina', 'dep-9');
    stashHonoree('   ', 'dep-9');
    assert.equal(takeHonoree(), null);
  });
});

test('a stash written before the link existed still reads (name only)', () => {
  withSessionStorage((storage) => {
    storage.setItem(
      'setnayan_create_honoree_v1',
      JSON.stringify({ n: 'Nina', t: Date.now() }),
    );
    assert.deepEqual(takeHonoree(), { name: 'Nina', dependentId: null });
  });
});
