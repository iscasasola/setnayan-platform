/**
 * THE CONTROLLER RE-ORDERS ITSELF BY PHASE — and the order is REAL.
 *
 * ⚖ Owner 2026-09-22, on the live page: *"it doesn't feel inquitive and easy to
 * manage."* Before the day this screen is a setup job and the money that sizes
 * it leads; on the day and after it is a results screen and the photographs
 * lead. Ten blocks, one DOM, CSS `order` — the approved prototype's own shape
 * (`prototypes/papic_controller_redesign_2026-09-21/`).
 *
 * ── 🪤 THE FAILURE THIS GUARD EXISTS FOR IS SILENT IN BOTH DIRECTIONS ─────
 *
 *   1. **`order-${n}` produces a class Tailwind never generates.** Tailwind
 *      reads class names as literal TEXT; an interpolated one is not in the
 *      stylesheet, so every block falls back to source order. The page compiles,
 *      renders, and looks exactly as it did before the build — a reorder that
 *      did not ship, with nothing anywhere saying so.
 *   2. **CSS `order` only applies to flex and grid items.** On the page's
 *      original `space-y-7` block container the classes would be inert for the
 *      same invisible reason.
 *
 * Neither is visible to typecheck, to a snapshot, or to the controls bill — the
 * controls really are all mounted. So both are asserted here against the source.
 *
 * ── AND THE MAP MUST BE A PERMUTATION, NOT A WISH ────────────────────────
 * Every block appears in both phases, exactly once, with the ranks 1..10 used
 * exactly once each. A duplicated rank is two blocks fighting for one slot and
 * the winner is whichever the browser happens to lay out first.
 *
 * Run: cd apps/web && npx tsx --test "app/**\/the-page-reorders-itself.test.ts"
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';

const PAPIC = dirname(dirname(fileURLToPath(import.meta.url)));
const RAW = readFileSync(join(PAPIC, 'page.tsx'), 'utf8');
const PAGE = stripComments(RAW);

/** The ten blocks, from the owner's own order. */
const BLOCKS = [
  'credits', 'dates', 'guests', 'filter', 'challenges',
  'wall', 'gallery', 'kwento', 'made', 'more',
] as const;

function phaseMap(phase: 'before' | 'after'): Map<string, number> {
  const at = PAGE.indexOf(`${phase}: {`);
  assert.ok(at > 0, `the ${phase} order map is missing from page.tsx`);
  const body = PAGE.slice(at, PAGE.indexOf('},', at));
  const out = new Map<string, number>();
  for (const m of body.matchAll(/(\w+):\s*'order-(\d+)'/g)) {
    out.set(m[1]!, Number(m[2]));
  }
  return out;
}

test('BOTH PHASES ARE A PERMUTATION OF ALL TEN BLOCKS', () => {
  for (const phase of ['before', 'after'] as const) {
    const map = phaseMap(phase);
    assert.deepEqual(
      [...map.keys()].sort(),
      [...BLOCKS].sort(),
      `${phase}: the blocks do not match the ten the owner ordered`,
    );
    assert.deepEqual(
      [...map.values()].sort((a, b) => a - b),
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
      `${phase}: ranks must be 1..10, each exactly once — a duplicate is two blocks fighting for one slot`,
    );
  }
});

test('EVERY ORDER CLASS IS A LITERAL — an interpolated one never reaches the stylesheet', () => {
  /*
    🪤 THE SILENT FAILURE. `order-${rank}` compiles, renders, and leaves the page
    in source order with nothing saying the reorder was lost.

    Sabotage: replace one entry with `order-${1}` and watch this go red.
  */
  const at = PAGE.indexOf('const BLOCK_ORDER');
  assert.ok(at > 0, 'BLOCK_ORDER is gone');
  const body = PAGE.slice(at, PAGE.indexOf('} as const;', at));
  const literals = [...body.matchAll(/'order-\d+'/g)].length;
  assert.equal(literals, 20, `expected 20 literal order classes, found ${literals}`);
  assert.ok(
    !/order-\$\{/.test(body),
    'an order class is interpolated — Tailwind will never generate it and the page silently keeps source order',
  );
});

test('THE BLOCKS ARE FLEX ITEMS — `order` is inert on a block container', () => {
  assert.match(
    PAGE,
    /<section className="flex flex-col gap-7 pb-12">/,
    'the page root is not a flex column, so every order class below it is inert',
  );
  for (const key of BLOCKS) {
    const mounts = [...PAGE.matchAll(new RegExp(`ord\\('${key}'\\)`, 'g'))].length;
    assert.equal(mounts, 1, `block "${key}" is ordered ${mounts} times — it must be exactly one`);
  }
  // Every wrapper is itself a flex column, so the blocks it holds keep `gap-7`.
  const wrappers = [...PAGE.matchAll(/className=\{`flex flex-col gap-7 \$\{ord\('/g)].length;
  assert.equal(wrappers, BLOCKS.length, `expected ${BLOCKS.length} ordered wrappers`);
});

test('THE OWNER’S TWO MOVES ARE THE ONES THAT SHIPPED', () => {
  const before = phaseMap('before');
  const after = phaseMap('after');

  // Money leads the setup phase.
  assert.equal(before.get('credits'), 1, 'before the day, credits must lead');
  // The photographs lead once the day has come.
  assert.equal(after.get('gallery'), 1, 'on the day and after, the gallery must lead');

  // ⚖ THE LIVE WALL MOVED UP, ABOVE THE GALLERY — in BOTH phases. It is a setup
  // job (pick a style, get the screen code) that was sitting below the results
  // it helps produce.
  assert.ok(
    before.get('wall')! < before.get('gallery')!,
    'before the day the live wall must sit above the gallery it helps fill',
  );
  assert.ok(
    after.get('wall')! < after.get('credits')!,
    'after the day the live wall is still running, so it comes before the money',
  );

  // ⚠ MONEY ABOVE THE BLOCKS THAT SIZE IT is deliberate and is only safe while
  // the recommendation recomputes — so the recommendation must be ON this page.
  assert.ok(
    before.get('credits')! < before.get('dates')! &&
      before.get('credits')! < before.get('guests')!,
    'the inversion the brief describes is not in force',
  );
  assert.match(
    PAGE,
    /<CreditRecommendation\b/,
    'credits sits above coverage and allotment, which is only honest while the recommendation is on the page and recomputes',
  );
});

test('THE TWO RENAMES ARE ON THE PAGE', () => {
  // The words the owner uses: the capture window is COVERAGE, and what a guest
  // may spend is an ALLOTMENT.
  assert.match(RAW, />Coverage</, 'the coverage block has lost its heading');
  assert.match(RAW, />Allotment</, 'the allotment block has lost its heading');
});
