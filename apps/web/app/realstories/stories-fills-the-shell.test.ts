import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * STORIES FILLS THE SHELL'S COLUMN — and its shelf keeps one rhythm.
 *
 * ─── WHAT THIS IS FOR ────────────────────────────────────────────────────
 * Owner, 2026-08-16, on Home and this page side by side: *"why is it on home,
 * you fill the main body corner to corner while other pages are not?"*
 *
 * The cause was a page re-capping a column the shell had already set. `.fd-col`
 * caps at 1600 and centres (uncapped from 1064 on 2026-08-14, on the owner's
 * *"ours look too big"* complaint); this page's own `mx-auto max-w-5xl` then
 * squeezed that to 1024, so ~280px of cream sat on each side and one rail-click
 * changed the apparent product.
 *
 * ⚠ THESE ARE TEXT GUARDS. They can see that no cap is written on the <main>
 * and that the four shelf grids carry the same ladder. They CANNOT see a
 * rendered width — a cap arriving from a wrapper component, a plugin, or an
 * `@apply` would pass every assertion here. Do not upgrade "the guards pass"
 * to "the page fills the column"; that claim needs a browser.
 *
 * 🔑 The grid ladder half exists because the shelf is DELIBERATELY headless
 * after "The archive" (one-shelf decision, 2026-08-13). Its whole legibility
 * rests on rendering in the same rhythm as the grids above it, so widening
 * three of four grids is a silent regression of that decision, not a
 * cosmetic drift.
 */

const HERE = dirname(fileURLToPath(import.meta.url));

/** Comments stripped, so prose about a rule can never satisfy a check for it. */
function source(rel: string): string {
  return readFileSync(join(HERE, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

/*
  ⚠ page.tsx IS NOT BESIDE THIS TEST (2026-08-15). Only `page.tsx` and
  `loading.tsx` moved into `app/(shell)/realstories/`, where the group layout
  mounts the shared shell ONCE so it survives navigation. `_components/`,
  `[slug]/` and this test stayed put — deliberately, because
  `app/realstories/[slug]` is `revalidate = false` and must remain statically
  generated, which the group layout's force-dynamic would have taken away.

  🔑 A route group is INVISIBLE in the URL and PRESENT in the filesystem path,
  so a sibling-relative read that was correct yesterday throws ENOENT today.
  That is the loud failure; the quiet one would be a glob matching nothing.
*/
const PAGE = source(join('..', '(shell)', 'realstories', 'page.tsx'));
const GALLERY = source('_components/gallery.tsx');
const SEARCH = source('_components/stories-search.tsx');

test('the anchor: the sources are real and the comment stripper did not eat them', () => {
  assert.ok(PAGE.includes('<main'), 'page.tsx lost its <main> (or was gutted)');
  assert.ok(GALLERY.includes('grid gap-4'), 'gallery.tsx has no grids left');
  assert.ok(SEARCH.includes('grid gap-4'), 'stories-search.tsx has no grids left');
});

test('the page does not re-cap the shell column it sits inside', () => {
  /*
    Matches the <main> OPENING TAG only. A `max-w-2xl` on the intro paragraph
    or `max-w-xl` on the CTA is correct and must stay — a 1552px line of prose
    is unreadable. What is banned is a cap on the element the shell wraps.
  */
  const m = /<main\s+className="([^"]*)"/.exec(PAGE);
  assert.ok(m, 'could not find the <main> opening tag with a className');
  const cls = m[1] ?? '';
  assert.ok(cls.length > 0, '<main> has an empty className — the regex matched nothing useful');
  assert.doesNotMatch(
    cls,
    /\bmax-w-/,
    `<main> carries a width cap ("${cls}"). The shell already caps at 1600px ` +
      'via `.fd-col` and pays the gutter via `.fd-main`; a second cap here is ' +
      'the narrower answer and it wins, which is the 2026-08-16 complaint.',
  );
  assert.doesNotMatch(
    cls,
    /(^|\s)(sm:|lg:|xl:)?px-\d/,
    `<main> pays its own horizontal gutter ("${cls}") on top of \`.fd-main\`'s ` +
      '24px (16px below 1024). Home pays the shell\'s only — double-padding is ' +
      'how this page ends up narrower than its neighbour by a different route.',
  );
});

/* ── THE SHELF RENDERS IN ONE RHYTHM ──────────────────────────────────── */

/** Every `grid-cols` ladder in a file, in source order, normalised. */
function ladders(src: string): string[] {
  return (src.match(/(?:grid-cols-\d+|(?:sm|md|lg|xl|2xl):grid-cols-\d+)/g) ?? [])
    .join(' ')
    .split(/(?=\bsm:grid-cols)/)
    .map((s) => s.trim())
    .filter(Boolean);
}

test('the four card grids of the one shelf carry the same column ladder', () => {
  /*
    "Just published", "The archive", the headless continuation, and the
    filtered/search result set. The continuation has NO heading by design, so
    a different column count is the one thing that can make it read as a
    separate shelf again.
  */
  const found = ladders(GALLERY).filter((l) => l.startsWith('sm:grid-cols-2 lg:'));
  assert.ok(
    found.length >= 3,
    `expected at least 3 card grids in gallery.tsx, found ${found.length}. ` +
      'If a grid was removed, update this guard deliberately — do not delete it.',
  );
  const distinct = [...new Set(found)];
  assert.equal(
    distinct.length,
    1,
    'the shelf renders in more than one rhythm: ' +
      distinct.map((d) => `"${d}"`).join(' vs ') +
      '. The headless continuation must track the headed grids above it.',
  );
  assert.match(
    distinct[0] ?? '',
    /xl:grid-cols-4/,
    'the card grids stop at three across. In the shell\'s 1600px column that ' +
      'is ~500px cards against Home\'s ~388 — the same page-looks-different ' +
      'complaint, arriving through the grid instead of the cap.',
  );
});

test('the search view renders results in the browse view\'s rhythm', () => {
  const browse = ladders(GALLERY).filter((l) => l.startsWith('sm:grid-cols-2 lg:'))[0];
  const search = ladders(SEARCH).filter((l) => l.startsWith('sm:grid-cols-2 lg:'))[0];
  assert.ok(browse, 'no browse grid found to compare against');
  assert.ok(search, 'no result grid found in stories-search.tsx');
  assert.equal(
    search,
    browse,
    'searching this page changes how wide its cards are. The search view and ' +
      'the browse view are one shelf seen two ways.',
  );
});
