/**
 * THE MARKETPLACE NEVER TYPES ITS OWN SIZE.
 *
 * ── WHY (owner, 2026-09-08) ────────────────────────────────────────────────
 * The grid carried a back-link reading "Browse all 192 categories". The number
 * was typed by hand when `TAXONOMY_MAP` held 192 entries. The map now holds
 * 288. Nothing derived the figure and nothing watched it, so for an unknown
 * stretch of releases the marketplace advertised **a third fewer categories
 * than it had** — on a public page, to every visitor, with no test able to
 * notice.
 *
 * The link is gone (it also pointed at the page you were already on). This
 * guard is the half that outlives the deletion: the same sentence must not
 * come back with 288 in it, because 288 is just as perishable as 192 was. The
 * taxonomy is edited by hand in `lib/taxonomy.ts` and grows whenever a
 * canonical is added — a count typed beside it is wrong from the next commit.
 *
 * CLAUDE.md rule 7, in its own words: *"An anchor is a string, never a number
 * … cite a greppable symbol or the exact command that re-measures it, never
 * the number itself."* That rule is written about documents. This is the same
 * failure aimed at a customer instead of at a future session.
 *
 * ── WHAT IS ALLOWED ───────────────────────────────────────────────────────
 * A DERIVED count is fine and is the point: `{TAXONOMY_OPTIONS.length}
 * categories` renders a number that cannot go stale, and does not match the
 * pattern below because the digits are not in the source. Only a literal
 * fails.
 *
 * ⚠ COMMENTS ARE STRIPPED FIRST, AND THAT IS NOT AN OPTIMISATION. This very
 * docblock says "192" and "288" a few lines up, and the paragraph above says
 * the words "categories" nearby. A raw-source scan would fail on its own
 * explanation — the exact trap `studio-buy-hero.tsx` records tripping. The
 * repo has ONE comment stripper and `lint-one-comment-stripper.mjs` enforces
 * that; do not hand-roll another here.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Every .tsx under /explore — the page and its components. */
function sources(dir: string, out: Array<{ path: string; src: string }> = []) {
  for (const entry of readdirSync(dir)) {
    const abs = join(dir, entry);
    if (statSync(abs).isDirectory()) {
      sources(abs, out);
      continue;
    }
    if (!entry.endsWith('.tsx')) continue;
    out.push({
      path: abs.slice(HERE.length + 1),
      src: stripComments(readFileSync(abs, 'utf8')),
    });
  }
  return out;
}

/**
 * A literal count standing next to the word it counts — "192 categories",
 * "53 tiles", "16 folders". Deliberately NOT a bare-number search: the grid is
 * full of honest literals (grid spans, pixel sizes, page sizes) and a guard
 * that shouts at those gets deleted for noise instead of obeyed.
 */
const TYPED_COUNT_SOURCE = String.raw`\b(\d{2,})\s+(categor(?:y|ies)|tiles?|folders?|services?)\b`;
/**
 * ⚠ BUILT FRESH PER USE, NOT SHARED. A `/g` regex carries `lastIndex` between
 * calls, so a single shared instance silently SKIPS matches on its second use
 * — which is how the first version of this file reported a clean file and then
 * failed its own can-it-fire test. A guard with hidden state is worse than no
 * guard: it reports success it did not verify.
 */
const typedCount = () => new RegExp(TYPED_COUNT_SOURCE, 'gi');
const typedCountOnce = () => new RegExp(TYPED_COUNT_SOURCE, 'i');

test('no explore surface types a literal taxonomy count', () => {
  const offences: string[] = [];
  let scanned = 0;

  for (const { path, src } of sources(HERE)) {
    scanned++;
    for (const m of src.matchAll(typedCount())) {
      offences.push(`${path} → "${m[0]}"`);
    }
  }

  assert.ok(scanned > 0, 'the scan read no files — did /explore move?');
  assert.deepEqual(
    offences,
    [],
    'A taxonomy count is typed into the marketplace UI. It is wrong the next ' +
      'time somebody edits lib/taxonomy.ts, and nothing will say so. Render it ' +
      'from the source of truth instead (e.g. {TAXONOMY_OPTIONS.length}), or ' +
      'drop the number from the sentence:\n  ' +
      offences.join('\n  '),
  );
});

test('the guard can actually fire', () => {
  // A guard nobody has seen fail is a guard nobody knows is inert. The
  // pattern is asserted against the exact string that shipped, so a future
  // rewrite of the pattern cannot quietly stop matching the original defect.
  assert.match('Browse all 192 categories', typedCountOnce());
  assert.match('all 53 tiles', typedCountOnce());
  // …and must not fire on a derived render or on ordinary layout numbers.
  assert.doesNotMatch('{TAXONOMY_OPTIONS.length} categories', typedCountOnce());
  assert.doesNotMatch('grid-cols-12 gap-3 px-24', typedCountOnce());
});
