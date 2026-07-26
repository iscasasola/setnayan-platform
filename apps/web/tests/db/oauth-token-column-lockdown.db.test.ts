/**
 * SEC-8 — a live Google refresh token must not be reachable through PostgREST.
 *
 * `public.oauth_grants` stores plaintext `refresh_token` / `access_token`. In
 * production, table-level SELECT was granted to BOTH `anon` and
 * `authenticated`, and every column of the table answered `true` to
 * `has_column_privilege(..., 'SELECT')` for both roles. RLS was on, but its two
 * policies are ROW policies — and the couple-read one,
 * `event_member_reads_oauth_grants`, ADMITS every couple member of the event to
 * the row. Nothing then withheld the column, so
 *
 *     GET /rest/v1/oauth_grants?select=refresh_token
 *
 * returned a live, long-lived Google credential to any couple member, with
 * curl, without ever loading a Setnayan page. Same root cause as SEC-2b:
 * **RLS is ROW-level and can never hide a COLUMN.**
 *
 * The fix is a column revoke (20271009210000), plus the matching lockdown of
 * the two erasure-attribution columns added by 20271009200000 — which shipped
 * OPEN because this project carries
 * `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon,
 * authenticated`, so every new column arrives with `arwdDxtm` for the browser.
 *
 * ── WHY THIS TEST IS NOT VACUOUS ────────────────────────────────────────────
 * This repo has shipped vacuous DB tests twice: a connection that OWNS a table
 * skips RLS and column checks entirely, so a denial asserted from the owner
 * proves nothing at all. Every defence here is an assertion, not a comment:
 *
 *   META-1 · the probe session really is `authenticated` — not the table owner,
 *            not a superuser, and without BYPASSRLS. Asserted BEFORE any
 *            denial is claimed. (Contrast erasure-completeness.db.test.ts's own
 *            META-1, which pins the OPPOSITE fact for a different reason: the
 *            purge runs as service_role by design.)
 *   META-2 · the denied columns EXIST in the catalog. A rename would make
 *            `SELECT refresh_token` fail too — with 42703, not 42501 — and the
 *            test would "pass" while guarding a column that is no longer there.
 *            Both the catalog check and an exact SQLSTATE check are asserted.
 *   META-3 · POSITIVE CONTROL. The same `authenticated` session, in the same
 *            transaction, successfully reads the couple-facing columns off the
 *            same table. Without this, a broken harness (no grants at all, a
 *            missing table, a dead connection) would look like a perfect fix.
 *   META-4 · DIFFERENTIAL CONTROL. `service_role` — the role every real token
 *            reader uses — CAN still read both tokens. This is what proves the
 *            revoke is column-and-role-scoped rather than a blanket lockout
 *            that would break the refresh cron, both OAuth callbacks and all
 *            three disconnect routes.
 *
 * ── NEUTRALISATION PROOF (run 2026-07-26, reverted and re-verified) ─────────
 *   Baseline: 8 subtests, 8 pass.
 *   N1 · delete the whole SEC-8 DO block from 20271009210000 (the REVOKE
 *        SELECT → GRANT SELECT(allow-list) cycle) and its post-conditions.
 *        → 2 of 8 FAIL: "authenticated cannot SELECT the Google credentials"
 *          and "the deny-set is exactly the two credential columns".
 *        → the exposure freeze does NOT catch this one: removing a revoke is a
 *          WIDENING relative to the branch but the baseline is regenerated in
 *          the same PR, so only this test speaks for it.
 *   N2 · replace the REVOKE-then-GRANT cycle with the naive
 *          REVOKE SELECT (refresh_token, access_token) ... FROM anon, authenticated;
 *        which is what a reasonable person writes first. Postgres accepts it and
 *        it changes NOTHING ("if a role has been granted privileges on a table,
 *        then revoking the same privileges from individual columns will have no
 *        effect").
 *        → the migration's own post-condition (a) RAISEs, so the replay throws
 *          and all 8 subtests fail before asserting anything. The no-op cannot
 *          ship even if this file were deleted.
 *   N3 · drop the `granted_by_user_id` / `subject_user_id` lockdown block from
 *        20271009200000.
 *        → 1 of 8 FAILS: "the erasure-attribution columns are server-only".
 *        → and the exposure freeze goes red with the two `anon=SIU
 *          authenticated=SIU` lines this PR was blocked on.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';

import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

/** The plaintext credentials SEC-8 closes. */
const SECRET_COLUMNS = ['refresh_token', 'access_token'] as const;

/**
 * The couple-facing projection that must KEEP working. Superset of every
 * browser read in apps/web: the Panood setup page's
 * `grant_id, external_account_id, external_account_display, granted_at, metadata`,
 * the Papic + Photo-Delivery `connection_health` panels, and the several
 * `select('grant_id')` existence probes.
 */
const COUPLE_READABLE = [
  'grant_id',
  'event_id',
  'provider',
  'scopes',
  'access_token_expires_at',
  'external_account_id',
  'external_account_display',
  'granted_at',
  'revoked_at',
  'last_refreshed_at',
  'metadata',
  'connection_health',
] as const;

/** Server-attributed erasure-control columns — no browser role may touch them. */
const ATTRIBUTION_COLUMNS: ReadonlyArray<readonly [string, string]> = [
  ['oauth_grants', 'granted_by_user_id'],
  ['event_paperwork', 'subject_user_id'],
];

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
    assert.equal(row.su, false, 'probe role is a superuser — every denial below would be fiction');
    assert.equal(row.bypass, false, 'probe role has BYPASSRLS — the probe would be vacuous');

    // Owners skip column privileges entirely. If `authenticated` owned either
    // table, a passing denial would prove nothing.
    const owners = await db.query<{ relname: string; owner: string }>(
      `SELECT c.relname, pg_get_userbyid(c.relowner) AS owner
         FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname IN ('oauth_grants', 'event_paperwork')`,
    );
    assert.equal(owners.rows.length, 2, 'expected both tables to exist in the replayed schema');
    for (const r of owners.rows) {
      assert.notEqual(r.owner, 'authenticated', `probe role owns ${r.relname} — owners skip column checks`);
    }
  });
});

test('META-2 · the columns under test actually exist (a rename must not look like a fix)', async () => {
  const cols = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'oauth_grants'`,
  );
  const present = new Set(cols.rows.map((r) => r.column_name));
  for (const c of [...SECRET_COLUMNS, ...COUPLE_READABLE]) {
    assert.ok(present.has(c), `oauth_grants.${c} does not exist — this test is guarding a ghost`);
  }
  for (const [tbl, col] of ATTRIBUTION_COLUMNS) {
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [tbl, col],
    );
    assert.equal(r.rows[0]!.n, 1, `${tbl}.${col} does not exist`);
  }
});

test('META-3 · POSITIVE CONTROL — the same session really can read the same table', async () => {
  await asRole('authenticated', async () => {
    // If this throws, every "permission denied" below is explained by a broken
    // harness rather than by the revoke, and the test proves nothing.
    for (const c of COUPLE_READABLE) {
      await db.query(`SELECT "${c}" FROM public.oauth_grants LIMIT 1`);
    }
  });
});

/* ── THE FINDING ────────────────────────────────────────────────────────── */

test('SEC-8 · `authenticated` CANNOT SELECT the Google credentials', async () => {
  await asRole('authenticated', async () => {
    for (const c of SECRET_COLUMNS) {
      await assert.rejects(
        db.query(`SELECT "${c}" FROM public.oauth_grants LIMIT 1`),
        (e: unknown) => {
          // 42501 = insufficient_privilege. Asserting the exact SQLSTATE is
          // what separates a real denial from 42703 (undefined_column), which
          // a rename would produce and which must NOT count as a pass.
          assert.equal(
            sqlstate(e),
            '42501',
            `expected insufficient_privilege reading oauth_grants.${c}, got ${sqlstate(e)}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
          return true;
        },
        `authenticated could still read oauth_grants.${c} — a live Google credential`,
      );
    }

    // `SELECT *` is the shape PostgREST emits for `?select=*`, and the one a
    // curl-wielding stranger reaches for first. It must be refused too.
    await assert.rejects(
      db.query('SELECT * FROM public.oauth_grants LIMIT 1'),
      (e: unknown) => sqlstate(e) === '42501',
      'SELECT * still returns the token columns',
    );
  });
});

test('SEC-8 · `anon` CANNOT SELECT the Google credentials either', async () => {
  // anon was never the live exposure — no policy names it, so it matches zero
  // rows. It is revoked anyway so that a future `TO public` policy is not the
  // thing that decides whether a credential is world-readable.
  await asRole('anon', async () => {
    for (const c of SECRET_COLUMNS) {
      await assert.rejects(
        db.query(`SELECT "${c}" FROM public.oauth_grants LIMIT 1`),
        (e: unknown) => sqlstate(e) === '42501',
        `anon could still read oauth_grants.${c}`,
      );
    }
  });
});

test('META-4 · DIFFERENTIAL CONTROL — `service_role` CAN still read both tokens', async () => {
  // Every real reader (the refresh cron, lib/drive-copy.ts,
  // lib/photo-delivery-release.ts, the three disconnect routes and the
  // photo-delivery disconnect action) runs on createAdminClient(). If this
  // fails, the revoke has broken Drive/YouTube connect, refresh and disconnect.
  await asRole('service_role', async () => {
    for (const c of SECRET_COLUMNS) {
      await db.query(`SELECT "${c}" FROM public.oauth_grants LIMIT 1`);
    }
    await db.query('SELECT * FROM public.oauth_grants LIMIT 1');
  });
});

test('SEC-8 · the deny-set is EXACTLY the two credential columns, per the catalog', async () => {
  const rows = await db.query<{ attname: string; a: boolean; an: boolean; svc: boolean }>(`
    SELECT a.attname,
           has_column_privilege('authenticated', c.oid, a.attnum, 'SELECT') AS a,
           has_column_privilege('anon',          c.oid, a.attnum, 'SELECT') AS an,
           has_column_privilege('service_role',  c.oid, a.attnum, 'SELECT') AS svc
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid
     WHERE n.nspname = 'public' AND c.relname = 'oauth_grants'
       AND a.attnum > 0 AND NOT a.attisdropped
     ORDER BY a.attnum
  `);
  assert.ok(rows.rows.length >= 12, 'oauth_grants lost columns — the schema moved under this test');

  const deniedToBrowser = rows.rows.filter((r) => !r.a || !r.an).map((r) => r.attname).sort();
  assert.deepEqual(
    deniedToBrowser,
    // granted_by_user_id is locked by 20271009200000 (it is an erasure-control
    // input, not user data); the two tokens by 20271009210000.
    ['access_token', 'granted_by_user_id', 'refresh_token'],
    'the browser deny-set on oauth_grants is not what this PR intends',
  );

  // The server keeps everything — asserted per column so a partial revoke on
  // service_role cannot hide inside an aggregate.
  for (const r of rows.rows) {
    assert.equal(r.svc, true, `service_role lost SELECT on oauth_grants.${r.attname}`);
  }
});

test('SEC-8 · the erasure-attribution columns are server-only (SELECT, INSERT and UPDATE)', async () => {
  // UPDATE is the load-bearing one and it is the SEC-6 shape: a host-writable
  // field feeding a server decision. event_paperwork's host policies are TO
  // PUBLIC with cmd=UPDATE, so a host really can PATCH their own rows — and a
  // writable `subject_user_id` would let them stamp the CO-PARTNER'S user id
  // onto their own paperwork, so erasure destroys the co-partner's PSA/CENOMAR
  // scan on the attacker's say-so. That is the exact harm the column exists to
  // prevent, handed back through the front door.
  const bad: string[] = [];
  for (const [tbl, col] of ATTRIBUTION_COLUMNS) {
    for (const priv of ['SELECT', 'INSERT', 'UPDATE']) {
      for (const role of ['authenticated', 'anon']) {
        const r = await db.query<{ ok: boolean }>(
          `SELECT has_column_privilege($1, $2, $3, $4) AS ok`,
          [role, `public.${tbl}`, col, priv],
        );
        if (r.rows[0]!.ok) bad.push(`${role} can ${priv} ${tbl}.${col}`);
      }
      const svc = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege('service_role', $1, $2, $3) AS ok`,
        [`public.${tbl}`, col, priv],
      );
      if (!svc.rows[0]!.ok) bad.push(`service_role LOST ${priv} on ${tbl}.${col}`);
    }
  }
  assert.deepEqual(bad, [], `attribution columns are not server-only:\n  ${bad.join('\n  ')}`);
});

test('SEC-8 · the host paperwork surface survived the event_paperwork revoke', async () => {
  // The revoke on event_paperwork is a REVOKE-then-GRANT cycle on the whole
  // table, so it is capable of taking away far more than one column. These are
  // the columns paperwork/actions.ts and the dashboard read and write through
  // the SESSION client under the event_paperwork_host_* policies.
  const readWrite = [
    'id', 'event_id', 'document_type', 'status', 'requested_at', 'received_at',
    'expected_completion_date', 'expires_at', 'tracking_reference',
    'document_r2_key', 'notes', 'created_at', 'updated_at',
  ];
  const bad: string[] = [];
  for (const c of readWrite) {
    for (const priv of ['SELECT', 'UPDATE']) {
      const r = await db.query<{ ok: boolean }>(
        `SELECT has_column_privilege('authenticated', 'public.event_paperwork', $1, $2) AS ok`,
        [c, priv],
      );
      if (!r.rows[0]!.ok) bad.push(`host lost ${priv} on event_paperwork.${c}`);
    }
  }
  // The seed upsert (seedPaperworkForEvent) posts exactly these four.
  for (const c of ['event_id', 'document_type', 'status', 'expected_completion_date']) {
    const r = await db.query<{ ok: boolean }>(
      `SELECT has_column_privilege('authenticated', 'public.event_paperwork', $1, 'INSERT') AS ok`,
      [c],
    );
    if (!r.rows[0]!.ok) bad.push(`host lost INSERT on event_paperwork.${c}`);
  }
  assert.deepEqual(bad, [], `the paperwork checklist would break:\n  ${bad.join('\n  ')}`);
});
