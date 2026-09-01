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
async function armAsCouple(
  uid: string,
  missionId: string,
  minutes?: 30 | 60 | 120,
): Promise<string | null> {
  await asUser(uid);
  try {
    const r =
      minutes === undefined
        ? await db.query<{ armed_at: string | null }>(
            // One argument on purpose: the DEFAULT is part of the contract, and
            // this is the call the shipped server action makes.
            `SELECT public.papic_arm_challenge($1::uuid) AS armed_at`,
            [missionId],
          )
        : await db.query<{ armed_at: string | null }>(
            `SELECT public.papic_arm_challenge($1::uuid, $2::smallint) AS armed_at`,
            [missionId, minutes],
          );
    return r.rows[0]!.armed_at;
  } finally {
    await reset();
  }
}

/** When this challenge stops being the one being asked. */
async function endsAt(missionId: string): Promise<Date | null> {
  const r = await db.query<{ ends: string | null }>(
    `SELECT public.papic_challenge_ends_at($1::uuid) AS ends`,
    [missionId],
  );
  const v = r.rows[0]!.ends;
  return v ? new Date(v) : null;
}

/**
 * Move a challenge's arming N minutes into the past — i.e. let its own timer
 * run, without waiting.
 *
 * 🔑 THE ARMING MOVES, NOT `NOW()`. Winding the clock forward globally would
 * also move the capture window and the event day, so a pass could come from any
 * of the three end terms and the test would not be about the timer at all.
 * Every case that uses this leaves the window days away, so the timer is the
 * only term that can close the challenge.
 */
async function rewindArming(missionId: string, minutes: number): Promise<void> {
  await db.query(
    `UPDATE public.papic_missions
        SET armed_at = NOW() - make_interval(mins => $2::int)
      WHERE mission_id = $1`,
    [missionId, minutes],
  );
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

test('a celebration with no date yet is closed by its own timer, not left open forever', async () => {
  // ⚠ THIS CASE INVERTED ON 2026-09-01, AND THE REASON MATTERS.
  // events.event_date is nullable (an undecided date is a real, shipped state),
  // so the original clock had NO end term for such an event and deliberately
  // left the challenge open — inventing an expiry from an absence is the
  // failure this build order exists to remove.
  //
  // The owner then supplied the number, so there IS an end now: the challenge's
  // own timer. Not a guess that crept in — a decision that arrived.
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

  assert.equal(await isOpen(m), true, 'it is open the moment it is armed');
  const ends = await endsAt(m);
  assert.ok(ends, 'and it HAS an end, even with no date on the celebration');
  assert.equal(
    Math.round((ends.getTime() - Date.now()) / 60000),
    30,
    'the end is its own 30-minute timer',
  );

  await rewindArming(m, 31);
  assert.equal(await isOpen(m), false, 'and the timer closes it');
});

// ═══════════════════════════════════════════════════════════════════════════
// THE TIMER ITSELF — 30 by default, 60 and 120 on request.
// ═══════════════════════════════════════════════════════════════════════════
test('a timed challenge runs out on its own, with nothing else moving', async () => {
  const f = await seedEvent('timer', new Date(Date.now() + 2 * DAY));
  const m = await seedMission(f.eventId, 'The bridal march');
  await armAsCouple(f.coupleUid, m);
  assert.equal(await isOpen(m), true);

  // Nothing is superseded, nothing is hidden, the capture window is two days
  // out. The ONLY thing that closes this is its own 30 minutes — so if the
  // timer term were dropped, this case is the one that would notice.
  await rewindArming(m, 29);
  assert.equal(await isOpen(m), true, 'still running at 29 minutes');

  await rewindArming(m, 31);
  assert.equal(await isOpen(m), false, 'closed at 31 minutes');
  assert.deepEqual(await armedFor(f.eventId), [], 'and the celebration has nothing armed');

  const row = await db.query<{ closed_at: string | null }>(
    `SELECT closed_at FROM public.papic_missions WHERE mission_id = $1`,
    [m],
  );
  assert.equal(
    row.rows[0]!.closed_at,
    null,
    'the row never moved — expiry is derived at read time, never a stamp somebody has to write',
  );
});

test('the couple picks 30, 60 or 120 — and the pick is what runs', async () => {
  const f = await seedEvent('lengths', new Date(Date.now() + 2 * DAY));

  for (const minutes of [30, 60, 120] as const) {
    const m = await seedMission(f.eventId, `A ${minutes}-minute challenge`);
    await armAsCouple(f.coupleUid, m, minutes);

    const ends = await endsAt(m);
    assert.ok(ends);
    assert.equal(
      Math.round((ends.getTime() - Date.now()) / 60000),
      minutes,
      `a ${minutes}-minute pick must run for ${minutes} minutes`,
    );

    // Just inside and just outside its own length — the assertion that fails if
    // every pick quietly collapses to the 30-minute default.
    await rewindArming(m, minutes - 1);
    assert.equal(await isOpen(m), true, `still running at ${minutes - 1} minutes`);
    await rewindArming(m, minutes + 1);
    assert.equal(await isOpen(m), false, `closed at ${minutes + 1} minutes`);
  }
});

test('the database refuses a length nobody chose', async () => {
  const f = await seedEvent('badlength', new Date(Date.now() + 2 * DAY));
  const m = await seedMission(f.eventId, 'The vows');

  // 45 minutes is not one of the three. A fourth length is a DECISION, and it
  // must fail here rather than appear quietly on a wall.
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.papic_missions SET armed_duration_minutes = 45 WHERE mission_id = $1`,
        [m],
      ),
    /papic_missions_armed_duration_choices|violates check constraint/i,
    'only 30, 60 and 120 are lengths the owner chose',
  );

  // Through the RPC, an unrecognised length falls back to the default rather
  // than erroring — a coordinator mid-reception gets 30 minutes, not a crash.
  await armAsCouple(f.coupleUid, m, 45 as 30);
  const row = await db.query<{ armed_duration_minutes: number }>(
    `SELECT armed_duration_minutes FROM public.papic_missions WHERE mission_id = $1`,
    [m],
  );
  assert.equal(row.rows[0]!.armed_duration_minutes, 30, 'falls back to the owner’s default');
});

// ═══════════════════════════════════════════════════════════════════════════
// ⛔ THE RULING MOST LIKELY TO BE MIS-IMPLEMENTED.
// ═══════════════════════════════════════════════════════════════════════════
test('arming — and expiring — takes NOTHING off a guest’s board', async () => {
  // Owner, 2026-09-01: "one challenge, but the other challenges may still be
  // there." The timed challenge is what the ROOM is being asked; the board is
  // what a GUEST may do. A future reader that filters the board by
  // papic_challenge_is_open would delete nine of a guest's ten challenges the
  // moment a coordinator started the tenth, and every test above would stay
  // green. This is the one that would not.
  const f = await seedEvent('board-untouched', new Date(Date.now() + 2 * DAY));
  const missions: string[] = [];
  for (let i = 1; i <= 4; i += 1) {
    missions.push(await seedMission(f.eventId, `Board challenge ${i}`));
  }

  const boardFor = async (): Promise<string[]> => {
    const r = await db.query<{ mission_id: string }>(
      `SELECT mission_id FROM public.papic_guest_missions($1::uuid) ORDER BY mission_id`,
      [f.guestId],
    );
    return r.rows.map((x) => x.mission_id);
  };

  const before = await boardFor();
  assert.equal(before.length, 4, 'precondition: the guest can see all four');

  await armAsCouple(f.coupleUid, missions[0]!);
  assert.deepEqual(await boardFor(), before, 'arming one changes the board not at all');

  await rewindArming(missions[0]!, 31);
  assert.equal(await isOpen(missions[0]!), false, 'the timed one has run out…');
  assert.deepEqual(
    await boardFor(),
    before,
    '…and the guest still has every challenge, the expired one included',
  );

  // And the expired prompt is still answerable — the shutter is never closed.
  const done = await db.query<{ completion_id: string }>(
    `SELECT public.papic_complete_mission($1::uuid, $2::uuid) AS completion_id`,
    [f.guestId, missions[0]!],
  );
  assert.ok(done.rows[0]!.completion_id, 'an expired challenge can still be answered');
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
