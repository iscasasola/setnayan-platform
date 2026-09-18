import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { BOOKINGS_ANCHOR, CALENDAR_ANCHOR } from './anchors';

/**
 * S43 · 3 — a link that names Bookings or the calendar lands on it.
 *
 * `/vendor-dashboard/bookings` and `/vendor-dashboard/calendar` redirect into
 * the My Customers hub. With no fragment the hub opened at the top (the roster),
 * so "Bookings" and "View on calendar" both looked like they went nowhere.
 */

const read = (rel: string) =>
  stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard', rel), 'utf8'));

const HUB = read('customers/page.tsx');

test('each anchor is rendered exactly once on the hub', () => {
  assert.ok(HUB.length > 5000, 'read the real hub (an empty read is a green lie)');
  for (const anchor of [BOOKINGS_ANCHOR, CALENDAR_ANCHOR]) {
    assert.match(anchor, /^#[a-z]+$/);
    const id = anchor.slice(1);
    const n = [...HUB.matchAll(new RegExp(`\\bid="${id}"`, 'g'))].length;
    assert.equal(n, 1, `customers/page.tsx must render id="${id}" once — found ${n}`);
  }
});

test('the calendar anchor wraps the month grid, not some other block', () => {
  const at = HUB.indexOf('id="calendar"');
  const grid = HUB.indexOf('<CustomersCalendar', at);
  assert.ok(at > 0 && grid > at, 'id="calendar" is not ahead of <CustomersCalendar>');
  assert.equal(HUB.slice(at, grid).includes('</div>'), false, 'the calendar anchor closes before the grid');
});

test('the bookings stub always lands on the Bookings list', () => {
  const src = read('bookings/page.tsx');
  assert.match(src, /import \{ BOOKINGS_ANCHOR \} from '\.\.\/customers\/anchors'/);
  const redirects = [...src.matchAll(/redirect\(`[^`]*`\)/g)].map((m) => m[0]);
  assert.equal(redirects.length, 1, `one redirect expected, found ${redirects.length}`);
  assert.ok(redirects[0].endsWith('${BOOKINGS_ANCHOR}`)'), `the redirect drops the anchor: ${redirects[0]}`);
});

test('a bare calendar link lands on the grid; a link with params keeps landing on the tools', () => {
  const src = read('calendar/page.tsx');
  assert.match(src, /import \{ CALENDAR_ANCHOR \} from '\.\.\/customers\/anchors'/);
  assert.match(src, /const bare = qs\.toString\(\) === 'tab=calendar';/);
  assert.match(src, /\$\{bare \? CALENDAR_ANCHOR : ''\}/);
});
