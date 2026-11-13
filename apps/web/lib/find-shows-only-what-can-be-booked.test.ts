/**
 * FIND — AND DISCOVER, AND BUILD — SHOW ONLY WHAT CAN BE BOOKED ON THE COUPLE'S DATE.
 *
 * Owner, 2026-10-10: "service card will not show if they are not available to that date/s".
 * Owner, 13 Nov 2026 (6134): "If a supplier is unavailable for that day, then we do not need to show them. we only
 * show what fits."
 *
 * Carried over from the unmerged `rd/suppliers-find-fits-the-event` (2026-10-11) and re-pointed at this tree. It
 * holds the argument on every CALL, counted — a file-level match cannot say which call holds a flag: two calls with
 * one flag would still read "the file has it".
 *
 *   1  every bench search (Find's page, the search sheet, More to compare) asks to hide what cannot be booked;
 *   2  the hide stays what it was: only strangers leave, a supplier with no card in scope is never judged, an error
 *      hides nobody;
 *   3  an empty list says WHY — "Nobody is free on <date>", never "No supplier lists this yet";
 *   4  Discover's supplier view hides with the SAME read and the SAME stranger rule, suppliers AND service cards;
 *   5  Build's pick list offers only suppliers free on the date;
 *   6  "Ask about another day" only for a supplier the couple already asked; the asked keep a "Taken on <date>" badge.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  FIND_NONE_LISTED,
  FIND_NO_FILTER_MATCH,
  findEmptyState,
  findEmptyWords,
  findNobodyFreeWords,
  dateUncheckedWords,
} from './supplier-find-empty';
import { describeUnbookableScope, refusalKey, unbookableDateScope } from './bench-bookable-days';
import { suppliersDateFact } from './suppliers-shell';
import { keepCardsThatFit, keepSuppliersThatFit } from './discover-shows-what-fits';
import { buildLinesOf } from './suppliers-build';
import { cardVerbs } from './supplier-card-verbs';
import type { BenchCardActions, BenchBuildAction, BenchInquiryAction } from './bench-card-actions';
import { takenOnWords } from './calendar-truth';

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
const OVERLAY = 'app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx';
const MORE = 'app/dashboard/[eventId]/vendors/_actions/inline-more-row.ts';
const SEARCH = 'app/dashboard/[eventId]/vendors/_actions/category-search.ts';
const DISCOVER = 'app/(shell)/explore/_lib/marketplace-view.tsx';

/** How many searches each bench surface makes. Change a number only with its surface. */
const BENCH_SEARCHES: Array<[file: string, calls: number]> = [
  [FIND, 1],
  [OVERLAY, 2], // the suppliers in reach, and — once asked for — the ones farther away
  [MORE, 1],
];

/* ── 1 · every bench search hides what cannot be booked ─────────────────── */

test('the reader finds each call, and tells a call with the flag from one without', () => {
  const calls = searchCalls(
    'a = await searchCategoryVendors({ eventId, hideUnbookable: true }); b = await searchCategoryVendors({ eventId, tile: f(x) });',
  );
  assert.equal(calls.length, 2);
  assert.match(calls[0]!, /\bhideUnbookable:\s*true\b/);
  assert.doesNotMatch(calls[1]!, /hideUnbookable/);
});

test('🔑 every search Find, the search sheet and More to compare make asks to hide what cannot be booked', () => {
  for (const [file, expected] of BENCH_SEARCHES) {
    const calls = searchCalls(read(file));
    assert.equal(calls.length, expected, `${file} makes ${calls.length} searches — this file expected ${expected}`);
    calls.forEach((args, i) => {
      assert.match(args, /\bhideUnbookable:\s*true\b/, `${file} search #${i + 1} lists suppliers who cannot be booked on the date`);
    });
  }
});

/* ── 2 · the hide stays what it was ─────────────────────────────────────── */

test('the hide stays what it was: only strangers leave, a supplier with no card in scope is never judged, and an error hides nobody', () => {
  const search = read(SEARCH);
  assert.match(search, /input\.hideUnbookable === true\s*\?\s*await findSuppliersWithNoBookingLeft\(/);
  assert.match(search, /ordered = ordered\.filter\(\(s\) => !leavesBenchSearch\(s, noBookingLeft\)\)/);
  const pure = read('lib/bench-bookable-days.ts');
  assert.match(pure, /if \(row\.alreadyAdded \|\| row\.relationshipDepth > 0\) return false;/);
  assert.match(pure, /if \(cards\.length === 0\) continue;/);
  const server = read('lib/bench-bookable-days.server.ts');
  const hide = server.slice(server.indexOf('export async function readSuppliersWithNoBookingLeft'), server.indexOf('export async function findSuppliersWithNoBookingLeft'));
  // Every failure says "could not check" (null) — never an empty set, which means "checked, everybody is free".
  const unreadReturns = hide.match(/return null;/g) ?? [];
  assert.equal(unreadReturns.length, 3, `expected the three could-not-check returns, found ${unreadReturns.length}`);
  assert.match(hide, /\} catch \{\s*return null;\s*\}/);
  assert.doesNotMatch(hide, /logQueryError\([^)]*\);\s*return new Set\(\);/, 'a failed read answered "everybody is free"');
  // Find's bench search keeps its fail-open hide by folding the unread answer to "hide nobody".
  assert.match(server, /return \(await readSuppliersWithNoBookingLeft\(args\)\) \?\? new Set\(\);/);
  // The refusal is the booking path's own — capacity per service, read through the pools — never a new rule.
  assert.match(hide, /\.rpc\('service_cards_unbookable_on'/);
  // Discover's "every category" reach is the ONLY widening: a null scope drops the category filter, nothing else.
  assert.match(hide, /if \(args\.canonicals !== null\) cardQuery = cardQuery\.in\('category', args\.canonicals as string\[\]\);/);
});

/* ── 3 · an empty list says why ─────────────────────────────────────────── */

test('🔑 nobody lists the category · nobody is free on the date — two cases, two sentences', () => {
  const day = describeUnbookableScope('2026-12-12', 'day');
  assert.equal(findEmptyState({ found: 0, shown: 0, hiddenForDate: 0, filtering: false }), 'none_listed');
  assert.equal(findEmptyWords('none_listed', day), FIND_NONE_LISTED);
  assert.equal(findEmptyState({ found: 0, shown: 0, hiddenForDate: 5, filtering: false }), 'nobody_free');
  assert.equal(findEmptyWords('nobody_free', day), 'Nobody is free on Sat, Dec 12, 2026.');
  // "Nobody is free" wins over the Filter — the Filter is not why it is empty…
  assert.equal(findEmptyState({ found: 0, shown: 0, hiddenForDate: 3, filtering: true }), 'nobody_free');
  // …but a Filter that emptied a list the search DID fill is the Filter's doing.
  assert.equal(findEmptyState({ found: 4, shown: 0, hiddenForDate: 2, filtering: true }), 'no_filter_match');
  assert.equal(findEmptyWords('no_filter_match', day), FIND_NO_FILTER_MATCH);
  assert.equal(findEmptyState({ found: 3, shown: 3, hiddenForDate: 9, filtering: false }), null);
});

test('🔑 the words are the approved prototype\'s, and the date is written as the page\'s date line writes it', () => {
  assert.equal(suppliersDateFact('2026-12-12', 'day').text, 'Sat, Dec 12, 2026');
  assert.equal(findNobodyFreeWords(describeUnbookableScope('2026-12-12', 'day')), 'Nobody is free on Sat, Dec 12, 2026.');
  const month = describeUnbookableScope('2026-12-01', 'month')!;
  assert.equal(month.kind, 'month');
  assert.equal(month.days.length, 31);
  assert.equal(findNobodyFreeWords(month), 'Nobody is free in December 2026.');
  // The scope and the hide's days are one answer.
  for (const [d, p] of [['2026-12-12', 'day'], ['2027-02-01', 'month'], ['2027-01-01', 'year'], [null, null]] as const) {
    assert.deepEqual(describeUnbookableScope(d, p)?.days ?? null, unbookableDateScope(d, p), `${d}/${p}`);
  }
  // 🧵 The prototype's second half names a control that is not on these screens.
  assert.doesNotMatch(findNobodyFreeWords(month), /Help me choose|try another day/);
  for (const s of [null, undefined, { kind: 'day' as const, days: [] }]) {
    assert.match(findNobodyFreeWords(s), /^Nobody is free/);
  }
});

test('🔑 the count and the date are the hide\'s own, and they reach Find\'s page and the search sheet', () => {
  const search = read(SEARCH);
  assert.match(
    search,
    /let hiddenForDate = 0;\s*if \(noBookingLeft\.size > 0\) \{\s*const before = ordered\.length;\s*ordered = ordered\.filter\(\(s\) => !leavesBenchSearch\(s, noBookingLeft\)\);\s*hiddenForDate = before - ordered\.length;\s*\}/,
  );
  assert.equal((search.match(/findSuppliersWithNoBookingLeft\(/g) ?? []).length, 1, 'a second read of who is full');
  assert.match(search, /\.\.\.\(hiddenForDate > 0 \? hiddenForDateFields\(hiddenForDate, results\.length,/);
  // Find's page asks the one decider with the search's own numbers, and carries no sentence of its own.
  const page = read(FIND);
  assert.match(
    page,
    /const empty = findEmptyState\(\{\s*found: res\.results\.length,\s*shown: rows\.length,\s*hiddenForDate: res\.hiddenForDate \?\? 0,\s*filtering: picked\.length > 0,\s*\}\);/,
  );
  assert.match(page, /\{findEmptyWords\(empty, res\.hiddenForDateScope\)\}/);
  assert.doesNotMatch(page, /No supplier lists this yet|No supplier matches this filter|Nobody is free/);
  assert.match(page, /\{empty === 'nobody_free' \? null : \(/, '"0 suppliers" drawn over "Nobody is free on …"');
  // The search sheet says the server's sentence before its "here yet" line.
  const overlay = read(OVERLAY);
  assert.match(overlay, /setNobodyFree\(res\.nobodyFreeWords \?\? null\);/);
  // The date-hide sentence is its own branch, decided BEFORE the empty copy's narrowing branch (which
  // bench-category-search.test.ts pins), so an emptied list never reads "No … suppliers here yet".
  assert.match(
    overlay,
    /results\.length === 0 && nobodyFree \? \(\s*(?:\/\/[^\n]*\n\s*)*<div className="empty"[^>]*>\{nobodyFree\}<\/div>\s*\) : results\.length === 0 \? \(/,
  );
});

/* ── 4 · Discover's supplier view ───────────────────────────────────────── */

test('🔑 Discover hides with Find\'s read, Find\'s refusal and Find\'s stranger rule — suppliers AND service cards', () => {
  const src = read(DISCOVER);
  assert.equal((src.match(/await readSuppliersWithNoBookingLeft\(\{/g) ?? []).length, 1);
  assert.doesNotMatch(src, /findSuppliersWithNoBookingLeft/, 'Discover read the fold that cannot say "could not check"');
  assert.equal((src.match(/await readCardRefusals\(\{/g) ?? []).length, 1);
  // …and what they keep IS what the page goes on with.
  assert.match(
    src,
    /const fit = keepSuppliersThatFit\(visible, \(r\) => r\.vendor_profile_id, noBookingLeft, known\);\s*visible = fit\.rows;\s*hiddenForDate \+= fit\.hidden;\s*if \(!fit\.checked\) dateUnchecked = true;/,
  );
  assert.match(src, /const fit = keepCardsThatFit\(\s*listedServiceCards,[\s\S]{0,200}?\);\s*serviceCards = fit\.cards;\s*hiddenForDate \+= fit\.hidden;\s*if \(!fit\.checked\) dateUnchecked = true;/);
  // The days are the hide's own, from the couple's event, and only for a couple with one.
  assert.match(src, /const dateHideDays = coupleEventId \? unbookableDateScope\(coupleEventDate, coupleEventDatePrecision\) : null;/);
  // The rendered cards are the judged ones.
  assert.match(src, /let serviceCards = listedServiceCards;/);
  assert.doesNotMatch(src, /\{listedServiceCards\.map\(/, 'the landing draws the unjudged cards');
  // A failed "who do they know" read hides nobody.
  assert.match(src, /savedOnEvent = savedForCompareError \? null : new Set\(savedIds\);/);
  assert.match(src, /if \(!coupleEventId \|\| savedOnEvent === null\) return null;/);
  // An empty view says the date, not "No suppliers match" or the invite outreach.
  assert.match(src, /if \(nobodyFreeWords\) \{\s*return \(/);
  assert.match(src, /findNobodyFreeWords\(describeUnbookableScope\(coupleEventDate, coupleEventDatePrecision\)\)/);
});

test('Discover\'s rules, executed: a stranger full on the date leaves; the known stay; a failed read hides nobody', () => {
  const rows = [{ id: 'full' }, { id: 'free' }, { id: 'full-but-saved' }];
  const full = new Set(['full', 'full-but-saved']);
  const r = keepSuppliersThatFit(rows, (x) => x.id, full, new Set(['full-but-saved']));
  assert.deepEqual(r.rows.map((x) => x.id), ['free', 'full-but-saved']);
  assert.equal(r.hidden, 1);
  assert.equal(r.checked, true);
  assert.equal(keepSuppliersThatFit(rows, (x) => x.id, new Set(), new Set()).hidden, 0);

  const cards = [
    { s: 'c-full', v: 'a' },
    { s: 'c-one-day-free', v: 'b' },
    { s: 'c-known', v: 'k' },
  ];
  const days = ['2027-02-13', '2027-02-14'];
  const refused = new Set([
    refusalKey('c-full', days[0]!),
    refusalKey('c-full', days[1]!),
    refusalKey('c-one-day-free', days[0]!),
    refusalKey('c-known', days[0]!),
    refusalKey('c-known', days[1]!),
  ]);
  const c = keepCardsThatFit(cards, (x) => x.s, (x) => x.v, refused, days, new Set(['k']));
  assert.deepEqual(c.cards.map((x) => x.s), ['c-one-day-free', 'c-known'], 'a month keeps a card free on ANY day');
  assert.equal(c.hidden, 1);
  assert.equal(c.checked, true);
  assert.equal(keepCardsThatFit(cards, (x) => x.s, (x) => x.v, null, days, new Set()).hidden, 0, 'a failed read hid a card');
  assert.equal(keepCardsThatFit(cards, (x) => x.s, (x) => x.v, refused, null, new Set()).hidden, 0, 'no date hid a card');
});

test('🔑 a failed capacity read is NEVER passed off as a filtered list — every row stays and the page says it could not check', () => {
  const rows = [{ id: 'full' }, { id: 'free' }];
  // The capacity read failed.
  const unread = keepSuppliersThatFit(rows, (x) => x.id, null, new Set());
  assert.deepEqual(unread.rows.map((x) => x.id), ['full', 'free'], 'a failed read hid a supplier');
  assert.equal(unread.hidden, 0);
  assert.equal(unread.checked, false, 'a failed read was reported as a real check');
  // The read worked but "who the couple knows" failed while somebody is full → also unchecked, nobody hidden.
  const unknown = keepSuppliersThatFit(rows, (x) => x.id, new Set(['full']), null);
  assert.equal(unknown.hidden, 0);
  assert.equal(unknown.checked, false);
  // A real check that found everybody free IS a check.
  assert.equal(keepSuppliersThatFit(rows, (x) => x.id, new Set(), null).checked, true);

  const days = ['2026-12-12'];
  const cards = [{ s: 'c1', v: 'a' }];
  const c = keepCardsThatFit(cards, (x) => x.s, (x) => x.v, null, days, new Set());
  assert.equal(c.cards.length, 1);
  assert.equal(c.checked, false, 'a failed card read was reported as a real check');
  assert.equal(keepCardsThatFit(cards, (x) => x.s, (x) => x.v, new Set([refusalKey('c1', days[0]!)]), days, null).checked, false);
  assert.equal(keepCardsThatFit(cards, (x) => x.s, (x) => x.v, null, null, new Set()).checked, true, 'no date is nothing to check');

  // The words: the date, the honest admission, and nothing that sounds like "nobody is free".
  const dayWords = dateUncheckedWords(describeUnbookableScope('2026-12-12', 'day'));
  assert.match(dayWords, /^Couldn't check who's free on .*2026\. Some of these suppliers may already be booked\.$/);
  assert.match(dateUncheckedWords(describeUnbookableScope('2026-12-12', 'month')), /^Couldn't check who's free in December 2026\./);
  assert.match(dateUncheckedWords(null), /^Couldn't check who's free on your date\./);
  assert.doesNotMatch(dayWords, /Nobody is free/);

  // The page draws the line whenever either read came back unchecked — above the list, rows or not.
  const src = read(DISCOVER);
  assert.match(src, /const dateUncheckedLine = dateUnchecked\s*\?\s*dateUncheckedWords\(describeUnbookableScope\(coupleEventDate, coupleEventDatePrecision\)\)\s*:\s*null;/);
  assert.match(
    src,
    /const resultsBody = \(\s*<>\s*\{dateUncheckedLine \? \(\s*<p[^>]*role="status"[^>]*data-find-date-unchecked=""[^>]*>\s*\{dateUncheckedLine\}\s*<\/p>\s*\) : null\}/,
    'the could-not-check line is not drawn above the results',
  );
});

/* ── 5 · Build's pick list ──────────────────────────────────────────────── */

test('🔑 Build\'s pick list offers only suppliers free on the date — the bench\'s own "taken" verdict', () => {
  const v = (vendorId: string) => ({ vendorId, name: vendorId, status: 'considering' as const, planGroupId: 'photo' });
  const [line] = buildLinesOf({
    tiles: [{ tile: 'photo', label: 'Photo', vendors: [v('free'), v('taken')] }],
    priceOf: () => 50_000,
    inBuild: new Set(),
    blocked: new Map([['taken', 'Not available on your date']]),
  });
  assert.deepEqual(line!.candidates.map((c) => c.vendorId), ['free']);
  // …and the page feeds every calendar "booked" into that map.
  const page = read('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(
    page,
    /for \(const \[vendorId, fit\] of dateFitByVendorId\) \{\s*if \(fit === 'booked' && !blocked\.has\(vendorId\)\) blocked\.set\(vendorId, BLOCKED_LOCK_ROW\.not_available\);\s*\}/,
  );
  assert.match(read('lib/suppliers-build.ts'), /!args\.blocked\.has\(v\.vendorId\)/);
});

/* ── 6 · the asked stay; the never-asked are not invited to a full day ──── */

test('🔑 "Ask about another day" only where the couple already asked — swept over every action shape', () => {
  const builds: (BenchBuildAction | null)[] = [
    null,
    { kind: 'not_available', inBuild: false },
    { kind: 'not_available', inBuild: true },
    { kind: 'add' },
    { kind: 'in_build' },
  ];
  const inquiries: (BenchInquiryAction | null)[] = [null, { kind: 'inquire' }, { kind: 'check', threadId: 't' }];
  let n = 0;
  for (const build of builds)
    for (const inquiry of inquiries)
      for (const connect of [false, true])
        for (const quoteIn of [false, true]) {
          const actions: BenchCardActions = {
            build,
            buildGroupId: build ? 'g' : null,
            inquiry,
            withdraw: null,
            lockGroupId: null,
            lockWithheld: null,
            connect,
          };
          const keys = cardVerbs({ actions, booked: false, hasPrice: true, quoteIn, payDue: false }).map((x) => x.key);
          if (keys.includes('another_day')) {
            assert.equal(inquiry?.kind, 'check', `another_day offered with no conversation: ${JSON.stringify(actions)}`);
            assert.equal(build?.kind, 'not_available');
          }
          if (build?.kind === 'not_available' && inquiry?.kind !== 'check' && !quoteIn) assert.deepEqual(keys, ['remove']);
          n++;
        }
  assert.ok(n >= 60);
});

test('the asked keep a "Taken on <date>" badge — the prototype\'s words, from the committed day', () => {
  assert.equal(takenOnWords('2026-12-12'), 'Taken on Dec 12');
  assert.equal(takenOnWords(null), null);
  assert.equal(takenOnWords('2026-12'), null);
  const bench = read('app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx');
  assert.match(bench, /text: takenOn \?\? 'Booked that day',/);
  const page = read('app/dashboard/[eventId]/vendors/page.tsx');
  assert.match(page, /takenOnLabel=\{planPrecision === 'day' \? takenOnWords\(planDate\) : null\}/);
});
