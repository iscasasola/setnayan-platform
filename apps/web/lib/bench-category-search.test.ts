/**
 * bench-category-search.test.ts — the bench's "Find more" must SEARCH IN PLACE.
 *
 * OWNER REPORT 2026-07-29: *"clicking find more doesn't search specifically for
 * that category. and it jumps to a new page, it needs to stay on that page."*
 *
 * The in-place sheet (`CategorySearchOverlay`) has shipped since the
 * pre-takeover accordion and was mounted in exactly ONE place. The new bench
 * kept the old `/explore?tile=` `<Link>`. These tests hold the wiring in place
 * and hold the SCOPE honest.
 *
 * Pure assertions for the resolver; source assertions for the wiring (no DOM in
 * `tsx --test`, no testing-library in the workspace, and the bench is a
 * 1900-line client component whose imports reach the Supabase client) — the same
 * shape `lib/live-studio-wave8-layout.test.ts` uses.
 *
 * MUTATION-CHECKED: reverting the rail-end card to `<Link href={t.exploreHref}>`
 * turns "the rail-end card opens the in-place sheet, it does NOT navigate away"
 * red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { benchSearchGroupForTile, benchSearchScopeForTile } from './bench-category-search';
import { PLAN_GROUPS } from './wedding-plan-groups';
import { canonicalServicesForTile } from './vendor-counts';
import { WEDDING_TILES_BY_PARENT, ADMIN_ONLY_TILES } from './taxonomy';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => readFileSync(resolve(WEB, rel), 'utf8');
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

const BENCH = 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx';
const OVERLAY = 'app/dashboard/[eventId]/vendors/_components/category-search-overlay.tsx';
const ACTION = 'app/dashboard/[eventId]/vendors/_actions/category-search.ts';

const ALL_TILES: string[] = [];
for (const tiles of Object.values(
  WEDDING_TILES_BY_PARENT as Record<string, readonly string[]>,
)) {
  ALL_TILES.push(...tiles);
}

/* ═══════════════════════════════════════════════════════════════════════════
   1 · THE SCOPE RESOLVER — total, so no bench row is left navigating away
   ═══════════════════════════════════════════════════════════════════════════ */

test('every wedding tile resolves to a scope — no row falls back to a page jump', () => {
  for (const tile of ALL_TILES) {
    const scope = benchSearchScopeForTile(tile);
    assert.equal(scope.tile, tile, `${tile} must carry its own tile scope`);
  }
});

test('a tile finer than every plan group still gets a real scope', () => {
  // 47 of the 69 tiles are the catalogTile of NO plan group. Under a
  // group-only bridge these would have kept jumping to /explore.
  const orphan = ALL_TILES.filter((t) => benchSearchGroupForTile(t) === null);
  assert.ok(orphan.length > 0, 'fixture guard: expected tiles with no plan group');
  for (const tile of orphan) {
    assert.equal(benchSearchScopeForTile(tile).groupId, '');
    assert.equal(benchSearchScopeForTile(tile).tile, tile);
  }
  // …and the tile scope is not a fiction: it resolves to real canonicals.
  // ADMIN_ONLY_TILES are filing cabinets, not shelves — nothing renders a bench
  // row for one, so "resolves to no canonicals" is their designed state rather
  // than an empty sheet somebody can reach. `taxonomy-tile-reachability.test.ts`
  // is what pins them invisible; this file only has to stop counting them.
  const withoutCanonicals = orphan.filter(
    (t) => !ADMIN_ONLY_TILES.has(t as never) && canonicalServicesForTile(t as never).length === 0,
  );
  assert.deepEqual(
    withoutCanonicals,
    ['editorial'],
    'only `editorial` has no canonical services; a new empty tile needs a decision, not a silent empty sheet',
  );
});

test('a tile owned by TWO plan groups picks the tile-wide one, never the narrower sibling', () => {
  // `reception` is the catalogTile of reception_venue AND accommodation(hint);
  // `ceremony_venue` of ceremony_venue AND officiant(hint). A row labelled
  // "Reception" must not search hotels.
  assert.equal(benchSearchGroupForTile('reception'), 'reception_venue');
  assert.equal(benchSearchGroupForTile('ceremony_venue'), 'ceremony_venue');
  for (const tile of ALL_TILES) {
    const id = benchSearchGroupForTile(tile);
    if (!id) continue;
    const g = PLAN_GROUPS.find((p) => p.id === id);
    assert.ok(g, `${tile} resolved to an unknown group ${id}`);
    assert.equal(g!.catalogTile, tile, `${tile} must only ever resolve to a group whose catalogTile IS ${tile}`);
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   2 · THE SCOPE WIDTH — a row must search itself, not a fraction of itself
   ═══════════════════════════════════════════════════════════════════════════ */

test('the action scopes by TILE first — the group hint would search a fraction of the row', () => {
  const src = code(ACTION);
  // The tile branch must come BEFORE the PLAN_GROUPS lookup.
  const tileAt = src.indexOf('canonicalServicesForTile(tile as WeddingTile)');
  const groupAt = src.indexOf("PLAN_GROUPS.find((x) => x.id === groupId)");
  assert.ok(tileAt > 0 && groupAt > 0, 'canonicalsForScope must handle both keys');
  assert.ok(
    tileAt < groupAt,
    'the tile scope must be preferred over the group: for 13 of the 22 mapped tiles the ' +
      "group's subcategoryHint collapses the scope to ONE canonical (Coordinator 1 of 12, " +
      'Catering 1 of 5, Hair & makeup 1 of 6).',
  );
  // Either key alone is a valid scope.
  assert.match(src, /if \(!eventId \|\| \(!groupId && !tile\)\) return EMPTY;/);
});

test('the group scope really is narrower than the row for the categories named above', () => {
  // Guards the REASON for the ordering above, so a future "simplify" can't
  // quietly flip it back on the grounds that the two scopes are equivalent.
  for (const tile of ['coordinator', 'catering', 'hmua']) {
    const id = benchSearchGroupForTile(tile);
    const g = PLAN_GROUPS.find((p) => p.id === id);
    assert.ok(g?.subcategoryHint, `${tile}'s group is expected to carry a subcategoryHint`);
    assert.ok(
      canonicalServicesForTile(tile as never).length > 1,
      `${tile} is expected to span more than one canonical service`,
    );
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   3 · THE WIRING — the bench opens the sheet instead of leaving the page
   ═══════════════════════════════════════════════════════════════════════════ */

test('the rail-end card opens the in-place sheet, it does NOT navigate away', () => {
  const src = code(BENCH);
  // BOTH rail-end labels ("Find more" / "＋ Add another X") and the empty-state
  // card go through the same doorway → two call sites.
  const calls = src.match(/openSearch\(t\.tile, t\.label\)/g) ?? [];
  assert.equal(
    calls.length,
    2,
    'the rail-end card AND the empty-category card must both call openSearch(t.tile, t.label) — ' +
      'reverting either to <Link href={t.exploreHref}> is the owner-reported bug (2026-07-29).',
  );
  assert.match(src, /<CategorySearchOverlay/, 'the bench must mount the shipped overlay');
  assert.match(src, /setSearch\(\{ \.\.\.benchSearchScopeForTile\(tile\), label \}\)/);
});

test('flag OFF keeps the shipped /explore navigation, byte for byte', () => {
  const src = code(BENCH);
  // Two `replan ? <button…> : <Link href={t.exploreHref}…>` forks.
  const links = src.match(/<Link href=\{t\.exploreHref\}/g) ?? [];
  assert.equal(links.length, 2, 'both doorways must keep their pre-replan <Link> fallback');
  // …and each one is the ELSE arm of a `replan` fork, never the only arm.
  const forks = src.match(/\{replan \? \([\s\S]{0,900}?<Link href=\{t\.exploreHref\}/g) ?? [];
  assert.equal(forks.length, 2, 'each <Link> must sit behind `replan ? <button…> : <Link…>`');
});

test('exploreHref stays on the tile type (other callers / the flag-OFF path)', () => {
  assert.match(code('lib/shortlist-taxonomy.ts'), /exploreHref: string;/);
});

test('add-and-stay reports back so the rail repaints', () => {
  // saveVendorToPicks revalidates `/dashboard/[eventId]` — the OVERVIEW page,
  // not this nested route — so without this the vendor the couple just added
  // would not appear in the category rail until a hard reload.
  assert.match(code(OVERLAY), /onAdded\?\.\(vendorProfileId\)/);
  assert.match(code(BENCH), /onAdded=\{\(\) => setSearchAdded\(true\)\}/);
  assert.match(code(BENCH), /if \(searchAdded\) router\.refresh\(\);/);
});

test('the empty state does not tell a couple to widen filters they never set', () => {
  // Prod is pre-launch-empty (0 vendor_services), so EVERY category search
  // returns 0 today — this is the state the owner hits first.
  const src = code(OVERLAY);
  assert.match(
    src,
    /\{query\.trim\(\) \|\| filterCount > 0 \? \(/,
    'the empty copy must branch on whether anything is actually narrowing the search',
  );
  assert.match(src, /vendors here yet/);
});

test('the accordion call site is untouched — tile + onAdded are optional', () => {
  const accordion = code('app/dashboard/[eventId]/vendors/_components/plan-budget-accordion.tsx');
  assert.match(accordion, /<CategorySearchOverlay/);
  assert.doesNotMatch(
    accordion,
    /<CategorySearchOverlay[\s\S]{0,240}tile=/,
    'the pre-takeover accordion must keep passing only groupId (its group path is unchanged)',
  );
});
