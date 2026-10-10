/**
 * people-says-the-closed-lines.test.ts — S-PR2 of the supplier dashboard
 * redesign: Customers › People (corpus
 * `SUPPLIER_DASHBOARD_REDESIGN_2026-10-08_fable.md` § 2 "Customers" + § 6 row
 * S-PR2; prototype `prototypes/supplier_dashboard_2026-10-08_fable.html`
 * frame 03).
 *
 * What this file holds is what the redraw could lose with nothing turning red:
 *
 *   · THE SAME-COMMIT RULE (owner answer 3, 2026-10-10). Today's "Nothing to
 *     answer" list goes ONLY in the change that shows its facts on People. One
 *     without the other is a fact shown nowhere — so both halves are asserted
 *     in ONE test.
 *   · A READ THAT FAILED MUST NOT READ AS A FACT. An unread quote is not "send
 *     a quote"; unread money is not "no plan yet"; unread flags are said.
 *   · ONE LIST, NOT TWO. An outside client and the kept notes are rows here.
 *   · A FRAGMENT IS INVISIBLE TO THE SERVER. `#payday` on People scrolls
 *     nowhere, so the link carries its segment.
 *
 * The row's words are EXECUTED (`peopleRowView`), and the list is RENDERED —
 * nothing here matches a phrase in a comment.
 *
 * SABOTAGE, each seen red before this shipped (the commit message has the runs):
 *   1 · `quoted: null` drawn as "send a quote"                → test 3
 *   2 · the lapsed-ask branch removed from `peopleRowView`    → tests 2 and 9
 *   3 · `<NothingToAnswerFeed>` put back on Today             → test 7
 *   4 · the closed-lines read dropped from the Customers page → test 7
 *   5 · `.eq('initiated_by', 'couple')` dropped from the new reader → test 8
 *   6 · `customerLandingHref('payday')` losing its segment    → test 11
 *   7 · the outside row made a link                            → test 9
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import type { PipelineCustomer } from '@/lib/vendor-customer-pipeline';
import type { PaydayInstallmentRow } from '@/lib/vendor-cashflow';
import { NO_FACTS, eventLine, moneyLine, nextDueByEvent, peopleRowView, type PeopleFacts } from './people-row';
import {
  ANCHOR_SEGMENT,
  CUSTOMER_SEGMENTS,
  SECTION_SEGMENT,
  customerLandingHref,
  customerLandingSegment,
  customersSegment,
  customersSegmentHref,
} from './anchors';
import type { RosterRow } from './_components/customers-roster';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const WEB = join(import.meta.dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

const NOW = Date.parse('2026-10-02T02:00:00Z'); // Fri Oct 2, 10:00 in Manila
const ago = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const ahead = (h: number) => new Date(NOW + h * 3_600_000).toISOString();

const person = (o: Partial<PipelineCustomer> & Pick<PipelineCustomer, 'eventId' | 'lane' | 'title'>): PipelineCustomer => ({
  waitingKind: null,
  waitingSince: null,
  expiresAt: null,
  quietDays: null,
  identityRevealed: true,
  eventDate: null,
  place: null,
  threadId: null,
  eventVendorId: null,
  ...o,
});
const facts = (o: Partial<PeopleFacts> = {}): PeopleFacts => ({ ...NO_FACTS, quoted: false, moneyRead: true, ...o });
const plan = (expectedPhp: number, collectedPhp: number) => ({
  expectedPhp,
  collectedPhp,
  balancePhp: Math.max(0, expectedPhp - collectedPhp),
  fullyPaid: expectedPhp > 0 && collectedPhp >= expectedPhp,
  allUnresolved: false,
  installmentCount: 2,
});

const ANA = person({ eventId: 'ana', lane: 'waiting', waitingKind: 'inquiry', waitingSince: ago(2), title: 'Ana & Miguel', eventDate: '2027-03-13', place: 'Tagaytay', threadId: 't-ana' });
const ROLANDO = person({ eventId: 'rc', lane: 'waiting', waitingKind: 'booking_ask', waitingSince: ago(20), expiresAt: ahead(28), title: 'Rolando & Carmen', eventDate: '2026-11-21', place: 'Makati', threadId: 't-rc', eventVendorId: 'ev-rc' });
const KATRINA = person({ eventId: 'ko', lane: 'talking', title: 'Katrina Ocampo', eventDate: '2026-10-03', place: 'Tagaytay', threadId: 't-ko' });
const CRUZ = person({ eventId: 'jc', lane: 'booked', title: 'Jun & Liza Cruz', eventDate: '2026-10-04', place: 'Makati', threadId: 't-jc' });
const LOURDES = person({ eventId: 'lb', lane: 'booked', title: 'Lourdes Bautista', eventDate: '2026-10-10', place: 'QC', threadId: 't-lb' });
const PAOLO = person({ eventId: 'pv', lane: 'finished', title: 'Paolo & Nina', eventDate: '2026-08-15', place: 'Cebu', threadId: 't-pv' });
const LAPSED = person({ eventId: 'jo', lane: 'waiting', waitingKind: 'booking_ask', waitingSince: ago(200), expiresAt: ago(30), title: 'Jo & Sam', eventDate: '2026-12-05', eventVendorId: 'ev-jo' });
const HOLDING = person({ eventId: 'md', lane: 'holding', quietDays: 9, title: 'Mara & Dan', eventDate: '2027-02-14', threadId: 't-md' });

/* ═══ A · WHAT A ROW SAYS (executed) ═══════════════════════════════════════ */

test('1 · the six rows the prototype draws say what it draws — pill and one line', () => {
  const got = [
    peopleRowView(ANA, facts(), NOW),
    peopleRowView(ROLANDO, facts(), NOW),
    peopleRowView(KATRINA, facts({ quoted: true }), NOW),
    peopleRowView(CRUZ, facts({ money: plan(85_000, 43_000), nextDue: { amountPhp: 42_000, dueDate: '2026-10-03' } }), NOW),
    peopleRowView(LOURDES, facts({ money: plan(30_000, 30_000) }), NOW),
    peopleRowView(PAOLO, facts({ money: plan(60_000, 60_000) }), NOW),
  ].map((v) => [v.pill.label, v.pill.tone, v.line, v.opens]);
  assert.deepEqual(got, [
    ['Asked', 'ask', 'waiting 2 h', 'thread'],
    ['Booking', 'warn', 'asked to book', 'card'],
    ['Quoted', 'quiet', 'quote pending', 'card'],
    ['Booked', 'ok', '₱42,000 due Oct 3', 'card'],
    ['Booked', 'ok', 'paid in full', 'card'],
    // The prototype draws "reply to review" here. The roster does not read
    // reviews (Today's queue carries that ask), so a done row says its money.
    ['Done', 'quiet', 'paid in full', 'card'],
  ]);
  assert.equal(eventLine({ type: 'Wedding', date: '2027-03-13', place: 'Tagaytay' }), 'Wedding · Mar 13, 2027 · Tagaytay');
  assert.equal(eventLine({ type: null, date: null, place: null }), 'Date not set', 'a missing date is said — never left blank, never "Free"');
});

test('2 · the three closed lines are the row’s own line — the SAME predicates the desk uses', async () => {
  const { lockAskPhase } = await import('@/lib/answers-desk');
  // The fixture really is lapsed by the desk's rule (and not yet dropped).
  assert.equal(lockAskPhase(LAPSED.expiresAt, NOW), 'lapsed');
  const closed = peopleRowView(LAPSED, facts(), NOW);
  assert.deepEqual([closed.pill.label, closed.pill.tone, closed.closed, closed.opens], ['Closed', 'quiet', 'window', 'card']);
  assert.match(closed.line ?? '', /^booking window closed Oct 1$/, `said "${closed.line}"`);
  // Still closed long after the desk dropped the card: expiry is lazy, the row never says "asked to book" again.
  const old = peopleRowView({ ...LAPSED, expiresAt: ago(24 * 30) }, facts(), NOW);
  assert.equal(old.closed, 'window');

  // ALREADY SWEPT to `expired`: the row is no longer a booking ask (it fell back to its thread's lane), so the
  // page hands the deadline in — the fact must not vanish the moment the sweep runs.
  const swept = peopleRowView(HOLDING, facts({ askClosedAt: ago(30) }), NOW);
  assert.deepEqual([swept.pill.label, swept.line, swept.closed], ['Closed', 'booking window closed Oct 1', 'window']);
  assert.match(
    code('app/vendor-dashboard/customers/page.tsx'),
    /b\.lock_request_state === 'expired' && lockAskPhase\(b\.lock_request_expires_at, rosterNowMs\) === 'lapsed'/,
    'a swept ask is no longer handed to the row',
  );

  const delay = peopleRowView(CRUZ, facts({ delayFlagged: true, money: plan(85_000, 85_000) }), NOW);
  assert.deepEqual([delay.pill.label, delay.line, delay.lineTone, delay.closed, delay.opens], ['Booked', 'delay flagged', 'warn', 'delay', 'thread']);
  // With no conversation to answer in, it opens the card — never a dead link.
  assert.equal(peopleRowView({ ...CRUZ, threadId: null }, facts({ delayFlagged: true }), NOW).opens, 'card');

  const missed = peopleRowView(LOURDES, facts({ meetingPassed: true }), NOW);
  assert.deepEqual([missed.line, missed.closed, missed.opens], ['meeting time passed', 'meeting', 'card']);
});

test('3 · a read that failed claims NOTHING — never the empty answer', () => {
  // The quote read was refused: the row may not say "send a quote".
  const talking = peopleRowView(KATRINA, { ...facts(), quoted: null }, NOW);
  assert.deepEqual([talking.pill.label, talking.line], ['Talking', null]);
  // …and when it was read and found none, it says the step.
  assert.equal(peopleRowView(KATRINA, facts({ quoted: false }), NOW).line, 'send a quote');

  // Payday did not reach the server's count: no money line at all — not "no plan yet".
  const unread = peopleRowView(CRUZ, { ...facts(), moneyRead: false, money: null }, NOW);
  assert.deepEqual([unread.pill.label, unread.line], ['Booked', null]);
  assert.equal(moneyLine({ ...facts(), moneyRead: false }), null);
  // …and when it WAS read and there is no plan, it says so.
  assert.equal(peopleRowView(CRUZ, facts({ money: null }), NOW).line, 'no plan yet');
  // The default facts (nothing read yet) claim nothing either.
  assert.deepEqual(
    [peopleRowView(CRUZ, NO_FACTS, NOW).line, peopleRowView(KATRINA, NO_FACTS, NOW).line],
    [null, null],
  );
});

test('4 · a waiting or holding row never carries a figure', () => {
  const rich = facts({ money: plan(85_000, 0), nextDue: { amountPhp: 85_000, dueDate: '2026-10-03' } });
  for (const r of [ANA, ROLANDO, HOLDING, LAPSED]) {
    const v = peopleRowView(r, rich, NOW);
    assert.doesNotMatch(v.line ?? '', /₱|paid|plan/, `${r.title}: "${v.line}"`);
  }
  assert.equal(peopleRowView(HOLDING, rich, NOW).line, 'quiet 9 days');
});

test('5 · a booking ask inside its last day says the deadline, in the shared words', async () => {
  const { lockRequestFuseLabel } = await import('@/lib/lock-request-state');
  const soon = { ...ROLANDO, expiresAt: ahead(5) };
  const v = peopleRowView(soon, facts(), NOW);
  assert.equal(v.line, lockRequestFuseLabel(soon.expiresAt, new Date(NOW)));
  assert.equal(v.lineTone, 'warn');
  assert.match(v.line ?? '', /5 hours left to answer/);
  // No readable deadline → the plain words, never an invented countdown.
  assert.equal(peopleRowView({ ...ROLANDO, expiresAt: null }, facts(), NOW).line, 'asked to book');
});

test('6 · the next payment is the earliest one still to come in', () => {
  const row = (o: Partial<PaydayInstallmentRow>): PaydayInstallmentRow => ({
    event_vendor_id: 'ev', event_id: 'e1', event_name: 'E', event_date: '2026-10-04', seq: 1, label: 'Deposit', amount_php: 1, due_date: null, confirmed: false, ...o,
  });
  const next = nextDueByEvent([
    row({ seq: 1, amount_php: 43_000, due_date: '2026-09-02', confirmed: true }),
    row({ seq: 3, amount_php: 10_000, due_date: '2026-11-01' }),
    row({ seq: 2, amount_php: 42_000, due_date: '2026-10-03' }),
    row({ event_id: 'e2', seq: 1, amount_php: null, due_date: null }),
  ]);
  assert.deepEqual(next.get('e1'), { amountPhp: 42_000, dueDate: '2026-10-03' }, 'a received payment is never "next"; the earliest dated one is');
  assert.deepEqual(next.get('e2'), { amountPhp: null, dueDate: null });
  // An unresolved amount is never printed as a figure due.
  assert.equal(moneyLine(facts({ money: plan(50_000, 0), nextDue: { amountPhp: null, dueDate: '2026-10-03' } }))?.text, '₱50,000 to come in');
});

/* ═══ B · THE SAME-COMMIT RULE ═════════════════════════════════════════════ */

test('7 · "Nothing to answer" left Today in the SAME change that put its facts on People', () => {
  const today = code('app/vendor-dashboard/page.tsx');
  const sections = code('app/vendor-dashboard/_components/overview-sections.tsx');
  const customers = code('app/vendor-dashboard/customers/page.tsx');
  const row = code('app/vendor-dashboard/customers/people-row.ts');
  assert.ok(today.length > 5_000 && customers.length > 5_000 && row.length > 1_500, 'a source read came back short — a guard over nothing is green by accident');

  // Half one: the list is gone from Today.
  assert.doesNotMatch(today, /NothingToAnswerFeed|nothingToAnswer/, 'Today mounts the closed-lines list again');
  assert.doesNotMatch(sections, /export function NothingToAnswerFeed|id="nothing-to-answer"/, 'the "Nothing to answer" list is back in the desk file');
  assert.equal((today.match(/splitDesk\(whatsNew\)/g) ?? []).length, 1, 'the desk is no longer cut in one place');

  // Half two: each fact has its home on People — and a failed read is said.
  assert.match(customers, /readVendorClosedLines\(supabase, vendorProfileId, rosterNowMs\)/, 'the Customers page stopped reading the flagged delays and missed meetings');
  assert.match(customers, /delayFlagged: closedLines\.delayFlagged\.has\(r\.eventId\)/);
  assert.match(customers, /meetingPassed: closedLines\.meetingPassed\.has\(r\.eventId\)/);
  assert.match(customers, /closedLinesUnread=\{!closedLines\.complete\}/, 'a refused read would read as "nothing flagged"');
  assert.match(customers, /view: peopleRowView\(r, factsFor\(r\), rosterNowMs\)/, 'the row is not worded by the one rule, on the one clock');
  assert.match(row, /lockAskPhase\(r\.expiresAt, nowMs\) !== 'answerable'/, 'the closed booking window is no longer read off the row');
});

test('8 · the two reads ask exactly what the desk asks — one predicate, two readers', () => {
  const desk = code('lib/vendor-overview.ts');
  const mine = code('lib/vendor-closed-lines.ts');
  assert.ok(desk.length > 20_000 && mine.length > 600);
  // A flagged delay.
  for (const [name, src] of [['desk', desk], ['people', mine]] as const) {
    assert.match(src, /\.from\('booking_handovers'\)[\s\S]{0,260}?\.eq\('status', 'disputed'\)/, `${name}: a flagged delay is no longer \`status = 'disputed'\``);
    assert.match(
      src,
      /\.from\('event_appointments'\)[\s\S]{0,400}?\.eq\('status', 'proposed'\)\s*\.eq\('initiated_by', 'couple'\)/,
      `${name}: a meeting to answer is no longer the COUPLE's proposal`,
    );
  }
  assert.match(desk, /meetingAskPhase\(mp\.scheduledAt, now\) === 'passed'/);
  assert.match(mine, /meetingAskPhase\(r\.scheduled_at, nowMs\) === 'passed'/);
  // Both reads report failure; neither is swallowed into an empty set.
  assert.match(mine, /complete: !flags\.error && !meetings\.error/);
});

/* ═══ C · THE LIST, RENDERED ═══════════════════════════════════════════════ */

async function draw(over: Record<string, unknown> = {}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { CustomersRoster } = await import('./_components/customers-roster');
  const asRow = (c: PipelineCustomer, f: PeopleFacts, more: Partial<RosterRow> = {}): RosterRow => ({
    ...c,
    outside: null,
    eventType: 'Wedding',
    askedAbout: [],
    view: peopleRowView(c, f, NOW),
    ...more,
  });
  const rows: RosterRow[] = [
    asRow(ANA, facts(), { askedAbout: ['Photography', 'Videography'] }),
    asRow(LAPSED, facts()),
    asRow(CRUZ, facts({ delayFlagged: true })),
    asRow(LOURDES, facts({ meetingPassed: true }), { eventType: 'Christening' }),
    asRow(person({ eventId: 'outside:b1', lane: 'booked', title: 'Dela Cruz reunion', eventDate: '2026-10-18' }), facts(), {
      eventType: null,
      outside: { blockId: 'b1', schedule: 'Main team', contact: '0917 555 0100', note: 'Half-day.' },
      view: { pill: { label: 'Outside', tone: 'quiet' }, line: null, lineTone: null, opens: 'card', closed: null },
    }),
  ];
  return renderToStaticMarkup(
    React.createElement(CustomersRoster, {
      rows,
      paged: { items: rows, page: 1, pageCount: 1, total: rows.length, from: 1, to: rows.length, pageSize: 20 } as never,
      query: '',
      incomplete: false,
      pagerKeepParams: '',
      clearSearchHref: '?#customers',
      counts: { waiting: 2, holding: 0, talking: 0, booked: 3, finished: 0 },
      holdingPerDate: new Map(),
      keptNotes: [{ noteId: 'n1', body: 'Prefers candid shots.', createdAt: '2026-08-24T02:00:00Z' }],
      removeOutside: async () => {},
      ...over,
    }),
  );
}

test('9 · rows, not a box of rows — one tap each; the closed lines are marked; an outside client opens in place', async () => {
  const html = await draw();
  assert.doesNotMatch(html, /sn-tile|sn-card|sn-row/, 'the list is back in a box');
  const items = html.match(/<li>[\s\S]*?<\/li>/g) ?? [];
  assert.equal(items.length, 5, `drew ${items.length} rows`);

  // An ask opens the conversation; everyone else their card — one link per row, no link inside a link.
  const open0 = items[0]!.slice(0, items[0]!.indexOf('>', 5) + 1);
  assert.match(open0, /^<li><a\b/);
  assert.match(open0, /href="\/vendor-dashboard\/messages\/t-ana"/);
  assert.match(open0, /data-people-row="waiting"/);
  assert.match(items[0]!, />AM<\/span>/, 'the "&" between two names became an initial');
  assert.equal((items[0]!.match(/<a\b/g) ?? []).length, 1);
  assert.match(text(items[0]!), /AM Ana & Miguel Wedding · Mar 13, 2027 · Tagaytay Photography · Videography Asked waiting 2 h/, 'the row does not read name · event · what they asked about · pill · line');
  // Every category on the one inquiry is named — not only the first.
  assert.match(items[0]!, /data-people-asked="">Photography · Videography</);

  // The closed lines, each on its customer's own row.
  assert.match(items[1]!, /data-people-closed="window"[^>]*>booking window closed Oct 1</);
  assert.match(items[1]!, /href="\/vendor-dashboard\/clients\/jo\?tab=details"/);
  assert.match(items[2]!, /data-people-closed="delay"[^>]*>delay flagged</);
  assert.match(items[2]!, /href="\/vendor-dashboard\/messages\/t-jc"/, 'a flagged delay does not open the conversation it must be answered in');
  assert.match(items[3]!, /data-people-closed="meeting"[^>]*>meeting time passed</);
  assert.equal((html.match(/data-people-closed=/g) ?? []).length, 3);

  // An outside client: a row of THIS list, with no card to go to.
  assert.match(items[4]!, /^<li><details[^>]*data-people-row="outside"/);
  assert.doesNotMatch(items[4]!, /<a\b/, 'an outside client became a link — it has no card and no thread');
  assert.match(text(items[4]!), /Dela Cruz reunion Oct 18, 2026 · Main team Outside/);
  assert.match(items[4]!, /name="block_id" value="b1"[\s\S]*class="ab ab-danger[^"]*"[\s\S]*<span class="lbl">Remove<\/span>/, 'the one thing a shop can do to an outside client is gone, or is not a button-rule button');

  // Kept notes: one quiet row at the end.
  assert.match(html, /<details[^>]*data-people-kept-notes=""[\s\S]*Kept notes[\s\S]*1 note · their event has been removed[\s\S]*Prefers candid shots\./);
  assert.doesNotMatch(text(html), /celebration/i, 'supplier copy says "event"');
  // The old chrome is gone from the list: the bar names the page, the thumb row holds search and Add.
  assert.doesNotMatch(html, /<h2|data-customers-more|data-customers-add|type="search"|data-row-next|data-customers-counts/);
});

test('10 · a refused read is SAID above the list; a failed kept-notes read draws no row', async () => {
  const said = await draw({ closedLinesUnread: true });
  assert.match(said, /<p role="status"[^>]*data-people-unread=""[^>]*>Flagged delays and missed meeting times couldn/);
  assert.doesNotMatch(await draw(), /data-people-unread/);
  // The page hands an empty list when the notes read failed — and an empty list draws nothing at all.
  assert.doesNotMatch(await draw({ keptNotes: [] }), /Kept notes/);
  assert.match(code('app/vendor-dashboard/customers/page.tsx'), /const keptNotes: KeptNote\[\] = keptRead\.error\s*\? \[\]/);
  // The quote read: a refusal is kept as null, never an empty set.
  assert.match(code('app/vendor-dashboard/customers/page.tsx'), /const quotedIds = quotedRead\.error\s*\? null/);
  assert.match(code('app/vendor-dashboard/customers/page.tsx'), /quoted: quotedIds \? quotedIds\.has\(r\.eventId\) : null/);
  // Outside clients ride the blocks read; when it was short the roster says so.
  assert.match(code('app/vendor-dashboard/customers/page.tsx'), /eventRowsErrorSeen \|\| !blocksRead\.complete;/);
});

/* ═══ D · THREE SEGMENTS, ONE TABLE ════════════════════════════════════════ */

test('11 · every old link still lands — the segment comes from ?seg, then the section it names, then People', () => {
  assert.deepEqual([...CUSTOMER_SEGMENTS], ['people', 'dates', 'money']);
  const cases: Array<[Record<string, string>, string]> = [
    [{}, 'people'],
    [{ seg: 'money' }, 'money'],
    [{ seg: 'nope' }, 'people'],
    [{ open: 'messages' }, 'people'],
    [{ tab: 'clients', notice: 'client_imported' }, 'people'],
    [{ open: 'availability' }, 'dates'],
    [{ tab: 'calendar' }, 'dates'],
    [{ open: 'proposals' }, 'money'],
    [{ open: 'contracts' }, 'money'],
    [{ tab: 'payday' }, 'money'],
    [{ tab: 'bookings' }, 'money'],
    // An explicit segment wins over a section's own.
    [{ seg: 'dates', open: 'proposals' }, 'dates'],
  ];
  for (const [sp, want] of cases) assert.equal(customersSegment(sp), want, JSON.stringify(sp));

  // A bare fragment cannot name its segment to the server, so the link carries it.
  assert.equal(customerLandingHref('payday'), '/vendor-dashboard/customers?seg=money#payday');
  assert.equal(customerLandingSegment('payday'), 'money');
  // A fold's `?open=` already says where it lives.
  assert.equal(customersSegment({ open: 'proposals' }), customerLandingSegment('proposals'));
  assert.equal(customersSegmentHref('people'), '/vendor-dashboard/customers');
  assert.equal(customersSegmentHref('dates'), '/vendor-dashboard/customers?seg=dates');

  // Every id the table names is rendered once, on the segment it names.
  const page = code('app/vendor-dashboard/customers/page.tsx');
  const roster = code('app/vendor-dashboard/customers/_components/customers-roster.tsx');
  for (const [anchor, seg] of Object.entries(ANCHOR_SEGMENT)) {
    const id = `id="${anchor.slice(1)}"`;
    const src = anchor === '#customers' ? roster : page;
    assert.equal((src.match(new RegExp(id, 'g')) ?? []).length, 1, `${id} is not rendered exactly once`);
    if (anchor === '#customers') continue;
    const before = page.slice(0, page.indexOf(id));
    const gate = before.lastIndexOf(`seg === '${seg}' ? (`);
    const otherGates = CUSTOMER_SEGMENTS.filter((s) => s !== seg).map((s) => before.lastIndexOf(`seg === '${s}' ? (`));
    assert.ok(gate > 0 && otherGates.every((g) => g < gate), `${id} is not inside the ${seg} segment`);
  }
  // Every fold key the hub draws has a segment.
  const folds = [...page.matchAll(/\bkey: '(\w+)',\s*\n\s*label:/g)].map((m) => m[1]!);
  assert.deepEqual(folds.sort(), ['availability', 'contracts', 'messages', 'proposals']);
  for (const f of folds) assert.ok(SECTION_SEGMENT[f], `the "${f}" fold has no segment`);
});

test('12 · People is the list and nothing under it — and one list, not two', async () => {
  const page = code('app/vendor-dashboard/customers/page.tsx');
  // The inbox fold shows on People only when a link asked for it.
  assert.match(page, /SECTION_SEGMENT\[s\.key\] === seg && \(seg !== 'people' \|\| s\.key === openRaw\)/);
  // The retired Clients list: not imported, not a fold, not a file.
  assert.doesNotMatch(page, /clients\/surface|ClientsSurface|key: 'clients'/);
  const { existsSync } = await import('node:fs');
  assert.equal(existsSync(join(WEB, 'app/vendor-dashboard/clients/surface.tsx')), false, 'the second customer list is back');
  // Outside clients are folded into the SAME lanes the roster pages.
  assert.match(page, /if \(k\.source !== 'external_client'\) continue;[\s\S]{0,700}?lanes\[lane\]\.push\(/);
  // The Add sheet posts the shipped action — nothing new takes the client.
  assert.match(page, /<form action=\{importExternalClient\}/);
  assert.match(page, /addOpen=\{search\.add === 'outside' \|\| Boolean\(outsideNotice\?\.refused\)\}/);
  // "Is it finished?" is asked with the shared predicate, once.
  assert.equal((page.match(/rowReadsCompleted\(/g) ?? []).length, 1);
});
