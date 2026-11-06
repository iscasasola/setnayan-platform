/**
 * field-template-guard.test.ts — `lint:field-template` finds hand-drawn typed boxes, spares the §6 exceptions, and
 * ratchets both ways (a rise fails; a fall fails until the baseline is regenerated).
 *
 * The matcher and the ratchet are EXECUTED here on fixtures; the repo-wide run is the CI step itself
 * (`Lint field template`, wired into the blocking-guards aggregator in .github/workflows/ci.yml). This file also
 * proves the committed baseline agrees with a fresh scan and that the walk is not blind.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BASELINE_PATH,
  MIN_FILES,
  TEMPLATE_FILES,
  attrOf,
  compare,
  formatBaseline,
  isRawTypedBox,
  openingTag,
  parseBaseline,
  rawBoxes,
  scan,
} from '../scripts/lint-field-template.mjs';

test('a box a person types words into is counted — absent, text, email, tel, url, a non-literal kind, a textarea', () => {
  for (const tag of [
    '<input name="x" />',
    '<input type="text" name="x" />',
    "<input type='email' />",
    '<input type={"tel"} />',
    '<input type="url" />',
    '<input type={kind} />',
    '<textarea rows={3} />',
  ]) {
    assert.equal(isRawTypedBox(tag), true, tag);
  }
});

test('the §6 exceptions and non-word kinds are not — by KIND, never by words', () => {
  for (const tag of [
    '<input type="hidden" name="x" value="1" />',
    '<input type="checkbox" />',
    '<input type="radio" />',
    '<input type="file" />',
    '<input type="date" />',
    '<input type="time" />',
    '<input type="password" />',
    '<input type="search" />',
    '<input type="number" />',
    '<input autoComplete="one-time-code" inputMode="numeric" />',
    '<Input type="text" />',
    '<inputs />',
  ]) {
    assert.equal(isRawTypedBox(tag), false, tag);
  }
});

test('the whole opening tag is read — an attribute on a later line, an arrow or a `>` inside braces', () => {
  const src = ['<input', '  onChange={(e) => set(e.target.value > 3 ? "a>" : `b>`)}', '  type="hidden"', '/>'].join('\n');
  const tag = openingTag(src, 0);
  assert.ok(tag?.endsWith('/>'));
  assert.equal(attrOf(tag!, 'type'), 'hidden');
  assert.deepEqual(rawBoxes(src), []);
});

test('an attribute named inside an expression is not the tag’s own', () => {
  const tag = '<input value={pick({ type: "hidden" })} />';
  assert.equal(attrOf(tag, 'type'), null);
  assert.equal(isRawTypedBox(tag), true);
});

test('comments are not boxes, and `field-ok` on a line of the tag spares one', () => {
  const src = [
    '// never write <input type="text"> here — use TypedRow',
    '{/* <textarea /> */}',
    '<input',
    '  // field-ok: the guest Event Hub — the couple designs it',
    '  name="greeting"',
    '/>',
    '<textarea name="note" />',
  ].join('\n');
  assert.deepEqual(
    rawBoxes(src).map((h) => h.lineNumber),
    [7],
  );
});

test('the ratchet: a rise fails, a fall fails until written down, holding passes', () => {
  const base = { 'a.tsx': 2, 'b.tsx': 1 };
  assert.deepEqual(compare({ 'a.tsx': 2, 'b.tsx': 1 }, base), { rose: [], fell: [] });
  assert.deepEqual(compare({ 'a.tsx': 3, 'b.tsx': 1 }, base).rose, [{ rel: 'a.tsx', count: 3, allowed: 2 }]);
  assert.deepEqual(compare({ 'a.tsx': 2, 'b.tsx': 1, 'c.tsx': 1 }, base).rose, [{ rel: 'c.tsx', count: 1, allowed: 0 }]);
  assert.deepEqual(compare({ 'a.tsx': 2 }, base).fell, [{ rel: 'b.tsx', count: 0, allowed: 1 }]);
  assert.deepEqual(parseBaseline(formatBaseline(base)), base);
});

test('the committed baseline is exactly a fresh scan, and the walk is not blind', () => {
  const { files, counts } = scan();
  assert.ok(files >= MIN_FILES, `scanned ${files} files`);
  const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
  assert.deepEqual(compare(counts, baseline), { rose: [], fell: [] }, 'run: node scripts/lint-field-template.mjs --update-baseline');
  for (const t of TEMPLATE_FILES) assert.equal(baseline[t], undefined, `${t} is the template`);
});

test('the template file still IS the template (it exports TypedRow and draws the box)', () => {
  for (const t of TEMPLATE_FILES) {
    const src = readFileSync(new URL(`../../../${t}`, import.meta.url), 'utf8');
    assert.match(src, /export function TypedRow\b/);
    assert.ok(rawBoxes(src).length > 0, 'the template draws its own box — excluded by path, not by being empty');
  }
});
