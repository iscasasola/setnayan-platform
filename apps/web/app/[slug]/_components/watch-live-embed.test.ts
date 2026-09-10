/**
 * Structural guard for the W1 guest-watch poll (watch-live-embed.tsx).
 *
 * The STATE MACHINE itself (which combination of link + broadcast-row status
 * produces which GuestWatchState) is proven exhaustively on the pure decider —
 * lib/live-watch-state.test.ts. What that file cannot prove is that the
 * CLIENT actually polls, actually swaps the link/embed in place, and — the
 * GUARD the W1 prompt calls out by name — never shows the "reconnecting"
 * sentence for any state other than 'reconnecting'. A component that instead
 * gated the sentence on e.g. `state !== 'live'` would pass every decider test
 * (the decider is unchanged) while showing "reconnecting" for 'ended' too.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const EMBED = readFileSync(join(HERE, 'watch-live-embed.tsx'), 'utf8');

test('it is a client component (the poll needs hooks + browser fetch)', () => {
  assert.match(EMBED, /^'use client';/m, "missing 'use client' — this cannot hold poll state");
});

test('it polls every 30 seconds via setInterval', () => {
  assert.match(EMBED, /WATCH_POLL_INTERVAL_MS\s*=\s*30_000/, 'poll interval is not 30s');
  assert.match(EMBED, /setInterval\([\s\S]*?WATCH_POLL_INTERVAL_MS\)/, 'no setInterval wired to the 30s constant');
  assert.match(EMBED, /clearInterval\(id\)/, 'the interval is never cleared — it would outlive the component');
});

test('it polls the W1 guest-watch endpoint for THIS event, not a hardcoded one', () => {
  assert.match(
    EMBED,
    /fetch\(`\/api\/live\/\$\{encodeURIComponent\(slug\)\}\/watch`/,
    'not calling GET /api/live/[slug]/watch with the event slug',
  );
});

// ⭐ THE GUARD. Mutation-tested: widening this condition (e.g. to
// `state !== 'live'`, which is also true for 'ended') makes this test fail
// while lib/live-watch-state.test.ts stays green — proving the decider alone
// cannot catch this class of bug.
test("GUARD: the reconnecting sentence is gated on state === 'reconnecting' alone", () => {
  const sentenceAt = EMBED.indexOf('The stream is reconnecting');
  assert.ok(sentenceAt >= 0, 'the reconnecting sentence was removed');

  // The nearest ternary test before the sentence must be an EQUALITY check
  // against the literal 'reconnecting' — not an inequality against 'live' or
  // 'ended', either of which would also admit other states.
  const before = EMBED.slice(0, sentenceAt);
  const guardAt = before.lastIndexOf("state === 'reconnecting'");
  assert.ok(
    guardAt >= 0,
    "no `state === 'reconnecting'` immediately gating the sentence — found a different condition",
  );
  // And that gate must be the closest one before the sentence — no other
  // condition (e.g. a broader `state !== 'live'`) sits between them.
  const betweenGuardAndSentence = EMBED.slice(guardAt, sentenceAt);
  assert.doesNotMatch(
    betweenGuardAndSentence,
    /state\s*(!==|===)\s*'(live|ended|not_yet)'/,
    'a second, broader state condition sits between the guard and the sentence',
  );
});

test('polling stops once nothing is left to reconnect to', () => {
  // Tolerates extra guards/parens around the core condition (e.g. `!slug ||`)
  // as long as the stop-condition itself — state is neither 'live' nor
  // 'reconnecting' — still gates the effect's early return.
  assert.match(
    EMBED,
    /if \([\s\S]{0,40}state !== 'live' && state !== 'reconnecting'[\s\S]{0,10}\) return;/,
    "the effect no longer stops polling on 'ended'/'not_yet' — this could poll a finished event forever",
  );
});

test('a fresh link is re-validated client-side, never trusted as-is', () => {
  assert.match(EMBED, /parseYouTubeVideoId\(data\.watchUrl\)/, 'the fetched watchUrl is not re-parsed');
  assert.match(
    EMBED,
    /youTubeEmbedUrl\(videoId\)/,
    'the embed src is not rebuilt from the validated video id',
  );
});
