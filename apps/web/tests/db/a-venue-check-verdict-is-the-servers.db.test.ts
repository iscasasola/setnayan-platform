/**
 * tests/db/a-venue-check-verdict-is-the-servers.db.test.ts
 *
 * The Live Watch venue connection check (migration 20271308955287): the couple and their coordinator run
 * it and both read the result; a guest does neither; and NOBODY signed in can write a verdict — the
 * finish step writes it with the service role after re-judging the phone's numbers (lib/venue-check.ts).
 * Without the column grant, the default table privileges let any team member PATCH `verdict = 'full'`
 * straight through the API, and "the saved verdict is the server's" would be a sentence, not a fact.
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const MIGRATION_FILE = '20271308955287_live_watch_venue_checks.sql';

const F = { couple: '', coordinator: '', guest: '', stranger: '', eventId: '', checkId: '' };

async function setRole(role: string): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role]);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null).catch(() => {});
  await setRole('').catch(() => {});
}

/** Run one statement as `uid` inside a rolled-back transaction. */
async function as(uid: string, sql: string, params: unknown[] = []): Promise<{ err: string | null; n: number; rows: unknown[] }> {
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
  F.couple = await mkUser('venue-couple@venue.test');
  F.coordinator = await mkUser('venue-coordinator@venue.test');
  F.guest = await mkUser('venue-guest@venue.test');
  F.stranger = await mkUser('venue-stranger@venue.test');
  F.eventId = (
    await db.query<{ e: string }>(
      `INSERT INTO public.events (display_name, event_type) VALUES ('Venue Check Wedding', 'birthday') RETURNING event_id AS e`,
    )
  ).rows[0]!.e;
  for (const [uid, type] of [
    [F.couple, 'couple'],
    [F.coordinator, 'coordinator'],
    [F.guest, 'guest'],
  ] as const) {
    await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1, $2, $3)`, [F.eventId, uid, type]);
  }
  // A finished check, as the server's finish step writes it.
  F.checkId = (
    await db.query<{ c: string }>(
      `INSERT INTO public.live_watch_venue_checks (event_id, finished_at, verdict, place_name, average_kbps)
       VALUES ($1, now(), 'reduced', 'Main hall', 2100) RETURNING check_id AS c`,
      [F.eventId],
    )
  ).rows[0]!.c;
});

after(async () => {
  await reset();
  await db?.close?.();
});

test('the migration applied on top of the full corpus (not skipped)', () => {
  assert.ok(!replay.skipped.some((s) => s.file === MIGRATION_FILE), `${MIGRATION_FILE} was skipped: ${JSON.stringify(replay.skipped)}`);
});

test('META: the guest IS a member — so their refusals below are the policy, not a missing seat', async () => {
  const r = await as(F.guest, `SELECT count(*)::int AS n FROM public.current_event_ids() e WHERE e = $1`, [F.eventId]);
  assert.equal(r.err, null, r.err ?? '');
  assert.equal((r.rows[0] as { n: number }).n, 1);
});

test('the couple and the coordinator both read the result', async () => {
  for (const uid of [F.couple, F.coordinator]) {
    const r = await as(uid, `SELECT verdict, place_name FROM public.live_watch_venue_checks WHERE event_id = $1`, [F.eventId]);
    assert.equal(r.err, null, r.err ?? '');
    assert.deepEqual(r.rows, [{ verdict: 'reduced', place_name: 'Main hall' }]);
  }
});

test('a guest and a stranger read nothing', async () => {
  for (const uid of [F.guest, F.stranger]) {
    const r = await as(uid, `SELECT check_id FROM public.live_watch_venue_checks`);
    assert.equal(r.err, null, r.err ?? '');
    assert.equal(r.rows.length, 0);
  }
});

test('the couple and the coordinator can START a check (event_id only)', async () => {
  for (const uid of [F.couple, F.coordinator]) {
    const r = await as(uid, `INSERT INTO public.live_watch_venue_checks (event_id) VALUES ($1) RETURNING check_id`, [F.eventId]);
    assert.equal(r.err, null, r.err ?? '');
    assert.equal(r.rows.length, 1);
  }
});

test('a guest cannot start one', async () => {
  const r = await as(F.guest, `INSERT INTO public.live_watch_venue_checks (event_id) VALUES ($1)`, [F.eventId]);
  assert.match(r.err ?? '', /row-level security|permission denied/i);
});

test('nobody signed in can write a verdict — not on insert, not on update', async () => {
  const insert = await as(
    F.couple,
    `INSERT INTO public.live_watch_venue_checks (event_id, finished_at, verdict) VALUES ($1, now(), 'full')`,
    [F.eventId],
  );
  assert.match(insert.err ?? '', /permission denied/i, 'a couple inserted their own verdict');
  const update = await as(F.coordinator, `UPDATE public.live_watch_venue_checks SET verdict = 'full' WHERE check_id = $1`, [F.checkId]);
  assert.match(update.err ?? '', /permission denied/i, 'a coordinator rewrote the verdict');
});

test('a finished check always carries its verdict', async () => {
  await assert.rejects(
    db.query(`INSERT INTO public.live_watch_venue_checks (event_id, finished_at) VALUES ($1, now())`, [F.eventId]),
    /finished_has_verdict/,
  );
});
