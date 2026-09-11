/**
 * TWO GRANTS A BROWSER NEVER NEEDED — migration 20271222518385, proven as REAL
 * `anon` / `authenticated` sessions (SET ROLE + JWT claims), never the
 * superuser the replay otherwise runs as.
 *
 *   1 · TRUNCATE on public.chat_threads (N4, #5435) — RLS is never consulted
 *       for TRUNCATE, so the only fence is the grant.
 *   2 · SELECT on vendor_profiles.next_renewal_due_at for a signed-in account
 *       (L3, #5433) — the Verified badge's deadline, which tells a 182-day vouch
 *       from a one-year approval for every verified shop.
 *
 * 🔑 Each refusal sits beside a positive control in the SAME session (the rest
 * of the table still works), and each is NEUTRALISED once: the grant handed back
 * inside a rolled-back transaction makes the same statement land, so "refused"
 * means the revoke, not a fixture that never matched.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271222518385_two_grants_a_browser_never_needed.sql';
const F = { shopUser: '', stranger: '', vendorId: '' };

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}

/** Run `sql` as `who` inside a rolled-back transaction; `grantBack` runs first as the owner. */
async function as(
  who: { role: 'anon' | 'authenticated' | 'service_role'; uid?: string },
  sql: string,
  params: unknown[] = [],
  grantBack = '',
): Promise<{ err: string | null; rows: Record<string, unknown>[] }> {
  await db.exec('BEGIN');
  try {
    if (grantBack) await db.exec(grantBack);
    if (who.uid) await setAuthUid(db, who.uid);
    await setRole(who.role);
    await db.exec(`SET ROLE ${who.role}`);
    const r = await db.query<Record<string, unknown>>(sql, params);
    return { err: null, rows: r.rows };
  } catch (e) {
    return { err: (e as Error).message, rows: [] };
  } finally {
    await db.exec('RESET ROLE').catch(() => {});
    await db.exec('ROLLBACK').catch(() => {});
    await reset();
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
  await reset();
  const mkUser = async (email: string, t: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', $2::text)) RETURNING id`,
        [email, t],
      )
    ).rows[0]!.id;
  F.shopUser = await mkUser('grants-shop@n5.test', 'vendor');
  F.stranger = await mkUser('grants-stranger@n5.test', 'customer');
  // A verified, published shop — the public read policy admits its ROW to any
  // signed-in caller, so a refusal below is about the COLUMN.
  F.vendorId = (
    await db.query<{ v: string }>(
      `INSERT INTO public.vendor_profiles
         (user_id, business_name, location_city, services, verification_state, last_verified_at, is_published)
       VALUES ($1, 'Grants Test Studio', 'Manila', ARRAY['photography']::text[],
               'verified'::public.vendor_verification_state, NOW(), TRUE)
       ON CONFLICT (user_id) DO UPDATE SET business_name = EXCLUDED.business_name
       RETURNING vendor_profile_id AS v`,
      [F.shopUser],
    )
  ).rows[0]!.v;
  await db.query(
    `UPDATE public.vendor_profiles
        SET next_renewal_due_at = TIMESTAMPTZ '2027-03-12 23:59:59+08',
            verification_state = 'verified'::public.vendor_verification_state,
            last_verified_at = NOW(),
            public_visibility = 'verified'::public.vendor_public_visibility
      WHERE vendor_profile_id = $1`,
    [F.vendorId],
  );
  const shape = await db.query<{ v: string; p: string }>(
    `SELECT verification_state::text AS v, public_visibility::text AS p FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    [F.vendorId],
  );
  assert.deepEqual(shape.rows[0], { v: 'verified', p: 'verified' }, 'fixture: the shop is not publicly readable');
});

after(async () => {
  await reset();
  await db?.close?.();
});

const STRANGER = { role: 'authenticated' as const, get uid() { return F.stranger; } };
const SHOP = { role: 'authenticated' as const, get uid() { return F.shopUser; } };

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === MIGRATION_FILE), `${MIGRATION_FILE} was skipped: ${JSON.stringify(replay.skipped)}`);
});

test('META: the probing roles are not the owner, not superusers, and have no BYPASSRLS', async () => {
  for (const role of ['anon', 'authenticated'] as const) {
    const r = await as(
      { role },
      `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
              (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass,
              (SELECT rolsuper FROM pg_roles WHERE rolname = current_user) AS super
         FROM pg_class c WHERE c.oid = 'public.chat_threads'::regclass`,
    );
    assert.equal(r.err, null);
    assert.deepEqual(
      { me: r.rows[0]!.me, bypass: r.rows[0]!.bypass, super: r.rows[0]!.super },
      { me: role, bypass: false, super: false },
    );
    assert.notEqual(r.rows[0]!.owner, role);
  }
});

/* ── 1 · TRUNCATE ─────────────────────────────────────────────────────────── */

test('no browser role can TRUNCATE the conversations table', async () => {
  let refused = 0;
  for (const who of [{ role: 'anon' as const }, STRANGER]) {
    const r = await as(who, `TRUNCATE public.chat_threads CASCADE`);
    assert.ok(r.err, `${who.role} truncated every conversation on the platform`);
    assert.match(r.err, /permission denied for table chat_threads/);
    refused += 1;
  }
  console.log(`# TRUNCATE chat_threads refused: ${refused}/2`);
});

test('NEUTRALISED: with TRUNCATE granted back, the same statement runs — so the refusal is the revoke', async () => {
  const r = await as({ role: 'authenticated', uid: F.stranger }, `TRUNCATE public.chat_threads CASCADE`, [],
    `GRANT TRUNCATE ON public.chat_threads TO authenticated`);
  // CASCADE may reach tables this role cannot truncate; either it ran, or it
  // was refused for a DIFFERENT table — never for chat_threads itself.
  if (r.err) assert.doesNotMatch(r.err, /permission denied for table chat_threads\b/);
});

test('POSITIVE CONTROL: the rest of the table’s browser grants are untouched', async () => {
  const r = await db.query<{ s: boolean; i: boolean; u: boolean; t: boolean }>(
    `SELECT has_table_privilege('authenticated','public.chat_threads','SELECT') AS s,
            has_table_privilege('authenticated','public.chat_threads','INSERT') AS i,
            has_table_privilege('authenticated','public.chat_threads','UPDATE') AS u,
            has_table_privilege('service_role','public.chat_threads','TRUNCATE') AS t`,
  );
  assert.deepEqual(r.rows[0], { s: true, i: true, u: true, t: true });
});

/* ── 2 · the badge deadline ──────────────────────────────────────────────── */

test('POSITIVE CONTROL: a signed-in stranger reads the shop’s public row — RLS admits it', async () => {
  const r = await as(STRANGER, `SELECT business_name, verification_state FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [F.vendorId]);
  assert.equal(r.err, null, r.err ?? '');
  assert.equal(r.rows.length, 1, 'the stranger cannot see the shop at all — the refusals below would prove nothing');
});

test('a signed-in account cannot read, filter or sort by a shop’s badge deadline', async () => {
  const probes = [
    `SELECT next_renewal_due_at FROM public.vendor_profiles WHERE vendor_profile_id = $1`,
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE vendor_profile_id = $1 AND next_renewal_due_at < now() + interval '200 days'`,
    `SELECT vendor_profile_id FROM public.vendor_profiles WHERE vendor_profile_id = $1 ORDER BY next_renewal_due_at`,
  ];
  let refused = 0;
  for (const who of [STRANGER, SHOP, { role: 'anon' as const }]) {
    for (const sql of probes) {
      const r = await as(who, sql, [F.vendorId]);
      assert.ok(r.err, `${who.role}${'uid' in who ? '' : ''} read the badge deadline: ${sql}`);
      assert.match(r.err, /permission denied/);
      refused += 1;
    }
  }
  console.log(`# badge-deadline probes refused: ${refused}/${probes.length * 3}`);
  assert.equal(refused, probes.length * 3);
});

test('NEUTRALISED: with the column granted back, the same read lands', async () => {
  const r = await as(STRANGER, `SELECT next_renewal_due_at FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [F.vendorId],
    `GRANT SELECT (next_renewal_due_at) ON public.vendor_profiles TO authenticated`);
  assert.equal(r.err, null, r.err ?? '');
  assert.equal(r.rows.length, 1);
});

test('the shop still reads its OWN deadline through its own view, and the server reads everyone’s', async () => {
  const own = await as(SHOP, `SELECT next_renewal_due_at FROM public.vendor_profiles_self`);
  assert.equal(own.err, null, own.err ?? '');
  assert.equal(own.rows.length, 1, 'the shop lost its own row in vendor_profiles_self');
  assert.ok(own.rows[0]!.next_renewal_due_at, 'the shop can no longer see its badge deadline');
  const stranger = await as(STRANGER, `SELECT next_renewal_due_at FROM public.vendor_profiles_self`);
  assert.equal(stranger.err, null);
  assert.equal(stranger.rows.length, 0, 'the self view leaks other shops');
  const server = await as({ role: 'service_role' }, `SELECT next_renewal_due_at FROM public.vendor_profiles WHERE vendor_profile_id = $1`, [F.vendorId]);
  assert.equal(server.err, null, server.err ?? '');
  assert.equal(server.rows.length, 1);
});
