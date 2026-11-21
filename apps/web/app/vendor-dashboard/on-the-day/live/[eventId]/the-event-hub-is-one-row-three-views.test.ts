/**
 * 🧭 THE SUPPLIER'S EVENT HUB — ONE ROW, THREE VIEWS (supplier dashboard v13, owner "Approved." 2026-10-29; prototype
 * `renderEventHub`: "pinned row: ‹ Exit · 'Event Hub · <event> ▾' LEFT · 💬 + ⓘ RIGHT · count row Now · Next · Arrived").
 *
 *   1. the live page draws the ONE row (Exit back to the Hub on this event · the ▾ · this event's chat · ⓘ) and the
 *      count row, and the ▾ is the three views — each its own address;
 *   2. The Day keeps EVERY shipped part of the console (focal clock, run of show, march, headcount, tools, live
 *      reviews, the specialization desk) — nothing was dropped by the restyle;
 *   3. Scanner and Announce are DOORS into shipped tools — never a scanner or a composer of their own; Announce opens
 *      only for a coordinator the hosts let announce, under the feature's own switch;
 *   4. "Coming" is the RSVP headcount and says so — no arrival count is invented.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { EVENT_HUB_VIEWS, eventHubViewHref, eventHubViewOf } from '@/lib/event-hub-views';

const HERE = import.meta.dirname;
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const PAGE = read('page.tsx');
/* The November look (supplier pages set two, page 8, 21 Nov 2026): the page READS, `_components/event-day-body.tsx`
   DRAWS (so the lab draws it from fixtures). Every rule below holds over the two together. */
const BODY = read('_components/event-day-body.tsx');
const DRAWN = `${PAGE}\n${BODY}\n${read('_components/day-run-of-show.tsx')}`;

test('1 · one row and the count row; the ▾ is the three views, each its own address', () => {
  assert.match(PAGE, /<EventDayBody[\s\S]*?bar=\{\{[\s\S]*?exitHref: hubHref\(eventId\),\s*chatHref: booking\.threadId \? supplierChatHref\(eventId, booking\.threadId\) : null,/);
  assert.match(BODY, /<EventHubBar \{\.\.\.bar\} \/>/);
  assert.match(BODY, /<EventHubCounts tiles=\{shownCounts\} \/>/);
  assert.match(PAGE, /counts=\{counts\}/);
  assert.deepEqual([...EVENT_HUB_VIEWS], ['day', 'scanner', 'announce']);
  assert.equal(eventHubViewHref('e1', 'day'), '/vendor-dashboard/on-the-day/live/e1');
  assert.equal(eventHubViewHref('e1', 'scanner'), '/vendor-dashboard/on-the-day/live/e1?view=scanner');
  assert.equal(eventHubViewOf('nope'), 'day');
  const bar = read('_components/event-hub-bar.tsx');
  assert.match(bar, /options=\{EVENT_HUB_VIEWS\.map/, 'the ▾ is not the three views');
  assert.match(bar, /usePinLeadSlot\(\)/, 'the row does not move up into the pinned row from 701');
});

test('2 · The Day keeps every shipped part of the console', () => {
  for (const part of [
    '<FloorClock blocks={blocks} />',
    '<RunOfShowHeader eventId={eventId} initial={blocks}',
    '<DayRunOfShow eventId={eventId} blocks={blocks} />',
    '<MarchRead',
    "has('pax_headcount')",
    'linkModules.map',
    'tools.map((t) =>',
    '<LiveReviews',
    '<SpecializationSlot',
    '<SupplierSavedStrip',
  ]) {
    assert.ok(DRAWN.includes(part), `The Day lost ${part}`);
  }
  // The Day is the body's own branch — Scanner and Announce draw in its place, never under it.
  assert.ok(BODY.indexOf("view !== 'day' ?") < BODY.indexOf('<FloorClock blocks={blocks} />'), 'The Day is drawn under another view');
});

test('3 · Scanner and Announce are doors into shipped tools', () => {
  const views = read('_components/event-hub-views.tsx');
  assert.doesNotMatch(views, /getUserMedia|makeQrDetector|<SeatScanner|sendCoordinatorBroadcast|\.from\(/, 'a view built a tool of its own');
  assert.match(views, /<AnnounceButton eventId=\{eventId\} isEventDay recent=/);
  assert.match(views, /const may = enabled && run\?\.canAnnounce === true;/, 'Announce opens for someone the broadcast rule refuses');
  assert.match(views, /#seat-finder/);
  assert.match(PAGE, /floorIsYours=\{frame\.specialization\?\.set === 'floor_command'\}/, 'the seat finder door shows without the floor desk');
  assert.match(PAGE, /view === 'announce' && run\?\.canAnnounce && announceOn \? await fetchLatestBroadcasts\(supabase, eventId\) : null/);
});

test('4 · "Coming" is the RSVP headcount — said so; no arrivals invented', () => {
  assert.match(PAGE, /key: 'coming', value: brief \? `\$\{formatCount\(attending\)\}\/\$\{formatCount\(invited\)\}` : '—', word: brief \? 'coming \(RSVP\)' : 'couldn’t load'/);
  assert.doesNotMatch(PAGE, /arrived/i);
});
