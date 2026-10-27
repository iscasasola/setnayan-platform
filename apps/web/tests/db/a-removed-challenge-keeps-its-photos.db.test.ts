/**
 * A REMOVED CHALLENGE KEEPS ITS PHOTOS — executed against real Postgres (migration 20271292346034).
 *
 * Owner 2026-10-26 (DECISION_LOG "PAPIC CHALLENGES: A LIVE SWITCH AND AN ✕"): *"if the challenge is removed and someone
 * did the challenge, the photo and challenge is saved but anything after, you do not have the challenge"*.
 *
 * The ✕ (`deleteCoupleChallengeAction`) is now the soft remove it writes here, through the couple's own RLS:
 * `is_active = false, removed_at = now(), moment_key = null`. What this proves:
 *   · the completion a guest already made SURVIVES, still joined to the challenge's prompt (the old hard DELETE
 *     cascaded it away — `papic_mission_completions.mission_id … ON DELETE CASCADE`);
 *   · a NEW answer is refused (`papic_complete_mission` — "anything after, you do not have the challenge");
 *   · it leaves the guest's board (`papic_guest_missions`);
 *   · the switch still works on a listed challenge (off → refused, on → answerable again);
 *   · 🔒 a removed challenge can NEVER be switched back on (CHECK `papic_missions_removed_is_off`) — SABOTAGE: drop the
 *     CHECK and the same UPDATE succeeds, so the assertion is the constraint's, not a coincidence.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const DAY = 86_400_000;

async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await db.query(`SELECT set_config('request.jwt.claim.role', 'authenticated', false)`);
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await db.query(`SELECT set_config('request.jwt.claim.role', '', false)`);
}

async function seed(tag: string): Promise<{ eventId: string; coupleUid: string; guestId: string; missionId: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`removed-${tag}@audit.test`],
  );
  const coupleUid = u.rows[0]!.id;
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date) VALUES ($1, 'birthday', $2::date) RETURNING event_id`,
    [`Removed ${tag}`, new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10)],
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [eventId, coupleUid]);
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category) VALUES ($1,'Removed','Guest','both','friends') RETURNING guest_id`,
    [eventId],
  );
  const m = await db.query<{ mission_id: string }>(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt) VALUES ($1,'prompt','couple',$2) RETURNING mission_id`,
    [eventId, `The cake cut ${tag}`],
  );
  return { eventId, coupleUid, guestId: g.rows[0]!.guest_id, missionId: m.rows[0]!.mission_id };
}

async function complete(guestId: string, missionId: string): Promise<string | null> {
  const r = await db.query<{ completion_id: string | null }>(
    `SELECT public.papic_complete_mission($1::uuid, $2::uuid) AS completion_id`,
    [guestId, missionId],
  );
  return r.rows[0]!.completion_id;
}

/** The ✕, exactly as the action writes it — on the couple's own session, through RLS. */
async function removeAsCouple(uid: string, eventId: string, missionId: string): Promise<number> {
  await asUser(uid);
  try {
    const r = await db.query(
      `UPDATE public.papic_missions SET is_active = false, removed_at = now(), moment_key = null
       WHERE mission_id = $1 AND event_id = $2 AND removed_at IS NULL`,
      [missionId, eventId],
    );
    return r.affectedRows ?? 0;
  } finally {
    await reset();
  }
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

test('removing a challenge keeps the answer already given — and its challenge', async () => {
  const f = await seed('keeps');
  const done = await complete(f.guestId, f.missionId);
  assert.ok(done, 'the guest answered before the challenge was removed');

  assert.equal(await removeAsCouple(f.coupleUid, f.eventId, f.missionId), 1, 'the couple may remove their own challenge');

  const kept = await db.query<{ prompt: string; removed: boolean }>(
    `SELECT m.prompt, m.removed_at IS NOT NULL AS removed
       FROM public.papic_mission_completions c JOIN public.papic_missions m USING (mission_id)
      WHERE c.completion_id = $1`,
    [done],
  );
  assert.equal(kept.rows.length, 1, 'the completion survives the remove (the old hard DELETE cascaded it away)');
  assert.equal(kept.rows[0]!.prompt, 'The cake cut keeps', 'and still names the challenge it answered');
  assert.equal(kept.rows[0]!.removed, true);
});

test('anything after — a removed challenge can no longer be answered, nor seen on the board', async () => {
  const f = await seed('after');
  const boardOf = async () =>
    (await db.query<{ mission_id: string }>(`SELECT mission_id FROM public.papic_guest_missions($1::uuid)`, [f.guestId])).rows.map((r) => r.mission_id);
  assert.ok((await boardOf()).includes(f.missionId), 'control: before the remove it IS on the guest board');
  await removeAsCouple(f.coupleUid, f.eventId, f.missionId);
  await assert.rejects(complete(f.guestId, f.missionId), /mission not available/, 'a new answer is refused');
  assert.ok(!(await boardOf()).includes(f.missionId), 'it is not on the guest board');
});

test('the switch: off refuses an answer, on takes answers again — the challenge stays listed', async () => {
  const f = await seed('switch');
  await asUser(f.coupleUid);
  await db.query(`UPDATE public.papic_missions SET is_active = false WHERE mission_id = $1 AND removed_at IS NULL`, [f.missionId]);
  await reset();
  await assert.rejects(complete(f.guestId, f.missionId), /mission not available/, 'paused: no answer');
  await asUser(f.coupleUid);
  await db.query(`UPDATE public.papic_missions SET is_active = true WHERE mission_id = $1 AND removed_at IS NULL`, [f.missionId]);
  await reset();
  assert.ok(await complete(f.guestId, f.missionId), 'live again: answerable');
  const listed = await db.query<{ removed_at: string | null }>(`SELECT removed_at FROM public.papic_missions WHERE mission_id = $1`, [f.missionId]);
  assert.equal(listed.rows[0]!.removed_at, null, 'switching is not removing');
});

test('🔒 a removed challenge can never be switched back on (the CHECK), and the sabotage proves it is the CHECK', async () => {
  const f = await seed('check');
  await removeAsCouple(f.coupleUid, f.eventId, f.missionId);
  await assert.rejects(
    db.query(`UPDATE public.papic_missions SET is_active = true WHERE mission_id = $1`, [f.missionId]),
    /papic_missions_removed_is_off/,
    'even a writer that forgets `removed_at IS NULL` cannot re-light it',
  );
  // SABOTAGE: without the CHECK the very same write goes through — so the refusal above is the constraint's.
  await db.exec(`ALTER TABLE public.papic_missions DROP CONSTRAINT papic_missions_removed_is_off`);
  try {
    const r = await db.query(`UPDATE public.papic_missions SET is_active = true WHERE mission_id = $1`, [f.missionId]);
    assert.equal(r.affectedRows, 1, 'sabotaged: the removed challenge is live again');
  } finally {
    await db.query(`UPDATE public.papic_missions SET is_active = false WHERE mission_id = $1`, [f.missionId]);
    await db.exec(
      `ALTER TABLE public.papic_missions ADD CONSTRAINT papic_missions_removed_is_off CHECK (removed_at IS NULL OR is_active = false)`,
    );
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// TEN SLOTS (owner 2026-10-27): "turning 1 off will become 9 of 10 challenges. it stays there, but just off."
// ═══════════════════════════════════════════════════════════════════════════
async function bareEvent(tag: string): Promise<{ eventId: string; coupleUid: string }> {
  const u = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data) VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [`slots-${tag}@audit.test`],
  );
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date) VALUES ($1, 'birthday', $2::date) RETURNING event_id`,
    [`Slots ${tag}`, new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10)],
  );
  await db.query(`INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`, [ev.rows[0]!.event_id, u.rows[0]!.id]);
  return { eventId: ev.rows[0]!.event_id, coupleUid: u.rows[0]!.id };
}
/** The board as the couple's card lists it: approved, not removed — and how many of those are live. */
async function slotsOf(eventId: string): Promise<{ listed: number; live: number }> {
  const r = await db.query<{ listed: number; live: number }>(
    `SELECT count(*)::int AS listed, count(*) FILTER (WHERE is_active)::int AS live
       FROM public.papic_missions WHERE event_id = $1 AND approved AND removed_at IS NULL AND source IN ('couple','setnayan')`,
    [eventId],
  );
  return r.rows[0]!;
}
async function buildBoardAs(uid: string, eventId: string): Promise<void> {
  await asUser(uid);
  try {
    await db.query(`SELECT public.ensure_papic_board($1::uuid)`, [eventId]);
  } finally {
    await reset();
  }
}

test('🎚 an OFF challenge keeps its slot — the board does not hand the couple an eleventh', async () => {
  const f = await bareEvent('off');
  await buildBoardAs(f.coupleUid, f.eventId);
  const start = await slotsOf(f.eventId);
  assert.equal(start.listed, 10, 'premise: a new event starts with its ten');
  assert.equal(start.live, 10);
  const one = await db.query<{ mission_id: string }>(
    `SELECT mission_id FROM public.papic_missions WHERE event_id = $1 AND is_active AND source = 'setnayan' LIMIT 1`,
    [f.eventId],
  );
  await asUser(f.coupleUid);
  await db.query(`UPDATE public.papic_missions SET is_active = false WHERE mission_id = $1 AND removed_at IS NULL`, [one.rows[0]!.mission_id]);
  await reset();
  await buildBoardAs(f.coupleUid, f.eventId);
  assert.deepEqual(await slotsOf(f.eventId), { listed: 10, live: 9 }, '"9 of 10" — the off one stays in its slot, and nothing new is added');
});

test('🎚 CHANGING a slot replaces it: still ten, the old one kept for its photos — and a gap IS refilled (the contrast)', async () => {
  const f = await bareEvent('change');
  await buildBoardAs(f.coupleUid, f.eventId);
  const old = await db.query<{ mission_id: string }>(
    `SELECT mission_id FROM public.papic_missions WHERE event_id = $1 AND is_active AND source = 'setnayan' LIMIT 1`,
    [f.eventId],
  );
  // The change, as the action writes it: the couple's own challenge in, the old one retired (never deleted).
  await asUser(f.coupleUid);
  await db.query(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active) VALUES ($1,'prompt','couple','Our own one',true,true)`,
    [f.eventId],
  );
  await db.query(
    `UPDATE public.papic_missions SET is_active = false, removed_at = now(), moment_key = null WHERE mission_id = $1 AND removed_at IS NULL`,
    [old.rows[0]!.mission_id],
  );
  await reset();
  await buildBoardAs(f.coupleUid, f.eventId);
  assert.deepEqual(await slotsOf(f.eventId), { listed: 10, live: 10 }, 'a change is one in, one out');
  const kept = await db.query(`SELECT 1 FROM public.papic_missions WHERE mission_id = $1`, [old.rows[0]!.mission_id]);
  assert.equal(kept.rows.length, 1, 'the replaced challenge is kept (its photos keep it)');

  // CONTRAST (the sabotage of the rule): a challenge RETIRED with nothing in its place is not "off" — the board fills
  // the gap. If the off rule were a coincidence of the fill, the first test could not tell these apart.
  const gap = await db.query<{ mission_id: string }>(
    `SELECT mission_id FROM public.papic_missions WHERE event_id = $1 AND is_active AND source = 'setnayan' LIMIT 1`,
    [f.eventId],
  );
  await db.query(`UPDATE public.papic_missions SET is_active = false, removed_at = now() WHERE mission_id = $1`, [gap.rows[0]!.mission_id]);
  await buildBoardAs(f.coupleUid, f.eventId);
  assert.deepEqual(await slotsOf(f.eventId), { listed: 10, live: 10 }, 'a retired-with-no-replacement row is refilled — only OFF holds a slot');
});
