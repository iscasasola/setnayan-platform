/**
 * A runaway camera cannot empty the couple's credit pot.
 *
 * ── THE PLAN ASKED FOR THIS AND IT WAS NEVER WIRED ──────────────────────────
 * `Papic_Build_Brief_2026-07-17.md` and `Papic_v3_Whats_Next_2026-07-18.md`
 * both list, under **"Open risks / must-hold invariants"**:
 *
 *   "Lite single-hot-row throughput (fast pre-read + accepts/sec limiter,
 *    not advisory-lock-per-event; load-test)"
 *
 * The fast pre-read shipped. The load test ran on 2026-08-21 (~1,830/s ceiling,
 * no decay — the row is not the wall). The **limiter existed and was attached to
 * three routes that are not captures**: wall-claim, seat-lookup, slug-check.
 * Zero capture paths. This pins it onto both capture doors.
 *
 * 🔑 PER CAMERA, NEVER PER EVENT. The owner's stated peak is 1–250 captures per
 * second FOR AN EVENT across many phones. An event-level limiter would have to
 * sit above that to avoid capping the product — at which point it protects
 * nothing. One phone shooting faster than the ceiling is not a person.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const read = (...p: string[]) => readFileSync(join(process.cwd(), ...p), 'utf8');

/**
 * 🪤 THE CONSTANTS ARE READ FROM SOURCE, NOT IMPORTED. `app/papic/actions.ts`
 * pulls in `server-only`, which cannot load outside a Next runtime — importing
 * it here fails the whole file before a single assertion runs. Same reason the
 * other guards on this surface are source-level.
 */
function num(name: string): number {
  const m = new RegExp(`export const ${name} = (\\d+);`).exec(
    read('app', 'papic', 'actions.ts'),
  );
  if (!m) throw new Error(`${name} is gone from app/papic/actions.ts`);
  return Number(m[1]);
}
const PAPIC_SEAT_BURST = num('PAPIC_SEAT_BURST');
const PAPIC_SEAT_BURST_WINDOW_S = num('PAPIC_SEAT_BURST_WINDOW_S');
/** A guard must read the code, not the comment that explains the trap. */
const code = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

test('the ceiling is far above a human and far below a loop', () => {
  const perSecond = PAPIC_SEAT_BURST / PAPIC_SEAT_BURST_WINDOW_S;
  assert.ok(
    perSecond >= 8,
    `${perSecond}/s would catch a paparazzo hammering the shutter. The failure ` +
      'being prevented is a stuck client, not an enthusiastic photographer.',
  );
  assert.ok(
    perSecond <= 40,
    `${perSecond}/s is so high that a runaway loop drains the pot before it trips.`,
  );
});

test('the camera door has the ceiling', () => {
  const src = code(read('app', 'papic', 'actions.ts'));
  assert.match(
    src,
    /enforceRateLimit\('papic_seat_capture', cleanToken/,
    'Seat captures are unlimited again — one stuck camera can spend a couple’s ' +
      'whole credit pot with nothing in its way.',
  );
  assert.match(src, /error: 'too_fast'/, 'the refusal must be a soft error the camera can survive');
});

test('the guest door has the same ceiling, keyed on the guest', () => {
  const src = code(read('app', 'api', 'papic', 'guest-capture', 'route.ts'));
  assert.match(
    src,
    /enforceRateLimit\('papic_guest_capture', session\.guest_id/,
    'Guest captures are unlimited again.',
  );
});

test('🔑 the key is the CAMERA, never the event', () => {
  // An event-level key would have to sit above 250/s to avoid capping the
  // product — a limit above the intended peak protects nothing at all.
  for (const [file, src] of [
    ['seat', code(read('app', 'papic', 'actions.ts'))],
    ['guest', code(read('app', 'api', 'papic', 'guest-capture', 'route.ts'))],
  ] as const) {
    const calls = src.match(/enforceRateLimit\('papic_[a-z_]+',\s*([A-Za-z.$_]+)/g) ?? [];
    for (const c of calls) {
      assert.doesNotMatch(
        c,
        /event_id|eventId/,
        `${file}: the capture limiter is keyed on the EVENT. At the owner's ` +
          'stated 1–250/s peak that either caps the product or does nothing.',
      );
    }
  }
});

test('it fails OPEN — a limiter outage must never stop a wedding', () => {
  assert.match(
    code(read('lib', 'with-rate-limit.ts')),
    /return \{ ok: true/,
    'The limiter no longer fails open. What it guards is a credit balance, not a ' +
      'security boundary — refusing real photographs because the limiter is sick ' +
      'is worse than the thing it prevents.',
  );
});
