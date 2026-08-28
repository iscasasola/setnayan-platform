/**
 * the-maker-searches-every-trade.test.ts — C1: the kind sheet's search finds
 * any of the 262 live trades, ranked.
 *
 * 🔴 THE GAP. The maker's search only ever matched the ~46 legacy department
 * pills, by `o.label.toLowerCase().includes(q)`. The 262 real trades in the
 * live coverage taxonomy — including 51 with no word of their own in that
 * list (generator hire, tent rental, sorbetes carts, bridesmaid dresses among
 * them) and three funeral kinds that render in no group at all — were not
 * searchable there at all.
 *
 * ⚖ WHAT IS PINNED HERE, AND WHY EACH ONE IS SEPARATE:
 *   1. the ranker is IMPORTED, never reimplemented — a second matcher is the
 *      two-hand-typed-things failure this repo keeps paying for;
 *   2. every ranked trade carries its STANDING before it reaches a `KindPill`
 *      — the obvious-and-wrong version renders `{key,label}` bare, and a
 *      capped supplier picks a trade, writes the whole card, and is refused
 *      only at Publish (exactly the defect `canvas-maker.tsx`'s own docblock
 *      records repairing);
 *   3. a trade already shown in the coverage band is not shown a second time;
 *   4. results appear ONLY once a query is typed — never a rendered wall of
 *      262 pills, the owner's coverage-first lock on this screen;
 *   5. `misc` (Miscellaneous) is untouched and still reachable in every
 *      state — the card is universal (owner, 2026-08-28).
 *
 * The behavioural half of this (ranking + dedupe, actually exercised) lives
 * in `lib/kind-search-trades.test.ts`. This file pins the WIRING: that the
 * maker actually calls that module, in the right place, with the right
 * inputs, and that the server actually builds and hands over the list.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const MAKER = 'app/vendor-dashboard/services/_components/canvas-maker.tsx';
const NEW_DOOR = 'app/vendor-dashboard/services/new/page.tsx';
const RANK_LIB = 'lib/kind-search-trades.ts';
const SHARED_RANKER = 'lib/taxonomy-search-rank.ts';

test('the files under test actually read back', () => {
  assert.ok(read(MAKER).length > 5000, 'the maker read back empty');
  assert.ok(read(NEW_DOOR).length > 500, 'the new door read back empty');
  assert.ok(read(RANK_LIB).length > 200, 'the trade-search wiring read back empty');
  assert.ok(read(SHARED_RANKER).length > 200, 'the shared ranker read back empty');
});

// ---------------------------------------------------------------------------
// 1 · THE RANKER IS IMPORTED, NEVER REIMPLEMENTED
// ---------------------------------------------------------------------------

test('the wiring module imports the shared ranker instead of re-scoring anything', () => {
  const lib = read(RANK_LIB);
  assert.match(
    lib,
    /import \{ rankTaxonomyOptions, MAX_SUGGESTIONS \} from '@\/lib\/taxonomy-search-rank';/,
    'lib/kind-search-trades.ts stopped importing the shared ranker',
  );
  // The four-tier scoring is a distinctive, load-bearing shape of the ONE
  // ranker this repo has. If it shows up here too, a second matcher was born.
  assert.ok(
    !/labelLc\.startsWith\(trimmed\)/.test(lib),
    'the trade-search wiring grew its OWN copy of the four-tier scoring — import it, do not re-derive it',
  );
  assert.match(
    lib,
    /return rankTaxonomyOptions\(eligible, query, limit\);/,
    'the wiring stopped delegating the actual ranking to the shared function',
  );
});

test('the maker calls the wiring module, not a hand-rolled filter, for trades', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /import \{ rankTradeMatches, type TradeMatch \} from '@\/lib\/kind-search-trades';/,
    'the maker stopped importing the trade-search wiring',
  );
  assert.match(
    src,
    /rankTradeMatches\(tradeOptions, kindQuery, existingKindValues\)/,
    'the maker stopped calling the shared ranker for the 262 live trades',
  );
});

// ---------------------------------------------------------------------------
// 2 · EVERY RANKED TRADE CARRIES ITS STANDING BEFORE IT REACHES A KindPill
// ---------------------------------------------------------------------------

test('a ranked trade is never rendered bare — standing rides along to the pill', () => {
  const src = read(MAKER);
  // Isolate the block that renders `rankedTrades` so this cannot be satisfied
  // by `standing` appearing anywhere else in a 2000+ line file.
  const at = src.indexOf('rankedTrades.map((t) =>');
  assert.ok(at > 0, 'the ranked-trade render block is gone');
  const block = src.slice(at, at + 500);
  assert.match(
    block,
    /standing: t\.standing/,
    'a ranked trade reaches KindPill WITHOUT its standing — a capped supplier could pick one and be refused only at Publish',
  );
  assert.match(block, /why: t\.why/, 'a locked ranked trade lost its reason on the way to the pill');
  assert.match(block, /<KindPill/, 'ranked trades stopped rendering through the shared pill component');
});

test('the pill actually reads the standing it was handed — a locked pill is disabled, not styled', () => {
  const src = read(MAKER);
  const pillFn = src.slice(src.indexOf('function KindPill'), src.indexOf('function CardRegion'));
  assert.match(pillFn, /disabled=\{locked\}/, 'KindPill stopped refusing a locked kind');
  assert.match(pillFn, /const locked = opt\.standing === 'locked';/, 'KindPill stopped reading standing at all');
});

// ---------------------------------------------------------------------------
// 3 · A TRADE ALREADY SHOWN IN THE COVERAGE BAND IS NOT SHOWN TWICE
// ---------------------------------------------------------------------------

test('the search excludes every kind already on screen, not only the exact coverage match', () => {
  const src = read(MAKER);
  assert.match(
    src,
    /const existingKindValues = useMemo\(\s*\(\) => new Set\(allChoices\.map\(\(o\) => o\.value\)\),/,
    'the dedupe set stopped being built from every kind already on this screen',
  );
  // It must be the SAME set fed to the ranker — a set built and never used
  // would pass this file's earlier assertion while doing nothing.
  assert.match(
    src,
    /rankTradeMatches\(tradeOptions, kindQuery, existingKindValues\)/,
    'the dedupe set is built but never reaches the ranker',
  );
});

// ---------------------------------------------------------------------------
// 4 · SEARCH RESULTS ONLY — NEVER A RENDERED WALL
// ---------------------------------------------------------------------------

test('trades render only once something is typed, and nowhere else on the door', () => {
  const src = read(MAKER);
  // Conditioned on there being any ranked results at all — an empty query
  // yields `rankedTrades === []` (MIN_QUERY_LEN, pinned in
  // lib/kind-search-trades.test.ts), so this branch renders nothing.
  assert.match(
    src,
    /\{rankedTrades\.length > 0 \? \(/,
    'the ranked-trade band stopped being conditional — it would render on an empty query',
  );
  // Exactly one render site — a second one would be the wall coming back in
  // a different spot.
  const occurrences = (src.match(/rankedTrades\.map\(\(t\) =>/g) ?? []).length;
  assert.equal(occurrences, 1, `rankedTrades is rendered ${occurrences} times, expected exactly 1`);
  // The new door itself never dumps the full 262-item list outside the maker.
  const door = read(NEW_DOOR);
  assert.ok(
    !/tradeOptions\.map\(/.test(door),
    'the door started rendering the 262 trades itself instead of handing them to the maker',
  );
});

// ---------------------------------------------------------------------------
// 5 · MISCELLANEOUS STAYS REACHABLE — NOTHING HERE MAY BECOME A GATE
// ---------------------------------------------------------------------------

test('the legacy list — the one holding Miscellaneous — still renders unconditionally', () => {
  const src = read(MAKER);
  // The ranked-trade band sits BEFORE the legacy groups map, additive, never
  // replacing it — misc is one of SERVICE_GROUPS' own members and this file
  // never touches SERVICE_GROUPS or its "Other" group.
  const tradeAt = src.indexOf('rankedTrades.length > 0 ? (');
  const legacyAt = src.indexOf('categoryOptions.map((group) => {');
  assert.ok(tradeAt > 0 && legacyAt > 0, 'one of the two render sites is missing');
  assert.ok(tradeAt < legacyAt, 'the ranked-trade band stopped sitting ahead of (additive to) the legacy groups');
  const door = read(NEW_DOOR);
  assert.match(door, /SERVICE_GROUPS\.map/, 'the legacy groups — which carry Miscellaneous — stopped being built');
});

// ---------------------------------------------------------------------------
// 6 · THE SERVER BUILDS THE LIST FROM THE SAME VISIBILITY + STANDING RULES
// ---------------------------------------------------------------------------

test('the door builds every trade from the visible coverage tree, with the SAME standing the save enforces', () => {
  const door = read(NEW_DOOR);
  assert.match(
    door,
    /const tradeOptions: TradeMatch\[\] = tree\.flatMap\(/,
    'the door stopped building the trade list from the live coverage tree',
  );
  // Read out of `tree` — the SAME `getCoverageTaxonomy()` read used for the
  // coverage picker and `coverageAllowed`, so a retired/hidden leaf is absent
  // here for exactly the reason it is absent there. A second, separate fetch
  // would be a second visibility rule.
  const at = door.indexOf('const tradeOptions: TradeMatch[]');
  const block = door.slice(at, at + 700);
  assert.match(block, /standingOf\(l\.canonicalService\)/, 'each trade stopped asking the SAME standing function the save enforces');
  assert.match(block, /branch: b\.label/, 'a trade lost its branch — two similar trades could no longer be told apart');
  assert.match(door, /tradeOptions=\{tradeOptions\}/, 'the door stopped handing the trade list to the maker');
});
