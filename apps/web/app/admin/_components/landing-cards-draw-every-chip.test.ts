/**
 * A8·P-B-12 (final check 25 Nov). Catalogue › Templates & media listed "… Hub music · Songs" in its line and drew
 * only six chips: the card sliced its chips to six. The line and the chips come from the same views, so the card
 * must draw them all. And the Studio group really has more than six, so the old cap was not hypothetical.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADMIN_MERGED_PAGES } from '@/lib/admin/admin-pages';

const here = dirname(fileURLToPath(import.meta.url));

test('the landing card draws every chip, uncapped', () => {
  const src = readFileSync(resolve(here, 'tab-landing.tsx'), 'utf8');
  assert.match(src, /\{c\.chips\.map\(\(ch\) =>/);
  assert.doesNotMatch(src, /c\.chips\.slice\(/);
});

test('Studio › Templates & media really has more than six views (the cap bit)', () => {
  const studio = ADMIN_MERGED_PAGES.find((p) => p.key === 'studio');
  assert.ok(studio, 'studio page');
  const tm = studio!.views.filter((v) => v.kindGroup === 'Templates & media').map((v) => v.label);
  assert.ok(tm.length > 6, `found ${tm.length}`);
  assert.ok(tm.includes('Hub music') && tm.includes('Songs'));
});
