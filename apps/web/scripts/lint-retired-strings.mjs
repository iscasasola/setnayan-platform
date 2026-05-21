#!/usr/bin/env node
/**
 * lint-retired-strings.mjs
 *
 * Fails when retired strings (see ./.retired-strings.json) appear in
 * apps/web/app/**\/*.{tsx,ts,mdx}. Prevents drift treadmill at PR-merge time.
 *
 * Why this exists: 2026-05-22 10-sweep drift audit found 5 new drifts in 4
 * days. Some drifts were stale strings (Pareto + Custom Monogram Pack listed
 * on /features 8 days after their retirement). This guard stops the bleeding
 * at source.
 *
 * Background:
 *   - CLAUDE.md decision log rows 423 (Pamahiya retired), 2026-05-14 (CMP →
 *     Bespoke Monogram), 2026-05-17 (Pareto never shipped), 2026-05-18 (/apply
 *     route doesn't exist).
 *   - Sweep 5 of 2026-05-22 audit.
 *
 * Usage:
 *   pnpm lint:retired         # from apps/web
 *   node scripts/lint-retired-strings.mjs
 *
 * Extension: add a new entry to .retired-strings.json. No code change needed.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');
const CONFIG_PATH = join(WEB_ROOT, '.retired-strings.json');
const SCAN_ROOT = join(WEB_ROOT, 'app');

const SCAN_EXTENSIONS = new Set(['.tsx', '.ts', '.mdx']);

// Files that are allowed to reference retired strings even inside apps/web/app.
// Most retirement-related fixtures live in apps/web/lib (e.g. sku-catalog.ts
// keeps a RETIRED_SKU_CODES set), which is naturally outside SCAN_ROOT — but
// CHANGELOG / decision-log style files inside app/ should be exempt too.
const GLOBAL_ALLOW_PATTERNS = [
  /\/CHANGELOG/i,
  /\.retired-strings\./, // the config + this lint script's own test fixtures
  /\bRETIRED_/, // explicit retirement registries / test fixtures
];

function loadConfig() {
  try {
    const raw = readFileSync(CONFIG_PATH, 'utf8');
    const config = JSON.parse(raw);
    if (!Array.isArray(config.retired_strings)) {
      throw new Error('retired_strings must be an array');
    }
    for (const entry of config.retired_strings) {
      if (typeof entry.pattern !== 'string' || entry.pattern.length === 0) {
        throw new Error(`Invalid entry: ${JSON.stringify(entry)} — pattern must be a non-empty string`);
      }
    }
    return config;
  } catch (err) {
    console.error(`error: failed to load ${CONFIG_PATH}: ${err.message}`);
    process.exit(2);
  }
}

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
      // Skip node_modules / .next / build artifacts if they ever end up here.
      if (name === 'node_modules' || name === '.next' || name === 'dist') continue;
      yield* walk(full);
    } else if (st.isFile()) {
      const dotIndex = name.lastIndexOf('.');
      if (dotIndex === -1) continue;
      const ext = name.slice(dotIndex);
      if (SCAN_EXTENSIONS.has(ext)) yield full;
    }
  }
}

function isGloballyAllowed(filePath) {
  const rel = relative(REPO_ROOT, filePath).split(sep).join('/');
  return GLOBAL_ALLOW_PATTERNS.some((re) => re.test(rel));
}

function isPerPatternAllowed(filePath, allowPaths) {
  if (!Array.isArray(allowPaths) || allowPaths.length === 0) return false;
  const rel = relative(REPO_ROOT, filePath).split(sep).join('/');
  return allowPaths.some((p) => rel === p || rel.startsWith(p.replace(/\/$/, '') + '/'));
}

function findOccurrences(content, pattern) {
  const hits = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let from = 0;
    while (true) {
      const idx = line.indexOf(pattern, from);
      if (idx === -1) break;
      hits.push({ lineNumber: i + 1, column: idx + 1, snippet: line.trim() });
      from = idx + pattern.length;
    }
  }
  return hits;
}

function main() {
  const config = loadConfig();
  const violations = [];
  let filesScanned = 0;

  for (const file of walk(SCAN_ROOT)) {
    if (isGloballyAllowed(file)) continue;
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    filesScanned++;
    for (const entry of config.retired_strings) {
      if (isPerPatternAllowed(file, entry.allow_paths)) continue;
      const hits = findOccurrences(content, entry.pattern);
      for (const hit of hits) {
        violations.push({
          file,
          ...hit,
          pattern: entry.pattern,
          retired_at: entry.retired_at,
          reason: entry.reason,
        });
      }
    }
  }

  if (violations.length === 0) {
    console.log(`OK · scanned ${filesScanned} files under apps/web/app · 0 retired strings`);
    process.exit(0);
  }

  // Group by file for readable output. GitHub Actions annotations use the
  // "::error file=...,line=..." format so violations show inline on the PR.
  const inCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  console.error(`\nFAIL · ${violations.length} retired-string violation(s) in apps/web/app:\n`);
  for (const v of violations) {
    const rel = relative(REPO_ROOT, v.file).split(sep).join('/');
    console.error(`  ${rel}:${v.lineNumber}:${v.column}`);
    console.error(`    pattern : "${v.pattern}"  (retired ${v.retired_at})`);
    console.error(`    reason  : ${v.reason}`);
    console.error(`    snippet : ${v.snippet}`);
    console.error('');
    if (inCI) {
      const msg = `Retired string "${v.pattern}" (retired ${v.retired_at}). ${v.reason}`;
      console.log(`::error file=${rel},line=${v.lineNumber},col=${v.column}::${msg}`);
    }
  }
  console.error('How to fix:');
  console.error('  1. Replace the retired string with the canonical replacement (see reason).');
  console.error('  2. If this surface legitimately needs the string (e.g. retirement registry), add the file path to allow_paths in apps/web/.retired-strings.json.');
  console.error('  3. To retire a new string, append an entry to apps/web/.retired-strings.json — no code change needed.');
  process.exit(1);
}

main();
