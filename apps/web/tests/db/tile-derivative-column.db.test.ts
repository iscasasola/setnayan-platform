/**
 * tile-derivative-column.db.test.ts — the wall-sized copy must be READABLE, not
 * merely present.
 *
 * ── THE FAILURE THIS EXISTS TO CATCH ───────────────────────────────────────
 * A column that exists but carries no SELECT grant for the reading role does
 * not error at the call site. PostgREST answers `{ data: null, error }` and the
 * client renders an empty result — so naming `tile_r2_key` in a select would
 * REJECT THE WHOLE QUERY and ship as a silently empty wall. The only symptom is
 * an absence, which is the same family as the phantom column, the stale enum
 * value, the phantom RPC argument and the blocked iframe.
 *
 * It is not hypothetical here. `papic_photos` carries COLUMN-LEVEL ACLs on 39
 * of its 40 columns, and `events` — measured — has NO table-level SELECT for
 * `authenticated` at all (188 of 202 columns granted individually), so a new
 * column there is unreadable by construction. `papic_photos` happens to retain
 * table-level SELECT, which is why this works; the migration grants explicitly
 * anyway so a future table-level REVOKE cannot silently take the wall down.
 *
 * ── WHY `has_column_privilege` AND NOT A SELECT ────────────────────────────
 * 🪤 THE REPLAY RUNS AS SUPERUSER — it is MORE PERMISSIVE THAN PROD, so a plain
 * `SELECT tile_r2_key` succeeds here whatever the grants say, and would be a
 * false green. `has_column_privilege('authenticated', …)` asks about the NAMED
 * ROLE's actual ACL rather than the current user's, so it reports the truth in
 * a superuser session. That distinction is the whole reason this file can
 * assert anything at all.
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

const TABLES = ['papic_photos', 'papic_guest_captures'] as const;
const COLUMNS = ['tile_r2_key', 'tile_bytes'] as const;

test('the tile columns exist on both capture tables', async () => {
  for (const table of TABLES) {
    for (const column of COLUMNS) {
      const { rows } = await db.query<{ n: number }>(
        `select count(*)::int as n
           from information_schema.columns
          where table_schema='public' and table_name=$1 and column_name=$2`,
        [table, column],
      );
      assert.equal(
        rows[0]?.n,
        1,
        `public.${table}.${column} is missing. The wall selects it by name, and a ` +
          `phantom column REJECTS THE WHOLE QUERY rather than throwing — it would ` +
          `ship as an empty wall with nothing in the logs.`,
      );
    }
  }
});

test('an RLS client can actually SELECT them — presence is not permission', async () => {
  for (const role of ['authenticated', 'anon'] as const) {
    for (const table of TABLES) {
      for (const column of COLUMNS) {
        const { rows } = await db.query<{ allowed: boolean }>(
          `select has_column_privilege($1, $2::regclass, $3, 'SELECT') as allowed`,
          [role, `public.${table}`, column],
        );
        assert.equal(
          rows[0]?.allowed,
          true,
          `role "${role}" cannot SELECT public.${table}.${column}. A NEW column ` +
            `inherits NO column-level grants, so wherever a table-level REVOKE has ` +
            `pushed SELECT down to individual columns, a fresh column has it ` +
            `nowhere — and every query naming it fails silently.`,
        );
      }
    }
  }
});

test('the columns carry a comment that says what they are', async () => {
  // Applied migrations are never edited, so the description a future reader
  // actually queries has to live on the object. A wrong COMMENT on
  // `live_photo_wall_visibility` is what let a defect survive for months.
  for (const table of TABLES) {
    const { rows } = await db.query<{ comment: string | null }>(
      `select col_description($1::regclass, (
                select attnum from pg_attribute
                 where attrelid = $1::regclass and attname = 'tile_r2_key'
              )) as comment`,
      [`public.${table}`],
    );
    const comment = rows[0]?.comment ?? '';
    assert.ok(
      comment.length > 40,
      `public.${table}.tile_r2_key has no useful COMMENT.`,
    );
    assert.match(
      comment,
      /640/,
      `The comment on public.${table}.tile_r2_key does not say what SIZE it is, ` +
        `which is the only thing distinguishing it from the two derivatives ` +
        `beside it.`,
    );
  }
});
