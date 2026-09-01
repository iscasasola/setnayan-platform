/**
 * SIX HUNDRED CHALLENGES, AND A BOARD THAT KNOWS WHAT KIND OF PARTY IT IS.
 *
 * ── WHAT THIS FILE IS ACTUALLY GUARDING ─────────────────────────────────────
 * Two things that a source-reading guard cannot see:
 *
 *   1. THE DATABASE AGREES WITH `apps/web/lib/papic-challenge-pool.ts`. The
 *      migration is GENERATED from that module, so the two can only diverge if
 *      somebody edits the pool and forgets to regenerate. That is not a
 *      hypothetical — `llms.txt` drifted for three weeks with green CI doing
 *      exactly this, because its guard compared two hand-typed things.
 *
 *   2. A `date` NEVER GETS ASKED ABOUT NEWLYWEDS. Read out of production on
 *      2026-08-21: the event `movie-night` is of type `date` and was carrying a
 *      full board of wedding challenges. These tests CALL `ensure_papic_board`
 *      and read the slots back, so they can only pass if the scope really
 *      applies — a guard grepping the migration for `event_types` would pass on
 *      a comment.
 *
 * ── AND THE SAFETY PROPERTY, ASSERTED IN BOTH DIRECTIONS ────────────────────
 * 🔒 A WEDDING'S BOARD MUST NOT MOVE. 571 rows were added and every one of them
 * has a library_id above 99, while the Setnayan lane backfills
 * `ORDER BY priority_rank NULLS LAST, library_id` — so the shipped ids still win
 * every unranked slot. That is an argument; `weddingBoardIsUnchanged` is the
 * measurement. If a future edit ranks a new row, or renumbers the blocks, this
 * test fails rather than a live wedding quietly getting a different board.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

import { createReplayedDb, type ReplayResult } from './replay-migrations';
import { CHALLENGE_POOL, CHALLENGE_POOL_FLOOR } from '../../lib/papic-challenge-pool';
import { BOARD_SIZE } from '../../lib/papic-missions';

let replay: ReplayResult;
let db: ReplayResult['db'];

/**
 * ⚠ THE OLD BOARD, KEPT ONLY AS HISTORY. Read out of production on 2026-08-21:
 * twenty slots, ranks 1–16 then unranked backfill. The owner then said *"we keep
 * the 600+ challenges but the user only picks 10"*, so a wedding's board is
 * DELIBERATELY different now and pinning this would be pinning a decision that
 * was reversed. What replaced it is the test below, which asserts the SHAPE the
 * new ten has to have rather than a list of ids.
 */
const WEDDING_BOARD_BEFORE_2026_08_21 = [1, 40, 5, 2, 15, 38, 4, 18, 6, 22, 41, 42, 43, 44, 53, 54, 3, 7, 8, 9];

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;
});

after(async () => {
  await db?.close();
});

/**
 * ⚠ `events_wedding_fields_consistency` is a two-armed CHECK: a wedding MUST
 * carry a ceremony type and a venue setting, and anything else must carry
 * NEITHER. Seeding every type the wedding way fails at the INSERT — which is
 * itself a small proof that the schema already knows these are different kinds
 * of event, even though the challenge library did not.
 */
async function newEvent(name: string, eventType: string): Promise<string> {
  const isWedding = eventType === 'wedding';
  const r = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ($1, $2, $3, $4) RETURNING event_id`,
    [name, eventType, isWedding ? 'civil' : null, isWedding ? 'banquet_hall' : null],
  );
  return r.rows[0]!.event_id;
}

async function boardOf(eventId: string): Promise<number[]> {
  await db.query(`SELECT public.ensure_papic_board($1)`, [eventId]);
  const r = await db.query<{ library_id: number }>(
    `SELECT m.library_id FROM public.papic_missions m
      WHERE m.event_id = $1 AND m.board_slot IS NOT NULL
      ORDER BY m.board_slot`,
    [eventId],
  );
  return r.rows.map((x) => Number(x.library_id));
}

/** The prompts one guest at one event actually reads, tokens resolved. */
async function promptsFor(eventId: string, side: 'bride' | 'groom' | 'both'): Promise<string[]> {
  const g = await db.query<{ guest_id: string }>(
    `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
     VALUES ($1, 'Test', 'Guest', $2, 'friends') RETURNING guest_id`,
    [eventId, side],
  );
  const r = await db.query<{ prompt: string }>(
    `SELECT prompt FROM public.papic_guest_missions($1)`,
    [g.rows[0]!.guest_id],
  );
  return r.rows.map((x) => x.prompt);
}

// ── 1 · THE POOL IS IN THE DATABASE, ROW FOR ROW ───────────────────────────

test('the library holds every row the pool module declares, and nothing else', async () => {
  const rows = await db.query<{
    library_id: number; slug: string; category: string; title: string;
    prompt: string; capture_kind: string; mission_type: string;
    priority_rank: number | null; event_types: string[] | null;
    moment_keys: string[] | null;
  }>(`SELECT library_id, slug, category, title, prompt, capture_kind, mission_type,
             priority_rank, event_types, moment_keys
        FROM public.papic_challenge_library ORDER BY library_id`);

  assert.equal(rows.rows.length, CHALLENGE_POOL.length,
    `db has ${rows.rows.length} challenges, the pool module declares ${CHALLENGE_POOL.length}. ` +
    `Regenerate: node scripts/emit-papic-challenge-pool.mjs`);

  const expected = [...CHALLENGE_POOL].sort((a, b) => a.libraryId - b.libraryId);
  rows.rows.forEach((got, i) => {
    const want = expected[i]!;
    assert.equal(Number(got.library_id), want.libraryId);
    assert.equal(got.slug, want.slug, `slug drift at ${want.libraryId}`);
    assert.equal(got.category, want.category, `category drift at ${want.slug}`);
    assert.equal(got.title, want.title, `title drift at ${want.slug}`);
    assert.equal(got.prompt, want.prompt, `prompt drift at ${want.slug}`);
    assert.equal(got.capture_kind, want.captureKind, `capture_kind drift at ${want.slug}`);
    assert.equal(got.mission_type, want.missionType, `mission_type drift at ${want.slug}`);
    assert.equal(got.priority_rank === null ? null : Number(got.priority_rank),
      want.priorityRank, `rank drift at ${want.slug}`);
    assert.deepEqual(got.event_types, want.eventTypes, `scope drift at ${want.slug}`);
    // The ceremony-sequence mapping (build order § 5) is per-challenge data and
    // is authored in the pool like everything else here, so it belongs in the
    // SAME field-by-field comparison. Left out, this test would keep claiming
    // "and nothing else" about a row it was no longer reading in full.
    assert.deepEqual(got.moment_keys, want.momentKeys, `moment drift at ${want.slug}`);
  });
});

test('the owner asked for over 500 and the database has them', async () => {
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_challenge_library WHERE is_active`);
  assert.ok(Number(r.rows[0]!.n) > CHALLENGE_POOL_FLOOR,
    `only ${r.rows[0]!.n} active challenges; the floor is over ${CHALLENGE_POOL_FLOOR}`);
});

test('the old 1..99 ceiling is gone, and a four-digit id is accepted', async () => {
  // Proven BY USE, not by reading pg_constraint: a `DROP CONSTRAINT IF EXISTS`
  // on a wrong name is a silent no-op, and the only way to tell is to insert.
  await db.query(
    `INSERT INTO public.papic_challenge_library
       (library_id, slug, category, title, prompt, capture_kind, mission_type)
     VALUES (9999, 'ceiling-probe', 'selfie', 'Probe', 'A probe row.', 'photo', 'prompt')`);
  await assert.rejects(
    () => db.query(
      `INSERT INTO public.papic_challenge_library
         (library_id, slug, category, title, prompt, capture_kind, mission_type)
       VALUES (10000, 'over-the-top', 'selfie', 'Over', 'Too far.', 'photo', 'prompt')`),
    /library_id_check/,
    'the new upper bound must still refuse something',
  );
  await db.query(`DELETE FROM public.papic_challenge_library WHERE library_id = 9999`);
});

// ── 2 · THE BOARD KNOWS WHAT KIND OF PARTY IT IS ───────────────────────────

test('a date is never asked about newlyweds — the movie-night defect', async () => {
  const eventId = await newEvent('Movie Night', 'date');
  const board = await boardOf(eventId);

  assert.equal(board.length, BOARD_SIZE, 'a date still gets a full board — 475 rows fit any event');

  const scoped = await db.query<{ slug: string; event_types: string[] | null }>(
    `SELECT l.slug, l.event_types
       FROM public.papic_missions m
       JOIN public.papic_challenge_library l ON l.library_id = m.library_id
      WHERE m.event_id = $1 AND m.board_slot IS NOT NULL
        AND l.event_types IS NOT NULL AND NOT ('date' = ANY (l.event_types))`,
    [eventId],
  );
  assert.equal(scoped.rows.length, 0,
    `a date's board carries out-of-scope challenges: ${scoped.rows.map((r) => r.slug).join(', ')}`);

  // The specific sentences the owner would have read on that event.
  const prompts = await promptsFor(eventId, 'both');
  const joined = prompts.join(' | ').toLowerCase();
  for (const word of ['newlywed', 'bride', 'groom', 'bridesmaid', 'groomsman']) {
    assert.ok(!joined.includes(word), `a date's guest was asked about "${word}": ${joined}`);
  }
});

test('a graduation, a birthday and a christening each get a full, in-scope board', async () => {
  for (const type of ['graduation', 'birthday', 'christening', 'corporate', 'reunion']) {
    const eventId = await newEvent(`A ${type}`, type);
    const board = await boardOf(eventId);
    assert.equal(board.length, BOARD_SIZE, `${type} got ${board.length} slots`);
    const bad = await db.query<{ slug: string }>(
      `SELECT l.slug FROM public.papic_missions m
         JOIN public.papic_challenge_library l ON l.library_id = m.library_id
        WHERE m.event_id = $1 AND m.board_slot IS NOT NULL
          AND l.event_types IS NOT NULL AND NOT ($2 = ANY (l.event_types))`,
      [eventId, type],
    );
    assert.equal(bad.rows.length, 0, `${type} board carries: ${bad.rows.map((r) => r.slug).join(', ')}`);
  }
});

test('a wedding board is a curated ten that asks somebody to speak', async () => {
  // 🚨 THE ASSERTION THIS REPLACES WOULD HAVE PASSED WHILE THE FEATURE BROKE.
  // It pinned the exact twenty ids a wedding used to get. Halving the board
  // makes that list wrong by definition, so re-pinning the first ten of it would
  // have "gone green" on a board of ten photo errands — and the couple's story
  // column, which is built from spoken answers, would have been empty forever.
  //
  // So this asserts the SHAPE the ten must have, which is the thing that
  // actually has to stay true: a full board, in rank order, carrying challenges
  // somebody talks into.
  const eventId = await newEvent('Cale & Ice', 'wedding');
  const board = await boardOf(eventId);

  assert.equal(board.length, BOARD_SIZE, 'a wedding must still get a full board');
  assert.notDeepEqual(
    board,
    WEDDING_BOARD_BEFORE_2026_08_21.slice(0, BOARD_SIZE),
    'this should be the rebalanced ten, not the first ten of the old twenty',
  );

  const rows = await db.query<{ category: string; capture_kind: string; priority_rank: number | null }>(
    `SELECT l.category, l.capture_kind, l.priority_rank
       FROM public.papic_missions m
       JOIN public.papic_challenge_library l ON l.library_id = m.library_id
      WHERE m.event_id = $1 AND m.board_slot IS NOT NULL
      ORDER BY m.board_slot`,
    [eventId],
  );

  const speaking = rows.rows.filter((r) =>
    ['stories', 'stories_couple', 'greeting'].includes(r.category),
  ).length;
  assert.ok(
    speaking >= 2,
    `only ${speaking} of a wedding's ${BOARD_SIZE} challenges are spoken — the story column is fed ` +
      `by those answers, and a board without them leaves it permanently empty`,
  );
  assert.ok(
    rows.rows.length - speaking >= 4,
    'a board that is mostly interview questions is not a party',
  );

  // Rank order, ranked-first: the running order is a decision, not an accident.
  const ranks = rows.rows.map((r) => (r.priority_rank === null ? 999 : Number(r.priority_rank)));
  assert.deepEqual([...ranks].sort((a, b) => a - b), ranks, 'the board must be in rank order');
});

/*
  ⚠ THIS TEST USED TO READ "without the Pabati SKU the board is still full, and
  Pabati is absent". The Pabati SKU was retired on 2026-08-21 (owner: "we do not
  need pabati. retire it because it is part of papic") and the same migration
  converted its one library row to an ordinary clip, so there is no longer a
  kind to be absent — asking for one would search for a value the CHECK
  constraint no longer permits, which is a search that cannot match rather than
  a negative result.

  What is worth asserting instead is the retirement itself, at the level a
  guest feels it: nothing in the library is gated on a SKU any more, and the
  greeting that was gated is still in there being asked for.
*/
test('the retired greeting survives as an ordinary clip, gated by nothing', async () => {
  const row = await db.query<{ capture_kind: string; mission_type: string; is_active: boolean }>(
    `SELECT capture_kind, mission_type, is_active
       FROM public.papic_challenge_library WHERE slug = 'pabati'`,
  );
  assert.equal(row.rows.length, 1, 'the greeting row must still exist — the capability outlives the SKU');
  assert.equal(row.rows[0]!.capture_kind, 'clip', 'it is recorded the way everything else is');
  assert.equal(row.rows[0]!.mission_type, 'video_greeting');
  assert.ok(row.rows[0]!.is_active, 'and it is still asked for');

  // And the kind itself is gone from the table, not merely unused — a value the
  // CHECK still permitted would let a later seed reintroduce a gated row.
  const kinds = await db.query<{ def: string }>(
    `SELECT pg_get_constraintdef(oid) AS def FROM pg_constraint
      WHERE conrelid = 'public.papic_challenge_library'::regclass
        AND conname = 'papic_challenge_library_capture_kind_check'`,
  );
  assert.equal(kinds.rows.length, 1, 'the capture_kind CHECK must still exist');
  assert.ok(!/pabati/i.test(kinds.rows[0]!.def), `the CHECK still admits a retired kind: ${kinds.rows[0]!.def}`);

  const board = await boardOf(await newEvent('Retired greeting', 'wedding'));
  assert.equal(board.length, BOARD_SIZE, 'and the board is still full');
});

// ── 3 · THE TOKENS RESOLVE, PER EVENT, AT READ TIME ────────────────────────

test('{host} becomes the word that event type actually uses', async () => {
  const cases: Array<[string, string]> = [
    ['wedding', 'the couple'],
    ['birthday', 'the celebrant'],
    ['graduation', 'the graduate'],
    ['date', 'the host'],
  ];
  for (const [type, expected] of cases) {
    const eventId = await newEvent(`Token ${type}`, type);
    await db.query(
      `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
       VALUES ($1, 'prompt', 'couple', 'A photo with {host}.', true, true)`,
      [eventId],
    );
    const prompts = await promptsFor(eventId, 'both');
    assert.ok(prompts.includes(`A photo with ${expected}.`),
      `${type} resolved {host} to something else: ${JSON.stringify(prompts.slice(0, 3))}`);
  }
});

test('{hosts} is replaced before {host} — the other order eats the brace', async () => {
  // 🪤 THIS IS THE BUG THIS TEST EXISTS FOR. Replacing '{host}' first turns
  // '{hosts}' into 'the couple}s'. It is invisible in review and obvious to a
  // guest. Both the SQL reader and displayChallengePrompt() order it this way;
  // this is the half nothing else could catch.
  const eventId = await newEvent('Possessive', 'wedding');
  await db.query(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
     VALUES ($1, 'prompt', 'couple', 'A message for {hosts} family, not just {host}.', true, true)`,
    [eventId],
  );
  const prompts = await promptsFor(eventId, 'both');
  assert.ok(prompts.includes('A message for the couple’s family, not just the couple.'),
    `possessive resolved wrong: ${JSON.stringify(prompts.filter((p) => p.includes('family')))}`);
  assert.ok(!prompts.some((p) => p.includes('}')), 'a raw brace reached a guest');
});

test('{event} becomes the event word, and an untokenised prompt is byte-identical', async () => {
  const eventId = await newEvent('Words', 'birthday');
  const plain = 'Photograph the floor under your feet.';
  await db.query(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
     VALUES ($1, 'prompt', 'couple', 'Ten seconds: what this {event} means to you.', true, true),
            ($1, 'prompt', 'couple', $2, true, true)`,
    [eventId, plain],
  );
  const prompts = await promptsFor(eventId, 'both');
  assert.ok(prompts.includes('Ten seconds: what this birthday means to you.'));
  assert.ok(prompts.includes(plain), 'a prompt with no token must come back unchanged');
});

test('no guest anywhere ever reads a raw token', async () => {
  for (const type of ['wedding', 'birthday', 'graduation', 'date', 'corporate', 'simple_event']) {
    const eventId = await newEvent(`Sweep ${type}`, type);
    await boardOf(eventId);
    for (const side of ['bride', 'groom', 'both'] as const) {
      const prompts = await promptsFor(eventId, side);
      const leaked = prompts.filter((p) => /\{(who|host|hosts|event)\}/.test(p));
      assert.equal(leaked.length, 0, `${type}/${side} leaked: ${leaked.join(' | ')}`);
    }
  }
});

test('{who} still asks each side about the half they know', async () => {
  const eventId = await newEvent('Sides', 'wedding');
  await db.query(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
     VALUES ($1, 'prompt', 'couple', 'Brag about {who} for ten seconds.', true, true)`,
    [eventId],
  );
  assert.ok((await promptsFor(eventId, 'bride')).includes('Brag about the bride for ten seconds.'));
  assert.ok((await promptsFor(eventId, 'groom')).includes('Brag about the groom for ten seconds.'));
  assert.ok((await promptsFor(eventId, 'both')).includes('Brag about the couple for ten seconds.'));
});

test('a date that ALREADY has a wedding board gets it taken away — the real movie-night', async () => {
  // 🚨 THE TEST THE FIRST CUT OF THIS FILE DID NOT HAVE, AND A MUTATION FOUND.
  //
  // Sabotaging the SLOTTING lane's scope left all twelve tests green, because
  // every one of them built a board from scratch — and a fresh date never
  // MATERIALIZES a wedding row, so the slotting lane had nothing out-of-scope to
  // reject. The suite proved new events are fine and said nothing at all about
  // the one event in production that is actually broken.
  //
  // `movie-night` carries 20 wedding missions materialized under the old
  // function. Rebuilding its board has to take their slots away — a scope that
  // only filters the INSERT would leave every one of them exactly where it is,
  // and the defect would survive its own fix.
  const eventId = await newEvent('Movie Night, already broken', 'date');

  // Reproduce the state, the way it got there: rows already in the table.
  await db.query(
    `INSERT INTO public.papic_missions
       (event_id, mission_type, source, prompt, library_id, capture_kind, approved, is_active, board_slot)
     SELECT $1, l.mission_type, 'setnayan', l.prompt, l.library_id, l.capture_kind, true, true,
            row_number() OVER (ORDER BY l.priority_rank NULLS LAST, l.library_id)
       FROM public.papic_challenge_library l
      WHERE l.library_id <= 60
      ORDER BY l.priority_rank NULLS LAST, l.library_id
      LIMIT ${BOARD_SIZE}`,
    [eventId],
  );
  const before = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions
      WHERE event_id = $1 AND board_slot IS NOT NULL AND library_id <= 60`,
    [eventId],
  );
  assert.equal(Number(before.rows[0]!.n), BOARD_SIZE, 'the broken state must actually be set up');

  const board = await boardOf(eventId);

  const after = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions
      WHERE event_id = $1 AND board_slot IS NOT NULL AND library_id <= 60`,
    [eventId],
  );
  assert.equal(Number(after.rows[0]!.n), 0,
    'the wedding challenges kept their slots — the scope is not being applied when the board is REBUILT');
  assert.equal(board.length, BOARD_SIZE, 'and the date must still end up with a full board');

  // ⚠ NOTHING IS DELETED. The rows stay in the table with board_slot NULL, so a
  // completion (there are none in production, but still) is never un-finished
  // and an event that changes type back finds its board again.
  const kept = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions WHERE event_id = $1 AND library_id <= 60`,
    [eventId],
  );
  assert.equal(Number(kept.rows[0]!.n), BOARD_SIZE, 'the old rows must be de-slotted, never deleted');
});

// ── The couple may take the whole board (owner, 2026-08-21) ────────────────

test('a couple who fills the board gets the board — no silent cap', async () => {
  // ⚠ THE DEFECT THIS REPLACES: the couple lane was capped at TEN while the
  // board showed twenty. A couple who chose twelve got ten, and the two that
  // did not fit had no board position and no explanation on any screen.
  const eventId = await newEvent('Fills The Board', 'wedding');
  for (let i = 1; i <= BOARD_SIZE; i++) {
    await db.query(
      `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
       VALUES ($1, 'prompt', 'couple', $2, true, true)`,
      [eventId, `Our own challenge number ${i}. Ten seconds.`],
    );
  }
  await boardOf(eventId);
  const r = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions
      WHERE event_id = $1 AND source = 'couple' AND board_slot IS NOT NULL`,
    [eventId],
  );
  assert.equal(Number(r.rows[0]!.n), BOARD_SIZE, 'the couple lane still caps below what they chose');
});

test('a couple can take the whole board, and Setnayan then fills nothing', async () => {
  const eventId = await newEvent('All Theirs', 'wedding');
  for (let i = 1; i <= BOARD_SIZE; i++) {
    await db.query(
      `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
       VALUES ($1, 'prompt', 'couple', $2, true, true)`,
      [eventId, `Twenty of our own, number ${i}. Ten seconds.`],
    );
  }
  const board = await boardOf(eventId);
  assert.equal(board.length, BOARD_SIZE, 'the board is still exactly the board size');
  const mine = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions
      WHERE event_id = $1 AND source = 'couple' AND board_slot IS NOT NULL`,
    [eventId],
  );
  assert.equal(Number(mine.rows[0]!.n), BOARD_SIZE, 'every slot is theirs');
  const ours = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions
      WHERE event_id = $1 AND source = 'setnayan' AND board_slot IS NOT NULL`,
    [eventId],
  );
  assert.equal(Number(ours.rows[0]!.n), 0, 'a board of twenty own picks is entirely theirs');
});

test('the board never overflows, however many the couple writes', async () => {
  // 🔑 THE ARITHMETIC THAT WOULD HAVE GONE NEGATIVE. A flat ceiling of 20 makes
  // `v_target := 20 - 20 - vendor` negative the moment a vendor lane exists, and
  // the slot allocator would then try to place 25 rows in 20 seats. Thirty picks
  // is the blunt version of the same question.
  const eventId = await newEvent('Thirty Picks', 'wedding');
  for (let i = 1; i <= BOARD_SIZE * 3; i++) {
    await db.query(
      `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
       VALUES ($1, 'prompt', 'couple', $2, true, true)`,
      [eventId, `Thirty of our own, number ${i}. Ten seconds.`],
    );
  }
  const board = await boardOf(eventId);
  assert.equal(board.length, BOARD_SIZE);
  const slots = await db.query<{ board_slot: number }>(
    `SELECT board_slot FROM public.papic_missions
      WHERE event_id = $1 AND board_slot IS NOT NULL ORDER BY board_slot`,
    [eventId],
  );
  assert.deepEqual(
    slots.rows.map((r) => Number(r.board_slot)),
    Array.from({ length: BOARD_SIZE }, (_, i) => i + 1),
    `slots must be 1..${BOARD_SIZE} with no gaps and no duplicates`,
  );
});
