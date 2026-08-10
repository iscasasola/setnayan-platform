/**
 * GUARD — the five render-time self-heals run for EVERY room, always.
 *
 * 🚨 THE TRAP THIS EXISTS TO KILL, and it is the tidy move, not a careless one.
 *
 * Five idempotent writes sit in this page's prologue, and every one of them is
 * Cameras-flavoured:
 *
 *   provisionFreeCamerasAdmin     — materializes the three free seats and their
 *                                   claim QR tokens. It has ONE production call
 *                                   site: this page.
 *   ensureFreePapicPoolGrantAdmin — arms the free 50-point pool. Without a grant
 *                                   `papic_reserve_event_points()` takes its
 *                                   "fence absent → allow" branch and capture
 *                                   runs UNMETERED.
 *   ensureFreePapicOneCameraAdmin — the one free dedicated camera.
 *   reconcileLimitedSnapshot      — pending → active.
 *   syncGuestCameras              — keeps guest cameras level with late RSVPs.
 *
 * When this page was split into three rooms, filing these with the Cameras room
 * is what a tidy engineer does by reflex. The consequence: a couple whose event
 * has passed lands on **Photos** by default — so free cameras would silently
 * stop being created, and capture would silently stop being metered, for exactly
 * the population least likely to open Cameras.
 *
 * Nothing throws. Nothing logs. CI stays green. The only symptom is an absence —
 * the same family as the phantom column, the phantom enum value, the phantom RPC
 * argument and the blocked iframe.
 *
 * ⚠ SO THIS IS NOT A STYLE RULE. Weakening it re-opens a silent, unbilled,
 * camera-less event. If a self-heal genuinely must move, it moves to a place
 * that runs on every render — never behind a room.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = readFileSync(resolve(HERE, '..', 'page.tsx'), 'utf8');

/** Comments stripped — a guard must never pass on the prose explaining it. */
const CODE = PAGE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** The five writes, by the call this page makes. */
const SELF_HEALS = [
  'provisionFreeCamerasAdmin',
  'ensureFreePapicPoolGrantAdmin',
  'ensureFreePapicOneCameraAdmin',
  'reconcileLimitedSnapshot',
  'syncGuestCameras',
] as const;

/**
 * The page's PROLOGUE — everything before the first room appears. A self-heal
 * here runs on every render whatever room resolves; one after the first
 * `room === ` does not.
 */
function prologue(): string {
  const firstRoom = CODE.indexOf("room === '");
  assert.ok(firstRoom > 0, 'the room switch must still exist — has the page been restructured?');
  const out = CODE.slice(0, firstRoom);
  assert.ok(out.length > 500, 'the prologue came back suspiciously short');
  return out;
}

test('the five self-heals are still called by this page at all', () => {
  // If one disappears entirely, that is a bigger change than this guard covers —
  // but it must not pass silently on its way out.
  const missing = SELF_HEALS.filter((fn) => !new RegExp(`\\b${fn}\\s*\\(`).test(CODE));
  assert.deepEqual(
    missing,
    [],
    `these self-heals no longer run on this page at all:\n  ${missing.join('\n  ')}`,
  );
});

test('🚨 every self-heal runs BEFORE any room is chosen', () => {
  const before = prologue();
  const gated = SELF_HEALS.filter((fn) => !new RegExp(`\\b${fn}\\s*\\(`).test(before));
  assert.deepEqual(
    gated,
    [],
    `these run only inside a room — a couple who lands on another room silently stops getting them:\n  ${gated.join('\n  ')}`,
  );
});

test('🚨 no self-heal is wrapped in a room condition anywhere', () => {
  // Belt and braces against the subtler shape: called in the prologue, but
  // behind an `if (room === …)` that happens to sit above the JSX.
  const offenders: string[] = [];
  for (const fn of SELF_HEALS) {
    const at = CODE.search(new RegExp(`\\b${fn}\\s*\\(`));
    if (at < 0) continue;
    // The 400 characters before the call — enough to catch an enclosing guard.
    const context = CODE.slice(Math.max(0, at - 400), at);
    if (/\bif\s*\([^)]*\broom\b/.test(context) || /\broom\s*===\s*'/.test(context)) {
      offenders.push(fn);
    }
  }
  assert.deepEqual(
    offenders,
    [],
    `these appear to sit behind a room check:\n  ${offenders.join('\n  ')}`,
  );
});

test('the page still resolves a room (this guard is about ORDER, not absence)', () => {
  // If the room switch were removed, `prologue()` would be the whole file and
  // every assertion above would pass vacuously. Fail loudly instead.
  assert.match(CODE, /resolvePapicRoom\s*\(/);
  assert.ok(CODE.indexOf("room === '") > 0);
});
