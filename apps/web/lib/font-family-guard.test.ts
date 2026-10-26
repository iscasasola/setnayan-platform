/**
 * font-family-guard.test.ts — `lint-font-family` finds named faces in code AND stylesheets, spares
 * the two font roles, skips the guest Event Hub, and ratchets only downward (brand refresh step 2,
 * owner 2026-10-26).
 *
 * The repo-wide run is the CI step (`Lint font family`, in the blocking-guards aggregator).
 *
 * 🛡 Sabotage (watched before this shipped): adding `.x { font-family: Georgia, serif; }` to
 * app/_components/home/home-reskin.css turned the CLI red (exit 1) naming that file and line;
 * reverting it turned it green with the baseline byte-unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BASELINE_PATH,
  MIN_FILES,
  NOT_SCANNED,
  compare,
  countOf,
  faceLines,
  facesOnLine,
  formatBaseline,
  parseBaseline,
  scan,
} from '../scripts/lint-font-family.mjs';

test('named face utilities and arbitrary families count; the two roles and weights do not', () => {
  assert.deepEqual(facesOnLine('<h1 className="font-display text-3xl font-semibold">'), ['font-display']);
  assert.deepEqual(facesOnLine('<p className="font-serif md:font-pahina">'), ['font-serif', 'font-pahina']);
  assert.deepEqual(facesOnLine("<b className=\"font-['Inter_Tight']\">"), ["font-['Inter_Tight']"]);
  assert.deepEqual(facesOnLine('<b className="font-ui font-mono font-bold font-[550] font-feature-settings">'), []);
});

test('a stylesheet family counts — the countdown numeral that no variable reaches', () => {
  const css = '.hc-cd-n { font-family: Georgia, "Times New Roman", serif; font-size: 64px; }';
  assert.equal(countOf(faceLines(css, 'g.css')), 1);
  assert.equal(countOf(faceLines('.a { font: 600 14px/1.2 "Hanken Grotesk", sans-serif; }', 'a.css')), 1);
  assert.equal(countOf(faceLines('.a { font: inherit; }', 'a.css')), 0);
});

test('a role value is not a named face', () => {
  for (const v of ['var(--font-ui)', 'var(--font-ui-mono)', 'var(--font-mono), monospace', 'inherit']) {
    assert.equal(countOf(faceLines(`.a { font-family: ${v}; }`, 'a.css')), 0, v);
  }
  assert.deepEqual(facesOnLine("style={{ fontFamily: 'var(--font-ui)' }}"), []);
  assert.equal(facesOnLine("style={{ fontFamily: 'Georgia, serif' }}").length, 1);
  assert.equal(facesOnLine("style={{ fontFamily: 'var(--font-display)' }}").length, 1, 'a legacy alias is still a name');
});

test('comments do not count, and `font-family-ok` spares a Maker preview line', () => {
  const tsx = [
    '// was font-serif',
    "<p style={{ fontFamily: face.css }}> {/* font-family-ok: the couple's chosen face */}",
    '<p className="font-display">',
  ].join('\n');
  assert.deepEqual(faceLines(tsx, 'x.tsx').map((l: { lineNumber: number }) => l.lineNumber), [3]);
});

test('the guest Event Hub, the font files and the couple looks are not scanned', () => {
  for (const p of ['app/[slug]/page.tsx', 'app/_fonts/choice-faces.ts', 'lib/hub-theme-faces.ts', 'app/api/og/u/[slug]/route.ts', 'app/theme.css']) {
    assert.ok(NOT_SCANNED.some((re: RegExp) => re.test(p)), `${p} should not be scanned`);
  }
  assert.ok(!NOT_SCANNED.some((re: RegExp) => re.test('app/globals.css')), 'globals.css is scanned');
});

test('the ratchet: a rise fails, holding or falling passes, a new file may hold none', () => {
  const baseline = { 'a.css': 3 };
  assert.deepEqual(compare({ 'a.css': 3 }, baseline), []);
  assert.deepEqual(compare({ 'a.css': 1 }, baseline), []);
  assert.deepEqual(compare({ 'a.css': 4 }, baseline), [{ rel: 'a.css', count: 4, allowed: 3 }]);
  assert.deepEqual(compare({ 'b.tsx': 1 }, baseline), [{ rel: 'b.tsx', count: 1, allowed: 0 }]);
  assert.deepEqual(parseBaseline(formatBaseline({ 'apps/web/app/x y.tsx': 2 })), { 'apps/web/app/x y.tsx': 2 });
});

test('the committed baseline matches the tree, and the walk is not blind', () => {
  const { files, counts } = scan();
  assert.ok(files >= MIN_FILES, `scanned ${files} files — the walk has gone blind`);
  const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
  assert.ok(Object.keys(baseline).length > 100, 'the baseline is suspiciously empty');
  assert.deepEqual(compare(counts, baseline), [], 'a file names more faces than the baseline allows');
  assert.ok((counts['apps/web/app/globals.css'] ?? 0) > 0, 'globals.css (with .hc-cd-n) must be read');
});
