/**
 * SEC-8b — no plaintext or encrypted credential may be reachable through
 *          PostgREST by a browser role.
 *
 * SEC-8 (20271009210000) closed `public.oauth_grants`. This is the sweep of
 * every credential column that was still SELECTable by `anon` or
 * `authenticated` afterwards. Migration: 20271010200000.
 *
 * Three tables, and they were NOT equally dangerous — the tests below assert
 * the same END STATE for all three, but the reasons differ and the comments
 * keep them apart so a future reader does not over- or under-react:
 *
 *   (1) `patiktok_oauth_grants` — THE EXPLOITABLE SHAPE. Plaintext
 *       `access_token` / `refresh_token`, table-level SELECT to both browser
 *       roles, and a PERMISSIVE row policy
 *       `couple_reads_patiktok_oauth_grants` (`event_id IN
 *       current_couple_event_ids()`) that ADMITS every couple member of the
 *       event to the row. Nothing then withheld the column, so
 *           GET /rest/v1/patiktok_oauth_grants?select=refresh_token
 *       would have returned a live TikTok credential to any couple member.
 *       Dormant only because the table holds 0 rows — Patiktok has issued no
 *       grants yet (`publishPatiktokCompilation` returns 'not-implemented').
 *
 *   (2) `platform_integration_secrets` — NINE `_enc` columns holding
 *       SETNAYAN'S OWN platform-wide credentials (Maya keys, OpenAI, Resend,
 *       TikTok/Google/YouTube client secrets), 1 live row. **Not currently
 *       reachable**: RLS is on and the table has ZERO policies, so both browser
 *       roles match no rows. Locked anyway — the only thing standing between
 *       the internet and every platform credential was the ABSENCE of a policy,
 *       so the day someone adds one for a good reason, nine secrets ship with
 *       it. Encrypted at rest lowers severity; it is not a reason to publish
 *       the ciphertext.
 *
 *   (3) `vendor_ig_connections.access_token_enc` — `authenticated` was already
 *       revoked, `anon` was not. Unreachable (no anon policy, 0 rows). Tidy-up
 *       of a half-applied revoke so the pair cannot drift.
 *
 * Same root cause as SEC-2b and SEC-8: **RLS is ROW-level and can never hide a
 * COLUMN.**
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * This repo has shipped vacuous DB tests twice: a connection that OWNS a table
 * skips RLS and column checks entirely, so a denial asserted from the owner
 * proves nothing. Every defence here is an assertion, not a comment:
 *
 *   META-1 · the probe session really is `authenticated` — not the table owner,
 *            not a superuser, no BYPASSRLS. Asserted BEFORE any denial.
 *   META-2 · the denied columns EXIST. A rename would make the SELECT fail too
 *            — with 42703, not 42501 — and the test would "pass" while guarding
 *            a column that is gone. Catalog check AND exact SQLSTATE asserted.
 *   META-3 · POSITIVE CONTROL. The same session, same table, successfully reads
 *            the couple-facing columns. Without it, a harness with no grants at
 *            all would look like a pass.
 *   META-4 · DIFFERENTIAL CONTROL. `service_role` — the role every real reader
 *            uses — still reads the credentials. Without it, a migration that
 *            broke the server would look like a pass.
 *
 * ── THE TRAP THIS FILE EXISTS TO CATCH ──────────────────────────────────────
 * A column-level REVOKE is a SILENT NO-OP wherever a table-level grant exists
 * (Postgres: "if a role has been granted privileges on a table, then revoking
 * the same privileges from individual columns will have no effect"). All three
 * tables held table-level SELECT in production, so the naive one-liner applies
 * without error and changes nothing. 20271010200000 therefore does
 * REVOKE-then-GRANT with the allow-list computed from LIVE privileges — correct
 * whether or not an earlier migration already narrowed the same table, and
 * dependent on the ordering of neither.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** Every credential column SEC-8b takes off the browser read surface. */
const SECRET_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['patiktok_oauth_grants', 'access_token'],
  ['patiktok_oauth_grants', 'refresh_token'],
  ['platform_integration_secrets', 'google_drive_oauth_client_secret_enc'],
  ['platform_integration_secrets', 'maya_public_api_key_enc'],
  ['platform_integration_secrets', 'maya_secret_api_key_enc'],
  ['platform_integration_secrets', 'meta_page_access_token_enc'],
  ['platform_integration_secrets', 'openai_api_key_enc'],
  ['platform_integration_secrets', 'resend_api_key_enc'],
  ['platform_integration_secrets', 'tiktok_access_token_enc'],
  ['platform_integration_secrets', 'tiktok_client_secret_enc'],
  ['platform_integration_secrets', 'youtube_oauth_client_secret_enc'],
  ['vendor_ig_connections', 'access_token_enc'],
];

/**
 * The couple-facing TikTok projection that must KEEP working —
 * `app/dashboard/[eventId]/studio/patiktok/page.tsx:159-164` renders
 * "Connected as @handle" from exactly these.
 */
const COUPLE_READABLE = ['tiktok_handle', 'tiktok_open_id', 'expires_at'] as const;

const TABLES = [
  'patiktok_oauth_grants',
  'platform_integration_secrets',
  'vendor_ig_connections',
] as const;

function sqlstate(e: unknown): string | undefined {
  return (e as { code?: string } | undefined)?.code;
}

/** Run `fn` with the session role switched, always resetting afterwards. */
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

test('META-1 · the probe role is a real unprivileged `authenticated` session', async () => {
  await asRole('authenticated', async () => {
    const who = await db.query<{ me: string; su: boolean; bypass: boolean }>(
      `SELECT current_user AS me,
              (SELECT rolsuper     FROM pg_roles WHERE rolname = current_user) AS su,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass`,
    );
    const row = who.rows[0]!;
    assert.equal(row.me, 'authenticated', 'SET ROLE did not take effect');
    assert.equal(row.su, false, 'a superuser skips every check below');
    assert.equal(row.bypass, false, 'BYPASSRLS would make the denials meaningless');
  });

  // Owning the table skips column privileges entirely — the exact way this repo
  // has shipped a vacuous DB test before.
  const owners = await db.query<{ relname: string; owner: string }>(
    `SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1)`,
    [TABLES as unknown as string[]],
  );
  assert.ok(owners.rows.length > 0, 'none of the target tables exist in the replay');
  for (const r of owners.rows) {
    assert.notEqual(r.owner, 'authenticated', `authenticated OWNS ${r.relname}`);
  }
});

test('META-2 · every denied column actually exists (a rename must not look like a fix)', async () => {
  for (const [tbl, col] of SECRET_COLUMNS) {
    const got = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [tbl, col],
    );
    assert.equal(got.rows[0]!.n, 1, `${tbl}.${col} does not exist — the denial guards nothing`);
  }
});

test('META-3 · POSITIVE CONTROL — the same session really can read the same table', async () => {
  await asRole('authenticated', async () => {
    await db.query(
      `SELECT ${COUPLE_READABLE.join(', ')} FROM public.patiktok_oauth_grants WHERE false`,
    );
  });
});

test('META-4 · DIFFERENTIAL CONTROL — `service_role` still reads every credential', async () => {
  await asRole('service_role', async () => {
    for (const [tbl, col] of SECRET_COLUMNS) {
      await db.query(`SELECT ${col} FROM public.${tbl} WHERE false`);
    }
  });
});

/* ── THE FINDING ────────────────────────────────────────────────────────── */

test('SEC-8b · no browser role may SELECT any credential column', async () => {
  for (const role of ['authenticated', 'anon']) {
    await asRole(role, async () => {
      for (const [tbl, col] of SECRET_COLUMNS) {
        await assert.rejects(
          () => db.query(`SELECT ${col} FROM public.${tbl} WHERE false`),
          (e: unknown) => {
            // 42501 = insufficient_privilege. Asserting the exact SQLSTATE is
            // what separates "denied" from "the column was renamed" (42703).
            assert.equal(
              sqlstate(e),
              '42501',
              `${role} reading ${tbl}.${col}: expected 42501, got ${sqlstate(e)}`,
            );
            return true;
          },
          `${role} can still SELECT ${tbl}.${col}`,
        );
      }
    });
  }
});

test('SEC-8b · `select *` cannot smuggle a credential out either', async () => {
  // The projection above names the column; a real attacker would just ask for
  // everything. Column privileges apply to `*` expansion too — assert it.
  for (const role of ['authenticated', 'anon']) {
    await asRole(role, async () => {
      for (const tbl of TABLES) {
        await assert.rejects(
          () => db.query(`SELECT * FROM public.${tbl} WHERE false`),
          (e: unknown) => sqlstate(e) === '42501',
          `${role} can still SELECT * from ${tbl}`,
        );
      }
    });
  }
});

/* ── WHAT MUST NOT BREAK ────────────────────────────────────────────────── */

test('the couple-facing TikTok "Connected as…" projection still works', async () => {
  await asRole('authenticated', async () => {
    for (const col of COUPLE_READABLE) {
      await db.query(`SELECT ${col} FROM public.patiktok_oauth_grants WHERE false`);
    }
  });
});

test('RLS stays ON — a column revoke is not a substitute for the row policy', async () => {
  const got = await db.query<{ relname: string; rls: boolean }>(
    `SELECT c.relname, c.relrowsecurity AS rls
       FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = ANY($1)`,
    [TABLES as unknown as string[]],
  );
  assert.equal(got.rows.length, TABLES.length, 'a target table is missing');
  for (const r of got.rows) {
    assert.equal(r.rls, true, `RLS is off on ${r.relname}`);
  }
});

test('SEC-8 is not regressed by this migration', async () => {
  // 20271010200000 recomputes allow-lists on OTHER tables. If it were ever
  // rewritten to compute from the full catalog instead of live privileges, the
  // sibling denial on oauth_grants could come back silently. Cheap to assert.
  await asRole('authenticated', async () => {
    await assert.rejects(
      () => db.query(`SELECT refresh_token FROM public.oauth_grants WHERE false`),
      (e: unknown) => sqlstate(e) === '42501',
      'SEC-8 oauth_grants.refresh_token denial regressed',
    );
  });
});
