#!/usr/bin/env node
/**
 * lint-font-family.mjs — NO NEW NAMED FONT on Setnayan's own screens. A face is a ROLE — `font-ui`
 * or `font-mono` (app/theme.css: `--font-ui` / `--font-ui-mono`) — never a family name.
 *
 * WHY (owner, 2026-10-26, approving the brand refresh): "if we choose a different color or icon or
 * font, it will be easy to make the whole app to look differently." A different font for the whole
 * app is one line in app/theme.css ONLY while nothing names a face of its own. Measured on the plan
 * (corpus prototypes/brand_refresh_2026-10-26/before_after.html §1b): font-serif 229 · font-display
 * 185 · font-pahina 62 · font-sans 59 · explicit faces · 163 arbitrary `font-[…]` / `fontFamily:` —
 * and stylesheets name families outright: the Home countdown numeral `.hc-cd-n` is
 * `font-family: Georgia, "Times New Roman", serif`, which no variable reaches. So this reads `.css`
 * as well as `.ts`/`.tsx`.
 *
 * ── WHAT COUNTS (per file, comments stripped first) ─────────────────────────
 *   · a named face utility — `font-sans` `font-serif` `font-display` `font-pahina` `font-playfair`
 *     `font-caslon` `font-vidaloka` `font-script` `font-condensed` `font-hanken` `font-cinzel` …
 *     (every family key in tailwind.config.ts except the two roles, plus the face names);
 *   · an arbitrary family `font-['Inter']` / `font-[var(--font-x)]` (`font-[550]` is a weight — not counted);
 *   · `fontFamily:` in a style object, and `font-family:` in a stylesheet or a `<style>` string,
 *     unless its value starts with a ROLE: `var(--font-ui`, `var(--font-ui-mono`, `var(--font-mono`
 *     (the mono consumer every scope re-points), or `inherit`;
 *   · a `font:` shorthand that names a family (a quote, a `var(--font-…)` other than a role, or a
 *     generic keyword such as `serif`).
 * Allowed and never counted: `font-ui`, `font-mono`, weights (`font-bold` …), `font-feature-*`.
 *
 * ── WHERE ───────────────────────────────────────────────────────────────────
 * `.ts` `.tsx` `.css` under app/ components/ lib/, tests excluded. NOT scanned (owner scope, plan
 * §1e): the guest Event Hub `app/[slug]/**` and its OG cards `app/api/og/**`, the font files and the
 * Maker's face picker `app/_fonts/**`, the couple-chosen looks `lib/*-themes.ts` and
 * `lib/hub-theme-*.ts`, and app/theme.css itself. A line carrying `font-family-ok: <why>` is not
 * counted (a Maker preview drawing the couple's chosen face, say).
 *
 * ── A RATCHET, NOT A BAN ────────────────────────────────────────────────────
 * Today's uses are frozen per file in scripts/font-family.baseline.txt; a count may fall, never
 * rise; a file not listed may hold none. Regenerate (`--update-baseline`) only to LOWER it.
 *
 * Usage (from apps/web):
 *   node scripts/lint-font-family.mjs
 *   node scripts/lint-font-family.mjs --update-baseline
 *   node scripts/lint-font-family.mjs --top 20
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './port-controls.mjs';
import { stripCssComments } from './strip-css-comments.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = resolve(HERE, '..');
export const BASELINE_PATH = join(HERE, 'font-family.baseline.txt');

const SCAN_DIRS = ['app', 'components', 'lib'];
const EXTENSIONS = ['.tsx', '.ts', '.css'];
const INLINE_OK = 'font-family-ok';
/** Below this the walk has gone blind and every file would "pass". */
export const MIN_FILES = 3000;

export const NOT_SCANNED = [
  /^app\/\[slug\]\//,
  /^app\/api\/og\//,
  /^app\/_fonts\//,
  /^lib\/[^/]*-themes\.ts$/,
  /^lib\/hub-theme-[^/]*\.ts$/,
  /^app\/theme\.css$/,
];

/** Named-face utilities: tailwind.config.ts's family keys other than `ui`/`mono`, plus face names. */
export const NAMED_FACES = [
  'sans', 'serif', 'display', 'pahina', 'playfair', 'caslon', 'vidaloka', 'script', 'condensed',
  'hanken', 'cinzel', 'manrope', 'cormorant', 'fraunces', 'inter', 'georgia',
];
const FACE_CLASS = new RegExp(`(?<![\\w-])font-(?:${NAMED_FACES.join('|')})(?![\\w-])`, 'g');
const ARBITRARY = /(?<![\w-])font-\[(?!\d)[^\]\s]+\]/g;
/** A value that reads a ROLE (or inherits). */
const ROLE_VALUE = /^\s*['"`]?\s*(?:var\(\s*--font-(?:ui|ui-mono|mono)\s*[,)]|inherit\b)/;
const FONT_FAMILY_DECL = /\b(?:fontFamily|font-family)\s*:\s*([^;}\n]*)/g;
const FONT_SHORTHAND = /(?<![\w-])font\s*:\s*([^;}\n]*)/g;
const NAMES_A_FAMILY = /['"]|var\(\s*--font-(?!ui\b|ui-mono\b|mono\b)|\b(?:serif|sans-serif|monospace|cursive|system-ui|ui-sans-serif|ui-serif|ui-monospace)\b/;

/** Every named face on one (comment-free) line: `[text]`. */
export function facesOnLine(line) {
  const hits = [];
  for (const m of line.matchAll(FACE_CLASS)) hits.push(m[0]);
  for (const m of line.matchAll(ARBITRARY)) hits.push(m[0]);
  for (const m of line.matchAll(FONT_FAMILY_DECL)) if (!ROLE_VALUE.test(m[1])) hits.push(m[0].trim());
  for (const m of line.matchAll(FONT_SHORTHAND)) {
    const v = m[1];
    if (/^\s*inherit\b/.test(v)) continue;
    if (NAMES_A_FAMILY.test(v)) hits.push(m[0].trim());
  }
  return hits;
}

/** Every named face in one file's source: `[{ lineNumber, text, hits }]`. */
export function faceLines(source, file = 'x.tsx') {
  const raw = source.split('\n');
  const lines = (file.endsWith('.css') ? stripCssComments(source) : stripComments(source)).split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (raw[i] && raw[i].includes(INLINE_OK)) continue;
    const hits = facesOnLine(lines[i]);
    if (hits.length) out.push({ lineNumber: i + 1, text: (raw[i] ?? '').trim(), hits });
  }
  return out;
}

export const countOf = (found) => found.reduce((s, l) => s + l.hits.length, 0);

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (name === 'node_modules' || name === '.next') continue;
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) yield* walk(full);
    else if (EXTENSIONS.some((e) => name.endsWith(e)) && !/\.test\.tsx?$/.test(name) && !name.endsWith('.d.ts')) yield full;
  }
}

/** Scan the tree: `{ files, counts: { 'apps/web/…': n }, hits }`. */
export function scan(webRoot = WEB_ROOT) {
  const repoRoot = resolve(webRoot, '..', '..');
  let files = 0;
  const counts = {};
  const hits = {};
  for (const d of SCAN_DIRS) {
    const abs = join(webRoot, d);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const fromWeb = relative(webRoot, file).split(sep).join('/');
      if (NOT_SCANNED.some((re) => re.test(fromWeb))) continue;
      files++;
      const found = faceLines(readFileSync(file, 'utf8'), file);
      const n = countOf(found);
      if (n) {
        const rel = relative(repoRoot, file).split(sep).join('/');
        counts[rel] = n;
        hits[rel] = found;
      }
    }
  }
  return { files, counts, hits };
}

/** Baseline file → `{ path: count }`. Lines are `<count> <path>`; `#` is a comment. */
export function parseBaseline(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const m = t.match(/^(\d+)\s+(\S.*)$/);
    if (m) out[m[2]] = Number(m[1]);
  }
  return out;
}

export function formatBaseline(counts) {
  const rows = Object.entries(counts).sort(([a], [b]) => a.localeCompare(b));
  const total = rows.reduce((s, [, n]) => s + n, 0);
  return [
    '# lint:font-family baseline — named faces per file on Setnayan\'s own screens (face utilities,',
    '# font-[…], fontFamily:/font-family:/font: naming a family). GENERATED — never hand-edit:',
    '#   node apps/web/scripts/lint-font-family.mjs --update-baseline',
    '# A RATCHET: a count may fall, never rise; a file not listed may hold none.',
    `# ${rows.length} files · ${total} named faces`,
    ...rows.map(([p, n]) => `${n} ${p}`),
    '',
  ].join('\n');
}

/** Files whose count rose above the baseline (or are new with any). */
export function compare(counts, baseline) {
  const violations = [];
  for (const [rel, count] of Object.entries(counts)) {
    const allowed = baseline[rel] ?? 0;
    if (count > allowed) violations.push({ rel, count, allowed });
  }
  return violations;
}

function main() {
  const argv = process.argv.slice(2);
  const update = argv.includes('--update-baseline');
  const { files, counts, hits } = scan();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (files < MIN_FILES) {
    console.error(`FAIL · lint:font-family scanned only ${files} files (expected ≥ ${MIN_FILES}) — the walk has gone blind.`);
    process.exit(1);
  }

  const topAt = argv.indexOf('--top');
  if (topAt >= 0) {
    const n = Number(argv[topAt + 1]) || 20;
    for (const [rel, c] of Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, n)) console.log(`${String(c).padStart(6)}  ${rel}`);
    process.exit(0);
  }

  if (update) {
    writeFileSync(BASELINE_PATH, formatBaseline(counts));
    console.log(`baseline updated · ${Object.keys(counts).length} files · ${total} named faces`);
    process.exit(0);
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error('FAIL · scripts/font-family.baseline.txt is missing. Run: node scripts/lint-font-family.mjs --update-baseline');
    process.exit(1);
  }
  const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
  const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
  if (baseTotal > 0 && total === 0) {
    console.error('FAIL · lint:font-family found ZERO named faces against a non-empty baseline — the matcher has gone blind.');
    process.exit(1);
  }

  const violations = compare(counts, baseline);
  if (violations.length === 0) {
    const lower = Object.entries(baseline).filter(([rel, n]) => (counts[rel] ?? 0) < n).length;
    console.log(`OK · lint:font-family · ${files} files · ${total} named faces, none above baseline (${baseTotal}).`);
    if (lower) console.log(`   ${lower} file(s) are BELOW baseline — run --update-baseline to lock the gain in.`);
    process.exit(0);
  }

  const inCI = process.env.GITHUB_ACTIONS === 'true';
  console.error(`\nFAIL · lint:font-family: ${violations.length} file(s) added a named font:\n`);
  for (const v of violations) {
    console.error(`  ${v.rel} — ${v.count} named face(s), baseline allows ${v.allowed}`);
    for (const h of hits[v.rel]) {
      const what = h.hits.join(' · ');
      console.error(`    :${h.lineNumber}  ${what}`);
      if (inCI) {
        console.log(
          `::error file=${v.rel},line=${h.lineNumber}::Named font (${what}). Use a font ROLE — font-ui or font-mono (app/theme.css).`,
        );
      }
    }
    console.error('');
  }
  console.error('How to fix:');
  console.error('  1. Use a ROLE: `font-ui` (every app screen) or `font-mono` (IDs, prices, codes).');
  console.error('     In CSS: `font-family: var(--font-ui)` / `var(--font-ui-mono)`.');
  console.error('  2. A Maker preview drawing the couple\'s chosen face: `// font-family-ok: <why>` on that line.');
  console.error('  3. Never raise the baseline to go green. It is regenerated only to LOWER counts.');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
