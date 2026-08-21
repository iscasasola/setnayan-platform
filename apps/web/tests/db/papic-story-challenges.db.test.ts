/**
 * Story challenges + the {who} side token, proven against the FULL replayed
 * prod schema (migration 20271125220401).
 *
 * ── WHY THIS TEST EXISTS ───────────────────────────────────────────────────
 * Two things in this feature fail SILENTLY, and both look completely fine:
 *
 *  1. A LIBRARY ROW NOBODY CAN REACH. The guest board is 20 slots and the
 *     Setnayan lane backfills `ORDER BY priority_rank NULLS LAST, library_id`
 *     over a 44-row library. A story row added without a rank sorts dead last
 *     and is never placed — and NOTHING ELSE SURFACES THE LIBRARY (no app code
 *     reads papic_challenge_library; the couple's manager has no picker). The
 *     rows would exist, every query about them would succeed, and no guest
 *     would ever be asked a single one. Same shape as the face-mode column that
 *     had zero writers for seven weeks.
 *
 *  2. A TOKEN THAT REACHES A HUMAN. The prompt is stored with a literal
 *     `{who}` and swapped per guest inside papic_guest_missions. If that swap
 *     regresses, nothing errors — a guest is simply asked to "share a story
 *     about {who}". A cosmetic bug in the database is still a bug on a phone.
 *
 * The TS resolver test covers the placement ALGORITHM. This covers the SQL:
 * the seed really landed, the ranks really are what makes it reachable, and the
 * live reader really substitutes per side.
 *
 * Run: pnpm --filter @setnayan/web test:db
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import type { PGlite } from '@electric-sql/pglite';
import { createReplayedDb, type ReplayResult } from './replay-migrations';

let replay: ReplayResult;
let db: PGlite;

const STORY_SLUGS = [
  'story-most-memorable',
  'story-first-met',
  'story-crucial-part',
  'story-always-remember',
] as const;

const F = { event: '', bride: '', groom: '', both: '' };

/** The prompt the reader hands a given guest. */
async function promptFor(guestId: string, missionId: string): Promise<string> {
  const r = await db.query<{ prompt: string }>(
    `SELECT prompt FROM public.papic_guest_missions($1) WHERE mission_id = $2`,
    [guestId, missionId],
  );
  assert.equal(r.rows.length, 1, 'the reader must return the mission for this guest');
  return r.rows[0]!.prompt;
}

/** Insert a board mission and return its id. No board_slot → the reader's
 *  fail-soft branch shows it, which is exactly the path a live event without a
 *  materialized board takes today. */
async function mkMission(prompt: string): Promise<string> {
  const r = await db.query<{ mission_id: string }>(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
     VALUES ($1, 'prompt', 'setnayan', $2, true, true) RETURNING mission_id`,
    [F.event, prompt],
  );
  return r.rows[0]!.mission_id;
}

before(async () => {
  replay = await createReplayedDb();
  db = replay.db;

  // A wedding, deliberately — bride/groom sides only mean something here.
  // events_wedding_fields_consistency requires ceremony_type + venue_setting
  // for event_type='wedding' (and forbids them for anything else).
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Story Challenge Event', 'wedding', 'civil', 'banquet_hall') RETURNING event_id`,
  );
  F.event = ev.rows[0]!.event_id;

  const mkGuest = async (side: 'bride' | 'groom' | 'both', first: string) => {
    const r = await db.query<{ guest_id: string }>(
      `INSERT INTO public.guests (event_id, first_name, last_name, side, group_category)
       VALUES ($1, $2, 'Cruz', $3, 'friends') RETURNING guest_id`,
      [F.event, first, side],
    );
    return r.rows[0]!.guest_id;
  };
  F.bride = await mkGuest('bride', 'Bea');
  F.groom = await mkGuest('groom', 'Gil');
  F.both = await mkGuest('both', 'Bianca');
});

after(async () => {
  await db?.close();
});

// ── 1) The seed landed ─────────────────────────────────────────────────────

test('the four story challenges exist, are active, and are clip-answered', async () => {
  const r = await db.query<{
    slug: string; capture_kind: string; is_active: boolean; priority_rank: number | null; prompt: string;
  }>(
    `SELECT slug, capture_kind, is_active, priority_rank, prompt
       FROM public.papic_challenge_library
      WHERE slug = ANY($1) ORDER BY priority_rank`,
    [[...STORY_SLUGS]],
  );
  assert.equal(r.rows.length, 4, 'all four story challenges must be seeded');
  for (const row of r.rows) {
    assert.equal(row.is_active, true, `${row.slug} must ship active`);
    // 🔑 'clip' is the only kind that lets a guest SAY anything, and the clip
    // cap is 10s. If this ever becomes 'photo' the question is unanswerable.
    assert.equal(row.capture_kind, 'clip', `${row.slug} must be answered to camera`);
    assert.ok(row.prompt.includes('{who}'), `${row.slug} must carry the side token`);
    // The ten seconds must be stated in the prompt itself — the recorder stops
    // at 10s regardless, so a prompt that does not say so cuts the guest off
    // mid-sentence while telling them they succeeded.
    assert.match(row.prompt, /Ten seconds/, `${row.slug} must tell the guest the length`);
  }
});

// ⚠ SCOPED TO THE ORIGINAL FOUR (41–44), and the name says so. When the set
// expanded to 20 (2026-08-10) most of the new ones ship UNRANKED on purpose —
// they are reached by the couple's picker instead (see the last test). A test
// called "every story carries a rank" would now be asserting something false
// about the feature while passing, because its filter only ever saw four rows.
test('the four ALWAYS-ON stories each carry a guaranteed rank', async () => {
  const r = await db.query<{ slug: string; priority_rank: number | null }>(
    `SELECT slug, priority_rank FROM public.papic_challenge_library WHERE slug = ANY($1)`,
    [[...STORY_SLUGS]],
  );
  for (const row of r.rows) {
    assert.ok(
      row.priority_rank !== null && row.priority_rank >= 11 && row.priority_rank <= 20,
      `${row.slug} must hold a guaranteed board rank (11..20), got ${row.priority_rank}`,
    );
  }
  // Ranks are board POSITIONS. Two rows sharing one turns a guaranteed slot
  // into a coin flip, so the UNIQUE must have survived the range widening.
  // Number() because a bigint count arrives as a number from PGlite and as a
  // string from node-postgres — comparing against a hardcoded '0' passes on one
  // driver and fails on the other, which says nothing about the schema.
  const dup = await db.query<{ n: number | string }>(
    `SELECT count(*) AS n FROM (
       SELECT priority_rank FROM public.papic_challenge_library
        WHERE priority_rank IS NOT NULL GROUP BY priority_rank HAVING count(*) > 1) d`,
  );
  assert.equal(Number(dup.rows[0]!.n), 0, 'priority_rank must stay unique');
});

test('the widened CHECKs actually widened — and still refuse out-of-range', async () => {
  // If the DROP CONSTRAINT had named a constraint that does not exist it would
  // have been a silent no-op and the old 1..40 / 1..10 CHECKs would still be
  // rejecting these rows. Prove the new bounds by using them.
  await db.query(
    `INSERT INTO public.papic_challenge_library
       (library_id, slug, category, title, prompt, capture_kind, mission_type, priority_rank)
     VALUES (99, 'range-probe', 'stories', 'Probe', 'probe', 'photo', 'prompt', 20)`,
  );
  await assert.rejects(
    () =>
      db.query(
        `INSERT INTO public.papic_challenge_library
           (library_id, slug, category, title, prompt, capture_kind, mission_type)
         VALUES (100, 'range-probe-2', 'stories', 'Probe', 'probe', 'photo', 'prompt')`,
      ),
    'library_id 100 must still be refused — the range widened, it did not disappear',
  );
  await db.query(`DELETE FROM public.papic_challenge_library WHERE slug = 'range-probe'`);
});

// ── 2) The reader substitutes per guest ────────────────────────────────────

test('{who} becomes the bride, the groom, or the couple — per guest, same row', async () => {
  // ONE mission row, three guests. This is the whole point: the board is per
  // EVENT, so the substitution cannot be baked at materialization.
  const id = await mkMission('Share a story about the first time you met {who}. Ten seconds.');

  assert.equal(await promptFor(F.bride, id), 'Share a story about the first time you met the bride. Ten seconds.');
  assert.equal(await promptFor(F.groom, id), 'Share a story about the first time you met the groom. Ten seconds.');
  assert.equal(await promptFor(F.both, id), 'Share a story about the first time you met the couple. Ten seconds.');
});

test('no guest is ever shown the raw token', async () => {
  const id = await mkMission('A story about {who}, and what {who} said. Ten seconds.');
  for (const guest of [F.bride, F.groom, F.both]) {
    const shown = await promptFor(guest, id);
    assert.ok(!shown.includes('{who}'), `raw token leaked to a guest: ${shown}`);
  }
  // Every occurrence, not just the first.
  assert.equal(await promptFor(F.groom, id), 'A story about the groom, and what the groom said. Ten seconds.');
});

test('a prompt without the token is returned byte-identical', async () => {
  // All 40 shipped challenges and every couple/vendor free-text prompt take
  // this path. A regression here would rewrite copy nobody asked to change.
  const original = "Catch the newlyweds mid-kiss. Don't ask permission.";
  const id = await mkMission(original);
  for (const guest of [F.bride, F.groom, F.both]) {
    assert.equal(await promptFor(guest, id), original);
  }
});

test('the reader still fails CLOSED on a role-scoped mission', async () => {
  // The v3 guard is carried forward through this v5 rewrite. It is the one
  // thing in that function whose regression is a privacy leak rather than a
  // cosmetic bug, so it is asserted here rather than assumed.
  const r = await db.query<{ mission_id: string }>(
    `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active, target_role)
     VALUES ($1, 'roster', 'couple', 'A story about {who}. Ten seconds.', true, true, 'maid_of_honor')
     RETURNING mission_id`,
    [F.event],
  );
  const scoped = r.rows[0]!.mission_id;
  const seen = await db.query<{ mission_id: string }>(
    `SELECT mission_id FROM public.papic_guest_missions($1) WHERE mission_id = $2`,
    [F.bride, scoped],
  );
  assert.equal(seen.rows.length, 0, 'a role-scoped mission must not leak to an ordinary guest');
});

// ---------------------------------------------------------------------------
// The expanded set (45–60, owner 2026-08-10 "make more").
//
// 🔑 These assert against the REAL table, so an edit to a prompt's wording in a
// later migration is caught here even though the unit test holds literals.
// ---------------------------------------------------------------------------

const UNSAFE_STORY_ASKS = [
  /\bembarrass/i, /\bwildest\b/i, /\bsecret/i, /\bnever told\b/i, /\bworst\b/i,
  /\bregret/i, /\bex[- ]/i, /\bcheat/i, /\bdirt\b/i, /\bconfess/i,
];

test('the story set covers BOTH kinds — the one they know, and the two of them', async () => {
  const r = await db.query<{ category: string; n: number | string }>(
    `SELECT category, count(*) AS n FROM public.papic_challenge_library
      WHERE category IN ('stories','stories_couple') AND is_active GROUP BY category`,
  );
  const by = new Map(r.rows.map((x) => [x.category, Number(x.n)]));
  // "uplift the groom, bride" is delivered by the side token; "as a couple"
  // can ONLY come from the untokenised set. Neither may be empty.
  assert.ok((by.get('stories') ?? 0) >= 8, 'side-token stories present');
  assert.ok((by.get('stories_couple') ?? 0) >= 8, 'couple stories present');
});

test('every story is clip-answered, says ten seconds, and asks for nothing unsafe', async () => {
  const r = await db.query<{ slug: string; prompt: string; capture_kind: string }>(
    `SELECT slug, prompt, capture_kind FROM public.papic_challenge_library
      WHERE category IN ('stories','stories_couple')`,
  );
  assert.ok(r.rows.length >= 20, 'the full story set is seeded');
  for (const row of r.rows) {
    assert.equal(row.capture_kind, 'clip', `${row.slug} must be answered to camera`);
    assert.match(row.prompt, /[Tt]en seconds/, `${row.slug} must state the length`);
    for (const bad of UNSAFE_STORY_ASKS) {
      assert.ok(!bad.test(row.prompt), `${row.slug} invites an unsafe answer (${bad})`);
    }
  }
});

test('every story is addressed to somebody, and a couple story is NEVER one-sided', async () => {
  // ⚠ THIS ASSERTION'S PREMISE CHANGED ON 2026-08-21 AND IS NOT WEAKENED.
  //
  // It used to read "every `stories` row must carry {who}", which was exactly
  // right while the confession box existed only at weddings. The pool now runs
  // to 631 challenges across sixteen event types, and {who} resolves from
  // `guests.side` — bride · groom · both. At a birthday it falls through to "the
  // couple" and names two people who do not exist, so the universal half of the
  // confession box is addressed with {host} instead.
  //
  // 🔒 THE SAFETY PROPERTY IS UNTOUCHED, AND IT IS THE SECOND HALF: a
  // `stories_couple` question must NEVER carry a side token. That is the one
  // that silently turns "about the two of you" into a one-sided question, and
  // the couple picked those rows precisely to avoid it.
  //
  // 🔑 AND THE NEW FIRST HALF IS STRICTER THAN "carries {who}" WAS: a story with
  // NEITHER token is addressed to nobody — "Share a story. Ten seconds." — which
  // is the prompt that produces a shrug and a wasted shot from the pool.
  const r = await db.query<{ slug: string; category: string; prompt: string; event_types: string[] | null }>(
    `SELECT slug, category, prompt, event_types FROM public.papic_challenge_library
      WHERE category IN ('stories','stories_couple')`,
  );
  for (const row of r.rows) {
    const hasSide = row.prompt.includes('{who}');
    if (row.category === 'stories') {
      // {event} counts as an anchor: "why you would not have missed this
      // {event}" is about the day rather than a person, which is a real
      // confession-box question and still tells the guest what to talk about.
      // What this refuses is the promptless prompt — "Share a story. Ten
      // seconds." — which produces a shrug and a spent shot from the pool.
      const hasAnchor = /\{(hosts?|event)\}/.test(row.prompt);
      assert.ok(hasSide || hasAnchor, `${row.slug} is a story addressed to nobody`);
      // A side token outside a wedding is the bug this split exists to stop.
      if (hasSide) {
        assert.deepEqual(row.event_types, ['wedding'],
          `${row.slug} carries {who} and is not scoped to a wedding`);
      }
    } else {
      assert.ok(!hasSide, `${row.slug} is a COUPLE story and must not carry {who}`);
    }
  }
});

test('exactly six stories hold a guaranteed board slot — errands keep the rest', async () => {
  const r = await db.query<{ n: number | string }>(
    `SELECT count(*) AS n FROM public.papic_challenge_library
      WHERE category IN ('stories','stories_couple') AND priority_rank IS NOT NULL`,
  );
  // Ranking all of them would leave a 20-slot board with ZERO errands, and the
  // errands are what walk a guest to the paid line items. If this number grows,
  // that trade-off was made — make it on purpose.
  assert.equal(Number(r.rows[0]!.n), 6, 'six ranked stories: 10 heroes + 6 stories + 4 errands');
});

test('the default board still asks about the two of them, not only about one side', async () => {
  const r = await db.query<{ category: string }>(
    `SELECT category FROM public.papic_challenge_library
      WHERE category IN ('stories','stories_couple') AND priority_rank IS NOT NULL`,
  );
  assert.ok(
    r.rows.some((x) => x.category === 'stories_couple'),
    'at least one couple story must be on every board — 41-44 are all side-token',
  );
});

test('an unranked story is still REACHABLE — the couple picker can add it', async () => {
  // The whole reason 14 of these may ship unranked. If a library row is neither
  // ranked nor addable, it is a dead row, and this is the assertion that says
  // so out loud.
  const pick = await db.query<{ library_id: number; prompt: string; mission_type: string; capture_kind: string }>(
    `SELECT library_id, prompt, mission_type, capture_kind
       FROM public.papic_challenge_library
      WHERE category IN ('stories','stories_couple') AND priority_rank IS NULL AND is_active
      ORDER BY library_id LIMIT 1`,
  );
  assert.equal(pick.rows.length, 1, 'there is an unranked story to pick');
  const row = pick.rows[0]!;

  // Exactly what addLibraryChallengeAction writes.
  await db.query(
    `INSERT INTO public.papic_missions
       (event_id, mission_type, source, prompt, library_id, capture_kind, approved, is_active)
     VALUES ($1, $2, 'couple', $3, $4, $5, true, true)`,
    [F.event, row.mission_type, row.prompt, row.library_id, row.capture_kind],
  );

  // It reaches the guest, worded for their side, with no raw token.
  const seen = await db.query<{ prompt: string }>(
    `SELECT prompt FROM public.papic_guest_missions($1) WHERE library_id = $2`,
    [F.groom, row.library_id],
  );
  assert.equal(seen.rows.length, 1, 'a picked story must reach the guest board');
  assert.ok(!seen.rows[0]!.prompt.includes('{who}'), 'no raw token');

  // 🔑 AND IT CARRIES ITS library_id, which is what stops the Setnayan
  // auto-fill placing the very same question a second time.
  const dup = await db.query<{ n: number | string }>(
    `SELECT count(*) AS n FROM public.papic_missions
      WHERE event_id = $1 AND library_id = $2`,
    [F.event, row.library_id],
  );
  assert.equal(Number(dup.rows[0]!.n), 1, 'one row per library question per event');
});

// ---------------------------------------------------------------------------
// THE BOARD AS THE COUPLE'S SCREEN LISTS IT (2026-08-10).
//
// The couple's manager used to show ONE flat list in creation order. It now
// shows the guest's order and splits off what does not fit — so these assert
// that both halves of that split are real states of the data, not a story the
// UI tells. If "Not showing" can never happen, the section is noise; if it can
// happen and the old flat list existed, a couple was reading challenges that
// reached nobody.
// ---------------------------------------------------------------------------

test('a fresh board fills exactly 20 contiguous slots, in rank order', async () => {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Board Order Event', 'wedding', 'civil', 'banquet_hall') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;

  await db.query(`SELECT public.ensure_papic_board($1, false)`, [eventId]);

  const slots = await db.query<{ board_slot: number; priority_rank: number | null; library_id: number }>(
    `SELECT m.board_slot, l.priority_rank, m.library_id
       FROM public.papic_missions m
       JOIN public.papic_challenge_library l ON l.library_id = m.library_id
      WHERE m.event_id = $1 AND m.board_slot IS NOT NULL
      ORDER BY m.board_slot`,
    [eventId],
  );
  assert.equal(slots.rows.length, 20, 'a fresh board is exactly 20');
  // Contiguous 1..20 — a hole would show as a skipped number on the couple's list.
  assert.deepEqual(
    slots.rows.map((r) => r.board_slot),
    Array.from({ length: 20 }, (_, i) => i + 1),
  );
  // The screen says "In this order, on their phone." That is only true if the
  // slot order really is the rank order.
  const ranked = slots.rows.filter((r) => r.priority_rank !== null);
  assert.deepEqual(
    ranked.map((r) => r.priority_rank),
    [...ranked.map((r) => r.priority_rank)].sort((a, b) => (a ?? 0) - (b ?? 0)),
    'ranked challenges appear in rank order',
  );
  // And the six ranked stories are among them, in their ranks.
  assert.equal(ranked.length, 20 - slots.rows.filter((r) => r.priority_rank === null).length);
});

test('past 20, the overflow really does sit off-board — the "Not showing" group is real', async () => {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Overflow Event', 'wedding', 'civil', 'banquet_hall') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(`SELECT public.ensure_papic_board($1, false)`, [eventId]);

  // The couple adds five of their own on top of a full board.
  for (let i = 1; i <= 5; i++) {
    await db.query(
      `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
       VALUES ($1, 'prompt', 'couple', $2, true, true)`,
      [eventId, `Our own challenge number ${i}. Ten seconds.`],
    );
  }
  await db.query(`SELECT public.ensure_papic_board($1, false)`, [eventId]);

  const counts = await db.query<{ on_board: number | string; off_board: number | string }>(
    `SELECT count(*) FILTER (WHERE board_slot IS NOT NULL) AS on_board,
            count(*) FILTER (WHERE board_slot IS NULL)     AS off_board
       FROM public.papic_missions WHERE event_id = $1 AND approved AND is_active`,
    [eventId],
  );
  const onBoard = Number(counts.rows[0]!.on_board);
  const offBoard = Number(counts.rows[0]!.off_board);
  assert.equal(onBoard, 20, 'the board stays capped at 20');
  assert.ok(
    offBoard > 0,
    'active, approved challenges CAN sit off-board — which is exactly what the old flat list hid',
  );

  // The couple's own picks win their lane, so their five are all on the board
  // and Setnayan's are the ones that yield. Worth asserting: if it were the
  // other way round, "hide one above to make room" would be useless advice.
  const ownOff = await db.query<{ n: number | string }>(
    `SELECT count(*) AS n FROM public.papic_missions
      WHERE event_id = $1 AND source = 'couple' AND is_active AND board_slot IS NULL`,
    [eventId],
  );
  assert.equal(Number(ownOff.rows[0]!.n), 0, "the couple's own picks are never the ones pushed off");
});

test('hiding a challenge frees its slot for the one that was waiting', async () => {
  // The advice the screen gives — "hide one above to make room" — has to work.
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Make Room Event', 'wedding', 'civil', 'banquet_hall') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;
  await db.query(`SELECT public.ensure_papic_board($1, false)`, [eventId]);

  const waitingBefore = await db.query<{ mission_id: string }>(
    `SELECT mission_id FROM public.papic_missions
      WHERE event_id = $1 AND is_active AND board_slot IS NULL LIMIT 1`,
    [eventId],
  );
  // A fresh board has no overflow, so make some: add one couple pick.
  if (waitingBefore.rows.length === 0) {
    await db.query(
      `INSERT INTO public.papic_missions (event_id, mission_type, source, prompt, approved, is_active)
       VALUES ($1, 'prompt', 'couple', 'One more. Ten seconds.', true, true)`,
      [eventId],
    );
    await db.query(`SELECT public.ensure_papic_board($1, false)`, [eventId]);
  }

  const before = await db.query<{ n: number | string }>(
    `SELECT count(*) AS n FROM public.papic_missions
      WHERE event_id = $1 AND is_active AND board_slot IS NULL`,
    [eventId],
  );
  assert.ok(Number(before.rows[0]!.n) > 0, 'something is waiting');

  // Hide one that IS on the board, then rebuild.
  await db.query(
    `UPDATE public.papic_missions SET is_active = false
      WHERE mission_id = (SELECT mission_id FROM public.papic_missions
                           WHERE event_id = $1 AND board_slot IS NOT NULL
                             AND source = 'setnayan' LIMIT 1)`,
    [eventId],
  );
  await db.query(`SELECT public.ensure_papic_board($1, false)`, [eventId]);

  const after = await db.query<{ n: number | string }>(
    `SELECT count(*) AS n FROM public.papic_missions
      WHERE event_id = $1 AND is_active AND board_slot IS NOT NULL`,
    [eventId],
  );
  assert.equal(Number(after.rows[0]!.n), 20, 'the freed slot is taken by the one that was waiting');
});

// ---------------------------------------------------------------------------
// 🚨 THE GUEST-PATH BOARD BUILD (fixed 2026-08-10).
//
// The guest route calls ensure_papic_board through the SERVICE-ROLE client,
// because a Papic guest is zero-account — there is no auth.uid() to present.
// ensure_papic_board's first act used to be `PERFORM ensure_papic_auto_missions`,
// and on 2026-08-01 that function was hardened so a NULL session is a REFUSAL.
// So the nested call raised, the board transaction aborted, the route's
// `.catch(() => 0)` swallowed it, and the reader FAIL-SOFTED to "show every
// mission by created_at" — a plausible-looking list. Result: no library
// challenge and no booth mission ever reached a guest, and nothing looked wrong.
//
// These four assert the fix AND that it did not reopen the door the 2026-08-01
// hardening closed. The first one is the regression guard: revert the migration
// and it goes red immediately.
// ---------------------------------------------------------------------------

test('the SERVER can build a board with no session — the guest path', async () => {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Server Path Event', 'wedding', 'civil', 'banquet_hall') RETURNING event_id`,
  );
  const eventId = ev.rows[0]!.event_id;

  // auth.uid() is NULL here — exactly what the service-role admin client presents.
  const built = await db.query<{ n: number }>(
    `SELECT public.ensure_papic_board($1, false) AS n`,
    [eventId],
  );
  assert.equal(built.rows[0]!.n, 20, 'the server must be able to build the board');

  const rows = await db.query<{ n: number | string }>(
    `SELECT count(*) AS n FROM public.papic_missions
      WHERE event_id = $1 AND source = 'setnayan' AND board_slot IS NOT NULL`,
    [eventId],
  );
  assert.equal(Number(rows.rows[0]!.n), 20, "Setnayan's challenges must reach the board");
});

test('the PUBLIC auto-missions RPC still refuses a sessionless caller (2026-08-01 stands)', async () => {
  const ev = await db.query<{ event_id: string }>(
    `INSERT INTO public.events (display_name, event_type, ceremony_type, venue_setting)
     VALUES ('Public Door Event', 'wedding', 'civil', 'banquet_hall') RETURNING event_id`,
  );
  await assert.rejects(
    () => db.query(`SELECT public.ensure_papic_auto_missions($1)`, [ev.rows[0]!.event_id]),
    /not authorized/,
    'the public door must stay shut to a missing session — the fix moved the CALL, not the guard',
  );
});

test('the internal step is not reachable by anon or authenticated', async () => {
  // It carries no authorization of its own, so its only protection is the
  // revoke. If a grant ever reappears, a logged-in stranger could generate
  // booth missions on any event.
  const g = await db.query<{ grantee: string }>(
    `SELECT grantee FROM information_schema.role_routine_grants
      WHERE routine_schema = 'public'
        AND routine_name = 'papic_generate_booth_missions_unchecked'
        AND grantee IN ('anon','authenticated','PUBLIC')`,
  );
  assert.equal(g.rows.length, 0, `internal step is granted to: ${g.rows.map((r) => r.grantee).join(', ')}`);
});

test('the board builder is not reachable by anon', async () => {
  // "NULL uid means the trusted server" is only safe while anon cannot call it.
  const g = await db.query<{ grantee: string }>(
    `SELECT grantee FROM information_schema.role_routine_grants
      WHERE routine_schema = 'public' AND routine_name = 'ensure_papic_board'
        AND grantee IN ('anon','PUBLIC')`,
  );
  assert.equal(g.rows.length, 0, `ensure_papic_board is granted to: ${g.rows.map((r) => r.grantee).join(', ')}`);
});
