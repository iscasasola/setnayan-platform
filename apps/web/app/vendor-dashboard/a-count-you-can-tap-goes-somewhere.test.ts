import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve, relative } from 'node:path';
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
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '../..');
const src = () =>
  stripComments(
    readFileSync(join(WEB, 'app/vendor-dashboard/_components/supplier-today-first-screen.tsx'), 'utf8'),
  );

/** The three-numbers block, from its marker to the Coming-up block after it. */
function numbersBlock(): string {
  const s = src();
  const a = s.indexOf('data-today-numbers');
  // v13: Coming up now rides in the left column's tail (declared above the render), so the block ends at the first
  // helper after the render instead.
  const b = s.indexOf('function OpenedRow(', a);
  assert.ok(a > 0 && b > a, 'the three-numbers block could not be found — the scan has gone blind');
  return s.slice(a, b);
}

test('every headline count on Today has a destination', () => {
  const block = numbersBlock();
  // 📌 2026-10-28 (owner: "the counts … are the pinned row and they FILTER the list in place"): on a normal day the
  // three counts are FILTER buttons (`TodayCounts`) — pressing one shows ITS list right under the row — and each list
  // ends with the door to the whole of it. So a count still goes somewhere twice over: to its list, and through it.
  const counts = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/_components/today-counts.tsx'), 'utf8'));
  assert.equal((counts.match(/aria-pressed=\{on === key\}/g) ?? []).length, 1, 'a count is no longer a filter (aria-pressed)');
  for (const word of ["'waiting'", "'this week'", "'to come in'"]) assert.ok(counts.includes(word), `the ${word} count is gone`);
  // Each filtered list ends with its door: the week → Dates, the money → Money in · Payday (here), waiting → Customers (below).
  assert.match(block, /<ListDoor label="All dates" href="\/vendor-dashboard\/customers\?seg=dates" \/>/, 'the week list lost its door');
  assert.match(block, /<ListDoor label="Money in" href=\{customerLandingHref\('payday'\)\} \/>/, 'the money list lost its door');
  assert.match(src(), /<ListDoor label="All customers" href="\/vendor-dashboard\/customers\?lane=waiting#customers" \/>/, 'the waiting list lost its door');
  // 🌑 On an event day the row is the day's own: waiting · next moment · checked in — each a link, as before.
  const links = block.match(/<Link\b[^>]*>/g) ?? [];
  assert.equal(links.length, 3, `${links.length} of the event day's three numbers are links`);
  for (const l of links) assert.match(l, /href=(?:"\/vendor-dashboard[^"]*"|\{customerLandingHref\('\w+'\)\})/, `a number links nowhere real: ${l}`);
  for (const word of ['waiting on you', 'next moment', 'checked in']) {
    assert.ok(block.includes(word), `the "${word}" number is gone`);
  }
  // A number that could not be read says so IN PLACE — "couldn't load", never a dead 0 (the day row's own <Unread />;
  // the pinned counts' own line in `today-counts.tsx`).
  assert.equal((block.match(/<Unread \/>/g) ?? []).length, 1, 'the event day\'s waiting number no longer says when it could not read');
  assert.match(counts, /value === null \?[\s\S]{0,400}couldn&rsquo;t load/, 'a pinned count that could not read no longer says so');
});

test('the destinations exist as routes', () => {
  const hrefs = [...numbersBlock().matchAll(/href=(?:"([^"]+)"|\{customerLandingHref\('(\w+)'\)\})/g)].map((m) =>
    m[1] ?? customerLandingHref(m[2] as Parameters<typeof customerLandingHref>[0]),
  );
  // The event day's three links + the week's and the money's list doors (2026-10-28).
  assert.equal(hrefs.length, 5, `found ${hrefs.length} number hrefs`);
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

test('the money number goes to the money — Payday', () => {
  assert.match(numbersBlock(), /href=\{customerLandingHref\('payday'\)\}/);
});

test('each Coming-up row opens its customer — the list under the numbers links too', () => {
  const s = src();
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
