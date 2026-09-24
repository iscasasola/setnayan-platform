/**
 * no-card-guard.test.ts — `lint:no-card` finds cards, spares controls, and
 * ratchets only downward.
 *
 * The matcher and the ratchet are EXECUTED here on fixtures; the repo-wide run
 * is the CI step itself (`Lint no new cards`, wired into the blocking-guards
 * aggregator in .github/workflows/ci.yml). This file also proves the committed
 * baseline agrees with a fresh scan and that the walk is not blind.
 *
 * 🛡 Sabotage, both directions (watched before this shipped): adding one
 * `<div className="rounded-xl border p-4">` to a component turned the CLI red
 * (exit 1) naming that file and line; restoring it turned it green (exit 0)
 * with the baseline byte-unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BASELINE_PATH,
  MIN_FILES,
  cardLines,
  compare,
  formatBaseline,
  holdsCard,
  parseBaseline,
  scan,
} from '../scripts/lint-no-card.mjs';

test('a bordered, rounded container is a card; its variants are too', () => {
  assert.equal(holdsCard('<div className="rounded-xl border border-ink/10 p-4">'), true);
  assert.equal(holdsCard('<section className="p-6 sm:rounded-2xl md:border">'), true);
  assert.equal(holdsCard("cn('rounded-card', '!border', active && 'bg-white')"), true);
  assert.equal(holdsCard('<li className="rounded-tile border bg-white">'), true);
});

test('a lone border, a lone radius, a side rule or a control radius is not', () => {
  assert.equal(holdsCard('<div className="rounded-xl bg-white shadow-sn-float">'), false);
  assert.equal(holdsCard('<div className="border-t border-ink/10 pt-6">'), false);
  assert.equal(holdsCard('<span className="rounded-full border px-3">'), false, 'a chip radius');
  assert.equal(holdsCard('<div className="rounded-md border">'), false, 'a control radius');
  assert.equal(holdsCard('<div className="rounded-t-xl border-b">'), false);
});

test('controls keep their radius — <button>, <input>, …Button are not counted', () => {
  const src = [
    '<button className="rounded-xl border px-4 py-2">Save</button>',
    '<SubmitButton',
    '  className="rounded-lg border px-4"',
    '/>',
    '<input className="rounded-lg border px-3" />',
  ].join('\n');
  assert.deepEqual(cardLines(src), []);
});

test('a card beside a button is still a card; a closed tag does not lend its name', () => {
  const src = [
    '<div className="rounded-xl border p-4"><button>Go</button></div>',
    '<button onClick={() => go()}>x</button>',
    '<div',
    '  className="rounded-2xl border"',
    '>',
  ].join('\n');
  assert.deepEqual(
    cardLines(src).map((h) => h.lineNumber),
    [1, 4],
  );
});

test('comments are not cards, and `no-card-ok` spares a chip', () => {
  const src = [
    '// a card is `rounded-xl border` — do not write one',
    '/* rounded-2xl border */',
    '<span',
    '  className="rounded-lg border px-2 text-xs" // no-card-ok: a filter chip',
    '/>',
  ].join('\n');
  assert.deepEqual(cardLines(src), []);
});

test('the ratchet: a rise fails, holding or falling passes, a new file may hold none', () => {
  const baseline = { 'a.tsx': 3, 'b.tsx': 1 };
  assert.deepEqual(compare({ 'a.tsx': 3, 'b.tsx': 1 }, baseline), []);
  assert.deepEqual(compare({ 'a.tsx': 2 }, baseline), [], 'falling is the point');
  assert.deepEqual(compare({ 'a.tsx': 4 }, baseline), [{ rel: 'a.tsx', count: 4, allowed: 3 }]);
  assert.deepEqual(compare({ 'new.tsx': 1 }, baseline), [{ rel: 'new.tsx', count: 1, allowed: 0 }]);
});

test('the baseline format round-trips', () => {
  const counts = { 'apps/web/app/x.tsx': 2, 'apps/web/app/(shell)/y z.tsx': 5 };
  assert.deepEqual(parseBaseline(formatBaseline(counts)), counts);
});

test('the committed baseline matches the tree, and the walk is not blind', () => {
  const { files, counts } = scan();
  assert.ok(files >= MIN_FILES, `scanned ${files} files — the walk has gone blind`);
  const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
  assert.ok(Object.keys(baseline).length > 100, 'the baseline is suspiciously empty');
  assert.deepEqual(compare(counts, baseline), [], 'a file holds more cards than the baseline allows');
  // The foundation's own pieces hold none.
  for (const piece of ['info-tip.tsx']) {
    assert.equal(counts[`apps/web/app/_components/${piece}`], undefined, `${piece} holds a card`);
  }
});
