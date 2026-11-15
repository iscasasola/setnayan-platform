/**
 * the-rise-is-0-7s.test.ts — ⤴ THE RISE'S LENGTH LIVES IN ONE PLACE (HOUSE_TEMPLATES T4). The file keeps its name so
 * every pointer to it still lands; since 13 Nov 2026 it holds the approved GROW's numbers, not 0.7 s:
 * owner "motion approved" (grow-full-screen-fable.html; DECISION_LOG 2026-11-13 "Motion system approved") — *"The faster
 * numbers REPLACE the 0.7 s rise (10 Nov)"*: the shape opens in 360 ms on the emphasized curve, the close plays it
 * backwards at 80 % (288 ms), reduced motion stays the 120 ms cross-fade. One timing table: `lib/motion-table.ts` ↔
 * the `--sn-m-*` tokens in globals.css.
 *
 * History: 520 ms → 0.7 s (owner 2026-11-10, "SIX ANSWERS" (2)) → the grow's 360 ms (owner 2026-11-13).
 *
 * Owner, 2026-11-10 (DECISION_LOG "SIX ANSWERS" (2)): *"0.7s"* ⇒ Rise full screen runs 0.7 s (`--sn-pill-dur`, the
 * family speed); `lib/rise-motion.ts`'s 520 ms becomes 0.7 s; reduced motion stays a short fade. Look-free: only the
 * timing changed — the ease, the frames and the reverse are held by the-top-scrolls-up-and-locks.test.ts.
 *
 * Held here:
 *   1. the CSS token `--sn-dur-rise` has no number of its own — it reads `--sn-pill-dur`, which is 700 ms;
 *   2. `RISE_MS` (the Web Animations mirror) is 700 and equals that token's value, so CSS and JS cannot drift apart;
 *   3. reduced motion is still the short cross-fade (120 ms), not the full rise;
 *   4. nobody keeps their own copy: no file but `lib/rise-motion.ts` gives `RISE_MS` / `PICKED_OPEN_MS` a number, no
 *      stylesheet but globals.css defines `--sn-dur-rise`, every importer of the rise passes `RISE_MS` (never a literal
 *      duration), and the old 520-ms rise survives nowhere as `520ms` or `duration: 520`.
 *
 * 🛡 SABOTAGE (seen RED, then restored — 2026-11-10): `RISE_MS = 700` → `520` (red: 2); `--sn-dur-rise: var(--sn-pill-dur)`
 * → `520ms` (red: 1); `transitionDuration: 'var(--sn-dur-rise)'` → `'520ms'` in collections-list.tsx (red: 4).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { RISE_CLOSE_MS, RISE_MS, RISE_REDUCED_MS } from '@/lib/rise-motion';

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(tsx?|css)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const SOURCES = ['app', 'lib', 'components'].flatMap((d) => walk(join(WEB, d))).map((abs) => ({
  rel: relative(WEB, abs),
  src: stripComments(readFileSync(abs, 'utf8')),
}));

const CSS = stripComments(read('app/globals.css'));
const tokenMs = (name: string) => {
  const m = CSS.match(new RegExp(`${name}:\\s*(\\d+)ms;`));
  assert.ok(m, `globals.css lost the ${name} token`);
  return Number(m[1]);
};
test('1 · the CSS rise reads the grow\'s shape from the one timing table — 360 ms', () => {
  assert.equal(tokenMs('--sn-m-grow-shape'), 360, 'the grow\'s shape is no longer the approved 360 ms');
  const decl = [...CSS.matchAll(/--sn-dur-rise:\s*([^;]+);/g)].map((m) => m[1]!.trim());
  assert.deepEqual(decl, ['var(--sn-m-grow-shape)'], '--sn-dur-rise carries its own number again (or is defined twice)');
  assert.match(CSS, /--sn-ease-rise:\s*var\(--sn-m-ease-emph\);/, 'the rise is not on the emphasized curve');
});
test('2 · RISE_MS is the table\'s shape and equals the token — CSS and JS agree; the close is 80 %', () => {
  assert.equal(RISE_MS, 360);
  assert.equal(RISE_MS, tokenMs('--sn-m-grow-shape'), 'lib/rise-motion.ts and globals.css disagree about how long the rise is');
  assert.equal(RISE_CLOSE_MS, Math.round(RISE_MS * 0.8));
  const src = stripComments(read('lib/rise-motion.ts'));
  assert.equal((src.match(/export const RISE_MS = MOTION_TABLE\.growShapeMs;/g) ?? []).length, 1, 'RISE_MS has a number of its own again');
});
test('3 · reduced motion stays the short cross-fade', () => {
  assert.equal(RISE_REDUCED_MS, 120);
  assert.match(CSS, /--sn-dur-rise-reduced:\s*120ms;/);
  assert.ok(RISE_REDUCED_MS < RISE_MS);
});
test('4 · nobody keeps their own copy of the rise duration', () => {
  const offenders: string[] = [];
  for (const { rel, src } of SOURCES) {
    if (rel !== 'lib/rise-motion.ts' && /\b(?:RISE_MS|PICKED_OPEN_MS|RISE_CLOSE_MS)\s*=\s*\d/.test(src)) offenders.push(`${rel}: a numeric RISE_MS / PICKED_OPEN_MS`);
    if (rel !== 'app/globals.css' && /--sn-dur-rise\s*:/.test(src)) offenders.push(`${rel}: redefines --sn-dur-rise`);
    // The old rises (520 ms, then 700 ms) survive nowhere as the rise. (The ripple's own 520 ms is the table's, named.)
    const noRipple = src.replace(/--sn-m-ripple:\s*520ms;/g, '');
    if (/\b520ms\b|\bduration:\s*520\b/.test(noRipple)) offenders.push(`${rel}: the old 520-ms rise hard-coded`);
    if (rel !== 'lib/rise-motion.ts' && /from '@\/lib\/rise-motion'/.test(src) && /\bduration:\s*\d/.test(src)) {
      offenders.push(`${rel}: imports the rise but passes a literal duration`);
    }
  }
  assert.ok(SOURCES.length > 1000, `the walk found only ${SOURCES.length} files — the scan is not looking`);
  assert.deepEqual(offenders, []);
});
