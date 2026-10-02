/**
 * THE JOIN DOOR: A KEY WALKS IN, EVERYONE ELSE ASKS.
 *
 * Two owner rules, pinned together because they live in the same two actions:
 *
 * 1 · THE SIGNED-IN GUEST WHO HOLDS A SEAT LANDS ON THE CELEBRATION (owner,
 *     2026-08-21). `/{slug}` decides "guest or stranger" from the guest-session
 *     cookie and nothing else, so a signed-in seat-holder is MINTED that cookie
 *     (`enterAsGuest`) before being sent anywhere — or they would arrive as a
 *     stranger on their own invitation.
 *
 * 2 · 🛂 NOBODY WITHOUT A KEY GETS INSIDE UNTIL THE COUPLE KEEPS OR LINKS THEM
 *     (owner, DECISION_LOG 2026-09-26 — reverses the 2026-06-25 optimistic
 *     admit). A person without a key who asks is a REQUEST: a guest row with
 *     their answers, NO `event_members` row (so the event is absent from their
 *     account) and NO guest session. A typed name never binds anybody — a name
 *     is not a secret.
 *
 * Behavioural proof of the schema half lives in
 * tests/db/a-request-is-not-a-membership.db.test.ts. This file pins the wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** Strip comments before matching — a docblock that NAMES the thing it forbids
 *  satisfies a raw search, which has fooled several guards in this repo. */
function code(src: string): string {
  return src
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}
const ACTIONS = code(readFileSync(join(__dirname, 'actions.ts'), 'utf8'));
const SUCCESS = code(readFileSync(join(__dirname, 'success', 'page.tsx'), 'utf8'));
const CONNECT = code(readFileSync(join(__dirname, 'connect', 'route.ts'), 'utf8'));
const count = (h: string, n: RegExp) => (h.match(n) ?? []).length;

/** The body of one top-level function, by name. */
function fn(name: string): string {
  const at = ACTIONS.search(new RegExp(`(?:export )?(?:async )?function ${name}\\(`));
  assert.ok(at > -1, `${name} not found`);
  const rest = ACTIONS.slice(at);
  const end = rest.search(/\n}\n/);
  return rest.slice(0, end > -1 ? end : undefined);
}

// ── 1 · a key walks in ──────────────────────────────────────────────────────

// ⤷ 2026-10-02 · a THIRD seat-holder: on a one-QR event ("No reply · one QR for
// everyone", owner 2026-09-30) the database writes the seat first
// (`join_open_event_as_guest`), and only its 'joined' / 'member' answer reaches
// the mint — tests/db/one-qr-lets-a-signed-in-guest-in.db.test.ts and
// lib/one-qr-joins.test.ts hold that half.
test('only a seat-holder is minted a session — the returning member, the couple-recorded email, the one-QR join', () => {
  assert.equal(
    count(ACTIONS, /await enterAsGuest\(/g),
    3,
    'a signed-in ending with a seat stopped minting (or a request started to)',
  );
});

test('the mint is the real one, from the seat the join just wrote', () => {
  const body = fn('enterAsGuest');
  assert.match(body, /findGuestSeatForUser\(eventId, userId\)/, 'the seat is not looked up');
  assert.match(body, /if \(!seat\) return null;/, 'a missing seat must fall back, not redirect to /undefined');
  assert.match(body, /setGuestSession\(/, 'no session is minted — the redirect would show the stranger view');
  assert.match(body, /qr_token: seat\.qrToken/, 'the session is signed with something other than the live token');
  assert.match(body, /return `\/\$\{seat\.slug\}`/, 'the destination is not built from the database slug');
  assert.doesNotMatch(body, /slug\s*=\s*(formData|params|searchParams|token)/, 'the slug came from input');
});

test('every mint site keeps a fallback — a failed lookup must not strand anyone', () => {
  const sites = ACTIONS.split('await enterAsGuest(').slice(1);
  const withFallback = sites.filter((tail) => /dest \?\? `\/join\/\$\{eventId\}\/success/.test(tail.slice(0, 220))).length;
  assert.equal(withFallback, 3, 'a mint site lost its fallback to the success page');
});

test('🔒 the ORGANISER still goes to their dashboard', () => {
  assert.equal(count(ACTIONS, /redirect\(`\/dashboard\/\$\{eventId\}`\)/g), 1);
  const at = ACTIONS.indexOf('redirect(`/dashboard/${eventId}`)');
  const before = ACTIONS.slice(Math.max(0, at - 260), at);
  assert.match(before, /member_type === 'couple'/, 'the dashboard redirect left the couple branch');
  assert.doesNotMatch(before, /enterAsGuest/, 'the organiser is being routed through the guest path');
});

test('the mint stays out of the module that must not contain one', () => {
  const lib = code(readFileSync(join(__dirname, '..', '..', '..', 'lib', 'guest-membership-session.ts'), 'utf8'));
  assert.equal(count(lib, /setGuestSession/g), 0);
});

test('the success page opens the invitation — and nobody off the list reaches it any more', () => {
  assert.doesNotMatch(SUCCESS, /on its way/, 'the false promise is back');
  assert.match(SUCCESS, /Open your invitation/, 'the way onto the celebration is gone');
  assert.match(SUCCESS, /href=\{`\/\$\{event\.slug\}`\}/, 'the link is not the event address');
  assert.match(SUCCESS, /public_id, slug/, 'the page links to a slug it never selected');
  assert.match(SUCCESS, /event\.slug \?/, 'the no-address fallback was collapsed away');
  assert.doesNotMatch(SUCCESS, /added you and let the hosts/, 'the "we have added you" sentence is back — nobody is added by asking');
  assert.doesNotMatch(ACTIONS, /unlisted=1/, 'a request is being sent to "You’re in"');
});

// ── 2 · everyone else asks ─────────────────────────────────────────────────

test('🛂 a REQUEST writes no membership and no guest session', () => {
  const req = fn('createJoinRequest');
  assert.doesNotMatch(req, /from\('event_members'\)\s*\.(insert|upsert|update)/, 'a request binds an account — the event would appear in it');
  assert.doesNotMatch(req, /setGuestSession|enterAsGuest|bindMemberToSeed/, 'a request lets its asker in');
  assert.match(req, /entry_source: 'self_added_unlisted'/, 'the request is not tagged for Requests');
  // A signed-in asker is remembered for Keep/Link — in guest_claims, not event_members.
  assert.match(req, /from\('guest_claims'\)\.upsert\(/, 'a signed-in asker is not remembered, so Keep could not bind them');
  assert.match(req, /status: 'pending_review'/);
});

test('🛂 both actions end a request on "Request sent", never on the celebration or Reply', () => {
  for (const name of ['joinEventAction', 'selfJoinAction']) {
    const body = fn(name);
    const at = body.indexOf('await createJoinRequest(');
    assert.ok(at > -1, `${name} no longer creates a request`);
    const after = body.slice(at);
    // 🔓 Since 2026-09-29 "Request sent" also hands the requester their own key
    // (their pending ticket — lib/request-key.ts), never a guest session.
    assert.match(after, /return requestSent\(admin, eventId, token, requestId\);/, `${name}: a request does not end on "Request sent"`);
    assert.doesNotMatch(after, /setGuestSession|enterAsGuest|inviteReplyPath|bindMemberToSeed/, `${name}: something opens after a request`);
  }
  assert.match(fn('requestSent'), /redirect\(`\/join\/\$\{eventId\}\?sent=1/);
  // The accountless action mints NOTHING of its own — the only Reply redirect
  // left is for a device that already holds this event's key.
  assert.doesNotMatch(fn('selfJoinAction'), /setGuestSession\(/, 'selfJoinAction mints a session again');
});

test('🛂 a name is not a secret — no typed name binds a seat', () => {
  // The fuzzy matcher only SUGGESTS (Requests page); it is gone from the door.
  assert.doesNotMatch(ACTIONS, /classifyClaimMatch\(/, 'the join door matches names again');
  // seedBindAllowed survives only as the de-dupe of one asker's own request.
  const uses = ACTIONS.split('seedBindAllowed(').length - 1;
  assert.equal(uses, 1, 'seedBindAllowed is used for something other than de-duping a request');
  assert.ok(fn('createJoinRequest').includes('seedBindAllowed('), 'seedBindAllowed left the request de-dupe');
});

test('the one bind left is the EMAIL the couple recorded — onto a row they put on the list', () => {
  const body = fn('joinEventAction');
  const at = body.indexOf('bindMemberToSeed(');
  assert.ok(at > -1, 'the email bind is gone');
  const before = body.slice(0, at);
  assert.match(before, /\.eq\('entry_source', 'host_seeded'\)[\s\S]*\.ilike\('email', accountEmail\)/, 'the email bind can reach a request row');
  assert.match(before, /emailMayBindRow\(/, 'the email bind skips the one rule that keeps requests out');
  assert.equal(count(ACTIONS, /bindMemberToSeed\(/g), 2, 'a second bind site appeared (definition + the email bind only)');
});

test('the request insert is the ONE email writer on this door — and it never binds', () => {
  assert.equal(count(ACTIONS, /\.update\(\{\s*email/g), 0, 'the join door writes a guest email outside the request insert');
  assert.equal((ACTIONS.match(/sendEventAccountMagicLink\(/g) ?? []).length, 0, 'the join door sends a sign-in link');
  assert.doesNotMatch(ACTIONS, /formData\.get\('email'\)/, 'the dead email read is back (the request field is contact_email)');
  const req = fn('createJoinRequest');
  assert.match(req, /email: answers\.email,/, 'the request stopped storing how to reach the asker — Keep could not send the key');
});

test('🛂 the connect route will not let a request’s own email open the door', () => {
  const guard = CONNECT.indexOf('await onlyARequestHoldsThisEmail(');
  const connect = CONNECT.indexOf('await connectEventForUser(');
  assert.ok(guard > -1, 'the request-email guard is gone from the connect route');
  assert.ok(guard < connect, 'the guard runs after the connect — too late');
  const helper = CONNECT.slice(CONNECT.indexOf('async function onlyARequestHoldsThisEmail'));
  assert.match(helper, /emailMayBindRow\(/, 'the guard decides by something other than the one rule');
  assert.match(helper, /readGuestSession\(\)/, 'a device holding this event’s key would be refused');
});

// ── 3 · "Only my Guest List" has no ask-to-join anywhere (owner 2026-09-27) ─

const PAGE = code(readFileSync(join(__dirname, 'page.tsx'), 'utf8'));

test('🚪 on "Only my Guest List" the join page sends everyone to the event — a poster token included', () => {
  const at = PAGE.indexOf('if (!anyoneMayAskToJoin(event.rsvp_ask_config)) {');
  assert.ok(at > -1, 'the page no longer asks "Who can RSVP?" before offering the request form');
  assert.match(PAGE.slice(at, at + 200), /if \(event\.slug\) redirect\(`\/\$\{event\.slug\}`\);/, 'it does not go to the event');
  assert.ok(at < PAGE.indexOf('<JoinFlow'), 'the request form renders before the rule is asked');
  // The poster token must not be a way round it.
  assert.doesNotMatch(PAGE, /tokenValid/, 'a valid poster token decides something on this page again');
});

test('🚪 …and both actions refuse the same way, before anything is written', () => {
  for (const name of ['joinEventAction', 'selfJoinAction']) {
    const body = fn(name);
    const gate = body.indexOf('if (!anyoneMayAskToJoin(');
    assert.ok(gate > -1, `${name} does not ask "Who can RSVP?"`);
    assert.ok(gate < body.indexOf('await createJoinRequest('), `${name}: a request can be written before the rule is asked`);
    assert.match(body.slice(gate, gate + 400), /GUEST_LIST_ONLY/, `${name}: a refused asker is not sent to the event`);
  }
  assert.doesNotMatch(ACTIONS, /tokenValid/, 'a poster token decides something in the join actions again');
});

test('🚪 the refusal code lands on the event page itself (its one door), never on an ask form', async () => {
  const { selfJoinRefusalPath, GUEST_LIST_ONLY } = await import('@/lib/invite-arrival');
  assert.equal(selfJoinRefusalPath({ eventId: 'e', token: 't', slug: 'cale-ice', error: GUEST_LIST_ONLY }), '/cale-ice');
  assert.match(selfJoinRefusalPath({ eventId: 'e', token: 't', slug: null, error: GUEST_LIST_ONLY }), /^\/join\/e\?/);
});
