/**
 * 🔒 EVERY GRAPH IS A TILE, AND A TILE RISES TO OUR RECOMMENDATION (Build 6 Lane I — owner 10 Nov, prototype
 * `build6_makers_analytics_2026-11-10` "Proposed · one Analytics", approved 10 Nov: *"No dupes. we want graphs that will
 * help them. tapping shows a recommendation from us on what they need to do."* → *"All five"*).
 *
 *   1. ONE Analytics — since 11 Nov 2026 the Shop tab's carousel (owner: *"Analytics should be the carousel"*): twelve
 *      graphs, each built ONCE per window (`graphSpecsFor`) and drawn as ONE card (Opened · Asked · Booked are the three
 *      count cards in front of them — `shop/analytics-is-the-carousel.test.ts`).
 *   2. Every tile names its data (`src`) before it draws.
 *   3. A tap rises into THE one Rise full screen (`RiseScreen`, Build 5 Lane A) — no second rise.
 *   4. ONE recommendation, from `buildGrowthRecs` only, and only on a tile whose numbers are real (`ok`): an Example tile
 *      and a refused tile never carry advice. Every rec key a graph points at is a real rule.
 *   5. Empty draws the real picture with sample data, faded, marked "Example"; refused says "Couldn’t load." — never the
 *      Example, never a zero. The five new graphs are refused exactly when their read is `null`.
 *   6. The section feeds it: `readNewGraphs` on the session + the admin client, per window, handed down as `graphs`.
 *
 * Source-reading, comments stripped (`stripComments`), so a docblock that MENTIONS a symbol never satisfies a pin.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { buildGrowthRecs } from '@/lib/vendor-growth-recs';
import { GRAPH_SOURCE } from '@/lib/vendor-analytics-graphs';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const TREE = 'app/vendor-dashboard/performance/_components/analytics-growing.tsx';
const TILE = 'app/vendor-dashboard/performance/_components/graph-tile.tsx';
const PAGE = 'app/vendor-dashboard/performance/_components/one-analytics-section.tsx';
const CAROUSEL = 'app/vendor-dashboard/performance/_components/analytics-carousel.tsx';

const GRAPHS = ['sources', 'cardsell', 'reply', 'replyvs', 'quotes', 'split', 'calendar', 'lost', 'slow', 'rep', 'bench', 'price'] as const;
const NEW = ['lost', 'cardsell', 'replyvs', 'slow', 'quotes'] as const;
/** The live Shop carousel cards, each now inside the tile that owns its fact (prototype "the dedupe table"). */
const ABSORBED = ['split', 'calendar', 'bench', 'price'] as const;

/** The object literal of one tile's spec, from its `k:` to the next spec's `k:` (or the render). */
function spec(tree: string, k: string): string {
  const at = tree.indexOf(`k: '${k}',`);
  assert.ok(at > 0, `no tile spec for "${k}"`);
  const next = tree.slice(at + 4).search(/\bk: '[a-z]+',|\n  return \{ /);
  return tree.slice(at, next < 0 ? undefined : at + 4 + next);
}

test('1 · twelve graphs, each built once and drawn as ONE carousel card', () => {
  const tree = read(TREE);
  const keys = [...tree.matchAll(/\bk: '([a-z]+)',/g)].map((m) => m[1]);
  assert.deepEqual([...keys].sort(), [...GRAPHS].sort(), 'every graph has exactly one spec');
  // The spec builder hands back every graph, once (the bench only when the plan shows it).
  assert.match(tree, /return \{ sources, cardsell, reply, replyvs, quotes, split, calendar, lost, slow, rep, bench: view\.bench\.show \? bench : null, price \};/);
  // The carousel draws each spec through ONE card component, once per key.
  const car = read(CAROUSEL);
  assert.equal((car.match(/<GraphCard\b/g) ?? []).length, 2, 'a second way of drawing a graph (one for the counts, one for the graphs)');
  assert.match(car, /const g = specs\[winOf\(k\)\]\[k as GraphKey\];/, 'a graph card is not drawn from its own window’s spec');
  // No graph is drawn outside a card any more — the old sections and folds are gone.
  assert.ok(!/<Section\b|<Fold\b|<GraphSection\b|<GraphTile\b/.test(tree), 'a graph is drawn outside a card again');
  for (const k of ABSORBED) assert.match(spec(tree, k), /tag: 'absorb'/, `"${k}" is a live carousel card folded in — tag it`);
  for (const k of NEW) assert.match(spec(tree, k), /tag: 'new'/, `"${k}" is one of the five new graphs`);
});

test('2 · every tile names its data before it draws', () => {
  const tree = read(TREE);
  for (const k of GRAPHS) assert.match(spec(tree, k), /\bsrc: (GRAPH_SOURCE\.[a-z]+|'[^']{12,}'|`[^`]{12,}`)/, `"${k}" must say what it reads`);
  for (const k of NEW) {
    assert.match(spec(tree, k), new RegExp(`src: GRAPH_SOURCE\\.${k}\\b`), `"${k}" names its data from GRAPH_SOURCE`);
    assert.ok(GRAPH_SOURCE[k].startsWith('Counts'), `GRAPH_SOURCE.${k} says what it counts`);
  }
  const tile = read(TILE);
  assert.match(tile, /<span className="ag-src">\{g\.src\}<\/span>/, 'the tile draws the source line');
});

test('3 · a tap rises into THE one Rise full screen — no second rise', () => {
  const tile = read(TILE);
  assert.match(tile, /import \{ RiseScreen \} from '@\/app\/_components\/rise\/rise-screen';/);
  assert.match(tile, /<button\s+type="button"\s+onClick=\{\(\) => setOpen\(true\)\}/, 'the card is a button');
  assert.match(tile, /\{open \? \(\s*<RiseScreen\b/, 'the tap opens the shared RiseScreen');
  assert.match(tile, /thumb=\{\s*<div className="ag-onedoor" data-graph-door=\{g\.k\}>/, 'the one door sits in the thumb zone');
  assert.ok(!/BodyPanel|createPortal|data-rise-screen=|position:\s*['"]?fixed/.test(tile), 'no rise of its own — the Rise is RiseScreen');
});

test('4 · one recommendation, from buildGrowthRecs only, only on a real tile', () => {
  const tree = read(TREE);
  const tile = read(TILE);
  assert.match(tile, /const rec = g\.state === 'ok' \? g\.rec : null;/, 'an Example or refused tile never carries advice');
  assert.match(tile, /const door = g\.state === 'ok' && g\.rec \? \{ label: g\.rec\.ctaLabel, href: g\.rec\.ctaHref \} : g\.door;/);
  // The count cards take their rule from the same window's buildGrowthRecs — never copy of their own.
  assert.match(read(CAROUSEL), /const rec: GrowthRec \| null = w \? \(w\.recs\.find\(\(r\) => r\.key === COUNT_REC\[k\]\) \?\? null\) : null;/);
  assert.match(tree, /const byKey = new Map<GrowthRecKey, GrowthRec>\(w\.recs\.map\(\(r\) => \[r\.key, r\]\)\);/, 'the rec is the window’s own buildGrowthRecs');
  for (const k of GRAPHS) assert.match(spec(tree, k), new RegExp(`rec: recOf\\('${k}'\\)`), `"${k}" takes its rec from GRAPH_REC`);
  // Every key GRAPH_REC names is a rule buildGrowthRecs can return.
  const map = tree.slice(tree.indexOf('export const GRAPH_REC'), tree.indexOf('};', tree.indexOf('export const GRAPH_REC')));
  const named = new Set([...map.matchAll(/'([a-z_]+)'/g)].map((m) => m[1] ?? ''));
  const real = new Set(
    buildGrowthRecs(
      { avg_response_minutes: 600, response_rate_pct: 10, review_count: 0, profile_completeness_pct: 10, finalized_booking_count: 0, partnership_count: 0 },
      { askedInWindow: 5, unopenedSaturdays: 2, lostDates: { closed: 1, full: 1 }, quietCard: { serviceId: 's', name: 'X' }, slowMonth: { name: 'Feb', lastDay: '2027-02-28', serviceId: 's' }, expiredQuotes: 1 },
    ).map((r) => r.key as string),
  );
  for (const k of named) assert.ok(real.has(k), `GRAPH_REC names "${k}", which buildGrowthRecs never returns`);
});

test('5 · empty = the Example picture, faded; refused = "Couldn’t load." — never the Example, never a zero', () => {
  const tile = read(TILE);
  assert.match(tile, /g\.state === 'empty' \? <span className="ag-exc">Example<\/span> : null/);
  assert.match(tile, /g\.state === 'unread' \? \(\s*<span className="ag-ln" role="status">\s*Couldn’t load\./, 'a refused tile says so and draws no picture');
  const tree = read(TREE);
  // The five new graphs are refused exactly when their read is null — and the sample only feeds an EMPTY picture.
  const vars: Record<(typeof NEW)[number], string> = { lost: 'l', cardsell: 'cs', replyvs: 'rv', slow: 'sm', quotes: 'q' };
  for (const k of NEW) {
    const v = vars[k];
    assert.match(tree, new RegExp(`const ${v} = graphs\\.${k};`), `"${k}" reads graphs.${k}`);
    assert.match(spec(tree, k), new RegExp(`state: st\\(${v} === null,`), `"${k}" is unread exactly when its read is null`);
    assert.match(spec(tree, k), new RegExp(`Empty \\? S\\.${k} : ${v}!`), `"${k}" draws the sample only when empty`);
  }
  assert.match(tree, /const st = \(unread: boolean, empty: boolean\): GraphState => \(unread \? 'unread' : empty \? 'empty' : 'ok'\);/, 'unread wins over empty');
});

test('6 · the section reads the five graphs on the right clients, per window, and hands them down', () => {
  const page = read(PAGE);
  assert.match(page, /const newGraphsRead = readNewGraphs\(\{\s*session: supabase,\s*admin: bookingsAdmin,/);
  assert.match(page, /const newGraphs = await newGraphsRead;/);
  assert.match(page, /<AnalyticsCarousel view=\{growthView\} graphs=\{newGraphs\} \/>/);
  // 🔁 "Run an offer on <card>" fires ONLY from the graph's own read — the opens `service_card_opens` counts, through the
  // one pure rule, per window. Never a guessed open: no other source may feed it.
  assert.match(page, /const quiet = quietCard\(g\.cardsell\);/, 'the quiet card is not read off the graph');
  assert.match(page, /quietCard: quiet \? \{ serviceId: quiet\.serviceId, name: quiet\.name \} : null,/);
  assert.equal([...page.matchAll(/quietCard:/g)].length, 1, 'a second source feeds "Run an offer on <card>"');
  assert.match(page, /buildGrowthRecs\(recStats, \{ [^}]*\.\.\.recOptsFor\('30'\) \}\)/);
  assert.match(page, /buildGrowthRecs\(recStats, \{ [^}]*\.\.\.recOptsFor\('12'\) \}\)/);
  // The opens are read on the shop's OWN session (counts only), never the admin client — both windows in one call.
  const server = read('lib/vendor-analytics-graphs.server.ts');
  assert.match(server, /session\.rpc\('service_card_opens', \{ p_vendor_profile_id: [^}]*\}\)/);
  assert.doesNotMatch(server, /admin\.rpc\('service_card_opens'/);
  assert.doesNotMatch(server, /p_since/, 'the opens are read twice (one call per window) — the RPC returns both');
});
