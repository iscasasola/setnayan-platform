/**
 * VENUE SCREENS COME WITH LIVE STUDIO — owner ruling 2026-09-20.
 *
 * Asked whether venue screens should stay free or become a paid perk, the
 * owner said: "live studio is paid… depends on their live studio." Ruling:
 * screens are bundled into the SAME ₱2,500 unlock (lib/live-studio-window.ts)
 * — no second charge, no second flag. Before this PR,
 * `screens-actions.ts`'s `gate()` checked only `isLiveStudioSetupHost` (who
 * may run the controller), never whether the event had actually paid for
 * Live Studio — every couple could add, pair and drive venue screens for
 * free, on any event, entitled or not.
 *
 * THE ONE DECISION both ends call is `canUseVenueScreens` (lib/live-screens.ts),
 * fed `liveStudioActive` resolved the SAME way broadcasting already is
 * (`resolveBroadcastWindow(...).multiCam`) — so this can never disagree with
 * the controller's own "Unlock · price" bar.
 *
 * THIS FILE is the source-scanning half: it counts every exported server
 * action in screens-actions.ts and proves each one consults the gate (or is
 * the one documented exception, `removeLiveScreen`, kept for cleanup), and it
 * proves the /live pairing and load path do the same. A count that silently
 * drops — a new action added with no gate, or an existing one losing its
 * call — must fail here, not be caught by eyeballing a diff.
 *
 * SABOTAGE, run by hand while writing this file (not left in the tree):
 * commenting out the `canUseVenueScreens` check in load-screen.ts turned its
 * own test red, and dropping `gate(formData)` from any one action in
 * screens-actions.ts turned the "every export" test below red at that
 * function's name.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const HERE = import.meta.dirname;
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));

const SCREENS_ACTIONS = './screens-actions.ts';
const LIVE_ACTIONS = '../../../live/actions.ts';
const LOAD_SCREEN = '../../../live/_lib/load-screen.ts';
const SCREEN_STAGE = '../../../live/screen/screen-stage.tsx';

/* ── 1 · screens-actions.ts — every export consults the gate ─────────────── */

/** Exported function name → its body, up to the next export or EOF. */
function exportedFunctionBodies(src: string): Map<string, string> {
  const re = /export async function (\w+)\(/g;
  const starts: Array<{ name: string; at: number }> = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    const name = m[1];
    if (name) starts.push({ name, at: m.index });
  }
  const out = new Map<string, string>();
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    if (!start) continue;
    const next = starts[i + 1];
    const end = next ? next.at : src.length;
    out.set(start.name, src.slice(start.at, end));
  }
  return out;
}

test('screens-actions.ts exports exactly the six known writes — a new one must be added to this list', () => {
  const bodies = exportedFunctionBodies(read(SCREENS_ACTIONS));
  assert.deepEqual(
    [...bodies.keys()].sort(),
    [
      'addLiveScreen',
      'reissueLiveScreenCode',
      'removeLiveScreen',
      'renameLiveScreen',
      'setAllLiveScreensMode',
      'setLiveScreenMode',
    ].sort(),
    'a screens-actions.ts export was added or renamed without updating this floor — it must be ' +
      'proven gated (or explicitly exempted) below',
  );
});

test('every screens-actions.ts export EXCEPT removeLiveScreen calls the entitlement-checked gate', () => {
  const bodies = exportedFunctionBodies(read(SCREENS_ACTIONS));
  let checked = 0;
  for (const [name, body] of bodies) {
    if (name === 'removeLiveScreen') continue;
    assert.match(
      body,
      /=\s*await gate\(formData\)/,
      `${name} does not call the default gate(formData) — it must run the Live Studio entitlement check`,
    );
    assert.doesNotMatch(
      body,
      /allowLocked:\s*true/,
      `${name} must not skip the entitlement gate — only removeLiveScreen (cleanup) may`,
    );
    checked += 1;
  }
  assert.equal(checked, 5, 'expected exactly five gated actions besides removeLiveScreen');
});

test('removeLiveScreen is the ONE documented exception — cleanup survives a locked event', () => {
  const bodies = exportedFunctionBodies(read(SCREENS_ACTIONS));
  const body = bodies.get('removeLiveScreen');
  assert.ok(body, 'removeLiveScreen not found');
  assert.match(
    body!,
    /gate\(formData,\s*\{\s*allowLocked:\s*true\s*\}\)/,
    'removeLiveScreen must explicitly opt out of the entitlement gate, not merely omit it',
  );
});

test('gate() itself resolves the SAME entitlement the controller page uses for broadcasting', () => {
  const src = read(SCREENS_ACTIONS);
  const gateAt = src.indexOf('async function gate(');
  assert.ok(gateAt > -1, 'gate() not found — did it move or get renamed?');
  const gateBody = src.slice(gateAt, src.indexOf('\nasync function', gateAt + 1) === -1 ? undefined : src.indexOf('\nasync function', gateAt + 1));
  assert.match(
    gateBody,
    /resolveBroadcastWindow\(\s*admin\s*,\s*eventId\s*\)/,
    'gate() must resolve entitlement via resolveBroadcastWindow — the same resolver page.tsx uses',
  );
  // Anchored on `if (!canUseVenueScreens(` EXACTLY, not merely the call's
  // presence somewhere in the function — a "keep the call, discard its
  // result" sabotage (e.g. `if (false && !canUseVenueScreens(...))`) still
  // contains the call and would slip past a bare `assert.match` on it alone.
  // Measured: without this anchor, that exact sabotage passed every test in
  // this file.
  assert.match(
    gateBody,
    /if\s*\(\s*!canUseVenueScreens\(\s*\{\s*liveStudioActive:\s*broadcastWindow\.multiCam\s*\}\s*\)\s*\)\s*\{/,
    'gate() must branch directly on !canUseVenueScreens(...) — not on a call whose result is discarded',
  );
  // The old, un-gated shape this replaces: a mutation that deletes the
  // entitlement check but leaves the host check must fail here.
  assert.match(gateBody, /isLiveStudioSetupHost/, 'the host check must still run');
});

/* ── 2 · the /live pairing path refuses a locked event ────────────────────── */

test('pairLiveScreen refuses to claim a code for an event with no active Live Studio', () => {
  const src = read(LIVE_ACTIONS);
  assert.match(
    src,
    /resolveBroadcastWindow\(\s*admin\s*,\s*found\.event_id\s*\)/,
    'pairLiveScreen must resolve the found row\'s OWN event entitlement, not the wrong id',
  );
  assert.match(
    src,
    /canUseVenueScreens\(\s*\{\s*liveStudioActive:\s*broadcastWindow\.multiCam\s*\}\s*\)/,
    'pairLiveScreen must decide through canUseVenueScreens',
  );
  assert.match(src, /redirect\('\/live\?error=locked'\)/, 'a locked event must redirect with a distinct error');
  // The entitlement check must run AFTER the code is validated (usable) and
  // BEFORE the claiming UPDATE — a code must not be consumed by a locked pair.
  const usableAt = src.indexOf('pairCodeUsable(found');
  const lockAt = src.indexOf('canUseVenueScreens(');
  const updateAt = src.indexOf(".from('panood_screens')\n    .update({\n      paired_at: pairedAt");
  assert.ok(usableAt > -1 && lockAt > -1 && updateAt > -1, 'one of the three anchors moved — re-read the file');
  assert.ok(usableAt < lockAt && lockAt < updateAt, 'the entitlement check must sit between validating the code and claiming it');
});

/* ── 3 · the /live load path goes dark, on every poll ──────────────────────── */

test('loadLiveScreen resolves entitlement on every poll and can return locked', () => {
  const src = read(LOAD_SCREEN);
  assert.match(src, /state:\s*'locked'/, "LoadedScreen must carry a distinct 'locked' state");
  assert.match(
    src,
    /resolveBroadcastWindow\(\s*admin\s*,\s*row\.event_id\s*\)/,
    'loadLiveScreen must resolve the PAIRED row\'s event entitlement, not a request-time value',
  );
  assert.match(src, /canUseVenueScreens\(\s*\{\s*liveStudioActive:\s*broadcastWindow\.multiCam\s*\}\s*\)/);
  // Gated BEFORE the event read that produces the picture — a locked poll
  // must never reach the query that would let it draw the event's content.
  const gateAt = src.indexOf('canUseVenueScreens(');
  const eventReadAt = src.indexOf(".from('events')");
  assert.ok(gateAt > -1 && eventReadAt > -1 && gateAt < eventReadAt, 'the entitlement check must run before the event read');
});

test('a locked screen goes DARK — it must not fall through to the last good picture', () => {
  const src = read(SCREEN_STAGE);
  const lockedReturnAt = src.indexOf("loaded.state === 'locked'");
  const shownAt = src.indexOf('const shown =');
  assert.ok(lockedReturnAt > -1, "ScreenStage no longer branches on loaded.state === 'locked'");
  assert.ok(shownAt > -1, 'const shown assignment not found — did the stage get restructured?');
  assert.ok(
    lockedReturnAt < shownAt,
    'the locked branch must return before `shown` (which can hold the last good picture) is computed — ' +
      'a locked TV must never render content from before it was locked',
  );
});
