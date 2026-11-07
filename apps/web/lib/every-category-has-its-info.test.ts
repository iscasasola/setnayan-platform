/**
 * every-category-has-its-info.test.ts — EVERY category row and EVERY group on Find has its ⓘ, whatever the
 * hard-coded hint maps hold (owner 2026-10-31, live: "I added a category shoes but there is not (i)" … "This means
 * you need to add a place for me to write an (i)").
 *
 * THE BUG THIS HOLDS SHUT. The row drew its ⓘ only when `categoryHintForTile` returned text, and that text came
 * only from two maps in code (`TILE_HINTS`, the plan groups' `hint`). A category added in Admin › Categories is in
 * neither — so `null`, so no ⓘ. `category-hints.test.ts` could not see it: it measures the CODE's tile list, and a
 * category the owner adds lives only in the database. A guard aimed at the code's universe passes while the
 * owner's own category is mute.
 *
 * THE ANSWER IS NOW TOTAL, from ONE source (Admin): the owner's words (`service_categories.hint_en`) → the old line
 * (fallback only) → "Shoes covers: <its services from Admin>" → "Shoes: suppliers for this category.". These tests
 * drive a category and a group that NO code map knows, and hold the row to drawing the ⓘ with no branch.
 *
 * SABOTAGE-CHECKED 2026-10-31: wrapping the row's ⓘ back in `{t.hint ? ( … ) : null}` turns
 * "source · the category ⓘ is drawn with no branch" red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { buildShortlistFolders } from '@/lib/shortlist-taxonomy';
import { fallbackSnapshot, type TaxonomySnapshot } from '@/lib/taxonomy-snapshot';
import { categoryInfoText, someCategoryNeedsItsServicesNamed } from '@/lib/explore-info-copy';
import { FOLDER_HINTS, TILE_HINTS, coversLine, folderInfoText } from '@/lib/category-hints';

/** The fallback taxonomy plus what the owner added in Admin: a "Shoes" category under Look, and a whole new group. */
function withShoes(over: Partial<Pick<TaxonomySnapshot, 'categoryHints'>> = {}): TaxonomySnapshot {
  const t = fallbackSnapshot();
  t.tileOrder = [...t.tileOrder, 'shoes' as never, 'party_favors' as never];
  t.tileParent = { ...t.tileParent, shoes: 'look' as never, party_favors: 'keepsakes' as never };
  t.tileLabel = { ...t.tileLabel, shoes: 'Shoes', party_favors: 'Party favors' };
  t.tileSlug = { ...t.tileSlug, shoes: 'shoes', party_favors: 'party-favors' };
  t.tilesByParent = { ...t.tilesByParent, look: [...(t.tilesByParent.look ?? []), 'shoes' as never], keepsakes: ['party_favors' as never] };
  t.folderOrder = [...t.folderOrder, 'keepsakes' as never];
  t.folderLabel = { ...t.folderLabel, keepsakes: 'Keepsakes' };
  t.folderSlug = { ...t.folderSlug, keepsakes: 'keepsakes' };
  t.map = {
    ...t.map,
    bridal_shoes: { folder: 'look' as never, phase: 'V1.1 base' as never, tile: 'shoes' as never },
    custom_heels: { folder: 'look' as never, phase: 'V1.1 base' as never, tile: 'shoes' as never },
    shoe_shine: { folder: 'look' as never, phase: 'V1.1 base' as never, tile: 'shoes' as never, marketplaceHidden: true },
  };
  t.categoryHints = over.categoryHints ?? {};
  return t;
}

const LABELS = { bridal_shoes: 'Bridal shoes', custom_heels: 'Custom heels', shoe_shine: 'Shoe shine' };

const build = (taxonomy: TaxonomySnapshot, serviceLabels?: Record<string, string>) =>
  buildShortlistFolders({ vendorRows: [], eventType: 'wedding', faithSet: new Set(), eventId: 'e', taxonomy, serviceLabels });

const tileOf = (folders: ReturnType<typeof build>, tile: string) => folders.flatMap((f) => f.tiles).find((t) => t.tile === tile);

test('the premise: no code map knows Shoes or Keepsakes — this is the case that used to hide the ⓘ', () => {
  assert.equal(TILE_HINTS.shoes, undefined);
  assert.equal((FOLDER_HINTS as Record<string, string | undefined>).keepsakes, undefined);
});

test('EVERY category row and EVERY group carries a non-blank ⓘ — the shipped taxonomy and the owner’s additions', () => {
  const folders = build(withShoes(), LABELS);
  assert.ok(tileOf(folders, 'shoes'), 'the Shoes row is not drawn at all — the fixture no longer reaches the bench');
  const mute = folders.flatMap((f) => [f, ...f.tiles]).filter((x) => !x.hint.trim());
  assert.deepEqual(mute.map((x) => x.label), [], 'rows with no ⓘ text');
});

test('a category nobody wrote for names its services from Admin — hidden services left out', () => {
  assert.equal(tileOf(build(withShoes(), LABELS), 'shoes')?.hint, 'Shoes covers: Bridal shoes and Custom heels.');
});

test('a category with no services yet still has its ⓘ', () => {
  assert.equal(tileOf(build(withShoes()), 'shoes')?.hint, 'Shoes: suppliers for this category.');
});

test('a group nobody wrote for names its categories', () => {
  const g = build(withShoes(), LABELS).find((f) => f.folder === ('keepsakes' as never));
  assert.equal(g?.hint, 'Keepsakes covers: Party favors.');
});

test('the owner’s words WIN — over the built line, and over an old hard-coded one', () => {
  const folders = build(
    withShoes({ categoryHints: { shoes: 'Heels, flats, and the pair you dance in.', catering: 'Our own words.', look: 'Group words.' } }),
    LABELS,
  );
  assert.equal(tileOf(folders, 'shoes')?.hint, 'Heels, flats, and the pair you dance in.');
  assert.equal(tileOf(folders, 'catering')?.hint, 'Our own words.');
  assert.equal(folders.find((f) => f.folder === 'look')?.hint, 'Group words.');
});

test('blank words are not words — the fallback answers', () => {
  assert.equal(categoryInfoText({ tile: 'shoes', label: 'Shoes', written: '   ' }), 'Shoes: suppliers for this category.');
  assert.equal(folderInfoText({ folder: 'look', label: 'Look', written: '' }), FOLDER_HINTS.look);
});

test('a long list says "and N more" — an ⓘ is a line, not a catalogue', () => {
  assert.equal(coversLine('Shoes', ['A', 'B', 'C', 'D', 'E', 'F', 'G'], 'category'), 'Shoes covers: A, B, C, D, E and 2 more.');
  assert.equal(coversLine('Shoes', ['A'], 'category'), 'Shoes covers: A.');
});

test('the page reads service names only while some category needs the built line', () => {
  assert.equal(someCategoryNeedsItsServicesNamed(fallbackSnapshot()), false, 'every shipped tile has an old line');
  assert.equal(someCategoryNeedsItsServicesNamed(withShoes()), true);
  assert.equal(someCategoryNeedsItsServicesNamed(withShoes({ categoryHints: { shoes: 'Written.', party_favors: 'Written.' } })), false);
});

/* ── source · the row draws what it is given, with no hidden-ⓘ branch ─────── */

const HERE = dirname(fileURLToPath(import.meta.url));
const BENCH = stripComments(
  readFileSync(resolve(HERE, '../app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx'), 'utf8'),
);

/** The 60 non-space characters before a site — enough to see a `cond ? (` or `cond && (` that guards it. */
function leadIn(site: string): string {
  const i = BENCH.indexOf(site);
  assert.ok(i > -1, `the ⓘ call site is gone: ${site}`);
  return BENCH.slice(Math.max(0, i - 400), i).replace(/\s+/g, '').slice(-60);
}

test('source · the category ⓘ is drawn with no branch, and shows the resolved text', () => {
  const site = '<Explain title={t.label} label={categoryHintButtonLabel(t.label)} data="category-hint"';
  assert.equal(BENCH.split(site).length - 1, 1, 'the category ⓘ must be drawn exactly once per row');
  const before = leadIn(site);
  assert.ok(!/(\?\(|&&\(|\?<|&&<)$/.test(before), `the category ⓘ sits behind a condition again: …${before}`);
  const after = BENCH.slice(BENCH.indexOf(site), BENCH.indexOf(site) + 300);
  assert.match(after, /data="category-hint"[^>]*>\s*\{t\.hint\}\s*<\/Explain>/, 'the category ⓘ no longer shows `t.hint`');
  assert.ok(!/categoryHintForTile\(/.test(BENCH), 'the row resolves its own ⓘ again — a lookup that can miss a category Admin added');
});

test('source · the group ⓘ is drawn with no branch, and shows the resolved text', () => {
  const site = '<Explain title={folder.label} label={folderHintButtonLabel(folder.label)} data="folder-hint"';
  const before = leadIn(site);
  assert.ok(!/(\?\(|&&\(|\?<|&&<)$/.test(before), `the group ⓘ sits behind a condition again: …${before}`);
  assert.ok(!/folderHintFor\(/.test(BENCH), 'the row looks its group ⓘ up in code again');
});
