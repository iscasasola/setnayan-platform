/**
 * ⚡ THE MAKER'S PAGE CARRIES ONLY WHAT IT DRAWS — two cuts from the 2026-11-18 speed pass (owner: "all loading
 * under 0.7 s"; measured on production that day, a signed-in couple's Hub Maker shipped 1,062 KB of HTML + RSC).
 *
 *   1 · The Mood Board Studio was handed ALL ~300 inspiration parts, each with its services — 111 KB — and reads
 *       them only through `palettePhotoParts` / `libraryPhotoParts`, which reach ~30. It is now handed
 *       `studioPartsSnapshot(…)`: the same snapshot, filtered to the parts those two can reach, every kept part
 *       whole. Test 1 proves the two lists are IDENTICAL either way, so nothing the couple sees can change.
 *   2 · The editor page built our moving-background list (each loop's signed still + clip) in three places and the
 *       poster map in two — 54 signed addresses for 18 files. It is now built once and handed to all of them.
 *
 * Each test fails on the regression it names (re-adding the full snapshot, a Studio read that bypasses the two
 * lists, a fourth hand-built loop list).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { fallbackInspirationParts, type InspirationPart, type InspirationPartsSnapshot } from './inspiration-parts';
import { libraryPhotoParts, palettePhotoParts, studioPartsSnapshot } from './inspiration-slots';
import { stripComments } from './strip-comments';

const read = (rel: string) => stripComments(readFileSync(join(__dirname, '..', rel), 'utf8'));

/** The fallback plus 270 parts no Studio card draws, each carrying services — the shape production's table has. */
function productionShaped(): InspirationPartsSnapshot {
  const base = fallbackInspirationParts().parts.map((p) => ({ ...p, services: ['stylist_decorator', 'florist'] }));
  const extra: InspirationPart[] = Array.from({ length: 270 }, (_, i) => ({
    slotKey: `extra_part_${i}`,
    label: `Extra part ${i}`,
    kind: 'part',
    homeCategoryId: 'stylist_decorator',
    alsoCategoryIds: ['lights_sound'],
    services: ['capiz_native_decor', 'mandap_decor', 'balloon_decor', 'av_production'],
    hidden: i % 7 === 0,
    sortOrder: 1000 + i,
  }));
  /* A reachable part hidden from couples: the supplier's list keeps it, the couple's drops it — both must survive the filter. */
  const tunnel = base.find((p) => p.slotKey === 'tunnel');
  if (tunnel) tunnel.hidden = true;
  return { source: 'db', parts: [...base, ...extra] };
}

test('1 · the Studio draws the SAME two lists from the filtered snapshot as from the whole one', () => {
  for (const full of [fallbackInspirationParts(), productionShaped()]) {
    const slim = studioPartsSnapshot(full);
    assert.deepEqual(palettePhotoParts(slim), palettePhotoParts(full), 'the couple’s “Which part?” changed');
    assert.deepEqual(libraryPhotoParts(slim), libraryPhotoParts(full), 'a part’s name lookup changed');
    assert.equal(slim.source, full.source);
    /* A filter, never an edit: every kept part is the whole part. */
    for (const p of slim.parts) assert.deepEqual(p, full.parts.find((f) => f.slotKey === p.slotKey));
  }
});

test('1b · the filter actually cuts — a production-sized table shrinks to the parts the Studio reaches', () => {
  const full = productionShaped();
  const slim = studioPartsSnapshot(full);
  assert.ok(slim.parts.every((p) => !p.slotKey.startsWith('extra_part_')), 'a part no Studio card draws was sent');
  const bytes = (s: InspirationPartsSnapshot) => JSON.stringify(s).length;
  assert.ok(bytes(slim) * 4 < bytes(full), `the Studio’s snapshot is ${bytes(slim)} B of ${bytes(full)} B — not cut`);
});

test('1c · the wiring: the Studio is handed the filtered snapshot, and reads it ONLY through the two lists', () => {
  const editor = read('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-editor.tsx');
  assert.match(editor, /inspirationParts=\{studioPartsSnapshot\(await getInspirationParts\(\)\)\}/, 'the Studio is handed the whole parts table again');
  /* The filter is safe only while the Studio reads the snapshot through these two — a new read would see ~30 parts. */
  const studio = read('app/dashboard/[eventId]/studio/mood-board/_components/mood-board-studio.tsx');
  const reads = studio.match(/[\w.]*\(?props\.inspirationParts/g) ?? [];
  assert.deepEqual(
    reads.sort(),
    ['libraryPhotoParts(props.inspirationParts', 'palettePhotoParts(props.inspirationParts'],
    'the Studio reads its snapshot some other way — widen `studioPartsSnapshot` before relying on it',
  );
});

test('2 · our moving backgrounds are built ONCE on the editor page and handed to every reader', () => {
  const page = read('app/dashboard/[eventId]/website/editor/page.tsx');
  assert.equal((page.match(/hubMovingBackgroundIds\(\)/g) ?? []).length, 1, 'the loop list is built more than once again');
  assert.equal((page.match(/resolveThemeGround\(id, \{ ownColours: false \}\)/g) ?? []).length, 1, 'a loop is signed more than once again');
  assert.match(page, /loops=\{themeLoops\}/, 'the Background panel builds its own list');
  assert.match(page, /loops: themeLoops,/, 'the Look sample builds its own list');
  assert.equal((page.match(/loopPosters[=:] ?\{?themeLoopPosters/g) ?? []).length, 2, 'a Scene ◆ poster map is built on its own');
});
