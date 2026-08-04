/**
 * WHAT ACTUALLY HAPPENS TO EVERY USER-REFERENCING COLUMN WHEN AN ACCOUNT GOES
 * AWAY — generated from the replayed catalog, never from the migration text.
 *
 * ── THE BLIND SPOT THIS CLOSES ─────────────────────────────────────────────
 * `20271032282809_user_delete_fk_completion_remaining_30.sql` rewrites THIRTY
 * foreign keys from inside a `DO $$` block:
 *
 *     EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', spec.tbl, …)
 *     EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', …)
 *
 * The table, column and action live in a `VALUES` list; the DDL only exists at
 * runtime. So **the migration text no longer says what the schema does.** Read
 * `CREATE TABLE public.event_playlist_picks` today and you will find
 * `created_by_user_id UUID NOT NULL` with no ON DELETE clause. In production it
 * is `ON DELETE SET NULL` and nullable, and has been since 2026-08-02.
 *
 * That is not a hypothetical trap. On 2026-08-02 a systematic pass over the
 * 78-table erasure backlog reasoned from the migration text and got the ON
 * DELETE behaviour wrong on multiple tables in the same direction — concluding
 * "NOT NULL, therefore it cannot be de-identified in place, therefore exclude
 * it from erasure" about columns that the database had already made nullable.
 * Every one of those conclusions leaves personal data alive after an erasure
 * request. `lib/security/migration-schema.ts` cannot see inside a DO block, and
 * neither can grep, and neither can a person.
 *
 * ── THE FIX IS GENERATION, NOT A BIGGER REGEX ──────────────────────────────
 * PGlite REPLAYS the migrations, so it EXECUTES the DO block. `pg_constraint`
 * afterwards is ground truth by construction. This test writes that truth to
 * `user-fk-behaviour.generated.txt` and fails when the file drifts.
 *
 * So the answer to "what happens to this column when the user leaves" is a file
 * you read, not a regex you write — the same reason
 * `tests/db/anon-rpc-surface.baseline.txt` exists. A guard that compares two
 * hand-maintained lists drifts in both directions at once and stays green.
 *
 * ── HOW TO USE IT ──────────────────────────────────────────────────────────
 * Deciding erasure for a table? Read this file for its columns FIRST.
 *   SET NULL  — de-identifies itself, but ONLY when a DELETE is actually issued.
 *               ⚠ Erasure ANONYMIZES in place (`auth.admin.updateUserById`,
 *               lib/erasure/purge.ts) and issues NO delete, so SET NULL does
 *               NOT fire on the erasure path. It fires for the anon-draft sweep,
 *               which does hard-delete. Do not read "SET NULL" as "already
 *               handled" — read it as "handled on the DELETE path only".
 *   CASCADE   — the row dies with the account. Usually means the row's whole
 *               reason for existing is the person, i.e. a SUBJECT row.
 *   NO ACTION — refuses the delete. Must carry a reason in
 *               `user-delete-refusing-fks.baseline.txt`.
 *
 * Regenerate: `UPDATE_FK_BEHAVIOUR=1 pnpm --filter @setnayan/web test:db`
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const GENERATED = path.join(__dirname, 'user-fk-behaviour.generated.txt');

const ACTION: Record<string, string> = {
  a: 'NO ACTION',
  r: 'RESTRICT',
  c: 'CASCADE',
  n: 'SET NULL',
  d: 'SET DEFAULT',
};

type Row = { tbl: string; col: string; parent: string; d: string; notnull: boolean };

async function behaviourRows(): Promise<Row[]> {
  const { rows } = await db.query<Row>(`
    SELECT con.conrelid::regclass::text        AS tbl,
           a.attname                           AS col,
           con.confrelid::regclass::text       AS parent,
           con.confdeltype                     AS d,
           a.attnotnull                        AS notnull
      FROM pg_constraint con
      JOIN pg_attribute a
        ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.confrelid IN ('auth.users'::regclass, 'public.users'::regclass)
       AND array_length(con.conkey, 1) = 1
     ORDER BY 1, 2
  `);
  return rows;
}

function render(rows: Row[]): string {
  const width = Math.min(
    64,
    rows.reduce((m, r) => Math.max(m, `${r.tbl}.${r.col}`.length), 0),
  );
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    const k = ACTION[r.d] ?? r.d;
    acc[k] = (acc[k] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts)
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join('  ');

  return [
    '# GENERATED — do not edit by hand.',
    '# `UPDATE_FK_BEHAVIOUR=1 pnpm --filter @setnayan/web test:db`',
    '#',
    '# What happens to each user-referencing column when an account is DELETED,',
    '# read from pg_constraint AFTER replaying every migration — so it reflects',
    '# the DO-block rewrites that the migration TEXT does not show.',
    '#',
    '# ⚠ SET NULL fires on DELETE only. RA 10173 erasure anonymizes in place and',
    '#   issues no delete, so a SET NULL column still holds the subject uuid',
    '#   after an erasure request. "SET NULL" never means "erasure handled it".',
    '#',
    `# ${rows.length} single-column FKs onto auth.users / public.users`,
    `# ${summary}`,
    '#',
    '# FORMAT  <table>.<column>  <on delete>  <NOT NULL|nullable>  -> <parent>',
    '',
    ...rows.map((r) => {
      const key = `${r.tbl}.${r.col}`.padEnd(width);
      const act = (ACTION[r.d] ?? r.d).padEnd(11);
      const nn = (r.notnull ? 'NOT NULL' : 'nullable').padEnd(8);
      return `${key}  ${act}  ${nn}  -> ${r.parent}`;
    }),
    '',
  ].join('\n');
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  if (!db) return;
  await db.close?.();
});

test('META · the replay really has both users tables and inbound FKs', async () => {
  // Anti-vacuity: an empty result must not be able to "pass" by matching an
  // empty file. This is the same failure the erasure guardrail's G0 guards.
  const rows = await behaviourRows();
  assert.ok(
    rows.length > 150,
    `only ${rows.length} user FKs found — the replay is broken, not the schema`,
  );
});

test('the generated FK-behaviour map is current', async () => {
  const next = render(await behaviourRows());

  if (process.env.UPDATE_FK_BEHAVIOUR === '1') {
    fs.writeFileSync(GENERATED, next, 'utf8');
    return;
  }

  const prev = fs.existsSync(GENERATED) ? fs.readFileSync(GENERATED, 'utf8') : '';
  if (prev === next) return;

  const p = prev.split('\n').filter((l) => l && !l.startsWith('#'));
  const n = next.split('\n').filter((l) => l && !l.startsWith('#'));
  const gone = p.filter((l) => !n.includes(l)).slice(0, 12);
  const added = n.filter((l) => !p.includes(l)).slice(0, 12);

  assert.fail(
    'The real ON DELETE behaviour of user-referencing columns changed.\n' +
      'This file is what erasure decisions are read from — regenerate it in the SAME PR:\n' +
      '  UPDATE_FK_BEHAVIOUR=1 pnpm --filter @setnayan/web test:db\n\n' +
      (gone.length ? `NO LONGER TRUE:\n  ${gone.join('\n  ')}\n\n` : '') +
      (added.length ? `NOW TRUE:\n  ${added.join('\n  ')}\n` : ''),
  );
});

test('the migration TEXT disagrees with the catalog — which is why this file exists', async () => {
  // Not a style point. If this ever stops being true, the DO-block rewrite was
  // undone and the whole rationale above needs rewriting rather than quietly
  // passing. `event_playlist_picks.created_by_user_id` is the canonical case:
  // declared `NOT NULL` with no ON DELETE clause in its CREATE TABLE, made
  // SET NULL + nullable at runtime by 20271032282809.
  const { rows } = await db.query<{ d: string; notnull: boolean }>(`
    SELECT con.confdeltype AS d, a.attnotnull AS notnull
      FROM pg_constraint con
      JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = con.conkey[1]
     WHERE con.contype = 'f'
       AND con.conrelid = 'public.event_playlist_picks'::regclass
       AND a.attname = 'created_by_user_id'
  `);
  assert.equal(rows.length, 1, 'event_playlist_picks.created_by_user_id lost its FK');
  assert.equal(
    rows[0]?.d,
    'n',
    'the canonical DO-block example is no longer SET NULL — re-read this file’s docblock before trusting it',
  );
  assert.equal(
    rows[0]?.notnull,
    false,
    'the canonical DO-block example is NOT NULL again — the migration text and the catalog now agree, so this guard is checking nothing',
  );
});
