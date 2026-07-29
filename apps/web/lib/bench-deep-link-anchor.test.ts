/**
 * bench-deep-link-anchor.test.ts — guards the "Still needs your decision" jump.
 *
 * OWNER REPORT 2026-07-29: *"still needs your decision doesn't jump to the exact
 * accordion cell."* Root cause: the bench rendered ONE anchor,
 * `#slfold-<folderSlug>` (the folder card). The leaf category row had none, so
 * the exact cell was not mis-targeted — it was unreachable. Second defect, same
 * handler: the doorway guessed a fixed `setTimeout` after a `router.push` that
 * REMOUNTS the bench (`page.tsx` keys it on `?open=`), and lost the race
 * silently because it ended in `?.scrollIntoView()` on a null.
 *
 * ── WHY SOURCE ASSERTIONS ────────────────────────────────────────────────────
 * The regression is "an id disappeared from a JSX tree" / "a mount effect
 * stopped firing". There is no DOM in this runner (`tsx --test`, no jsdom, no
 * testing-library in the workspace) and `shortlist-categories.tsx` is a 1900-line
 * client component whose imports reach the Supabase client and the live SKU
 * catalog — rendering it here is not on the table.
 *
 * So the derivation is tested for real (pure functions, both directions) and the
 * two WIRING facts a future edit could silently undo are pinned against the
 * source, in the shape `lib/live-studio-wave8-layout.test.ts` already uses. Each
 * assertion names one regression that would put the owner's bug straight back.
 *
 * MUTATION-CHECKED: deleting `id={... benchTileAnchorId(t.tile) ...}` from
 * `shortlist-categories.tsx` turns
 * "the bench renders the LEAF anchor on every category row" red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  benchFolderAnchorId,
  benchTileAnchorId,
  benchScrollBehavior,
  scrollBenchAnchor,
} from './bench-anchors';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..');
const read = (rel: string) => readFileSync(resolve(WEB, rel), 'utf8');

/** Source with comments stripped — these files document the very strings the
 *  "must NOT appear" assertions forbid, so a raw substring check would read the
 *  documentation as the violation. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*)/.test(l))
    .join('\n');

const BENCH = 'app/dashboard/[eventId]/vendors/_components/shortlist-categories.tsx';
const DOORWAY = 'app/dashboard/[eventId]/vendors/_components/team-controls.tsx';
const PAGE = 'app/dashboard/[eventId]/vendors/page.tsx';

/* ═══════════════════════════════════════════════════════════════════════════
   1 · THE IDS — derived in one place, so a caller can't hand-roll a drifting one
   ═══════════════════════════════════════════════════════════════════════════ */

test('anchor ids — leaf and folder are distinct namespaces', () => {
  assert.equal(benchTileAnchorId('reception'), 'sltile-reception');
  assert.equal(benchFolderAnchorId('venue'), 'slfold-venue');
  // The prefixes must not be able to collide: a folder slug can equal a tile id
  // (e.g. 'venue'), and the two anchors would then be the same element.
  assert.notEqual(benchTileAnchorId('venue'), benchFolderAnchorId('venue'));
});

test('anchor ids — the owner-reported categories all resolve', () => {
  // Prod event 044f7e64-95aa-4dcb-84c1-7263bf494eaa lists Reception venue ·
  // Ceremony venue · Catering · Photo & Video. `deepLinkTileForGroup` maps those
  // plan groups onto these catalogue tiles (see your-team.test.ts).
  assert.deepEqual(
    ['reception', 'ceremony_venue', 'catering', 'photo_video'].map(benchTileAnchorId),
    ['sltile-reception', 'sltile-ceremony_venue', 'sltile-catering', 'sltile-photo_video'],
  );
});

/* ═══════════════════════════════════════════════════════════════════════════
   2 · THE LEAF ANCHOR — the whole fix. Remove it and the exact cell is gone.
   ═══════════════════════════════════════════════════════════════════════════ */

test('the bench renders the LEAF anchor on every category row', () => {
  const src = code(BENCH);
  // The id must come from the shared derivation, applied to the row's own tile.
  assert.match(
    src,
    /id=\{\s*replan\s*\?\s*benchTileAnchorId\(t\.tile\)\s*:\s*undefined\s*\}/,
    'the leaf category row must carry id={replan ? benchTileAnchorId(t.tile) : undefined} — ' +
      'without it the "Still needs your decision" doorway has nothing to aim at and lands on ' +
      'the folder head again (owner, 2026-07-29).',
  );
  // …and it must sit on the row element itself, next to the `.cat` class that
  // makes it that row — not on some ancestor further up.
  assert.match(src, /benchTileAnchorId\(t\.tile\)[\s\S]{0,400}className=\{`cat\$\{/);
});

test('the bench still renders the FOLDER anchor (the tile-less fallback)', () => {
  // Three plan groups have no catalogTile (attire · music_entertainment ·
  // logistics). Their doorway can only land on the folder, so this anchor is
  // load-bearing too.
  assert.match(code(BENCH), /id=\{benchFolderAnchorId\(folder\.slug\)\}/);
});

test('both anchors carry a scroll offset so the row is not tucked under sticky chrome', () => {
  const src = read(BENCH);
  assert.match(src, /\[id\^="slfold-"\][\s\S]{0,80}scroll-margin-top/);
  assert.match(src, /\[id\^="sltile-"\][\s\S]{0,80}scroll-margin-top/);
  // Desktop clearance for the `sticky top-0` .shell-topbar, which REVEALS on the
  // upward scroll a doorway performs.
  assert.match(src, /@media \(min-width:1024px\)\{\.slcat \[id\^="slfold-"\][^}]*96px/);
});

/* ═══════════════════════════════════════════════════════════════════════════
   3 · WHO OWNS THE SCROLL — the bench, because only it observes its remount
   ═══════════════════════════════════════════════════════════════════════════ */

test('the bench scrolls the deep-linked tile into view on mount', () => {
  const src = code(BENCH);
  assert.match(
    src,
    /useLayoutEffect\(/,
    'the landing scroll must run in a layout effect on the bench — the caller cannot ' +
      'observe the remount `page.tsx` performs when ?open= changes.',
  );
  assert.match(
    src,
    /requestAnimationFrame\([\s\S]{0,300}scrollBenchAnchor\(benchTileAnchorId\(initialOpenTile\)\)/,
    'the mount scroll must aim at the LEAF anchor for `initialOpenTile`.',
  );
  // No magic millisecond on the landing path — that is the bug being fixed.
  assert.doesNotMatch(src, /setTimeout\([\s\S]{0,200}benchTileAnchorId/);
});

test('page.tsx still re-keys the bench on ?open= (the remount the effect rides)', () => {
  assert.match(code(PAGE), /key=\{isExploreReplanEnabled\(\) \? `sl-\$\{sp\.open \?\? ''\}` : undefined\}/);
});

test('the doorway no longer guesses a delay', () => {
  const src = code(DOORWAY);
  assert.doesNotMatch(
    src,
    /setTimeout/,
    'TeamDecisionDoorway must not race the bench remount with a fixed delay — it lost that ' +
      'race silently (it ended in ?.scrollIntoView() on a null).',
  );
  // It hands off to the bench when a remount is coming…
  assert.match(src, /if \(tile && willRemount\) return;/);
  // …and keeps a direct scroll for the two cases a remount cannot cover:
  // a tile-less group, and the same row tapped twice.
  assert.match(
    src,
    /scrollBenchAnchor\(tile \? benchTileAnchorId\(tile\) : benchFolderAnchorId\(folderSlug\)\)/,
  );
});

test('the tile-less doorway carries ?open= through instead of dropping it', () => {
  // Dropping it re-keys the bench, which collapses every folder out from under
  // the folder scroll this branch is in the middle of performing.
  assert.match(code(DOORWAY), /const nextOpen = tile \?\? currentOpen;/);
});

/* ═══════════════════════════════════════════════════════════════════════════
   4 · REDUCED MOTION — CSS cannot reach a programmatic scroll
   ═══════════════════════════════════════════════════════════════════════════ */

test('benchScrollBehavior — reduced motion degrades to an instant jump', () => {
  const original = (globalThis as { window?: unknown }).window;
  const withQuery = (matches: boolean) => {
    (globalThis as { window?: unknown }).window = {
      matchMedia: (q: string) => ({ matches: q.includes('reduce') ? matches : false }),
    };
  };
  try {
    withQuery(true);
    assert.equal(benchScrollBehavior(), 'auto');
    withQuery(false);
    assert.equal(benchScrollBehavior(), 'smooth');
    // matchMedia absent (SSR, old WebView) → the shipped default, never a throw.
    (globalThis as { window?: unknown }).window = {};
    assert.equal(benchScrollBehavior(), 'smooth');
  } finally {
    if (original === undefined) delete (globalThis as { window?: unknown }).window;
    else (globalThis as { window?: unknown }).window = original;
  }
});

test('scrollBenchAnchor reports a miss instead of throwing', () => {
  // No `document` in this runner — a doorway must be able to call it during SSR
  // teardown / on a tile the couple removed from their plan without exploding,
  // and must SAY it missed so the caller can fall back.
  assert.equal(scrollBenchAnchor('sltile-nope'), false);
});
