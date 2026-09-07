/**
 * The production build's heap ceiling is a shipping surface, not a preference.
 *
 * WHY THIS TEST EXISTS — measured 2026-09-07. `pnpm --filter @setnayan/web build`
 * ran green on `ubuntu-latest` in CI for PR #5287 (7m38s, "production build"
 * PASS) and, on the SAME commit, died on Vercel with
 *
 *     FATAL ERROR: Ineffective mark-compacts near heap limit
 *     Allocation failed - JavaScript heap out of memory     … exited (137)
 *
 * Then it died on every production build after it — #5289, #5292, #5295 — while
 * every one of those PRs merged green, because the Vercel check is NOT a
 * required check and CI's own build job is the one that passes. Production kept
 * serving an older deployment for hours with nothing red in front of anybody.
 *
 * 🔑 CI'S BUILD PASSING IS NOT EVIDENCE THAT VERCEL'S BUILD PASSES. They are
 * different machines running different Node majors (CI pins node-version: 22 in
 * .github/workflows/ci.yml; the Vercel project is on 24.x) with different core
 * counts (4 vs 30). The heap high-water mark differs between them, and ours had
 * crept to within a few hundred MB of the 7168 MB ceiling — so a ~30-line
 * addition to `reception-scene.ts` was enough to push the Vercel side over
 * while the CI side stayed under. The failure was in the app's SIZE, not in the
 * change that happened to be on top when it crossed.
 *
 * The Vercel build machine reports "30 cores, 60 GB", and the GitHub runner has
 * 16 GB, so 12288 MB is real headroom on the one and still fits the other. V8
 * grows the heap lazily — raising the ceiling costs nothing on a build that
 * never needs it.
 *
 * ⚠ If a future build OOMs again, RAISE this floor and the script together.
 * Never lower the script to match a red test — that is the failure this file
 * exists to make loud.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/** The smallest ceiling that survived a Vercel production build (2026-09-07). */
const HEAP_FLOOR_MB = 12288;

function buildScript(): string {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  ) as { scripts?: Record<string, string> };
  const script = pkg.scripts?.build;
  assert.ok(script, 'apps/web/package.json has no "build" script');
  return script;
}

test('the production build asks for a heap, and asks for enough of one', () => {
  const script = buildScript();
  const m = /--max-old-space-size=(\d+)/.exec(script);
  assert.ok(
    m,
    `the build script no longer sets --max-old-space-size. CI will still pass ` +
      `without it and Vercel will OOM. Script is: ${script}`,
  );
  const mb = Number(m![1]);
  assert.ok(
    mb >= HEAP_FLOOR_MB,
    `build heap ceiling is ${mb} MB, below the ${HEAP_FLOOR_MB} MB floor. ` +
      `7168 MB is the value that OOM'd four consecutive production builds on ` +
      `2026-09-07 while CI's own build job passed on the same commits.`,
  );
});

test('typecheck keeps its own ceiling — it is a separate process', () => {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  ) as { scripts?: Record<string, string> };
  // Not the same floor: tsc's high-water mark is unrelated to webpack's, and
  // this repo cannot typecheck at all without a raised ceiling. Assert only
  // that the flag is still there, so a cleanup cannot silently drop it.
  assert.match(
    pkg.scripts?.typecheck ?? '',
    /--max-old-space-size=\d+/,
    'the typecheck script lost its --max-old-space-size; tsc OOMs on this repo without it',
  );
});
