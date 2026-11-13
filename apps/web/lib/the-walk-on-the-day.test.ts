/**
 * 🚶 THE WALK, 13 Nov 2026 — the supplier's on-the-day round (F-W1-75 · 76 · 77 · 81). Each test names the walk row.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { offlineNotYetWords, supplierOfflinePaths } from './offline-copies';

const read = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const E = '0e0e0e0e-0000-4000-8000-000000000001';

test('F-W1-77 · before saving opens, the strip says when it starts — never a silent "Not saved on this phone yet"', () => {
  const now = Date.parse('2026-11-13T12:00:00+08:00');
  assert.equal(offlineNotYetWords('2026-12-18', now), 'Nothing to save yet · saving for offline starts Dec 15, 3 days before the event');
  assert.equal(offlineNotYetWords('2026-11-15', now), null, 'inside the 3-day window saving is open');
  assert.equal(offlineNotYetWords(null, now), 'Nothing to save yet · this booking has no date');
  const strip = read('app/_components/offline-ready/supplier-saved-strip.tsx');
  assert.match(strip, /offlineNotYetWords\(eventDate, copy\.now\)/);
  assert.match(strip, /canUpdate=\{notYet === null &&/, 'Update now stays pressable while nothing can be saved');
});

test('F-W1-77 · the live console is asked for only on the booked day (before it, the page redirects and every save failed)', () => {
  assert.deepEqual(supplierOfflinePaths(E, { checkin: false, liveToday: false }), ['/vendor-dashboard/on-the-day']);
  assert.deepEqual(supplierOfflinePaths(E, { checkin: false }), ['/vendor-dashboard/on-the-day', `/vendor-dashboard/on-the-day/live/${E}`]);
  assert.match(read('app/vendor-dashboard/on-the-day/page.tsx'), /liveToday=\{booking\?\.bookedDate === today\}/);
});

test('F-W1-76 · the live page before its day goes back to the Hub ON this event, and the Hub says when it opens', () => {
  const live = read('app/vendor-dashboard/on-the-day/live/[eventId]/page.tsx');
  assert.match(live, /redirect\(`\/vendor-dashboard\/on-the-day\?event=\$\{encodeURIComponent\(eventId\)\}&live=not-yet`\)/);
  assert.doesNotMatch(live, /redirect\('\/vendor-dashboard\/on-the-day'\)/, 'a bare redirect drops the event');
  const hub = read('app/vendor-dashboard/on-the-day/page.tsx');
  assert.match(hub, /sp\.live === 'not-yet'/);
  assert.match(hub, /The live page opens on \$\{/);
  assert.match(hub, /data-hub-live-not-yet=""/);
});

test('F-W1-75 · the Hub tour names the booking-fee hold; F-W1-81 · the Hub ▾ says one view and one event', () => {
  assert.match(read('lib/tours.ts'), /A day that is waiting on its booking fee says so on its row\./);
  assert.match(read('app/vendor-dashboard/on-the-day/_components/hub-event-menu.tsx'), /doneNote="One view and one event\."/);
});
