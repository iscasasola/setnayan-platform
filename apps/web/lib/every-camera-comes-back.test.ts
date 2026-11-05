/**
 * every-camera-comes-back.test.ts — EVERY page that opens a camera reopens it
 * when iOS, an iPhone Duo or a dead track takes it away.
 *
 * Duo + iPad audit 2026-10-19 (row W4, checklist point 9): no `getUserMedia`
 * surface listened for the track ending or muting, or for the page coming back,
 * so after a trip to the home screen — or a Duo opening — the preview stayed
 * frozen or black. The fix is ONE shared watch (`useCameraThatComesBack`); this
 * guard is what keeps the next camera page from being written without it.
 *
 * The property, read from the source with comments stripped:
 *   1. every file under app/ and lib/ that CALLS `getUserMedia(` also calls
 *      `useCameraThatComesBack(` — or is named in EXEMPT with its reason;
 *   2. every `usePapicCamera({` call passes `holdRestart`, so a camera that
 *      comes back can never cut a clip mid-take (a reopen is not a shot);
 *   3. the enumeration itself is alive (it finds the cameras it must find).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');

/**
 * Files that open a camera WITHOUT the watch, each with the reason. Adding a
 * line here is a decision, not a way to go green.
 */
const EXEMPT: Record<string, string> = {
  'app/papic/lightcheck/_components/lightcheck-client.tsx':
    'a throwaway capability probe ("do not improve"): a reopen would wipe the very readings it exists to take',
  'app/_components/thread-call-room.tsx':
    'a live 1:1 call — reopening means leaving and re-joining, and its teardown ends the call row (endThreadCall); needs a replaceTrack path in lib/call-webrtc.ts, not a restart',
  'lib/camera-bridge/internal-bridge.ts':
    'a CameraBridge protocol class, not a page: its reconnect belongs to the DSLR pairing state machine that owns it',
};

function walk(dir: string, out: string[]): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(full);
  }
  return out;
}

const SOURCES = [...walk(join(WEB, 'app'), []), ...walk(join(WEB, 'lib'), [])].map((full) => ({
  rel: relative(WEB, full).split('\\').join('/'),
  code: stripComments(readFileSync(full, 'utf8')),
}));

const CAMERAS = SOURCES.filter((f) => /\bgetUserMedia\s*\(/.test(f.code));

test('the enumeration finds the cameras it must find', () => {
  const rels = CAMERAS.map((f) => f.rel);
  for (const must of [
    'lib/use-papic-camera.ts',
    'app/panood/cam/[token]/_components/panood-camera-publish.tsx',
    'app/dashboard/[eventId]/guests/checkin/_components/checkin-desk.tsx',
  ]) {
    assert.ok(rels.includes(must), `${must} no longer calls getUserMedia — update this guard`);
  }
  // Printed so a run shows what was checked, not just that it passed.
  console.log(`camera call sites: ${CAMERAS.length} (${Object.keys(EXEMPT).length} exempt)`);
  assert.ok(CAMERAS.length >= 12, `only ${CAMERAS.length} camera files found — the walk is broken`);
});

test('every page that opens a camera reopens it when the camera is taken away', () => {
  const missing = CAMERAS.filter((f) => !EXEMPT[f.rel] && !/\buseCameraThatComesBack\s*\(/.test(f.code)).map(
    (f) => f.rel,
  );
  assert.deepEqual(
    missing,
    [],
    `these open a camera with no recovery — call useCameraThatComesBack (lib/use-camera-that-comes-back.ts):\n  ${missing.join('\n  ')}`,
  );
});

test('every exemption still opens a camera (a stale line hides nothing)', () => {
  for (const rel of Object.keys(EXEMPT)) {
    assert.ok(
      CAMERAS.some((f) => f.rel === rel),
      `${rel} is exempt but no longer calls getUserMedia — drop its line`,
    );
  }
});

test('every Papic camera holds its reopen while a clip is recording', () => {
  const calls = SOURCES.flatMap((f) => {
    // Calls only — not the hook's own `function usePapicCamera({` signature.
    const out: Array<{ rel: string; args: string }> = [];
    for (const m of f.code.matchAll(/(?<!function\s)\busePapicCamera\(\{/g)) {
      const at = m.index ?? 0;
      out.push({ rel: f.rel, args: f.code.slice(at, f.code.indexOf('})', at)) });
    }
    return out;
  });
  assert.ok(calls.length >= 3, `only ${calls.length} usePapicCamera calls found — the walk is broken`);
  const unheld = calls.filter((c) => !/\bholdRestart\s*:/.test(c.args)).map((c) => c.rel);
  assert.deepEqual(unheld, [], `these Papic cameras could be reopened mid-clip:\n  ${unheld.join('\n  ')}`);
});
