/**
 * the-nav-highlight-is-0-7s.test.ts — ⏱ THE BOTTOM NAV'S HIGHLIGHT IS 700 ms ON THE SPRING (owner 18 Nov 2026, verbatim:
 * *"move bottom nav to 0.7s"*; specs `MOTION_STANDARD_2026-11-18.md` § 5 #36 Highlight: "Rise 700 · Spring (thumb) —
 * bottom nav (moves to 0.7 s), pill selectors, sub-nav — every chosen tab"). It replaces the bar's own 500 ms and its
 * own curve `cubic-bezier(.34,1.4,.5,1)`.
 *
 * The bar is lint-locked (`scripts/lint-bottom-nav.mjs`), so the change went through its OWNER PATH: the four central
 * knobs on the nav root — "retune the whole app's nav feel by editing ONLY these four" — and the lock itself now
 * requires the new values.
 *
 * 🛡 SABOTAGE (seen RED once each, 2026-11-18, then restored): `'--bn-dur': 'var(--sn-m-rise)'` → `'500ms'` (1, 3) ·
 * `--sn-m-rise: 700ms` → `500ms` in globals.css (1) · the pill's `var(--sn-m-spring)` → `cubic-bezier(0.34, 1.4, 0.5, 1)` (2, 3).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { RISE_MS_STANDARD } from '@/lib/motion-table';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const NAV = stripComments(readFileSync(join(WEB, 'app/_components/nav/bottom-nav.tsx'), 'utf8'));
const CSS = readFileSync(join(WEB, 'app/globals.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

/** A token's value as declared in a plain `:root { … }` block. */
function token(name: string): string | null {
  let v: string | null = null;
  for (const b of CSS.matchAll(/(?:^|\})\s*:root\s*\{([^{}]*)\}/g)) for (const m of b[1]!.matchAll(new RegExp(`${name}:\\s*([^;]+);`, 'g'))) v = m[1]!.trim();
  return v;
}

test('1 · the highlight’s duration is the standard’s Rise — 700 ms — read as a token, never a number of its own', () => {
  const knob = /'--bn-dur':\s*'([^']+)'/.exec(NAV)?.[1];
  assert.equal(knob, 'var(--sn-m-rise)', 'the bar’s duration knob is not the standard’s Rise');
  assert.equal(token('--sn-m-rise'), '700ms', 'Rise is not 700 ms');
  assert.equal(RISE_MS_STANDARD, 700);
  assert.doesNotMatch(NAV, /['"`]\s*500ms/, 'the bar still carries its own 500 ms');
});

test('2 · the pill travels on the standard’s Spring, and its stretch runs the same 700 ms', () => {
  assert.match(NAV, /transition:\s*'transform var\(--bn-dur\) var\(--sn-m-spring\)'/, 'the pill travels on a curve of its own');
  assert.doesNotMatch(NAV, /var\(--bn-dur\)\s+cubic-bezier\(/);
  assert.match(CSS, /\.nav-pill-stretch \{\s*animation:\s*nav-pill-travel var\(--bn-dur, var\(--sn-m-rise\)\) var\(--sn-m-spring\);\s*\}/);
  assert.match(String(token('--sn-m-spring')), /^linear\(0, /, 'the Spring is not the real spring');
  // The fallback where `linear()` is not understood stays ready (WebKit caveat, standard § 3 rule 9).
  assert.match(CSS, /@supports not \(transition-timing-function:\s*linear\(0, 1\)\)\s*\{\s*:root\s*\{\s*--sn-m-spring:\s*cubic-bezier\(\.34,1\.56,\.64,1\);/);
});

test('3 · the lock itself requires it — the owner path, not a way round the lint', () => {
  const lint = readFileSync(join(WEB, 'scripts/lint-bottom-nav.mjs'), 'utf8');
  const markers = /const REQUIRED_MARKERS = \[([\s\S]*?)\n\];/.exec(lint)?.[1] ?? '';
  assert.ok(markers.includes(`"'--bn-dur': 'var(--sn-m-rise)'"`), 'lint-bottom-nav no longer requires the 0.7 s knob');
  assert.ok(markers.includes(`"transition: 'transform var(--bn-dur) var(--sn-m-spring)'"`), 'lint-bottom-nav no longer requires the Spring');
  for (const m of ["'--bn-dur': 'var(--sn-m-rise)'", "transition: 'transform var(--bn-dur) var(--sn-m-spring)'"]) {
    assert.ok(readFileSync(join(WEB, 'app/_components/nav/bottom-nav.tsx'), 'utf8').includes(m), `bottom-nav.tsx lost \`${m}\``);
  }
});
