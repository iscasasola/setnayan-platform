/**
 * the-search-words-fit-a-phone.test.ts — the Suppliers page's fixed-width
 * search boxes show their whole placeholder on the narrowest phone.
 *
 * QA 2026-10-22 (F5): the in-list search read "Search your shortlist or the
 * whole marketpla" at 375 px, in Chromium and WebKit alike. The box is a fixed
 * row (`.bench-search`: 13 px side padding, a 16 px icon, a 9 px gap), so the
 * words have a fixed room.
 *
 * MEASURED (lab `/dev/suppliers-lab?shell=1`, Chromium, 2026-10-22): the input's
 * text room is 290 px at 375 and 235 px at 320; the old words measured 347 px
 * at the box's 14 px sans — 7.39 px a character on average. So at 320 the room
 * holds 235 / 7.39 = 31 characters. A placeholder longer than that is cut on a
 * small phone. The full description belongs in `aria-label`, which is read out
 * and never drawn.
 *
 * Property: every LITERAL placeholder on a `type="search"` input in the
 * Suppliers page's components is at most 31 characters. (Placeholders built
 * from a template — "Search {category}…" in the category overlay, the thumb
 * row's own fit pass — size themselves and are held elsewhere.)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const DIR = join(HERE, '_components');

/** 235 px of room at 320 ÷ 7.39 px a character (measured — see the docblock). */
const ROOM_AT_320 = 31;

test('every literal search placeholder on the Suppliers page fits at 320 px (F5)', () => {
  const found: Array<{ file: string; words: string }> = [];
  for (const name of readdirSync(DIR)) {
    if (!/\.tsx$/.test(name)) continue;
    const src = stripComments(readFileSync(join(DIR, name), 'utf8'));
    // Each <input … /> tag (to its self-close — an arrow's `=>` is not the end),
    // then its type and a literal placeholder.
    for (const m of src.matchAll(/<input\b[\s\S]*?\/>/g)) {
      const tag = m[0];
      if (!/type="search"/.test(tag)) continue;
      const ph = /placeholder="([^"]*)"/.exec(tag);
      if (ph) found.push({ file: name, words: ph[1]! });
    }
  }
  console.log(`[search-fit] ${found.length} literal search placeholder(s): ${found.map((f) => `“${f.words}”`).join(', ')}`);
  assert.ok(found.length >= 1, 'no literal search placeholder found — has the bench search moved? re-point this guard');
  const long = found.filter((f) => f.words.length > ROOM_AT_320);
  assert.deepEqual(
    long.map((f) => `${f.file}: “${f.words}” (${f.words.length} > ${ROOM_AT_320})`),
    [],
    'A search placeholder is cut on a 320 px phone — shorten it and keep the full words in aria-label',
  );
});
