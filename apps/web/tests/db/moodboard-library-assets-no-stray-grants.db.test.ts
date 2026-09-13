/**
 * `moodboard_library_assets` must never carry DELETE, REFERENCES, TRIGGER or
 * TRUNCATE for `anon`/`authenticated` — and its legitimate, column-scoped
 * SELECT/INSERT/UPDATE grants must stay intact, so a future "lock it all
 * down" pass does not break the public gallery or vendor uploads.
 *
 * Found 2026-09-04 while regenerating the exposure baseline for MB16: an
 * earlier migration had already NARROWED the table-level grant to just these
 * four, and nobody noticed, because the exposure-freeze guard only fails on
 * a WIDENING — a baseline wider than reality passes forever. This test
 * closes the remaining four AND pins the direction the exposure guard
 * cannot see on its own: that closing them does not also close the columns
 * that are supposed to stay open.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  if (!db) return;
  await db.close?.();
});

const STRAY = ['DELETE', 'REFERENCES', 'TRIGGER', 'TRUNCATE'] as const;

test('anon and authenticated hold none of the four stray table-level privileges', async () => {
  const open: string[] = [];
  for (const role of ['anon', 'authenticated']) {
    for (const verb of STRAY) {
      const { rows } = await db.query<{ ok: boolean }>(
        `SELECT has_table_privilege($1, 'public.moodboard_library_assets', $2) AS ok`,
        [role, verb],
      );
      if (rows[0]?.ok) open.push(`${role}:${verb}`);
    }
  }
  assert.deepEqual(
    open,
    [],
    'moodboard_library_assets has regained a stray table-level privilege:\n  ' +
      open.join('\n  ') +
      '\n\nThe usual cause is a later migration re-creating the table or running a broad ' +
      "GRANT, which re-applies the schema's default privileges. Re-issue the REVOKE in " +
      'the same migration that re-created the object. TRUNCATE especially: RLS does not ' +
      'gate it at all, so this grant is the only thing standing in front of every row.',
  );
});

test('the public gallery SELECT and the vendor own-row policies still work — this revoke must not touch them', async () => {
  // Anti-regression the other direction: a careless REVOKE ALL would have
  // taken the column-scoped grants these policies depend on along with the
  // four stray ones. Confirm both roles still have real, working access.
  const { rows: anonSelect } = await db.query<{ ok: boolean }>(
    `SELECT has_any_column_privilege('anon', 'public.moodboard_library_assets', 'SELECT') AS ok`,
  );
  assert.equal(
    anonSelect[0]?.ok,
    true,
    'anon lost SELECT on moodboard_library_assets — this breaks the public decor gallery ' +
      '(moodboard_library_assets_public_read: approved_at IS NOT NULL AND retired_at IS NULL)',
  );

  for (const [role, verb] of [
    ['authenticated', 'SELECT'],
    ['authenticated', 'INSERT'],
    ['authenticated', 'UPDATE'],
  ] as const) {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT has_any_column_privilege($1, 'public.moodboard_library_assets', $2) AS ok`,
      [role, verb],
    );
    assert.equal(
      rows[0]?.ok,
      true,
      `authenticated lost ${verb} on moodboard_library_assets — this breaks vendor uploads ` +
        'and self-service edits (moodboard_library_assets_vendor_insert / _update_own / _select_own)',
    );
  }
});

test('the DELETE policy that depends on the revoked grant is still on the catalog, unreachable', async () => {
  // moodboard_library_assets_vendor_delete_own has no live caller (both real
  // delete paths use the service-role admin client with a hand-written
  // ownership check), but it should not silently vanish either — a dropped
  // policy and a revoked grant are two different, separately-decided things.
  const { rows } = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_policies
      WHERE tablename = 'moodboard_library_assets' AND policyname = 'moodboard_library_assets_vendor_delete_own'`,
  );
  assert.equal(
    rows[0]?.n,
    1,
    'moodboard_library_assets_vendor_delete_own is gone — dropping a policy is a separate ' +
      'decision from revoking a grant; if this was intentional, this test should be updated ' +
      'to say so rather than silently pass',
  );
});
