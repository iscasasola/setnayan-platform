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

test('every story carries a rank — an unranked one could never reach a guest', async () => {
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
