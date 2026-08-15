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
  assert.match(
    src,
    /\.select\('live_photo_wall_visibility, archived'\)/,
    'The wall gate must read `archived` on the select it ALREADY makes — a ' +
      'second query on a feed that re-asks every 25s is a cost with no reason.',
  );
  assert.match(
    src,
    /if \(row\.archived === true\) return false;/,
    'The wall gate no longer closes on a put-away celebration. Closing the ' +
      'mirror closes the DATA, not just the component — the feed re-serves ' +
      'tiles to anyone holding the address.',
  );
});
