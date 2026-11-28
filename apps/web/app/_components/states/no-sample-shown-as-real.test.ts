/**
 * 🔒 NO SAMPLE IS SHOWN AS IF IT WERE REAL — owner R3, 27 Nov 2026 (DECISION_LOG "No text highlighting or copying
 * app-wide; remove placeholder copy"; MASTER-PLAN-2026-11-27 P1 · B4):
 *   "also look for placeholder texts and remove them. we want this to be a fixed app, not an app with guidelines on
 *    what should be here."
 *
 * This SUPERSEDES the 9 Nov "Empty Look" (greyed sample content under an "Example" chip). An empty part now says one
 * honest line and offers at most one action; it never draws a sample event, sample guests, a sample budget, sample
 * photos or a sample graph beside the person's real data.
 *
 *   1 · THE PIECES ARE GONE — no `ExamplePreview`, no `lib/empty-look-samples.ts`, no `board-examples.tsx`, and no
 *       `.sn-example` rules in `globals.css`.
 *   2 · NO SCREEN FILE draws an "Example" chip or a "Sample cards" line (the dev labs may use sample data; they are not
 *       reachable by a customer), and Unihome's supplier shelf never captions a stock photo "Sample photo" — a shop with
 *       no photo of its own draws a plain shop mark. (The front door's own card and the supplier's own hero keep their
 *       honest "Sample photo" caption: the first is a public category picture, the second sits beside its Upload door.)
 *   3 · THE SHARED EMPTY PIECES TAKE NO SAMPLE — `EmptyState` and `QuietStart` have no `preview` input.
 *   4 · AN EMPTY SUPPLIER GRAPH DRAWS NO PICTURE — the analytics card never paints `g.pic` while `empty`.
 *
 * 🛡 SABOTAGE (each seen RED, then restored): an `<span className="sn-example-chip">Example</span>` typed back into
 *   `home-tile.tsx` (red: 2) · `preview?: ReactNode` added back to `EmptyState`'s props (red: 3) · the graph card's
 *   `{g.state === 'empty' ? null : g.pic}` put back to `{g.pic}` (red: 4).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '.next' || name === 'dev') continue;
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.lab\.tsx$/.test(name)) out.push(p);
  }
  return out;
}

test('1 · the Example pieces are gone', () => {
  for (const rel of ['lib/empty-look-samples.ts', 'app/dashboard/(launcher)/_components/board-examples.tsx']) {
    assert.equal(existsSync(join(WEB, rel)), false, `${rel} is back — a sample shown as if real (R3)`);
  }
  assert.doesNotMatch(read('app/_components/states/empty-state.tsx'), /export function ExamplePreview/, 'ExamplePreview is back');
  assert.doesNotMatch(readFileSync(join(WEB, 'app/globals.css'), 'utf8'), /\.sn-example\b/, 'the .sn-example look is back in globals.css');
});

test('2 · no screen file draws an "Example" chip or a sample label', () => {
  const bad: string[] = [];
  for (const root of ['app', 'components']) {
    for (const f of walk(join(WEB, root))) {
      const src = stripComments(readFileSync(f, 'utf8'));
      if (/ExamplePreview|empty-look-samples|>\s*Example\s*<|['"`]Example['"`]|Sample cards/.test(src)) bad.push(relative(WEB, f));
    }
  }
  assert.deepEqual(bad, [], `these files show a sample as if it were real (owner R3, 27 Nov): ${bad.join(', ')}`);
  const unihome = read('app/dashboard/(launcher)/_components/unihome.tsx');
  assert.doesNotMatch(unihome, /Sample photo/, 'Unihome captions a stock photo as a sample again');
  assert.match(unihome, /s\.sample \? \(\s*<span className=\{u\.noCover\}/, 'a shop with no photo on Unihome no longer draws the plain shop mark');
});

test('3 · EmptyState and QuietStart take no sample', () => {
  for (const rel of ['app/_components/states/empty-state.tsx', 'app/_components/states/quiet-start.tsx']) {
    assert.doesNotMatch(read(rel), /\bpreview\??:/, `${rel} takes a preview (a sample) again`);
  }
});

test('4 · an empty supplier graph draws no picture', () => {
  const tile = read('app/vendor-dashboard/performance/_components/graph-tile.tsx');
  assert.match(tile, /\{g\.state === 'empty' \? null : g\.pic\}/, 'the graph card paints its picture while empty');
  assert.doesNotMatch(tile, /ag-exc|>Example</, 'the graph card wears an "Example" chip again');
});
