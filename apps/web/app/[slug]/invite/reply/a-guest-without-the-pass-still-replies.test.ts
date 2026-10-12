/**
 * A GUEST WHO OPENED THEIR OWN LINK PRESSES REPLY AND IS ASKED THE QUESTIONS — SIGNED OUT, NO ACCOUNT —
 * even if the browser lost their pass between the landing and the press. Never the stranger door.
 *
 * The live fault, 2026-10-12 (production d2e38b7): the owner opened a guest's personal link SIGNED OUT on
 * maria-and-jose (dated 2026-12-12 → the Invitation stage, replies open), saw the landing, pressed "Reply to the
 * invitation" and landed on the stranger door of /maria-and-jose — "Get inside · Upload your QR · Sign in". No
 * questions, nothing saved. Production showed the landing rendered WITH the pass (its re-entry code was never
 * spent) and the Reply's request, 13 s later, arriving with none — so `invite/reply` ran its
 * `redirect(/{slug})`. Owner, verbatim: "you can still reply without an account".
 *
 * WHAT IS HELD:
 *   (1) The reply page's entry rule (`replyEntry`): the guest with a pass is asked; a guest WITHOUT one who carries
 *       the landing's code is re-keyed at the redeem and sent back to THESE questions; only somebody with neither
 *       meets the event's door. Nothing on that path is a sign-in, an account, or a /join connect.
 *   (2) The redeem opens the questions for `to=reply`, built from the database's slug — and every other `to` is as
 *       it was.
 *   (3) The page wires the rule: the only door redirect on a missing pass is `replyEntry`'s, read from `?k=`.
 *   (4) The landing's Reply (and "Change my reply", and the plus-one's own Reply) carries the landing's code; the
 *       Invitation-stage landing — a DATED event — renders ONE control and it is that Reply.
 *   (5) The Save the Date is unchanged: a dateless event still asks nothing — no Reply link at all.
 *
 * SABOTAGE RUN 2026-10-12 (committed first, then put back): see the PR body.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  REENTRY_PARAM,
  reentryDestinationOf,
  reentryDestinationPath,
  replyEntry,
  replyHrefCarrying,
} from '@/lib/guest-pass-hop';
import { getLifecyclePhase } from '@/lib/invitation-widgets';
import { arrivalDestination, replyIsAsked } from '@/lib/invite-destination';
import { LANDING_WORDS } from '@/lib/guest-landing';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = join(__dirname, '..', '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SLUG = 'maria-and-jose';
/** The shape a landing code has in the address (`isUrlSecretShaped`). */
const CODE = 'Lnd_C0de-abcdEFGH1234';
/** Anywhere a guest would be asked to sign in or make an account. */
const SIGN_IN = /\/(?:login|signup|auth|sign-in|join)\b|connect/;

test('(1) the entry rule: with a pass → the questions; without one, carrying the landing code → re-keyed back to the questions; with neither → the door', () => {
  assert.deepEqual(replyEntry({ slug: SLUG, hasPass: true, code: null }), { kind: 'ask' }, 'a guest holding the pass is not asked');
  assert.deepEqual(replyEntry({ slug: SLUG, hasPass: true, code: CODE }), { kind: 'ask' }, 'a guest holding the pass spent the code anyway');

  const lost = replyEntry({ slug: SLUG, hasPass: false, code: CODE });
  assert.equal(lost.kind, 'rekey', 'THE FAULT: a named guest who lost the pass on the way is sent to the stranger door');
  const to = new URL((lost as { href: string }).href, 'https://www.setnayan.com');
  assert.equal(to.pathname, `/${SLUG}/redeem`);
  assert.equal(to.searchParams.get(REENTRY_PARAM), CODE, 'the code the landing handed over is not the one spent');
  assert.equal(to.searchParams.get('slug'), SLUG);
  assert.equal(to.searchParams.get('to'), 'reply', 'the re-key does not come back to the questions');
  assert.doesNotMatch(to.pathname + to.search, SIGN_IN, 'the guest is sent to sign in');

  // A stranger — no pass, no code, or something that is not a code — still meets the event's own door.
  for (const junk of [null, undefined, '', 'x', '../../evil', 'a b c d e f g h', 'k'.repeat(200)]) {
    assert.deepEqual(replyEntry({ slug: SLUG, hasPass: false, code: junk }), { kind: 'door', href: `/${SLUG}` }, `a stranger with ${JSON.stringify(junk)} was let in`);
  }
});

test('(2) the redeem opens the questions for `to=reply` — and every other destination is as it was', () => {
  assert.equal(reentryDestinationOf('reply'), 'reply');
  assert.equal(reentryDestinationOf('landing'), 'landing');
  for (const other of [null, undefined, '', 'hub', 'https://evil.example', '/x']) assert.equal(reentryDestinationOf(other), 'hub');
  assert.equal(reentryDestinationPath(SLUG, 'reply'), `/${SLUG}/invite/reply`);
  assert.equal(reentryDestinationPath(SLUG, 'landing'), `/${SLUG}/invite/enter`);
  assert.equal(reentryDestinationPath(SLUG, 'hub'), `/${SLUG}`);

  const route = code('app/[slug]/redeem/route.ts');
  const reentry = route.slice(route.indexOf('if (!token && reentryCode) {'));
  assert.ok(reentry.length > 0, 'anti-vacuity: the re-entry branch is gone');
  assert.match(
    reentry.slice(0, 600),
    /const destination = new URL\(reentryDestinationPath\(event\.slug, to\), url\.origin\);/,
    'the code exchange does not open the destination it was given (from the database slug)',
  );
});

test('(3) the reply page: on a missing pass it re-keys from `?k=` — its only door is the rule’s', () => {
  const page = code('app/[slug]/invite/reply/page.tsx');
  assert.match(page, /searchParams: Promise<\{[^}]*\bk\?: string[^}]*\}>/, 'the page does not read the code');
  assert.match(
    page,
    /const session = canvas \? null : await readGuestSessionForEvent\(event\.event_id as string\);\s*if \(!canvas\) \{\s*const entry = replyEntry\(\{ slug: home, hasPass: Boolean\(session\), code: search\.k \}\);\s*if \(entry\.kind !== 'ask'\) redirect\(entry\.href\);\s*\}/,
    'a missing pass still goes straight to the stranger door',
  );
  // The old bare redirect is gone — the one line that sent the owner to the door.
  assert.doesNotMatch(page, /if \(!canvas && !session\) redirect\(/, 'the bare no-pass redirect is back');
  assert.doesNotMatch(page, /redirect\([^)]*\/(?:login|signup|auth)/, 'the reply page sends a guest to sign in');
});

test('(4) a DATED event in the Invitation stage: the landing’s one control is the Reply, and it carries the landing’s code', async () => {
  // maria-and-jose: 2026-12-12, opened 2026-10-12 in Manila → the Invitation, where a reply IS asked.
  const now = Date.parse('2026-10-12T00:00:00+08:00');
  const phase = getLifecyclePhase('2026-12-12', 'Asia/Manila', null, now);
  assert.equal(phase, 'rsvp', 'anti-vacuity: the dated event is not in the Invitation stage');
  assert.equal(replyIsAsked(arrivalDestination({ phasesEnabled: true, lifecyclePhase: phase })), true);

  const href = replyHrefCarrying(SLUG, CODE);
  assert.equal(href, `/${SLUG}/invite/reply?${REENTRY_PARAM}=${CODE}`);
  assert.equal(replyHrefCarrying(SLUG, null), `/${SLUG}/invite/reply`, 'with no code the Reply is not the plain questions');
  assert.equal(replyHrefCarrying(SLUG, '../x'), `/${SLUG}/invite/reply`, 'something that is not a code rode the Reply');

  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LandingPreReply } = await import('../_components/landing-pre-reply');
  const html = renderToStaticMarkup(
    React.createElement(LandingPreReply, {
      message: 'Hi! You’re invited.', hosts: 'Maria & Jose', replyHref: href, replyByLabel: null,
      fadedTicket: true, ticketSrc: '/api/guest/pass-card', awaitingLine: null, whenWhere: 'Saturday, December 12, 2026',
    }),
  );
  const links = html.match(/<(a|button)\b[^>]*>/g) ?? [];
  assert.equal(links.length, 1, `the Invitation landing has ${links.length} controls`);
  assert.ok(links[0]!.includes(`href="/${SLUG}/invite/reply?${REENTRY_PARAM}=${CODE}"`), `the Reply does not carry the code: ${links[0]}`);
  assert.ok(html.includes(`>${LANDING_WORDS.reply}</a>`));

  // The page hands every Reply on it the code the landing was opened with — none goes out bare.
  const page = code('app/[slug]/invite/enter/page.tsx');
  assert.equal((page.match(/replyHrefCarrying\(home, search\.k\)/g) ?? []).length, 3, 'a Reply on the landing does not carry the code');
  assert.doesNotMatch(page, /inviteReplyPath\(home\)/, 'a Reply on the landing went back to the bare address');
});

test('(5) the Save the Date is unchanged: a dateless event asks nothing — no Reply on its landing', async () => {
  assert.equal(getLifecyclePhase(null), 'save_the_date');
  assert.equal(replyIsAsked(arrivalDestination({ phasesEnabled: true, lifecyclePhase: 'save_the_date' })), false);
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LandingSaveTheDate } = await import('../_components/landing-pre-reply');
  const html = renderToStaticMarkup(
    React.createElement(LandingSaveTheDate, {
      message: 'Hi Bean!', hosts: 'Marco & Marga', whenWhere: null, openHref: '/marco-marga', openLabel: 'Open the save the date', awaitingLine: null,
    }),
  );
  assert.equal((html.match(/<(a|button)\b/g) ?? []).length, 1);
  assert.ok(!html.includes('/invite/reply'), 'the Save the Date landing offers a reply');
});
