/**
 * guest-one-path.test.ts — ONE path for an invited guest, in either order
 * (owner 2026-09-25: "Fillup your form. and sign up. or sign up then a form must
 * still be completed. The link process must be easy to understand").
 *
 * Five properties, each a thing the audit measured broken on `origin/main`
 * (`audits/GUEST_SIGNUP_FLOW_MAP_2026-09-25.md`):
 *
 *   1. ONE ACCOUNT PROMPT on a guest's page — it counted up to five.
 *   2. THE EMAIL IS ASKED ONCE — the reply sheet saved it and sent nothing, and a
 *      second box asked for it again.
 *   3. A SIGNED-IN GUEST ON A NEW DEVICE SEES THEIR OWN PAGE — they met the
 *      anonymous one, and a second event read as `wrong_event`.
 *   4. A SIGN-UP FROM AN EVENT RETURNS TO THE EVENT — it went to the You card
 *      and then `/`, depending on a 120-second clock.
 *   5. NO COUPLE WELCOME EMAIL FOR A GUEST — they were told "your couple account
 *      is ready… create your event".
 *
 * The decisions are pure and executed here; the source checks below pin that
 * the page, the actions and the doors actually ask them. Comments are stripped
 * before any source match so an explanation is never the finding.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  guestAccountState,
  hostPitchShows,
  replyOffersKeep,
  resolveGuestViewer,
  shouldSendKeepLink,
} from '@/lib/guest-one-path';
import {
  eventConnectPath,
  isEventConnectNext,
  isEventSignup,
  signupLanding,
  welcomeEmailKind,
} from '@/lib/signup-landing';

const HERE = dirname(fileURLToPath(import.meta.url)); // apps/web/lib
const WEB = resolve(HERE, '..');
const read = (rel: string) => stripComments(readFileSync(resolve(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) =>
  (src.match(new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g')) ?? [])
    .length;

const EVENT = 'e-1';
const cookieFor = (event_id: string) => ({ guest_id: 'g-cookie', event_id, qr_token: 'q-cookie' });
const seat = { guestId: 'g-seat', qrToken: 'q-seat' };

// ── 3 · a signed-in guest on a new device sees their own page ────────────────

test('3 · a signed-in seat-holder with NO cookie is recognised by their seat', () => {
  const v = resolveGuestViewer({ eventId: EVENT, cookie: null, seat });
  assert.equal(v.kind, 'seat');
  assert.deepEqual(v.kind === 'seat' && v.session, {
    guest_id: 'g-seat',
    event_id: EVENT,
    qr_token: 'q-seat',
  });
});

test('3 · a second event: the seat beats a cookie that names a DIFFERENT event', () => {
  const v = resolveGuestViewer({ eventId: EVENT, cookie: cookieFor('e-other'), seat });
  assert.equal(v.kind, 'seat', 'a guest invited to two events was a stranger at one of them');
});

test('3 · the cookie still wins when it names THIS event (a shared phone keeps its guest)', () => {
  const v = resolveGuestViewer({ eventId: EVENT, cookie: cookieFor(EVENT), seat });
  assert.equal(v.kind, 'cookie');
});

test('3 · nobody → anonymous; a foreign cookie with no seat is still `wrong_event`', () => {
  assert.deepEqual(resolveGuestViewer({ eventId: EVENT, cookie: null, seat: null }), {
    kind: 'anonymous',
    reason: null,
  });
  assert.deepEqual(
    resolveGuestViewer({ eventId: EVENT, cookie: cookieFor('e-other'), seat: null }),
    { kind: 'anonymous', reason: 'wrong_event' },
  );
});

test('3 · the page renders the guest tree from the RESOLVED viewer, not the cookie alone', () => {
  const page = read('app/[slug]/page.tsx');
  assert.match(page, /resolveGuestViewer\(\{/, 'the page no longer asks who the guest is');
  assert.match(page, /seat: viewerSeat/, 'the signed-in seat is not handed to the resolver');
  assert.doesNotMatch(
    page,
    /if \(!session\) \{\s*return renderAnonymous/,
    'the cookie-only gate is back — a signed-in guest on a new phone meets the anonymous page',
  );
  assert.match(page, /loadGuestContext\(\s*admin,\s*event,\s*guestSession,/);
  // …and the Save on that page accepts the same viewer, or the form bounces.
  const actions = read('app/[slug]/actions.ts');
  const submit = actions.slice(actions.indexOf('export async function submitRsvp'));
  assert.match(
    submit.slice(0, 900),
    /readGuestSessionForEvent\(eventId\)/,
    'submitRsvp only honours the cookie — the new-device guest sees a form whose Save bounces',
  );
  // The seat's pass is adopted on MOUNT, from a Server Action — never a render or a GET.
  assert.match(page, /<AdoptSeatSession eventId=\{event\.event_id\} \/>/);
  const adopt = read('app/[slug]/_components/adopt-seat-session.tsx');
  assert.match(adopt, /useEffect\(/);
  assert.match(adopt, /adoptSeatSessionAction\(eventId\)/);
});

// ── 1 · one account prompt ───────────────────────────────────────────────────

test('1 · the account state names exactly one prompt for every viewer', () => {
  const s = (o: Partial<Parameters<typeof guestAccountState>[0]>) =>
    guestAccountState({
      viewerUserId: null,
      viewerEmail: null,
      seatHolderUserId: null,
      linkSentForThisEvent: false,
      ...o,
    }).kind;
  assert.equal(s({}), 'offer');
  assert.equal(s({ linkSentForThisEvent: true }), 'link_sent');
  assert.equal(s({ seatHolderUserId: 'u-1' }), 'sign_in');
  assert.equal(s({ viewerUserId: 'u-1' }), 'link_this_seat');
  assert.equal(s({ viewerUserId: 'u-1', seatHolderUserId: 'u-1' }), 'linked');
  assert.equal(s({ viewerUserId: 'u-1', seatHolderUserId: 'u-2' }), 'held_elsewhere');
});

test('1 · the host pitch shows only AFTER linking', () => {
  for (const kind of ['offer', 'link_sent', 'sign_in', 'link_this_seat', 'held_elsewhere'] as const) {
    assert.equal(hostPitchShows({ kind } as never), false, `${kind} shows the host pitch`);
  }
  assert.equal(hostPitchShows({ kind: 'linked', accountEmail: 'a@b.co' }), true);
});

test('1 · the guest page mounts ONE account prompt, and the old four are gone', () => {
  const body = read('app/[slug]/_components/site-body.tsx');
  assert.equal(count(body, /<GuestAccountCard\b/), 1, 'the one card is not mounted exactly once');
  assert.doesNotMatch(body, /claimAccountAction/, 'the second email box is back in the guest tree');
  assert.doesNotMatch(body, /Keep this event for good/, 'the "Keep this event for good" note is back');
  assert.doesNotMatch(body, /the box near the top/, 'a note points at a box again');
  const bar = read('app/[slug]/_components/guest-hub-bar.tsx');
  assert.doesNotMatch(bar, /href="#claim-account"/, 'the "Link to account" chip is back');
  const gallery = read('app/[slug]/_components/photos-of-you-gallery.tsx');
  assert.doesNotMatch(gallery, /the box near the top/);
  // The host pitch is gated on linking at BOTH of its mounts.
  const widget = read('app/[slug]/_components/rsvp-widget.tsx');
  assert.match(widget, /onDoor \|\| !hostPitch \? null : words\.solemn \? null : \(\s*<GuestToHostCta/);
  const photos = read('app/[slug]/_components/your-photos-widget.tsx');
  assert.match(photos, /\{hostPitch \? \(\s*<GuestToHostCta/);
  assert.match(body, /hostPitch=\{account \? hostPitchShows\(account\) : false\}/);
});

// ── 2 · the email is asked once ──────────────────────────────────────────────

test('2 · the keep-link goes only with an address AND an affirmative tick', () => {
  const base = { email: 'guest@example.com', termsAgreed: true, signedIn: false, seatHeld: false, alreadySent: false };
  assert.equal(shouldSendKeepLink(base), true);
  assert.equal(shouldSendKeepLink({ ...base, termsAgreed: false }), false, 'an unticked Save created an account');
  assert.equal(shouldSendKeepLink({ ...base, email: '' }), false);
  assert.equal(shouldSendKeepLink({ ...base, email: 'not-an-address' }), false);
  assert.equal(shouldSendKeepLink({ ...base, signedIn: true }), false);
  assert.equal(shouldSendKeepLink({ ...base, seatHeld: true }), false);
  assert.equal(shouldSendKeepLink({ ...base, alreadySent: true }), false, 'a second Save sent a second email');
  assert.equal(replyOffersKeep({ kind: 'offer' }), true);
  assert.equal(replyOffersKeep({ kind: 'link_sent' }), false);
});

test('2 · the ONE account card asks for no address — the reply holds it', () => {
  const card = read('app/[slug]/_components/guest-account-card.tsx');
  assert.equal(count(card, /type="email"/), 0, 'the card asks for the email a second time');
  assert.equal(count(card, /name="email"/), 0);
  assert.match(card, /href="#your-details"/, 'with no address on file the card must open the reply');
  const actions = read('app/[slug]/actions.ts');
  const claim = actions.slice(actions.indexOf('export async function claimAccountAction'));
  const claimBody = claim.slice(0, claim.indexOf('\n}\n'));
  assert.doesNotMatch(claimBody, /formData\.get\('email'\)/, 'the card action reads a posted address again');
  assert.match(claimBody, /\.select\('email'\)/, 'the card no longer uses the address the reply holds');
});

test('2 · BOTH reply surfaces send the link from the one Save (submitRsvp)', () => {
  const actions = read('app/[slug]/actions.ts');
  const submit = actions.slice(actions.indexOf('export async function submitRsvp'));
  const body = submit.slice(0, submit.indexOf('\nexport async function '));
  assert.equal(count(body, /await sendKeepLinkOnce\(\{/), 1, 'the reply Save does not send the link');
  // After the write, before the redirect.
  const write = body.indexOf(".from('guests')\n    .update(");
  assert.ok(write > -1, 'the reply write moved — re-point this guard');
  assert.ok(body.indexOf('await sendKeepLinkOnce(') > write, 'the link is sent before the reply is written');
  assert.ok(body.indexOf('await sendKeepLinkOnce(') < body.lastIndexOf('redirect('));
  assert.match(body, /termsAgreed: hasAgreedToTerms\(formData\.get\(TERMS_FIELD\)\)/);
  // The Reply door no longer sends its own copy.
  const door = read('app/[slug]/invite/actions.ts');
  assert.doesNotMatch(door, /sendEventAccountMagicLink|sendKeepLinkOnce/, 'the door sends a second link');
  // The keep box is a real, UNTICKED checkbox — never a hidden consent.
  const widget = read('app/[slug]/_components/rsvp-widget.tsx');
  const tag = widget.match(/<input\s+id="keep_invitation"[^>]*>/)?.[0] ?? '';
  assert.match(tag, /type="checkbox"/);
  assert.match(tag, /name=\{TERMS_FIELD\}/);
  assert.doesNotMatch(tag, /\b(defaultChecked|checked)\b/, 'the keep box arrives pre-ticked');
});

// ── 4 · a sign-up from an event returns to the event ─────────────────────────

test('4 · every door from an event returns through the connect route', () => {
  assert.equal(eventConnectPath('abc'), '/join/abc/connect');
  assert.equal(isEventConnectNext('/join/abc/connect'), true);
  assert.equal(isEventConnectNext('/join/abc/connect?then=reply'), true);
  assert.equal(isEventConnectNext('/join/abc/connect#x'), true);
  assert.equal(isEventConnectNext('/join/abc'), false);
  assert.equal(isEventConnectNext('/dashboard'), false);
  assert.equal(isEventConnectNext('/join/abc/connectx'), false);
  assert.equal(isEventConnectNext(null), false);
});

test('4 · an event sign-up skips the You card and lands on its `next`', () => {
  assert.equal(isEventSignup({ ref: 'guest', next: '/cale-ice/invite' }), true);
  assert.equal(isEventSignup({ ref: null, next: '/join/abc/connect' }), true);
  assert.equal(isEventSignup({ ref: null, next: '/' }), false);
  assert.equal(
    signupLanding({ accountType: 'customer', next: '/join/abc/connect', fromEvent: true }),
    '/join/abc/connect',
  );
  // A couple from the website still meets the You card.
  assert.match(signupLanding({ accountType: 'customer', next: '/' }), /^\/signup\/you/);
});

test('4 · the callback and signUp ask the event question, not the 120-second clock', () => {
  const callback = read('app/auth/callback/route.ts');
  assert.match(
    callback,
    /accountType === 'customer' &&\s*!isEventConnectNext\(fallbackNext\) &&\s*isBrandNewAccount\(/,
    'a guest from an invitation is sent to the You card again',
  );
  const signup = read('app/signup/actions.ts');
  assert.match(signup, /isEventSignup\(\{ ref: guestHostRef, next \}\)/);
  assert.match(signup, /signupLanding\(\{ accountType, next, fromEvent \}\)/);
  // The connect route lands an unanswered guest AT the reply.
  const connect = read('app/join/[eventId]/connect/route.ts');
  assert.match(connect, /dest = `\/\$\{slug\}\$\{REPLY_SHEET_HASH\}`/);
  // The card's Google / Apple return through the connect route.
  const card = read('app/[slug]/_components/guest-account-card.tsx');
  assert.match(card, /<OAuthButtonRow next=\{eventConnectPath\(eventId\)\} \/>/);
});

// ── 5 · no couple welcome email for a guest ──────────────────────────────────

test('5 · a guest from an invitation is sent no couple welcome email', () => {
  assert.equal(welcomeEmailKind({ accountType: 'customer', fromEvent: true }), null);
  assert.equal(welcomeEmailKind({ accountType: 'customer', fromEvent: false }), 'couple');
  assert.equal(welcomeEmailKind({ accountType: 'vendor', fromEvent: false }), 'vendor');
  const signup = read('app/signup/actions.ts');
  assert.match(
    signup,
    /welcomeEmailKind\(\{ accountType, fromEvent \}\) === null\s*\?\s*Promise\.resolve\(null\)\s*:\s*sendEmail\(\{/,
    'the welcome email is no longer gated on the event question',
  );
});
