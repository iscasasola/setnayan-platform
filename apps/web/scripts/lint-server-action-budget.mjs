#!/usr/bin/env node
/**
 * lint-server-action-budget — every exported `"use server"` function is ONE
 * Vercel route, and Vercel refuses a deployment above 2,048 routes.
 *
 * ── WHY THIS EXISTS (2026-09-26) ────────────────────────────────────────────
 * Production stopped updating for ~7 hours: four deploys in a row were refused
 * with `too_many_routes — Max is 2048, received 2049` at
 * `process-and-upload-routes`, while GitHub's deploy-prod run still said
 * "success" (it only fires the hook). Nothing in the repo could see the number;
 * it grew one save button at a time. Fixed by #6003 (31 unused actions
 * un-exported). The same limit had already stopped production for a day on
 * 2026-09-23. This guard makes the budget visible on every PR, BEFORE Vercel.
 *
 * ── THE RULE ────────────────────────────────────────────────────────────────
 * Count exported functions/consts in files whose first statement is
 * "use server" under apps/web/app and apps/web/lib. Fail above CEILING.
 * CEILING leaves headroom for the pages/.rsc routes that also count: at 1,209
 * exports production measured ~2,019 routes (Vercel's own count).
 *
 * Over the ceiling? In order of preference:
 *   1. reuse an existing action instead of exporting a new one;
 *   2. un-export actions nothing imports (see #6003 for the sweep);
 *   3. only with a fresh `vercel build` route count in hand
 *      (CONTROLLER.md §9), raise CEILING in the same PR and say why.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CEILING = 1225;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'lib'].map((r) => join(WEB, r));
const USE_SERVER = /^\s*['"]use server['"]/m;
const EXPORT = /^export\s+(?:async\s+)?(?:function|const)\s+\w+/gm;

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

export function countServerActions(roots = ROOTS) {
  let total = 0;
  let files = 0;
  for (const f of roots.flatMap((r) => walk(r))) {
    const src = readFileSync(f, 'utf8');
    if (!USE_SERVER.test(src)) continue;
    files += 1;
    total += (src.match(EXPORT) || []).length;
  }
  return { total, files };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const ceiling = Number(process.env.SERVER_ACTION_CEILING || CEILING);
  const { total, files } = countServerActions();
  if (files === 0 || total === 0) {
    console.error('❌ lint-server-action-budget: found no "use server" exports — the walk is broken, not the budget.');
    process.exit(1);
  }
  if (total > ceiling) {
    console.error(
      `❌ ${total} exported server actions in ${files} "use server" files — over the ceiling of ${ceiling}.\n` +
        '   Each one is a Vercel route; production is refused above 2,048 routes (2026-09-23, 2026-09-26).\n' +
        '   Reuse an existing action, un-export ones nothing imports, or — with a fresh `vercel build`\n' +
        '   route count — raise CEILING in apps/web/scripts/lint-server-action-budget.mjs and say why.',
    );
    process.exit(1);
  }
  console.log(`✅ ${total} exported server actions in ${files} files — ${ceiling - total} under the ceiling of ${ceiling}.`);
}
