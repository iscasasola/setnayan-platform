/**
 * 🚪 ONE OPEN PATH (Build 2 row #38, prototype v116 `openClient` + `startPage`, owner's 8 Nov plan).
 *
 * Every row that stands for a client opens THAT client's dashboard through ONE function pair —
 * `clientLandingPage` (which page, by the row's kind) → `customerCardHref` (the link) — never a hand-built
 * `/vendor-dashboard/clients/…` or a jump to the full-screen chat. This holds the table, the Clients list rows, the
 * tile rows, Today's Reply cards, and the unbooked Payment landing.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clientLandingPage, openClientHref } from '@/lib/upcoming-schedule-door';
import { doorWordsFor, hrefFor, nextStepLabel, type RosterRow } from './_components/customers-roster';
import { clientPageHref } from './clients-tiles';
import { visiblePickedPage } from '../clients/[eventId]/_components/picked-client-menu';

const HERE = dirname(fileURLToPath(import.meta.url));

test('the landing table, in the prototype’s order', () => {
  assert.equal(clientLandingPage({ page: 'schedule', booked: true }), 'schedule', 'an explicit page wins');
  assert.equal(clientLandingPage({ page: 'payments', booked: false }), 'quote', 'no Payment page before booking');
  assert.equal(clientLandingPage({ page: 'hub', booked: false }), 'details');
  assert.equal(clientLandingPage({ page: 'chat', hasChat: false }), 'details', 'never a Chat with nothing to open');
  assert.equal(clientLandingPage({ payDue: true, booked: true, unread: true, hasChat: true }), 'payments', 'money due comes first');
  assert.equal(clientLandingPage({ payDue: true, booked: false }), 'quote');
  assert.equal(clientLandingPage({ unread: true, hasChat: true, quoted: true }), 'chat', 'unread before quoted');
  assert.equal(clientLandingPage({ asking: true, hasChat: true }), 'chat');
  assert.equal(clientLandingPage({ asking: true, hasChat: false }), 'details');
  assert.equal(clientLandingPage({ quoted: true }), 'quote');
  assert.equal(clientLandingPage({ booked: true, eventToday: true }), 'hub');
  assert.equal(clientLandingPage({ booked: true }), 'details');
  assert.equal(clientLandingPage({}), 'details');
  assert.equal(openClientHref('e1', { quoted: true }), '/vendor-dashboard/clients/e1?tab=quote');
});

test('a Clients row opens its client on the page its kind means — and its words say where', () => {
  const row = (o: Partial<RosterRow>) =>
    ({ eventId: 'e1', lane: 'booked', waitingKind: null, threadId: 't1', eventDate: '2026-12-01', quoted: false, ...o }) as RosterRow;
  assert.equal(hrefFor(row({ lane: 'waiting', waitingKind: 'inquiry' })), '/vendor-dashboard/clients/e1?tab=chat');
  assert.equal(hrefFor(row({ lane: 'waiting', waitingKind: 'booking_ask' })), '/vendor-dashboard/clients/e1?tab=details');
  assert.equal(hrefFor(row({ lane: 'holding' })), '/vendor-dashboard/clients/e1?tab=chat');
  assert.equal(hrefFor(row({ lane: 'talking', quoted: true })), '/vendor-dashboard/clients/e1?tab=quote');
  assert.equal(hrefFor(row({ lane: 'talking' })), '/vendor-dashboard/clients/e1?tab=quote');
  assert.equal(hrefFor(row({ lane: 'booked' })), '/vendor-dashboard/clients/e1?tab=details');
  assert.equal(hrefFor(row({ lane: 'booked' }), '2026-12-01'), '/vendor-dashboard/clients/e1?tab=hub', 'the event day opens the Hub');
  assert.equal(hrefFor(row({ lane: 'finished' })), '/vendor-dashboard/clients/e1?tab=details');
  assert.equal(hrefFor(row({ lane: 'waiting', waitingKind: 'inquiry', threadId: null })), '/vendor-dashboard/clients/e1?tab=details');
  assert.equal(nextStepLabel(row({ lane: 'booked' })), 'See details');
  // The door's words follow the landing — never "Open the chat" over a Details landing.
  assert.equal(doorWordsFor(row({ lane: 'booked' })).label, 'Open their details');
  assert.equal(doorWordsFor(row({ lane: 'holding' })).label, 'Open the chat');
  assert.equal(doorWordsFor(row({ lane: 'talking' })).label, 'Open the quotation');
});

test('a Clients row’s OWN press goes through the path — not only its door (owner 11 Nov)', async () => {
  // The v118 #38 landing shipped as a function, but the row itself still opened a card of its own; the owner pressed an
  // Asking row and got a sheet with no page menu and no chat. The press is held here, rendered: the row's door IS hrefFor.
  const React = (await import('react')).default;
  (globalThis as unknown as { React: unknown }).React = React;
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { RosterRowView } = await import('./_components/customers-roster');
  const row = (o: Partial<RosterRow>) =>
    ({ eventId: 'e1', lane: 'booked', waitingKind: null, waitingSince: null, threadId: 't1', eventDate: '2026-12-01', quoted: false, title: 'A & B', identityRevealed: true, kind: 'Wedding', note: null, returning: false, ...o }) as RosterRow;
  for (const r of [
    row({ lane: 'waiting', waitingKind: 'inquiry' }),
    row({ lane: 'waiting', waitingKind: 'booking_ask' }),
    row({ lane: 'holding' }),
    row({ lane: 'talking', quoted: true }),
    row({ lane: 'booked' }),
    row({ lane: 'finished' }),
  ]) {
    const html = renderToStaticMarkup(React.createElement(RosterRowView, { r, nowMs: Date.UTC(2026, 10, 11), query: '' }));
    const to = hrefFor(r, '2026-11-11');
    assert.ok(to?.startsWith('/vendor-dashboard/clients/e1?tab='), `${r.lane} does not open the picked client`);
    assert.ok(html.includes(`data-opens-to="${to}"`), `a ${r.lane}${r.waitingKind ? ` (${r.waitingKind})` : ''} row's own press does not open ${to}`);
  }
});

test('tile rows and Today’s Reply cards go through the same path; no client link is built by hand', () => {
  assert.equal(clientPageHref('e1', 'payments'), '/vendor-dashboard/clients/e1?tab=payments');
  assert.equal(clientPageHref('e1', 'payments', { booked: false }), '/vendor-dashboard/clients/e1?tab=quote');
  const tiles = readFileSync(join(HERE, 'clients-tiles.ts'), 'utf8');
  const roster = readFileSync(join(HERE, '_components', 'customers-roster.tsx'), 'utf8');
  for (const [name, src] of [['clients-tiles.ts', tiles], ['customers-roster.tsx', roster]] as const) {
    assert.doesNotMatch(src, /`\/vendor-dashboard\/(clients|messages)\/\$\{/, `${name} builds a client link by hand again`);
  }
  const today = readFileSync(join(HERE, '..', '..', '..', 'lib', 'supplier-today.ts'), 'utf8');
  assert.match(today, /target: \{ to: 'card', eventId: card\.eventId, tab: 'chat' \},/, 'an unread message no longer opens the client’s Chat');
  // The page drawn for an unbooked client asked for Payment is the Quotation (every old door, every notification).
  assert.equal(visiblePickedPage('payments', false), 'quote');
});
