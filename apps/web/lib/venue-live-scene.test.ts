/**
 * venue-live-scene.test — the room you are standing in keeps up, honestly.
 * Owner 2026-09-06: "seating can always change in the last minute and even
 * during the event." Pins: a hidden tab never polls; identical answers are not
 * news; a moved seat is; a re-tint is not; `{published:false}` is "taken down"
 * and a failed call is nothing at all. Plus the wiring: the loader asks with
 * the page's own slug + token, and the page hands them over.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { LIVE_SCENE_POLL_MS, sceneSignature, sceneWasTakenDown, shouldPollScene } from './venue-live-scene';

const ROOT = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

test('a hidden tab never polls; a visible one does; a minute is the cadence', () => {
  assert.equal(shouldPollScene('visible'), true);
  assert.equal(shouldPollScene('hidden'), false);
  assert.equal(shouldPollScene(undefined), false);
  assert.equal(LIVE_SCENE_POLL_MS, 60_000);
});

test('news is a seat that moved — not a palette that changed', () => {
  const base = { tables: [{ id: 'T1', xPct: 50 }], occupancy: [{ table: 'T1', seats: [0, 1] }], booths: [], you: null, palette: { a: 1 } };
  assert.equal(sceneSignature(base), sceneSignature({ ...base }), 'identical answer, one signature');
  assert.equal(sceneSignature(base), sceneSignature({ ...base, palette: { a: 2 } }), 'a re-tint is not news');
  assert.notEqual(sceneSignature(base), sceneSignature({ ...base, occupancy: [{ table: 'T1', seats: [0, 1, 2] }] }), 'a new occupant is');
  assert.notEqual(sceneSignature(base), sceneSignature({ ...base, tables: [{ id: 'T1', xPct: 60 }] }), 'a moved table is');
  assert.notEqual(sceneSignature(base), sceneSignature({ ...base, you: { table: 'T2', seatNumber: 3 } }), 'your own seat moving is');
});

test('"taken down" is the RPC\'s published:false — a failed call is not', () => {
  assert.equal(sceneWasTakenDown({ published: false }), true);
  assert.equal(sceneWasTakenDown({ published: true, tables: [] }), false);
  assert.equal(sceneWasTakenDown(null), false);
  assert.equal(sceneWasTakenDown(undefined), false);
});

test('the hook asks the SAME RPC with the page\'s slug + token, keeps the last scene on error, swaps only on a new signature', () => {
  const src = read('app/[slug]/venue/_components/use-live-scene.ts');
  assert.match(src, /supabase\.rpc\('public_venue_scene', \{ p_slug: slug, p_token: token \}\)/);
  assert.match(src, /if \(cancelled \|\| error \|\| !data\) return;/, 'a failed call keeps the last scene');
  assert.match(src, /if \(sig !== sigRef\.current\) \{/, 'no re-mount on an identical answer');
  assert.match(src, /shouldPollScene\(document\.visibilityState\)/, 'hidden tabs are not polled');
  assert.match(src, /setInterval\(ask, LIVE_SCENE_POLL_MS\)/);
  assert.match(src, /addEventListener\('visibilitychange'/, 'coming back to the tab asks at once');
  assert.doesNotMatch(src, /postgres_changes/, 'no RLS-blind subscription that would render as "no changes"');
});

test('the loader wires it and the page hands over slug + token', () => {
  const loader = read('app/[slug]/venue/_components/guest-venue-loader.tsx');
  assert.match(loader, /useLiveScene\(initialScene, \{/);
  assert.match(loader, /enabled: Boolean\(slug\)/, 'no slug → the one-shot room, exactly as before');
  assert.match(loader, /<GuestVenue3D scene=\{scene\} eventId=\{eventId\} \/>/, 'the LIVE scene reaches the walk');
  assert.match(loader, /taken the room down/);
  const page = read('app/[slug]/venue/page.tsx');
  assert.match(page, /<GuestVenueLoader scene=\{scene\} eventId=\{eventId\} slug=\{slug\} token=\{token\} \/>/);
});
