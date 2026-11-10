/**
 * every-client-row-opens-the-picked-client.test.ts — 🚪 A CLIENTS ROW OPENS THE PICKED CLIENT, AND ACCEPT LANDS IN THE CHAT.
 *
 * Owner, 11 Nov, live on his phone as SetnaProd, on a Clients › Asking row ("TEST SetnaProd walk · Birthday") that rose to
 * a separate facts card — Event type · Celebrant · Hosted by · … · Also booked, then Decline · Ask a question · Accept,
 * and NO page menu: *"Why do i see it this way? The chatbox is not yet done?"* · *"Accepted it and still did not show the
 * chatbox"* · then, verbatim: *"We had the clients> that show calendar on the page and the list is at the bottom. When that
 * is pressed it jump to the supplie-client card that was already planned with the details-chat-form-quote-files-report
 * and more menus that would grow to full screen"*. DECISION_LOG 2026-11-08 "a row opens the picked client on its Chat
 * tab"; 2026-11-09 "THE CHAT IS THE RECORD OF EVERY TRANSACTION".
 *
 * WHY IT HAPPENED: `RosterRowView` rose its OWN body in a `RiseScreen` (Build 5 · Lane A slice 2) — the event's lines and,
 * for an ask, `InquiryAnswers` with `returnTo="/vendor-dashboard/customers"`; Accept fell back to `returnTo`, so the
 * supplier said yes and landed back on that card. The chat (and the nine-page menu) only existed inside the picked client.
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. EVERY Clients row (asking and booked — they are all `RosterRowView`) is a door, below 701, into the ONE picked
 *      client (`/vendor-dashboard/clients/<event>?tab=…`, the shell with its page menu) through the one open path: an ask
 *      lands on Chat, a booked row on Details. Its head still rises (›, "opens a screen"); no facts card shown, no
 *      answers drawn in the row, no `RiseScreen` of its own (the body waits shut and inert for the right column).
 *   2. The roster no longer answers an ask in place — the chat's own top band does (`data-chat-inquiry-card`), once.
 *   3. Accept lands in the chat, never on `returnTo`: the full-screen chat's card starts a quote there (`?compose=quote`);
 *      inside the picked client, Ask and Accept land on ITS Chat page. Decline keeps `returnTo`.
 *   4. From 701 the row still opens beside the list (the wide Rise is Lane R's owner pick) — the shipped rule.
 *
 * SABOTAGE (each run once, each went red): drop `opensTo={href}` from `RosterRowView` → 1; put `acceptTo ?? returnTo` back
 * in `InquiryAnswers` → 3; drop the embedded `chatHref` in the thread page → 3; drop `&& !scope?.wide` from the door → 4.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { RosterRow } from './_components/customers-roster';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const NOW = Date.UTC(2026, 10, 11, 2);

const row = (over: Partial<RosterRow>): RosterRow => ({
  eventId: 'e1',
  lane: 'booked' as const,
  waitingKind: null,
  waitingSince: null,
  expiresAt: null,
  quietDays: null,
  title: 'TEST SetnaProd walk',
  identityRevealed: true,
  eventDate: '2026-12-18',
  place: null,
  threadId: 't1',
  eventVendorId: 'ev1',
  note: null,
  kind: 'Birthday',
  quoted: false,
  returning: false,
  ...over,
});

const LINES = {
  eventId: 'e1',
  threadId: 't1',
  stage: 'asking',
  read: true,
  type: 'Birthday',
  celebrant: 'Ice Casasola',
  location: null,
  date: null,
  pax: null,
  hosts: [{ name: 'Ice Casasola', askedYou: true }],
  requested: [{ name: 'Mobile bar' }, { name: 'Photo Booth' }],
  alsoOffer: [],
  alsoBooked: [],
  forYou: [],
  firstEvent: null,
} as never;

async function renderRow(r: RosterRow): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RosterRowView } = await import('./_components/customers-roster');
  return renderToStaticMarkup(React.createElement(RosterRowView, { r, nowMs: NOW, query: '', lines: LINES }));
}

test('1 · every Clients row — asking AND booked — opens the picked client with its page menu, never its own card', async () => {
  const roster = code('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  const view = roster.slice(roster.indexOf('export function RosterRowView('), roster.indexOf('export function CustomersRoster('));
  const tag = view.slice(view.indexOf('<SupplierOpenRow'), view.indexOf('lead={avatar}'));
  assert.match(tag, /opensTo=\{href\}/, 'a Clients row rises its own facts card again — it must open the picked client');
  assert.match(view, /const href = hrefFor\(r, today\);/, 'the row’s door is not the one open path');

  const cases: Array<[string, RosterRow, string]> = [
    ['an ask', row({ lane: 'waiting', waitingKind: 'inquiry', waitingSince: new Date(NOW).toISOString() }), '/vendor-dashboard/clients/e1?tab=chat'],
    ['a booked client', row({ lane: 'booked' }), '/vendor-dashboard/clients/e1?tab=details'],
  ];
  for (const [what, r, to] of cases) {
    const html = await renderRow(r);
    assert.match(html, new RegExp(`data-opens-to="${to.replace(/[?]/g, '\\?')}"`), `${what} does not open the picked client at ${to}`);
    assert.match(html, /data-fold-head=""[^>]*data-fold-rises=""/, `${what}'s head no longer rises`);
    assert.match(html, /aria-haspopup="dialog"/, `${what}'s head does not say it opens a screen`);
    // Never a card of its own: no risen screen, no answers; the body waits only in the shut (inert, hidden) fold body.
    assert.doesNotMatch(html, /data-inquiry-answers|data-rise-screen/, `${what} still draws a card of its own`);
    assert.doesNotMatch(html, /data-open-risen=/, `${what} rose its own body`);
    assert.match(html, /data-fold-body=""[^>]*inert=""/, `${what}'s body is shown instead of shut`);
    assert.doesNotMatch(html, /data-open-row=/, `${what} would be seated in the right column as a row that opens in place`);
  }

  // The picked client IS the shell with the nine-page menu (held by the-picked-client-has-nine-pages.test.ts).
  const shell = code('app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx');
  assert.match(shell, /<PickedShell\b/, 'the client no longer opens through the one picked shell');
});

test('2 · an ask is answered in the chat’s top band, once — never in the row', () => {
  const roster = code('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  assert.doesNotMatch(roster, /InquiryAnswers/, 'the Clients row answers an ask in place again — a card with no chat');
  const chat = code('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.equal((chat.match(/<InquiryAnswers\b/g) ?? []).length, 1, 'the chat draws its answers more than once (or not at all)');
  assert.match(chat, /data-chat-inquiry-card=""[\s\S]*?<EventLinesBody lines=\{askLines\} \/>[\s\S]*?<InquiryAnswers\b/, 'the chat lost the ask’s facts at its top');
});

test('3 · Accept lands in the chat — full screen it starts the quote; inside the picked client, its own Chat page', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { InquiryAnswers } = await import('../_components/event-lines');
  const act = async () => {};
  const returnsOf = (html: string) => [...html.matchAll(/name="return_to" value="([^"]*)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));

  // No landing named → the chat, never the card it was pressed on.
  const bare = returnsOf(
    renderToStaticMarkup(React.createElement(InquiryAnswers, { threadId: 't1', returnTo: '/vendor-dashboard/customers', acceptInquiry: act, declineInquiry: act })),
  );
  assert.deepEqual(bare, ['/vendor-dashboard/customers', '/vendor-dashboard/messages/t1', '/vendor-dashboard/messages/t1'], 'Decline · Ask · Accept land wrong (Accept must land in the chat)');

  // Inside the picked client: Ask and Accept stay on its Chat page.
  const inClient = returnsOf(
    renderToStaticMarkup(
      React.createElement(InquiryAnswers, {
        threadId: 't1',
        returnTo: '/vendor-dashboard/messages/t1',
        chatHref: '/vendor-dashboard/clients/e1?tab=chat',
        acceptInquiry: act,
        declineInquiry: act,
      }),
    ),
  );
  assert.deepEqual(inClient.slice(1), ['/vendor-dashboard/clients/e1?tab=chat', '/vendor-dashboard/clients/e1?tab=chat'], 'inside the picked client Accept leaves its chat');

  const lines = code('app/vendor-dashboard/_components/event-lines.tsx');
  assert.match(lines, /name="return_to" value=\{acceptTo \?\? chat\}/, 'Accept falls back to the card it sat on again');

  const chat = code('app/vendor-dashboard/messages/[threadId]/page.tsx');
  const card = chat.slice(chat.indexOf('<InquiryAnswers'), chat.indexOf('/>', chat.indexOf('<InquiryAnswers')));
  assert.match(card, /embedded\s*\?\s*\{ chatHref: `\/vendor-dashboard\/clients\/\$\{thread\.event_id\}\?tab=chat` \}/, 'inside the picked client the answers leave its Chat page');
  assert.match(card, /acceptTo: `\/vendor-dashboard\/messages\/\$\{threadId\}\?compose=quote`/, 'full screen, Accept no longer starts the quote in the chat');
});

test('4 · from 701 the row still opens beside the list — the door is the phone’s', () => {
  const row = code('app/vendor-dashboard/_components/supplier-open-row.tsx');
  assert.match(row, /if \(opensTo && !scope\?\.wide\) \{/, 'the door also takes over the right column from 701 (the wide Rise is Lane R’s owner pick)');
  assert.match(row, /rememberPickedOrigin\(box\.current\?\.closest\('\[data-customer-row\]'\) \?\? box\.current, to\)/, 'the picked client no longer rises from the tapped row');
});
