/**
 * A GUEST CANNOT READ THE DRAFT — `event_site_drafts` (migration
 * 20271246169682, Event Hub Maker Phase 2), proven as REAL `authenticated`
 * sessions (SET ROLE + JWT claims), never as the superuser the replay runs as.
 *
 * A draft is an unpublished page. The couple may try a look, a background, a
 * section they have not decided to show — and the whole point of the draft is
 * that guests do not see it until Apply. So the audience is the product:
 *
 *   • the couple (and accepted co-hosts) read and write their own draft;
 *   • an INVITED GUEST of the same event reads nothing — the trap is
 *     `current_event_ids()`, which returns the event for every member type,
 *     guests included; the anti-vacuity test below proves this guest IS such a
 *     member, so "refused" means the narrowing, not a missing membership;
 *   • a stranger (another event's couple) reads and writes nothing;
 *   • anon holds no privilege at all.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271246169682_event_site_drafts.sql';

const F = { couple: '', guest: '', stranger: '', eventId: '', strangerEventId: '' };

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}

/** Run one statement as `uid` inside a rolled-back transaction. */
async function as(
  uid: string,
  sql: string,
  params: unknown[] = [],
): Promise<{ err: string | null; n: number; rows: unknown[] }> {
  await db.exec('BEGIN');
  try {
    await setAuthUid(db, uid);
    await setRole('authenticated');
    await db.exec('SET ROLE authenticated');
    const r = await db.query(sql, params);
    return { err: null, n: r.affectedRows ?? r.rows.length, rows: r.rows };
  } catch (e) {
    return { err: (e as Error).message, n: 0, rows: [] };
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
  const mkUser = async (email: string) =>
    (
      await db.query<{ id: string }>(
        `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type', 'customer')) RETURNING id`,
        [email],
      )
    ).rows[0]!.id;
  F.couple = await mkUser('draft-couple@draft.test');
  F.guest = await mkUser('draft-guest@draft.test');
  F.stranger = await mkUser('draft-stranger@draft.test');
  const ev = async (name: string) =>
    (
      await db.query<{ e: string }>(
        `INSERT INTO public.events (display_name, event_type) VALUES ($1, 'birthday') RETURNING event_id AS e`,
        [name],
      )
    ).rows[0]!.e;
  F.eventId = await ev('Draft Test Party');
  F.strangerEventId = await ev('Somebody Else’s Party');
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.eventId, F.couple]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'guest')`, [F.eventId, F.guest]);
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, 'couple')`, [F.strangerEventId, F.stranger]);
  await db.query(
    `INSERT INTO public.event_site_drafts (event_id, draft_json) VALUES ($1, '{"v":1,"events":{},"widgets":{"countdown":{"mode":"hidden"}},"history":[]}'::jsonb)`,
    [F.eventId],
  );
});

after(async () => {
  await reset();
  await db?.close?.();
});

/* ── 0 · anti-vacuity ─────────────────────────────────────────────────────── */

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === MIGRATION_FILE), `${MIGRATION_FILE} was skipped: ${JSON.stringify(replay.skipped)}`);
});

test('META: the probing role is authenticated, owns nothing and has no BYPASSRLS', async () => {
  await db.exec(`SET ROLE authenticated`);
  const r = await db.query<{ me: string; owner: string; bypass: boolean }>(
    `SELECT current_user AS me, pg_get_userbyid(c.relowner) AS owner,
            (SELECT rolbypassrls FROM pg_roles WHERE rolname = current_user) AS bypass
       FROM pg_class c WHERE c.oid = 'public.event_site_drafts'::regclass`,
  );
  await reset();
  assert.equal(r.rows[0]!.me, 'authenticated');
  assert.notEqual(r.rows[0]!.owner, 'authenticated');
  assert.equal(r.rows[0]!.bypass, false);
});

test('META: the guest IS a member — current_event_ids() hands them this event', async () => {
  const r = await as(F.guest, `SELECT count(*)::int AS n FROM public.current_event_ids() e WHERE e = $1`, [F.eventId]);
  assert.equal(r.err, null, r.err ?? '');
  assert.equal((r.rows[0] as { n: number }).n, 1, 'the guest is not a member, so a refusal below would prove nothing');
});

/* ── 1 · who reads ─────────────────────────────────────────────────────────── */

test('the couple reads their own draft', async () => {
  const r = await as(F.couple, `SELECT event_id FROM public.event_site_drafts WHERE event_id = $1`, [F.eventId]);
  assert.equal(r.err, null, r.err ?? '');
  assert.equal(r.rows.length, 1, 'the couple cannot see their own draft');
});

test('an invited guest of the same event reads NOTHING', async () => {
  const r = await as(F.guest, `SELECT event_id FROM public.event_site_drafts`);
  assert.equal(r.err, null, r.err ?? '');
  assert.equal(r.rows.length, 0, 'a guest read the couple’s unpublished draft');
});

test('a stranger reads nothing', async () => {
  const r = await as(F.stranger, `SELECT event_id FROM public.event_site_drafts`);
  assert.equal(r.rows.length, 0);
});

/* ── 2 · who writes ────────────────────────────────────────────────────────── */

test('the couple can change their draft', async () => {
  const r = await as(
    F.couple,
    `UPDATE public.event_site_drafts SET draft_json = '{"v":1,"events":{},"widgets":{},"history":[]}'::jsonb WHERE event_id = $1`,
    [F.eventId],
  );
  assert.equal(r.err, null, r.err ?? '');
  assert.equal(r.n, 1);
});

test('a guest cannot change or delete the draft (0 rows)', async () => {
  const u = await as(F.guest, `UPDATE public.event_site_drafts SET draft_json = '{}'::jsonb WHERE event_id = $1`, [F.eventId]);
  assert.equal(u.n, 0, 'a guest rewrote the couple’s draft');
  const d = await as(F.guest, `DELETE FROM public.event_site_drafts WHERE event_id = $1`, [F.eventId]);
  assert.equal(d.n, 0, 'a guest deleted the couple’s draft');
});

test('a stranger cannot plant a draft on somebody else’s event', async () => {
  const r = await as(F.stranger, `INSERT INTO public.event_site_drafts (event_id, draft_json) VALUES ($1, '{}'::jsonb)`, [F.eventId]);
  assert.ok(r.err, 'a stranger created a draft on an event they do not host');
});

test('the couple can create a draft on their own event, and not move it to another', async () => {
  const mine = await as(F.couple, `INSERT INTO public.event_site_drafts (event_id) VALUES ($1) ON CONFLICT (event_id) DO NOTHING`, [F.eventId]);
  assert.equal(mine.err, null, mine.err ?? '');
  const move = await as(F.couple, `UPDATE public.event_site_drafts SET event_id = $1 WHERE event_id = $2`, [F.strangerEventId, F.eventId]);
  assert.ok(move.err, 'event_id must be insert-only (column grant) — a draft moved to another event');
});

/* ── 3 · shape ─────────────────────────────────────────────────────────────── */

test('anon holds NO privilege and RLS is on', async () => {
  const g = await db.query(
    `SELECT privilege_type FROM information_schema.role_table_grants
     WHERE table_schema='public' AND table_name='event_site_drafts' AND grantee='anon'`,
  );
  assert.deepEqual(g.rows, []);
  const rls = await db.query<{ on: boolean }>(`SELECT relrowsecurity AS on FROM pg_class WHERE oid = 'public.event_site_drafts'::regclass`);
  assert.equal(rls.rows[0]!.on, true);
});

test('the policy never rides current_event_ids()', async () => {
  const r = await db.query<{ q: string }>(
    `SELECT coalesce(qual,'') || ' ' || coalesce(with_check,'') AS q FROM pg_policies
     WHERE schemaname='public' AND tablename='event_site_drafts'`,
  );
  assert.ok(r.rows.length > 0);
  for (const p of r.rows) assert.doesNotMatch(p.q, /current_event_ids\(\)/);
});

test('a draft must be an object', async () => {
  const r = await as(F.couple, `UPDATE public.event_site_drafts SET draft_json = '[1,2]'::jsonb WHERE event_id = $1`, [F.eventId]);
  assert.ok(r.err, 'an array was stored as a draft');
});
