/**
 * FIND SHOWS ONLY WHAT CAN BE BOOKED FOR THIS EVENT.
 *
 * Owner, 2026-10-10: "so when they search for a supplier's service card. it
 * will be compared to the available schedule of that service on the event's
 * date and if there is a location already, if we can cater that service to
 * that location. service card will not show if they are not available to that
 * date/s or that location."
 *
 * The hide is the shipped one (`searchCategoryVendors({ hideUnbookable: true })`,
 * H6, 2026-09-11). Until today Find's own search did not ask for it, so a
 * supplier with no booking left on the event's date was only moved DOWN the
 * list. This file holds the argument on Find's CALL — every call the page
 * makes, counted — because a file-level match cannot say which call holds a
 * flag: two calls with one flag would still read "the file has it".
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  FIND_ALL_BOOKED,
  FIND_EMPTY_WORDS,
  FIND_NONE_LISTED,
  FIND_NO_FILTER_MATCH,
  findEmptyState,
} from './supplier-find';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

/** Each `searchCategoryVendors(...)` call's argument text, in source order. */
function searchCalls(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\bsearchCategoryVendors\(/g)) {
    let depth = 1;
    let i = m.index + m[0].length;
    const start = i;
    for (; i < src.length && depth > 0; i += 1) {
      if (src[i] === '(') depth += 1;
      else if (src[i] === ')') depth -= 1;
    }
    out.push(src.slice(start, i - 1));
  }
  return out;
}

const FIND = 'app/dashboard/[eventId]/vendors/categories/page.tsx';
/** How many searches the Find page makes: the suppliers in reach, and — once
 *  asked for — the ones farther away. Change it only with the page. */
const FIND_SEARCHES = 2;

test('the reader finds each call, and tells a call with the flag from one without', () => {
  const calls = searchCalls(
    'a = await searchCategoryVendors({ eventId, hideUnbookable: true }); b = await searchCategoryVendors({ eventId, tile: f(x) });',
  );
  assert.equal(calls.length, 2);
  assert.match(calls[0]!, /\bhideUnbookable:\s*true\b/);
  assert.doesNotMatch(calls[1]!, /hideUnbookable/);
});

test('🔑 every search Find makes asks to hide what cannot be booked on the date', () => {
  const calls = searchCalls(read(FIND));
  assert.equal(calls.length, FIND_SEARCHES, `Find makes ${calls.length} searches — this file expected ${FIND_SEARCHES}`);
  calls.forEach((args, i) => {
    assert.match(args, /\beventId\b/, `Find's search #${i + 1} is not about this event`);
    assert.match(
      args,
      /\bhideUnbookable:\s*true\b/,
      `Find's search #${i + 1} lists suppliers who cannot be booked on the event's date`,
    );
  });
});

test('the hide stays what it was: only strangers leave, a supplier with no card in scope is never judged, and an error hides nobody', () => {
  const search = read('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  // Asked only when a caller asks, and applied through the one predicate.
  assert.match(search, /input\.hideUnbookable === true\s*\?\s*await findSuppliersWithNoBookingLeft\(/);
  assert.match(search, /ordered = ordered\.filter\(\(s\) => !leavesBenchSearch\(s, noBookingLeft\)\)/);
  // A supplier the couple already knows never leaves.
  const pure = read('lib/bench-bookable-days.ts');
  assert.match(pure, /if \(row\.alreadyAdded \|\| row\.relationshipDepth > 0\) return false;/);
  // No cards in scope → never judged (matched by profile, not by a card the booking path could refuse).
  assert.match(pure, /if \(cards\.length === 0\) continue;/);
  // Every failure in the read hides nobody.
  const server = read('lib/bench-bookable-days.server.ts');
  const emptyReturns = server.match(/return new Set\(\);/g) ?? [];
  assert.ok(emptyReturns.length >= 5, `expected the fail-open returns, found ${emptyReturns.length}`);
  assert.match(server, /\} catch \{\s*return new Set\(\);\s*\}/);
});

test('"date/s": the search hands the event\'s candidate dates to the hide, read with the event itself', () => {
  const search = read('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  // Read on the membership-gated events row — not a second, unguarded read.
  const select = search.match(/\.from\('events'\)\s*\.select\(\s*'([^']+)'/);
  assert.ok(select, 'the events read moved');
  const columns = select![1]!.split(',').map((c) => c.trim());
  for (const c of ['event_date', 'event_date_precision', 'date_candidates', 'date_window_start', 'date_window_end']) {
    assert.ok(columns.includes(c), `the search no longer reads events.${c}`);
  }
  // …and handed to the ONE place that decides the days in scope.
  const call = search.match(/await findSuppliersWithNoBookingLeft\(\{[\s\S]*?\}\)/);
  assert.ok(call, 'the hide call moved');
  assert.match(call![0], /dateCandidates:\s*Array\.isArray\(ev\.date_candidates\)/);
  const server = read('lib/bench-bookable-days.server.ts');
  assert.match(call![0], /dateWindow:\s*\{ start: ev\.date_window_start, end: ev\.date_window_end \}/);
  assert.match(server, /unbookableDateScope\(args\.eventDate, args\.eventDatePrecision, args\.dateCandidates, args\.dateWindow\)/);
});

// ── FARTHER AWAY (owner 2026-10-10) ───────────────────────────────────────
// "yes offer the farther away option. in case the need to search more". The
// shipped expander from the bench's search overlay, offered on Find. Distance
// only: it must never bring back a supplier who cannot be booked on the date.
const CONTROLS = read('app/dashboard/[eventId]/vendors/categories/_components/find-supplier-controls.tsx');
const LIST = read('app/dashboard/[eventId]/vendors/categories/_components/find-supplier-list.tsx');
const OVERLAY = read('app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx');
const squash = (t: string) => t.replace(/\s+/g, ' ');

test('🔑 "farther away" is about distance only — its search hides what cannot be booked, exactly as the first one does', () => {
  const calls = searchCalls(read(FIND));
  const farther = calls.filter((a) => /\bincludeFarther:\s*true\b/.test(a));
  assert.equal(farther.length, 1, `Find has ${farther.length} farther-away searches`);
  assert.match(farther[0]!, /\bhideUnbookable:\s*true\b/, 'opening "farther away" brings back suppliers who cannot be booked on the date');
  // The same scope and the same words searched — nothing else differs.
  const plain = calls.filter((a) => !/includeFarther/.test(a));
  assert.equal(plain.length, 1);
  for (const needle of ['eventId', '...benchSearchScopeForTile(openTile.tile)', 'query: q || undefined']) {
    assert.ok(farther[0]!.includes(needle) && plain[0]!.includes(needle), `the two searches differ on: ${needle}`);
  }
  // …and the search applies the hide AFTER it has kept only the farther ones.
  const search = read('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  const partition = search.indexOf('if (input.includeFarther) {');
  const hide = search.indexOf('ordered = ordered.filter((s) => !leavesBenchSearch(s, noBookingLeft))');
  assert.ok(partition > 0 && hide > partition, 'the hide no longer runs on the farther-away list');
});

test('the farther-away search runs only once it is asked for, and only when the event has a place', () => {
  const page = read(FIND);
  assert.match(page, /const fartherOpen = res\.hasReceptionCoords && sp\.far === '1';/);
  assert.match(page, /const fartherRows = fartherOpen\s*\?/, 'the second search runs on every open');
  assert.match(page, /\{res\.hasReceptionCoords \? \(\s*<div className="mt-4">\s*<FindFartherAway /, 'offered with no place to measure from');
  // Offered below the list whether or not anyone is in reach — an empty first
  // list is exactly when the couple needs to search more.
  const offered = page.indexOf('<FindFartherAway ');
  const emptyBranch = page.indexOf('{FIND_EMPTY_WORDS[empty]}');
  assert.ok(emptyBranch > 0 && offered > emptyBranch);
  assert.doesNotMatch(page.slice(emptyBranch, offered), /rows\.length > 0 &&/, 'hidden when nobody is in reach');
});

test('the control and its words are the bench search overlay\'s — nothing new', () => {
  const words = [
    'Show suppliers farther away',
    'Finding suppliers farther away…',
    'Farther away · outside their service area',
    'No suppliers farther away — everyone covering your area is listed above.',
  ];
  const mine = squash(CONTROLS + LIST);
  const theirs = squash(OVERLAY);
  for (const w of words) {
    assert.ok(theirs.includes(w), `the overlay no longer says "${w}" — re-copy it`);
    assert.ok(mine.includes(w), `Find does not say "${w}"`);
  }
  // One row that opens it; closed means nothing was searched.
  assert.match(LIST, /if \(rows === null\) return <ShowFartherButton href=\{openHref\} \/>;/);
  assert.match(CONTROLS, /onClick=\{\(\) => startTransition\(\(\) => router\.replace\(href, \{ scroll: false \}\)\)\}/);
  // The same rows either side of the divider — one component draws both.
  assert.equal((read(FIND).match(/<FindSupplierList /g) ?? []).length, 1);
  assert.equal((LIST.match(/<FindSupplierList /g) ?? []).length, 1);
});

// ── AN EMPTY LIST SAYS WHY (2026-10-11) ───────────────────────────────────
// Once Find hides who cannot be booked, "nobody lists this category" and
// "everybody here is full on your date" both arrive as no rows. The page said
// "No supplier lists this yet. Check back soon." for both.
test('🔑 nobody lists the category · every supplier is booked on the date — two cases, two sentences', () => {
  // Nobody lists it: nothing found, nobody hidden.
  assert.equal(findEmptyState({ found: 0, shown: 0, hiddenForDate: 0, filtering: false }), 'none_listed');
  assert.equal(FIND_EMPTY_WORDS.none_listed, 'No supplier lists this yet. Check back soon.');
  // Suppliers exist, none can be booked on the date: nothing found, somebody hidden.
  assert.equal(findEmptyState({ found: 0, shown: 0, hiddenForDate: 5, filtering: false }), 'all_booked');
  assert.equal(findEmptyState({ found: 0, shown: 0, hiddenForDate: 1, filtering: false }), 'all_booked');
  assert.equal(FIND_EMPTY_WORDS.all_booked, 'Every supplier here is booked on your date.');
  assert.notEqual(FIND_ALL_BOOKED, FIND_NONE_LISTED);
  // The booked case wins over the Filter — the Filter is not why it is empty…
  assert.equal(findEmptyState({ found: 0, shown: 0, hiddenForDate: 3, filtering: true }), 'all_booked');
  // …but a Filter that emptied a list the search DID fill is the Filter's doing,
  // whoever else was hidden.
  assert.equal(findEmptyState({ found: 4, shown: 0, hiddenForDate: 2, filtering: true }), 'no_filter_match');
  assert.equal(findEmptyState({ found: 0, shown: 0, hiddenForDate: 0, filtering: true }), 'no_filter_match');
  assert.equal(FIND_EMPTY_WORDS.no_filter_match, FIND_NO_FILTER_MATCH);
  // Rows on screen → no empty sentence at all, whatever was hidden.
  assert.equal(findEmptyState({ found: 3, shown: 3, hiddenForDate: 9, filtering: false }), null);
  assert.equal(findEmptyState({ found: 3, shown: 1, hiddenForDate: 0, filtering: true }), null);
});

test('🔑 the count is the hide\'s own — the rows it removed — and it reaches the page', () => {
  const search = read('app/dashboard/[eventId]/vendors/_actions/category-search.ts');
  // Counted around the ONE filter the hide applies; no second query.
  assert.match(
    search,
    /let hiddenForDate = 0;\s*if \(noBookingLeft\.size > 0\) \{\s*const before = ordered\.length;\s*ordered = ordered\.filter\(\(s\) => !leavesBenchSearch\(s, noBookingLeft\)\);\s*hiddenForDate = before - ordered\.length;\s*\}/,
  );
  // Absent unless somebody was hidden — every other result keeps its shape.
  assert.match(search, /\.\.\.\(hiddenForDate > 0 \? \{ hiddenForDate \} : \{\}\),/);
  assert.equal((search.match(/findSuppliersWithNoBookingLeft\(/g) ?? []).length, 1, 'a second read of who is full');
  // The page asks the one decider, with the search's own numbers…
  const page = read(FIND);
  assert.match(
    page,
    /const empty = findEmptyState\(\{\s*found: res\.results\.length,\s*shown: rows\.length,\s*hiddenForDate: res\.hiddenForDate \?\? 0,\s*filtering: picked\.length > 0,\s*\}\);/,
  );
  assert.match(page, /\{empty \? \(\s*<p [^>]*data-find-empty=\{empty\}>\s*\{FIND_EMPTY_WORDS\[empty\]\}\s*<\/p>\s*\) : \(\s*<FindSupplierList /);
  // …and carries no sentence of its own for an empty list any more.
  assert.doesNotMatch(page, /No supplier lists this yet|No supplier matches this filter|booked on your date/);
  // After the sentence: the farther-away control, and nothing else.
  const after = page.slice(page.indexOf('{FIND_EMPTY_WORDS[empty]}'));
  const tail = after.slice(after.indexOf('<FindSupplierList '), after.indexOf('</div>\n    );'));
  assert.equal((tail.match(/<(?!\/)[A-Za-z]/g) ?? []).length, 3, 'something besides the list and the farther-away control follows the sentence');
});
