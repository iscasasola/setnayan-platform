#!/usr/bin/env node
/**
 * lint-icon-source.mjs — ONE FILE IMPORTS ICONS: app/_components/icon/icon-map.ts.
 *
 * WHY (owner, 2026-10-26, approving the brand refresh): "if we choose a different color or icon or
 * font, it will be easy to make the whole app to look differently." Switching icon sets is an edit
 * to icon-map.ts ONLY while nothing else imports an icon library. Measured on the plan (corpus
 * prototypes/brand_refresh_2026-10-26/before_after.html §1c): lucide-react was imported by 1,144
 * files naming 447 distinct icons — a set swap would have meant 1,144 edits. New code asks for an
 * icon by its job: `<Icon name="guests" />` (app/_components/icon/icon.tsx).
 *
 * ── WHAT COUNTS (per file, comments stripped first) ─────────────────────────
 * Every name imported from `lucide-react` or `@carbon/icons-react` (any subpath) — value or type,
 * named, default or namespace, `export … from`, `import()` and `require()`. A file's count is the
 * number of such names, so adding a NEW icon to a baselined file fails too.
 *
 * ── WHERE ───────────────────────────────────────────────────────────────────
 * `.ts` `.tsx` under app/ components/ lib/, tests excluded. Allowed: app/_components/icon/icon-map.ts
 * (the one file). NOT scanned: the guest Event Hub `app/[slug]/**` — owner scope, it owns its own
 * icons. A line carrying `icon-source-ok: <why>` is not counted.
 *
 * ── A RATCHET, NOT A BAN ────────────────────────────────────────────────────
 * Today's importers are frozen per file in scripts/icon-source.baseline.txt; a count may fall, never
 * rise; a file not listed may import none. The area batches (plan steps 5–14) move call sites onto
 * <Icon> and run `--update-baseline` to lock the gain in. lint-nav-icon-source.mjs (the registry
 * guard) is extended, not replaced — it pins that the registry reads through the map.
 *
 * Usage (from apps/web):
 *   node scripts/lint-icon-source.mjs
 *   node scripts/lint-icon-source.mjs --update-baseline
 *   node scripts/lint-icon-source.mjs --top 20
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './port-controls.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const WEB_ROOT = resolve(HERE, '..');
export const BASELINE_PATH = join(HERE, 'icon-source.baseline.txt');

const SCAN_DIRS = ['app', 'components', 'lib'];
const EXTENSIONS = ['.tsx', '.ts'];
const INLINE_OK = 'icon-source-ok';
/** Below this the walk has gone blind and every file would "pass". */
export const MIN_FILES = 3000;

/** The one file allowed to import an icon library (relative to apps/web). */
export const THE_MAP = 'app/_components/icon/icon-map.ts';
export const NOT_SCANNED = [/^app\/\[slug\]\//, /^app\/_components\/icon\/icon-map\.ts$/];

const LIB = String.raw`(?:lucide-react|@carbon\/icons-react)(?:\/[^'"\x60]*)?`;
const STATIC = new RegExp(String.raw`\b(?:import|export)\s+((?:(?!\bimport\b|\bexport\b)[^;])*?)\s*\bfrom\s*['"]${LIB}['"]`, 'g');
const DYNAMIC = new RegExp(String.raw`\b(?:import|require)\s*\(\s*['"]${LIB}['"]\s*\)`, 'g');

/** How many names one import/export clause brings in: `{ A, B as C }` → 2, `* as L` → 1, `X, { Y }` → 2. */
export function namesIn(clause) {
  let c = clause.replace(/^type\s+/, '').trim();
  let n = 0;
  const braces = c.match(/\{([^}]*)\}/);
  if (braces) {
    n += braces[1].split(',').map((x) => x.trim()).filter(Boolean).length;
    c = c.replace(braces[0], '');
  }
  c = c.replace(/,/g, ' ').trim();
  if (/\*\s*as\s+[\w$]+/.test(c)) {
    n += 1;
    c = c.replace(/\*\s*as\s+[\w$]+/, '').trim();
  }
  if (c) n += c.split(/\s+/).filter(Boolean).length; // a default import, or a bare `*`
  return Math.max(n, 1);
}

/** Every icon-library import in one file's source: `[{ lineNumber, text, names }]`. */
export function iconImports(source) {
  const raw = source.split('\n');
  const code = stripComments(source);
  const lineOf = (idx) => code.slice(0, idx).split('\n').length;
  const out = [];
  for (const m of code.matchAll(STATIC)) {
    const lineNumber = lineOf(m.index + m[0].length);
    if ((raw[lineNumber - 1] ?? '').includes(INLINE_OK)) continue;
    out.push({ lineNumber, text: (raw[lineNumber - 1] ?? '').trim(), names: namesIn(m[1]) });
  }
  for (const m of code.matchAll(DYNAMIC)) {
    const lineNumber = lineOf(m.index);
    if ((raw[lineNumber - 1] ?? '').includes(INLINE_OK)) continue;
    out.push({ lineNumber, text: (raw[lineNumber - 1] ?? '').trim(), names: 1 });
  }
  return out;
}

export const countOf = (found) => found.reduce((s, l) => s + l.names, 0);

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

/** Scan the tree: `{ files, counts: { 'apps/web/…': n }, hits, mapImports }`. */
export function scan(webRoot = WEB_ROOT) {
  const repoRoot = resolve(webRoot, '..', '..');
  let files = 0;
  const counts = {};
  const hits = {};
  let mapImports = 0;
  for (const d of SCAN_DIRS) {
    const abs = join(webRoot, d);
    if (!existsSync(abs)) continue;
    for (const file of walk(abs)) {
      const fromWeb = relative(webRoot, file).split(sep).join('/');
      if (fromWeb === THE_MAP) {
        mapImports = countOf(iconImports(readFileSync(file, 'utf8')));
        continue;
      }
      if (NOT_SCANNED.some((re) => re.test(fromWeb))) continue;
      files++;
      const found = iconImports(readFileSync(file, 'utf8'));
      const n = countOf(found);
      if (n) {
        const rel = relative(repoRoot, file).split(sep).join('/');
        counts[rel] = n;
        hits[rel] = found;
      }
    }
  }
  return { files, counts, hits, mapImports };
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
    '# lint:icon-source baseline — names imported from lucide-react / @carbon/icons-react per file,',
    '# outside app/_components/icon/icon-map.ts. GENERATED — never hand-edit:',
    '#   node apps/web/scripts/lint-icon-source.mjs --update-baseline',
    '# A RATCHET: a count may fall, never rise; a file not listed may import none.',
    `# ${rows.length} files · ${total} imported icon names`,
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
  const { files, counts, hits, mapImports } = scan();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  if (files < MIN_FILES) {
    console.error(`FAIL · lint:icon-source scanned only ${files} files (expected ≥ ${MIN_FILES}) — the walk has gone blind.`);
    process.exit(1);
  }
  if (mapImports === 0) {
    console.error(`FAIL · lint:icon-source read no icon import in ${THE_MAP} — the map moved or the matcher has gone blind.`);
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
    console.log(`baseline updated · ${Object.keys(counts).length} files · ${total} imported icon names`);
    process.exit(0);
  }

  if (!existsSync(BASELINE_PATH)) {
    console.error('FAIL · scripts/icon-source.baseline.txt is missing. Run: node scripts/lint-icon-source.mjs --update-baseline');
    process.exit(1);
  }
  const baseline = parseBaseline(readFileSync(BASELINE_PATH, 'utf8'));
  const baseTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
  if (baseTotal > 0 && total === 0) {
    console.error('FAIL · lint:icon-source found ZERO icon imports against a non-empty baseline — the matcher has gone blind.');
    process.exit(1);
  }

  const violations = compare(counts, baseline);
  if (violations.length === 0) {
    const lower = Object.entries(baseline).filter(([rel, n]) => (counts[rel] ?? 0) < n).length;
    console.log(`OK · lint:icon-source · ${files} files · ${Object.keys(counts).length} importers / ${total} icon names outside the map, none above baseline (${baseTotal}).`);
    if (lower) console.log(`   ${lower} file(s) are BELOW baseline — run --update-baseline to lock the gain in.`);
    process.exit(0);
  }

  const inCI = process.env.GITHUB_ACTIONS === 'true';
  console.error(`\nFAIL · lint:icon-source: ${violations.length} file(s) import an icon library outside ${THE_MAP}:\n`);
  for (const v of violations) {
    console.error(`  ${v.rel} — ${v.count} icon name(s), baseline allows ${v.allowed}`);
    for (const h of hits[v.rel]) {
      console.error(`    :${h.lineNumber}  ${h.text.slice(0, 110)}`);
      if (inCI) {
        console.log(`::error file=${v.rel},line=${h.lineNumber}::Icon imported outside the icon map. Use <Icon name="…" /> (app/_components/icon/icon.tsx).`);
      }
    }
    console.error('');
  }
  console.error('How to fix:');
  console.error('  1. `<Icon name="guests" size={20} />` from app/_components/icon/icon.tsx — a role from icon-map.ts ICONS.');
  console.error('  2. No role fits? Add one to ICONS in icon-map.ts (and its glyph to GLYPHS if new) — never import lucide-react elsewhere.');
  console.error('  3. Never raise the baseline to go green. It is regenerated only to LOWER counts.');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
