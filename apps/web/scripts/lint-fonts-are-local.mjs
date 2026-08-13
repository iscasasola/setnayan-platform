#!/usr/bin/env node
/**
 * lint-fonts-are-local.mjs — the build must not phone Google for type.
 *
 * ─── WHY ─────────────────────────────────────────────────────────────────
 * `next/font/google` downloads every family from fonts.gstatic.com AT BUILD
 * TIME. On 2026-08-13 that fetch failed twice in one day, on two unrelated
 * PRs, and each failure presented as a failure of the change under test — one
 * of them also killed the e2e suite, because the tests never got a build.
 *
 * The faces are now committed under `app/_fonts` and loaded with
 * `next/font/local`. This guard keeps it that way, and keeps the declarations
 * honest:
 *
 *   1 · No `next/font/google` import anywhere. One re-added family is enough
 *       to put the whole build back on someone else's uptime.
 *   2 · Every `path:` in a `localFont({src:[…]})` must EXIST. A typo'd path is
 *       a build failure, and a build failure in font loading looks exactly
 *       like the outage this replaced.
 *   3 · No committed font file is orphaned — dead weight in the repo that
 *       nobody notices because nothing breaks.
 *
 * Exits non-zero on any violation. Run: node scripts/lint-fonts-are-local.mjs
 */
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

/** Every .ts/.tsx under app/, components/ and lib/. */
function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === '.next') continue;
      walk(p, out);
    } else if (/\.tsx?$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = [
  ...walk(join(WEB, 'app')),
  ...walk(join(WEB, 'components')),
  ...walk(join(WEB, 'lib')),
];

// ── 1 · nobody imports next/font/google ──────────────────────────────────
// Comments are stripped first so the explanatory notes in layout.tsx (which
// necessarily NAME the thing they replaced) cannot trip their own guard.
const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

for (const f of files) {
  const src = strip(readFileSync(f, 'utf8'));
  if (/from\s+['"]next\/font\/google['"]/.test(src)) {
    problems.push(
      `${relative(WEB, f)} imports next/font/google — the build would fetch ` +
        `from fonts.gstatic.com again. Add the face to scripts/fetch-brand-fonts.mjs, ` +
        `run it, and load it with next/font/local.`,
    );
  }
}

// ── 2 · every declared src path exists ───────────────────────────────────
let declared = 0;
const referenced = new Set();
for (const f of files) {
  const src = readFileSync(f, 'utf8');
  if (!src.includes('localFont(')) continue;
  for (const m of src.matchAll(/path:\s*'(\.[^']+)'/g)) {
    declared++;
    const abs = resolve(dirname(f), m[1]);
    referenced.add(abs);
    if (!existsSync(abs)) {
      problems.push(`${relative(WEB, f)}: font file not found — ${m[1]}`);
    }
  }
}

if (declared === 0) {
  problems.push(
    'No localFont src paths found at all. Either the fonts were removed or ' +
      'this guard stopped matching — both need a look, because a guard that ' +
      'silently checks nothing reads exactly like a passing one.',
  );
}

// ── 3 · no orphaned font files ───────────────────────────────────────────
const fontsDir = join(WEB, 'app', '_fonts');
if (existsSync(fontsDir)) {
  const onDisk = [];
  (function collect(d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) collect(p);
      else if (e.name.endsWith('.woff2')) onDisk.push(p);
    }
  })(fontsDir);
  for (const p of onDisk) {
    if (!referenced.has(p)) {
      problems.push(`${relative(WEB, p)} is committed but referenced by nothing.`);
    }
  }
  const tiny = onDisk.filter((p) => statSync(p).size < 1000);
  for (const p of tiny) {
    problems.push(`${relative(WEB, p)} is ${statSync(p).size}B — not a real font file.`);
  }
}

if (problems.length) {
  console.error('❌ Font guard failed:\n');
  for (const p of problems) console.error(`   • ${p}`);
  console.error('');
  process.exit(1);
}

console.log(
  `✅ fonts are local — ${declared} face(s) declared, all present, none orphaned`,
);
