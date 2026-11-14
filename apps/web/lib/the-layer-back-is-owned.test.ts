/**
 * 🪪 RW-146 (re-walk 14 Nov 2026, LIVE): the supplier's Offer Maker closed itself about a second after it opened.
 *
 * The Maker swaps its loading screen for the loaded one — two `RiseScreen`s, one after the other. Both hold the
 * phone's Back through `useBackCloses`, which marks ONE history entry. The new screen found the entry already marked
 * and kept it; the old screen's deferred clean-up then saw "an entry of ours" on top and stepped back — the popstate
 * closed the NEW screen, and its onClose dropped `?maker` from the address.
 *
 * The rule now: each layer marks the entry with its own id, a layer that finds another's mark takes it over, and only
 * the current holder may step back through it. Held here as the exact sequence, then as the hook's own wiring.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { layerHolder, layerMayStepBack, layerOpens } from './use-back-closes';
import { stripComments } from './strip-comments';

const NEXT = { __NA: true, __PRIVATE_NEXTJS_INTERNALS_TREE: 'x' };

test('RW-146 · a screen swapped for another keeps the entry; the old one’s clean-up does not step back', () => {
  // 1 · the loading screen opens: nothing marked → it pushes its own entry (Next's own state carried over).
  const loading = layerOpens(NEXT, 'layer-1');
  assert.ok(loading && 'push' in loading, 'the first layer pushes an entry');
  const afterLoading = (loading as { push: Record<string, unknown> }).push;
  assert.equal(afterLoading.__NA, true, "Next's own state is carried into the entry");
  assert.equal(layerHolder(afterLoading), 'layer-1');

  // 2 · the loaded screen replaces it: the entry is marked by another layer → it is TAKEN OVER, not stacked.
  const loaded = layerOpens(afterLoading, 'layer-2');
  assert.ok(loaded && 'replace' in loaded, 'the replacing layer takes the entry over (no second push)');
  const afterLoaded = (loaded as { replace: Record<string, unknown> }).replace;
  assert.equal(layerHolder(afterLoaded), 'layer-2');

  // 3 · the loading screen's deferred clean-up runs: it no longer holds the entry → it must NOT step back.
  assert.equal(layerMayStepBack(afterLoaded, 'layer-1'), false, 'the old layer stepped back and closed the new one');
  // …and the open screen still owns its way out.
  assert.equal(layerMayStepBack(afterLoaded, 'layer-2'), true);
});

test('a layer re-opening on its own entry (React’s dev double-effect) neither pushes nor replaces', () => {
  assert.equal(layerOpens({ ...NEXT, snLayer: 'layer-7' }, 'layer-7'), null);
});

test('a layer never steps back over an entry nobody marked (a navigation it did not make)', () => {
  assert.equal(layerMayStepBack(NEXT, 'layer-1'), false);
  assert.equal(layerMayStepBack(null, 'layer-1'), false);
});

test('the hook is wired to the rule: it opens through layerOpens and every clean-up asks layerMayStepBack', () => {
  const src = stripComments(readFileSync(join(process.cwd(), 'lib/use-back-closes.ts'), 'utf8'));
  const hook = src.slice(src.indexOf('export function useBackCloses'));
  assert.match(hook, /const step = layerOpens\(st, id\.current\)/);
  assert.match(hook, /window\.history\.replaceState\(step\.replace, ''\)/);
  assert.match(hook, /const ours = \(\) => layerMayStepBack\(window\.history\.state, id\.current\)/);
  // Both deferred clean-ups step back only through `ours()`.
  const backs = [...hook.matchAll(/window\.history\.back\(\)/g)].length;
  const guarded = [...hook.matchAll(/if \(ours\(\)\) window\.history\.back\(\)/g)].length;
  assert.equal(guarded, 2, 'a clean-up steps back without asking whether it still holds the entry');
  assert.equal(backs, 3, 'the hook gained or lost a step-back (2 clean-ups + the close button)');
  // No layer marks the entry with a bare `true` any more (every mark names its layer).
  assert.doesNotMatch(hook, /\[MARK\]: true/);
});
