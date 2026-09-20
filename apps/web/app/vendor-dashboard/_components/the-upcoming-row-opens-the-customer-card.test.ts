/**
 * THE UPCOMING-SCHEDULE ROW OPENS THE CUSTOMER CARD — and the chat is still
 * one tap away beside it.
 *
 * ── THE REPORT (owner, 2026-09-20 · supplier Saysay, /vendor-dashboard) ─────
 * *"pressing the upcoming schedules doesn't open our customer card. where we
 * can see updates about our project on them."*
 *
 * Measured from the live DOM: every row was
 * `<a href="/vendor-dashboard/messages/<threadId>">`. The builder read
 * `b.threadId ? messages/<thread> : clients/<event>`, and on a booked event a
 * thread always exists — so the first arm always won and the customer card had
 * NO door on that list. The `else` arm was no better: a bare
 * `/vendor-dashboard/clients/<id>` is itself a chat landing since #5614.
 * **Both arms opened the conversation**, which is why the row could look
 * correct in source and still be wrong on screen.
 *
 * ── WHAT IS PROVED, AND HOW THE SABOTAGE WOULD LOOK ─────────────────────────
 * The decision is a pure module, so the first four tests EXECUTE it rather
 * than grepping for a string — a route assembled correctly in source and
 * chosen by the wrong branch is exactly this defect. The source counts that
 * follow face the sabotages a render can still hide: drop the `?tab=`, drop
 * the Message link, nest it inside the row's own <a>, or quietly re-point a
 * neighbouring door at the bare route again.
 *
 * ⚠ SABOTAGE-PROVEN 2026-09-20. Reverting the builder to
 * `b.threadId ? … : …` fails test 1; dropping `?tab=details` from the helper
 * fails tests 2 and 6; deleting the Message link fails test 7.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  UPCOMING_CARD_SECTION,
  customerCardHref,
  upcomingScheduleDoor,
} from '@/lib/upcoming-schedule-door';

const WEB = join(import.meta.dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const count = (src: string, re: RegExp) => (src.match(re) ?? []).length;

const SECTIONS = 'app/vendor-dashboard/_components/overview-sections.tsx';
const BUILDER = 'lib/vendor-overview.ts';
const DOOR = 'lib/upcoming-schedule-door.ts';
const CLIENT_PAGE = 'app/vendor-dashboard/clients/[eventId]/page.tsx';
const CLIENTS_ROSTER = 'app/vendor-dashboard/clients/surface.tsx';
const CUSTOMERS_ROSTER = 'app/vendor-dashboard/customers/_components/customers-roster.tsx';

const sections = read(SECTIONS);
const builder = read(BUILDER);
const door = read(DOOR);
const clientPage = read(CLIENT_PAGE);
const clientsRoster = read(CLIENTS_ROSTER);
const customersRoster = read(CUSTOMERS_ROSTER);

const EVENT = '2d4f1144-7816-4367-9c99-6ff0f9a6de10';
const THREAD = '9b1f0a33-0000-4000-8000-000000000001';

test('0 · the scan reads every file (an empty read is a green lie)', () => {
  for (const [rel, src] of [
    [SECTIONS, sections],
    [BUILDER, builder],
    [DOOR, door],
    [CLIENT_PAGE, clientPage],
    [CLIENTS_ROSTER, clientsRoster],
    [CUSTOMERS_ROSTER, customersRoster],
  ] as const) {
    assert.ok(src.length > 800, `${rel} read as ${src.length} chars`);
  }
});

test('1 · a booked row with a live thread opens the CARD, not the thread', () => {
  const d = upcomingScheduleDoor({
    eventId: EVENT,
    eventVendorId: 'ev-1',
    threadId: THREAD,
    briefOpensOnThread: true,
  });
  assert.equal(d.opensCard, true);
  assert.equal(d.href, `/vendor-dashboard/clients/${EVENT}?tab=details`);
  assert.ok(
    !d.href.includes('/messages/'),
    'the row opens the conversation again — this is the exact defect the owner reported',
  );
});

test('2 · the card link always names a section (a bare route IS the chat)', () => {
  // The redirect this depends on must still be there, or the guard is theatre.
  assert.equal(
    count(clientPage, /rawTab === 'chat'/g),
    1,
    'the client page no longer treats a bare landing as a chat landing — re-check this whole file',
  );
  for (const section of ['details', 'quote', 'schedule', 'files'] as const) {
    assert.equal(customerCardHref(EVENT, section), `/vendor-dashboard/clients/${EVENT}?tab=${section}`);
  }
  assert.equal(UPCOMING_CARD_SECTION, 'details');
});

test('3 · the fallback is taken ONLY when there is no card to open', () => {
  // No event_vendors row AND no thread the brief admits → no card.
  const noCard = upcomingScheduleDoor({
    eventId: EVENT,
    eventVendorId: null,
    threadId: THREAD,
    briefOpensOnThread: false,
  });
  assert.equal(noCard.opensCard, false);
  assert.equal(noCard.href, `/vendor-dashboard/messages/${THREAD}`);

  // Nothing at all — an off-platform / manual pool booking. Never a dead link.
  const bare = upcomingScheduleDoor({
    eventId: EVENT,
    eventVendorId: null,
    threadId: null,
    briefOpensOnThread: false,
  });
  assert.equal(bare.opensCard, false);
  assert.equal(bare.href, '/vendor-dashboard/calendar');
  assert.equal(bare.threadHref, null);

  // 🔑 THE SABOTAGE THIS FACES: "fall back whenever a thread exists", which is
  // the shipped bug. Either proof of a card alone is enough.
  for (const input of [
    { eventVendorId: 'ev-1', briefOpensOnThread: false },
    { eventVendorId: null, briefOpensOnThread: true },
  ]) {
    const d = upcomingScheduleDoor({ eventId: EVENT, threadId: THREAD, ...input });
    assert.equal(d.opensCard, true, `${JSON.stringify(input)} should still open the card`);
    assert.ok(d.href.includes('?tab=details'));
  }
});

test('4 · the conversation is still offered, and never offered twice', () => {
  const card = upcomingScheduleDoor({
    eventId: EVENT,
    eventVendorId: 'ev-1',
    threadId: THREAD,
    briefOpensOnThread: true,
  });
  assert.equal(card.threadHref, `/vendor-dashboard/messages/${THREAD}`);
  assert.notEqual(card.threadHref, card.href, 'the Message link would duplicate the row');

  // In the fallback the row IS the thread, so the row must render no second
  // control — the component's condition is `threadHref !== href`.
  const fell = upcomingScheduleDoor({
    eventId: EVENT,
    eventVendorId: null,
    threadId: THREAD,
    briefOpensOnThread: false,
  });
  assert.equal(fell.threadHref, fell.href);
});

test('5 · the builder goes through the rule and keeps no route of its own', () => {
  assert.equal(
    count(builder, /upcomingScheduleDoor\(\{/g),
    1,
    'the Upcoming list no longer calls the one rule',
  );
  assert.equal(
    count(builder, /href: door\.href/g) +
      count(builder, /threadHref: door\.threadHref/g) +
      count(builder, /opensCard: door\.opensCard/g),
    3,
    'the row does not carry all three fields the rule returns',
  );
  assert.equal(
    count(builder, /href: b\.threadId/g),
    0,
    'the thread-first ternary is back in the Upcoming builder',
  );
  // `briefOpensOnThread` must be fed by a real read, not a constant.
  assert.equal(count(builder, /briefOpenEventIds = new Set\(/g), 1);
  assert.equal(count(builder, /briefOpensOnThread: briefOpenEventIds\.has\(b\.eventId\)/g), 1);
});

test('6 · no supplier-side door onto a customer card is left bare', () => {
  /*
    A bare `/vendor-dashboard/clients/${x}` in a LINK is a chat landing. These
    are the supplier's own home-page rows and rosters — the files this sweep
    walked. `revalidatePath` / `redirect` / notification `relatedUrl` are a
    different thing and are deliberately not counted: the regex requires the
    `href` token immediately before, the same shape `lint-port-no-lost-controls`
    looks for.
  */
  const bare = /href=\{?`\/vendor-dashboard\/clients\/\$\{[^}]+\}`/g;
  for (const [rel, src] of [
    [SECTIONS, sections],
    [CLIENTS_ROSTER, clientsRoster],
    [CUSTOMERS_ROSTER, customersRoster],
  ] as const) {
    assert.equal(count(src, bare), 0, `${rel} still has a bare client link, which opens the chat`);
  }
  // …and the roster's own local-`href` form, which the regex above cannot see.
  assert.equal(
    count(customersRoster, /const href = `\/vendor-dashboard\/clients\/\$\{r\.eventId\}`/g),
    0,
    'the Customers roster points every row at the chat again',
  );
  assert.equal(
    count(customersRoster, /const href = `\/vendor-dashboard\/clients\/\$\{r\.eventId\}\?tab=details`/g),
    1,
  );
  // Each fixed door names the section its own words promise.
  assert.equal(count(sections, /clients\/\$\{card\.eventId\}\?tab=quote/g), 1, 'the deposit card lost its money section');
  assert.equal(count(sections, /clients\/\$\{card\.eventId\}\?tab=schedule/g), 2, 'the meeting / handover doors lost their calendar');
  assert.equal(count(clientsRoster, /clients\/\$\{(?:eventId|t\.event_id)\}\?tab=details/g), 2);
});

test('7 · the Message control is a SIBLING of the row, and is conditional', () => {
  assert.equal(
    count(sections, /href=\{row\.threadHref\}/g),
    1,
    'the Upcoming row no longer offers the conversation at all',
  );
  assert.equal(
    count(sections, /row\.threadHref && row\.threadHref !== row\.href/g),
    1,
    'the Message link is unconditional — in the fallback it would duplicate the row',
  );
  // An <a> inside an <a> is invalid HTML and the inner one stops working, so
  // the row's own Link must close before the Message link opens.
  const rowLink = sections.indexOf('href={row.href}');
  const msgLink = sections.indexOf('href={row.threadHref}');
  assert.ok(rowLink > 0 && msgLink > rowLink);
  assert.ok(
    sections.slice(rowLink, msgLink).includes('</Link>'),
    'the Message link sits inside the row’s own <Link> — nested anchors do not work',
  );
});

test('8 · the open-task list has no no-op row', () => {
  assert.equal(
    count(builder, /href: '\/vendor-dashboard',/g),
    0,
    'an open task links to the page it is already on — the tap does nothing',
  );
  assert.equal(count(builder, /href: '\/vendor-dashboard#whats-new'/g), 1);
  // The anchor it names must exist on that page.
  assert.equal(count(sections, /id="whats-new"/g), 1);
  assert.equal(
    count(builder, /href: customerCardHref\(lr\.eventId, 'quote'\)/g),
    1,
    'the "Confirm the deposit" task no longer names the money section',
  );
});
