/**
 * a-supplier-row-opens-beside-itself.test.ts — supplier dashboard v13 (owner "Approved.", 2026-10-29): every Today row
 * and every Customers › Events row OPENS — in place on a phone, in the right column from 701 — and an event opens to
 * its fixed lines (owner: *"for inquiries. we can say what service they are requesting for. and we can show what
 * services they also have that are on the categories added by the event"* · *"where is the expand look of these
 * rows?"*).
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. ONE mechanism (`SupplierOpenRow` in a `SupplierOpenScope`): the row is the shared `Fold`; from 701 its body is
 *      PORTALED into the right column (`SupplierColumns`) and NOT also drawn under the row — one copy, no second form;
 *      the right column is never empty (the first row on screen, else the scope's `rest`); the row's one action sits
 *      BESIDE the head, never nested in it.
 *   2. Today and Customers › Events both use it — Today's three lists (asks · week · money) inside `TodayCounts`' scope,
 *      the Events rows inside `CustomersPin`'s; and the chat draws the same lines + answers at its top for a pending
 *      inquiry. No page draws a second accordion.
 *   3. The opened event says the fixed lines IN ORDER, marks the host who asked, names the service asked for, offers
 *      only this shop's services in categories the event added (and only while asking), and says "couldn't load" for a
 *      refused read — never an empty list that reads as "nobody".
 *   4. The batched read answers ONLY for events this shop holds a thread or a plan row on, and a refused hosts read is
 *      `null`, not `[]`.
 * Every assertion reads the code's own source or runs its own function; nothing is re-derived here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { EventLines } from '@/lib/supplier-event-lines';

(globalThis as unknown as { React: unknown }).React = React;
{
  // The batched read is `server-only`; the stand-in admin below is all it touches (the shared stub, as other guards do).
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&#x27;|&rsquo;|’/g, "'").replace(/\s+/g, ' ');

test('1 · one mechanism: the shared fold, the body portaled right from 701 and not drawn twice, never an empty column', () => {
  const row = code('app/vendor-dashboard/_components/supplier-open-row.tsx');
  assert.match(row, /import \{ Fold \} from '@\/app\/_components\/fold';/, 'the row is not the shared Fold');
  assert.match(row, /<SupplierColumns\b/, 'the scope does not draw the frame’s two columns');
  assert.match(row, /createPortal\(<PaneBody[^)]*>\{children\}<\/PaneBody>, scope\.pane\)/, 'the opened row is not drawn in the right column');
  assert.match(row, /\{scope\.wide \? null : children\}/, 'from 701 the body is drawn under the row AS WELL as on the right — two forms');
  assert.match(row, /open=\{!scope\.wide && isOpen\}/, 'from 701 the row also opens under itself');
  assert.match(row, /OPEN_ROW_WIDE_QUERY = '\(min-width: 701px\)'/, 'the right column no longer starts at the frame’s 701');
  assert.match(row, /shown\[0\]\?\.dataset\.openRow/, 'with nothing chosen the right column does not open the first row');
  assert.match(row, /openId === null \? <div[^>]*>\{rest\}<\/div>/, 'with no row at all the right column is empty');
  const fold = code('app/_components/fold.tsx');
  assert.match(fold, /\{head\}\s*\{endPress \? \(\s*<span className="flex flex-none items-center" data-fold-end="">/, 'the row’s action is not beside its head');
});

test('2 · Today and Customers › Events open their rows with it; the chat draws the same lines at its top', () => {
  assert.match(code('app/vendor-dashboard/_components/today-counts.tsx'), /<SupplierOpenScope name="today"[\s\S]*?\{panels\[key\]\}[\s\S]*?\{after\}\s*<\/SupplierOpenScope>/, 'Today’s lists are not in the two columns');
  const feed = code('app/vendor-dashboard/_components/overview-sections.tsx');
  const desk = feed.slice(feed.indexOf('export function WhatsNewFeed('), feed.indexOf('export function NothingToAnswerFeed('));
  assert.match(desk, /<SupplierOpenRow\b[\s\S]*?endPress=\{rowAct\(card, confirmLock\)\}/, 'a waiting row does not open, or lost its one action');
  assert.doesNotMatch(desk, /<Fold\b/, 'a waiting row draws a second accordion of its own');
  const first = code('app/vendor-dashboard/_components/supplier-today-first-screen.tsx');
  assert.equal((first.match(/<OpenedRow\b/g) ?? []).length, 2, 'a week or money row does not open');
  assert.match(code('app/vendor-dashboard/customers/_components/customers-roster.tsx'), /<SupplierOpenRow\b[\s\S]*?<EventLinesBody lines=\{lines\} \/>/, 'an Events row does not open to its lines');
  assert.match(code('app/vendor-dashboard/customers/page.tsx'), /<CustomersPin[\s\S]*?columns=\{\{ rest:/, 'Customers › Events is not in the two columns');
  const chat = code('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(chat, /data-chat-inquiry-card=""[\s\S]*?<EventLinesBody lines=\{askLines\} \/>[\s\S]*?<InquiryAnswers\b/, 'the chat has no inquiry card at its top');
  // The one batched read, on every surface — never a read per row.
  for (const rel of ['app/vendor-dashboard/page.tsx', 'app/vendor-dashboard/customers/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx']) {
    assert.equal((code(rel).match(/readSupplierEventLines\(/g) ?? []).length, 1, `${rel} reads the lines more than once (or not at all)`);
  }
});

const LINES: EventLines = {
  eventId: 'e1',
  threadId: 't1',
  stage: 'asking',
  read: true,
  type: 'Debut',
  celebrant: 'Kat Arroyo',
  location: 'Blue Leaf Filipinas, Pasay',
  date: 'Sun, Feb 14, 2027',
  pax: 120,
  hosts: [
    { name: 'Tita Mina Arroyo', askedYou: true },
    { name: 'Kat Arroyo', askedYou: false },
  ],
  requested: [{ name: 'Coordinator / Planner' }],
  alsoOffer: [{ serviceId: 's2', name: 'Styling', from: null }],
  alsoBooked: [],
  forYou: [{ key: 'card', label: 'Their event card', line: 'Notes, files, quote and payments', href: '/vendor-dashboard/clients/e1?tab=details' }],
  firstEvent: null,
};

test('3 · the opened event says the fixed lines in order, the asker marked — and "couldn’t load", never "nobody"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EventLinesBody } = await import('./event-lines');
  const t = text(renderToStaticMarkup(React.createElement(EventLinesBody, { lines: LINES })));
  const order = ['Event type', 'Celebrant', 'Hosted by', 'Location', 'Date', 'Est. pax', 'Service requested', 'You also offer', 'For your service', 'Also booked'];
  let at = -1;
  for (const k of order) {
    const i = t.indexOf(k, at + 1);
    assert.ok(i > at, `"${k}" is missing or out of order in: ${t.slice(0, 400)}`);
    at = i;
  }
  assert.match(t, /Tita Mina Arroyo Asked you/, 'the host who asked is not marked');
  assert.match(t, /Coordinator \/ Planner Asking/, 'the service asked for is not named with its stage');
  assert.match(t, /Styling They added this to their plan/);

  const refused = text(
    renderToStaticMarkup(
      React.createElement(EventLinesBody, { lines: { ...LINES, read: false, hosts: null, requested: null, alsoBooked: null, alsoOffer: [], stage: 'booked' } }),
    ),
  );
  assert.match(refused, /Couldn't load who hosts this/);
  assert.match(refused, /Couldn't load what they asked for/);
  assert.match(refused, /Couldn't load who else they booked/);
  assert.match(refused, /Event type couldn't load/);
  assert.doesNotMatch(refused, /No host has joined|haven't named a service|No other suppliers booked/, 'a refused read reads as "nobody"');
  assert.doesNotMatch(refused, /You also offer/, '"You also offer" shows after the ask is answered');
});

test('3b · the rules: asker first; only categories the event added, only while asking; each family its own pages', async () => {
  const { alsoOfferFrom, forYourServicePages, hostsInOrder } = await import('@/lib/supplier-event-lines');
  const names = new Map([
    ['u1', 'Kat Arroyo'],
    ['u2', 'Tita Mina Arroyo'],
  ]);
  assert.deepEqual(hostsInOrder(['u1', 'u2'], 'u2', names), [
    { name: 'Tita Mina Arroyo', askedYou: true },
    { name: 'Kat Arroyo', askedYou: false },
  ]);
  const services = [
    { id: 'coord', name: 'Full coordination', category: 'coordinator', fromPhp: null },
    { id: 'style', name: 'Styling', category: 'stylist', fromPhp: 25000 },
    { id: 'cake', name: 'Cakes', category: 'cake', fromPhp: null },
  ];
  const offer = alsoOfferFrom({ stage: 'asking', services, requestedIds: new Set(['coord']), eventCategories: ['coordinator', 'stylist'] });
  assert.deepEqual(offer.map((o) => o.serviceId), ['style'], 'offered a service outside the event’s categories, or the one they asked for');
  assert.equal(offer[0]!.from, 'from ₱25,000');
  assert.deepEqual(alsoOfferFrom({ stage: 'booked', services, requestedIds: new Set(), eventCategories: ['stylist'] }), [], '"You also offer" outlived the ask');

  const pages = (svc: string[], stage: 'asking' | 'booked') =>
    forYourServicePages({ eventId: 'e1', stage, shopServices: svc, eventTiles: null }).map((d) => d.key);
  assert.deepEqual(pages(['coordinator'], 'booked'), ['seats', 'run', 'card'], 'a coordinator does not get the seat plan and run of show');
  assert.deepEqual(pages(['catering'], 'booked'), ['sheet', 'card'], 'a caterer does not get the production sheet');
  const asking = forYourServicePages({ eventId: 'e1', stage: 'asking', shopServices: ['catering'], eventTiles: null });
  assert.match(asking.find((d) => d.key === 'sheet')!.line, /once they book you/, 'the production sheet promises a page it will refuse');
});

/** A stand-in admin client: each table answers its fixture rows (or a refusal), and records every filter it was given. */
function fakeAdmin(tables: Record<string, unknown[] | 'refused'>) {
  const from = (table: string) => {
    const result = () =>
      tables[table] === 'refused'
        ? { data: null, error: { message: `${table} refused` } }
        : { data: (tables[table] as unknown[]) ?? [], error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'in', 'is', 'order']) chain[m] = () => chain;
    chain.then = (ok: (v: unknown) => unknown, bad?: (e: unknown) => unknown) => Promise.resolve(result()).then(ok, bad);
    return chain;
  };
  return { from } as never;
}

test('4 · the read answers only for this shop’s events, and a refused hosts read is null — never "nobody"', async () => {
  const { readSupplierEventLines } = await import('@/lib/supplier-event-lines.server');
  const base = {
    chat_threads: [{ thread_id: 't1', event_id: 'mine', created_by_user_id: 'u2', pax_at_inquiry: 120, pax_current: null, is_returning: false, updated_at: '2026-10-29' }],
    events: [
      { event_id: 'mine', display_name: 'Kat Arroyo', event_type: 'debut', venue_name: null, event_date: '2027-02-14', event_date_precision: 'day', estimated_pax: 100 },
      { event_id: 'theirs', display_name: 'Not yours', event_type: 'wedding', venue_name: 'X', event_date: '2027-01-01', event_date_precision: 'day', estimated_pax: 50 },
    ],
    event_members: [{ event_id: 'mine', user_id: 'u1' }, { event_id: 'mine', user_id: 'u2' }],
    event_vendors: [{ event_id: 'mine', marketplace_vendor_id: 'shop', category: 'coordinator', service_id: null, requested_service_ids: null, status: 'shortlist', vendor_name: 'Shop' }],
    vendor_services: [],
    users: [{ user_id: 'u1', display_name: 'Kat Arroyo', first_name: 'Kat' }, { user_id: 'u2', display_name: 'Tita Mina Arroyo', first_name: 'Mina' }],
  };
  const input = { vendorProfileId: 'shop', shopServices: ['coordinator'], events: [{ eventId: 'mine', stage: 'asking' as const }, { eventId: 'theirs', stage: 'asking' as const }] };
  const got = await readSupplierEventLines(fakeAdmin(base), input);
  assert.deepEqual([...got.keys()], ['mine'], 'an event this shop holds no thread or plan row on was answered for');
  const l = got.get('mine')!;
  assert.equal(l.hosts?.[0]?.name, 'Tita Mina Arroyo');
  assert.equal(l.hosts?.[0]?.askedYou, true);
  assert.equal(l.pax, 120, 'the count they asked with is not the one shown');
  assert.equal(l.location, null, 'a venue never set is invented');
  assert.equal(l.requested?.length, 1, 'the service asked for (their plan row’s category) is missing');
  assert.ok(l.requested![0]!.name.trim(), 'the service asked for has no name');

  const refused = await readSupplierEventLines(fakeAdmin({ ...base, event_members: 'refused' }), input);
  assert.equal(refused.get('mine')!.hosts, null, 'a refused hosts read reads as "nobody hosts this"');
});
