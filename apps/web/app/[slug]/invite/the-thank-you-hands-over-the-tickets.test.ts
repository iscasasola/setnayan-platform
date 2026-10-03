/**
 * THE THANK-YOU HANDS OVER THE TICKETS AND THE LINK (owner 2026-09-29).
 *
 * DECISION_LOG rows "TICKETS ON THE THANK-YOU SCREEN" and "NO EMAIL TO GUESTS":
 * *"after they fillup, we give them their digital ticket for them and their
 * pluses. And a copy link for them to paste on their browser."* Layout and copy
 * from the approved prototype `Setnayan/prototypes/guest_ticket_flow_2026-09-29.html`,
 * frames A and A′.
 *
 * ✂ AMENDED 2026-10-03 (owner, on the live Event Hub: "too many buttons. too
 * much going on" — each control in ONE place): the plus-ones' tickets with
 * Send, "Copy my link" and "Save to my account" are the Event Hub's Me, not
 * the thank-you a second time. The thank-you keeps THEIR ticket and its Save.
 *
 * What this pins:
 *   1. the thank-you shows THEIR Digital ticket — the route's own PNG, only when
 *      `passCardEligibility` says they have one (accepted and coming);
 *   2. each NAMED plus-one keeps Send and their own Save — on Me; a blank seat
 *      keeps "Add name"; "Save all tickets" saves every card;
 *   3. "Copy my link" still hands over their OWN link, in the frame-A words
 *      (the component that remains for the in-app hand-off and requests);
 *   4. the thank-you has no "Not now", and no Save except to finish a Terms
 *      refusal.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
// YourGuests → AddNameInPlace → the server actions: stub the server-only marker.
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const APP = join(__dirname, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));
const ENTER = read('[slug]/invite/enter/page.tsx');

test('1 · the landing page draws their Digital ticket only when they have one, and the QR panel otherwise', () => {
  assert.match(ENTER, /passCardEligibilityFor\(admin, guest\.guest_id as string\)/, 'eligibility is not asked of the guest the session named');
  // 2026-09-30 (guest_landing_page frame 3): the ticket is the big picture
  // with "Save my ticket", decided by `landingTicketOf` over that eligibility.
  assert.match(ENTER, /const ticket = landingTicketOf\(\{ reply, eligibility: passCard,/);
  const at = ENTER.indexOf("{ticket === 'full' ? (");
  assert.ok(at > -1, 'the ticket section moved — re-point this guard');
  const block = ENTER.slice(at, ENTER.indexOf('data-landing="how"', at));
  assert.match(block, /<TicketPicture src=\{PASS_CARD_ROUTE\}/, 'the ticket is no longer the route’s own picture');
  assert.match(block, /<SavePassCardButton\s+hrefs=\{\[PASS_CARD_ROUTE\]\}/, 'the ticket lost its Save');
  assert.match(block, /Your \{PASS_CARD_WORDS\.digitalTicket\}/);
  assert.match(block, /<InviteQrPanel\b/, 'a guest with no ticket lost their QR');
  // ✂ ONE PLACE EACH (2026-10-03): no plus-one tickets, no Copy my link here.
  assert.doesNotMatch(ENTER, /<YourGuests\b|<CopyMyLink\b/, 'the thank-you is a second home for Me’s controls again');
});

test('2 · each NAMED plus-one keeps Send and their own Save (on Me); a blank seat keeps Add name; Save all saves every card', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { YourGuests } = await import('../_components/your-guests');
  const html = renderToStaticMarkup(
    React.createElement(YourGuests, {
      guests: [
        { guestId: 'p1', name: 'Ben Reyes', inviteUrl: 'https://x/ana?invite=tok-ben' },
        { guestId: 'p2', name: null, inviteUrl: null },
      ],
      eventName: 'Indalecio & Claire',
      addNamesHref: '/ana/invite/reply#plus-ones',
      passCards: { own: '/api/guest/pass-card', plusOnes: { p1: '/api/guest/pass-card?guest=p1' } },
    }),
  );
  assert.match(html, /Ben Reyes[\s\S]*>Send their invite</, 'Ben has no Send');
  assert.match(html, /Save Ben’s/, 'Ben’s own ticket has no Save');
  assert.match(html, /\+2 · TBA/);
  assert.match(html, />Add their name</, 'a blank seat lost "Add name"');
  assert.match(html, /data-save-pass-card="2"/, 'Save all does not save both tickets');
  // No grey line explaining the section (BUILD_PROMPTS rule 13).
  assert.doesNotMatch(html, /Each name gets their own/);
});

test('3 · "Copy my link" hands over their own link, in the frame-A words', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CopyMyLink } = await import('../_components/copy-my-link');
  const html = renderToStaticMarkup(
    React.createElement(CopyMyLink, { link: 'https://www.setnayan.com/ana?invite=0123456789abcdef0123456789abcdef' }),
  );
  assert.match(html, /Your link opens this invitation any time/);
  assert.match(html, /setnayan\.com\/ana\?invite=0123456789abcdef0123456789abcdef/, 'the link is not printed');
  assert.match(html, />Copy my link</);
  assert.match(html, /Paste it in Messenger to yourself, or in your notes — it’s just for you, and it’s your ticket at the door too\./);
  const src = read('[slug]/_components/copy-my-link.tsx');
  assert.match(src, /'Copied ✓'/);
  assert.match(src, /Link copied — paste it anywhere you’ll find it again\./);
});

test('4 · no "Not now", and Save on the thank-you only to finish a Terms refusal', () => {
  // "Not now" went 2026-09-30: "Open the invitation" above it is the way in.
  assert.doesNotMatch(ENTER, />\s*Not now\s*</);
  assert.match(ENTER, /search\.keep === 'terms' \? \(\s*<SaveToAccount[\s\S]*?termsMissing[\s\S]*?carries="your name, mobile, meal and your guests come along"/);
});
