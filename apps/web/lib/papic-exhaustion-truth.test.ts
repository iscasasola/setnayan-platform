/**
 * THE CAMERA SAYS WHAT IS TRUE — executable guard for the refusal copy.
 *
 * Two properties, and neither can be got from reading the file:
 *   1. NO SURFACE MAY PROMISE A REFILL. Nothing in the schema refills a seat
 *      (measured 2026-09-16 — see the module docblock), so any sentence that
 *      says otherwise is false by construction.
 *   2. THE TWO CAUSES MUST STAY DISTINGUISHABLE. Collapsing them to one
 *      sentence is the cheapest edit a future session would make, and it swaps
 *      a bigger lie for a smaller one rather than fixing anything.
 *
 * It also pins the SOURCE of `app/api/upload/route.ts`: that file is
 * `server-only`, so a test cannot import it, and the false sentence lived there.
 * Comments are stripped first — this file's own prose quotes the dead sentence,
 * and so does the route's, so a raw-source match would report the defect as
 * still present forever.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  PAPIC_POOL_NOT_BINDING,
  arrivalTally,
  exhaustionCauseFromOwnCamera,
  exhaustionDetail,
  exhaustionHeadline,
  resolveExhaustionCause,
} from './papic-exhaustion-truth';
// 🔑 THE SHARED, STRING-AWARE STRIPPER — never a two-replace regex. `/*` inside
// a string (accept="image/*") opens a comment that runs to the next real close
// marker and blanks every line between, so a guard asserts against a blank and
// passes. lib/strip-comments.ts is a small lexer for exactly that reason.
import { stripComments } from './strip-comments';

/** Strip block + line comments so prose that QUOTES a banned string can't pass
 *  or fail a check about the code. */
const ROUTE = join(process.cwd(), 'app', 'api', 'upload', 'route.ts');
// 📷 ONE CAMERA (owner 2026-11-22): a seat shoots on the guest camera in seat mode — that is the seat's screen now.
const SEAT = join(process.cwd(), 'app', 'papic', 'guest', '_components', 'papic-guest-capture.tsx');
const CHIP = join(process.cwd(), 'app', 'papic', '_components', 'upload-chip.tsx');

// ── 1 · the discriminator ──────────────────────────────────────────────────

test('the pool sentinel means this camera has a balance of its own', () => {
  assert.equal(resolveExhaustionCause(PAPIC_POOL_NOT_BINDING), 'own_camera');
});

test('any bounded pool reading is the shared pot, not her own credits', () => {
  for (const v of [0, 1, 49, 30_000, PAPIC_POOL_NOT_BINDING - 1]) {
    assert.equal(
      resolveExhaustionCause(v),
      'event_pool',
      `${v} is a real pool balance — it must never be read as a camera of her own`,
    );
  }
});

test('an unreadable probe falls to the pot, never to "you can buy more"', () => {
  // Telling a guest she has a camera to top up when she may not is the error
  // with a cost; the other direction just sends her to the host.
  assert.equal(resolveExhaustionCause(null), 'event_pool');
  assert.equal(resolveExhaustionCause(undefined), 'event_pool');
});

test('the record seam answers from the latched camera, not from a default', () => {
  // A long clip passes the presign (gated at the cheapest band) and is refused
  // at the record — so this path is ordinary, not a race, and defaulting a
  // guest with her own camera to "the celebration ran out" would be wrong on a
  // routine capture.
  assert.equal(exhaustionCauseFromOwnCamera(true), 'own_camera');
  assert.equal(exhaustionCauseFromOwnCamera(false), 'event_pool');
  assert.equal(exhaustionCauseFromOwnCamera(null), 'event_pool');
  assert.equal(exhaustionCauseFromOwnCamera(undefined), 'event_pool');
});

// ── 2 · no surface may promise a refill ────────────────────────────────────

/** Every sentence this module can produce, across every input. */
function everySentence(): string[] {
  const out: string[] = [];
  for (const cause of ['own_camera', 'event_pool'] as const) {
    out.push(exhaustionHeadline(cause));
    for (const buyOffered of [true, false]) {
      out.push(exhaustionDetail(cause, { buyOffered }));
    }
  }
  for (const [landed, refused] of [
    [0, 1],
    [3, 5],
    [7, 1],
    [1, 1],
  ] as const) {
    const t = arrivalTally(landed, refused);
    assert.ok(t, 'a refused shot must always produce a tally');
    out.push(t.headline, t.detail);
  }
  return out;
}

test('nothing this module can say claims the exhausted budget comes back', () => {
  const banned =
    /refills?\s+tomorrow|today['’]s shots|come back tomorrow|try again tomorrow|daily (limit|allowance) (resets|refills) (so|and) you/i;
  for (const s of everySentence()) {
    assert.doesNotMatch(s, banned, `this sentence promises the refused budget back: ${s}`);
  }
});

test('and every one of them says, positively, what does NOT come back', () => {
  // A sentence can avoid the banned words and still leave the guest waiting.
  for (const cause of ['own_camera', 'event_pool'] as const) {
    for (const buyOffered of [true, false]) {
      assert.match(
        exhaustionDetail(cause, { buyOffered }),
        /don['’]t come back|doesn['’]t refill/i,
        `${cause}/${buyOffered}: silence about the refill is what made her wait`,
      );
    }
  }
});

// ── 2b · THERE IS NO DAILY ALLOWANCE (retired, owner 5 Nov 2026) ──────────
//
// This section used to require that a seat WITH a per-day budget be told "your
// daily allowance resets tomorrow", derived from `papic_tier_config.points_per_
// day`. The owner retired the per-seat daily budget — "retire. we do not have
// papic seat anymore" — so no sentence may mention a day at all, and the route
// may not look one up. lib/papic-no-daily-budget.test.ts guards the rest.

test('no sentence mentions a daily allowance or tomorrow', () => {
  for (const s of everySentence()) {
    assert.doesNotMatch(s, /tomorrow|daily|per day|a day\b|today/i, `a retired per-day budget leaked into: ${s}`);
  }
});

test('the route no longer reads a per-day budget for its copy', () => {
  const src = stripComments(readFileSync(ROUTE, 'utf8'));
  assert.doesNotMatch(src, /points_per_day/, 'app/api/upload/route.ts still reads the retired per-day budget');
  assert.doesNotMatch(src, /dailyBudget/, 'app/api/upload/route.ts still sends a dailyBudget field');
});

test('the shipped route no longer carries the false sentence', () => {
  const src = stripComments(readFileSync(ROUTE, 'utf8'));
  assert.doesNotMatch(
    src,
    /refills?\s+tomorrow/i,
    'app/api/upload/route.ts still tells a guest her camera refills tomorrow',
  );
  assert.doesNotMatch(src, /today['’]s shots/i);
});

// ── 3 · the two causes must stay distinguishable ───────────────────────────

test('the two causes never produce the same sentence', () => {
  assert.notEqual(exhaustionHeadline('own_camera'), exhaustionHeadline('event_pool'));
  for (const buyOffered of [true, false]) {
    assert.notEqual(
      exhaustionDetail('own_camera', { buyOffered }),
      exhaustionDetail('event_pool', { buyOffered }),
      'a guest who can add her own shots and a guest who can only ask the host ' +
        'were handed the same next step',
    );
  }
});

test('only the pot names the couple as the only person who can act', () => {
  assert.match(exhaustionDetail('event_pool', { buyOffered: false }), /only the couple/i);
  assert.doesNotMatch(exhaustionDetail('own_camera', { buyOffered: false }), /only the couple/i);
});

test('a remedy is named only when it is actually on the screen', () => {
  // `buyOffered` is the same boolean that mounts the panel; promising "add more
  // shots below" with nothing below it is a dead control.
  assert.match(exhaustionDetail('own_camera', { buyOffered: true }), /below/i);
  assert.doesNotMatch(exhaustionDetail('own_camera', { buyOffered: false }), /below/i);
  assert.match(exhaustionDetail('event_pool', { buyOffered: true }), /below/i);
  assert.doesNotMatch(exhaustionDetail('event_pool', { buyOffered: false }), /below/i);
});

test('the route sends the cause, not just the code', () => {
  const src = stripComments(readFileSync(ROUTE, 'utf8'));
  assert.match(
    src,
    /resolveExhaustionCause/,
    'the route must derive the cause from the pool probe it already makes',
  );
  assert.match(
    src,
    /code:\s*'camera_points_exhausted'/,
    'the terminal code must survive — the client treats it as a hard cap',
  );
  assert.match(src, /status:\s*409/, 'the 409 must survive');
  assert.match(
    src,
    /reason:/,
    'a sentence the client cannot read is a measurement that never reaches the render',
  );
});

// ── 4 · PAP-13 · the arrival tells her, per photo ──────────────────────────

test('nothing refused → no tally, and the celebratory copy stands', () => {
  assert.equal(arrivalTally(8, 0), null);
  assert.equal(arrivalTally(0, 0), null);
});

test('3 of 8 landed is said as 3 of 8, in the guest’s own numbers', () => {
  const t = arrivalTally(3, 5);
  assert.ok(t);
  assert.match(t.headline, /3 of your 8 shots landed/);
  assert.match(t.detail, /The other 5 weren’t saved/);
  assert.match(t.detail, /the credits ran out/); // the unit is "credits" (owner 2026-10-13)
});

test('one refused shot is not reported in the plural', () => {
  const t = arrivalTally(7, 1);
  assert.ok(t);
  assert.match(t.headline, /7 of your 8 shots landed/);
  assert.match(t.detail, /The other 1 wasn’t saved/);
});

test('the tally counts the session, not the trimmed roll', () => {
  // ROLL_MAX trims what is on screen; a sentence saying "of these N" would
  // misreport a long night. Nothing in the copy may point at the visible strip.
  const t = arrivalTally(40, 12);
  assert.ok(t);
  assert.match(t.headline, /40 of your 52 shots/);
  assert.doesNotMatch(`${t.headline} ${t.detail}`, /of these/i);
});

test('no sentence implies a guest has credits held back for her', () => {
  /*
    A guest's `papic_guest_spend_ceilings.ceiling_points` is a LIMIT, not a
    reservation. Measured in production: not one of `papic_event_pool_status`,
    `papic_capture_points_available` or `papic_camera_points_remaining` reads
    that table; the pool subtracts `papic_seat_allocations` and nothing else.
    Every credit comes out of one shared pot, first come first served, and a
    named guest can arrive to find it empty and her number worth nothing.

    ⚠ Second person plus a possessive is exactly how a limit reads as a
    reservation, and a console-side sweep cannot see it — this copy shares no
    vocabulary with the couple's screens. So the sweep is written in HER words.

    The one true possessive is a camera's DEDICATED balance: `papic_seat_
    allocations` IS deducted from the pot, so those really are set aside. The
    own_camera branch may say so; nothing else may.
  */
  const held =
    /set aside|stays? (theirs|hers)|held (for|back) (for )?you|saved for you|reserved|guaranteed|promised|your own number/i;
  for (const s of everySentence()) {
    assert.doesNotMatch(s, held, `this sentence implies a reservation that does not exist: ${s}`);
  }
  // And the shared-pot branch may not make the shots hers by any wording.
  for (const buyOffered of [true, false]) {
    assert.doesNotMatch(
      exhaustionDetail('event_pool', { buyOffered }),
      /your credits|your shots (are|were) /i,
      'the shared pot is nobody’s in particular — first come, first served',
    );
  }
  // The tally fires at the moment she is most likely to believe it.
  const t = arrivalTally(3, 5);
  assert.ok(t);
  assert.doesNotMatch(`${t.headline} ${t.detail}`, /your credits/i);
});

test('and the seat screen says the same thing — the shared pot is never "your credits"', () => {
  const src = stripComments(readFileSync(SEAT, 'utf8'));
  assert.doesNotMatch(src, /your credits ran out/i, 'a seat (or guest) refused for the shared pot is told it was HER credits');
  assert.match(src, /This event&rsquo;s credits have run out — the hosts can add more\./, 'the camera no longer says whose credits ran out');
  // A seat's exhaustion is the shared pot's sentence: every non-quota credit refusal turns the camera to it.
  assert.match(src, /if \(e\.code === 'quota_exhausted'\) \{[\s\S]{0,200}\} else \{\s*setPoolEmpty\(true\);/);
});

test('a refused shot is never called saved', () => {
  for (const [landed, refused] of [[0, 3], [3, 5], [9, 1]] as const) {
    const t = arrivalTally(landed, refused);
    assert.ok(t);
    assert.doesNotMatch(
      `${t.headline} ${t.detail}`,
      /every (photo|one)|all (of them|in the gallery)/i,
      'the panel used to claim every shot was in the gallery while some were refused',
    );
  }
});

test('a shot refused for credits is KEPT and counted — never drawn as saved (the one camera)', () => {
  /*
    The old seat screen badged a refused thumbnail and tallied "N landed, M refused", because a refused shot was
    LOST there. On the one camera a credit refusal is a HOLD: the shot stays on the phone and sends when the hosts
    add more, and the status chip counts what waits. Pin both halves, so "kept" can never quietly read as "saved".
  */
  const schedule = stripComments(readFileSync(join(process.cwd(), 'lib', 'papic-upload', 'schedule.ts'), 'utf8'));
  assert.match(schedule, /if \(shots\.every\(\(s\) => s\.hold === 'credits'\)\) return \{ kind: 'credits', waiting \};/);
  assert.match(schedule, /if \(waiting === 0\) return doneThisVisit > 0 \? \{ kind: 'saved' \} : \{ kind: 'idle' \};/, '"All saved" is no longer reserved for an empty queue');
  const chip = stripComments(readFileSync(CHIP, 'utf8'));
  assert.match(chip, /case 'credits':\s*return 'The event’s credits ran out, so these shots are kept on this phone\./);
  // The seat's money refusals reach that hold (lib/papic-seat-lane.ts → classifyAnswer 'credits').
  const lane = stripComments(readFileSync(join(process.cwd(), 'lib', 'papic-seat-lane.ts'), 'utf8'));
  assert.match(lane, /case 'camera_points_exhausted':\s*return \{ status: 402, error: 'camera_points_exhausted' \};/);
});

test('the comment stripper is not itself the reason these pass', () => {
  // If stripComments ate everything, the doesNotMatch assertions above would
  // pass for the wrong reason. Pin that live code survives it.
  const src = stripComments(readFileSync(ROUTE, 'utf8'));
  assert.match(src, /camera_points_exhausted/, 'stripComments destroyed the source');
  assert.ok(src.length > 4000, 'stripComments destroyed the source');
});
