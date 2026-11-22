/**
 * an-event-takes-columns-two-and-three.test.ts — 🗂 CLIENTS ON A COMPUTER: AN EVENT FROM THIS DAY SPANS COLUMNS 2 + 3.
 *
 * Owner, 17 Nov (DECISION_LOG, via the controller): "an event opened from This day spans columns 2 and 3, with the rail
 * and top bar kept … reusing the shipped panel/rise. The phone keeps the full-screen rise." P1 drawing
 * `supplier_clients_clean_2026-11-16`.
 *
 *   1. A row in the PICKED day that has an event opens that event's page (its `href`, the picked client); every other
 *      row (and the no-day list) still picks its day.
 *   2. The page it opens is the ONE shipped `PickedShell` — no second panel: the rule moves `[data-picked-client]`.
 *   3. From 1280 only, and only while the Clients month is on screen, the screen starts right of the rail and under the
 *      top bar — and those two numbers are the shell's own (front-door.css), so a drift fails here.
 *
 * SABOTAGE (each run once, each went red): drop `true` from the picked day's `drawRow` → 1; set `left: 72px` → 1;
 * move the rule out of the 1280 media block → 1; type `left: 240px` back → 1; drift `--fd-app-bar` to 60px → 1; drop `eventId` from the wire → 1; drop the booked row's `href` → 1.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dayRowsOf } from '@/lib/vendor-dates';
import { clientScheduleDayHref } from '@/lib/upcoming-schedule-door';
import { datesBookingsForWire } from './dates-wire';

const here = join(process.cwd(), 'app/vendor-dashboard');
const CAL = readFileSync(join(here, 'customers/_components/customers-calendar.tsx'), 'utf8');
const FRAME = readFileSync(join(here, '_components/supplier-frame.css'), 'utf8');
const FD = readFileSync(join(process.cwd(), 'app/_components/frontdoor/front-door.css'), 'utf8');
const SHELL = readFileSync(join(process.cwd(), 'app/_components/picked/picked-shell.tsx'), 'utf8');

const RULE = /@media \(min-width: 1280px\) \{\s*html:has\(\[data-dates-month='clients'\]\) \[data-picked-client\] \{([^}]*)\}/;

test('an event in the picked day opens its own page; other rows still pick the day', () => {
  assert.match(CAL, /rowsOf\(picked\)\.map\(\(r\) => drawRow\(r, picked, true\)\)/, 'the picked day no longer opens its events');
  assert.match(CAL, /href=\{onClients \? \(inPicked && eventsOpenHere && r\.href \? r\.href : daySheetHref\(day\)\) : undefined\}/);
  // 📱 The phone keeps the day sheet (audit 17 Nov): only from the Clients 1280 line does the row open the event.
  assert.match(CAL, /const eventsOpenHere = useIsDesktop\('xl'\);/, 'the phone no longer keeps the day sheet');
});

test('the page is the one shipped PickedShell, moved — not a second panel', () => {
  assert.match(SHELL, /data-picked-client=\{pickedId\}/);
  assert.match(SHELL, /className="fixed inset-0 /, 'the shipped screen is no longer the fixed full-screen rise the phone keeps');
});

test('from 1280, over the Clients month, it keeps the rail and the top bar — with the shell\'s own numbers', () => {
  const m = RULE.exec(FRAME);
  assert.ok(m, 'no ≥1280 Clients rule moves the picked client');
  const body = m[1] ?? '';
  const rail = /^\.fd \{[^}]*--fd-rail:\s*(\d+)px/m.exec(FD)?.[1];
  const bar = /\.fd\[data-chrome='app'\] \{[^}]*--fd-bar:\s*(\d+)px/.exec(FD)?.[1];
  assert.ok(rail && bar, 'could not read the shell numbers from front-door.css');
  assert.match(body, /left:\s*var\(--fd-app-rail-wide\);/, 'the event covers (or misses) the rail');
  assert.match(body, /top:\s*var\(--fd-app-bar\);/, 'the event covers (or misses) the top bar');
  assert.doesNotMatch(body, /\d+px/, 'a shell number is typed on the panel');
  // The published pair is the shell's own two values — never a second, drifting copy.
  assert.match(FD, new RegExp(`:root \\{\\s*--fd-app-bar:\\s*${bar}px;\\s*--fd-app-rail-wide:\\s*${rail}px;`), 'the published shell numbers drifted from .fd');
  assert.match(body, /bottom:\s*0/);
  assert.match(body, /height:\s*auto/);
});

// 📅 Owner 18 Nov 2026: Calendar › a day › a client opens that client's Schedule with THIS day picked (was the one open
// path's landing page — Details, or Hub on the day).
test('a booked row opens the client\'s Schedule on that day, from the month\'s own read', () => {
  const wire = datesBookingsForWire([{ poolBookingId: 'pb', poolId: 'p', eventId: 'S89E-AAAAAAAAAA', bookedDate: '2026-12-12', eventName: 'Kat Arroyo', threadId: null }]);
  assert.equal(wire[0]?.eventId, 'S89E-AAAAAAAAAA', 'the month no longer sends the booked event');
  const rows = dayRowsOf('2026-12-12', {
    today: '2026-11-17', poolIds: new Set(['p']), poolLabel: () => '', namePools: false,
    bookings: wire, blocks: [], holds: [], asking: 0, waiting: 0,
  });
  const booked = rows.find((r) => r.kind === 'booked');
  assert.equal(booked?.href, clientScheduleDayHref('S89E-AAAAAAAAAA', '2026-12-12'));
  assert.equal(booked?.href, '/vendor-dashboard/clients/S89E-AAAAAAAAAA?tab=schedule&day=2026-12-12');
});
