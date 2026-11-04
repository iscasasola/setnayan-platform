#!/usr/bin/env node
/**
 * check-build-budget — what keeps the production build near 7 minutes, checked
 * on the build CI just made. Runs in the `production build` job right after
 * `next build`, next to check-vercel-route-count.mjs.
 *
 * FAILS (exit 1) on things a build either does or does not do. These are the
 * same on every machine, so they never flake:
 *   1. `.next/cache/webpack` exists. A production build must not write
 *      webpack's disk cache (lib/build-webpack-cache.ts). Measured 2026-11-04:
 *      writing it took 2.0 min and +3.6 GB of memory, came to 5.6 GB, and
 *      Vercel keeps at most 3 GB of build cache, so it was never reused.
 *   2. More pre-rendered pages than STATIC_PAGE_CEILING. Each one is rendered
 *      in the build. A `generateStaticParams` that starts returning every
 *      event or every supplier would turn ~1 minute into many.
 *
 * WARNS ONLY (a ::warning:: on the PR) on wall time. A GitHub runner's
 * speed varies too much from run to run for a hard 20% line: on 2026-11-04 the
 * same commit took 10.9 min in one job and 10.4 in another. A hard limit
 * would go red on PRs that changed nothing. So time is reported against
 * BASELINE_SECONDS, and the hard checks above pin the causes.
 *
 * Raise a number here only with a measured build behind it, and say in the
 * PR what grew.
 *
 *   node apps/web/scripts/check-build-budget.mjs   (BUILD_SECONDS=<n> optional)
 */
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Pre-rendered routes in .next/prerender-manifest.json: 261 on main 78112195 (2026-11-04). */
export const STATIC_PAGE_CEILING = 300;
/**
 * The `Build web app` step on ubuntu-latest: 524 s on PR #7261's own run
 * (2026-11-04; main was 653 s the same day, before the cache write was cut).
 */
export const BASELINE_SECONDS = 524;
export const SLOWER_WARN_RATIO = 1.2;

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');

export function checkBuildBudget({ nextDir = join(WEB, '.next'), buildSeconds } = {}) {
  const manifestPath = join(nextDir, 'prerender-manifest.json');
  if (!existsSync(manifestPath)) {
    return { errors: [`missing ${manifestPath}: run the production build first`], warnings: [], staticPages: null };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  const staticPages = Object.keys(manifest.routes ?? {}).length;
  const errors = [];
  const warnings = [];

  if (existsSync(join(nextDir, 'cache', 'webpack'))) {
    errors.push(
      '.next/cache/webpack exists: this production build wrote webpack\'s disk cache. ' +
        'lib/build-webpack-cache.ts must keep it off for `next build` (2 min and +3.6 GB of memory, never reused on Vercel).',
    );
  }
  if (staticPages > STATIC_PAGE_CEILING) {
    errors.push(
      `${staticPages} pre-rendered pages, above the ceiling of ${STATIC_PAGE_CEILING}. ` +
        'Find the generateStaticParams that grew (or the page that lost its dynamic read). ' +
        'If the growth is intended, measure a clean build and raise STATIC_PAGE_CEILING in this file.',
    );
  }
  if (Number.isFinite(buildSeconds) && buildSeconds > BASELINE_SECONDS * SLOWER_WARN_RATIO) {
    warnings.push(
      `next build took ${(buildSeconds / 60).toFixed(1)} min, more than ${Math.round((SLOWER_WARN_RATIO - 1) * 100)}% over ` +
        `the ${(BASELINE_SECONDS / 60).toFixed(1)} min baseline. Runner speed varies, so this alone is not a failure — ` +
        'but if it repeats, find what grew before it reaches Vercel\'s bill.',
    );
  }
  return { errors, warnings, staticPages };
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) {
  const raw = process.env.BUILD_SECONDS;
  const buildSeconds = raw ? Number(raw) : undefined;
  const r = checkBuildBudget({ buildSeconds });
  console.log('Build budget');
  console.log(`  pre-rendered pages  ${r.staticPages ?? '?'}  (ceiling ${STATIC_PAGE_CEILING})`);
  console.log(`  webpack disk cache  ${r.errors.some((e) => e.includes('cache/webpack')) ? 'WRITTEN ❌' : 'not written ✅'}`);
  if (buildSeconds !== undefined) {
    console.log(`  next build          ${(buildSeconds / 60).toFixed(1)} min  (baseline ${(BASELINE_SECONDS / 60).toFixed(1)} min, warn above ${((BASELINE_SECONDS * SLOWER_WARN_RATIO) / 60).toFixed(1)})`);
  }
  for (const w of r.warnings) console.log(`::warning title=Build slower than baseline::${w}`);
  for (const e of r.errors) console.error(`::error title=Build budget::${e}`);
  process.exit(r.errors.length ? 1 : 0);
}
