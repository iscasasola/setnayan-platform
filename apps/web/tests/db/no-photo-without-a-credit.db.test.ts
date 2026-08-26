/**
 * A PAPIC PHOTO CANNOT BE MINTED AROUND THE METER.
 *
 * ── WHAT THIS GUARDS ───────────────────────────────────────────────────────
 * `recordSeatCapture` weighs every seat capture: a burst limiter, the
 * 10-second clip cap, the capture window, the paid-order gate, the put-away
 * gate, the RA 10173 geo control, and the atomic credit reservation. Until
 * 2026-08-26 the row it wrote went in through the CLAIMER'S OWN SESSION while
 * `authenticated` held INSERT on the table — so the whole list could be skipped
 * by POSTing to /rest/v1/papic_photos with the public anon key.
 *
 * 🔑 AND THE GRANT WAS INVISIBLE WHERE ANYONE WOULD LOOK. It was held on all 39
 * grantable COLUMNS, not on the table, so `has_table_privilege(...,'INSERT')`
 * answered FALSE and `role_table_grants` listed nothing. A table-level audit
 * called it closed while it was open. That is why rule 1 below asks the
 * question TWICE, in both shapes, and why rule 2 asks it of every column that
 * exists rather than of a list somebody typed.
 *
 * ── WHAT THIS IS NOT ───────────────────────────────────────────────────────
 * ⚠ It is NOT a claim that anything was forged. Prod held 14 papic_photos rows
 * when this was found and every one came through the metered path.
 *
 * ⚠ It does NOT assert that a photo and its credit are ATOMIC. They are not —
 * the reservation and the insert are still two steps with an application-side
 * unwind, and a process that dies between them leaks the credits it reserved.
 * That errs against us rather than against the meter. The repair is a
 * SECURITY DEFINER record function; until it exists, nobody should read this
 * file as proof of an invariant it does not test.
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
  await replay?.close?.();
});

const CALLER_ROLES = ['authenticated', 'anon'] as const;

test('1 · neither browser role can insert a papic photo — asked at TABLE level', async () => {
  for (const role of CALLER_ROLES) {
    const { rows } = await db.query<{ ok: boolean }>(
      `SELECT has_table_privilege($1, 'public.papic_photos', 'INSERT') AS ok`,
      [role],
    );
    assert.equal(
      rows[0]?.ok,
      false,
      `${role} holds table-level INSERT on papic_photos — every gate in ` +
        `recordSeatCapture becomes optional. Do not grant it back; a policy ` +
        `cannot count credits.`,
    );
  }
});

test('2 · …and asked again per COLUMN, which is where it was actually hiding', async () => {
  const { rows: cols } = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'papic_photos'`,
  );

  // Anti-vacuity. A typo in the table name returns zero columns and this file
  // then proves nothing while printing four passes.
  assert.ok(
    cols.length >= 20,
    `only ${cols.length} columns found on papic_photos — the census read nothing, ` +
      `so the per-column check below is vacuous`,
  );

  const open: string[] = [];
  for (const role of CALLER_ROLES) {
    for (const { column_name } of cols) {
      const { rows } = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege($1, 'public.papic_photos', $2, 'INSERT') AS ok`,
        [role, column_name],
      );
      if (rows[0]?.ok) open.push(`${role}.${column_name}`);
    }
  }

  assert.deepEqual(
    open,
    [],
    `column-level INSERT survives on papic_photos: ${open.join(', ')}. This is ` +
      `the exact shape the original hole had — revoke at TABLE level, which ` +
      `drops the column grants, or a column added later arrives granted.`,
  );
});

test('3 · no policy on papic_photos declares an INSERT arm', async () => {
  const { rows } = await db.query<{ policyname: string; cmd: string }>(
    `SELECT policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'papic_photos'`,
  );

  assert.ok(rows.length >= 3, 'no policies read back — the query matched nothing');

  const inserting = rows
    .filter((r) => r.cmd === 'INSERT' || r.cmd === 'ALL')
    .map((r) => `${r.policyname}(${r.cmd})`);

  assert.deepEqual(
    inserting,
    [],
    `these policies still say INSERT is admitted: ${inserting.join(', ')}. With ` +
      `the grant gone the arm is unreachable — but a FOR ALL policy is how the ` +
      `next reader concludes the door is open and writes code through it.`,
  );
});

test('4 · the claimer keeps the three verbs the camera actually uses', async () => {
  const { rows } = await db.query<{ policyname: string; cmd: string }>(
    `SELECT policyname, cmd FROM pg_policies
      WHERE schemaname = 'public' AND tablename = 'papic_photos'
        AND policyname LIKE 'papic_photos_claimer_%'`,
  );

  const byCmd = new Set(rows.map((r) => r.cmd));
  for (const verb of ['SELECT', 'UPDATE', 'DELETE']) {
    assert.ok(
      byCmd.has(verb),
      `the claimer lost ${verb} on papic_photos. The seat capture UI counts its ` +
        `own shots (SELECT), stamps the web copy of a clip (UPDATE) and reads ` +
        `back what it wrote — closing INSERT must not close those with it.`,
    );
  }
});
