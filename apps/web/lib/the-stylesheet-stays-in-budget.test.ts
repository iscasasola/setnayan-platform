/**
 * 🔒 THE STYLESHEET STAYS IN BUDGET, AND PAGE LOAD DOES NOT WAIT ON THE STALE-TAB CHECK (speed pass 2026-11-18).
 *
 * Every page downloads and parses ONE global stylesheet (measured on live c1f9e2f: ~650 KB minified, ~106 KB gzipped).
 * Two cheap fences hold what this pass won, without a 40-second compile in a unit test:
 *
 * 1 · Tailwind never scans `*.test.*` files. A class quoted only in a test can never be on a shipped element, yet every
 *     one became a rule on every page (−114 selectors, −7.4 KB minified when they were dropped).
 * 2 · `app/globals.css` (the hand-written half, ~600 KB of source with its comments) does not quietly grow past its
 *     ceiling. Raising the ceiling is allowed — in the same PR that says why the page needs the bytes.
 * 3 · The stale-tab check's one check on mount waits for the page to load and go idle (`whenPageSettles`) — it draws
 *     nothing on first paint and must not compete with the page's own scripts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');

test('1 · Tailwind does not scan test files', () => {
  const cfg = stripComments(readFileSync(join(WEB, 'tailwind.config.ts'), 'utf8'));
  const content = cfg.match(/content:\s*\[([^\]]*)\]/)?.[1] ?? '';
  assert.ok(content.includes("'!./**/*.test.{ts,tsx}'"), 'tailwind.config.ts content scans *.test.* files again — every quoted class becomes a shipped rule');
  for (const root of ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}']) {
    assert.ok(content.includes(`'${root}'`), `tailwind.config.ts stopped scanning ${root} — utilities used there would vanish`);
  }
});

/**
 * The hand-written stylesheet's ceiling, in bytes of source. Measured 605,109 B on 2026-11-18; ~5% headroom.
 * RAISED 635,000 → 650,000 on 2026-11-19 (motion PR #7792, which carries Phase 6). Phase 6 of the motion standard
 * (owner 19 Nov: "animations build the rest") added the app-wide motions — Celebrate, Long press, Lift, Upload, Offline
 * bar, Glide and Chat send — about 13 KB with their comments; measured 641,762 B. They are SHARED parts on many screens
 * (the offline bar on every one), not surface-only rules, and a plain `.css` beside a part breaks every unit test that
 * renders it (no CSS loader under tsx). Moving them to another sheet the root layout loads would save no byte. Headroom
 * is ~1.3% on purpose: the next growth has to argue for itself.
 */
const GLOBALS_CSS_CEILING = 650_000;

test('2 · app/globals.css stays under its ceiling', () => {
  const size = statSync(join(WEB, 'app/globals.css')).size;
  assert.ok(
    size <= GLOBALS_CSS_CEILING,
    `app/globals.css is ${size} B, over its ${GLOBALS_CSS_CEILING} B ceiling. Every page parses it. Put surface-only rules in that surface's own CSS file, or raise the ceiling here and say why.`,
  );
});

test('3 · the stale-tab check on mount waits for the page to settle', () => {
  const src = stripComments(readFileSync(join(WEB, 'app/_components/stale-tab-notice.tsx'), 'utf8'));
  assert.match(src, /whenPageSettles\(\(\) => void check\(false\)\)/, 'the mount check runs during page load again');
  assert.doesNotMatch(src, /^\s*void check\(false\);/m, 'a bare mount check competes with the page load');
  const settles = stripComments(readFileSync(join(WEB, 'lib/when-page-settles.ts'), 'utf8'));
  assert.match(settles, /document\.readyState === 'complete'/);
  assert.match(settles, /addEventListener\('load'/);
  assert.match(settles, /requestIdleCallback\(run, \{ timeout: timeoutMs \}\)/, 'the idle wait has no ceiling — the check could wait forever');
});
