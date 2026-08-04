/**
 * `events.our_photos` must never persist an unscreened image.
 *
 * ── WHY THIS IS A SOURCE-SCAN AND NOT A UNIT TEST ────────────────────────────
 * The rule lives in a server action that ends in `redirect()` and pulls nsfwjs +
 * sharp + R2 through dynamic imports. There is no seam to unit-test without
 * mocking four modules and Next's redirect, and the thing worth protecting is the
 * ORDER OF OPERATIONS, which reads clearly from the source. Same idiom as
 * `papic-copy-guardrails` / `panood-retirement` / `papic-face-mode-gate`.
 *
 * ── WHAT WAS WRONG BEFORE (closed 2026-07-30) ────────────────────────────────
 * `events.our_photos` is host-writable and renders on the PUBLIC guest page, and
 * nothing screened it — a named-deliberate exception in
 * `lib/security/events-column-privileges.ts` and the oldest open item on the
 * security register. Arbitrary unscreened images, one host upload from the public
 * internet.
 *
 * The three properties below are the fix, and each is load-bearing:
 *   1. the screen runs BEFORE the write — this surface has no `moderation_state`
 *      to hide an unscreened row behind, so a deferred verdict (the pattern Papic
 *      captures correctly use via `after()`) would have nothing to hold back;
 *   2. it fails CLOSED — fail-open here means publishing an unclassified image;
 *   3. only NEW refs are screened — otherwise re-ordering a gallery re-screens it.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SRC = readFileSync(
  join(
    dirname(fileURLToPath(import.meta.url)),
    '..',
    'app',
    'dashboard',
    '[eventId]',
    'website',
    'our-photos',
    'actions.ts',
  ),
  'utf8',
);

test('our_photos is screened at all', () => {
  assert.match(SRC, /classifyImageBytes/, 'the action must classify image bytes');
  assert.match(SRC, /decideNsfw\(/, 'the action must apply the shared NSFW decision');
});

test('the screen runs BEFORE the write, and the write persists the CLEARED set', () => {
  const decideAt = SRC.indexOf('decideNsfw(');
  const updateAt = SRC.indexOf('.update({ our_photos:');
  assert.ok(decideAt > -1 && updateAt > -1, 'expected both the screen and the write');
  assert.ok(
    decideAt < updateAt,
    'the NSFW verdict must precede the UPDATE. This surface has no moderation_state, '
      + 'so a deferred screen (the after() pattern Papic captures use) cannot hold '
      + 'anything back — the array IS the publish.',
  );
  assert.match(
    SRC,
    /\.update\(\{ our_photos: cleared \}\)/,
    'the write must persist the screened set, never the raw submitted refs',
  );
});

test('the screen fails CLOSED — a throw rejects the photo', () => {
  // classifyImageBytes documents "caller fail-opens", which is correct for captures
  // (a failure leaves the row unscreened and therefore hidden). Here it is inverted
  // on purpose, and this pins the inversion.
  assert.match(
    SRC,
    /catch \{[\s\S]{0,400}?blocked\.push\(ref\)/,
    'an undecodable file / unreachable object / model failure must REJECT, not pass',
  );
});

test('only NEW refs are screened', () => {
  assert.match(
    SRC,
    /const newRefs = deduped\.filter\(\(ref\) => !currentRefs\.includes\(ref\)\)/,
    're-ordering or removing within an existing gallery must not re-screen it',
  );
});

test('a rejection is reported to the host, not silent', () => {
  // A photo that vanishes without explanation reads as a bug, and the host is the
  // only one who can pick a different image.
  assert.match(SRC, /blocked\.length > 0/, 'the action must branch on rejections');
  assert.match(SRC, /didn&rsquo;t pass|didn't pass/, 'and must say so in the redirect');
});
