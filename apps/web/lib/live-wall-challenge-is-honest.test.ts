/**
 * live-wall-challenge-is-honest.test.ts — Papic Build Order §4 (2026-08-31
 * re-measure): "the wall renders no challenge" + "a live count of who has
 * answered". Two halves, both load-bearing:
 *
 *   1. `fetchWallArmedChallenge` (lib/live-wall.ts) must be able to tell a
 *      REFUSED read (`measured: false`) apart from a genuinely un-armed wall
 *      (`measured: true, challenge: null`) — the same rule
 *      `guests-read-is-honest.test.ts` and `vendor-sponsored-shots-are-
 *      scoped.test.ts` already pin for the couple's and the vendor's reads.
 *      A LOG LINE NEVER CHANGED A PIXEL: the flag has to reach the render, so
 *      this file's second half checks the source of `live-wall-block.tsx`
 *      rather than trusting that a correct reader implies a correct screen.
 *   2. The answered-COUNT must actually reach the DOM, gated on that same
 *      flag — a count nobody can see is the exact disease this build exists
 *      to kill.
 *
 * ⚠ A SOURCE GUARD FOR PART 1, DELIBERATELY — mirroring
 * `vendor-sponsored-shots-are-scoped.test.ts`. `live-wall.ts` pulls in
 * `server-only` transitively (via `lib/uploads.ts`), which isn't installed
 * outside the Next build, so importing and EXECUTING the reader here would
 * crash every run rather than test anything. The same repo already made this
 * call once: `lib/guests.ts` has no `server-only` import and is executed with
 * a stub client; `lib/vendor-sponsored-shots.ts` does, and its guard reads
 * the query source instead. This file follows the second precedent.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

const LIVE_WALL = join(HERE, 'live-wall.ts');
const liveWallSrc = () => stripComments(readFileSync(LIVE_WALL, 'utf8'));

/** The `fetchWallArmedChallenge` function body only. */
function challengeReaderFn(): string {
  const src = liveWallSrc();
  const start = src.indexOf('export async function fetchWallArmedChallenge');
  assert.notEqual(start, -1, 'fetchWallArmedChallenge must exist in lib/live-wall.ts');
  const end = src.indexOf('\nexport interface WallSnapshot', start);
  assert.ok(end > start, 'could not isolate the function body');
  return src.slice(start, end);
}

test('the flag gate is checked before any query, and is itself a measured fact', () => {
  const fn = challengeReaderFn();
  const flagAt = fn.indexOf('if (!papicGamesEnabled())');
  const firstQueryAt = fn.indexOf(".from('papic_missions')");
  assert.notEqual(flagAt, -1, 'must gate on papicGamesEnabled, like every other papic-games.ts wrapper');
  assert.ok(flagAt < firstQueryAt, 'the flag must short-circuit before the DB is ever asked');
  const gateLine = fn.slice(flagAt, fn.indexOf('\n', flagAt));
  assert.match(gateLine, /measured:\s*true,\s*challenge:\s*null/, 'off is a KNOWN fact, not a refusal');
});

test('the missions query is scoped to this event\'s LIVE board top', () => {
  const fn = challengeReaderFn();
  const q = fn.slice(fn.indexOf("from('papic_missions')"), fn.indexOf('.limit(1)') + 10);
  assert.match(q, /\.eq\('event_id', eventId\)/, 'must not leak another event\'s challenges');
  assert.match(q, /\.eq\('approved', true\)/, 'a pending vendor challenge must never reach the wall');
  assert.match(q, /\.eq\('is_active', true\)/, 'a retired challenge must never reach the wall');
  assert.match(q, /board_slot.*ascending:\s*true,\s*nullsFirst:\s*false/, 'lowest slot first, unslotted last');
  assert.match(q, /created_at.*ascending:\s*true/, 'tie-break by oldest, mirroring the v4 board reader');
  assert.match(q, /\.limit\(1\)/, 'exactly one — "the" currently-armed challenge, not a list');
});

test('a refused MISSIONS read returns measured:false, never an empty-looking challenge', () => {
  const fn = challengeReaderFn();
  const missionsBlock = fn.slice(fn.indexOf("from('papic_missions')"), fn.indexOf('const mission ='));
  assert.match(missionsBlock, /if \(mErr\) return \{ measured: false, challenge: null \};/);
  // The genuinely-empty branch must be a SEPARATE, later check — not folded
  // into the same condition as the error, or a refusal and an empty board
  // become indistinguishable again.
  const emptyAt = fn.indexOf('missions.length === 0');
  const errAt = fn.indexOf('if (mErr)');
  assert.ok(errAt !== -1 && emptyAt !== -1 && errAt < emptyAt, 'error must be checked before "genuinely empty"');
  assert.match(fn.slice(emptyAt, emptyAt + 120), /measured: true, challenge: null/);
});

test('the completion COUNT is scoped to THIS mission, and a refusal is not zero', () => {
  const fn = challengeReaderFn();
  const countStart = fn.indexOf("from('papic_mission_completions')");
  const countBlock = fn.slice(countStart, fn.lastIndexOf('return {'));
  assert.match(countBlock, /\.eq\('event_id', eventId\)/);
  assert.match(countBlock, /\.eq\('mission_id', mission\.mission_id\)/, 'must count answers to THIS challenge only, never every completion on the event');
  assert.match(countBlock, /\.not\('capture_id', 'is', null\)/, 'mirrors the editorial reader — a phantom row without a capture is not an answer');
  assert.match(countBlock, /if \(cErr\) return \{ measured: false, challenge: null \};/, 'a refused count must not silently become 0');
});

test('a missing count resolves to 0, never null or undefined, on the happy path', () => {
  const fn = challengeReaderFn();
  assert.match(fn, /answeredCount:\s*count \?\? 0/, 'the render cannot print a null count');
});

// ── the render layer — precedent rule 2: the flag must reach the screen ────

const BLOCK = join(HERE, '..', 'app/[slug]/_components/live-wall-block.tsx');
const block = () => stripComments(readFileSync(BLOCK, 'utf8'));

test('the live wall block accepts the challenge + its measured flag as props', () => {
  const src = block();
  assert.match(src, /initialChallenge/, 'must accept the initial challenge');
  assert.match(src, /initialChallengeMeasured/, 'must accept whether it was measured');
  assert.match(src, /challengeMeasured\?:\s*boolean/, 'the measured flag must be typed as a boolean prop');
});

test('the poll loop only overwrites the challenge when THIS response measured it', () => {
  const src = block();
  const pollAt = src.indexOf('const poll = async');
  assert.notEqual(pollAt, -1);
  const poll = src.slice(pollAt, src.indexOf('const start = ()', pollAt));
  assert.match(
    poll,
    /data\.challenge !== undefined/,
    'a route that omits the field must not be read as "challenge cleared"',
  );
  assert.match(
    poll,
    /typeof data\.challengeMeasured === 'boolean'/,
    'the measured flag must come from the SAME response, not be inferred',
  );
});

test('the render is gated on measured — a refusal never reads as "no challenge"', () => {
  const src = block();
  const bannerAt = src.indexOf('function ChallengeBanner');
  assert.notEqual(bannerAt, -1, 'the banner component must exist');
  const banner = src.slice(bannerAt);
  // The two branches are checked in the order that matters: unmeasured is
  // handled BEFORE the null-challenge check collapses it to nothing.
  const unmeasuredAt = banner.indexOf('if (!measured)');
  const nullChallengeAt = banner.indexOf('if (!challenge)');
  assert.notEqual(unmeasuredAt, -1, 'must branch on the measured flag');
  assert.notEqual(nullChallengeAt, -1, 'must branch on an absent challenge');
  assert.ok(
    unmeasuredAt < nullChallengeAt,
    'unmeasured must be checked BEFORE null-challenge, or a refusal falls through to "nothing armed"',
  );
  assert.match(
    banner.slice(unmeasuredAt, nullChallengeAt),
    /Challenge status unavailable/,
    'a refused read must say something distinguishable from silence',
  );
});

test('the answered count reaches the render, not just the query', () => {
  const src = block();
  const bannerAt = src.indexOf('function ChallengeBanner');
  const banner = src.slice(bannerAt);
  assert.match(
    banner,
    /challenge\.answeredCount\.toLocaleString\(\)/,
    'the count must actually be printed in the banner JSX',
  );
  assert.match(banner, /challenge\.prompt/, 'the prompt itself must render too');
});

test('the banner is mounted in BOTH render branches — empty-tiles and populated', () => {
  const src = block();
  const mounts = src.match(/<ChallengeBanner\s/g) ?? [];
  assert.equal(
    mounts.length,
    2,
    'one mount for the "no tiles yet" empty state, one for the populated wall — a challenge can be armed before the first photo lands',
  );
});

test('a CLOSED wall (couple turned off the phone mirror) never shows a stale challenge', () => {
  const src = block();
  const closedAt = src.indexOf('if (res.status === 404)');
  assert.notEqual(closedAt, -1);
  const closedBlock = src.slice(closedAt, src.indexOf('return;', closedAt));
  assert.match(closedBlock, /setChallenge\(null\)/, 'closing the mirror must clear the old challenge');
  assert.match(closedBlock, /setChallengeMeasured\(true\)/, 'closed is a KNOWN state, not an unmeasured one');
});
