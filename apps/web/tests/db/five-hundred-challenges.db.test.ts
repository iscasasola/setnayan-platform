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

let replay: ReplayResult;
let db: ReplayResult['db'];

/** The exact board a wedding got BEFORE this change, read out of production
 *  (event 044f7e64…, 2026-08-21). Slots 1–16 are the ranked heroes and stories;
 *  17–20 are the unranked backfill in library order. */
const WEDDING_BOARD_BEFORE = [1, 40, 5, 2, 15, 38, 4, 18, 6, 22, 41, 42, 43, 44, 53, 54, 3, 7, 8, 9];

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

async function boardOf(eventId: string, pabatiActive = false): Promise<number[]> {
  await db.query(`SELECT public.ensure_papic_board($1, $2)`, [eventId, pabatiActive]);
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
  }>(`SELECT library_id, slug, category, title, prompt, capture_kind, mission_type,
             priority_rank, event_types
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

  assert.equal(board.length, 20, 'a date still gets a full board — 475 rows fit any event');

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
    assert.equal(board.length, 20, `${type} got ${board.length} slots`);
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

test('a wedding board is unchanged — 571 rows added, not one slot moved', async () => {
  // ⚠ PABATI ON. The production board this array was read from belongs to an
  // event that owns the Pabati SKU, and `ensure_papic_board` drops the Pabati
  // row when it does not. Comparing a pabati-OFF board against a pabati-ON
  // measurement fails for a reason that has nothing to do with this change —
  // and it did, on the first run, which is the only reason this note exists.
  const eventId = await newEvent('Cale & Ice', 'wedding');
  const board = await boardOf(eventId, true);
  assert.deepEqual(board, WEDDING_BOARD_BEFORE,
    'a wedding board moved. New rows must stay unranked and above library_id 99, ' +
    'or every couple already planning gets a different board than the one they curated.');
});

test('without the Pabati SKU a wedding board is the same list, minus Pabati', async () => {
  // The one row that is allowed to differ, and the proof that nothing ELSE
  // shifted: drop id 5, and the 20th slot is filled by the next shipped row in
  // library order — never by one of the 571 new ones.
  const eventId = await newEvent('No Pabati', 'wedding');
  const board = await boardOf(eventId, false);
  assert.equal(board.length, 20);
  assert.ok(!board.includes(5), 'Pabati must not board without its SKU');
  assert.deepEqual(
    board.slice(0, 19),
    WEDDING_BOARD_BEFORE.filter((id) => id !== 5),
    'removing Pabati must shift the list up, not reshuffle it',
  );
  assert.ok(board[19]! <= 60, `slot 20 went to a new row (${board[19]}), not the next shipped one`);
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
      WHERE l.library_id <= 60 AND l.capture_kind <> 'pabati'
      ORDER BY l.priority_rank NULLS LAST, l.library_id
      LIMIT 20`,
    [eventId],
  );
  const before = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions
      WHERE event_id = $1 AND board_slot IS NOT NULL AND library_id <= 60`,
    [eventId],
  );
  assert.equal(Number(before.rows[0]!.n), 20, 'the broken state must actually be set up');

  const board = await boardOf(eventId);

  const after = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions
      WHERE event_id = $1 AND board_slot IS NOT NULL AND library_id <= 60`,
    [eventId],
  );
  assert.equal(Number(after.rows[0]!.n), 0,
    'the wedding challenges kept their slots — the scope is not being applied when the board is REBUILT');
  assert.equal(board.length, 20, 'and the date must still end up with a full board');

  // ⚠ NOTHING IS DELETED. The rows stay in the table with board_slot NULL, so a
  // completion (there are none in production, but still) is never un-finished
  // and an event that changes type back finds its board again.
  const kept = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions WHERE event_id = $1 AND library_id <= 60`,
    [eventId],
  );
  assert.equal(Number(kept.rows[0]!.n), 20, 'the old rows must be de-slotted, never deleted');
});

// ── The couple may take the whole board (owner, 2026-08-21) ────────────────

test('a couple who picks twelve gets twelve — the ten-cap is gone', async () => {
  // ⚠ THE DEFECT THIS REPLACES: the couple lane was capped at TEN while the
  // board showed twenty. A couple who chose twelve got ten, and the two that
  // did not fit had no board position and no explanation on any screen.
  const eventId = await newEvent('Twelve Picks', 'wedding');
  for (let i = 1; i <= 12; i++) {
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
  assert.equal(Number(r.rows[0]!.n), 12, 'the couple lane still caps below what they chose');
});

test('a couple can take all twenty, and Setnayan then fills nothing', async () => {
  const eventId = await newEvent('All Twenty', 'wedding');
  for (let i = 1; i <= 20; i++) {
    await db.query(
      `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
       VALUES ($1, 'prompt', 'couple', $2, true, true)`,
      [eventId, `Twenty of our own, number ${i}. Ten seconds.`],
    );
  }
  const board = await boardOf(eventId);
  assert.equal(board.length, 20, 'the board is still exactly twenty');
  const mine = await db.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM public.papic_missions
      WHERE event_id = $1 AND source = 'couple' AND board_slot IS NOT NULL`,
    [eventId],
  );
  assert.equal(Number(mine.rows[0]!.n), 20, 'all twenty are theirs');
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
  for (let i = 1; i <= 30; i++) {
    await db.query(
      `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
       VALUES ($1, 'prompt', 'couple', $2, true, true)`,
      [eventId, `Thirty of our own, number ${i}. Ten seconds.`],
    );
  }
  const board = await boardOf(eventId);
  assert.equal(board.length, 20);
  const slots = await db.query<{ board_slot: number }>(
    `SELECT board_slot FROM public.papic_missions
      WHERE event_id = $1 AND board_slot IS NOT NULL ORDER BY board_slot`,
    [eventId],
  );
  assert.deepEqual(
    slots.rows.map((r) => Number(r.board_slot)),
    Array.from({ length: 20 }, (_, i) => i + 1),
    'slots must be 1..20 with no gaps and no duplicates',
  );
});
