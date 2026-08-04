/**
 * tests/db/ugat-schema-claims.db.test.ts — the Ugat joint registry cannot lie
 * about what exists.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * `lib/ugat/graph.ts` powers /admin/ugat/map, the surface whose entire job is
 * telling the truth about how the platform's entities are bonded. On
 * 2026-07-30 a re-audit found it referencing THREE columns that do not exist
 * anywhere in the 1,002 migrations — `events.qr_revoked_at`,
 * `payment_inbox_messages`, `order_ledger_entries`. Every one had looked
 * authoritative for weeks. Nothing failed, because nothing was checking.
 *
 * Each joint now carries `claims` — the structural half of its prose, made
 * falsifiable. This test replays the real migrations and refutes them.
 *
 * ── WHY A REPLAY AND NOT REGEX-PARSED MIGRATIONS ───────────────────────────
 * This repo already built and THREW AWAY a regex schema parser: per
 * `schema-drift.db.test.ts`, it produced 18 false positives out of 32 findings
 * because it unions every migration and never processes DROP or RENAME. FKs are
 * worse — `ALTER TABLE … DROP CONSTRAINT`, DO-block conditionals and constraint
 * renames all defeat text matching. After a replay, `pg_constraint` holds REAL
 * rows produced by executing real SQL: a dropped constraint is actually gone.
 *
 * ── WHY NOT LIVE PROD ──────────────────────────────────────────────────────
 * CI holds no production credentials, by standing design (the same trade the
 * exposure freeze makes). The replay needs none.
 *
 * ── HONEST LIMIT ───────────────────────────────────────────────────────────
 * This proves the claims hold against the DECLARED schema. A constraint that
 * silently no-opped in prod (e.g. inside an exception-swallowing DO block)
 * would exist here and not there. `schema-drift.db.test.ts` covers the column
 * half of that gap; constraints are not yet in the committed prod snapshot.
 * Stated rather than buried.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb } from './replay-migrations';
import { UGAT_JOINTS, UGAT_TYPES } from '../../lib/ugat/graph';
import {
  verifyUgatClaims,
  formatClaimFailures,
  claimedTables,
  columnKey,
  fkKey,
  uniqueKey,
  checkKey,
  type UgatIntrospection,
  type UgatSchemaClaim,
} from '../../lib/ugat/schema-claims';

/** Every claim-bearing owner: the joints, plus each type node's `table` binding. */
function claimOwners(): Array<{ ownerId: string; claims: UgatSchemaClaim[] }> {
  const owners = UGAT_JOINTS.map((j) => ({ ownerId: j.id, claims: j.claims }));
  // A node's `table` is itself an implicit existence claim — free to check, and
  // it is how a renamed table would be caught on the node cards too.
  for (const t of UGAT_TYPES) {
    if (t.table) {
      owners.push({
        ownerId: `${t.id} (node table)`,
        claims: [{ kind: 'table', table: t.table }],
      });
    }
  }
  return owners;
}

async function introspect(db: Awaited<ReturnType<typeof createReplayedDb>>['db']) {
  const cols = await db.query<{ tbl: string; col: string }>(`
    SELECT c.relname AS tbl, a.attname AS col
      FROM pg_attribute a
      JOIN pg_class c     ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public'
       AND c.relkind = 'r'
       AND a.attnum > 0
       AND NOT a.attisdropped
  `);

  const fks = await db.query<{ tbl: string; col: string; ref: string }>(`
    SELECT c.relname AS tbl, a.attname AS col, rf.relname AS ref
      FROM pg_constraint con
      JOIN pg_class c      ON c.oid  = con.conrelid
      JOIN pg_class rf     ON rf.oid = con.confrelid
      JOIN pg_namespace n  ON n.oid  = c.relnamespace
      JOIN LATERAL unnest(con.conkey) AS k(attnum) ON TRUE
      JOIN pg_attribute a  ON a.attrelid = c.oid AND a.attnum = k.attnum
     WHERE con.contype = 'f'
       AND n.nspname = 'public'
  `);

  // PRIMARY KEY counts as UNIQUE for our purposes — both enforce one row per key.
  const uniques = await db.query<{ tbl: string; cols: string[] }>(`
    SELECT c.relname AS tbl,
           array_agg(a.attname ORDER BY a.attname) AS cols
      FROM pg_constraint con
      JOIN pg_class c      ON c.oid = con.conrelid
      JOIN pg_namespace n  ON n.oid = c.relnamespace
      JOIN LATERAL unnest(con.conkey) AS k(attnum) ON TRUE
      JOIN pg_attribute a  ON a.attrelid = c.oid AND a.attnum = k.attnum
     WHERE con.contype IN ('u', 'p')
       AND n.nspname = 'public'
     GROUP BY c.relname, con.conname
  `);

  // CHECK constraints, with their definitions — a joint may assert not just
  // that a named rule exists but which column it actually tests.
  const checks = await db.query<{ tbl: string; name: string; def: string }>(`
    SELECT c.relname AS tbl, con.conname AS name,
           pg_get_constraintdef(con.oid) AS def
      FROM pg_constraint con
      JOIN pg_class c     ON c.oid = con.conrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE con.contype = 'c'
       AND n.nspname = 'public'
  `);

  const intro: UgatIntrospection = {
    columns: new Set(cols.rows.map((r) => columnKey(r.tbl, r.col))),
    fks: new Set(fks.rows.map((r) => fkKey(r.tbl, r.col, r.ref))),
    uniques: new Set(uniques.rows.map((r) => uniqueKey(r.tbl, r.cols))),
    checks: new Map(checks.rows.map((r) => [checkKey(r.tbl, r.name), r.def])),
  };
  return intro;
}

test('every Ugat joint claim holds against the replayed schema', async (t) => {
  const { db, applied } = await createReplayedDb();
  t.after(() => db.close());

  // ── ANTI-VACUITY ─────────────────────────────────────────────────────────
  // A broken replay would produce an empty introspection, and an empty
  // introspection makes... every positive claim fail loudly, but it would also
  // make the run meaningless. Floors first, so "the harness died" can never be
  // mistaken for "the schema changed".
  assert.ok(applied > 500, `expected a full replay, only ${applied} migrations applied`);

  const intro = await introspect(db);
  assert.ok(intro.columns.size > 2000, `introspection too small: ${intro.columns.size} columns`);
  assert.ok(intro.fks.size > 100, `introspection too small: ${intro.fks.size} FKs`);
  assert.ok(intro.uniques.size > 100, `introspection too small: ${intro.uniques.size} uniques`);

  const owners = claimOwners();

  // Every claimed table must actually be reachable, otherwise a typo'd table
  // name would let its column claims "fail" for the wrong reason.
  assert.ok(claimedTables(owners).size >= 12, 'claims should span the joint tables');

  // ── THE CHECK ────────────────────────────────────────────────────────────
  const failures = verifyUgatClaims(owners, intro);
  assert.equal(failures.length, 0, formatClaimFailures(failures));
});

test('every joint carries at least one claim — an unclaimed joint is the loophole', () => {
  for (const j of UGAT_JOINTS) {
    assert.ok(
      Array.isArray(j.claims) && j.claims.length > 0,
      `${j.id} has no claims; it can say anything about the schema without being checked`,
    );
  }
});

test('the checker itself is not vacuous — a deliberately false claim FAILS', async (t) => {
  // The single most important assertion in this file. Everything above proves
  // the claims pass; this proves a claim CAN fail. A green suite that cannot go
  // red is decoration.
  const { db } = await createReplayedDb();
  t.after(() => db.close());
  const intro = await introspect(db);

  const failures = verifyUgatClaims(
    [
      {
        ownerId: 'J-CANARY',
        claims: [
          // the exact phantom that sat in the registry for 25 days
          { kind: 'column', table: 'events', column: 'qr_revoked_at' },
        ],
      },
    ],
    intro,
  );
  assert.equal(failures.length, 1);
  assert.match(failures[0]!.detail, /does not exist/);
});
