/**
 * CHALLENGES HANG ON THE CEREMONY SEQUENCE — executed against real Postgres.
 *
 * Build order item 5. `lib/kwento-moments.ts` carried the ten moments in order,
 * `papic_challenge_library` carried 631 prompts, and NOTHING JOINED THEM.
 *
 * ── WHAT ONLY A REPLAYED DATABASE CAN PROVE ────────────────────────────────
 * Three things a source-reading guard cannot see, and each of them is the whole
 * point of one of § 5's requirements:
 *
 *   1. THE DATABASE AGREES WITH `MOMENT_CHALLENGES`. The migration is generated
 *      from the pool, so the two can only diverge if somebody edits the pool and
 *      forgets to regenerate — which is exactly how `llms.txt` drifted for three
 *      weeks with green CI, because its guard compared two hand-typed things.
 *
 *   2. ARMING A MOMENT'S CHALLENGE **USES** 4a, IT DOES NOT RE-IMPLEMENT IT.
 *      § 5 asks for that in those words. A unit test could only prove this repo
 *      still contains the string `papic_arm_challenge`; only a real database can
 *      show that calling it closes the previous moment's challenge and that the
 *      partial unique index holds.
 *
 *   3. ONE CHALLENGE PER MOMENT IS REFUSED BY THE DATABASE, not by a habit.
 *
 * ── 🔴 AND THE ONE THAT MUST STAY TRUE FROM 4a ─────────────────────────────
 * EXPIRY CLOSES THE PROMPT, NEVER THE SHUTTER. Nothing in item 5 may reach a
 * capture path. The sequence decides what is being ASKED; it never decides
 * whether a photo may be taken.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, setAuthUid, type ReplayResult } from './replay-migrations';
import { KWENTO_MOMENTS } from '../../lib/kwento-moments';
import { CHALLENGE_POOL, MOMENT_CHALLENGES } from '../../lib/papic-challenge-pool';
import { SEQUENCE_SUGGESTIONS } from '../../lib/papic-ceremony-sequence';

let replay: ReplayResult;
let db: PGlite;

const DAY = 86_400_000;

type Fixture = { eventId: string; coupleUid: string };

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

/** A celebration with a wide-open capture window and one couple member. */
async function seedEvent(tag: string, eventType = 'birthday'): Promise<Fixture> {
  const coupleUid = await createUser(`seq-${tag}@audit.test`);
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, event_date, papic_window_end)
     VALUES ($1, $2, $3::date, $4::timestamptz) RETURNING event_id`,
    [
      `Sequence ${tag}`,
      eventType,
      new Date(Date.now() + 30 * DAY).toISOString().slice(0, 10),
      new Date(Date.now() + 31 * DAY).toISOString(),
    ],
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(
    `INSERT INTO public.event_members (event_id, user_id, member_type) VALUES ($1,$2,'couple')`,
    [eventId, coupleUid],
  );
  return { eventId, coupleUid };
}

/** Place a library challenge at a moment, the way the run-of-show action does. */
async function place(eventId: string, libraryId: number, moment: string | null): Promise<string> {
  const r = await db.query<{ mission_id: string }>(
    `INSERT INTO public.papic_missions
       (event_id, mission_type, source, prompt, library_id, capture_kind, approved, is_active, moment_key)
     SELECT $1, l.mission_type, 'couple', l.prompt, l.library_id, l.capture_kind, true, true, $3
       FROM public.papic_challenge_library l WHERE l.library_id = $2
     RETURNING mission_id`,
    [eventId, libraryId, moment],
  );
  return r.rows[0]!.mission_id;
}

/** Arm as the couple, through RLS, the way the run-of-show screen does. */
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

async function isOpen(missionId: string): Promise<boolean> {
  const r = await db.query<{ open: boolean }>(
    `SELECT public.papic_challenge_is_open($1::uuid) AS open`,
    [missionId],
  );
  return r.rows[0]!.open;
}

/**
 * The mapped lane, EXECUTED IN SQL exactly as `fetchSequenceSuggestions` runs
 * it — containment on `moment_keys` plus the event-type scope. A helper that
 * read the TypeScript pool instead would prove nothing about the database.
 */
async function mappedInScope(moment: string, eventType: string): Promise<string[]> {
  const r = await db.query<{ slug: string }>(
    `SELECT slug FROM public.papic_challenge_library
      WHERE is_active AND mission_type <> 'face_verified'
        AND moment_keys @> ARRAY[$1]::text[]
        AND (event_types IS NULL OR $2 = ANY (event_types))`,
    [moment, eventType],
  );
  return r.rows.map((x) => x.slug);
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

// ═══════════════════════════════════════════════════════════════════════════
// 1 · THE MAPPING IS IN THE DATABASE, AND IT IS THE POOL'S
// ═══════════════════════════════════════════════════════════════════════════

// 🔑 "THE DATABASE HOLDS EXACTLY WHAT THE POOL DECLARES" IS NOT ASSERTED HERE.
// It belongs to `five-hundred-challenges.db.test.ts`, which already compares the
// replayed library to `CHALLENGE_POOL` field by field and now includes
// `moment_keys` in that comparison. Restating it here would be a second guard
// over one fact, and the day they disagree the honest answer would be unclear.
// What follows is what only THIS join can be asked.

test('every ceremony moment is reachable in SQL, and the mapping is not empty', async () => {
  for (const moment of KWENTO_MOMENTS) {
    const r = await db.query<{ n: number }>(
      `SELECT count(*)::int AS n FROM public.papic_challenge_library
        WHERE moment_keys @> ARRAY[$1]::text[]`,
      [moment.key],
    );
    assert.equal(
      Number(r.rows[0]!.n),
      MOMENT_CHALLENGES[moment.key].length,
      `${moment.key} has a different number of prompts in the database than the pool declares`,
    );
  }
});

test('a wedding’s moment yields the prompts a coordinator would expect', async () => {
  // The named case, executed against the real table and the real scope filter.
  const expect: [string, string][] = [
    ['bridal_march', 'the-aisle-walk'],
    ['exchange_of_vows', 'the-vows'],
    ['veil_and_cord', 'the-unity-moment'],
    ['first_kiss', 'the-first-kiss'],
    ['first_dance', 'the-first-dance'],
    ['cake_cutting', 'the-cake-cut'],
    ['money_dance', 'the-money-dance'],
  ];
  for (const [moment, slug] of expect) {
    const slugs = await mappedInScope(moment, 'wedding');
    assert.ok(slugs.includes(slug), `a wedding’s ${moment} does not offer ${slug}`);
    assert.ok(slugs.length >= 2, `a wedding’s ${moment} offers ${slugs.length} prompt(s) — no choice at all`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 2 · THE DEGRADE — never to nothing
// ═══════════════════════════════════════════════════════════════════════════

test('a wedding degrades at NO moment — the celebration the sequence was written for is fully served', async () => {
  // The degrade is a safety net, not the normal case. If a wedding is falling
  // back anywhere, the mapping has a hole in it and the fallback is hiding it.
  for (const moment of KWENTO_MOMENTS) {
    const slugs = await mappedInScope(moment.key, 'wedding');
    assert.ok(
      slugs.length >= 2,
      `a wedding degrades at ${moment.key} (${slugs.length} in scope) — the sequence has a hole and the fallback is covering it`,
    );
  }
});

test('a birthday DOES reach a moment with nothing mapped in scope, and the general pool is there', async () => {
  // ⚠ THIS IS THE LIVE SHAPE, NOT A CONSTRUCTED ONE, and the first draft of
  // this test asserted the WRONG moment: `bridal_march` looks wedding-only and
  // is not — `the-reaction-shot` and `the-applause` fit any celebration, so it
  // has two in scope at a birthday. Measured rather than assumed, the moment
  // that genuinely empties is the veil and cord, whose three prompts are all
  // scoped to a wedding (and, for the blessing, a christening).
  const degraded: string[] = [];
  for (const moment of KWENTO_MOMENTS) {
    if ((await mappedInScope(moment.key, 'birthday')).length === 0) degraded.push(moment.key);
  }
  assert.ok(
    degraded.length > 0,
    'no moment degrades at a birthday any more, so this file has stopped testing the ruled fallback at all — find the moment that does, or delete the fallback',
  );
  assert.ok(
    degraded.includes('veil_and_cord'),
    `the degraded moments are ${JSON.stringify(degraded)}; the veil and cord is wedding-scoped throughout and should be among them`,
  );

  // And the pool it falls back to is really there — a fallback that cannot fill
  // a shelf is the "degrades to nothing" the ruling forbids, one step removed.
  const general = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_challenge_library
      WHERE is_active AND mission_type <> 'face_verified'
        AND (event_types IS NULL OR 'birthday' = ANY (event_types))`,
  );
  assert.ok(
    Number(general.rows[0]!.n) >= SEQUENCE_SUGGESTIONS,
    `the fallback pool holds ${general.rows[0]!.n} prompts for a birthday — a degraded moment could not fill a shelf`,
  );
});

test('a birthday is never offered a wedding prompt at ANY moment', async () => {
  // The movie-night defect, asked of the new join: the sequence must not become
  // a second door past `event_types`.
  for (const moment of KWENTO_MOMENTS) {
    const slugs = await mappedInScope(moment.key, 'birthday');
    const r = await db.query<{ slug: string }>(
      `SELECT slug FROM public.papic_challenge_library
        WHERE slug = ANY($1::text[]) AND event_types IS NOT NULL
          AND NOT ('birthday' = ANY (event_types))`,
      [slugs],
    );
    assert.deepEqual(r.rows, [], `${moment.key} offered a birthday a scoped prompt: ${JSON.stringify(r.rows)}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// 3 · ONE CHALLENGE PER MOMENT, REFUSED BY THE DATABASE
// ═══════════════════════════════════════════════════════════════════════════

test('a second challenge at the same moment is refused', async () => {
  const f = await seedEvent('one-per-moment');
  await place(f.eventId, 907, 'cake_cutting');
  await assert.rejects(
    () => place(f.eventId, 908, 'cake_cutting'),
    /papic_missions_one_challenge_per_moment/,
    'two prompts sat at one moment; the run of show would then have no answer to "what is asked at the cake cutting"',
  );
});

test('the same moment at a DIFFERENT celebration is fine', async () => {
  const a = await seedEvent('moment-a');
  const b = await seedEvent('moment-b');
  await place(a.eventId, 1220, 'cake_cutting');
  await place(b.eventId, 1220, 'cake_cutting');
  // Two celebrations, no interference — the index is per event, as it must be.
});

test('missions with no moment coexist freely — the index is partial', async () => {
  const f = await seedEvent('partial');
  await place(f.eventId, 900, null);
  await place(f.eventId, 901, null);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions
      WHERE event_id = $1 AND moment_key IS NULL`,
    [f.eventId],
  );
  assert.equal(Number(r.rows[0]!.n), 2, 'the unique index leaked onto ordinary board challenges');
});

test('a moment_key the app does not know is refused by the CHECK', async () => {
  // A typo would store cleanly, occupy the slot, and render NOWHERE — a
  // challenge the coordinator believes is placed and no screen will ever show.
  const f = await seedEvent('bad-key');
  await assert.rejects(
    () => place(f.eventId, 900, 'garter_toss'),
    /papic_missions_moment_key_check/,
  );
});

test('the CHECK admits exactly the ten moments the application knows', async () => {
  // 🔑 THE DATABASE'S LIST AND KWENTO_MOMENTS ARE TWO STATEMENTS OF ONE FACT.
  // Asserted by USING each key, not by parsing the constraint text — a regex
  // over `pg_constraint` would pass on a comment.
  const f = await seedEvent('every-key');
  for (const moment of KWENTO_MOMENTS) {
    await place(f.eventId, 900 + KWENTO_MOMENTS.indexOf(moment), moment.key);
  }
  const r = await db.query<{ n: number }>(
    `SELECT count(DISTINCT moment_key)::int AS n FROM public.papic_missions
      WHERE event_id = $1 AND moment_key IS NOT NULL`,
    [f.eventId],
  );
  assert.equal(Number(r.rows[0]!.n), KWENTO_MOMENTS.length);
});

// ═══════════════════════════════════════════════════════════════════════════
// 4 · THE SEQUENCE IS THE CLOCK — and the clock is 4a's
// ═══════════════════════════════════════════════════════════════════════════

test('arming a moment’s challenge closes the previous moment’s — through papic_arm_challenge, not beside it', async () => {
  const f = await seedEvent('sequence-arms');
  const march = await place(f.eventId, 1225, 'bridal_march');
  const vows = await place(f.eventId, 1224, 'exchange_of_vows');

  assert.equal(await isOpen(march), false, 'an unplayed moment must not read as open');

  const t1 = await armAsCouple(f.coupleUid, march);
  assert.ok(t1, 'the coordinator can arm the first moment');
  assert.equal(await isOpen(march), true);
  assert.equal(await isOpen(vows), false, 'a later moment is not open before it is reached');

  // ── THE SEQUENCE ADVANCES. Nothing here closes the march explicitly: the act
  // of arming the vows is what closes it, in one transaction, inside 4a's
  // function. If item 5 had grown its own arming, this is the assertion that
  // would fail — and the partial unique index would have been trodden on.
  const t2 = await armAsCouple(f.coupleUid, vows);
  assert.ok(t2, 'the coordinator can advance to the next moment');
  assert.equal(await isOpen(vows), true, 'the moment that is happening is the one being asked');
  assert.equal(await isOpen(march), false, 'the previous moment did not close — two prompts are live at once');

  const armed = await db.query<{ mission_id: string }>(
    `SELECT mission_id FROM public.papic_armed_challenge($1::uuid)`,
    [f.eventId],
  );
  assert.equal(armed.rows.length, 1, 'the celebration must name exactly one live challenge');
  assert.equal(armed.rows[0]!.mission_id, vows);
});

test('the run of show cannot put two challenges on air, even by racing', async () => {
  // 4a's partial unique index, exercised through the sequence's own writes.
  const f = await seedEvent('two-on-air');
  const a = await place(f.eventId, 1226, 'first_dance');
  const b = await place(f.eventId, 1220, 'cake_cutting');
  await armAsCouple(f.coupleUid, a);
  await assert.rejects(
    () =>
      db.query(
        `UPDATE public.papic_missions SET armed_at = NOW(), closed_at = NULL WHERE mission_id = $1`,
        [b],
      ),
    /papic_missions_one_armed_per_event/,
    'a direct write put a second challenge on air; the index is the reason the wall and the phone cannot disagree',
  );
});

test('taking a challenge off a moment does not close it — that is the clock’s job, not the plan’s', async () => {
  // 🔴 The two acts are different. A coordinator tidying the plan mid-answer
  // must not stop the room from answering.
  const f = await seedEvent('clear-not-close');
  const m = await place(f.eventId, 1220, 'cake_cutting');
  await armAsCouple(f.coupleUid, m);
  assert.equal(await isOpen(m), true);

  await db.query(`UPDATE public.papic_missions SET moment_key = NULL WHERE mission_id = $1`, [m]);
  assert.equal(
    await isOpen(m),
    true,
    'clearing the moment closed the prompt; openness has exactly one decider and this is not it',
  );
});

test('hiding a placed challenge closes it — through the resolver, with no help from the sequence', async () => {
  const f = await seedEvent('placed-hidden');
  const m = await place(f.eventId, 1226, 'first_dance');
  await armAsCouple(f.coupleUid, m);
  assert.equal(await isOpen(m), true);

  await db.query(`UPDATE public.papic_missions SET is_active = false WHERE mission_id = $1`, [m]);
  assert.equal(await isOpen(m), false, 'a prompt that reaches no guest is not being asked');
});

// ═══════════════════════════════════════════════════════════════════════════
// 5 · THE SHUTTER IS NEVER CLOSED BY ANY OF THIS
// ═══════════════════════════════════════════════════════════════════════════

test('no capture function consults the ceremony sequence', async () => {
  // 🔴 EXPIRY CLOSES THE PROMPT, NEVER THE SHUTTER, and item 5 must not become
  // the change that quietly wires it in. Asked of the shipped function bodies,
  // not of the repository's source: a capture path that started reading
  // `moment_key` would be invisible to a grep over `apps/`.
  const r = await db.query<{ proname: string }>(
    `SELECT p.proname
       FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public'
        AND p.proname IN ('papic_record_guest_capture','papic_record_seat_capture','papic_complete_mission')
        AND (pg_get_functiondef(p.oid) ILIKE '%moment_key%'
          OR pg_get_functiondef(p.oid) ILIKE '%moment_keys%')`,
  );
  assert.deepEqual(
    r.rows,
    [],
    `a capture path now reads the ceremony sequence: ${JSON.stringify(r.rows)} — a guest is never refused a photo for lateness`,
  );
});

test('the sequence added no time of its own — there is exactly ONE duration, and it is the owner\'s', async () => {
  // ⚠ THIS ASSERTION USED TO BE "papic_missions HAS NO DURATION AT ALL", and it
  // was right when it was written and wrong within the day. The brief item 5 was
  // built from said *"No duration column, no default duration number"*; the
  // owner then chose 30 · 60 · 120 (default 30), and `armed_duration_minutes`
  // landed on main in 20271188710305. The old form failed the moment those two
  // branches met — correctly, because it was guarding a ruling that no longer
  // existed.
  //
  // 🔑 SO IT NOW GUARDS WHAT IS STILL TRUE, AND IT IS THE MORE USEFUL PROPERTY
  // ANYWAY: there is exactly ONE duration on this table, and the ceremony
  // sequence is not the thing that put it there. Two sessions were building on
  // this table on the same day; a SECOND duration — one for the arming and one
  // for the moment — is precisely the "two mechanisms that disagree about one
  // fact" this project has paid for repeatedly, and each would pass its own
  // suite.
  const r = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'papic_missions'
        AND (column_name ILIKE '%duration%' OR column_name ILIKE '%expires%'
          OR column_name ILIKE '%ends_at%' OR column_name ILIKE '%minutes%')
      ORDER BY column_name`,
  );
  assert.deepEqual(
    r.rows.map((x) => x.column_name),
    ['armed_duration_minutes'],
    'papic_missions carries a duration the owner did not choose, or a second one beside it',
  );

  // And the sequence's own columns carry no time whatsoever. A `moment_*`
  // column with a length on it would be the second duration, wearing item 5's
  // name.
  const mine = await db.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'papic_missions'
        AND column_name ILIKE 'moment%'
      ORDER BY column_name`,
  );
  assert.deepEqual(
    mine.rows.map((x) => x.column_name),
    ['moment_key'],
    'the ceremony sequence grew a column beyond moment_key — if it holds time, the sequence has become a second clock',
  );
});
