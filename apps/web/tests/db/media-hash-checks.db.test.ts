/**
 * `public.media_hash_checks` — the CSAM known-hash audit table.
 *
 * Migration: 20271029279897_known_hash_match_checks.sql
 *
 * This table records whether a known-hash lookup ran on an uploaded still and
 * what it returned. It exists because the matcher was NEVER BUILT — Papic
 * Phase 3 was gated on it, the gate was waived on 2026-08-01, and the gap
 * turned out to predate the gate and apply to weddings too. The table's job is
 * to make that absence visible and countable instead of invisible.
 *
 * ── WHAT THIS FILE GUARDS ───────────────────────────────────────────────────
 *
 *   1. DENY-ALL. The rows say, per object, that nothing checked it. That is an
 *      inventory of unprotected media plus a content fingerprint of each item,
 *      and it must not be reachable by a browser role. Supabase's default ACL
 *      grants `arwdDxtm` on every new `public` table to anon + authenticated,
 *      and `REVOKE … FROM PUBLIC` does NOT remove those explicit role grants —
 *      a migration that only revokes PUBLIC ships the table wide open with a
 *      green CI. So the revoke is asserted PER NAMED ROLE.
 *
 *   2. NO "CLEAN" STATUS, ENFORCED BY THE DATABASE. The whole design rests on
 *      there being no value meaning "checked and fine" that an absent check
 *      could be written as. lib/known-hash-match.test.ts proves the TypeScript
 *      predicate; this proves the CHECK constraint, so the guarantee survives a
 *      writer that bypasses the module.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * A connection that OWNS a table skips RLS and privilege checks entirely, so a
 * denial asserted from the owner proves nothing (this repo has shipped that
 * mistake before). Every defence here is an assertion:
 *
 *   META-1 · the probe session really is anon / authenticated — not the owner,
 *            not a superuser, no BYPASSRLS.
 *   META-2 · the table EXISTS. If it did not, every denial below would still
 *            "pass" (42P01 instead of 42501), guarding nothing. Catalog check
 *            AND exact SQLSTATE asserted.
 *   META-3 · DIFFERENTIAL CONTROL — `service_role`, the role the real writer
 *            uses, CAN insert and read. Without it, a migration that revoked
 *            everything from everyone would look like a pass.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const TABLE = 'media_hash_checks';
const BROWSER_ROLES = ['anon', 'authenticated'] as const;

function sqlstate(e: unknown): string | undefined {
  return (e as { code?: string } | undefined)?.code;
}

async function asRole<T>(role: string, fn: () => Promise<T>): Promise<T> {
  await db.exec(`SET ROLE ${role}`);
  try {
    return await fn();
  } finally {
    await db.exec('RESET ROLE');
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await replay?.db?.close?.();
});

/* ── META ───────────────────────────────────────────────────────────────── */

test('META-1 · the probe roles are real unprivileged sessions that do not own the table', async () => {
  for (const role of BROWSER_ROLES) {
    await asRole(role, async () => {
      const who = await db.query<{ me: string; su: boolean; bypass: boolean }>(
        `SELECT current_user AS me,
                (SELECT rolsuper     FROM pg_roles WHERE rolname = current_user) AS su,
                (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass`,
      );
      const row = who.rows[0]!;
      assert.equal(row.me, role, 'SET ROLE did not take effect');
      assert.equal(row.su, false, 'a superuser skips every check below');
      assert.equal(row.bypass, false, 'BYPASSRLS would make the denials meaningless');
    });
  }

  const owner = await db.query<{ owner: string }>(
    `SELECT pg_get_userbyid(c.relowner) AS owner
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = $1`,
    [TABLE],
  );
  assert.equal(owner.rows.length, 1, `public.${TABLE} does not exist in the replay`);
  for (const role of BROWSER_ROLES) {
    assert.notEqual(owner.rows[0]!.owner, role, `${role} OWNS ${TABLE}`);
  }
});

test('META-2 · the table and every guarded column exist', async () => {
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1`,
    [TABLE],
  );
  const present = new Set(cols.rows.map((r) => r.column_name));
  for (const col of [
    'check_id',
    'subject_table',
    'r2_object_key',
    'event_id',
    'status',
    'provider_id',
    'perceptual_hash',
    'checked_at',
  ]) {
    assert.ok(present.has(col), `${TABLE}.${col} is missing — the guards below mean nothing`);
  }
});

test('META-3 · DIFFERENTIAL CONTROL — service_role can write and read', async () => {
  await asRole('service_role', async () => {
    await db.query(
      `INSERT INTO public.${TABLE} (subject_table, r2_object_key, status, provider_id)
       VALUES ('papic_photos', 'meta3/probe.jpg', 'not_enrolled', NULL)`,
    );
    const got = await db.query<{ status: string }>(
      `SELECT status FROM public.${TABLE} WHERE r2_object_key = 'meta3/probe.jpg'`,
    );
    assert.equal(got.rows[0]!.status, 'not_enrolled');
  });
});

/* ── 1 · DENY-ALL, PER NAMED ROLE ───────────────────────────────────────── */

test('anon and authenticated hold NO table privilege — catalog view', async () => {
  for (const role of BROWSER_ROLES) {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'REFERENCES', 'TRIGGER', 'TRUNCATE']) {
      const got = await db.query<{ ok: boolean }>(
        `SELECT has_table_privilege($1, $2, $3) AS ok`,
        [role, `public.${TABLE}`, priv],
      );
      assert.equal(
        got.rows[0]!.ok,
        false,
        `${role} still holds ${priv} on ${TABLE} — REVOKE FROM PUBLIC does not remove a role grant`,
      );
    }
  }
});

test('anon and authenticated are DENIED at runtime with 42501, not 42P01', async () => {
  // The SQLSTATE matters: 42P01 (undefined_table) would mean the table vanished
  // and the "denial" is an artefact, which is exactly how a guard rots into a
  // no-op after a rename.
  for (const role of BROWSER_ROLES) {
    await asRole(role, async () => {
      for (const stmt of [
        `SELECT * FROM public.${TABLE} WHERE false`,
        `INSERT INTO public.${TABLE} (subject_table, r2_object_key, status) VALUES ('x', 'y', 'not_enrolled')`,
        `UPDATE public.${TABLE} SET status = 'no_match' WHERE false`,
        `DELETE FROM public.${TABLE} WHERE false`,
      ]) {
        await assert.rejects(
          () => db.query(stmt),
          (e: unknown) => {
            assert.equal(
              sqlstate(e),
              '42501',
              `expected insufficient_privilege for ${role}, got ${sqlstate(e)}`,
            );
            return true;
          },
          `${role} was not denied: ${stmt}`,
        );
      }
    });
  }
});

test('the id sequence is closed to browser roles too', async () => {
  // An open sequence is not a read of the data, but it leaks the row count —
  // i.e. how much media exists — and it is the sort of half-applied revoke that
  // drifts. Named per role for the same reason as the table grants.
  for (const role of BROWSER_ROLES) {
    for (const priv of ['USAGE', 'SELECT', 'UPDATE']) {
      const got = await db.query<{ ok: boolean }>(
        `SELECT has_sequence_privilege($1, $2, $3) AS ok`,
        [role, `public.${TABLE}_check_id_seq`, priv],
      );
      assert.equal(got.rows[0]!.ok, false, `${role} still holds ${priv} on the id sequence`);
    }
  }
});

test('RLS is enabled with ZERO policies — deny-all, not policy-shaped', async () => {
  const rls = await db.query<{ on: boolean }>(
    `SELECT relrowsecurity AS on FROM pg_class WHERE oid = $1::regclass`,
    [`public.${TABLE}`],
  );
  assert.equal(rls.rows[0]!.on, true, 'RLS must be enabled at CREATE TABLE time');

  const policies = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM pg_policies WHERE schemaname = 'public' AND tablename = $1`,
    [TABLE],
  );
  assert.equal(policies.rows[0]!.n, 0, 'a policy here would be a silent widening');
});

/* ── 2 · NO "CLEAN" STATUS — ENFORCED BY THE DATABASE ───────────────────── */

test('the status CHECK rejects any "clean"/"pass"-flavoured value', async () => {
  // This is the load-bearing assertion of the whole feature. The TypeScript
  // predicate is one layer; this is the layer that survives a writer which
  // never imports the module.
  await asRole('service_role', async () => {
    for (const bogus of ['clean', 'pass', 'ok', 'safe', 'approved', 'unscreened', '']) {
      await assert.rejects(
        () =>
          db.query(
            `INSERT INTO public.${TABLE} (subject_table, r2_object_key, status, provider_id)
             VALUES ('papic_photos', $1, $2, 'x')`,
            [`bogus/${bogus || 'empty'}.jpg`, bogus],
          ),
        (e: unknown) => {
          assert.equal(sqlstate(e), '23514', `"${bogus}" was accepted as a status`);
          return true;
        },
        `status "${bogus}" must not be storable`,
      );
    }
  });
});

/**
 * The provider_id each status must carry — mirrors both
 * `media_hash_checks_provider_coherent` and `hashCheckProviderId()` in
 * lib/known-hash-match.ts. The two must not drift: if they do, the module
 * builds rows the database rejects, the write fails, and an UNCHECKED object
 * ends up UNRECORDED — the one outcome this table exists to prevent.
 */
const STORABLE: ReadonlyArray<readonly [string, string | null]> = [
  ['not_enrolled', null],
  ['unsupported', null],
  ['no_match', 'probe'],
  ['match', 'probe'],
  ['unavailable', 'probe'],
];

test('all five legitimate statuses are storable with their coherent provider_id', async () => {
  await asRole('service_role', async () => {
    for (const [status, providerId] of STORABLE) {
      await db.query(
        `INSERT INTO public.${TABLE} (subject_table, r2_object_key, status, provider_id)
         VALUES ('papic_photos', $1, $2, $3)`,
        [`ok/${status}.jpg`, status, providerId],
      );
    }
    const got = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.${TABLE} WHERE r2_object_key LIKE 'ok/%'`,
    );
    assert.equal(got.rows[0]!.n, STORABLE.length);
  });
});

test('unsupported with NO provider is storable — an unchecked object must never go unrecorded', async () => {
  // REGRESSION GUARD. The first cut of the CHECK read
  //   (status = 'not_enrolled' AND provider_id IS NULL)
  //   OR (status <> 'not_enrolled' AND provider_id IS NOT NULL)
  // which made ('unsupported', NULL) — the exact row produced by an
  // undecodable still while no provider is enrolled, i.e. the common case —
  // unwritable. The hook would have declined the write and the object would
  // have gone through unchecked AND uncounted.
  await asRole('service_role', async () => {
    await db.query(
      `INSERT INTO public.${TABLE} (subject_table, r2_object_key, status, provider_id)
       VALUES ('papic_guest_captures', 'regression/posterless-clip.mp4', 'unsupported', NULL)`,
    );
    const got = await db.query<{ status: string }>(
      `SELECT status FROM public.${TABLE} WHERE r2_object_key = 'regression/posterless-clip.mp4'`,
    );
    assert.equal(got.rows[0]!.status, 'unsupported');
  });
});

test('provider coherence — a provider outcome cannot be claimed without naming the provider', async () => {
  await asRole('service_role', async () => {
    // These three statuses ASSERT that a provider was reached. Without an id
    // the row would read as "something examined this" while recording nothing
    // that could have.
    for (const status of ['no_match', 'match', 'unavailable']) {
      await assert.rejects(
        () =>
          db.query(
            `INSERT INTO public.${TABLE} (subject_table, r2_object_key, status, provider_id)
             VALUES ('papic_photos', $1, $2, NULL)`,
            [`incoherent/${status}.jpg`, status],
          ),
        (e: unknown) => (assert.equal(sqlstate(e), '23514'), true),
        `${status} must require a provider_id`,
      );
    }
    // And the converse: these two assert nothing ran, so naming a provider is a
    // contradiction.
    for (const status of ['not_enrolled', 'unsupported']) {
      await assert.rejects(
        () =>
          db.query(
            `INSERT INTO public.${TABLE} (subject_table, r2_object_key, status, provider_id)
             VALUES ('papic_photos', $1, $2, 'photodna')`,
            [`incoherent/${status}-named.jpg`, status],
          ),
        (e: unknown) => (assert.equal(sqlstate(e), '23514'), true),
        `${status} must forbid a provider_id`,
      );
    }
  });
});

test('one CURRENT row per object — the hook upserts rather than accumulating', async () => {
  await asRole('service_role', async () => {
    await db.query(
      `INSERT INTO public.${TABLE} (subject_table, r2_object_key, status, provider_id)
       VALUES ('papic_photos', 'upsert/a.jpg', 'not_enrolled', NULL)`,
    );
    // Same object again -> the unique index makes this an update, not a second row.
    await db.query(
      `INSERT INTO public.${TABLE} (subject_table, r2_object_key, status, provider_id)
         VALUES ('papic_photos', 'upsert/a.jpg', 'no_match', 'probe')
       ON CONFLICT (subject_table, r2_object_key)
       DO UPDATE SET status = EXCLUDED.status, provider_id = EXCLUDED.provider_id`,
    );
    const got = await db.query<{ n: number; status: string }>(
      `SELECT count(*)::int AS n, max(status) AS status
         FROM public.${TABLE} WHERE r2_object_key = 'upsert/a.jpg'`,
    );
    assert.equal(got.rows[0]!.n, 1, 'the unique index did not collapse the re-check');
    assert.equal(got.rows[0]!.status, 'no_match');

    // The SAME key under a DIFFERENT subject table is a different object.
    await db.query(
      `INSERT INTO public.${TABLE} (subject_table, r2_object_key, status, provider_id)
       VALUES ('papic_guest_captures', 'upsert/a.jpg', 'not_enrolled', NULL)`,
    );
    const both = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.${TABLE} WHERE r2_object_key = 'upsert/a.jpg'`,
    );
    assert.equal(both.rows[0]!.n, 2);
  });
});
