/**
 * the-saved-photo-marker-reaches-the-render.test.ts — "You saved 2 of their
 * photos" REACHES A PIXEL, not just a variable.
 *
 * ── WHY THIS FILE IS THE POINT OF MB10 ──────────────────────────────────────
 * A supplier uploads to the inspiration gallery for exactly one reason: the
 * couple who saves their bouquet finds them again in the list where they choose
 * who to hire. Everything upstream — the `vendor_profile_id` column, the
 * board's `library_asset_id`, the per-shop tally in `searchCategoryVendors` —
 * is worth nothing if the number never renders. The repo has paid for this
 * lesson more than once: A LOG LINE NEVER CHANGED A PIXEL. The guest-read
 * error was bound and sitting in Sentry, and a couple with 180 names was still
 * told their wedding was empty.
 *
 * ── BOTH ENDS AND THE MIDDLE ────────────────────────────────────────────────
 *   1. THE RENDER is real: `<SavedPhotoMarker>` is painted with
 *      renderToStaticMarkup and the actual copy and pluralisation are read out
 *      of the HTML. That is why the badge lives in its own file rather than
 *      inline in `category-search-overlay.tsx`'s 800 lines — a component that
 *      portals to <body> and fetches in an effect cannot be render-tested,
 *      and a grep over that file would be all this guard could otherwise be.
 *   2. THE MOUNT is pinned by source, inside a window anchored on `renderRow`
 *      specifically, and it must read `r.savedGalleryPhotoCount` — so
 *      hard-coding `count={0}`, or deleting the mount, is red.
 *   3. THE MEASUREMENT is pinned in the action: the count comes from the
 *      per-shop tally, and a failed tally stays `null` instead of collapsing
 *      to a confident 0.
 *
 * A correct query and a correct badge can each pass their own test while the
 * line between them is cut. This file is that line.
 *
 * SABOTAGE PERFORMED AND UNDONE DURING VERIFICATION — see the session report.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = __dirname;
const OVERLAY = path.join(HERE, 'category-search-overlay.tsx');
const ACTION = path.join(HERE, '..', '_actions', 'category-search.ts');

function read(file: string): string {
  return fs.readFileSync(file, 'utf8');
}

function windowOf(src: string, from: string, until: RegExp): string {
  const start = src.indexOf(from);
  assert.notEqual(start, -1, `anchor missing from source: ${from}`);
  const rest = src.slice(start + from.length);
  const m = rest.match(until);
  return from + (m && m.index !== undefined ? rest.slice(0, m.index) : rest);
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

async function paint(countValue: number | null): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SavedPhotoMarker } = await import('./saved-photo-marker');
  return renderToStaticMarkup(React.createElement(SavedPhotoMarker, { count: countValue }));
}

/* ── 1 · THE RENDER ───────────────────────────────────────────────────── */

test('⭐ THE GUARD · a real count paints the real sentence', async () => {
  const html = await paint(2);
  assert.match(html, /You saved 2 of their photos/);
});

test('one photo is singular — "1 of their photos", not "1 photos"', async () => {
  const html = await paint(1);
  assert.match(html, /You saved 1 of their photos/);
  assert.doesNotMatch(html, /1 of their photo\b(?!s)/);
});

test('a measured ZERO paints nothing — a "0" badge on every shop is noise', async () => {
  assert.equal(await paint(0), '');
});

test('⭐ null is UNKNOWN and paints nothing HERE — the overlay header says it once', async () => {
  // Absence of a badge is not a claim. A header that stays silent about a dead
  // read IS one, which is why the two halves are split.
  assert.equal(await paint(null), '');
});

test('a large count still reads as one sentence, not a bare number', async () => {
  const html = await paint(17);
  assert.match(html, /You saved 17 of their photos/);
});

/* ── 2 · THE MOUNT, inside renderRow and nowhere else ─────────────────── */

test('⭐ THE GUARD · renderRow mounts the marker from r.savedGalleryPhotoCount', () => {
  const src = read(OVERLAY);
  const row = windowOf(src, '  const renderRow = (r: CategoryVendorResult) => {', /\n  const \w+ = /);

  assert.equal(
    count(row, '<SavedPhotoMarker'),
    1,
    'exactly one mount inside the vendor row',
  );
  assert.match(
    row,
    /<SavedPhotoMarker count=\{r\.savedGalleryPhotoCount\} \/>/,
    'the count must come from THIS result row — a literal or a recomputation here is the defect',
  );
  assert.doesNotMatch(
    row,
    /<SavedPhotoMarker count=\{\s*\d/,
    'a hard-coded count is a badge that stopped measuring anything',
  );
  assert.equal(
    count(src, '<SavedPhotoMarker'),
    1,
    'the whole file mounts it once — a second mount elsewhere would hide a deleted one',
  );
  assert.match(src, /from '\.\/saved-photo-marker'/);
});

test('⭐ THE GUARD · a dead tally is announced ONCE, above the list', () => {
  const src = read(OVERLAY);
  assert.match(
    src,
    /setSavedTallyFailed\(res\.savedPhotoTallyFailed === true\)/,
    'the flag must be read off the search result, not inferred',
  );
  assert.match(src, /\{savedTallyFailed \? \(/);
  assert.match(src, /We couldn&rsquo;t check which of your saved inspiration photos/);
});

/* ── 3 · THE MEASUREMENT behind it ───────────────────────────────────── */

test('⭐ THE GUARD · the count is measured per shop, and a dead read stays null', () => {
  const src = read(ACTION);

  assert.match(
    src,
    /savedPhotosByVendor = tallySavedGalleryPhotos\(/,
    'the tally must be the shared pure function, not a second hand-rolled count',
  );
  assert.match(
    src,
    /savedPhotosByVendor = null; \/\/ unknown, and said out loud/,
    'a failed read must land on null',
  );
  assert.match(
    src,
    /savedGalleryPhotoCount:\s*\n\s*savedPhotosByVendor === null\s*\n\s*\? null\s*\n\s*: \(savedPhotosByVendor\.get\(r\.vendor_profile_id\) \?\? 0\),/,
    'null must survive to the row; `?? 0` on a null MAP would fabricate a measured zero',
  );
  assert.match(
    src,
    /savedGalleryPhotoCount: s\.savedGalleryPhotoCount,/,
    'and it must survive the final public mapping — the last place it can be dropped',
  );
  assert.match(
    src,
    /savedPhotoTallyFailed: true/,
    'the list-level "we could not check" flag must be set from the same read',
  );
  // The board read walks provenance → asset → shop. Without library_asset_id
  // the couple's own uploads would be counted against whichever shop.
  assert.match(src, /from\('event_inspiration_assets'\)/);
  assert.match(src, /asset:moodboard_library_assets \( vendor_profile_id \)/);
  assert.match(src, /\.not\('library_asset_id', 'is', null\)/);
  assert.match(src, /\.is\('removed_at', null\)/, 'removal is soft — a count that forgets lies');
});
