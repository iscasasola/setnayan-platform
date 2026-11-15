/**
 * Discover (`/`) HAS the suppliers — and it draws them with the marketplace's ONE pipeline.
 *
 * DECISION_LOG 2026-11-12 "DISCOVER WITH SUPPLIERS — PROTOTYPE APPROVED"
 * (prototypes/discover_with_suppliers_2026-11-12_fable.html); owner: *"find suppliers needs to be also inside
 * discover already. they do not need to have their own page"*.
 *
 * Source guards (comments stripped with the repo's one stripper, `lib/strip-comments.ts`):
 *   (b) `/` with a supplier parameter draws the supplier view; WITHOUT one it neither loads nor runs the pipeline —
 *       the module is imported only inside the supplier branch, and the branch is gated on `opensSupplierView`;
 *   (e) the "Narrow these results…" box is not drawn on `/` — Discover's branch draws no StickyMarketplaceHeader,
 *       no focused-mode search form and no TaxonomySearch: ONE search box, the top bar's;
 *   (f) Sort on `/` is ONE dropdown that lists its choices (`PickMenu`), never the chip row;
 *   (g) ONE pipeline: `/explore` and `/` both render `MarketplaceView`; neither page defines its own gate, query or
 *       filter parser.
 * The pure `q` rule (c) is held by `lib/discover-suppliers.test.ts`.
 *
 * Sabotage (2026-11-12), each restored:
 *   · a static `import { MarketplaceView } from …marketplace-view` at the top of front-door.tsx → (b) red;
 *   · `<StickyMarketplaceHeader` put back into Discover's branch → (e) red;
 *   · the sort chips (`SORT_CHIP_KEYS.map`) put into Discover's branch → (f) red;
 *   · `const isLandingView = …` added to front-door.tsx → (g) red; explore/page.tsx restored → (g) red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..', '..', '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const FRONT_DOOR = 'app/_components/frontdoor/front-door.tsx';
const HOME = 'app/page.tsx';
const VIEW = 'app/(shell)/explore/_lib/marketplace-view.tsx';
const EXPLORE = 'app/(shell)/explore/page.tsx';
const HEAD = 'app/(shell)/explore/_components/discover-supplier-head.tsx';
const CONTROLS = 'app/_components/frontdoor/discover-supplier-controls.tsx';

/** Discover's branch of the view: from `if (surface === 'discover') {` (the one that draws the head) to its end. */
function discoverBranch(): string {
  const src = code(VIEW);
  const branches = [...src.matchAll(/\n {2}if \(surface === 'discover'[^\n]*\) \{\n/g)].map((m) => {
    const end = src.indexOf('\n  }\n', m.index! + 1);
    return end > m.index! ? src.slice(m.index!, end) : '';
  });
  const branch = branches.find((b) => b.includes('<DiscoverSupplierHead'));
  assert.ok(branch, "Discover's supplier branch is gone from the marketplace view");
  return branch;
}

test('(b) `/` hands every parameter to the front door', () => {
  assert.match(code(HOME), /<FrontDoor q=\{q\} params=\{params\} \/>/, '`/` no longer passes its parameters on');
});

test('(b) the plain `/` neither loads nor runs the pipeline; a supplier parameter draws it', () => {
  const src = code(FRONT_DOOR);
  // No VALUE import of the pipeline at the top — a type import is erased and loads nothing.
  for (const m of src.matchAll(/^import\s+(type\s+)?\{([^}]*)\}\s+from\s+['"]([^'"]+marketplace-view)['"]/gm)) {
    assert.ok(m[1], `front-door.tsx loads the marketplace pipeline on every request: ${m[0]}`);
  }
  // It is loaded ONLY behind the supplier test…
  assert.match(
    src,
    /const supplierView = opensSupplierView\(params\);/,
    'the supplier view is no longer decided by `opensSupplierView`',
  );
  assert.match(
    src,
    /const MarketplaceView = supplierView\s*\?\s*\(await import\(['"]@\/app\/\(shell\)\/explore\/_lib\/marketplace-view['"]\)\)\.MarketplaceView\s*:\s*null;/,
    'the pipeline is no longer loaded only when a supplier parameter is present',
  );
  // …and drawn as Discover's supplier view.
  assert.match(src, /<MarketplaceView raw=\{params\} surface="discover" \/>/);
  // The shelves' reads are skipped while it is open (the view replaces them).
  assert.match(src, /supplierView \? null : loadFrontDoorData\(\)/);
  assert.match(src, /searchQuery \|\| supplierView \? null : loadDiscover\(\)/);
});

test('(e) no "Narrow these results" box on `/` — the top bar’s search is the one search', () => {
  const branch = discoverBranch();
  for (const tag of ['<StickyMarketplaceHeader', '<FocusedModeSearchForm', '<TaxonomySearch', '<ExploreSearchHero']) {
    assert.ok(!branch.includes(tag), `Discover's supplier view draws ${tag} — a second search box on \`/\``);
  }
  for (const rel of [HEAD, CONTROLS, FRONT_DOOR]) {
    assert.doesNotMatch(code(rel), /taxonomy-search|sticky-marketplace-header/, `${rel} pulls in the marketplace's own search box`);
  }
  // Signed out, the top bar's ONE box carries the open view's parameters (sent from `/`) so typing narrows it.
  const shell = code('app/_components/frontdoor/front-door-shell.tsx');
  assert.match(shell, /onSubmit=\{\(e\) => carrySupplierView\(e\.currentTarget\)\}/, 'the top bar box no longer carries the open supplier view');
  assert.match(shell, /if \(window\.location\.pathname !== '\/'\) return;\s*for \(const \[k, v\] of supplierSearchCarry\(/);
});

test('(f) Sort on `/` is ONE dropdown that lists its choices — never the chip row', () => {
  const branch = discoverBranch();
  assert.ok(!branch.includes('SORT_CHIP_KEYS'), "Discover's supplier view draws the sort chips");
  assert.match(branch, /sort=\{\{\s*value: filters\.sort,\s*options: SORT_KEYS\.map\(/, 'Sort no longer lists every order');
  assert.match(code(HEAD), /<DiscoverSortMenu value=\{sort\.value\} options=\{sort\.options\} \/>/);
  const controls = code(CONTROLS);
  const sortMenu = controls.slice(controls.indexOf('export function DiscoverSortMenu'));
  assert.match(sortMenu, /<PickMenu\b/, 'Sort is no longer the shared dropdown (PickMenu opens its choices; it never cycles)');
  // Off-season moved INTO Filters on `/`: the band is `/explore`'s alone.
  assert.match(branch, /offSeason: filters\.offSeason,/);
  assert.ok(!branch.includes('Off-season savings\n'), "Discover's supplier view draws the off-season band");
});

test('(g) ONE pipeline — Discover renders the shared view and defines no gate of its own', () => {
  // 2026-11-12 (commit B): `/explore` is no longer a page — it forwards to `/` (lib/legacy-redirects.ts) — so the
  // shared view has ONE caller, the front door. It must stay the only definition of who may be shown.
  assert.ok(!existsSync(join(WEB, EXPLORE)), '/explore is a page again — it forwards to Discover since 2026-11-12');
  const view = code(VIEW);
  assert.match(view, /export async function MarketplaceView\(/);
  for (const [rel, src] of [[FRONT_DOOR, code(FRONT_DOOR)]] as const) {
    for (const own of [
      /\bconst isLandingView\b/,
      /\bfunction parseFilters\b/,
      /\.from\(['"]vendor_market_stats['"]\)/,
      /\bLIVE_SHOP_GATE\b/,
      /\bfetchMarketplaceServiceCards\(/,
    ]) {
      assert.doesNotMatch(src, own, `${rel} defines its own marketplace rule (${own}) — there is ONE pipeline`);
    }
  }
});
