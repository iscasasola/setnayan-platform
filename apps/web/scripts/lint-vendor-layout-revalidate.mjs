#!/usr/bin/env node
/**
 * lint-vendor-layout-revalidate.mjs
 *
 * Protects the vendor-dashboard layout from being silently re-inflated.
 *
 * WHY THIS EXISTS: 2026-07-01 perf work (PRs #2529 / #2533 / #2543 / #2546)
 * made the vendor layout cheap — it re-renders server-side on every navigation
 * (it reads cookies), so the whole chrome data chain runs each time. The one
 * change that quietly undoes that win is a broad, layout-wide cache bust that
 * targets the vendor layout root:
 *
 *     revalidatePath('/vendor-dashboard', 'layout')   // busts the whole subtree
 *     revalidatePath('/', 'layout')                   // busts EVERYTHING (incl. it)
 *
 * A page-scoped `revalidatePath('/vendor-dashboard')` (default 'page' mode) is
 * fine — it refreshes just that page. It's the SECOND argument `'layout'` on the
 * root path that defeats the client Router-Cache window (staleTimes.dynamic=60)
 * for the entire vendor subtree, so every subsequent navigation refetches. A
 * one-line `revalidatePath(..., 'layout')` is easy to miss in a big diff; this
 * guard catches it every time.
 *
 * NOT flagged (correctly out of scope):
 *   - revalidatePath('/vendor-dashboard')                     // page mode — fine
 *   - revalidatePath('/vendor-dashboard/clients/${id}', 'layout')  // deeper sub-layout, not the root chrome
 *   - revalidatePath('/dashboard', 'layout')                  // customer doorway, different layout
 *
 * RATCHETING BASELINE: the tree already has a few INTENTIONAL, low-frequency
 * admin uses (an admin pricing edit must bust the vendor layout so vendors see
 * new prices; a global-settings change nukes all caches). Those are recorded in
 * BASELINE below as a per-file allowed count. The guard fails only when a file
 * exceeds its baseline (new drift) or a NEW file introduces the pattern. To add
 * a legitimate new use, bump/extend BASELINE in the SAME PR — that makes the
 * reviewer see it explicitly.
 *
 * Usage:
 *   pnpm lint:vendor-layout      # from apps/web
 *   node scripts/lint-vendor-layout-revalidate.mjs
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve, dirname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const REPO_ROOT = resolve(WEB_ROOT, '..', '..');
const SCAN_ROOTS = [join(WEB_ROOT, 'app'), join(WEB_ROOT, 'lib')];
const SCAN_EXTENSIONS = new Set(['.ts', '.tsx']);

// Matches revalidatePath(<'/' | '/vendor-dashboard' [/]>, '<layout>') with any
// quote style (' " `) and arbitrary whitespace/newlines between the arguments.
// The path must END at the root or the vendor-dashboard root — a deeper path
// (…/clients/xyz) won't match because the closing quote won't line up.
const BROAD_REVALIDATE =
  /revalidatePath\(\s*(['"`])\/(?:vendor-dashboard\/?)?\1\s*,\s*(['"`])layout\2/g;

// Per-file allowed count of intentional broad busts (repo-relative paths).
// These are admin-triggered, low-frequency, and correct. Bump a count (or add a
// file) ONLY when a new use is genuinely intentional — the diff makes it visible.
const BASELINE = {
  'apps/web/app/admin/settings/actions.ts': 2, // global-settings change → nuke all caches
  'apps/web/app/admin/pricing/actions.ts': 1, // pricing edit → vendors must see new prices
  'apps/web/lib/tour-actions.ts': 2, // guided-tour completion refreshes vendor nav state
};

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
      if (dot === -1) continue;
      if (SCAN_EXTENSIONS.has(name.slice(dot))) yield full;
    }
  }
}

function relPath(file) {
  return relative(REPO_ROOT, file).split(sep).join('/');
}

function findMatches(content) {
  const hits = [];
  BROAD_REVALIDATE.lastIndex = 0;
  let m;
  while ((m = BROAD_REVALIDATE.exec(content)) !== null) {
    const lineNumber = content.slice(0, m.index).split('\n').length;
    const snippet = content.split('\n')[lineNumber - 1]?.trim() ?? m[0];
    hits.push({ lineNumber, snippet });
  }
  return hits;
}

function main() {
  const byFile = new Map(); // relPath -> hits[]
  let filesScanned = 0;
  const seen = new Set();

  for (const root of SCAN_ROOTS) {
    for (const file of walk(root)) {
      if (seen.has(file)) continue;
      seen.add(file);
      let content;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      filesScanned++;
      const hits = findMatches(content);
      if (hits.length > 0) byFile.set(relPath(file), hits);
    }
  }

  const violations = [];
  const staleBaseline = [];

  for (const [rel, hits] of byFile) {
    const allowed = BASELINE[rel] ?? 0;
    if (hits.length > allowed) {
      // Report the hits beyond the baseline (the newest ones by position).
      for (const hit of hits.slice(allowed)) {
        violations.push({ rel, ...hit, allowed, found: hits.length });
      }
    }
  }
  // A baseline that's now HIGHER than reality means the intentional use was
  // removed — surface it so the baseline can be tightened (keeps it honest).
  for (const [rel, allowed] of Object.entries(BASELINE)) {
    const found = byFile.get(rel)?.length ?? 0;
    if (found < allowed) staleBaseline.push({ rel, allowed, found });
  }

  const inCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';

  if (violations.length === 0 && staleBaseline.length === 0) {
    console.log(
      `OK · scanned ${filesScanned} files under apps/web/{app,lib} · no new broad vendor-layout revalidations`,
    );
    process.exit(0);
  }

  if (violations.length > 0) {
    console.error(
      `\nFAIL · ${violations.length} broad vendor-layout revalidation(s) beyond baseline:\n`,
    );
    for (const v of violations) {
      console.error(`  ${v.rel}:${v.lineNumber}`);
      console.error(`    snippet  : ${v.snippet}`);
      console.error(`    baseline : ${v.allowed} allowed in this file, ${v.found} found`);
      console.error('');
      if (inCI) {
        const msg =
          "Broad layout-wide revalidatePath(..., 'layout') re-inflates the vendor " +
          'dashboard layout (defeats the navigation cache). Use page-scoped ' +
          "revalidatePath('/path') instead, or if intentional, bump BASELINE in " +
          'apps/web/scripts/lint-vendor-layout-revalidate.mjs in this PR.';
        console.log(`::error file=${v.rel},line=${v.lineNumber}::${msg}`);
      }
    }
    console.error('How to fix:');
    console.error("  1. Prefer page-scoped revalidatePath('/vendor-dashboard/<page>') (default 'page' mode).");
    console.error("  2. If a broad layout bust is genuinely required, bump the file's count in BASELINE (same PR).");
  }

  if (staleBaseline.length > 0) {
    console.error(`\nNOTE · baseline is now looser than reality — tighten it:\n`);
    for (const s of staleBaseline) {
      console.error(`  ${s.rel}: baseline ${s.allowed}, found ${s.found} → set to ${s.found}`);
    }
  }

  process.exit(1);
}

main();
