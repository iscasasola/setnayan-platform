#!/usr/bin/env tsx
/**
 * scripts/staging/flags.ts — 🔒 STAGING LOCK (e): list every NEXT_PUBLIC_* switch, read production's values where
 * they are readable, and print the checklist that gives the staging preview production's VALUES (not code defaults).
 * It lists the server-side names too, because several must NEVER reach a copy (a production database key, a
 * social-media token, the Vercel API token) — each with its reason (flags-core.ts `SERVER_ENVIRONMENT`).
 * Read-only everywhere: it sends GETs and nothing else, and it never prints a value that is not NEXT_PUBLIC_* or
 * switch-shaped (`isSwitchShaped`).
 * Why the bundle is not a source and what is: scripts/staging/flags-core.ts.
 *
 * USAGE (repo root):
 *   pnpm exec tsx scripts/staging/flags.ts                               # inventory + /api/health + checklist
 *   VERCEL_API_TOKEN=… VERCEL_PROJECT_ID=… [VERCEL_TEAM_ID=…] \
 *     pnpm exec tsx scripts/staging/flags.ts --branch preview/final-check # + production's exact values
 *   … --out build-sessions/final-check-flags.local.md                    # also write the checklist to a file
 *   PROD_URL=https://www.setnayan.com (default)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '../../apps/web/lib/strip-comments';
import { inventoryFlags, productionValues, renderFlagChecklist, type ProdValue } from './flags-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const WEB = path.resolve(HERE, '../../apps/web');
const ROOTS = ['app', 'lib', 'components', 'middleware.ts', 'next.config.ts', 'instrumentation.ts', 'sentry.server.config.ts', 'sentry.edge.config.ts'];
const SKIP_DIRS = new Set(['node_modules', '.next', 'dev']);

/** Every app source file (no tests, no dev labs), comment-stripped. */
export function appSources(): Array<{ path: string; code: string }> {
  const out: Array<{ path: string; code: string }> = [];
  const walk = (abs: string): void => {
    const st = fs.statSync(abs, { throwIfNoEntry: false });
    if (!st) return;
    if (st.isDirectory()) {
      if (SKIP_DIRS.has(path.basename(abs))) return;
      for (const e of fs.readdirSync(abs)) walk(path.join(abs, e));
      return;
    }
    if (!/\.(ts|tsx|mts|mjs|js)$/.test(abs) || /\.test\.|\.lab\.tsx$|\.d\.ts$/.test(abs)) return;
    out.push({ path: path.relative(WEB, abs), code: stripComments(fs.readFileSync(abs, 'utf8')) });
  };
  for (const r of ROOTS) walk(path.join(WEB, r));
  return out;
}

async function getJson(url: string, headers: Record<string, string> = {}): Promise<unknown | null> {
  try {
    const res = await fetch(url, { method: 'GET', headers, signal: AbortSignal.timeout(15_000) });
    if (!res.ok) return null;
    return (await res.json()) as unknown;
  } catch {
    return null;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const flag = (name: string) => {
    const i = args.indexOf(name);
    return i > -1 ? args[i + 1] : undefined;
  };
  const branch = flag('--branch') ?? 'preview/final-check';
  const out = flag('--out');

  const sources = appSources();
  const flags = inventoryFlags(sources);
  const serverFlags = inventoryFlags(sources, 'server');

  const prodUrl = (process.env.PROD_URL ?? 'https://www.setnayan.com').replace(/\/+$/, '');
  const health = (await getJson(`${prodUrl}/api/health`)) as { version?: unknown; env?: unknown } | null;
  const prod =
    health && typeof health.version === 'string' ? { version: health.version, env: String(health.env ?? 'unknown') } : null;

  let values: Map<string, ProdValue> | null = null;
  let serverValues: Map<string, ProdValue> | null = null;
  const token = process.env.VERCEL_API_TOKEN;
  const project = process.env.VERCEL_PROJECT_ID;
  if (token && project) {
    const team = process.env.VERCEL_TEAM_ID ? `&teamId=${encodeURIComponent(process.env.VERCEL_TEAM_ID)}` : '';
    const json = await getJson(`https://api.vercel.com/v10/projects/${encodeURIComponent(project)}/env?decrypt=true${team}`, {
      Authorization: `Bearer ${token}`,
    });
    if (json === null) console.error('⚠ the Vercel env API did not answer — printing the read-by-hand checklist instead');
    else {
      values = productionValues(json, 'public');
      serverValues = productionValues(json, 'server');
    }
  }

  const md = renderFlagChecklist({ flags, serverFlags, values, serverValues, prod, branch });
  if (out) {
    fs.writeFileSync(out, md);
    console.error(`✔ checklist written to ${out}`);
  }
  process.stdout.write(md);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(`✖ flags: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(1);
  });
}
