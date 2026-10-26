/**
 * raw-colour-guard.test.ts — `lint-raw-colour` finds raw colours, spares roles, skips the guest
 * Event Hub, and ratchets only downward (brand refresh step 1, owner 2026-10-26).
 *
 * The matcher and the ratchet are EXECUTED here on fixtures; the repo-wide run is the CI step
 * itself (`Lint raw colour`, wired into the blocking-guards aggregator in .github/workflows/ci.yml).
 * This file also proves the committed baseline agrees with a fresh scan and the walk is not blind.
 *
 * 🛡 Sabotage (watched before this shipped): adding `<p className="text-[#C24E25] bg-terracotta/10">`
 * to app/(shell)/pricing/page.tsx turned the CLI red (exit 1, "32 raw colour(s), baseline allows 30",
 * naming the line); reverting it turned it green with the baseline byte-unchanged.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  BASELINE_PATH,
  MIN_FILES,
  NOT_SCANNED,
  classifyColour,
  compare,
  countOf,
  formatBaseline,
  parseBaseline,
  rawLines,
  rawOnLine,
  scan,
} from '../scripts/lint-raw-colour.mjs';

const kinds = (line: string) => rawOnLine(line).map((h: { kind: string }) => h.kind);

test('hex, numeric colour functions and R G B triples are raw', () => {
  assert.deepEqual(kinds('<div style={{ color: "#C24E25" }}>'), ['hex']);
  assert.deepEqual(kinds("box-shadow: 0 1px 2px rgba(30,26,18,.05);"), ['fn']);
  assert.deepEqual(kinds('  --color-cream: 255 255 255;'), ['triple']);
  assert.deepEqual(kinds('<span className="bg-[#fff8]">'), ['hex']);
});

test('a token read is not raw', () => {
  assert.deepEqual(kinds('color: rgb(var(--role-ink) / 0.5);'), []);
  assert.deepEqual(kinds('background: var(--m-paper);'), []);
  assert.deepEqual(kinds('<a href="#faq">'), [], 'a fragment is not a colour');
  assert.deepEqual(kinds('&#8212; an entity'), []);
});

test('colour-word, ramp, palette and white/black utilities are raw; roles are not', () => {
  assert.deepEqual(kinds('<div className="bg-cream text-terracotta border-ink-soft">'), ['legacy', 'legacy', 'legacy']);
  assert.deepEqual(kinds('<p className="text-success-700 bg-emerald-50 hover:bg-white">'), ['legacy', 'legacy', 'legacy']);
  assert.deepEqual(kinds('<b className="text-sn-accent">'), ['legacy']);
  assert.deepEqual(
    kinds('<div className="bg-page text-ink border-line bg-surface-2 text-muted bg-primary text-on-primary">'),
    [],
  );
  assert.deepEqual(kinds('<i className="bg-success-wash text-danger bg-selected-soft text-badge-ink ring-focus">'), []);
});

test('a role with an alpha is raw — the wash must be named', () => {
  assert.deepEqual(kinds('<p className="text-ink/55 border-ink/10 bg-primary/[0.07]">'), ['role-alpha', 'role-alpha', 'role-alpha']);
  assert.equal(classifyColour('ink', '/55'), 'role-alpha');
  assert.equal(classifyColour('ink', undefined), null);
});

test('non-colour utilities are not counted', () => {
  assert.deepEqual(kinds('<div className="text-sm text-center border-2 bg-cover shadow-sn-md ring-offset-2 to-transparent">'), []);
  assert.deepEqual(kinds('<div className="bg-gradient-to-r text-balance outline-none accent-auto">'), []);
});

test('comments are not colours, and `raw-colour-ok` spares a data line', () => {
  const tsx = [
    '// was #C24E25 — now bg-primary',
    '/* bg-terracotta */',
    "const swatch = '#A9834B'; // raw-colour-ok: a couple's palette swatch",
    '<p className="text-ink/55">',
  ].join('\n');
  assert.deepEqual(rawLines(tsx, 'x.tsx').map((l: { lineNumber: number }) => l.lineNumber), [4]);
  const css = ['/* #fff */', '.a { background: url(https://x.test/a.png); color: #fff; }'].join('\n');
  assert.equal(countOf(rawLines(css, 'a.css')), 1, 'a // inside url() does not swallow the line');
});

test('the guest Event Hub and the couple-chosen looks are not scanned', () => {
  for (const p of [
    'app/[slug]/_lib/pro-site-vars.ts',
    'app/[slug]/page.tsx',
    'app/api/og/u/[slug]/route.ts',
    'lib/invite-themes.ts',
    'lib/hub-theme-tokens.ts',
    'app/theme.css',
  ]) {
    assert.ok(NOT_SCANNED.some((re: RegExp) => re.test(p)), `${p} should not be scanned`);
  }
  assert.ok(!NOT_SCANNED.some((re: RegExp) => re.test('app/pricing/page.tsx')), 'own screens are scanned');
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
  assert.ok(Object.keys(baseline).length > 500, 'the baseline is suspiciously empty');
  assert.deepEqual(compare(counts, baseline), [], 'a file holds more raw colours than the baseline allows');
  assert.equal(counts['apps/web/app/theme.css'], undefined, 'theme.css is where values live — never counted');
});
