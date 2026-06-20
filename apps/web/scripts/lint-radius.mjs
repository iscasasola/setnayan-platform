#!/usr/bin/env node
/**
 * lint-radius.mjs
 *
 * Keeps corner radii on ONE source of truth — the `--m-r-*` token scale in
 * globals.css, surfaced through the Tailwind `rounded-*` classes (wired in
 * tailwind.config.ts). Owner-locked "softer corners / Approach B" 2026-06-20
 * (UI_UX_Polish_Remediation_2026-06-20.md · DECISION_LOG 2026-06-20).
 *
 * Flags the three ad-hoc escapes that let radii drift back to ~15 values:
 *   (1) arbitrary Tailwind radius:  rounded-[12px] / rounded-t-[20px]
 *   (2) CSS single-value px:        border-radius: 12px
 *   (3) inline JSX px literal:      borderRadius: 12   |  borderRadius: '12px'
 *
 * Allowed (NOT flagged): var(--m-r-*), 0 / 0px, percentages (50% circles),
 * multi-value shorthand (`8px 8px 0 0`), and computed expressions.
 *
 * Scope excludes globals.css + tailwind.config.ts (the token home) and the
 * print/doc routes (standalone HTML/PDF that ship without the app's token CSS).
 *
 * ADVISORY by default (exit 0) — set RADIUS_LINT_STRICT=1 to fail the build.
 * Promote to a required check once the count holds at 0 (same path the
 * nav-icon guard took).
 *
 * Usage: node apps/web/scripts/lint-radius.mjs   |   pnpm --filter @setnayan/web lint:radius
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = resolve(__dirname, '..');
const SCAN_ROOTS = [join(WEB_ROOT, 'app'), join(WEB_ROOT, 'components')];

const EXCLUDE_BASENAMES = new Set(['globals.css', 'tailwind.config.ts']);
const isExcluded = (file) =>
  file.includes('/print/') ||
  file.endsWith('/route.ts') ||
  EXCLUDE_BASENAMES.has(file.split('/').pop());

const RULES = [
  { re: /rounded(?:-(?:t|b|l|r|s|e|tl|tr|bl|br|ss|se|es|ee))?-\[\d+px\]/g, msg: 'arbitrary rounded-[Npx]' },
  { re: /border-radius:\s*\d+px(?=\s*(?:;|}|\n|$))/g, msg: 'hardcoded CSS border-radius px' },
  { re: /borderRadius:\s*\d+(?=\s*[,}\n])/g, msg: 'inline borderRadius px literal' },
  { re: /borderRadius:\s*'\d+px'/g, msg: "inline borderRadius '<px>'" },
];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    let st;
    try { st = statSync(full); } catch { continue; }
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === '.next') continue;
      out.push(...walk(full));
    } else if (/\.(tsx|ts|css|jsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const findings = [];
for (const root of SCAN_ROOTS) {
  let files = [];
  try { files = walk(root); } catch { continue; }
  for (const file of files) {
    if (isExcluded(file)) continue;
    const src = readFileSync(file, 'utf8');
    for (const { re, msg } of RULES) {
      const m = src.match(re);
      if (m) findings.push(`${relative(WEB_ROOT, file)}  — ${m.length}× ${msg}  (e.g. ${m[0]})`);
    }
  }
}

const strict = process.env.RADIUS_LINT_STRICT === '1';
if (findings.length === 0) {
  console.log('✅ Radius guard passed — all corners route through --m-r-* tokens.');
  process.exit(0);
}

const banner = strict ? '❌ Radius guard failed' : '⚠️  Radius guard (advisory)';
console.error(`\n${banner} — ${findings.length} ad-hoc radius site(s):\n`);
for (const f of findings) console.error('  • ' + f);
console.error(
  '\n  → use a Tailwind rounded-* class or var(--m-r-*). See ' +
    'UI_UX_Polish_Remediation_2026-06-20.md.\n',
);
process.exit(strict ? 1 : 0);
