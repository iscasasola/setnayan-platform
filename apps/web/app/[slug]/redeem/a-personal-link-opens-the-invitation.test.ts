/**
 * A PERSONAL LINK OPENS THE INVITATION ITSELF (owner 2026-10-19, 21:40).
 *
 * Owner, verbatim, looking at a guest's personal link landing on the pre-reply
 * welcome (`/{slug}/invite/enter` — "Please reply below — your ticket is ready
 * once you do." + "Reply to the invitation"): *"why am i at rsvp. we should be
 * at the invitation page and not here"*. This overrides the 2026-09-30 row "THE
 * PERSONAL LINK OPENS THE GUEST'S OWN LANDING PAGE" and the 2026-10-11 N04 call.
 *
 * Before: `/{slug}?invite=` → `/{slug}/redeem` → `/{slug}/invite/enter` (reply
 * first), and `/{slug}` with an unreplied pass → `/{slug}/invite/reply`.
 * Now: the redeem lands on `/{slug}` — the real invitation — and the Event Hub
 * never sends a keyed guest to the reply page (the 2026-09-26 key gate's
 * redirect is retired). The cover's own Reply button leads there.
 *
 * What this holds — every rule EXECUTED, the wiring read through the repo's one
 * comment-stripper:
 *   1 · a fresh personal link for an unreplied guest on a LAUNCHED event resolves
 *       to the invitation, and the Event Hub lets them in;
 *   2 · a dateless / pre-launch event (Save the Date face) keeps the Save the
 *       Date landing, which asks nothing (N05) — and a destination that could
 *       not be read keeps the landing too;
 *   3 · a replied guest opens the invitation — even one who owes a later-
 *       switched question (the live test guest on maria-and-jose, 2026-10-19:
 *       "You replied — see you there", yet bounced to /invite/reply); the
 *       reply page still asks only what is missing when they tap Reply;
 *   4 · the plain address is unchanged: no code → nothing happens; the 30-min
 *       `?k=` re-entry works on the invitation's own address;
 *   5 · the wiring — the redeem's last word, the page's gate, the code before
 *       the private gate;
 *   6 · EVERY personal-identity entry (owner, same evening: "so their QR code
 *       should not directly go to RSVP. they only go there when they click to
 *       the button on the cover") — the link, the invitation QR, the saved /
 *       printed / NFC code, an uploaded QR, the nested /u/ address — is ONE
 *       `?invite=` url, handed to the redeem before anything renders, so all of
 *       them land where test 5 says.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { arrivalDestinationFor, personalLinkLandingPath } from '@/lib/invite-destination';
import { WEDDING_PROFILE } from '@/lib/event-type-profile';
import { rsvpGate } from '@/lib/guest-one-path';
import { invitationReentryHref, reentryRedeemPath } from '@/lib/guest-pass-hop';
import { invitationLinkOn } from '@/lib/invitation-link';
import { uploadedQrTarget } from '@/lib/uploaded-qr';
import { userNestingRewritePath } from '@/lib/u-nesting';

const read = (rel: string) => stripComments(readFileSync(join(process.cwd(), rel), 'utf8'));

/** maria-and-jose's shape (a wedding on 2026-12-12, Manila), read on 2026-10-19. */
const SLUG = 'maria-and-jose';
const EVENT = '947e7bab-893d-454d-b4c5-0a6e23f36009';
const NOW = Date.parse('2026-10-19T13:40:00Z');
const base = {
  profile: WEDDING_PROFILE,
  eventDate: '2026-12-12',
  eventEndDate: null,
  invitationLaunchDate: null,
  venueTz: 'Asia/Manila',
  nowMs: NOW,
};
/** The couple pinned the Invitation (launched) — the face the owner was looking at. */
const LAUNCHED = { ...base, launchMode: 'manual', manualPhase: 'rsvp' };
/** No date yet: the Event Hub is the Save the Date. */
const DATELESS = { ...base, eventDate: null };

const OPEN = { askMeal: true, askMobile: false, locked: false, guestsReply: true, mobile: null } as const;

test('1 · a fresh personal link for an UNREPLIED guest on a launched event opens the invitation', () => {
  const destination = arrivalDestinationFor(LAUNCHED);
  assert.equal(destination, 'invitation', 'precondition: the pinned event is not wearing the Invitation');
  assert.equal(personalLinkLandingPath(SLUG, destination), `/${SLUG}`, 'the personal link no longer opens the invitation');
  // The reply page still knows what to ask them, when they tap Reply on the cover…
  const gate = rsvpGate({ ...OPEN, rsvpStatus: 'pending', mealPreference: null });
  assert.ok(gate.kind === 'ask' && gate.missing.includes('attending'), 'the reply page no longer knows what to ask');
  // …and the Event Hub never sends them there itself (test 5 holds the page's source to that).
  // The day itself and the story are faces that open on `/{slug}` too.
  assert.equal(personalLinkLandingPath(SLUG, 'day_of'), `/${SLUG}`);
  assert.equal(personalLinkLandingPath(SLUG, 'story'), `/${SLUG}`);
});

test('2 · a dateless / pre-launch event keeps the Save the Date landing, which asks nothing (N05)', () => {
  const destination = arrivalDestinationFor(DATELESS);
  assert.equal(destination, 'save_the_date', 'precondition: a dateless event is not the Save the Date');
  assert.equal(personalLinkLandingPath(SLUG, destination), `/${SLUG}/invite/enter`, 'a Save the Date link skipped its landing');
  // A face that could not be read keeps the landing — the answer before this row, never a guess.
  assert.equal(personalLinkLandingPath(SLUG, null), `/${SLUG}/invite/enter`);
});

test('3 · a replied guest opens the invitation — even one owing a later-switched question', () => {
  // The link lands on the invitation whatever the reply (the landing decision never reads it).
  assert.equal(personalLinkLandingPath(SLUG, arrivalDestinationFor(LAUNCHED)), `/${SLUG}`);
  // They said Yes, then the couple switched the meal question on: the reply page asks it alone — when they tap Reply.
  const owing = rsvpGate({ ...OPEN, rsvpStatus: 'attending', mealPreference: null });
  assert.deepEqual(owing.kind === 'ask' ? owing.missing : null, ['meal'], 'the reply page no longer asks only what is missing');
  const REPLY = read('app/[slug]/invite/reply/page.tsx');
  assert.match(REPLY, /rsvpGate\(\{/, 'the reply page no longer asks the one rule for which questions to show');
});

test('4 · the plain address is unchanged; the 30-minute code re-enters on the invitation’s own address', () => {
  const code = 'c'.repeat(43);
  // No code (the plain address — the passcode's door): nothing happens.
  assert.equal(invitationReentryHref({ slug: SLUG, code: undefined, passEventId: null, eventId: EVENT }), null);
  assert.equal(invitationReentryHref({ slug: SLUG, code: '', passEventId: null, eventId: EVENT }), null);
  assert.equal(invitationReentryHref({ slug: SLUG, code: 'x/../evil', passEventId: null, eventId: EVENT }), null, 'a malformed code was carried');
  // This browser holds THIS event's pass: the code is never spent.
  assert.equal(invitationReentryHref({ slug: SLUG, code, passEventId: EVENT, eventId: EVENT }), null, 'a held pass spent the code');
  // No pass here, or another event's pass (one pass per event): spent once, back to the bare invitation.
  assert.equal(invitationReentryHref({ slug: SLUG, code, passEventId: null, eventId: EVENT }), reentryRedeemPath(SLUG, code, 'hub'));
  assert.equal(invitationReentryHref({ slug: SLUG, code, passEventId: 'other-event', eventId: EVENT }), reentryRedeemPath(SLUG, code, 'hub'));
  assert.match(reentryRedeemPath(SLUG, code, 'hub'), /&to=hub$/, 'the exchange no longer comes back to the invitation');
});

test('5 · WIRING: the redeem lands on the invitation; the page lets an unreplied pass in; the code runs before the lock', () => {
  const REDEEM = read('app/[slug]/redeem/route.ts');
  const tail = REDEEM.slice(REDEEM.lastIndexOf('const landing = new URL('));
  assert.match(
    tail,
    /^const landing = new URL\(personalLinkLandingPath\(event\.slug, await personalLinkDestination\(admin, event\.event_id\)\), url\.origin\);/,
    'the personal link’s landing is decided some other way',
  );
  assert.match(tail, /return NextResponse\.redirect\(landing\);\s*\}\s*$/, 'the redeem’s last word is not that landing');
  assert.match(REDEEM, /arrivalDestinationFor\(\{/, 'the redeem guesses the face instead of asking the page’s own composition');

  const PAGE = read('app/[slug]/page.tsx');
  // The Event Hub sends NO key to the reply page — not unreplied, not owing a detail ("they only go there when they
  // click to the button on the cover"). The cover's Reply still points there.
  assert.doesNotMatch(PAGE, /redirect\(\s*inviteReplyPath\(/, 'the Event Hub bounces a key to the reply page again');
  assert.doesNotMatch(PAGE, /redirect\(\s*`[^`]*\/invite\/reply/, 'the Event Hub bounces a key to the reply page again');
  assert.match(PAGE, /<ReplyPanel replyPath=\{inviteReplyPath\(event\.slug \?\? slug\)\}/, 'the cover lost its way to the reply page');
  const reentryAt = PAGE.indexOf('if (reentryHref) redirect(reentryHref);');
  const lockAt = PAGE.indexOf("if (visibility === 'private' || visibility === 'invited_accounts') {");
  const sessionAt = PAGE.indexOf('const session = passStandingNow.session;');
  assert.ok(sessionAt > -1 && reentryAt > sessionAt, 'the code is asked before the pass is known');
  assert.ok(lockAt > reentryAt, 'a guest holding a good code meets the private lock first');
  assert.match(PAGE, /invitationReentryHref\(\{\s*slug: event\.slug \?\? slug,\s*code: search\.k,\s*passEventId: session\?\.event_id \?\? null,/);
});

test('6 · every personal QR / link is one `?invite=` url, and every one is handed to the redeem first', () => {
  const sample = ['0123', '4567', '89ab', 'cdef'].join('').repeat(2); // 32 hex — a QR's shape, no key-like literal
  // The one speller (`buildInvitationUrl` → `invitationLinkOn`): the copied link, the invitation QR card, the saved
  // PNG, every printed pass / Save the Date / invitation set, the share card and the NFC tag.
  assert.equal(invitationLinkOn(`https://www.setnayan.com/${SLUG}`, sample), `https://www.setnayan.com/${SLUG}?invite=${sample}`);
  const QR = read('lib/qr.ts');
  assert.match(QR, /return invitationLinkOn\(/, 'a personal QR is spelled some other way');
  const PRINT = read('lib/print-set.server.ts');
  assert.match(PRINT, /renderInvitationQrPng\(\{/, 'the printed set spells its QR some other way');
  // "Upload your QR" on the stranger door re-enters through the same url.
  assert.equal(uploadedQrTarget(`https://www.setnayan.com/${SLUG}?invite=${sample}`, SLUG), `/${SLUG}?invite=${sample}`);
  assert.equal(uploadedQrTarget(sample, SLUG), `/${SLUG}?invite=${sample}`);
  // The nested owner address renders the same page.
  assert.equal(userNestingRewritePath(`/u/ice/${SLUG}`), `/${SLUG}`);
  // …and the page hands EVERY tokened url to the redeem before it reads anything (whose last word is test 5's).
  const PAGE = read('app/[slug]/page.tsx');
  const body = PAGE.slice(PAGE.indexOf('async function publicInvitationPage('));
  const hand = body.indexOf('redirect(redeemHref);');
  assert.ok(hand > -1 && hand < body.indexOf('loadEventShell('), 'a personal QR renders something before the redeem');
  // Nothing on the token path sends the guest to the reply page directly.
  const REDEEM = read('app/[slug]/redeem/route.ts');
  assert.doesNotMatch(REDEEM, /invite\/reply|inviteReplyPath\(/, 'the redeem sends a personal link straight to the reply page');
});
