#!/usr/bin/env node
/**
 * lint-raw-colour.mjs — NO NEW RAW COLOUR. A colour is named by its JOB (a role in app/theme.css),
 * never by its hue.
 *
 * WHY (owner, 2026-10-26, approving the brand refresh): "if we choose a different color or icon or
 * font, it will be easy to make the whole app to look differently." That is only true while every
 * colour on Setnayan's own screens reads a ROLE token (`bg-page`, `text-muted`, `bg-primary` …),
 * because then app/theme.css is the one file that restyles the app. A component that writes
 * `#C24E25`, `bg-terracotta`, `text-ink/55` or `bg-emerald-50` has opted out of that file: the next
 * restyle has to find it by hand. Plan: corpus prototypes/brand_refresh_2026-10-26/before_after.html
 * §1a ("Guard: scripts/lint-raw-colour.mjs").
 *
 * ── WHAT COUNTS AS RAW (per file, comments stripped first) ─────────────────
 *   · a hex literal                    `#fff` `#C24E25` `#11111180`
 *   · a numeric colour function        `rgb(255 0 0)` `rgba(30,26,18,.12)` `hsl(…)`
 *     (`rgb(var(--role-…))` is NOT raw — it reads a token)
 *   · a custom property set to an `R G B` triple  `--color-cream: 255 255 255;` (the shape every
 *     Tailwind-backed token takes — a value that belongs in app/theme.css)
 *   · a Tailwind colour utility (bg/text/border/ring/fill/stroke/from/via/to/divide/outline/
 *     decoration/placeholder/caret/accent/shadow) whose colour is NOT a role: the legacy colour
 *     words (cream · paper · terracotta · mulberry · burgundy · gold · champagne · sage · ink-soft ·
 *     accent* · surface-soft · raised · sn-accent · gild · veil · candle · link-600 …), every
 *     numbered ramp step (`success-100`, `warn-600`), white/black, and the stock Tailwind palette
 *     (emerald · amber · rose · slate · gray · stone · red …).
 *   · a ROLE with an opacity modifier — `text-ink/55`, `bg-primary/10`. An alpha wash derived from a
 *     brand colour changes meaning whenever the brand colour does (the Pricing band
 *     `bg-terracotta/[0.07]` is a warm whisper on gold and a grey on ink), so the role set names
 *     its washes outright (`surface-2`, `selected-soft`, `*-wash`) and a slash is raw.
 * `@apply` lines in stylesheets are read with the same class matcher.
 *
 * ── WHERE (Setnayan's own screens) ─────────────────────────────────────────
 * `.ts` `.tsx` `.css` under app/ components/ lib/, tests excluded. NOT scanned — owner scope, plan
 * §1a "Separation from the Event Hub" — the guest Event Hub and the couple-chosen looks, which own
 * their colours per event: app/[slug]/** (incl. _lib/pro-site-vars.ts), app/api/og/** (the hub's
 * link-preview cards; an ImageResponse cannot read a CSS variable), lib/*-themes.ts,
 * lib/hub-theme-*.ts. And app/theme.css itself — the one place a value is allowed.
 * A line carrying `raw-colour-ok: <why>` is not counted (a colour that is DATA, say).
 *
 * ── A RATCHET, NOT A BAN ────────────────────────────────────────────────────
 * Today's uses are frozen per file in scripts/raw-colour.baseline.txt. A file's count may FALL,
 * never rise; a file not listed may hold none. The area batches (plan steps 5–14) lower it and run
 * `--update-baseline` in the same PR to lock the gain in. Regenerate, never hand-merge.
 *
 * Usage (from apps/web):
 *   node scripts/lint-raw-colour.mjs
 *   node scripts/lint-raw-colour.mjs --update-baseline
 *   node scripts/lint-raw-colour.mjs --top 20        the heaviest files, for planning a batch
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './port-controls.mjs';
import { stripCssComments } from './strip-css-comments.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = resolve(HERE, '..');
export const BASELINE_PATH = join(HERE, 'raw-colour.baseline.txt');

const SCAN_DIRS = ['app', 'components', 'lib'];
const EXTENSIONS = ['.tsx', '.ts', '.css'];
const INLINE_OK = 'raw-colour-ok';
/** Below this the walk has gone blind and every file would "pass". */
export const MIN_FILES = 3000;

/** Paths (relative to apps/web, `/`-separated) that own their colours — see the docblock. */
export const NOT_SCANNED = [
  /^app\/\[slug\]\//,
  /^app\/api\/og\//,
  /^lib\/[^/]*-themes\.ts$/,
  /^lib\/hub-theme-[^/]*\.ts$/,
  /^app\/theme\.css$/,
  // The Mood Board's colour VOCABULARY — names for the colours a couple picks (data, not styling).
  /^lib\/color-vocabulary\.generated\.ts$/,
  /^lib\/color-names\.ts$/,
];

/** The roles of app/theme.css, as Tailwind colour names. Allowed bare; raw with `/alpha`. */
export const ROLES = new Set([
  'page', 'surface', 'surface-2', 'ink', 'muted', 'line', 'primary', 'on-primary', 'link',
  'selected', 'selected-soft', 'badge', 'badge-ink', 'success', 'success-wash', 'warning',
  'warning-wash', 'danger', 'danger-wash', 'info', 'info-wash', 'focus', 'masthead', 'masthead-ink',
]);

/** Colour families that are NOT roles: the legacy words, the ramps, white/black, stock Tailwind. */
const LEGACY_FAMILIES = [
  'cream', 'paper', 'terracotta', 'mulberry', 'burgundy', 'gold', 'champagne', 'sage', 'gild',
  'veil', 'candle', 'ink', 'link', 'accent', 'surface', 'raised', 'success', 'warn', 'danger',
  'info', 'white', 'black',
  'slate', 'gray', 'zinc', 'neutral', 'stone', 'red', 'orange', 'amber', 'yellow', 'lime', 'green',
  'emerald', 'teal', 'cyan', 'sky', 'blue', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose',
];
/** `sn` is a family only for these two (`shadow-sn-md`, `z-sn-nav` are not colours). */
const SN_COLOURS = new Set(['sn-accent', 'sn-on-accent']);

const HEX = /(?<![\w&#$])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g;
const COLOUR_FN = /\b(?:rgba?|hsla?)\(\s*-?[\d.]/g;
const TRIPLE = /--[\w-]+\s*:\s*\d{1,3}\s+\d{1,3}\s+\d{1,3}(?=\s*(?:;|\}|$|!))/g;
const UTILITY =
  /(?<![\w-])(?:bg|text|border(?:-[xytrblse])?|divide|outline|ring(?:-offset)?|fill|stroke|from|via|to|decoration|placeholder|caret|accent|shadow)-([a-z][a-z0-9]*(?:-[a-z0-9]+)*)(\/(?:\d+(?:\.\d+)?|\[[^\]\s]+\]))?(?![\w-])/g;

/** Is this Tailwind colour name (`ink`, `terracotta-100`, `sn-accent`) a raw colour? null = not a colour. */
export function classifyColour(name, opacity) {
  if (ROLES.has(name)) return opacity ? 'role-alpha' : null;
  if (SN_COLOURS.has(name)) return 'legacy';
  const family = name.split('-')[0];
  return LEGACY_FAMILIES.includes(family) ? 'legacy' : null;
}

/** Every raw colour on one (comment-free) line: `[{ kind, text }]`. */
export function rawOnLine(line) {
  const hits = [];
  for (const m of line.matchAll(HEX)) hits.push({ kind: 'hex', text: m[0] });
  for (const m of line.matchAll(COLOUR_FN)) hits.push({ kind: 'fn', text: m[0] });
  for (const m of line.matchAll(TRIPLE)) hits.push({ kind: 'triple', text: m[0] });
  for (const m of line.matchAll(UTILITY)) {
    const kind = classifyColour(m[1], m[2]);
    if (kind) hits.push({ kind, text: m[0] });
  }
  return hits;
}

/** Every raw colour in one file's source: `[{ lineNumber, text, hits }]`. */
export function rawLines(source, file = 'x.tsx') {
  const raw = source.split('\n');
  const lines = (file.endsWith('.css') ? stripCssComments(source) : stripComments(source)).split('\n');
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    if (raw[i] && raw[i].includes(INLINE_OK)) continue;
    const hits = rawOnLine(lines[i]);
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
      const found = rawLines(readFileSync(file, 'utf8'), file);
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
    '# lint:raw-colour baseline — raw colours per file on Setnayan\'s own screens (hex, rgb()/hsl()',
    '# literals, `--x: R G B` triples, colour-word / palette / ramp Tailwind classes, and roles with an /alpha). GENERATED —',
    '# never hand-edit:   node apps/web/scripts/lint-raw-colour.mjs --update-baseline',
    '# A RATCHET: a count may fall, never rise; a file not listed may hold none.',
    `# ${rows.length} files · ${total} raw colours`,
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
    console.error(`FAIL · lint:raw-colour scanned only ${files} files (expected ≥ ${MIN_FILES}) — the walk has gone blind.`);
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
    console.log(`baseline updated · ${Object.keys(counts).length} files · ${total} raw colours`);
    process.exit(0);
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error('FAIL · scripts/raw-colour.baseline.txt is missing. Run: node scripts/lint-raw-colour.mjs --update-baseline');
    process.exit(1);
  }
  const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
  const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
  if (baseTotal > 0 && total === 0) {
    console.error('FAIL · lint:raw-colour found ZERO raw colours against a non-empty baseline — the matcher has gone blind.');
    process.exit(1);
  }

  const violations = compare(counts, baseline);
  if (violations.length === 0) {
    const lower = Object.entries(baseline).filter(([rel, n]) => (counts[rel] ?? 0) < n).length;
    console.log(`OK · lint:raw-colour · ${files} files · ${total} raw colours, none above baseline (${baseTotal}).`);
    if (lower) console.log(`   ${lower} file(s) are BELOW baseline — run --update-baseline to lock the gain in.`);
    process.exit(0);
  }

  const inCI = process.env.GITHUB_ACTIONS === 'true';
  console.error(`\nFAIL · lint:raw-colour: ${violations.length} file(s) added a raw colour:\n`);
  for (const v of violations) {
    console.error(`  ${v.rel} — ${v.count} raw colour(s), baseline allows ${v.allowed}`);
    for (const h of hits[v.rel]) {
      const what = h.hits.map((x) => x.text).join(' · ');
      console.error(`    :${h.lineNumber}  ${what}`);
      if (inCI) {
        console.log(
          `::error file=${v.rel},line=${h.lineNumber}::Raw colour (${what}). Name the colour by its job — a role from app/theme.css (bg-page, text-muted, bg-primary, border-line …).`,
        );
      }
    }
    console.error('');
  }
  console.error('How to fix:');
  console.error('  1. Use a ROLE (app/theme.css / tailwind.config.ts): page · surface · surface-2 · ink · muted ·');
  console.error('     line · primary · on-primary · link · selected · selected-soft · badge · badge-ink ·');
  console.error('     success · warning · danger · info (+ -wash) · focus · masthead (+ -ink).');
  console.error('     `text-ink/55` → `text-muted`; `bg-cream` → `bg-page`; `bg-mulberry` → `bg-primary`.');
  console.error('  2. No role fits? Add one to app/theme.css (Light + Dark) and tailwind.config.ts — never a hex.');
  console.error('  3. A colour that is DATA (a couple\'s palette swatch): `// raw-colour-ok: <why>` on that line.');
  console.error('  4. Never raise the baseline to go green. It is regenerated only to LOWER counts.');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
