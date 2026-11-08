import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { customerLandingHref } from './customers/anchors';

/**
 * The property: a number a supplier is shown as a headline count takes them to
 * the thing it counts.
 *
 * Owner, 2026-09-18: *"i cannot open the new inquiries"*. His dashboard read
 * "New inquiries · 1", he tapped it, nothing happened — while `EarnedTile`,
 * directly beside it, links to the full ledger. Three counts styled as tiles,
 * none reachable, next to one that is.
 *
 * 🔑 This file already carried the lesson, 180 lines below the defect:
 * *"href and no form: a control that looked pressable and did nothing."* The
 * same disease in the other direction — that one looked pressable and was
 * inert; these ARE the answer to "where next" and offered no way to get there.
 *
 * 📱 2026-10-01 — the KPI bento became THREE NUMBERS on Today's first screen
 * (DECISION_LOG "THE SUPPLIER PHONE APP — APPROVED, WITH THE THREE RECOMMENDED
 * ANSWERS": new inquiries · events this week · ₱ owed to you). The property did
 * not change; the scan moved to `supplier-today-first-screen.tsx`.
 *
 * 📊 2026-11-08 — THE ONE BUILD (A4, v103/v104 "stats jump"): the counts row is retired; Today's headline counts are
 * the FIVE STATS (`today-stats.tsx`), each a link. The property is unchanged; the scan moved again.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '../..');
const stats = () => stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/_components/today-stats.tsx'), 'utf8'));

test('every headline count on Today has a destination', async () => {
  const { TODAY_STAT_HREFS, todayStatsOf } = await import('./_components/today-stats');
  const ids = todayStatsOf({ views: 1, inquiries: 1, booked: 1, portfolio: { used: 1, free: 50 }, toComeInPhp: 1 }).map((x) => x.id);
  assert.deepEqual(ids, ['views', 'inquiries', 'booked', 'portfolio', 'money']);
  for (const id of ids) assert.ok(TODAY_STAT_HREFS[id], `the ${id} stat goes nowhere`);
  // Each is drawn as ONE link to its own place — never a button that does nothing, never a tile with no door.
  assert.match(stats(), /<Link\s+href=\{TODAY_STAT_HREFS\[s\.id\]\}/, 'a stat is not a link to its place');
  assert.doesNotMatch(stats(), /<button\b/, 'a stat became a button');
  // A number that could not be read says so IN PLACE — "couldn't load", never a dead 0.
  for (const s of todayStatsOf({ views: null, inquiries: null, booked: null, portfolio: null, toComeInPhp: null })) {
    assert.equal(s.figure, null, `${s.id}: a figure over an unread read`);
    assert.equal(s.line, 'couldn’t load');
  }
  // The page hands the stats in from the one view.
  assert.match(stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/_components/supplier-today-screen.tsx'), 'utf8')), /<TodayStats stats=\{view\.stats\} \/>/);
});

test('the destinations exist as routes', async () => {
  const { TODAY_STAT_HREFS } = await import('./_components/today-stats');
  const hrefs = Object.values(TODAY_STAT_HREFS);
  assert.equal(hrefs.length, 5, `found ${hrefs.length} stat hrefs`);
  for (const h of hrefs) {
    const rel = h.replace(/^\//, '').split(/[?#]/)[0]!;
    const page = join(WEB, 'app', rel, 'page.tsx');
    assert.ok(
      statSync(page, { throwIfNoEntry: false }),
      `${h} has no page.tsx — a count that links to a 404 is worse than one that ` +
        'links nowhere, because it looks like it worked',
    );
  }
});

test('the money number goes to the money — Payday', async () => {
  const { TODAY_STAT_HREFS } = await import('./_components/today-stats');
  assert.equal(TODAY_STAT_HREFS.money, customerLandingHref('payday'));
});

test('each Coming-up row opens its customer — the list under the numbers links too', () => {
  const s = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/_components/supplier-today-first-screen.tsx'), 'utf8'));
  const coming = s.slice(s.indexOf('data-today-coming-up'));
  // The row is the shared hairline row now (`TodayRow`, one <Link>).
  assert.match(coming, /<TodayRow key=\{row\.id\} href=\{row\.href\}/, 'a Coming-up row is drawn but goes nowhere');
  const rowFn = s.slice(s.indexOf('export function TodayRow('));
  assert.match(rowFn, /<Link href=\{href\} className=\{`home-row[^`]*`\}/, 'the shared row is not a link');
  // …and every Coming-up row the assembly builds carries its door: a Setnayan booking its customer card, a booking
  // from outside its day (simpler Today 2026-10-14).
  const view = stripComments(readFileSync(join(WEB, 'lib/supplier-today-view.ts'), 'utf8'));
  assert.match(view, /href: r\.href,/, 'a Setnayan booking row lost its customer card');
  assert.match(view, /href: daySheetHref\(o\.date\),/, 'a booking from outside goes nowhere');
});
