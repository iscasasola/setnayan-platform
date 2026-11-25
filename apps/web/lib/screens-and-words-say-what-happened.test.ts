/**
 * SCREENS AND WORDS SAY WHAT HAPPENED (final check, area 4, batch a4-5-screens-and-words · 25 Nov 2026).
 *
 * Venue screens (Live Watch, the wall), the Live Watch camera, community join, and Papic's public words
 * (PLAN-area-4.md § Batch a4-5-screens-and-words). Each claim is one finding in `build-sessions/final-check/area-4.md`.
 *
 * Red if:
 *   /live/screen: a refused ownership read goes dark as "locked" ...................... A4-09
 *   wall: a failed snapshot empties the wall; a failed session read asks for a code .. A4-15
 *   panood cam: our own error is the dead-link screen ................................. A4-10
 *   panood cam: the pill says "Connected" while the link failed ....................... A4-11
 *   wall: a non-uuid address gets the code form and a "hiccup" ........................ A4-B07
 *   samahan: a failed read says the link doesn't work; an unread count says 0 ......... A4-12 A4-13
 *   /live, /wall: "the couple" on every event type .................................... A4-08 A4-16 A4-B06
 *   /wall: the tab shows the generic site title ....................................... A4-B06
 *   demo: the shot count is a typed second copy of DEMO_SHOT_CAP ...................... A4-58
 * (A4-56 / A4-83 — no "Papic is unlimited", no "the demo caps this, not Papic" — are held by
 *  lib/papic-page-says-only-what-is-true.test.ts, whose file list now covers the demo and /papic/try.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { cameraPill } from '@/lib/panood-signal-status';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('A4-08 / A4-16 / A4-B06 · venue-screen doors use the event’s own word, never "the couple"', () => {
  assert.doesNotMatch(code('app/live/page.tsx'), /the couple/i);
  assert.doesNotMatch(code('app/wall/[eventId]/_components/wall-claim.tsx'), /the couple/i);
  const wall = code('app/wall/[eventId]/page.tsx');
  assert.doesNotMatch(wall, /with the couple/);
  assert.match(wall, /eventWordsForEvent\(eventId\)/);
});

test('A4-09 · a paired TV keeps its picture on a refused ownership read', () => {
  const src = code('app/live/_lib/load-screen.ts');
  assert.match(src, /if \(!windowRead\.ok\) return \{ state: 'down' \};/);
  assert.match(code('lib/live-studio-window-server.ts'), /return \{ ok: false, decision: decideBroadcastWindow\(\{ owned: false \}\) \};/);
});

test('A4-10 / A4-B03 · /panood/cam: arrival is checked; our error is retryable', () => {
  const page = code('app/panood/cam/[token]/page.tsx');
  assert.match(page, /const arrival = state \? null : await cameraClaimability\(token\);/);
  assert.match(page, /if \(state === 'invalid' \|\| arrival === 'invalid'\)/);
  assert.doesNotMatch(page, /state === 'invalid' \|\| state === 'error'/, 'our own error is not the dead link');
  assert.match(page, /const checkFailed = state === 'error' \|\| arrival === 'unreadable';/);
  assert.match(code('lib/panood-camera-claimability.ts'), /return 'unreadable';/);
  assert.match(code('app/panood/actions.ts'), /if \(claimability === 'unreadable'\) redirect/);
});

test('A4-11 · the camera pill never claims more than the footer', () => {
  const base = { cameraState: 'live' as const, streamingEnabled: true };
  assert.deepEqual(cameraPill({ ...base, link: 'failed', signalRefused: false }), { label: 'Not connected', live: false });
  assert.deepEqual(cameraPill({ ...base, link: 'connected', signalRefused: true }), { label: 'Not connected', live: false });
  assert.deepEqual(cameraPill({ ...base, link: 'connecting', signalRefused: false }), { label: 'Connecting…', live: false });
  assert.deepEqual(cameraPill({ ...base, link: 'connected', signalRefused: false }), { label: 'Connected', live: true });
  assert.deepEqual(cameraPill({ cameraState: 'live', streamingEnabled: false, link: null, signalRefused: false }), { label: 'Connected', live: true });
  assert.equal(cameraPill({ cameraState: 'starting', streamingEnabled: true, link: null, signalRefused: false }).live, false);
  assert.match(code('app/panood/cam/[token]/_components/panood-camera-publish.tsx'), /\{pill\.label\}/);
});

test('A4-12 / A4-13 · /samahan/join: a failed read is "couldn’t check"; an unread count is left out', () => {
  const lib = code('lib/communities.ts');
  assert.match(lib, /if \(error\) return \{ status: 'unreadable' \};/);
  assert.match(lib, /if \(communityError\) return \{ status: 'unreadable' \};/);
  assert.match(lib, /member_count: countError \? null : \(count \?\? 0\),/);
  assert.match(code('app/samahan/join/[token]/page.tsx'), /invite\.member_count === null \? undefined/);
});

test('A4-15 · the wall freezes on a failed read; a failed session read is not "unclaimed"', () => {
  const lib = code('lib/live-wall.ts');
  assert.match(lib, /unreadable: Boolean\(feedError \|\| eventError\),/);
  assert.match(lib, /if \(error\) throw new Error\(`isWallSessionLive/);
  assert.match(code('app/api/wall/[eventId]/feed/route.ts'), /if \(snapshot\.unreadable\) \{[\s\S]{0,120}status: 503/);
});

test('A4-B07 · a wall address that cannot be an event gets the quiet dead end, not the code form', () => {
  const page = code('app/wall/[eventId]/page.tsx');
  const guard = page.indexOf('[0-9a-f]{8}-[0-9a-f]{4}');
  assert.ok(guard > -1 && guard < page.indexOf('eventSkuActive('), 'the address is checked before anything is read');
});

test('A4-B06 · /wall carries its own tab title and is never indexed', () => {
  const page = code('app/wall/[eventId]/page.tsx');
  assert.match(page, /export const metadata = \{ title: 'Live photo wall', robots: \{ index: false, follow: false \} \};/);
});

test('A4-58 · the demo counts from the server cap, never a typed 3', () => {
  const src = code('app/papic/demo/[token]/_components/demo-join-flow.tsx');
  assert.match(src, /useState\(shotCap\)/);
  assert.doesNotMatch(src, /useState\(3\)|the 3 demo credits/);
  assert.match(code('app/papic/demo/[token]/page.tsx'), /shotCap=\{DEMO_SHOT_CAP\}/);
});
