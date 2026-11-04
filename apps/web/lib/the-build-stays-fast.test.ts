/**
 * What keeps the production build near 7 minutes (owner, 2026-11-04: "can you
 * keep the builds on 7 minutes?"). Each Vercel build minute is billed.
 *
 * Measured on main 78112195, clean `next build`, 4 cores, dummy env:
 *
 *   config                            compile   wall      peak (whole tree)
 *   main as-is                        11.2 min  14.1 min  11.4 GB
 *   no webpack disk cache             8.9 min   11.8 min  6.8 GB
 *
 * The other half of keeping it fast is what `next build` does NOT do. Type
 * checking and linting are skipped inside the build because CI runs them as
 * their own required jobs; this test fails if CI ever stops running them, so
 * skipping them can never mean they run nowhere.
 *
 * The build's own output is checked by scripts/check-build-budget.mjs in CI's
 * `production build` job (no `.next/cache/webpack`, a pre-rendered page
 * ceiling, and a non-blocking time warning).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keepWebpackCache } from './build-webpack-cache';
import { checkBuildBudget, STATIC_PAGE_CEILING, BASELINE_SECONDS } from '../scripts/check-build-budget.mjs';

const WEB = process.cwd();

async function loadNextConfig(): Promise<{
  typescript?: { ignoreBuildErrors?: boolean };
  eslint?: { ignoreDuringBuilds?: boolean };
  productionBrowserSourceMaps?: boolean;
}> {
  const mod = (await import(join(WEB, 'next.config.ts'))) as { default: unknown };
  let cfg: unknown = mod.default;
  if (cfg && typeof cfg === 'object' && 'default' in cfg) cfg = (cfg as { default: unknown }).default;
  if (typeof cfg === 'function') {
    cfg = await (cfg as (phase: string, ctx: object) => unknown)('phase-production-build', { defaultConfig: {} });
  }
  return cfg as never;
}

test('a production build keeps no webpack disk cache; dev and an explicit opt-in do', () => {
  assert.equal(keepWebpackCache(false, {}), false);
  assert.equal(keepWebpackCache(false, { NEXT_BUILD_WEBPACK_CACHE: '0' }), false);
  assert.equal(keepWebpackCache(false, { NEXT_BUILD_WEBPACK_CACHE: '1' }), true);
  assert.equal(keepWebpackCache(true, {}), true);

  // The webpack function is wrapped by withSentryConfig and cannot be called
  // here without a whole Next build context, so this half reads the source.
  // scripts/check-build-budget.mjs proves it on CI's real build.
  const src = readFileSync(join(WEB, 'next.config.ts'), 'utf8');
  assert.match(
    src,
    /if \(!keepWebpackCache\(dev, process\.env\)\) \{\s*config\.cache = false;/,
    'next.config.ts must set `config.cache = false` when !keepWebpackCache(dev, process.env). ' +
      'Writing the cache cost 2.0 min and +3.6 GB per build (2026-11-04), and Vercel could not keep it.',
  );
});

test('next build skips type-check, lint and browser source maps — and CI still runs type-check and lint', async () => {
  const cfg = await loadNextConfig();
  assert.equal(cfg.typescript?.ignoreBuildErrors, true, 'typescript.ignoreBuildErrors must stay true: CI runs `pnpm typecheck` as its own job');
  assert.equal(cfg.eslint?.ignoreDuringBuilds, true, 'eslint.ignoreDuringBuilds must stay true: CI runs `pnpm lint` as its own job');
  assert.notEqual(cfg.productionBrowserSourceMaps, true, 'productionBrowserSourceMaps would build a map for every browser chunk');

  const ci = readFileSync(join(WEB, '..', '..', '.github', 'workflows', 'ci.yml'), 'utf8');
  assert.match(ci, /^\s*run: pnpm typecheck\s*$/m, 'ci.yml no longer runs `pnpm typecheck`; then next build must type-check again');
  assert.match(ci, /^\s*run: pnpm lint\s*$/m, 'ci.yml no longer runs `pnpm lint`; then next build must lint again');
  assert.match(ci, /node apps\/web\/scripts\/check-build-budget\.mjs/, 'ci.yml no longer runs scripts/check-build-budget.mjs after the production build');
});

function fakeBuild(pages: number, withCache: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), 'build-budget-'));
  const routes = Object.fromEntries(Array.from({ length: pages }, (_, i) => [`/p${i}`, {}]));
  writeFileSync(join(dir, 'prerender-manifest.json'), JSON.stringify({ routes, dynamicRoutes: {} }));
  if (withCache) mkdirSync(join(dir, 'cache', 'webpack'), { recursive: true });
  return dir;
}

test('check-build-budget fails on a written webpack cache and on too many pre-rendered pages', () => {
  assert.deepEqual(checkBuildBudget({ nextDir: fakeBuild(10, false) }).errors, []);
  assert.equal(checkBuildBudget({ nextDir: fakeBuild(10, true) }).errors.length, 1);
  assert.equal(checkBuildBudget({ nextDir: fakeBuild(STATIC_PAGE_CEILING, false) }).errors.length, 0);
  assert.equal(checkBuildBudget({ nextDir: fakeBuild(STATIC_PAGE_CEILING + 1, false) }).errors.length, 1);
  assert.equal(checkBuildBudget({ nextDir: join(tmpdir(), 'no-such-build') }).errors.length, 1);
});

test('check-build-budget only warns on time — runner speed is not a failure', () => {
  const dir = fakeBuild(10, false);
  const slow = checkBuildBudget({ nextDir: dir, buildSeconds: BASELINE_SECONDS * 2 });
  assert.equal(slow.errors.length, 0);
  assert.equal(slow.warnings.length, 1);
  assert.equal(checkBuildBudget({ nextDir: dir, buildSeconds: BASELINE_SECONDS }).warnings.length, 0);
});
