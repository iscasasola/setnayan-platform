#!/usr/bin/env node
/**
 * lint-guest-legibility.mjs
 *
 * Guardrail for the Guest Legibility Floor
 * (02_Specifications/Guest_Legibility_Floor_2026-06-20.md). Born from the
 * 2026-06-20 "Lola Remedios" audit, where the dominant failure was load-bearing
 * guest-facing text rendered at 7–11px — illegible to an older guest. PR #1872
 * (veil) + #1873 (HIGH fixes) cleaned the worst; this stops it coming back.
 *
 * WHAT IT FLAGS: any `text-[Npx]` with N <= 11 in guest-facing source. (12px /
 * `text-xs` and up pass — that's the accepted floor for small brand eyebrows;
 * pixel-literals below it are the smell.) Tailwind-class only — server-rendered
 * email inline styles are out of scope.
 *
 * RATCHETING BASELINE: the codebase still carries a tail of decorative tiny-text
 * (the audit's MED/LOW items). Rather than block on fixing all of them at once,
 * we snapshot the CURRENT per-file count into `.guest-legibility-baseline.json`.
 * The guard fails only when a file's tiny-text count *exceeds* its baseline —
 * i.e. on NEW regressions. Pass-B fixes lower the counts; the baseline only ever
 * ratchets DOWN. To intentionally change counts (after a real fix, or a reviewed
 * new decorative use), run `pnpm lint:legibility -- --update-baseline` and commit
 * the diff so the change is visible in review.
 *
 * Usage:
 *   pnpm lint:legibility                    # from apps/web
 *   node scripts/lint-guest-legibility.mjs
 *   node scripts/lint-guest-legibility.mjs --update-baseline
 *
 * Scope: extend SCAN_DIRS / EXTRA_FILES below as more guest surfaces land.
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');
const BASELINE_PATH = join(WEB_ROOT, '.guest-legibility-baseline.json');

// Guest-facing trees (relative to apps/web). Everything a guest touches cold:
// the personal site / Save-the-Date / day-of (`app/[slug]`) and the QR
// join/claim flow (`app/join`). [slug]/_components is covered by the [slug] walk.
const SCAN_DIRS = ['app/[slug]', 'app/join'];
// Guest-facing components that live in the SHARED tree (not under [slug]).
const EXTRA_FILES = ['app/_components/save-photo-button.tsx', 'app/_components/wayfinding-map.tsx'];

const SCAN_EXTENSIONS = new Set(['.tsx', '.ts']);
const MAX_PX = 11; // flag text-[<=11px]; 12px / text-xs and up are allowed
const SIZE_RE = /text-\[(\d+)px\]/g;
// A line carrying this marker is exempt (genuinely decorative, reviewer-approved).
const INLINE_OK = 'legibility-ok';

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const full = join(dir, name);
    let st;
    try {
      st = statSync(full);
    } catch {
      continue;
    }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
      yield* walk(full);
    } else if (st.isFile()) {
      const dot = name.lastIndexOf('.');
      if (dot !== -1 && SCAN_EXTENSIONS.has(name.slice(dot))) yield full;
    }
  }
}

function fileList() {
  const files = [];
  for (const d of SCAN_DIRS) {
    const abs = join(WEB_ROOT, d);
    if (existsSync(abs)) files.push(...walk(abs));
  }
  for (const f of EXTRA_FILES) {
    const abs = join(WEB_ROOT, f);
    if (existsSync(abs)) files.push(abs);
  }
  return files;
}

function relOf(file) {
  return relative(REPO_ROOT, file).split(sep).join('/');
}

// Returns { count, hits: [{lineNumber, px, snippet}] } for one file.
function scanFile(file) {
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    return { count: 0, hits: [] };
  }
  const hits = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.includes(INLINE_OK)) continue;
    SIZE_RE.lastIndex = 0;
    let m;
    while ((m = SIZE_RE.exec(line)) !== null) {
      const px = Number(m[1]);
      if (px <= MAX_PX) hits.push({ lineNumber: i + 1, px, snippet: line.trim() });
    }
  }
  return { count: hits.length, hits };
}

function loadBaseline() {
  try {
    return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function main() {
  const update = process.argv.includes('--update-baseline');
  const files = fileList();

  const counts = {};
  const hitsByFile = {};
  for (const file of files) {
    const { count, hits } = scanFile(file);
    if (count > 0) {
      const rel = relOf(file);
      counts[rel] = count;
      hitsByFile[rel] = hits;
    }
  }

  if (update) {
    const sorted = Object.fromEntries(Object.entries(counts).sort(([a], [b]) => a.localeCompare(b)));
    writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`baseline updated · ${Object.keys(sorted).length} files · ${total} allowed text-[<=${MAX_PX}px] occurrences`);
    process.exit(0);
  }

  const baseline = loadBaseline();
  const violations = [];
  for (const [rel, count] of Object.entries(counts)) {
    const allowed = baseline[rel] ?? 0;
    if (count > allowed) {
      violations.push({ rel, count, allowed, hits: hitsByFile[rel] });
    }
  }

  // Also flag stale baseline entries that are now over-counted (a file dropped
  // below its baseline is FINE — ratchet down; we don't fail on that, but we
  // can't auto-lower it here). Nothing to do; the ratchet is one-directional.

  const filesScanned = files.length;
  if (violations.length === 0) {
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(
      `OK · scanned ${filesScanned} guest-facing files · ${total} text-[<=${MAX_PX}px] occurrence(s), all within baseline`,
    );
    process.exit(0);
  }

  const inCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
  console.error(`\nFAIL · guest-legibility: ${violations.length} file(s) introduced new tiny text (text-[<=${MAX_PX}px]):\n`);
  for (const v of violations) {
    console.error(`  ${v.rel} — ${v.count} occurrence(s), baseline allows ${v.allowed}`);
    // Show the offending lines beyond the baseline budget.
    for (const hit of v.hits) {
      console.error(`    :${hit.lineNumber}  text-[${hit.px}px]  ${hit.snippet.slice(0, 100)}`);
      if (inCI) {
        console.log(
          `::error file=${v.rel},line=${hit.lineNumber}::Guest-facing text-[${hit.px}px] is below the legibility floor (>=14px for jobs; 12px/text-xs for small labels). See Guest_Legibility_Floor_2026-06-20.md.`,
        );
      }
    }
    console.error('');
  }
  console.error('How to fix:');
  console.error('  1. Raise the size — actionable text >=14px (text-sm+), small labels >=12px (text-xs).');
  console.error('  2. For a genuinely decorative case, add a `legibility-ok` comment on that line.');
  console.error('  3. After a legit change, run `pnpm lint:legibility -- --update-baseline` and commit the baseline diff.');
  process.exit(1);
}

main();
