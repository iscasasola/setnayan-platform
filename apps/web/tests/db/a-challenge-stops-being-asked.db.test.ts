/**
 * A PAPIC CHALLENGE STOPS BEING ASKED — executed against real Postgres.
 *
 * Build order item 4a; owner ruling 2026-09-01 (DECISION_LOG.md). Until
 * migration 20271188446868 a challenge had no concept of time at all: the
 * 500-prompt library shipped, the per-event board shipped, the completion board
 * shipped, and a prompt armed during the first dance was still exactly as live
 * at 3am. The clock is RELATIVE — it opens when the challenge is ARMED, one at a
 * time per celebration, and the last one closes when the capture window ends.
 *
 * ── WHY THIS TEST IS SHAPED AROUND REFUSALS ────────────────────────────────
 * "Four limits have shipped on this surface governing nothing." A test that
 * asserts a column exists, or that an open challenge reads as open, would pass
 * against a resolver that returns TRUE unconditionally. Every case here that
 * matters is a NEGATIVE: something that must NOT be open, and could not be
 * caught by any positive assertion.
 *
 * ── THE ONE CASE THAT IS DELIBERATELY POSITIVE ─────────────────────────────
 * 🔴 EXPIRY CLOSES THE PROMPT, NEVER THE SHUTTER. `papic_complete_mission` must
 * still succeed on a challenge the clock has closed — a guest is never refused a
 * photo for lateness. That assertion is what stops a future session "finishing"
 * the clock by wiring it into the capture path, which would look like tidiness
 * and would be the one thing the ruling forbids.
 *
 * ── AND ONE TRAP THIS TEST EXISTS TO OUTLIVE ───────────────────────────────
 * 🛑 `papic_challenge_expires_at` reads exactly like a challenge clock and is
 * NOT one — it is on `vendor_profiles` and is a shop's 28-day subscription
 * expiry. Nothing here touches it, and nothing here should.
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

/** An event id per case, so no test can be made to pass by another's leftovers. */
type Fixture = { eventId: string; coupleUid: string; guestId: string };

async function setAuthRole(role: string | null): Promise<void> {
  await db.query(`SELECT set_config('request.jwt.claim.role', $1, false)`, [role ?? '']);
}
async function asUser(uid: string): Promise<void> {
  await setAuthUid(db, uid);
  await setAuthRole('authenticated');
  await db.exec(`SET ROLE authenticated`);
}
async function reset(): Promise<void> {
  await db.exec(`RESET ROLE`).catch(() => {});
  await setAuthUid(db, null);
  await setAuthRole(null);
}

async function createUser(email: string): Promise<string> {
  const r = await db.query<{ id: string }>(
    `INSERT INTO auth.users (email, raw_user_meta_data)
     VALUES ($1, jsonb_build_object('account_type','customer')) RETURNING id`,
    [email],
  );
  return r.rows[0]!.id;
}

/**
 * A celebration whose capture window is WIDE OPEN, with one couple member and
 * one guest. `windowEnd` is what every case then moves.
 */
async function seedEvent(tag: string, windowEnd: Date | null): Promise<Fixture> {
  const coupleUid = await createUser(`clock-${tag}@audit.test`);
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, papic_window_end)
     VALUES ($1, 'birthday', $2::date, $3::timestamptz) RETURNING event_id`,
    [
      `Clock ${tag}`,
      new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10),
      windowEnd ? windowEnd.toISOString() : null,
    ],
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUid],
  );
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1,'Clock','Guest','both','friends') RETURNING guest_id`,
    [eventId],
  );
  return { eventId, coupleUid, guestId: g.rows[0]!.guest_id };
}

async function seedMission(eventId: string, prompt: string): Promise<string> {
  const r = await db.query<{ mission_id: string }>(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt)
     VALUES ($1,'prompt','couple',$2) RETURNING mission_id`,
    [eventId, prompt],
  );
  return r.rows[0]!.mission_id;
}

async function isOpen(missionId: string): Promise<boolean> {
  const r = await db.query<{ open: boolean }>(
    `SELECT public.papic_challenge_is_open($1::uuid) AS open`,
    [missionId],
  );
  return r.rows[0]!.open;
}

async function armedFor(eventId: string): Promise<{ mission_id: string; prompt: string }[]> {
  const r = await db.query<{ mission_id: string; prompt: string }>(
    `SELECT mission_id, prompt FROM public.papic_armed_challenge($1::uuid)`,
    [eventId],
  );
  return r.rows;
}

/** Arm as the couple, through RLS, the way the studio action does. */
async function armAsCouple(uid: string, missionId: string): Promise<string | null> {
  await asUser(uid);
  try {
    const r = await db.query<{ armed_at: string | null }>(
      `SELECT public.papic_arm_challenge($1::uuid) AS armed_at`,
      [missionId],
    );
    return r.rows[0]!.armed_at;
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

// ═══════════════════════════════════════════════════════════════════════════
// THE HEADLINE: arm it, move past its end, and it is closed.
// ═══════════════════════════════════════════════════════════════════════════
test('a challenge closes when the celebration’s capture window passes', async () => {
  const f = await seedEvent('window', new Date(Date.now() + 2 * DAY));
  const m = await seedMission(f.eventId, 'Catch the cake');

  // Never armed is not open — and this is the case a resolver that always
  // returns TRUE fails first.
  assert.equal(await isOpen(m), false, 'an un-armed challenge must not read as open');
  assert.deepEqual(await armedFor(f.eventId), [], 'nothing is armed yet');

  const armedAt = await armAsCouple(f.coupleUid, m);
  assert.ok(armedAt, 'the couple can arm their own challenge');
  assert.equal(await isOpen(m), true, 'the armed challenge is open while the window runs');
  assert.equal((await armedFor(f.eventId))[0]?.mission_id, m);

  // ── MOVE PAST ITS END. Nothing about the challenge row changes: armed_at
  // stands, closed_at stays NULL. The window is what moved, and that alone must
  // close the prompt — this is the whole meaning of "derived at read time".
  await db.query(
    `UPDATE public.events SET papic_window_end = $2::timestamptz WHERE event_id = $1`,
    [f.eventId, new Date(Date.now() - 60_000).toISOString()],
  );

  const row = await db.query<{ armed_at: string | null; closed_at: string | null }>(
    `SELECT armed_at, closed_at FROM public.papic_missions WHERE mission_id = $1`,
    [m],
  );
  assert.ok(row.rows[0]!.armed_at, 'armed_at is untouched — the row did not move');
  assert.equal(row.rows[0]!.closed_at, null, 'closed_at is untouched — the row did not move');

  assert.equal(await isOpen(m), false, 'past the window end, the challenge is CLOSED');
  assert.deepEqual(await armedFor(f.eventId), [], 'and the celebration has no armed challenge');
});

// ═══════════════════════════════════════════════════════════════════════════
// 🔴 THE PROMPT, NEVER THE SHUTTER.
// ═══════════════════════════════════════════════════════════════════════════
test('a closed challenge still accepts a guest’s photo', async () => {
  const f = await seedEvent('shutter', new Date(Date.now() + 2 * DAY));
  const m = await seedMission(f.eventId, 'A photo with {host}');
  await armAsCouple(f.coupleUid, m);

  await db.query(
    `UPDATE public.events SET papic_window_end = $2::timestamptz WHERE event_id = $1`,
    [f.eventId, new Date(Date.now() - 60_000).toISOString()],
  );
  assert.equal(await isOpen(m), false, 'precondition: the clock has closed this prompt');

  // The capture path must not have learned about the clock. If a future change
  // makes papic_complete_mission consult it, this throws — which is the point.
  const done = await db.query<{ completion_id: string }>(
    `SELECT public.papic_complete_mission($1::uuid, $2::uuid) AS completion_id`,
    [f.guestId, m],
  );
  assert.ok(
    done.rows[0]!.completion_id,
    'a guest is NEVER refused for lateness — expiry closes the prompt, not the shutter',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// ONE AT A TIME PER CELEBRATION.
// ═══════════════════════════════════════════════════════════════════════════
test('arming the next challenge closes the previous one', async () => {
  const f = await seedEvent('supersede', new Date(Date.now() + 2 * DAY));
  const first = await seedMission(f.eventId, 'The first dance');
  const second = await seedMission(f.eventId, 'The money dance');

  await armAsCouple(f.coupleUid, first);
  assert.equal(await isOpen(first), true);

  await armAsCouple(f.coupleUid, second);
  assert.equal(await isOpen(first), false, 'the previous challenge is closed by the next arming');
  assert.equal(await isOpen(second), true);

  const armed = await armedFor(f.eventId);
  assert.equal(armed.length, 1, 'exactly one challenge is armed for a celebration');
  assert.equal(armed[0]!.mission_id, second);

  // The closed one keeps its history rather than being reset to never-armed.
  const prev = await db.query<{ armed_at: string | null; closed_at: string | null }>(
    `SELECT armed_at, closed_at FROM public.papic_missions WHERE mission_id = $1`,
    [first],
  );
  assert.ok(prev.rows[0]!.armed_at && prev.rows[0]!.closed_at, 'a superseded arming is recorded, not erased');
});

test('the database itself refuses a second open arming', async () => {
  const f = await seedEvent('unique', new Date(Date.now() + 2 * DAY));
  const first = await seedMission(f.eventId, 'The vows');
  const second = await seedMission(f.eventId, 'The veil and cord');
  await armAsCouple(f.coupleUid, first);

  // Not through the RPC — a raw write, i.e. the future code path that forgets to
  // close the previous one. "One at a time" must be a constraint, not a habit.
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.papic_missions SET armed_at = NOW(), closed_at = NULL WHERE mission_id = $1`,
        [second],
      ),
    /papic_missions_one_armed_per_event|duplicate key/i,
    'the partial unique index must refuse two simultaneously-armed challenges',
  );
});

// ═══════════════════════════════════════════════════════════════════════════
// THE OTHER WAYS A CHALLENGE STOPS BEING ASKED.
// ═══════════════════════════════════════════════════════════════════════════
test('hiding a challenge closes it, without any second mechanism', async () => {
  const f = await seedEvent('hidden', new Date(Date.now() + 2 * DAY));
  const m = await seedMission(f.eventId, 'A photo at the booth');
  await armAsCouple(f.coupleUid, m);
  assert.equal(await isOpen(m), true);

  // The eye control the couple already has. A prompt no guest can see is not
  // live, whatever armed_at says.
  await db.query(`UPDATE public.papic_missions SET is_active = false WHERE mission_id = $1`, [m]);
  assert.equal(await isOpen(m), false, 'a hidden challenge is not the one being asked');
  assert.deepEqual(await armedFor(f.eventId), []);

  await db.query(`UPDATE public.papic_missions SET is_active = true, approved = false WHERE mission_id = $1`, [m]);
  assert.equal(await isOpen(m), false, 'an unapproved challenge is not the one being asked either');
});

test('with no window set, the end of the event day closes it', async () => {
  // papic_window_end is NULLABLE and NULL means "legacy single-day, anchored to
  // event_date" — NOT "no end". Reading NULL as no-end would leave every legacy
  // celebration's last challenge armed forever.
  const coupleUid = await createUser('clock-legacy@audit.test');
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, timezone)
     VALUES ('Clock legacy', 'birthday', $1::date, 'Asia/Manila') RETURNING event_id`,
    [new Date(Date.now() - 3 * DAY).toISOString().slice(0, 10)],
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUid],
  );
  const m = await seedMission(eventId, 'The leaving of the church');
  await armAsCouple(coupleUid, m);

  assert.equal(await isOpen(m), false, 'the event day is over, so the prompt is closed');
});

test('a celebration with no date yet keeps its armed challenge open', async () => {
  // events.event_date is nullable — a real, shipped state (an undecided date).
  // There is no end that could have passed, and inventing one from an absence is
  // the exact failure this build order exists to remove.
  const coupleUid = await createUser('clock-undated@audit.test');
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type) VALUES ('Clock undated','birthday')
     RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUid],
  );
  const m = await seedMission(eventId, 'A photo with the celebrant');
  await armAsCouple(coupleUid, m);

  assert.equal(await isOpen(m), true, 'no date means no end has passed');
});

// ═══════════════════════════════════════════════════════════════════════════
// AND A STRANGER CANNOT REACH THE SWITCH.
// ═══════════════════════════════════════════════════════════════════════════
test('someone who is not on the celebration cannot arm its challenges', async () => {
  const f = await seedEvent('stranger', new Date(Date.now() + 2 * DAY));
  const m = await seedMission(f.eventId, 'The cake cutting');
  const outsider = await createUser('clock-outsider@audit.test');

  const armedAt = await armAsCouple(outsider, m);
  assert.equal(armedAt, null, 'papic_arm_challenge is SECURITY INVOKER — Pattern B refuses a stranger');
  assert.equal(await isOpen(m), false, 'and nothing was armed');

  // The real member still can — proving the refusal above was authorisation and
  // not a broken fixture.
  assert.ok(await armAsCouple(f.coupleUid, m));
  assert.equal(await isOpen(m), true);
});
