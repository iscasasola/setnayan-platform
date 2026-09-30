/**
 * THE PERSONAL LINK OPENS THE GUEST'S OWN LANDING PAGE (owner 2026-09-30).
 *
 * DECISION_LOG rows "THE PERSONAL LINK OPENS THE GUEST'S OWN LANDING PAGE" and
 * "THE TICKET GAINS THE SEAT ON THE DAY · A NEW OR CHANGED TICKET POPS UP FIRST
 * WITH SAVE"; prototype `Setnayan/prototypes/guest_landing_page_2026-09-30.html`
 * (frames 1–6). Owner, verbatim: *"a link where they have the message and the
 * digital ticket and the instructions and a button to open their RSVP (that
 * closes when they have filled it up already) and just the Digital Ticket is
 * left"*.
 *
 * What this pins — every rule is EXECUTED from lib/guest-landing.ts, and the
 * page's wiring is read from source through the repo's one comment-stripper
 * (the page is a server component on a `server-only` chain):
 *
 *   A · the link lands on the page, and the reply returns to it;
 *   B · the page's order;
 *   C · "Reply to the invitation" only until they reply; "Change my reply" after;
 *   D · the ticket's three states (faded · full · none);
 *   E · the seat only from the day;
 *   F · the pop-up once per ticket version;
 *   G · the in-app bar only inside an in-app browser;
 *   H · the couple's message, name as given, with no link in it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  LANDING_ORDER,
  LANDING_WORDS,
  changeReplyWords,
  howToUseLines,
  inAppHandoff,
  landingDayLabel,
  landingHeadline,
  landingMessage,
  landingReplyOf,
  landingTicketOf,
  openBeforeReplyHref,
  ticketFingerprint,
  ticketPopupDue,
} from '@/lib/guest-landing';
import { ticketShowsTable } from '@/lib/guests-may-see-seats';

(globalThis as unknown as { React: unknown }).React = React;

const APP = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const ENTER = read('[slug]/invite/enter/page.tsx');
const REDEEM = read('[slug]/redeem/route.ts');
const ACTIONS = read('[slug]/actions.ts');
const PAGE = read('[slug]/page.tsx');

// ═══ A · the link lands here, and the reply comes back ══════════════════════

test('A · the personal link lands on the landing page; the reply returns to it', () => {
  // The redeem hop's last word is the landing page, built from the DATABASE slug.
  const tail = REDEEM.slice(REDEEM.lastIndexOf('return NextResponse.redirect('));
  assert.match(tail, /^return NextResponse\.redirect\(new URL\(inviteEnterPath\(event\.slug\), url\.origin\)\);/, 'the personal link no longer ends on the landing page');
  // The reply's save sends the guest back to the same page.
  assert.match(ACTIONS, /redirect\(`\$\{inviteEnterPath\(ev\.slug\)\}\?rsvp=\$\{outcome\}`\)/, 'the reply no longer returns to the landing page');
  // "Open the invitation" before a reply passes the reply gate — on the exact mark only.
  assert.equal(openBeforeReplyHref('ana-miguel'), '/ana-miguel?from=landing');
  assert.match(PAGE, /const openedFromLanding = search\[LANDING_OPEN_PARAM\] === LANDING_OPEN_VALUE;/);
  assert.match(ENTER, /href=\{openBeforeReplyHref\(home\)\}/, 'the unreplied guest’s "Open the invitation" is gated back to the form');
});

// ═══ B · the order ══════════════════════════════════════════════════════════

test('B · the page runs message · reply · ticket · guests · how to use · open, in that order', () => {
  assert.deepEqual([...LANDING_ORDER], ['message', 'reply', 'ticket', 'guests', 'how', 'open']);
  const at = LANDING_ORDER.map((k) => ENTER.indexOf(`data-landing="${k}"`));
  assert.ok(at.every((n) => n > -1), `a section is missing its marker: ${LANDING_ORDER.map((k, i) => `${k}@${at[i]}`).join(' ')}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, `the landing page is out of order: ${LANDING_ORDER.map((k, i) => `${k}@${at[i]}`).join(' ')}`);
  // The pop-up comes FIRST — before the message.
  assert.ok(ENTER.indexOf('<TicketPopup') > -1 && ENTER.indexOf('<TicketPopup') < at[0]!, 'the changed ticket no longer pops up first');
});

// ═══ C · the reply button ═══════════════════════════════════════════════════

test('C · "Reply to the invitation" shows only until they reply; "Change my reply" after', () => {
  assert.equal(landingReplyOf('pending'), 'unreplied');
  assert.equal(landingReplyOf(null), 'unreplied');
  assert.equal(landingReplyOf('maybe'), 'unreplied');
  assert.equal(landingReplyOf('attending'), 'yes');
  assert.equal(landingReplyOf('declined'), 'no');
  assert.equal(changeReplyWords('unreplied'), null, 'an unreplied guest got the small link instead of the button');
  assert.equal(changeReplyWords('yes'), 'Change my reply');
  assert.equal(changeReplyWords('no'), 'Changed your plans?');
  // The button is mounted ONLY inside the unreplied branch.
  const btn = ENTER.indexOf('data-landing="reply"');
  const gate = ENTER.lastIndexOf('{unreplied ? (', btn);
  assert.ok(gate > -1 && btn - gate < 80, 'the reply button is no longer gated on "not replied yet"');
  assert.match(ENTER, /const unreplied = reply === 'unreplied' && !canvas;/);
  assert.match(ENTER, /\{LANDING_WORDS\.reply\}/);
  assert.match(ENTER, /\{changeWords \? \(/, 'the small "Change my reply" is gone');
});

// ═══ D · the ticket ═════════════════════════════════════════════════════════

test('D · the ticket: faded before a Yes, full after, none after a No', () => {
  assert.equal(landingTicketOf({ reply: 'unreplied', eligibility: 'pass' }), 'faded');
  assert.equal(landingTicketOf({ reply: 'yes', eligibility: 'pass' }), 'full');
  assert.equal(landingTicketOf({ reply: 'no', eligibility: 'pass' }), 'none');
  assert.equal(landingTicketOf({ reply: 'no', eligibility: 'cannotCome' }), 'none');
  // A plus-one follows the bringer's reply (`passCardEligibility`) — never faded by their own blank reply.
  assert.equal(landingTicketOf({ reply: 'unreplied', eligibility: 'pass', isPlusOne: true }), 'full');
  // A request still waiting, or no code at all, keeps the page's old answer.
  assert.equal(landingTicketOf({ reply: 'yes', eligibility: 'awaiting' }), 'other');
  assert.equal(landingTicketOf({ reply: 'yes', eligibility: 'none' }), 'other');
  // Wiring: faded carries "Reply to confirm your ticket"; full carries Save.
  const faded = ENTER.slice(ENTER.indexOf('data-landing-ticket="faded"'), ENTER.indexOf("ticket === 'none' ? null"));
  assert.match(faded, /opacity-\[0\.42\] grayscale/, 'the unconfirmed ticket is not faded (Fable frame 1: 42 %, grey)');
  assert.match(faded, /\{LANDING_WORDS\.replyToConfirm\}/);
  assert.doesNotMatch(faded, /SavePassCardButton/, 'an unconfirmed ticket can be saved');
  const full = ENTER.slice(ENTER.indexOf('data-landing-ticket="full"'), ENTER.indexOf('data-landing-ticket="faded"'));
  assert.match(full, /LANDING_WORDS\.saveTicket/);
  assert.equal(LANDING_WORDS.saveTicket, 'Save my ticket');
  assert.match(ENTER, /\{ticket === 'full' \|\| ticket === 'faded' \? \(\s*<section data-landing="how"/, 'How to use it shows without a ticket');
});

// ═══ E · the seat on the day ════════════════════════════════════════════════

test('E · the seat shows only from 00:00 Manila on the event date', () => {
  const day = { eventDate: '2027-03-13', eventDatePrecision: 'day' };
  assert.equal(ticketShowsTable(day, new Date('2027-03-12T15:59:59Z')), false);
  assert.equal(ticketShowsTable(day, new Date('2027-03-12T16:00:00Z')), true);
  assert.equal(landingDayLabel('2027-03-13', 'day'), 'March 13');
  assert.equal(landingDayLabel('2027-03-13', 'month'), null);
  assert.deepEqual(howToUseLines({ seatDay: false, dateLabel: 'March 13', table: 'Table 7' }), [
    'Save it to your photos.',
    'Show it at the door.',
    'On March 13 it will also show your seat.',
  ], 'a table was named before the day');
  // Frame 6 — on the day, two lines: the door, then the table.
  assert.deepEqual(howToUseLines({ seatDay: true, dateLabel: 'March 13', table: 'Table 7' }), ['Show this at the door.', 'Find Table 7 in the reception.']);
  // The page reads the seat only on the day.
  assert.match(ENTER, /const ownSeat = canvas \|\| !seatDay \? null : /, 'the landing page reads a seat before the day');
});

// ═══ F · the pop-up, once per version ═══════════════════════════════════════

test('F · a new or changed ticket pops up once per fingerprint — never nagging', () => {
  const base = { qrToken: 'k1', eligibility: 'pass', party: 1, seat: null, seatNumber: null };
  const v1 = ticketFingerprint(base);
  assert.equal(ticketFingerprint({ ...base }), v1, 'the same ticket is a different version');
  for (const [what, changed] of [
    ['a fresh QR key', { ...base, qrToken: 'k2' }],
    ['an accepted request', { ...base, eligibility: 'awaiting' }],
    ['the party changing', { ...base, party: 2 }],
    ['the seat added on the day', { ...base, seat: 'Table 7', seatNumber: '3' }],
  ] as const) {
    assert.notEqual(ticketFingerprint(changed), v1, `${what} is not a new ticket version`);
  }
  assert.equal(ticketPopupDue({ current: v1, seen: null }), false, 'the first sight popped up over the ticket it already shows');
  assert.equal(ticketPopupDue({ current: v1, seen: null, fresh: true }), true, 'an accepted request did not pop up');
  assert.equal(ticketPopupDue({ current: v1, seen: 'old' }), true, 'a changed ticket did not pop up');
  assert.equal(ticketPopupDue({ current: v1, seen: v1 }), false, 'the same version popped up twice');
  assert.equal(ticketPopupDue({ current: v1, seen: v1, fresh: true }), false, 'a seen version nagged');
  // The pop-up exists only beside a full ticket.
  assert.match(ENTER, /\{ticket === 'full' && !canvas \? \(\s*<TicketPopup/);
  const POPUP = read('[slug]/_components/ticket-popup.tsx');
  assert.match(POPUP, /ticketPopupDue\(\{ current: fingerprint, seen, fresh \}\)/, 'the pop-up decides some other way');
  assert.match(POPUP, /localStorage\.setItem\(ticketSeenKey\(guestId\), fingerprint\)/, 'closing or saving does not remember the version');
});

// ═══ G · the in-app browser ═════════════════════════════════════════════════

const LINK = 'https://www.setnayan.com/ana-miguel?invite=0123456789abcdef';
const UA = {
  iosSafari: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  desktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
  iosMessenger: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/MessengerForiOS;FBAV/450.0]',
  iosInstagram: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0',
  androidFacebook: 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/460.0]',
};

test('G · the in-app bar appears ONLY inside Messenger / Facebook / Instagram', async () => {
  for (const ua of [UA.iosSafari, UA.androidChrome, UA.desktop, null]) {
    assert.deepEqual(inAppHandoff(ua, LINK), { kind: 'none' }, `a real browser got the in-app bar: ${ua}`);
  }
  const android = inAppHandoff(UA.androidFacebook, LINK);
  assert.equal(android.kind, 'android');
  assert.match((android as { href: string }).href, /^intent:\/\/www\.setnayan\.com\/ana-miguel\?invite=0123456789abcdef#Intent;scheme=https;/);
  for (const ua of [UA.iosMessenger, UA.iosInstagram]) {
    const ios = inAppHandoff(ua, LINK);
    assert.equal(ios.kind, 'ios');
    assert.equal((ios as { safariHref: string }).safariHref, `x-safari-${LINK}`);
    assert.equal((ios as { appHref: string }).appHref, 'setnayan://ana-miguel?invite=0123456789abcdef');
  }
  // Rendered: nothing at all outside an in-app browser; both taps on iPhone.
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InAppBar } = await import('../_components/in-app-bar');
  assert.equal(renderToStaticMarkup(React.createElement(InAppBar, { handoff: inAppHandoff(UA.iosSafari, LINK) })), '');
  const ios = renderToStaticMarkup(React.createElement(InAppBar, { handoff: inAppHandoff(UA.iosMessenger, LINK) }));
  assert.match(ios, />Open in Safari to save your ticket</);
  assert.match(ios, />Open in the Setnayan app</);
  const androidBar = renderToStaticMarkup(React.createElement(InAppBar, { handoff: inAppHandoff(UA.androidFacebook, LINK) }));
  assert.match(androidBar, /href="intent:\/\//);
  // iPhone inside Messenger: Save reads "Open in Safari to save".
  assert.equal(LANDING_WORDS.saveInSafari, 'Open in Safari to save');
  assert.match(ENTER, /const safariSave = inApp\.kind === 'ios' \? inApp\.safariHref : null;/);
  assert.match(ENTER, /\{safariSave \? \(\s*<a href=\{safariSave\}[^>]*>\s*\{LANDING_WORDS\.saveInSafari\}/);
});

// ═══ H · the couple's message ═══════════════════════════════════════════════

test('H · the couple’s message: their words, the name exactly as given, no link', () => {
  const facts = { hostsName: 'Ana & Miguel', eventWord: 'wedding', eventDate: '2027-03-13', datePrecision: 'day', now: new Date('2026-09-30T00:00:00Z') };
  const ours = landingMessage({ ...facts, formalName: 'Mr. Manuel Cortez Casasola', reply: 'unreplied' });
  assert.equal(
    ours,
    'Hi Mr. Manuel Cortez Casasola! 💌 You’re invited to Ana & Miguel’s wedding on Saturday, March 13, 2027. Please reply below — your ticket is ready once you do.',
  );
  const theirs = landingMessage({
    ...facts,
    formalName: 'Mr. Manuel Cortez Casasola',
    reply: 'yes',
    template: 'Mabuhay {name}! Join us for {event}.\n\nTap here: {link}',
  });
  assert.equal(theirs, 'Mabuhay Mr. Manuel Cortez Casasola! Join us for Ana & Miguel’s wedding.', 'the couple’s own words were not used, or the ask stayed after a reply');
  assert.doesNotMatch(theirs, /\{link\}|https?:/, 'the landing message carries a link');
  assert.match(ENTER, /formalName: guestFullName\(\{\s*display_name: guest\.display_name/, 'the name is not the name as given');
});

// ═══ I · the approved Fable look ════════════════════════════════════════════

test('I · the Fable frames: the couple as the brand line, the ✓ pill, "We’ll miss you.", the bar above the page, the day’s words', async () => {
  // Frames 3 · 4 — the headings when the couple wrote none of their own.
  assert.equal(landingHeadline('attending'), 'You replied — see you there');
  assert.equal(landingHeadline('declined'), 'We’ll miss you.');
  assert.match(ENTER, /const ownHeadline = landingHeadline\(status, words\.solemn\);/);
  assert.match(ENTER, /data-landing-done=""/, 'the "✓ You replied" pill is gone');
  assert.match(ENTER, /\{ownMessage \?\? LANDING_WORDS\.missedSub\}/, 'the No card lost "Thank you for letting us know."');
  // Frame 1 — "Please reply by …", the same date the reply page shows.
  assert.match(ENTER, /resolveReplyBy\(\{/);
  assert.equal(landingDayLabel('2027-02-13', 'day', { year: true }), 'February 13, 2027');
  // Frames 1 · 6 — the words of the one way in.
  const { arrivalDestinationWords } = await import('@/lib/invite-destination');
  assert.equal(arrivalDestinationWords('invitation').cta, 'Open the invitation');
  assert.equal(arrivalDestinationWords('day_of').cta, 'Open the event');
  // Frame 6 — "· Today" beside the couple on the day.
  assert.match(ENTER, /\{hosts\} <span className="text-mulberry">· Today<\/span>/);
  // Frame 1b — the thin bar sits ABOVE the page, outside the card.
  assert.ok(ENTER.indexOf('<InAppBar handoff={inApp} />') < ENTER.indexOf('<DoorShell'), 'the in-app bar moved inside the page');
  // The ticket on the page IS the saved picture — the Fable ticket (Classic), one drawing.
  const LAYOUT = stripComments(readFileSync(join(APP, '..', 'lib', 'print-layout.ts'), 'utf8'));
  assert.match(LAYOUT, /function cardFootFacts\(data: PrintSetData, pass: PrintPass\): CardFacts \{/, 'the Fable foot row (DATE · ARRIVE) is gone');
  assert.match(LAYOUT, /\{ label: 'Date', value: date \}/);
});
