#!/usr/bin/env node
// feature-register-check — the FEATURE REGISTER is kept true by a check, not by
// memory (Build 6 Lane M; corpus `plans/supplier_build_6_2026-11-10/00-BUILD-6-PLAN.md`).
//
// It FAILS when:
//   • a page route the app serves has no row in FEATURE_REGISTER.md
//     (API routes and the /dev labs are plumbing, not features — skipped by rule)
//   • a catalogue SKU key (platform_retail_catalog_v2.service_code /
//     vendor_billing_catalog.sku_code) has no row
//   • a NEXT_PUBLIC_* setting or feature flag read by the app has no row
//   • a row points at a file or folder that no longer exists
//   • a link on START_HERE.md (the one door to every document) is dead
//
// The register lives in the spec corpus (a separate, private repository), so
// the check runs wherever the corpus is on disk: the controller's Mac
// (`~/Documents/Claude/Projects/Setnayan`), a sibling clone (`../setnayan-specs`),
// or `--corpus <dir>` / $SETNAYAN_SPECS_DIR. Without the corpus it exits 3 and
// says so — it never reports a pass it did not measure.
//
// SKU KEYS come from the live catalogue (SELECT only, scripts/lib/read-only-db.mjs;
// URL from PRICES_DB_URL / SUPABASE_DB_URL / DATABASE_URL, never printed), or
// from `--skus <file>` (one key per line, or a JSON array of keys / rows with a
// `key`). With neither, the SKU row prints SKIPPED — not a pass. Reading keys
// from the migration files was measured and rejected (10 Nov 2026): inserts by
// SELECT, conditional deletes and renames made a static parse miss 25 live keys.
//
// USAGE
//   node scripts/feature-register-check.mjs [--corpus <dir>] [--skus <file>] [--all] [--json]
// Exit: 0 every census item has a row · 1 the register is out of date · 3 no corpus found.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  censusRoutes, censusFlags, checkRegister, formatReport, findCorpus, pointerExists,
} from './lib/feature-register-core.mjs';
import { readRows } from './lib/read-only-db.mjs';

/** Every file name in the corpus (folders .git and node_modules skipped). */
export function basenameIndex(root) {
  const names = new Set();
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      if (e.isDirectory()) walk(path.join(dir, e.name)); else names.add(e.name);
    }
  };
  walk(root);
  return names;
}

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(argv, name) {
  const i = argv.indexOf(name);
  return i >= 0 ? argv[i + 1] : undefined;
}

/** Keys from a file: newline list, JSON array of strings, or JSON rows with `key`. */
export function readSkuFile(text) {
  const t = text.trim();
  if (t.startsWith('[')) {
    return JSON.parse(t).map((r) => (typeof r === 'string' ? r : r.key ?? r.service_code ?? r.sku_code)).filter(Boolean);
  }
  return t.split(/\r?\n/).map((l) => l.replace(/#.*$/, '').trim()).filter(Boolean);
}

export const SKU_KEYS_SQL = `select key from (
  select service_code as key from public.platform_retail_catalog_v2
  union all select sku_code from public.vendor_billing_catalog) k order by key`;

/** Gather the census and run the check. Returns { result, corpus, skuSource }. */
export function run({ argv = [], env = process.env, repoRoot = REPO } = {}) {
  const corpus = findCorpus({ flag: arg(argv, '--corpus'), env, repoRoot });
  if (!corpus) return { corpus: null };
  const register = fs.readFileSync(path.join(corpus, 'FEATURE_REGISTER.md'), 'utf8');
  const shPath = path.join(corpus, 'START_HERE.md');
  const startHere = fs.existsSync(shPath) ? fs.readFileSync(shPath, 'utf8') : null;

  const web = path.join(repoRoot, 'apps', 'web');
  const routes = censusRoutes(path.join(web, 'app'));
  const flags = censusFlags([path.join(web, 'app'), path.join(web, 'lib'), path.join(web, 'components'), path.join(repoRoot, 'packages'), path.join(web, 'next.config.mjs'), path.join(web, 'next.config.ts')].filter((p) => fs.existsSync(p) && fs.statSync(p).isDirectory()), repoRoot);

  let skus = null; let skuSource = 'not read';
  const skuFile = arg(argv, '--skus');
  if (skuFile) {
    skus = readSkuFile(fs.readFileSync(skuFile, 'utf8'));
    skuSource = `file ${path.basename(skuFile)}`;
  } else {
    const r = readRows(SKU_KEYS_SQL, { env });
    if (r.ok) { skus = r.rows.map((x) => x.key); skuSource = `live catalogue via $${r.via}`; }
    else skuSource = `SKIPPED — ${r.reason}`;
  }

  const bases = [repoRoot, web, path.join(repoRoot, 'supabase', 'migrations'), corpus];
  // A bare file name (no folder) is a NAME, not a path: it resolves when a file
  // of that name exists anywhere in the corpus, so a reader's search finds it.
  const names = basenameIndex(corpus);
  const pointerOk = (tok) => pointerExists(tok, bases, fs.existsSync) || (!tok.includes('/') && names.has(tok));
  const linkOk = (href) => fs.existsSync(path.join(corpus, decodeURI(href)));
  const result = checkRegister({ register, startHere, routes, flags, skus, pointerOk, linkOk });
  return { result, corpus, skuSource };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const { result, corpus, skuSource } = run({ argv, env });
  if (!corpus) {
    process.stderr.write('feature-register-check: FEATURE_REGISTER.md not found (tried --corpus, $SETNAYAN_SPECS_DIR, ../setnayan-specs, ~/Documents/Claude/Projects/Setnayan).\nNOT CHECKED — this is not a pass.\n');
    return 3;
  }
  if (argv.includes('--json')) {
    process.stdout.write(JSON.stringify({ corpus, skuSource, ...result }, null, 2) + '\n');
  } else {
    process.stdout.write(`corpus: ${corpus}\nSKU keys: ${skuSource}\n\n${formatReport(result, { maxList: argv.includes('--all') ? Infinity : 40 })}\n`);
  }
  return result.failed ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}
