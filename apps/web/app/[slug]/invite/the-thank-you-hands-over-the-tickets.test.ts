/**
 * THE THANK-YOU HANDS OVER THE TICKETS AND THE LINK (owner 2026-09-29).
 *
 * DECISION_LOG rows "TICKETS ON THE THANK-YOU SCREEN" and "NO EMAIL TO GUESTS":
 * *"after they fillup, we give them their digital ticket for them and their
 * pluses. And a copy link for them to paste on their browser."* Layout and copy
 * from the approved prototype `Setnayan/prototypes/guest_ticket_flow_2026-09-29.html`,
 * frames A and A′.
 *
 * What this pins:
 *   1. the thank-you shows THEIR Digital ticket — the route's own PNG, only when
 *      `passCardEligibility` says they have one (accepted and coming);
 *   2. one ticket per NAMED plus-one (Save · Send), a blank seat keeps "Add
 *      name", and "Save all tickets" closes the section naming the files;
 *   3. "Copy my link" with their OWN link, the frame-A words;
 *   4. then Save to my account and "Not now".
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

test('1 · the thank-you draws their Digital ticket only when they have one, and the QR panel otherwise', () => {
  assert.match(ENTER, /passCardEligibilityFor\(admin, guest\.guest_id as string\)/, 'eligibility is not asked of the guest the session named');
  assert.match(ENTER, /passCard === 'pass'\s*\?\s*\{\s*own: PASS_CARD_ROUTE,/, 'a ticket is offered to a guest who has none');
  const at = ENTER.indexOf('{passCards ? (');
  assert.ok(at > -1, 'the ticket section moved — re-point this guard');
  const block = ENTER.slice(at, ENTER.indexOf('<YourGuests', at));
  assert.match(block, /<TicketRow\s+href=\{PASS_CARD_ROUTE\}\s+name=\{guestName\}/);
  assert.match(block, /Your \{PASS_CARD_WORDS\.digitalTicket\}/);
  assert.match(block, /<InviteQrPanel\b/, 'a guest with no ticket lost their QR');
  // Order: ticket → guests → link → save (frame A).
  const order = ['{passCards ? (', '<YourGuests', '<CopyMyLink link={invitationUrl} />', '<SaveToAccount'].map((k) => ENTER.indexOf(k));
  assert.ok(order.every((n) => n > -1), `a frame-A part is missing: ${order.join(',')}`);
  assert.deepEqual([...order].sort((a, b) => a - b), order, `the thank-you is out of frame-A order: ${order.join(',')}`);
  assert.match(ENTER, /passCards=\{passCards\}\s*ticketRows=\{\{ ownName: guestName \}\}/);
});

test('2 · each NAMED plus-one is their own ticket (Save · Send); a blank seat keeps Add name; Save all names the files', async () => {
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
      ticketRows: { ownName: 'Maria Santos' },
    }),
  );
  assert.match(html, /<img[^>]*src="\/api\/guest\/pass-card\?guest=p1"/, 'Ben is not shown his ticket');
  assert.match(html, /data-ticket-row=""[\s\S]*Ben Reyes[\s\S]*>Save<[\s\S]*>Send</, 'Ben’s row is not Save · Send');
  assert.match(html, /\+2 · TBA/);
  assert.match(html, />Add their name</, 'a blank seat was given a ticket instead of "Add name"');
  assert.equal((html.match(/data-ticket-row=""/g) ?? []).length, 1, 'a ticket for a seat with no name');
  const all = html.slice(html.indexOf('data-save-all-tickets'));
  assert.match(all, />Save all tickets</);
  assert.match(all, /2 pictures · Maria-Santos-ticket-… · Ben-Reyes-ticket-…/);
  assert.match(html, /data-save-pass-card="2"/, 'Save all does not save both tickets');
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

test('4 · then ONE Save to my account, saying what comes along, and "Not now"', () => {
  assert.match(ENTER, /carries="your name, mobile, meal and your guests come along"/);
  assert.match(ENTER, />\s*Not now\s*</);
});
