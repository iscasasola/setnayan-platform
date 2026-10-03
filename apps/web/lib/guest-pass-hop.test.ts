/**
 * A PERSONAL LINK ALWAYS OPENS THAT GUEST'S INVITATION — whatever the phone
 * already holds (owner's live iPhone test, 2026-10-02: on the host's own phone
 * `/cale-ice?invite=<token>` landed on the Event Hub's "Get inside", signed in
 * and signed out; the same link worked on another phone).
 *
 *   1 · the predicate: which requests write or clear the guest pass;
 *   2 · the service worker carries the SAME predicate (it cannot import it) and
 *       leaves those navigations to the browser — run here, not grepped;
 *   3 · the middleware never re-signs the old pass on those requests (or on a
 *       Server Action) — a second writer of the cookie the route is writing;
 *   4 · the redeem writes the link's pass UNCONDITIONALLY before it opens the
 *       landing — it never asks what the phone held first.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { isGuestPassHop, mayRefreshGuestPass } from './guest-pass-hop';

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));

/** [path+query, is a pass hop] */
const TABLE: Array<[string, boolean]> = [
  ['/cale-ice?invite=S89G-ABC', true],
  ['/cale-ice?invite=%20', false],
  ['/cale-ice?invite=', false],
  ['/u/ice/cale-ice?invite=tok', true],
  ['/cale-ice/redeem?slug=cale-ice&token=tok', true],
  ['/cale-ice/seat/claim?t=1', true],
  ['/cale-ice/sign-out', true],
  ['/auth/sign-out', true],
  ['/papic/me/tok123/session', true],
  ['/cale-ice', false],
  ['/cale-ice?save=1', false],
  ['/cale-ice/invite/enter', false],
  ['/cale-ice/invite/reply', false],
  ['/cale-ice/find-my-table', false],
  ['/cale-ice/seat', false],
  ['/papic/me/tok123', false],
  ['/dashboard/ev-1', false],
  ['/', false],
];

test('1 · a personal link, its redeem, a claim, a hand-off and a sign-out are pass hops — nothing else is', () => {
  for (const [href, want] of TABLE) {
    const u = new URL(href, 'https://www.setnayan.com');
    assert.equal(isGuestPassHop(u.pathname, u.search), want, href);
    assert.equal(isGuestPassHop(u.pathname, u.searchParams), want, `${href} (URLSearchParams)`);
  }
});

test('2 · the service worker runs the SAME predicate, and lets every pass hop go to the browser', () => {
  const sw = raw('public/sw.js');
  const src = /function isGuestPassHop\(url\) \{[\s\S]*?\n\}/.exec(sw)?.[0];
  assert.ok(src, 'public/sw.js lost isGuestPassHop');
  // eslint-disable-next-line no-new-func
  const swHop = new Function(`${src}; return isGuestPassHop;`)() as (u: URL) => boolean;
  for (const [href] of TABLE) {
    const u = new URL(href, 'https://www.setnayan.com');
    assert.equal(swHop(u), isGuestPassHop(u.pathname, u.search), `sw.js and lib/guest-pass-hop.ts disagree on ${href}`);
  }
  // …and asks it BEFORE the day-of handler can take the navigation.
  const body = stripComments(sw);
  const fetchAt = body.indexOf("self.addEventListener('fetch'");
  const hop = body.indexOf('if (isNavigation && isGuestPassHop(url)) return;', fetchAt);
  const dayOf = body.indexOf('if (isNavigation && isDayOfGuestNavigation(url))', fetchAt);
  assert.ok(hop > fetchAt, 'the fetch handler never asks isGuestPassHop');
  assert.ok(hop < dayOf, 'the day-of handler takes a pass hop before it is let go');
});

test('3 · the middleware slides the pass only on a plain read that is not a pass hop', () => {
  assert.equal(mayRefreshGuestPass('GET', '/cale-ice', ''), true);
  assert.equal(mayRefreshGuestPass('HEAD', '/cale-ice/hub', ''), true);
  assert.equal(mayRefreshGuestPass('GET', '/cale-ice', '?invite=tok'), false, 'the old pass is re-signed onto the personal link');
  assert.equal(mayRefreshGuestPass('GET', '/cale-ice/redeem', '?slug=cale-ice&token=tok'), false, 'two writers on the redeem');
  assert.equal(mayRefreshGuestPass('GET', '/auth/sign-out', ''), false, 'the old pass is re-signed over a sign-out');
  assert.equal(mayRefreshGuestPass('POST', '/cale-ice', ''), false, 'a Server Action that writes the pass races a refresh');
  const mw = read('middleware.ts');
  const fn = mw.slice(mw.indexOf('async function refreshGuestSessionCookie('));
  const gate = fn.indexOf('if (!mayRefreshGuestPass(request.method, request.nextUrl.pathname, request.nextUrl.search)) return;');
  assert.ok(gate > -1, 'the refresh no longer asks mayRefreshGuestPass');
  assert.ok(gate < fn.indexOf('signGuestSession('), 'the pass is re-signed before the hop is checked');
});

test('4 · the redeem writes the link\'s pass unconditionally, then opens that guest\'s landing', () => {
  const route = read('app/[slug]/redeem/route.ts');
  assert.doesNotMatch(route, /readGuestSession\(|readGuestSessionForEvent\(/, 'the redeem consults the pass the phone already held');
  const set = route.indexOf('await setGuestSession({');
  const land = route.lastIndexOf('return NextResponse.redirect(new URL(inviteEnterPath(event.slug), url.origin));');
  assert.ok(set > -1 && land > set, 'the landing opens before the link\'s pass is written');
  // The page hands EVERY tokened URL to the redeem before it reads anything else.
  const page = read('app/[slug]/page.tsx');
  const body = page.slice(page.indexOf('export default async function PublicInvitationPage('));
  const hand = body.indexOf('if (invite) {');
  assert.ok(hand > -1 && hand < body.indexOf('loadEventShell('), 'the page reads the event (or a session) before handing the link to redeem');
});
