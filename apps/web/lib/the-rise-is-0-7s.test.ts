/**
 * the-rise-is-0-7s.test.ts — ⤴ RISE FULL SCREEN RUNS 0.7 s, AND THE NUMBER LIVES IN ONE PLACE (HOUSE_TEMPLATES T4).
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
import { RISE_MS, RISE_REDUCED_MS } from '@/lib/rise-motion';

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
const pillMs = () => {
  const m = CSS.match(/--sn-pill-dur:\s*(\d+)ms;/);
  assert.ok(m, 'globals.css lost the --sn-pill-dur token');
  return Number(m[1]);
};

test('1 · the CSS rise reads the family speed, which is 700 ms', () => {
  assert.equal(pillMs(), 700, 'the family speed is no longer 0.7 s');
  const decl = [...CSS.matchAll(/--sn-dur-rise:\s*([^;]+);/g)].map((m) => m[1]!.trim());
  assert.deepEqual(decl, ['var(--sn-pill-dur)'], '--sn-dur-rise carries its own number again (or is defined twice)');
});

test('2 · RISE_MS is 700 and equals the token — CSS and JS agree', () => {
  assert.equal(RISE_MS, 700);
  assert.equal(RISE_MS, pillMs(), 'lib/rise-motion.ts and globals.css disagree about how long the rise is');
  const src = stripComments(read('lib/rise-motion.ts'));
  assert.equal((src.match(/export const RISE_MS = 700;/g) ?? []).length, 1);
});

test('3 · reduced motion stays the short cross-fade', () => {
  assert.equal(RISE_REDUCED_MS, 120);
  assert.match(CSS, /--sn-dur-rise-reduced:\s*120ms;/);
  assert.ok(RISE_REDUCED_MS < RISE_MS);
});

test('4 · nobody keeps their own copy of the rise duration', () => {
  const offenders: string[] = [];
  for (const { rel, src } of SOURCES) {
    if (rel !== 'lib/rise-motion.ts' && /\b(?:RISE_MS|PICKED_OPEN_MS)\s*=\s*\d/.test(src)) offenders.push(`${rel}: a numeric RISE_MS / PICKED_OPEN_MS`);
    if (rel !== 'app/globals.css' && /--sn-dur-rise\s*:/.test(src)) offenders.push(`${rel}: redefines --sn-dur-rise`);
    if (/\b520ms\b|\bduration:\s*520\b/.test(src)) offenders.push(`${rel}: the old 520-ms rise hard-coded`);
    if (rel !== 'lib/rise-motion.ts' && /from '@\/lib\/rise-motion'/.test(src) && /\bduration:\s*\d/.test(src)) {
      offenders.push(`${rel}: imports the rise but passes a literal duration`);
    }
  }
  assert.ok(SOURCES.length > 1000, `the walk found only ${SOURCES.length} files — the scan is not looking`);
  assert.deepEqual(offenders, []);
});
