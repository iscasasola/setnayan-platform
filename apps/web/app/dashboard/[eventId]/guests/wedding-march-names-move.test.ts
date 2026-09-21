import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

/**
 * ⚖ Owner 2026-09-21: tap or drag a name onto an empty "—" to pair them; drag
 * a name onto another name to swap. The RULES are pinned by
 * `lib/march-moves.test.ts` and the WRITES by
 * `tests/db/wedding-march-join-and-swap.db.test.ts`. This pins the wiring
 * between them — the three ways the feature could work in a demo and still be
 * wrong.
 */

const G = join(process.cwd(), 'app', 'dashboard', '[eventId]', 'guests');
const read = (...p: string[]) => stripComments(readFileSync(join(G, ...p), 'utf8'));

test('🔒 the server asks the rule AGAIN before it writes — a picker is not a permission', () => {
  const src = read('march-actions.ts');
  for (const [fn, verdict, rpc] of [
    ['joinEntourageLine', 'joinVerdict', 'join_entourage_line'],
    ['swapEntouragePlaces', 'swapVerdict', 'swap_entourage_places'],
  ] as const) {
    const start = src.indexOf(`export async function ${fn}(`);
    assert.ok(start > -1, `${fn} is gone`);
    const next = src.indexOf('export async function', start + 1);
    const body = src.slice(start, next === -1 ? undefined : next);
    const v = body.indexOf(`${verdict}(`);
    const r = body.indexOf(`'${rpc}'`);
    assert.ok(v > -1, `${fn} no longer checks ${verdict} — a hand-made request would be obeyed`);
    assert.ok(r > v, `${fn} writes before it checks`);
    assert.match(body.slice(v, r), /if \(!verdict\.ok\) redirect\(/, `${fn} checks the rule and ignores the answer`);
  }
});

test('the panel hands the island its answers — computed from the same rule on the server', () => {
  const panel = read('_components', 'entourage-order-panel.tsx');
  assert.match(panel, /slots: \[slotFor\(lines, key, line, 0\), slotFor\(lines, key, line, 1\)\]/, 'the lines no longer carry their moves');
  assert.match(panel, /swapWith: swapsFor\(lines, groupKey, half\.id\)/);
  assert.match(panel, /joiners: anchor\?\.id \? joinersFor\(lines, groupKey, anchor\.id\) : \[\]/);
});

test('a NAME drag never turns into a LINE drag', () => {
  // Without stopPropagation the row's own dragstart also fires, overwrites the
  // payload, and "swap these two names" silently reorders two lines instead.
  const island = read('_components', 'walking-order-lines.tsx');
  const start = island.indexOf('onDragStart={(e) => {\n        if (slot.kind !== \'name\') return;');
  assert.ok(start > -1, 'the name cell no longer starts its own drag');
  const body = island.slice(start, island.indexOf('}}', start));
  const stop = body.indexOf('e.stopPropagation()');
  const set = body.indexOf('e.dataTransfer.setData(NAME_TYPE');
  assert.ok(stop > -1 && set > stop, 'a name drag bubbles to the row');
  // And every cell of every line is a MarchCell — count the mount, not the name.
  assert.equal((island.match(/<MarchCell\b/g) ?? []).length, 1, 'expected exactly one MarchCell mount (inside the per-cell map)');
  assert.match(island, /\(\[0, 1\] as const\)\.map\(\(c\) => \(\s*<MarchCell\b/, 'MarchCell is not rendered for both cells');
});
