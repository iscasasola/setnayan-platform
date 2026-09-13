/**
 * A PAUSE QUIETS THE PROMPTS, AND SAYS SO — never an absence, never the camera.
 *
 * Owner, 2026-09-01: *"let us also allow pause for the challenge. so challenges
 * can all be not available on moments everybody must be watching."*
 *
 * Three properties, each of which fails silently if nobody asserts it:
 *   1. an UNREADABLE pause state resolves to RUNNING, not paused;
 *   2. the guest's board is not emptied — the flag rides alongside the
 *      missions, and the panel renders words;
 *   3. nothing about the pause reaches a capture path.
 *
 * ⚠ (2) AND (3) ARE SOURCE GUARDS, and that is the shipped precedent here, not
 * a shortcut: `live-wall-challenge-is-honest.test.ts` reads
 * `live-wall.ts`'s query source for the same reason (`server-only` is pulled in
 * transitively and executing the reader outside the Next build would crash the
 * run rather than test anything). A LOG LINE NEVER CHANGED A PIXEL — so the
 * render is checked, not inferred from a correct reader.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

import { isPaused, type PauseReading } from './papic-challenge-pause';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => stripComments(readFileSync(join(HERE, p), 'utf8'));

// ── 1 · The direction of the failure ───────────────────────────────────────

test('an unreadable pause state is RUNNING, never paused', () => {
  // 🔑 THE DIRECTION IS THE WHOLE TEST. Resolving an unknown state to PAUSED
  // would silence every guest's board on a network blip, at a party, for a
  // reason nobody could see. Resolving to RUNNING costs a courtesy, not a
  // celebration — the same direction as "closes the prompt, never the shutter".
  assert.equal(isPaused({ measured: false, pausedAt: null }), false);
});

test('measured states read exactly as they are', () => {
  assert.equal(isPaused({ measured: true, pausedAt: null }), false, 'NULL is running');
  assert.equal(
    isPaused({ measured: true, pausedAt: '2026-09-01T10:00:00Z' }),
    true,
    'a timestamp is a pause',
  );
});

test('"not measured" and "not paused" are different facts a caller can tell apart', () => {
  // A boolean-only reader would collapse these, and the coordinator's screen
  // could then say "challenges are running" about a celebration it could not
  // read at all.
  const unknown: PauseReading = { measured: false, pausedAt: null };
  const running: PauseReading = { measured: true, pausedAt: null };
  assert.notEqual(unknown.measured, running.measured);
  assert.equal(isPaused(unknown), isPaused(running), 'both are safe to act on as "running"');
});

test('the reader never derives an end from the timestamp — a pause has no clock', () => {
  // Manual only (owner). A comparison against `pausedAt` would be a second,
  // invented rule about when a room may play again, and it would expire a pause
  // in the middle of the vows.
  const body = src('papic-challenge-pause.ts');
  for (const clock of ['Date.now()', 'new Date()', 'getTime()', 'DURATION', 'MINUTES']) {
    assert.ok(
      !body.includes(clock),
      `papic-challenge-pause.ts grew a clock (${clock}) — a pause ends when somebody resumes it, and never on its own`,
    );
  }
});

// ── 2 · The board is not emptied, and the guest is told ────────────────────

test('the guest route sends the missions AND the flag — it never returns an empty board', () => {
  const route = src('../app/api/papic/guest-missions/route.ts');
  assert.match(
    route,
    /NextResponse\.json\(\{\s*missions,\s*paused\s*\}\)/,
    'the flag must ride ALONGSIDE the missions',
  );
  // The failure this forbids: quieting the board by sending nothing. An empty
  // list is byte-identical to a celebration that set no challenges up.
  assert.ok(
    !/paused\s*\?\s*\[\]/.test(route) && !/missions:\s*paused/.test(route),
    'the route empties the board when paused — "not available" must never ship as an absence',
  );
});

test('the paused notice reaches the guest’s screen, with words', () => {
  const panel = src('../app/papic/guest/_components/papic-challenge-panel.tsx');
  assert.match(panel, /setPaused\(json\.paused === true\)/, 'the flag must come from the response, strictly');
  assert.match(panel, /\{paused \?/, 'the flag must gate a render, not just sit in state');
  assert.match(panel, /Challenges are paused/, 'the guest must be TOLD, not left with a quiet screen');
  assert.match(
    panel,
    /role="status"/,
    'a screen reader must get the pause too — it is the only explanation on the screen',
  );
});

test('the panel does not empty its own list when paused', () => {
  // The other half of the same defect, one layer up: a client that clears
  // `missions` on a pause produces the same indistinguishable empty board.
  const panel = src('../app/papic/guest/_components/papic-challenge-panel.tsx');
  assert.ok(
    !/paused[^\n]*setMissions\(\[\]\)/.test(panel) && !/setMissions\(\[\]\)[^\n]*paused/.test(panel),
    'the panel blanks its board on a pause',
  );
});

// ── 3 · 🔴 It closes prompts, never the shutter ────────────────────────────

test('no capture surface consults the pause', () => {
  // The first kiss is the most photographed second of the day. A pause that
  // stopped the camera would silence the challenges by throwing away the
  // pictures the product exists to collect.
  for (const path of [
    '../app/api/papic/guest-capture/route.ts',
    '../app/papic/guest/_components/papic-guest-capture.tsx',
  ]) {
    const body = src(path);
    for (const marker of ['papic-challenge-pause', 'papic_challenges_paused_at', 'isPaused']) {
      assert.ok(
        !body.includes(marker),
        `${path} reads the pause (${marker}) — a guest is never refused a photo because the challenges are quiet`,
      );
    }
  }
});

test('the pause is a prompt-level fact — it does not touch is_active or the armed clock', () => {
  const body = src('papic-challenge-pause.ts');
  assert.ok(
    !body.includes('is_active'),
    'pausing must not hide challenges — hiding takes one challenge off every board FOR GOOD, and undoing ten of those is not a two-minute silence',
  );
  for (const clockFn of ['papic_arm_challenge', 'papic_challenge_is_open', 'armed_at']) {
    assert.ok(
      !body.includes(clockFn),
      `the pause reached into the armed clock (${clockFn}) — they are separate acts and openness has exactly one decider`,
    );
  }
});
