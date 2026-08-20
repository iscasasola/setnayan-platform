/**
 * The Year → create → onboarding moment carry.
 *
 * What crosses the hop is what the tapped row already knew: the day it falls on
 * and whether it is the account holder's own. The storage half is guarded by
 * `typeof window === 'undefined'`, so these tests install a minimal
 * sessionStorage — the point is the SHAPE that crosses, and that it crosses
 * exactly once. The freshness predicate itself is shared with (and tested in)
 * honoree-handoff.test.ts; asserted here only where this module's own
 * behaviour turns on it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { MOMENT_HANDOFF_TTL_MS, stashMoment, takeMoment } from './moment-handoff';

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

test('the carry brings the day and the fact that it is your own', () => {
  withSessionStorage(() => {
    stashMoment({ celebrationISO: '2026-12-16', forSelf: true, age: null });
    assert.deepEqual(takeMoment(), { celebrationISO: '2026-12-16', forSelf: true, age: null });
  });
});

test('a holiday carries its day WITHOUT claiming it is about you', () => {
  withSessionStorage(() => {
    stashMoment({ celebrationISO: '2026-12-25', forSelf: false, age: null });
    assert.deepEqual(takeMoment(), { celebrationISO: '2026-12-25', forSelf: false, age: null });
  });
});

test('it is read ONCE — a later onboarding never inherits the date', () => {
  withSessionStorage(() => {
    stashMoment({ celebrationISO: '2026-12-16', forSelf: true, age: null });
    assert.notEqual(takeMoment(), null);
    assert.equal(takeMoment(), null, 'a second read must find nothing');
  });
});

test('an empty carry CLEARS rather than consuming the read with nothing', () => {
  withSessionStorage((storage) => {
    stashMoment({ celebrationISO: '2026-12-16', forSelf: true, age: null });
    stashMoment({ celebrationISO: null, forSelf: false, age: null });
    assert.equal(storage.getItem('setnayan_year_moment_v1'), null);
    assert.equal(takeMoment(), null);
  });
});

test('a malformed day is dropped on its own — the rest still crosses', () => {
  withSessionStorage(() => {
    // A wrong date is worse than no date: the wizard would show a day nobody
    // chose and it would read as ours.
    stashMoment({ celebrationISO: '16/12/2026', forSelf: true, age: null });
    assert.deepEqual(takeMoment(), { celebrationISO: null, forSelf: true, age: null });
  });
});

test('a stale stash is refused — the wizard asks instead', () => {
  withSessionStorage((storage) => {
    storage.setItem(
      'setnayan_year_moment_v1',
      JSON.stringify({ c: '2026-12-16', s: 1, t: Date.now() - MOMENT_HANDOFF_TTL_MS - 1 }),
    );
    assert.equal(takeMoment(), null);
  });
});

test('corrupt or unstamped JSON degrades to no carry, never a throw', () => {
  withSessionStorage((storage) => {
    storage.setItem('setnayan_year_moment_v1', '{not json');
    assert.equal(takeMoment(), null);
    storage.setItem('setnayan_year_moment_v1', JSON.stringify({ c: '2026-12-16' }));
    assert.equal(takeMoment(), null, 'no timestamp ⇒ not fresh');
  });
});

test('with no window at all it is inert in both directions', () => {
  const g = globalThis as unknown as FakeGlobal;
  const had = 'window' in (globalThis as object);
  const prev = g.window;
  if (had) delete g.window;
  try {
    assert.doesNotThrow(() => stashMoment({ celebrationISO: '2026-12-16', forSelf: true, age: null }));
    assert.equal(takeMoment(), null);
  } finally {
    if (had) g.window = prev;
  }
});

// ── the age the Year row already printed ───────────────────────────────────
test('a plausible age crosses the hop', () => {
  withSessionStorage(() => {
    stashMoment({ celebrationISO: '2026-12-16', forSelf: true, age: 40 });
    assert.equal(takeMoment()?.age, 40);
  });
});

test('an age we cannot trust is dropped, and the rest still crosses', () => {
  const bad = [0, -3, 40.5, 999, Number.NaN, null];
  let checked = 0;
  withSessionStorage(() => {
    for (const b of bad) {
      stashMoment({ celebrationISO: '2026-12-16', forSelf: true, age: b as number | null });
      const got = takeMoment();
      assert.equal(got?.age, null, `${String(b)} must not survive as an age`);
      assert.equal(got?.celebrationISO, '2026-12-16', 'a bad age must not cost the day');
      assert.equal(got?.forSelf, true, 'a bad age must not cost the celebrant');
      checked += 1;
    }
  });
  // A loop that skips everything passes — count what was examined.
  assert.equal(checked, bad.length);
});

test('an age alone is not a carry — it cannot answer anything on its own', () => {
  // Matches the module's existing rule: a stash with no day and not self-owned
  // stores nothing, because it would consume the single read and say nothing.
  withSessionStorage(() => {
    stashMoment({ celebrationISO: null, forSelf: false, age: 40 });
    assert.equal(takeMoment(), null);
  });
});
