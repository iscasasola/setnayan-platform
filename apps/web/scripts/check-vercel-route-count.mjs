#!/usr/bin/env node
/**
 * check-vercel-route-count — the number Vercel refuses a deployment on, counted
 * on every PR from the production build, BEFORE Vercel counts it.
 *
 * ── WHY THIS EXISTS (2026-10-02) ────────────────────────────────────────────
 * main @ 76c6ed1 (the 2026-10-01 night train, #6248) was refused:
 *   too_many_routes — Maximum number of routes … Max is 2048, received 2057.
 * The server-action guard (lint-server-action-budget.mjs, #6006) stayed green:
 * it counts ONE of the terms below, from source. Actions sat exactly on its
 * ceiling (1,225 — the check is `>`) and never moved; the train added three
 * net dynamic routes at three Vercel routes each (b02235d = 2048 by the formula
 * below, the limit itself). A budget on a part cannot hold a limit on the sum.
 * This guard counts the sum.
 *
 * ── WHAT VERCEL COUNTS ──────────────────────────────────────────────────────
 * The `routes` array of .vercel/output/config.json, which @vercel/next builds
 * from the .next manifests. Measured with a real `vercel build` (builder
 * 4.17.1 AND 16.0.0 agree) and decomposed exactly:
 *
 *   server actions     1 per action id in server-reference-manifest.json
 *   dynamic routes     2 per routes-manifest dynamicRoutes entry (route + .rsc)
 *   /_next/data        1 per dynamic route + 10 — ONLY when the builder thinks
 *                      a Pages Router exists (see stamp-app-type.mjs)
 *   headers · redirects · rewrites   1 each, from routes-manifest
 *   builder fixed      20 (404/500, filesystem handles, rsc/index, …)
 *   platform           3 — Vercel reported 2057 for the build a local
 *                      `vercel build` counts as 2054; constant, added here
 *
 * Calibration (76c6ed1, same .next, two builder runs):
 *   without appType stamp  1226 + 518 + 269 + 21 + 20 + 3 = 2057  ← Vercel's own number
 *   with    appType stamp  1226 + 518 +   0 + 21 + 20 + 3 = 1788
 *
 * If the build turns on PPR / cacheComponents / clientSegmentCache, or moves
 * off Next 15, the per-route shape changes and this formula is no longer
 * calibrated — the guard FAILS and says so rather than print a wrong number.
 * Re-measure with `vercel build` (build-sessions/CONTROLLER.md §9) and update
 * the constants above in the same PR.
 *
 * Over the ceiling? Reuse an existing server action instead of exporting a
 * new one; un-export actions nothing imports; move server-only helpers out of
 * "use server" files. Never raise CEILING past Vercel's 2048.
 *
 * Usage (after `pnpm --filter @setnayan/web build`):
 *   node apps/web/scripts/check-vercel-route-count.mjs
 *   ROUTE_CEILING=1700 node …   # sabotage check: must exit 1
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const VERCEL_LIMIT = 2048;
export const CEILING = 2000;
export const BUILDER_FIXED = 20;
export const NEXT_DATA_FIXED = 10;
export const PLATFORM_OVERHEAD = 3;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

function readJson(p) {
  if (!existsSync(p)) throw new Error(`missing ${p} — run the production build first`);
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function countVercelRoutes(nextDir = join(WEB, '.next')) {
  const routes = readJson(join(nextDir, 'routes-manifest.json'));
  const actionsManifest = readJson(join(nextDir, 'server', 'server-reference-manifest.json'));
  const middlewareManifest = readJson(join(nextDir, 'server', 'middleware-manifest.json'));
  const rsf = readJson(join(nextDir, 'required-server-files.json'));

  const problems = [];
  const exp = rsf.config?.experimental ?? {};
  if (exp.ppr || exp.cacheComponents || rsf.config?.cacheComponents) problems.push('PPR / cacheComponents is on');
  if (exp.clientSegmentCache === true) problems.push('experimental.clientSegmentCache is on');
  if (routes.rsc?.clientParamParsing) problems.push('rsc.clientParamParsing is on');
  const nextMajor = Number(JSON.parse(readFileSync(join(WEB, 'node_modules', 'next', 'package.json'), 'utf8')).version.split('.')[0]);
  if (nextMajor !== 15) problems.push(`Next ${nextMajor} (calibrated on Next 15)`);

  // @vercel/next getServerActionMetaRoutes: one route per unique action id.
  const ids = new Set();
  for (const runtime of ['node', 'edge']) {
    for (const [id, entry] of Object.entries(actionsManifest[runtime] ?? {})) {
      if (entry?.filename && entry?.exportedName) ids.add(id);
    }
  }
  const dynamic = (routes.dynamicRoutes ?? []).filter((r) => !('isMiddleware' in r)).length;
  const rw = routes.rewrites ?? {};
  const rewrites = Array.isArray(rw)
    ? rw.length
    : (rw.beforeFiles?.length ?? 0) + (rw.afterFiles?.length ?? 0) + (rw.fallback?.length ?? 0);
  const headers = routes.headers?.length ?? 0;
  const redirects = routes.redirects?.length ?? 0;

  // @vercel/next: hasPagesRouter = appType ? (pages|hybrid) : true, and the
  // /_next/data resolving routes exist only with a Pages Router + middleware.
  const hasPagesRouter = routes.appType ? routes.appType === 'pages' || routes.appType === 'hybrid' : true;
  // Edge middleware lives in middleware-manifest; Node middleware in functions-config-manifest.
  const fnConfigPath = join(nextDir, 'server', 'functions-config-manifest.json');
  const fnConfig = existsSync(fnConfigPath) ? JSON.parse(readFileSync(fnConfigPath, 'utf8')) : {};
  const hasMiddleware =
    Object.keys(middlewareManifest.middleware ?? {}).length > 0 || Boolean(fnConfig.functions?.['/_middleware']);
  const nextDataResolving = hasPagesRouter && hasMiddleware;

  const parts = {
    'server actions': ids.size,
    'dynamic routes (x2: route + .rsc)': dynamic * 2,
    '/_next/data resolving': nextDataResolving ? dynamic + NEXT_DATA_FIXED : 0,
    'headers + redirects + rewrites': headers + redirects + rewrites,
    'builder fixed': BUILDER_FIXED,
    'Vercel platform': PLATFORM_OVERHEAD,
  };
  const total = Object.values(parts).reduce((a, b) => a + b, 0);
  return { total, parts, problems, appType: routes.appType ?? '(missing)', dynamic };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const ceiling = Number(process.env.ROUTE_CEILING || CEILING);
  let r;
  try {
    r = countVercelRoutes();
  } catch (e) {
    console.error(`❌ check-vercel-route-count: ${e.message}`);
    process.exit(1);
  }
  console.log(`Vercel route count (calibrated) — appType=${r.appType}, ${r.dynamic} dynamic routes`);
  for (const [k, v] of Object.entries(r.parts)) console.log(`  ${String(v).padStart(5)}  ${k}`);
  console.log(`  ${String(r.total).padStart(5)}  TOTAL  (ceiling ${ceiling} · Vercel refuses above ${VERCEL_LIMIT})`);
  if (r.problems.length) {
    console.error(
      `❌ The route formula is not calibrated for this build: ${r.problems.join('; ')}.\n` +
        '   Re-measure with a real `vercel build` (count .vercel/output/config.json "routes")\n' +
        '   and update the constants in apps/web/scripts/check-vercel-route-count.mjs.',
    );
    process.exit(1);
  }
  if (r.parts['/_next/data resolving'] > 0) {
    console.error(
      '❌ The build carries ~one /_next/data route per dynamic page: routes-manifest has no appType "app".\n' +
        '   `next build` must be followed by scripts/stamp-app-type.mjs (package.json "build").',
    );
    process.exit(1);
  }
  if (r.total > ceiling) {
    console.error(
      `❌ ${r.total} routes — over the ceiling of ${ceiling}. Vercel refuses production above ${VERCEL_LIMIT}\n` +
        '   (2026-09-23, 2026-09-26, 2026-10-02). Reuse a server action instead of exporting a new one,\n' +
        '   un-export actions nothing imports, or move server-only helpers out of "use server" files.',
    );
    process.exit(1);
  }
  console.log(`✅ ${r.total} routes — ${ceiling - r.total} under the ceiling of ${ceiling}.`);
}
