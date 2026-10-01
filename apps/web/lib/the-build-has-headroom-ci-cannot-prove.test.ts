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
 * ── 2026-10-01 — THE CEILING BECAME THE PROBLEM. READ THIS BEFORE RAISING IT. ──
 *
 * `15df3c1` and `5440da5` died on Vercel with `exited (137)` + "Out of Memory"
 * on 8 cores / 16 GB, build cache OFF, after 13–20 min of compile. 137 is the
 * CONTAINER'S SIGKILL, not V8's "heap out of memory" — the process was never
 * refused heap; the box ran out of RAM first. The sentence above, "raising the
 * ceiling costs nothing", is false on a 16 GB box: V8 defers major GC until the
 * heap nears its ceiling, so the ceiling sets the plateau, and the compiler
 * process also carries ~1.8 GB OFF-heap (SWC, buffers) the ceiling never sees.
 *
 * Measured on the owner's Mac, same commit (5440da5), phys footprint summed
 * over the whole build tree every ~3 s (⚠ `ps` RSS and `/usr/bin/time -l`
 * UNDER-report on macOS — compressed pages are not RSS; one sample read
 * 1.8 GB RSS against an 8.66 GB footprint):
 *
 *   config                                          compile   wall     peak
 *   Vercel-as-is: maps ON, 12288, one process       14.7 min  16.5 min (not sampled in compile; >= 9.64 GB after)
 *   maps OFF, 12288, one process                     6.8 min   8.3 min 12.35 GB
 *   maps OFF, 12288, webpackBuildWorker              ~5 min    6.1 min 12.45 GB
 *   maps OFF,  6144, webpackBuildWorker              ~5 min    6.1 min  9.46 GB
 *   maps OFF,  4096, webpackBuildWorker              FATAL "JavaScript heap out of memory"
 *   maps OFF,  8192, webpackBuildWorker  ← SHIPPED   5.0-5.2   6.9-7.0  9.75-10.01 GB (two runs)
 *
 * "maps ON" = what Vercel ran: SENTRY_AUTH_TOKEN set, SENTRY_PROJECT not, so
 * Sentry built ~2,100 source maps per deploy and uploaded none
 * (lib/sentry-sourcemaps-can-upload.ts). 2026-09-07's 7168 MB heap OOM was
 * also a maps-ON build — it measured a heap bloated by maps nobody used.
 *
 * So the heap is a BAND, not a floor: below it V8 dies loudly (4096 did); above
 * it the container dies silently with 137 (12288 did). 8192 is 2x the measured
 * failure and 1.33x the measured pass; the ceiling keeps heap + off-heap + the
 * static-generation worker well under 16 GB.
 *
 * ⚠ If a future build hits a V8 "heap out of memory", RAISE the heap within
 * the band and re-measure the footprint. If it hits 137, the heap is already
 * too big — do NOT raise it; find what grew. Never move a bound to match a
 * red test without a measured build behind the new number.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sentrySourcemapsCanUpload } from './sentry-sourcemaps-can-upload';

/** 4096 died of V8 heap OOM (2026-10-01); 8192 passed with margin. */
const HEAP_FLOOR_MB = 8192;
/**
 * 12288 + one-process compile + maps died of container OOM (137) on the
 * 16 GB Vercel machine (2026-09-30). Heap + ~1.8 GB off-heap per compiler
 * child must stay well under 16 GB.
 */
const HEAP_CEILING_MB = 10240;

function buildScript(): string {
  const pkg = JSON.parse(
    readFileSync(join(process.cwd(), 'package.json'), 'utf8'),
  ) as { scripts?: Record<string, string> };
  const script = pkg.scripts?.build;
  assert.ok(script, 'apps/web/package.json has no "build" script');
  return script;
}

test('the production build asks for a heap inside the measured band', () => {
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
      `4096 MB died "JavaScript heap out of memory" on 2026-10-01.`,
  );
  assert.ok(
    mb <= HEAP_CEILING_MB,
    `build heap ceiling is ${mb} MB, above the ${HEAP_CEILING_MB} MB ceiling. ` +
      `V8 grows to its ceiling before it collects; at 12288 MB the 16 GB Vercel ` +
      `container SIGKILLed the build (exited 137) on 2026-09-30. A bigger heap ` +
      `makes that MORE likely, not less.`,
  );
});

async function loadNextConfig(): Promise<{
  experimental?: { webpackBuildWorker?: boolean; cpus?: number };
}> {
  const mod = (await import(join(process.cwd(), 'next.config.ts'))) as {
    default: unknown;
  };
  let cfg: unknown = mod.default;
  if (cfg && typeof cfg === 'object' && 'default' in cfg) {
    cfg = (cfg as { default: unknown }).default;
  }
  if (typeof cfg === 'function') {
    cfg = await (cfg as (phase: string, ctx: object) => unknown)(
      'phase-production-build',
      { defaultConfig: {} },
    );
  }
  return cfg as { experimental?: { webpackBuildWorker?: boolean; cpus?: number } };
}

test('each webpack compiler runs in its own process, and static generation stays single', async () => {
  const cfg = await loadNextConfig();
  // A custom `webpack` function (ours + Sentry's) makes Next default this to
  // OFF, which puts all three compilations in one heap. Read from the
  // evaluated config, not the source text, so a rename or a spread cannot
  // fool it.
  assert.equal(
    cfg.experimental?.webpackBuildWorker,
    true,
    'experimental.webpackBuildWorker must be true — without it server, edge and ' +
      'client compile in ONE heap and the 8192 MB band was never measured that way',
  );
  assert.equal(
    cfg.experimental?.cpus,
    1,
    'experimental.cpus must stay 1 — every extra static-generation worker is ' +
      'another Node heap on the same 16 GB machine',
  );
});

test('source maps are built only when Sentry can upload them', () => {
  // The Vercel state for 138 days: token, no project → maps built, none uploaded.
  assert.equal(sentrySourcemapsCanUpload({ SENTRY_AUTH_TOKEN: 'x' }), false);
  assert.equal(sentrySourcemapsCanUpload({ SENTRY_AUTH_TOKEN: 'x', SENTRY_PROJECT: ' ' }), false);
  assert.equal(sentrySourcemapsCanUpload({ SENTRY_PROJECT: 'web' }), false);
  assert.equal(sentrySourcemapsCanUpload({}), false);
  // The day the owner adds the project, maps come back on by themselves.
  assert.equal(
    sentrySourcemapsCanUpload({ SENTRY_AUTH_TOKEN: 'x', SENTRY_PROJECT: 'web' }),
    true,
  );

  // …and next.config.ts must actually use it. The options object is consumed
  // inside withSentryConfig, so it cannot be read back from the evaluated
  // config; this is the one assertion that has to read source.
  const src = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');
  const sourcemaps = /sourcemaps:\s*\{([^}]*)\}/.exec(src);
  assert.ok(sourcemaps, 'next.config.ts no longer passes `sourcemaps` to withSentryConfig');
  assert.match(
    sourcemaps![1] ?? '',
    /disable:\s*!sentrySourcemapsCanUpload\(process\.env\)/,
    'sourcemaps.disable must be !sentrySourcemapsCanUpload(process.env). A token-only ' +
      'gate built ~2,100 maps per Vercel deploy and uploaded none (2026-10-01).',
  );
});

test('no debug-ID snippet is shipped to phones while no map is uploaded', () => {
  // The diet (2026-10-01): the Sentry plugin prepends a `_sentryDebugIds` UUID
  // snippet to every browser chunk unless ITS OWN `sourcemaps.disable` is set —
  // the withSentryConfig `sourcemaps.disable` above only empties the upload
  // list. Measured: 7,488 B gz of the Maker's first load, 887 B gz of the
  // shared bundle, paid by every phone for an ID nothing ever reads.
  const src = readFileSync(join(process.cwd(), 'next.config.ts'), 'utf8');
  const gate = /\.\.\.\(sentrySourcemapsCanUpload\(process\.env\)\s*\?\s*\{\}\s*:\s*\{\s*unstable_sentryWebpackPluginOptions:\s*\{\s*sourcemaps:\s*\{\s*disable:\s*true\s*\}\s*\}\s*\}\s*\)/;
  assert.match(
    src,
    gate,
    'next.config.ts must pass unstable_sentryWebpackPluginOptions.sourcemaps.disable = true ' +
      'ONLY while sentrySourcemapsCanUpload() is false. Always-on would strip the debug IDs ' +
      'uploaded maps need; never-on ships a UUID snippet in every chunk for nothing.',
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
