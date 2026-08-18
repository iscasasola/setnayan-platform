/**
 * putaway-stops-captures.test.ts — a celebration put away stops taking photos.
 *
 * Owner, 2026-08-16: **"cameras and the photo wall go quiet. Everything already
 * taken stays untouched."**
 *
 * ─── WHY THE GATE IS NOT WHERE IT LOOKS LIKE IT SHOULD BE ──────────────────
 * 🪤 BOTH capture paths converge on the credit reservation
 * `papic_reserve_capture_split`, which reads like the obvious single chokepoint.
 * It is not: `recordSeatCapture` SKIPS that call entirely for an event holding
 * the "Unlock all of Papic" pass (`if (!unlocked)`), so a gate placed there
 * would be **silently absent on exactly the events that paid the most**. The
 * rule therefore sits beside the capture-WINDOW gate, which every seat capture
 * passes, and again in the guest route, which shares no code path with it.
 *
 * ─── THE TWO DIRECTIONS ARE DELIBERATE ─────────────────────────────────────
 * Capture fails OPEN on an unreadable row; the wall fails CLOSED. Not an
 * oversight and not something to "make consistent": a few photographs landing
 * on a tidied celebration is a tidiness problem, while a camera refusing during
 * a live wedding is the one irreversible failure in this product. The wall's
 * harm runs the other way — still playing a celebration somebody put away is
 * precisely what the couple believed they had stopped.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { rowAcceptsNewCaptures } from '@/lib/event-accepts-captures-rule';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', 'app');

const SEAT_CAPTURE = join(APP, 'papic', 'actions.ts');
const GUEST_CAPTURE = join(APP, 'api', 'papic', 'guest-capture', 'route.ts');
const WALL = join(HERE, 'live-wall.ts');

const code = (p: string) => stripComments(readFileSync(p, 'utf8'));

test('the anchor: every file this guard reasons about exists', () => {
  for (const p of [SEAT_CAPTURE, GUEST_CAPTURE, WALL, join(HERE, 'event-accepts-captures.ts')]) {
    assert.ok(
      existsSync(p) && readFileSync(p, 'utf8').length > 500,
      `${p} is missing or a stub — every assertion below would pass vacuously.`,
    );
  }
});

/* ─── THE RULE ITSELF, EXERCISED (not just read) ────────────────────────── */

test('a put-away celebration refuses new captures', () => {
  assert.equal(rowAcceptsNewCaptures({ archived: true }, false), false);
});

test('an ordinary celebration still captures', () => {
  assert.equal(rowAcceptsNewCaptures({ archived: false }, false), true);
});

test('an unreadable row fails OPEN — a live wedding never loses its cameras', () => {
  assert.equal(
    rowAcceptsNewCaptures(null, true),
    true,
    'A read failure must not stop capture. Blocking a live celebration’s ' +
      'cameras is the one failure that cannot be undone — the day does not ' +
      'happen twice.',
  );
  assert.equal(
    rowAcceptsNewCaptures(null, false),
    true,
    'A missing row must take the same fail-open branch: Supabase resolves with ' +
      '{ error } rather than throwing, so "could not read" arrives as null.',
  );
});

test('a NULL archived value is not treated as put away', () => {
  assert.equal(
    rowAcceptsNewCaptures({ archived: null }, false),
    true,
    'Only an explicit TRUE stops the shutter.',
  );
});

/* ─── BOTH ENTRY POINTS ASK IT ──────────────────────────────────────────── */

for (const [name, file] of [
  ['the paparazzi seat', SEAT_CAPTURE],
  ['the guest’s own camera', GUEST_CAPTURE],
] as const) {
  test(`${name} asks the gate before capturing`, () => {
    assert.match(
      code(file),
      /await eventAcceptsNewCaptures\(/,
      `${name}: does not ask the put-away gate. The two capture paths share no ` +
        'code, so a rule written once is a rule enforced once.',
    );
  });
}

test('the seat gate is NOT hidden inside the credit reservation', () => {
  const src = code(SEAT_CAPTURE);
  /*
    🪤 THE REGRESSION THIS CATCHES is a tidy-looking refactor: moving the check
    next to `papic_reserve_capture_split` because both paths "go through" it.
    They do not — the Unlock pass skips that call — so the gate must appear
    BEFORE the `if (!unlocked)` branch, not inside it.
  */
  const gateAt = src.indexOf('eventAcceptsNewCaptures(');
  const unlockedBranchAt = src.indexOf('if (!unlocked)');
  assert.ok(gateAt > 0 && unlockedBranchAt > 0, 'Expected both markers to be present.');
  assert.ok(
    gateAt < unlockedBranchAt,
    'The put-away gate moved inside or after the `if (!unlocked)` branch. That ' +
      'branch is skipped for an event holding the Papic Unlock pass, so the ' +
      'rule would be silently absent on the events that paid the most.',
  );
});

/* ─── THE WALL ──────────────────────────────────────────────────────────── */

test('the guest wall mirror closes on a put-away celebration', () => {
  const src = code(WALL);
  /*
    ⚠ RULE, NOT SPELLING. The first cut of these two pinned
    `.select('live_photo_wall_visibility, archived')` and
    `if (row.archived === true) return false;` character for character — which
    is the EXACT brittleness this PR had to repair one file away, where a pinned
    select string reddened CI on a behaviour-preserving widening. Reversing the
    column order, adding a third column, or renaming the local `row` to `ev` are
    all no-ops that would have failed.

    Both still refuse the mutations that matter: `[^']*` cannot leave the select
    string literal, so a column only MENTIONED in the type cast does not satisfy
    the first; and the second requires an identity test against `true` reaching
    a `return false`, so weakening it to a truthy check or dropping the refusal
    still fails.
  */
  assert.match(
    src,
    /\.select\('[^']*\barchived\b[^']*'\)/,
    'The wall gate must read `archived` on the select it ALREADY makes — a ' +
      'second query on a feed that re-asks every 25s is a cost with no reason.',
  );
  assert.match(
    src,
    /\.archived === true\)?\s*(?:\{\s*)?return false;/,
    'The wall gate no longer closes on a put-away celebration. Closing the ' +
      'mirror closes the DATA, not just the component — the feed re-serves ' +
      'tiles to anyone holding the address.',
  );
});

/* ─── THE REFUSAL HAS TO REACH A PERSON ─────────────────────────────────────
   Everything above proves the server REFUSES. None of it proves anybody is
   TOLD. When this PR was first reviewed, `EVENT_PUT_AWAY_CAPTURE_COPY` — the
   one sentence written to explain the refusal, which even names the way back —
   was imported by NOTHING. Only its declaration and its re-export. Meanwhile
   every client surface absorbed the refusal into a message that meant something
   else. A refusal nobody can read is the same shape as the gate with no handle:
   built, correct, and unreachable.
─────────────────────────────────────────────────────────────────────────────*/

const GUEST_CAM = join(APP, 'papic', 'guest', '_components', 'papic-guest-capture.tsx');
const SEAT_CAM = join(APP, 'papic', 'seat', '[token]', '_components', 'papic-seat-capture.tsx');
const DECORATOR = join(APP, 'papic', 'decorate', '_components', 'kwento-decorator.tsx');
const DRAIN = join(HERE, 'offline', 'service-handlers', 'papic-drain.ts');

test('the put-away sentence has readers — it is rendered, not merely declared', () => {
  for (const p of [GUEST_CAM, SEAT_CAM, DECORATOR]) {
    assert.ok(existsSync(p), `${p} is missing — this assertion would pass vacuously.`);
    assert.match(
      code(p),
      /EVENT_PUT_AWAY_CAPTURE_COPY/,
      `${p.split('/').slice(-1)[0]} must SHOW the put-away sentence. Without it ` +
        `the person is told something that is not true about why their photo ` +
        `did not save.`,
    );
  }
});

test('the guest camera asks about put-away BEFORE it reads 409 as "out of shots"', () => {
  const src = code(GUEST_CAM);
  /*
    Both refusals answer 409, so ORDER is the whole mechanism: the 409 branch
    calls setRemaining(0), which disables the shutter for the session and paints
    a thank-you over a photo that was thrown away — and auto-opens a sheet
    selling shots that cannot be taken.

    Asserted per OCCURRENCE, not once globally: the file posts a capture from
    two places, and a guard that only checks the first index passes while the
    second is wrong. That is precisely how this shipped.
  */
  const putAway = [...src.matchAll(/if \(json\.status === 'event_put_away'\)/g)].map((m) => m.index!);
  const quota = [...src.matchAll(/if \(res\.status === 409/g)].map((m) => m.index!);

  assert.equal(
    putAway.length,
    quota.length,
    `every 409 branch needs a put-away branch above it — found ${putAway.length} ` +
      `put-away checks for ${quota.length} 409 branches`,
  );
  assert.ok(quota.length >= 2, 'the file should still post a capture from both sites');
  quota.forEach((quotaAt, i) => {
    const putAwayAt = putAway[i];
    assert.ok(
      putAwayAt !== undefined && putAwayAt < quotaAt,
      `capture site ${i + 1}: the put-away check must come BEFORE the 409 branch, ` +
        `or the refusal is read as "you are out of shots"`,
    );
  });
});

test('a put-away refusal is terminal, so the camera never promises a later upload', () => {
  /*
    🪤 BOUNDED BY THE DECLARATION, NOT BY A CHARACTER BUDGET. The first cut was
    `/PAPIC_TERMINAL_ERRORS[\s\S]{0,600}?'event_put_away'/` and it FAILED against
    correct code — `stripComments` blanks a comment while preserving its length,
    so the explanatory note written inside the set pushed the entry past the
    600-char window. Second time in one session that a match window shrank the
    moment somebody documented the code. Slice to `]);` and the guard is bounded
    by what the thing IS.
  */
  const src = code(DRAIN);
  const start = src.indexOf('PAPIC_TERMINAL_ERRORS');
  assert.ok(start > -1, 'PAPIC_TERMINAL_ERRORS should still exist');
  const set = src.slice(start, src.indexOf(']);', start));
  assert.match(
    set,
    /'event_put_away'/,
    'without this the shot is QUEUED and the photographer is told it "will ' +
      'finish uploading once you are back online" — they are online, it can ' +
      'never land, and it is evicted silently after 7 days',
  );
});

test('the put-away gate is not nested inside the per-camera SKU branch', () => {
  /*
    🪤 THE ORDER TEST CANNOT SEE THIS, and that is the point. Asserting
    `indexOf('eventAcceptsNewCaptures(') < indexOf('if (!unlocked)')` is
    satisfied by the buggy placement too — the gate sat INSIDE `if (cameraTier)`
    and still came first. An order check says nothing about which conditional
    you are nested in.

    Measured by INDENTATION on the stripped source: the gate's `if (!accepts…)`
    must sit at the function's own top level, not deeper than the
    `if (cameraTier) {` that follows it. A rule about the EVENT must not be
    scoped to a per-camera SKU allow-list.
  */
  const lines = code(SEAT_CAPTURE).split('\n');
  const gate = lines.findIndex((l) => /if \(!acceptsCaptures\)/.test(l));
  const tier = lines.findIndex((l) => /if \(cameraTier\) \{/.test(l));
  assert.ok(gate > -1, 'the put-away gate should still exist in recordSeatCapture');
  assert.ok(tier > -1, 'the per-camera SKU branch should still exist');

  const indentOf = (i: number) => (lines[i] ?? '').search(/\S/);
  assert.ok(
    gate < tier,
    'the put-away gate must be reached before the per-camera branch',
  );
  assert.ok(
    indentOf(gate) <= indentOf(tier),
    `the put-away gate is indented deeper (${indentOf(gate)}) than the ` +
      `per-camera branch (${indentOf(tier)}), so it is nested inside some ` +
      `conditional — a seat outside PER_CAMERA_SKUS would skip it entirely`,
  );
});

test('the card does not promise that everything keeps working exactly as now', () => {
  /*
    THE CROSS-PR DEFECT. The put-away button and the capture gate shipped as two
    separate changes. The button's card told the couple, immediately before they
    pressed it, that "the photos, the guest list and the page your guests use all
    keep working exactly as they do now" — true on its own, and false the moment
    this PR made the shutter and the guests' photo wall go quiet.

    🔑 A PROMISE MADE BY ONE CHANGE CAN BE BROKEN BY THE NEXT, and nothing fails
    when it happens. This assertion is the thing that fails.
  */
  const card = join(
    APP, 'dashboard', '[eventId]', 'details', '_components', 'put-away-card.tsx',
  );
  assert.ok(existsSync(card), 'the put-away card should exist');
  const src = code(card);

  assert.doesNotMatch(
    src,
    /keep working\s+exactly as they do now/,
    'the card still promises everything keeps working exactly as now — the ' +
      'cameras and the guests’ photo wall do not',
  );
  assert.match(
    src,
    /cameras and the photo wall go quiet/,
    'the card must say what STOPS. A couple cannot discover the cameras going ' +
      'quiet any other way before they press.',
  );
});
