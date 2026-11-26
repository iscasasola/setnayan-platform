/**
 * A SEAT HOLDER OPENS ITS OWN PASS (owner ruling, final check Add 34 · A4-B11, 25 Nov 2026).
 *
 * "A signed-in account that holds the seat sees its own table and pass on /find-my-table, /seat, the pass-card and QR
 * routes … the same way /find-seat and ?tab=me already read the account. Only the seat tied to that account: everyone
 * else still needs the invite link."
 *
 * Red if:
 *   /find-my-table or /seat asks only the invite-link cookie ............................. A4-B11
 *   a signed-in account with NO seat here is treated as a guest .......................... A4-B11
 *   an account holding ANOTHER event's seat (or another guest's) gets a pass here ......... A4-B11
 *   the QR / pass-card routes ignore ?event=, or take it without a uuid check ............ A4-B11
 *   the Hub's ticket card does not name its event on the two routes ...................... A4-B11
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { resolveGuestViewer } from '@/lib/guest-one-path';
import { decidePassCardAccess, passRouteForEvent } from '@/lib/pass-card';

const WEB = join(__dirname, '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const EVENT = '11111111-1111-4111-8111-111111111111';
const OTHER_EVENT = '22222222-2222-4222-8222-222222222222';

test('the account’s own seat on THIS event opens the pass; the cookie still wins', () => {
  const viewer = resolveGuestViewer({ eventId: EVENT, cookie: null, seat: { guestId: 'g-own', qrToken: 'a'.repeat(32) } });
  assert.equal(viewer.kind, 'seat');
  assert.equal(viewer.kind === 'seat' ? viewer.session.guest_id : null, 'g-own');
  const cookie = { guest_id: 'g-cookie', event_id: EVENT, qr_token: 'b'.repeat(32) };
  const both = resolveGuestViewer({ eventId: EVENT, cookie, seat: { guestId: 'g-own', qrToken: 'a'.repeat(32) } });
  assert.equal(both.kind === 'cookie' ? both.session.guest_id : null, 'g-cookie');
});

test('a signed-in account with NO seat here still gets the invite-link message', () => {
  // `findGuestSeatForUser` answers null for an account with no guest seat on this event (or a seat on another event:
  // it is asked with THIS event's id) — the viewer is anonymous, the session null, and each door says so.
  assert.equal(resolveGuestViewer({ eventId: EVENT, cookie: null, seat: null }).kind, 'anonymous');
  // A browser holding only ANOTHER event's invite cookie is not a guest here either.
  const elsewhere = { guest_id: 'g-x', event_id: OTHER_EVENT, qr_token: 'c'.repeat(32) };
  assert.equal(resolveGuestViewer({ eventId: EVENT, cookie: elsewhere, seat: null }).kind, 'anonymous');

  for (const [rel, words] of [
    ['app/[slug]/find-my-table/page.tsx', 'Find your table is part of your personal invitation.'],
    ['app/[slug]/seat/page.tsx', 'Your seat pass is part of your personal invitation.'],
  ] as const) {
    const src = code(rel);
    assert.match(src, /const session = await readGuestSessionForEvent\(event\.event_id\);/, `${rel} asks only the cookie`);
    assert.doesNotMatch(src, /\breadGuestSession\(/, `${rel} still reads the cookie alone somewhere`);
    const at = src.indexOf('const session = await readGuestSessionForEvent(event.event_id);');
    const gate = src.slice(at, at + 700);
    assert.match(gate, /if \(!session \|\| session\.event_id !== event\.event_id\) \{/, `${rel}: no session no longer refuses`);
    assert.ok(gate.includes('Open this from your invitation') && gate.includes(words), `${rel}: the invite-link message moved`);
  }
});

test('an account holding ANOTHER guest’s seat never gets this guest’s card', () => {
  const session = { guest_id: 'g-own', event_id: EVENT };
  const someoneElse = { guest_id: 'g-other', event_id: EVENT, rsvp_status: 'attending', entry_source: 'host_seeded' };
  assert.equal(decidePassCardAccess({ session, isHost: false, target: someoneElse, bringer: null, readFailed: false }).allow, false);
  // …nor its own seat's card on another event.
  const ownElsewhere = { guest_id: 'g-own', event_id: OTHER_EVENT, rsvp_status: 'attending', entry_source: 'host_seeded' };
  assert.equal(decidePassCardAccess({ session, isHost: false, target: ownElsewhere, bringer: null, readFailed: false }).allow, false);
  // With no seat and no cookie, the route says the invite-link line.
  const none = decidePassCardAccess({ session: null, isHost: false, target: someoneElse, bringer: null, readFailed: false });
  assert.deepEqual(none, { allow: false, status: 401, message: 'Open your invitation link first.' });
});

test('the QR and pass-card routes read ?event= through the one resolver; without it, the cookie alone', () => {
  for (const rel of ['app/api/guest/qr/route.ts', 'app/api/guest/pass-card/route.ts']) {
    const src = code(rel);
    assert.match(src, /readGuestSessionForPassRoute\([^;]{0,80}?searchParams\.get\('event'\)\)/, `${rel} ignores ?event=`);
    assert.doesNotMatch(src, /\breadGuestSession\(/, `${rel} reads the cookie alone`);
  }
  const lib = code('lib/guest-one-path.server.ts');
  const fn = lib.slice(lib.indexOf('export async function readGuestSessionForPassRoute('));
  assert.match(fn, /if \(eventParam && PASS_ROUTE_EVENT_ID\.test\(eventParam\)\) return readGuestSessionForEvent\(eventParam\);\s*return readGuestSession\(\);/);
  assert.match(lib, /const PASS_ROUTE_EVENT_ID = \/\^\[0-9a-f\]\{8\}-/);
});

test('the Hub’s ticket card names its event on both routes', () => {
  assert.equal(passRouteForEvent('/api/guest/qr', EVENT), `/api/guest/qr?event=${EVENT}`);
  assert.equal(passRouteForEvent('/api/guest/pass-card?guest=g1', EVENT), `/api/guest/pass-card?guest=g1&event=${EVENT}`);
  const page = code('app/[slug]/page.tsx');
  assert.match(page, /src=\{passRouteForEvent\(PASS_CARD_ROUTE, event\.event_id\)\}/);
  assert.match(page, /qrSrc=\{passRouteForEvent\(GUEST_QR_ROUTE, event\.event_id\)\}/);
  assert.match(page, /own: passRouteForEvent\(PASS_CARD_ROUTE, event\.event_id\),/);
  const ticket = code('app/[slug]/_components/guest-ticket.tsx');
  assert.match(ticket, /src=\{qrSrc\}/);
  assert.match(ticket, /qrHref=\{qrSrc\}/);
  assert.match(code('app/[slug]/_components/guest-code-keepers.tsx'), /href=\{qrHref\}/);
});
