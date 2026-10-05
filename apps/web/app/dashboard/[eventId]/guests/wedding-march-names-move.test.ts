import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
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
    // ⚖ 2026-09-23: the refusal is RETURNED now, not redirected with. What is
    // pinned is that the answer is ACTED ON between the check and the write —
    // a verdict that is computed and then stepped over is the defect, whichever
    // way the reason travels.
    assert.match(
      body.slice(v, r),
      /if \(!verdict\.ok\) return \{ ok: false, reason: verdict\.reason \}/,
      `${fn} checks the rule and ignores the answer`,
    );
  }
});

test('the maker asks the SAME rule the server asks — before it draws a drop', () => {
  // 🚶 2026-10-06: the drag maker predicts each drop on the client; the "may it go
  // there?" is `lib/march-moves.ts`, the rule each action asks again before it writes.
  const plan = stripComments(readFileSync(join(process.cwd(), 'lib', 'march-drag.ts'), 'utf8'));
  assert.match(plan, /import \{ joinVerdict, swapVerdict \} from '@\/lib\/march-moves';/);
  assert.match(plan, /const verdict = swapVerdict\(asLines\(sec\.rows\), sec\.key, source\.id, target\.id\);\s*if \(!verdict\.ok\) return no\(verdict\.reason\);/);
  assert.match(plan, /const verdict = joinVerdict\(asLines\(sec\.rows\), sec\.key, target\.anchor, source\.id\);\s*if \(!verdict\.ok\) return no\(verdict\.reason\);/);
});

test('a NAME drag never turns into a WALK drag', () => {
  // "Swap these two names" must never silently reorder two walks instead: the
  // source is the INNERMOST draggable under the finger, a walk is dragged only by
  // its step number, and a walk lands only in a gap.
  const maker = stripComments(
    readFileSync(join(process.cwd(), 'app', 'dashboard', '[eventId]', 'launch', '_components', 'details-march.tsx'), 'utf8'),
  );
  assert.match(maker, /const el = \(e\.target as HTMLElement\)\.closest<HTMLElement>\('\[data-march-drag\]'\);/);
  assert.equal((maker.match(/data-march-drag=\{`walk\|/g) ?? []).length, 1, 'a walk can be lifted from somewhere other than its number');
  assert.match(maker, /data-march-drag=\{p\.id \? `name\|\$\{p\.id\}` : undefined\}/, 'a name chip does not lift the name');
  const plan = stripComments(readFileSync(join(process.cwd(), 'lib', 'march-drag.ts'), 'utf8'));
  assert.match(plan, /if \(source\.kind === 'walk'\) \{\s*if \(target\.kind !== 'gap'\) return null;/, 'a walk can land on a name');
});

test('every printed entourage follows the couple’s section order', () => {
  // ⚖ Owner 2026-09-21: the couple arranges the sections. A reader that calls
  // buildEntourage with ONE argument prints the built-in order and silently
  // disagrees with the Wedding March the couple just arranged.
  const hits = execFileSync('git', ['grep', '-n', '-F', 'buildEntourage(', '--', 'app', 'lib'], { encoding: 'utf8' })
    .split('\n')
    .filter(Boolean)
    .filter((l) => !/\.test\.tsx?:/.test(l) && !/export function buildEntourage\(/.test(l))
    // The dev labs (`app/dev/*`, 404 in production) build fixtures, not a couple's march.
    .filter((l) => !l.startsWith('app/dev/'));
  assert.ok(hits.length >= 2, `expected the two public readers, found ${hits.length}: ${hits.join(' | ')}`);
  for (const hit of hits) {
    const [file] = hit.split(':');
    const src = readFileSync(join(process.cwd(), file!), 'utf8');
    const at = src.indexOf('buildEntourage(');
    const call = src.slice(at, src.indexOf(');', at));
    assert.match(call, /loadEntourageSectionOrder\(/, `${file} prints the entourage without the couple's section order`);
  }
});
