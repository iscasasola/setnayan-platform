/**
 * customers-are-events.test.ts — 🔒 CUSTOMERS › EVENTS: one row per EVENT, never per person.
 *
 * Owner 2026-10-29, DECISION_LOG "SUPPLIER MENUS … CUSTOMERS ARE EVENTS, NOT PEOPLE", verbatim: *"Customers: my question
 * is people? is the they event the customer and not just the people? because a people can have multiple events? and in
 * one event, can have multiple cohost?"* ⇒ "Customers' first section is EVENTS (one row per event, e.g. 'Indalecio &
 * Claire · Wedding · Dec 18'); a person with two events = two rows; inside an event its people are listed together".
 * Re-reported on the live dashboard 2026-10-30: *"supplier dashboard>Customers still show people and not events"* — the
 * menu still said People ▾, and each row led with one person's first name and repeated the couple under it.
 *
 * What this holds:
 *   1. the menu's first section is the word "Events" — on the phone's picker and on the bar's page menu;
 *   2. the old `?seg=people` address forwards to Events, every other param kept, BEFORE anything is drawn;
 *   3. a row is titled with the EVENT ("Indalecio & Claire · Wedding · Dec 18"); the same hosts with two events are two
 *      rows with two titles; the row's line says what the event wants, never a person's name again;
 *   4. the list is headed EVENTS, and its found line counts events;
 *   5. a booked row's money is price · paid · next (owner: "the supplier's own money stays in the row's top line").
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets `"jsx": "preserve"`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { computeEventMoneyPositions } from '@/lib/vendor-customers';
import type { RosterRow } from './_components/customers-roster';
import { CUSTOMER_SEGMENTS, CUSTOMER_SEGMENT_LABEL, customersSegmentOf, oldPeopleAddressForward } from './segments';
import { supplierPageMenuOf } from '../_components/supplier-page-menu';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = dirname(fileURLToPath(import.meta.url));
const code = (...rel: string[]) => stripComments(readFileSync(join(HERE, ...rel), 'utf8'));
const PAGE = code('page.tsx');
const NOW = Date.UTC(2026, 9, 29, 2);

test('1 · the first section is "Events" — on the phone picker and on the bar’s page menu; no "People" left', () => {
  assert.equal(CUSTOMER_SEGMENTS[0], 'events');
  assert.equal(CUSTOMER_SEGMENT_LABEL[CUSTOMER_SEGMENTS[0]], 'Events');
  assert.ok(!Object.values(CUSTOMER_SEGMENT_LABEL).includes('People'), 'a Customers section is called People again');
  const menu = supplierPageMenuOf('/vendor-dashboard/customers', null);
  assert.deepEqual(menu?.sections?.map((s) => s.label), ['Events', 'Dates', 'Money']);
  assert.equal(menu?.section, 'Events');
});

test('2 · the old ?seg=people lands on Events, every other param kept — and the page forwards it before drawing', () => {
  assert.equal(customersSegmentOf({ seg: 'people' }), 'events', 'the old address opens a blank view');
  assert.equal(oldPeopleAddressForward({ seg: 'people' }), '/vendor-dashboard/customers');
  assert.equal(
    oldPeopleAddressForward({ seg: 'people', door: 'booked', q: 'ana', block: 'b1' }),
    '/vendor-dashboard/customers?door=booked&q=ana&block=b1',
  );
  for (const sp of [{}, { seg: 'events' }, { seg: 'dates' }, { seg: 'money' }, { door: 'booked' }]) {
    assert.equal(oldPeopleAddressForward(sp), null, `${JSON.stringify(sp)} is forwarded — only the old address is`);
  }
  const hub = PAGE.slice(PAGE.indexOf('export default async function VendorCustomersHub('));
  const fwd = hub.indexOf('const forward = oldPeopleAddressForward(sp);');
  assert.ok(fwd > 0, 'the page no longer forwards the old address');
  assert.match(hub.slice(fwd, fwd + 120), /if \(forward\) redirect\(forward\);/);
  assert.ok(fwd < hub.indexOf('customersSegmentOf(sp)'), 'the page decides the view before forwarding the old address');
});

const row = (over: Partial<RosterRow>): RosterRow => ({
  eventId: 'e1',
  lane: 'booked' as const,
  waitingKind: null,
  waitingSince: null,
  expiresAt: null,
  quietDays: null,
  title: 'Indalecio & Claire',
  identityRevealed: true,
  eventDate: '2026-12-18',
  place: 'Seda Vertis North',
  threadId: 't1',
  eventVendorId: 'ev1',
  note: { text: '₱65,000 · ₱25,000 paid · next ₱20,000 Nov 18', tone: 'quiet' as const },
  kind: 'Wedding',
  quoted: false,
  returning: false,
  ...over,
});

const lines = (eventId: string, requested: string[], pax: number | null) =>
  ({
    eventId,
    threadId: `t-${eventId}`,
    stage: 'booked',
    read: true,
    type: 'Wedding',
    celebrant: 'Indalecio & Claire',
    location: null,
    date: null,
    pax,
    hosts: [
      { name: 'Claire Buanhog', askedYou: true },
      { name: 'Indalecio Casasola II', askedYou: false },
    ],
    requested: requested.map((name) => ({ name })),
    alsoOffer: [],
    alsoBooked: [],
    forYou: [],
    firstEvent: null,
  }) as never;

async function render(rows: RosterRow[], extra: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomersRoster } = await import('./_components/customers-roster');
  return renderToStaticMarkup(
    React.createElement(CustomersRoster, {
      rows,
      paged: { items: rows, page: 1, pageCount: 1, total: rows.length, start: 1, end: rows.length } as never,
      query: '',
      incomplete: false,
      pagerKeepParams: '',
      counts: { waiting: 1, holding: 0, talking: 0, booked: 1, finished: 0 },
      nowMs: NOW,
      holdingPerDate: new Map(),
      anchor: null,
      ...extra,
    } as never),
  );
}

test('3 · a row is the EVENT: its whole name · kind · day; two events of the same hosts are two rows; no person in the line', async () => {
  const wedding = row({ eventId: 'w' });
  const lunch = row({
    eventId: 'l',
    lane: 'waiting',
    waitingKind: 'inquiry',
    waitingSince: new Date(NOW - 5 * 3_600_000).toISOString(),
    kind: 'Thanksgiving lunch',
    eventDate: '2026-12-19',
    note: null,
  });
  const html = await render([lunch, wedding], {
    lines: { w: lines('w', ['Coordinator / Planner', 'Styling'], 180), l: lines('l', ['Styling'], 40) },
  });
  assert.equal((html.match(/data-customer-row="/g) ?? []).length, 2, 'the same hosts’ two events are not two rows');
  assert.match(html, /Indalecio &amp; Claire · Wedding · Dec 18/, 'the wedding row is not named by its event');
  assert.match(html, /Indalecio &amp; Claire · Thanksgiving lunch · Dec 19/, 'the second event of the same hosts is not its own row');
  assert.doesNotMatch(html, /Indalecio(&#x27;|')s /, 'a row is named after one person again');
  // The line says what the event wants and where it stands — never the couple a second time.
  assert.match(html, /Asks for Styling · ~40 guests · waiting 5 hours|Asks for Styling · ~40 guests · asked today/, 'an inquiry row does not say what it asks for');
  assert.match(html, /Coordinator \/ Planner \+ Styling · ₱65,000 · ₱25,000 paid · next ₱20,000 Nov 18/, 'a booked row does not say its services and money');
  const subs = [...html.matchAll(/data-fold-sub="">([^<]*)</g)];
  assert.equal(subs.length, 2, 'a row lost its one line');
  for (const m of subs) {
    assert.doesNotMatch(m[1]!, /Indalecio|Claire/, `a row's line names a person: "${m[1]}"`);
  }
});

test('4 · the list is headed EVENTS, and a search counts events', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EventsHeading } = await import('./_components/customers-roster');
  const head = renderToStaticMarkup(React.createElement(EventsHeading));
  assert.match(head, /data-customers-heading="events"/);
  assert.match(head, />Events</, 'the list heading does not say Events');
  assert.match(PAGE, /between=\{\s*<>\s*<EventsHeading \/>/, 'the Events list lost its heading');
  const found = await render([row({})], { query: 'indalecio', counts: { waiting: 0, holding: 0, talking: 0, booked: 3, finished: 0 } });
  assert.match(found, /1 of 3 events/, 'the found line counts customers, not events');
  assert.match(PAGE, /placeholder="Search events"/, 'the search box does not say what it searches');
});

test('5 · a booked row’s money is price · paid · next — the frozen plan’s, the next one the earliest still to come', () => {
  const m = computeEventMoneyPositions([
    { event_vendor_id: 'v', event_id: 'e', event_name: 'x', event_date: null, seq: 1, label: 'Deposit', amount_php: 25_000, due_date: '2026-09-01', confirmed: true },
    { event_vendor_id: 'v', event_id: 'e', event_name: 'x', event_date: null, seq: 3, label: 'Balance', amount_php: 20_000, due_date: '2026-12-01', confirmed: false },
    { event_vendor_id: 'v', event_id: 'e', event_name: 'x', event_date: null, seq: 2, label: 'Second', amount_php: 20_000, due_date: '2026-11-18', confirmed: false },
  ]).get('e')!;
  assert.equal(m.expectedPhp, 65_000);
  assert.equal(m.collectedPhp, 25_000);
  assert.deepEqual(m.nextDue, { amountPhp: 20_000, dueDate: '2026-11-18' });
  const fn = PAGE.slice(PAGE.indexOf('function moneyNote('), PAGE.indexOf('\nfunction ', PAGE.indexOf('function moneyNote(') + 10));
  assert.match(fn, /\[formatPhp\(m\.expectedPhp\), `\$\{formatPhp\(m\.collectedPhp\)\} paid`, next\]/, 'the booked row lost price · paid · next');
  // Honest first: an unread payday still says so before any figure.
  assert.ok(fn.indexOf("if (unread) return { text: 'couldn’t load'") < fn.indexOf('formatPhp(m.expectedPhp)'));
});

test('6 · inside an event its people are listed together, each with their role — and the booked coordinator', async () => {
  const { hostRoleWord, hostsInOrder } = await import('@/lib/supplier-event-lines');
  assert.equal(hostRoleWord({ guestRole: 'bride', seatKind: null, madeIt: true }), 'Bride', 'the honoree is not named as the Bride');
  assert.equal(hostRoleWord({ guestRole: 'guest', seatKind: 'co_host', madeIt: false }), 'Co-host');
  assert.equal(hostRoleWord({ guestRole: null, seatKind: null, madeIt: true }), 'Host');
  assert.equal(hostRoleWord({ guestRole: 'bridesmaid', seatKind: null, madeIt: false }), null, 'a guest role that is not the honoree’s is called a host role');
  assert.equal(hostRoleWord({ guestRole: 'bride', seatKind: null, madeIt: false, names: { bride: { one: 'Ate Bride' } } as never }), 'Ate Bride', 'the couple’s own word for the role is not used');
  const names = new Map([
    ['u1', 'Indalecio Casasola II'],
    ['u2', 'Claire Buanhog'],
    ['u3', 'Ate Lorna Buanhog'],
  ]);
  const roles = new Map<string, string | null>([
    ['u1', 'Groom'],
    ['u2', 'Bride'],
    ['u3', 'Co-host'],
  ]);
  assert.deepEqual(hostsInOrder(['u1', 'u2', 'u3'], 'u2', names, roles), [
    { name: 'Claire Buanhog', askedYou: true, role: 'Bride' },
    { name: 'Indalecio Casasola II', askedYou: false, role: 'Groom' },
    { name: 'Ate Lorna Buanhog', askedYou: false, role: 'Co-host' },
  ]);
  // The read: every host of the event (couple + co-hosts are `couple` members), their guest role and seat, and the booked
  // coordinator joins the list.
  const SERVER = stripComments(readFileSync(join(HERE, '..', '..', '..', 'lib', 'supplier-event-lines.server.ts'), 'utf8'));
  assert.match(SERVER, /from\('event_members'\)\.select\('event_id, user_id, guest_id, joined_via'\)\.eq\('member_type', 'couple'\)/);
  assert.match(SERVER, /\.\.\.bookedCoordinators\(eventId\)/, 'the booked coordinator is not in Hosted by');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EventLinesBody } = await import('../_components/event-lines');
  const html = renderToStaticMarkup(
    React.createElement(EventLinesBody, {
      lines: { ...(lines('w', ['Styling'], 180) as object), hosts: [{ name: 'Claire Buanhog', askedYou: true, role: 'Bride' }, { name: 'You', askedYou: false, role: 'Coordinator' }] } as never,
    }),
  );
  assert.match(html, /Claire Buanhog<\/span><span class="[^"]*" data-event-lines-host-role="">Bride</, 'a host’s role is not drawn under their name');
  assert.match(html, />You<\/span><span class="[^"]*" data-event-lines-host-role="">Coordinator</);
});
