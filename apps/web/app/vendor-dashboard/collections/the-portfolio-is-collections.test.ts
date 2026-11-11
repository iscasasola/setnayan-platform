/**
 * 🔒 THE PORTFOLIO IS APPLE PHOTOS › COLLECTIONS, AND WHO-SEES-IT LIVES IN ITS OWN ⚙.
 *
 * Owner 9 Nov, on the live list: *"Shouldnt this be in settings?"* · *"This is my apple photos. We want to improve the
 * portfolio"*; DECISION_LOG 2026-11-09 "PORTFOLIO IS REDESIGNED AFTER APPLE PHOTOS › COLLECTIONS" + "PORTFOLIO
 * PROTOTYPE APPROVED FOR BUILD 5" (artifact SwnvjGzHNhgHML7X34F3fL v3); 2026-11-11 "SUPPLIER ASKS b–e ANSWERED" (d):
 * *"only if that should be there. but if needs to be where it is now, keep it there"* — collections STAY in Portfolio,
 * their who-sees-it controls in the Portfolio's OWN ⚙, NOT Shop › Settings.
 *
 *   1 · THE ⚙ HOLDS WHO SEES WHAT: "Who sees each collection" (On my page · Private · Shared with a couple), the page
 *       switch as a page-DRAFT change, and "Show plays" as ONE dropdown — and the list holds none of them (no who-pill,
 *       no switch, no ✓ per row). Shop › Settings does not hold them either.
 *   2 · THE "EVERYTHING" FILTER AND "N COLLECTIONS · ONE PLACE" ARE DROPPED (approved (6)).
 *   3 · SECTIONS: › opens, ˅ folds (the house rise token, the shut body inert), a rail of tiles on the 16-px gutter —
 *       left = right (the trailing 6-px spacer + the 10-px gap), every collection kept.
 *   4 · AN OPENED COLLECTION is the ONE in-body panel, its name wrapping to two lines, its grid FULL-BLEED (the approved
 *       exception to the 16-px rule), 3 columns, 2-px gaps; a photo opens Show on that photo.
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-10): a `<SwitchTrack` put back in collections-list.tsx (red: 1); the
 *   rail given `pl-3` (red: 3); `bleed` dropped from the OpenedCollection's BodyPanel (red: 4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => stripComments(readFileSync(join(HERE, rel), 'utf8'));
const LIST = read('_components/collections-list.tsx');
const SECTIONS = read('_components/portfolio-sections.tsx');
const SETTINGS = read('_components/portfolio-settings.tsx');
const VIEW = read('_components/portfolio-view.tsx');
const GROUPS = read('_components/portfolio-groups.tsx');
const PANEL = read('../_components/body-panel.tsx');
const LIB = read('../../../lib/supplier-collections.ts');

test('1 · who sees each collection, the page switch and Show plays are in the Portfolio ⚙ — not in the list, not in Shop', () => {
  assert.match(SETTINGS, /<MenuSettingsButton menu="portfolio"/, 'the Portfolio ⚙ is not the shared settings door');
  assert.match(SETTINGS, />Who sees each collection</, 'the ⚙ lost "Who sees each collection"');
  assert.match(SETTINGS, /WHO_BADGE\.page\.word[\s\S]*WHO_BADGE\.private\.word/, 'the page row’s dropdown is not On my page · Private');
  assert.match(SETTINGS, /WHO_BADGE\[r\.who\]\.word/, 'a read-only collection does not say who sees it (Shared with a couple)');
  assert.match(SETTINGS, /usePageDraft\(vendorId, saved\)/, 'the ⚙’s page switch is not a Your-page draft change');
  assert.match(SETTINGS, /label="Show plays"/, 'Show plays is not one dropdown in the ⚙');
  assert.match(SETTINGS, /label: 'Not picked yet'/, '"not picked yet" is not a choice inside the Show dropdown');
  assert.match(VIEW, /<PortfolioSettings\b[\s\S]*?showChoices=\{showChoices\}[\s\S]*?onPick=\{setPicked\}/, 'the ⚙ does not pick the album Show plays');

  for (const gone of [/<SwitchTrack\b/, /role="switch"/, /usePageDraft\(/, /data-collection-pick/, /WHO_BADGE/, /<Badge\b/, /onPick=/]) {
    assert.doesNotMatch(LIST, gone, `the collections list still draws a who-sees-it control (${gone})`);
  }
  assert.doesNotMatch(VIEW, /to pick it for Show/, 'the list’s old eyebrow ("✓ to pick it for Show") is back');

  // 🏪 Owner 11 Nov (d): NOT Shop › Settings.
  const shopGear = stripComments(readFileSync(join(HERE, '../shop/_components/shop-settings-rows.tsx'), 'utf8'));
  assert.doesNotMatch(shopGear, /Who sees each collection|WHO_BADGE|portfolio-who/, 'collections’ who-sees-it moved into Shop › Settings');
});

test('2 · the "Everything" filter and "N collections · one place" are dropped', () => {
  for (const src of [LIST, VIEW, LIB]) {
    assert.doesNotMatch(src, /'Everything'|COLLECTION_FILTERS|collectionsLine|one place/, 'the dropped filter or answer line is back');
  }
  assert.doesNotMatch(LIST, /<PickMenu\b/, 'the list carries a filter dropdown again');
});

test('3 · sections: › opens, ˅ folds on the house motion; rails sit on equal 16-px gutters; every collection kept', () => {
  assert.match(SECTIONS, /const head = \([\s\S]*?\{title\}[\s\S]*?<ChevronRight/, 'the title does not carry its ›');
  // Since Build 6 the › RISES its group full screen (one button, no links) — `each-group-heading-rises-full-screen.test.ts`.
  assert.equal((SECTIONS.match(/aria-label=\{`Open \$\{title\}`\} aria-haspopup="dialog" data-portfolio-open=\{id\}>\s*\{head\}/g) ?? []).length, 1, 'the titled head is not the › that opens its section');
  assert.match(SECTIONS, /aria-expanded=\{!folded\}/, 'the ˅ does not say whether the section is folded');
  assert.match(SECTIONS, /gridTemplateRows: folded \? '0fr' : '1fr', transitionDuration: 'var\(--sn-dur-rise\)'/, 'the fold is not the house rise motion');
  assert.match(SECTIONS, /inert=\{folded\}/, 'a folded section stays reachable');
  assert.match(SECTIONS, /className="flex snap-x snap-mandatory items-start gap-2\.5 overflow-x-auto scroll-pl-4 pl-4 pr-0 /, 'the rail is not on the 16-px gutter');
  assert.match(SECTIONS, /<span aria-hidden className="w-1\.5 flex-none" \/>/, 'the rail’s right gutter (6 px + the 10-px gap) is gone — left ≠ right');
  assert.match(SECTIONS, /data-portfolio-section-head=""/);
  assert.match(SECTIONS, /className="flex min-h-11 items-center gap-2 px-4 pb-2\.5" data-portfolio-section-head/, 'a section head is off the 16-px gutter');
  for (const k of ['page', 'cards', 'albums', 'own', 'delivered', 'instagram', 'moodboard']) {
    assert.match(LIB, new RegExp(`\\b${k}: '`), `the ${k} collection has no section name`);
  }
  // Every section is drawn, empty or not — rendered in `an-empty-portfolio-looks-finished.test.ts`.
  assert.match(LIST, /<Fold anchor="gallery-media"/, 'Add photos (the shipped gallery editors) is gone');
});

test('4 · an opened collection: the one panel, a two-line name, a FULL-BLEED 3-column grid; a photo opens Show on it', () => {
  assert.match(GROUPS, /<BodyPanel\b[^>]*titleLines=\{2\} bleed>/, 'the opened collection is not the full-bleed panel with a two-line name');
  assert.match(GROUPS, /className="grid grid-cols-3 gap-\[2px\]" data-collection-grid="" data-bleed=""/, 'the grid is not 3 columns, 2-px gaps, full-bleed');
  assert.match(GROUPS, /<PortfolioShow title=\{photos\.title\} urls=\{photos\.urls\} start=\{showAt\}/, 'a tapped photo does not open Show on that photo');
  assert.match(PANEL, /titleLines === 2 \? 'line-clamp-2' : 'truncate'/, 'the panel cannot wrap a long name to two lines');
  assert.match(PANEL, /\$\{bleed \? '' : 'px-4 pt-3'\}/, 'the panel cannot run its body edge to edge');
  assert.match(GROUPS, /<div className="px-4 pt-3">/, 'the rows around the grid lost their 16-px gutters');
});
