#!/usr/bin/env node
/**
 * lint-motion-raw — no NEW one-off timings (the motion standard, owner 18 Nov 2026, *"Combine them"*; specs
 * `MOTION_STANDARD_2026-11-18.md` § 11 Phase 1: "a baseline that may only shrink").
 *
 * The standard is five speeds + one loop and two easings (`apps/web/lib/motion-table.ts` ↔ the `--sn-m-*` tokens in
 * `apps/web/app/globals.css`). On 18 Nov the app held 55 distinct `cubic-bezier` easings and hundreds of raw durations;
 * each site moves onto a token as its phase lands. This guard stops the count growing in the meantime.
 *
 * Per file under apps/web/{app,components,lib} (`.css`, `.tsx`, `.ts`; never a test, never `lib/motion-table.ts` — the
 * table itself), it counts:
 *   · raw durations (`120ms`, `.2s`, `0.7s`, `2s`) and `cubic-bezier(` inside a transition / animation declaration —
 *     `transition`, `animation`, their `-duration` / `-timing-function` / `-delay` longhands, and the camelCase forms
 *     a style object uses (`transitionDuration: '300ms'`);
 *   · Tailwind `duration-NNN` / `duration-[…]` classes;
 *   · Web Animations literals — `duration: 300`, and `easing: 'cubic-bezier(…)'`.
 * Block comments are skipped in `.css`; in `.ts`/`.tsx` a comment that happens to spell one of these counts too (the
 * counts are compared like for like, so that only ever makes a line harder to add, never easier).
 *
 * It compares each file against `scripts/motion-raw.baseline.json` and FAILS when a file's count rises, or a file not
 * in the baseline has any. A count that falls passes and is reported — regenerate to lock the drop in:
 *
 *     node scripts/lint-motion-raw.mjs --write
 *
 * Fix a failure by reading the token instead (`var(--sn-m-quick)`, `MOTION_TABLE.…`, `QUICK_MS`) — never by
 * regenerating the baseline to swallow a new number.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BASELINE = path.join(ROOT, 'scripts', 'motion-raw.baseline.json');
const DIRS = ['apps/web/app', 'apps/web/components', 'apps/web/lib'];
const EXCLUDE = new Set(['apps/web/lib/motion-table.ts']);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next' || name.startsWith('.')) continue;
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(css|tsx?)$/.test(name) && !/\.test\.tsx?$/.test(name) && !/\.d\.ts$/.test(name)) out.push(p);
  }
  return out;
}

// A raw time: 120ms · .2s · 0.7s · 2s — not part of a word, a class or a variable name.
const RAW_TIME = /(?<![\w.$-])(?:\d+(?:\.\d+)?|\.\d+)(?:ms|s)(?![\w-])/g;
const BEZIER = /cubic-bezier\(/g;
// A transition / animation declaration (CSS longhands, the style-object camelCase forms, and `el.style.transition = …`)
// and its value, up to the end of the declaration (`;`, `}`) or the line.
const DECL = /(?<![\w-])(?:transition|animation)(?:-?(?:[Dd]uration|[Tt]iming-?[Ff]unction|[Dd]elay))?\s*(?::|=(?!=))\s*([^;{}\n]*)/g;
const TW_DURATION = /(?<![\w-])duration-(?:\d+|\[[^\]\s]*\])(?![\w-])/g;
const WAAPI_DURATION = /(?<![\w$.-])duration\s*:\s*\d/g;
const WAAPI_EASING = /(?<![\w$.-])easing\s*:\s*['"`]cubic-bezier\(/g;

const count = (s, re) => (s.match(re) ?? []).length;

export function countRaw(src, file) {
  const text = file.endsWith('.css') ? src.replace(/\/\*[\s\S]*?\*\//g, '') : src;
  let n = 0;
  for (const m of text.matchAll(DECL)) n += count(m[1], RAW_TIME) + count(m[1], BEZIER);
  if (!file.endsWith('.css')) {
    n += count(text, TW_DURATION);
    n += count(text, WAAPI_DURATION);
    n += count(text, WAAPI_EASING);
  } else {
    n += count(text, TW_DURATION); // `@apply duration-300`
  }
  return n;
}

function scan() {
  const counts = {};
  for (const d of DIRS) {
    for (const abs of walk(path.join(ROOT, d))) {
      const rel = path.relative(ROOT, abs).split(path.sep).join('/');
      if (EXCLUDE.has(rel)) continue;
      const n = countRaw(fs.readFileSync(abs, 'utf8'), rel);
      if (n > 0) counts[rel] = n;
    }
  }
  return Object.fromEntries(Object.entries(counts).sort(([a], [b]) => (a < b ? -1 : 1)));
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const now = scan();
  const total = Object.values(now).reduce((a, b) => a + b, 0);
  if (process.argv.includes('--write')) {
    fs.writeFileSync(BASELINE, `${JSON.stringify(now, null, 2)}\n`);
    console.log(`✓ lint-motion-raw: baseline written — ${total} raw timings in ${Object.keys(now).length} files (scripts/motion-raw.baseline.json).`);
    process.exit(0);
  }
  if (!fs.existsSync(BASELINE)) {
    console.error('FAIL · lint-motion-raw — scripts/motion-raw.baseline.json is missing. Generate it: node scripts/lint-motion-raw.mjs --write');
    process.exit(1);
  }
  const base = JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
  const baseTotal = Object.values(base).reduce((a, b) => a + b, 0);
  if (Object.keys(base).length < 50) {
    console.error(`FAIL · lint-motion-raw — the baseline names only ${Object.keys(base).length} files; it was truncated or emptied. Regenerate from main.`);
    process.exit(1);
  }
  const rose = [];
  const fell = [];
  for (const [file, n] of Object.entries(now)) {
    const was = base[file] ?? 0;
    if (n > was) rose.push(`  ✗ ${file}: ${was} → ${n} (+${n - was})${was === 0 ? '  — a new file with raw timings' : ''}`);
    else if (n < was) fell.push(`  ↓ ${file}: ${was} → ${n}`);
  }
  for (const [file, was] of Object.entries(base)) if (!(file in now)) fell.push(`  ↓ ${file}: ${was} → 0`);
  if (fell.length) {
    console.log(`lint-motion-raw: ${fell.length} file(s) dropped raw timings — lock it in with: node scripts/lint-motion-raw.mjs --write`);
    for (const l of fell) console.log(l);
  }
  if (rose.length) {
    console.error(`FAIL · lint-motion-raw — ${rose.length} file(s) added a raw duration or cubic-bezier( to a transition / animation:\n`);
    for (const l of rose) console.error(l);
    console.error('\nRead the motion standard\'s token instead — var(--sn-m-tap | -quick | -release | -move | -rise | -settle | -spring),');
    console.error('or TAP_MS / QUICK_MS / RELEASE_MS / MOVE_MS / EASE_SETTLE … from apps/web/lib/motion-table.ts.');
    console.error('Only when a count FELL (or a file moved) regenerate: node scripts/lint-motion-raw.mjs --write');
    process.exit(1);
  }
  console.log(`✓ lint-motion-raw: ${total} raw timings in ${Object.keys(now).length} files — none added (baseline ${baseTotal}).`);
}
