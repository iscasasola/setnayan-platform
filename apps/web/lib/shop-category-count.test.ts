/**
 * shop-category-count.test.ts — Today's "N categories · manage in Coverage" counts what sign-up counted (F-W1-03).
 *
 * The defect (walk 13 Nov 2026, 390 px): ONE category picked (Lights & Sound) — sign-up said "1 category · 1 service",
 * Today said "2 categories", because it printed `services.length` and opening a shop writes the coarse key AND the leaf.
 *
 * SABOTAGE: make the row print `data.services.length` again → the source test goes RED; drop the "bare coarse only when
 * no leaf files under it" rule → the first case reads 2 → RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { shopCategoryCount } from '@/lib/shop-category-count';
import type { VendorCategory } from '@/lib/vendors';
import { stripComments } from '@/lib/strip-comments';

const tax = {
  tileCoarseCategory: { lights_sound_tile: 'lights_and_sound', photo_tile: 'photographer' } as Record<string, VendorCategory>,
  map: {
    stage_lighting: { tile: 'lights_sound_tile' },
    sound_system: { tile: 'lights_sound_tile' },
    same_day_edit: { tile: 'photo_tile' },
  },
};

test('one pick written as coarse + leaf is ONE category', () => {
  assert.equal(shopCategoryCount(['lights_and_sound', 'stage_lighting'], tax), 1);
});

test('two services in one category are one; a second category is two', () => {
  assert.equal(shopCategoryCount(['lights_and_sound', 'stage_lighting', 'sound_system'], tax), 1);
  assert.equal(shopCategoryCount(['lights_and_sound', 'stage_lighting', 'same_day_edit'], tax), 2);
});

test('a coarse key with no leaf (the flat fallback select) still counts', () => {
  assert.equal(shopCategoryCount(['photographer'], tax), 1);
  assert.equal(shopCategoryCount([], tax), 0);
});

test('Today’s row prints the category count, never the length of services[]', () => {
  const src = stripComments(
    readFileSync(join(import.meta.dirname, '..', 'app/vendor-dashboard/shop/_components/profile-checklist-editor.tsx'), 'utf8'),
  );
  assert.doesNotMatch(src, /count=\{data\.services\.length\}/, 'the row counts services[] entries again');
  assert.match(src, /serviceCategoryCount/);
});
