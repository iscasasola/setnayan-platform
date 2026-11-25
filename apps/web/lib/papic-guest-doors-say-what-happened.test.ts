/**
 * PAPIC GUEST DOORS SAY WHAT HAPPENED (final check, area 4, fixer batch 2 · 25 Nov 2026).
 *
 * Each claim is one finding in `build-sessions/final-check/area-4.md` on the guest's Papic surfaces: a press that
 * did nothing, a failed read drawn as "none" or "not active", a hand-typed copy of a server number, or a popup on a
 * popup. `lib/papic-reads-are-honest.test.ts` and `lib/papic-page-says-only-what-is-true.test.ts` hold the older
 * claims; this file holds the ones the final check found.
 *
 * Red if:
 *   demo: a refused or failed shot is silent .................................. A4-57
 *   demo: the shot count is hand-typed (3) instead of DEMO_SHOT_CAP ........... A4-58
 *   guest camera: a refusal has no way back to the event's Hub ................ A4-60
 *   guest camera: unread earlier shots look like "none yet" ................... A4-61
 *   guest camera: "Add from your phone" opens over My shots ................... A4-63
 *   guest camera: the low line ignores the live soft_stop_pct ................. A4-65
 *   guest camera: an unread spent count shows the full allowance .............. A4-66
 *   guest camera: an unread block list hands out the camera ................... A4-67
 *   the camera's ✕ offline lands on offline.html although the Hub was saved ... A4-70
 *   join: a failed token read says "This link isn't active" ................... A4-71
 *   me: an unread gallery vanishes as if empty ................................ A4-74
 *   me: an unread guest makes "no tagged photos yet" .......................... A4-75
 *   order: an unread payment list still offers "Already sent it?" ............. A4-78
 *   pool: a failed event read is a 404 ........................................ A4-79
 *   pool: a failed "load more" makes the button vanish silently ............... A4-80
 *   seat: a failed read sends the claimer back to "Claim your seat" ........... A4-82
 *   claim: a dead seat token is greeted with "Start shooting" ................. A4-B03
 *   guest camera: a signed-in seat holder is told to open the invite link ..... A4-B11 (owner, Add 34)
 * (A4-54 — the claim page's `?state=error` is retryable — is held in papic-reads-are-honest.test.ts;
 *  A4-56 / A4-83 — no "Papic is unlimited" — in papic-page-says-only-what-is-true.test.ts.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('A4-57 · the demo says when a shot was refused or failed', () => {
  const src = code('app/papic/demo/[token]/_components/demo-join-flow.tsx');
  const take = src.slice(src.indexOf('const takeShot = useCallback'), src.indexOf('}, [otherRole, remaining, role, send, shooting, token]);'));
  assert.match(take, /if \(gate\.reason === 'cap'\) setRemaining\(0\);\s*else setShotNote\(/, 'an ended demo says so');
  assert.match(take, /\} catch \{\s*setShotNote\(/, 'a thrown shot says so');
  assert.match(src, /\{shotNote && \(/, 'the note is drawn');
});

test('A4-58 · the demo counts from the server cap, never a typed 3', () => {
  const src = code('app/papic/demo/[token]/_components/demo-join-flow.tsx');
  assert.match(src, /useState\(shotCap\)/);
  assert.doesNotMatch(src, /useState\(3\)|the 3 demo credits/);
  assert.match(code('app/papic/demo/[token]/page.tsx'), /shotCap=\{DEMO_SHOT_CAP\}/);
});

test('A4-60 / A4-67 · every guest-camera refusal after the event read offers the Hub; a failed block read is not "allowed"', () => {
  const src = code('app/papic/guest/page.tsx');
  const after = src.slice(src.indexOf('const exitSlug = backSlug ?? ownHubSlug;'));
  assert.ok(after.length > 0, 'exitSlug is resolved');
  assert.doesNotMatch(after, /\{backSlug \? \(\s*<Link href=\{`\/\$\{backSlug\}`\}/, 'a refusal still links only when ?from= was given');
  assert.match(src, /\{ data: blockRow, error: blockErr \}/);
  assert.match(src, /if \(blockErr \|\| blockRow\) \{/, 'a failed block read closes the door too');
  assert.match(src, /title=\{blockErr \? 'We couldn’t check just now\.' : 'Camera unavailable\.'\}/, 'and says it could not check');
});

test('A4-61 / A4-63 / A4-65 / A4-66 · the guest camera: unread shots, one popup, the live low line, an unread count', () => {
  const cap = code('app/papic/guest/_components/papic-guest-capture.tsx');
  assert.match(cap, /earlierUnread=\{myShotsUnread\}/);
  assert.match(code('app/papic/guest/_components/my-shots-sheet.tsx'), /Couldn’t read your earlier shots/);
  assert.match(code('app/papic/guest/page.tsx'), /myShotsUnread=\{ownShots === null\}/);

  const openPhone = cap.slice(cap.indexOf('const openPhone = useCallback'), cap.indexOf('const openPhone = useCallback') + 120);
  assert.match(openPhone, /setShotsOpen\(false\);\s*setPhoneOpen\(true\);/, 'Add from your phone replaces My shots');

  assert.match(cap, /softStopPct \?\? DEFAULT_EVENT_POOL_CONFIG\.softStopPct/);
  assert.match(code('app/papic/guest/page.tsx'), /readPoolSoftStopPct\(admin\)/);
  assert.match(code('lib/papic-event-pool.ts'), /\.select\('soft_stop_pct'\)/);

  assert.match(cap, /countUnread \? 'Credits: couldn’t read'/);
  const quota = code('lib/papic-guest.ts');
  assert.match(quota, /countUnread = true;/);
  assert.match(quota, /remaining,\s*countUnread,/);
});

test('A4-70 · offline, the camera ✕ finds the saved Hub whatever its query', () => {
  const sw = readFileSync(join(WEB, 'public/sw.js'), 'utf8');
  assert.match(sw, /caches\s*\.open\(DAYOF_CACHE\)\s*\.then\(\(cache\) => cache\.match\(request, \{ ignoreSearch: true \}\)\)/);
});

test('A4-71 · /papic/join tells a failed read apart from a dead link', () => {
  const src = code('app/papic/join/[token]/page.tsx');
  assert.match(src, /if \(error\) return 'unreadable';/);
  assert.doesNotMatch(src, /catch \{\s*return false;\s*\}/, 'a thrown read is not "no such token"');
  assert.match(src, /kind === 'unreadable'/);
});

test('A4-74 / A4-75 · /papic/me says when the photos could not be read', () => {
  const page = code('app/papic/me/[token]/page.tsx');
  assert.match(page, /if \(!gallery\) \{[\s\S]{0,600}Couldn’t read your photos/);
  const action = code('app/papic/me/[token]/actions.ts');
  assert.match(action, /if \(error\) \{[\s\S]{0,200}readFailed: true/);
  const maker = code('app/papic/me/[token]/_components/guest-story-maker.tsx');
  assert.equal((maker.match(/if \(freshPlan\.readFailed\)/g) ?? []).length, 2, 'both ways into the maker check it');
});

test('A4-78 · /papic/order holds the log form while its payment list is unread', () => {
  const src = code('app/papic/order/[token]/page.tsx');
  assert.match(src, /\{ data: payments, error: paymentsErr \}/);
  assert.match(src, /\{canLog && !paymentsUnread \? \(/);
  assert.match(src, /Couldn&rsquo;t read your logged payments/);
});

test('A4-79 / A4-80 · /papic/pool: a failed read is not a closed gallery, and "load more" never vanishes silently', () => {
  const page = code('app/papic/pool/page.tsx');
  assert.match(page, /if \(evErr\) throw/);
  assert.ok(page.indexOf('if (evErr) throw') < page.indexOf('if (!ev?.pool_gallery_open) notFound();'));
  const grid = code('app/papic/pool/_components/pool-grid.tsx');
  const load = grid.slice(grid.indexOf('function loadMore()'), grid.indexOf('if (tiles.length === 0 && initialUnreadable)'));
  assert.match(load, /\} catch \{\s*setNotice\(/, 'a thrown fetch says so');
  for (const m of load.matchAll(/setCursor\(null\);/g)) {
    const before = load.slice(Math.max(0, (m.index ?? 0) - 200), m.index);
    assert.match(before, /'unavailable'|'no_session'|nextCursor/, 'the button only goes for a real end');
  }
});

test('A4-82 · /papic/seat: a failed read goes to the retryable claim notice', () => {
  const src = code('app/papic/seat/[token]/page.tsx');
  assert.match(src, /if \(error\) redirect\(`\/papic\/claim\/\$\{token\}\?state=unreadable`\);/);
});

test('A4-B03 · /papic/claim: a dead token is said on arrival; a taken seat keeps its path', () => {
  const page = code('app/papic/claim/[token]/page.tsx');
  assert.match(page, /const arrival = state \? null : await seatClaimability\(token\);/);
  assert.match(page, /if \(state === 'invalid' \|\| arrival === 'invalid'\)/);
  assert.match(page, /\|\| arrival === 'unreadable';/);
  assert.doesNotMatch(page, /arrival === 'taken'/, 'a returning claimer is never shut out on arrival');
});

test('A4-B11 · the guest camera opens for a signed-in account’s own seat; everyone else still opens the invite link', () => {
  const page = code('app/papic/guest/page.tsx');
  const noSession = page.slice(page.indexOf('if (!session) {'), page.indexOf('const admin = createAdminClient();'));
  // Only the event the camera was opened from, and only a SEAT the signed-in account holds there (not a cookie, not a host).
  assert.match(noSession, /if \(backSlug\) \{/);
  assert.match(noSession, /\.eq\('slug', backSlug\)/);
  assert.match(noSession, /if \(fromEventErr\) throw/, 'a failed event read is not "open your invitation"');
  assert.match(noSession, /\(await readGuestViewerForEvent\(fromEventId\)\)\.kind === 'seat'/);
  assert.match(noSession, /<AdoptSeatSession eventId=\{fromEventId\} thenRefresh \/>/);
  // …and the invite-link door still stands for anyone else.
  const seatDoor = noSession.indexOf('Opening your camera…');
  const inviteDoor = noSession.indexOf('Open your invitation first.');
  assert.ok(seatDoor > -1 && inviteDoor > seatDoor, 'the invite-link door is gone or comes first');

  const adopt = code('app/[slug]/_components/adopt-seat-session.tsx');
  assert.match(adopt, /if \(held\) router\.refresh\(\);\s*else setFailed\(true\);/, 'a pass that was not written must say so, never wait for ever');
  assert.match(adopt, /We couldn’t open your camera just now/);
  const action = code('app/[slug]/actions.ts');
  const fn = action.slice(action.indexOf('export async function adoptSeatSessionAction('));
  assert.match(fn, /const seat = await findGuestSeatForUser\(eventId, user\.id\);\s*if \(!seat\) return false;/, 'only the account’s own seat is adopted');
});
