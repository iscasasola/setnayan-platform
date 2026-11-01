/**
 * 🙈 "WRITE A COLUMN" AND CAMERA BRIDGE ARE NEVER DRAWN IN THE APP — CAMERAS AND EVENT HUB RECAP — WHATEVER THE ENV SAYS.
 *
 * ⚖ Owner 2026-10-31, DECISION_LOG "SEVEN OWNER ANSWERS" (6): *"hide this for now. it will not be present until we
 * say so. but it is hidden in our app."* The code is kept (`lib/hidden-guest-extras.ts` says how to bring
 * each back); this guard holds the three things that make "hidden" true:
 *
 *   1. both constants are `false` (this assertion is MEANT to fail the day the owner says "show it" — change it to
 *      the new ruling then, never delete the mount checks below);
 *   2. each mount asks its constant BEFORE any env flag / query string / DPO switch — so no flag can draw it: the
 *      guest camera's `CameraColumn`, the Event Hub Recap's `GuestColumnCard` (site-body), the seat camera's bridge;
 *   3. nothing anywhere under `app/` mounts either component around its constant.
 *
 * Read as source, comments stripped: the pages are server components behind a session and an RLS claim, so the gate
 * is pinned where it sits. Each check prints what it counted.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { CAMERA_BRIDGE_SHOWN_ON_CAMERA, WRITE_A_COLUMN_SHOWN_IN_APP } from './hidden-guest-extras';

const WEB = process.cwd();
const GUEST_CAMERA = 'app/papic/guest/page.tsx';
const SEAT_CAMERA = 'app/papic/seat/[token]/page.tsx';
const HUB_BODY = 'app/[slug]/_components/site-body.tsx';
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const abs = join(dir, name);
    if (statSync(abs).isDirectory()) return walk(abs);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [abs] : [];
  });
}
const appSources = () =>
  walk(join(WEB, 'app')).map((abs) => ({ file: relative(WEB, abs).split('\\').join('/'), code: stripComments(readFileSync(abs, 'utf8')) }));

test('both extras are hidden: their constants are false (owner 31 Oct, "hide this for now")', () => {
  assert.equal(WRITE_A_COLUMN_SHOWN_IN_APP, false, '"Write a column" was switched back on without a recorded owner ruling');
  assert.equal(CAMERA_BRIDGE_SHOWN_ON_CAMERA, false, 'Camera Bridge was switched back on without a recorded owner ruling');
});

test('the guest camera: CameraColumn asks the constant FIRST, before the column env gate', () => {
  const cam = code(GUEST_CAMERA);
  assert.match(cam, /import \{ WRITE_A_COLUMN_SHOWN_IN_APP \} from '@\/lib\/hidden-guest-extras';/);
  const at = cam.indexOf('async function CameraColumn');
  assert.ok(at > 0, 'precondition: the CameraColumn helper');
  const helper = cam.slice(at, cam.indexOf('\n}\n', at));
  const hidden = helper.indexOf('if (!WRITE_A_COLUMN_SHOWN_IN_APP) return null;');
  const envGate = helper.indexOf('guestColumnsActive()');
  const mount = helper.indexOf('<GuestColumnCard');
  console.log(`  CameraColumn: hidden-check @${hidden} · env gate @${envGate} · mount @${mount}`);
  assert.ok(hidden > 0, 'CameraColumn no longer asks WRITE_A_COLUMN_SHOWN_IN_APP');
  assert.ok(envGate > hidden && mount > hidden, 'the env gate (or the card) is reached before the hidden check');
  // The constant is the helper's FIRST statement after its signature — nothing runs before it.
  const bodyStart = helper.indexOf('}) {') + 4;
  assert.equal(helper.slice(bodyStart, hidden).trim(), '', 'something runs in CameraColumn before the hidden check');
});

test('the seat camera: the bridge switch is the constant AND-ed in FRONT of ?bridge=demo and the env flag', () => {
  const seat = code(SEAT_CAMERA);
  assert.match(seat, /import \{ CAMERA_BRIDGE_SHOWN_ON_CAMERA \} from '@\/lib\/hidden-guest-extras';/);
  assert.match(
    seat,
    /const bridgeEnabled =\s*CAMERA_BRIDGE_SHOWN_ON_CAMERA &&\s*\(bridge === 'demo' \|\| envFlagEnabled\(process\.env\.NEXT_PUBLIC_CAMERA_BRIDGE_ENABLED\)\);/,
    'bridgeEnabled can be true without CAMERA_BRIDGE_SHOWN_ON_CAMERA',
  );
  const mounts = seat.match(/<CameraBridgePanel\b/g) ?? [];
  const gated = seat.match(/\{bridgeEnabled \? \(\s*<CameraBridgePanel\b/g) ?? [];
  console.log(`  seat page: ${mounts.length} CameraBridgePanel mount(s), ${gated.length} behind bridgeEnabled`);
  assert.equal(mounts.length, 1, 'the seat page mounts Camera Bridge more (or less) than once');
  assert.equal(gated.length, 1, 'the seat page mounts Camera Bridge outside `bridgeEnabled`');
});

test('the Event Hub Recap: its one "Write a column" mount sits inside the constant, before the card’s env gate', () => {
  const body = code(HUB_BODY);
  assert.match(body, /import \{ WRITE_A_COLUMN_SHOWN_IN_APP \} from '@\/lib\/hidden-guest-extras';/);
  const mounts = body.match(/<GuestColumnCard\b/g) ?? [];
  const gated = body.match(/\{WRITE_A_COLUMN_SHOWN_IN_APP \? \(\s*<GuestColumnCard\b/g) ?? [];
  console.log(`  site-body: ${mounts.length} GuestColumnCard mount(s), ${gated.length} behind WRITE_A_COLUMN_SHOWN_IN_APP`);
  assert.equal(mounts.length, 1, 'the Event Hub mounts "Write a column" more (or less) than once');
  assert.equal(gated.length, 1, 'the Event Hub Recap mounts "Write a column" outside WRITE_A_COLUMN_SHOWN_IN_APP');
  // …and the gated mount is still the Recap's (the slot `each-card-renders-in-its-own-tab.test.ts` pins).
  const at = body.indexOf('{WRITE_A_COLUMN_SHOWN_IN_APP ? (');
  const opener = body.lastIndexOf('), recapBody ? (<>', at);
  assert.ok(opener > 0 && at - opener < 2000, 'the gated column card left the Recap slot');
});

test('nothing else anywhere under app/ mounts either extra around its constant', () => {
  const files = appSources();
  const column = files.filter((f) => /<GuestColumnCard\b/.test(f.code) && !f.file.endsWith('/guest-column-card.tsx')).map((f) => f.file);
  const bridge = files.filter((f) => /<CameraBridgePanel\b/.test(f.code) && !f.file.endsWith('/camera-bridge-panel.tsx')).map((f) => f.file);
  console.log(`  GuestColumnCard under app/: ${column.join(' · ') || 'none'} · CameraBridgePanel: ${bridge.join(' · ') || 'none'}`);
  assert.deepEqual(column.sort(), [GUEST_CAMERA, HUB_BODY].sort(), 'a file other than the guest camera and the Event Hub Recap mounts "Write a column"');
  assert.deepEqual(bridge, [SEAT_CAMERA], 'a file other than the seat camera mounts Camera Bridge');
  // The guest camera's one card mount lives inside the gated helper.
  const cam = code(GUEST_CAMERA);
  assert.equal((cam.match(/<GuestColumnCard\b/g) ?? []).length, 1);
  assert.ok(cam.indexOf('<GuestColumnCard') > cam.indexOf('if (!WRITE_A_COLUMN_SHOWN_IN_APP) return null;'), 'the card is mounted outside CameraColumn');
});
