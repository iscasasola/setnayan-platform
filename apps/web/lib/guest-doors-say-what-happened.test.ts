/**
 * GUEST DOORS SAY WHAT HAPPENED (final check, area 4, fixer batch 3 · 25 Nov 2026).
 *
 * The doors a guest, a crew member or a venue screen reaches by link — /claim, /join, /live, /wall, /panood/cam,
 * /samahan/join, /join/crew. Each claim is one finding in `build-sessions/final-check/area-4.md`.
 *
 * Red if:
 *   claim: a failed read says "This link isn't active" ................................ A4-03
 *   claim: the godparent move is unchecked and the claim reports plain success ........ A4-04
 *   join confirm: the email branch offers a REQUEST row as a seat ..................... A4-06
 *   /live, /wall: "the couple" on every event type .................................... A4-08 A4-16 A4-B06
 *   /live/screen: a refused ownership read goes dark as "locked" ...................... A4-09
 *   panood cam: our own error is the dead-link screen ................................. A4-10
 *   panood cam: the pill says "Connected" while the link failed ....................... A4-11
 *   samahan: a failed read says the link doesn't work; an unread count says 0 ......... A4-12 A4-13
 *   wall: a failed snapshot empties the wall; a failed session read asks for a code .. A4-15
 *   crew: a closed door has nothing to press .......................................... A4-B02
 *   panood cam: a dead token is greeted as an invitation .............................. A4-B03
 *   wall: a non-uuid address gets the code form and a "hiccup" ........................ A4-B07
 *   set-password: "Skip for now" lands a guest on the host's 404 ...................... A4-B09
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { cameraPill } from '@/lib/panood-signal-status';
import { emailMayBindRow } from '@/lib/guest-requests';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('A4-03 · /claim: a failed read is "we couldn’t check", in the page and the action', () => {
  const page = code('app/claim/[token]/page.tsx');
  assert.match(page, /\{ data: row, error: rowErr \}/);
  assert.match(page, /if \(rowErr \|\| search\.error === 'unreadable'\)/);
  assert.ok(page.indexOf("search.error === 'unreadable'") < page.indexOf("search.error === 'invalid'"), 'answered before the dead link');
  assert.match(code('app/claim/[token]/actions.ts'), /if \(rowErr\) redirect\(`\/claim\/\$\{token\}\?error=unreadable`\);/);
});

test('A4-04 · /claim: the godparent move is checked, retried once, and a failure is told', () => {
  const actions = code('app/claim/[token]/actions.ts');
  assert.match(actions, /let \{ error: godparentsErr \} = await moveGodparents\(\);/);
  assert.match(actions, /if \(godparentsErr\) \(\{ error: godparentsErr \} = await moveGodparents\(\)\);/);
  assert.match(actions, /error=godparents_pending/);
  assert.match(code('app/claim/[token]/page.tsx'), /search\.error === 'godparents_pending'/);
});

test('A4-06 · only a row the couple put on the list may be bound by email — on the confirm page too', () => {
  assert.equal(emailMayBindRow('host_seeded'), true);
  assert.equal(emailMayBindRow('self_added_unlisted'), false);
  assert.equal(emailMayBindRow(null), false);
  const lib = code('lib/event-account-link.ts');
  const emailBranch = lib.slice(lib.indexOf(".ilike('email', userEmail)"), lib.indexOf("return await shape(row, 'email');"));
  assert.match(emailBranch, /if \(!emailMayBindRow\(/, 'findSeatToConnect binds a request row by email');
  assert.match(lib, /\.select\(`\$\{COLUMNS\}, entry_source`\)/);
});

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

test('A4-B02 · every closed crew door offers one way on', () => {
  const screens = code('app/join/crew/[token]/_components/crew-screens.tsx');
  assert.match(screens, /\{children \?\? \(waiting \? null : <ActionButton/);
  const page = code('app/join/crew/[token]/page.tsx');
  assert.equal((page.match(/<CrewTryAgain token=\{token\} \/>/g) ?? []).length, 2, 'both "couldn’t reach" doors offer Try again');
});

test('A4-B07 · a wall address that cannot be an event gets the quiet dead end, not the code form', () => {
  const page = code('app/wall/[eventId]/page.tsx');
  const guard = page.indexOf('[0-9a-f]{8}-[0-9a-f]{4}');
  assert.ok(guard > -1 && guard < page.indexOf('eventSkuActive('), 'the address is checked before anything is read');
});

test('A4-B09 · set-password falls back to the join door, never the host’s dashboard', () => {
  assert.match(code('app/join/[eventId]/set-password/page.tsx'), /safeNext\(sp\.next, `\/join\/\$\{eventId\}`\)/);
  assert.doesNotMatch(code('app/join/[eventId]/set-password/actions.ts'), /`\/dashboard\/\$\{eventId\}`/);
});
