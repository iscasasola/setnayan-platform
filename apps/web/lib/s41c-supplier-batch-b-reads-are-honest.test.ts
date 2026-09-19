/**
 * s41c-supplier-batch-b-reads-are-honest.test.ts — batch 2/4 of the SUPPLIER
 * tier of `result-dropped-silently` (S26 baseline, PR #5625; the same disease
 * S41 already fixed for MONEY and BOOKING).
 *
 * A REFUSED Supabase read resolves with `{ error }` instead of throwing. Read
 * as a bare `if (error)` boolean with nothing recorded, the branch it picks
 * renders identically to a genuine absence — a supplier cannot tell "we
 * couldn't check" from "there is nothing there".
 *
 * Two shapes, matched to blast radius:
 *
 *   shape 1 (log-only) — an internal / background / control-plane call site
 *     whose caller already fails closed correctly. Fixed: bind the error and
 *     log it (`console.error('[supabase-error] …', error)`), so the reason
 *     survives even though the rendered state is unchanged.
 *   shape 2 (honest render state) — a read whose result reaches a card a
 *     supplier actually SEES, where a refused read collapsed to the same
 *     empty/suppressed copy as a genuine "not enough data yet". Fixed: a
 *     distinct sentinel (`*_UNREADABLE`) propagated through the return type
 *     and rendered as its own "we couldn't load this" message.
 *
 * This file proves both shapes landed:
 *   - `lib/demand-radar.ts` + `DemandRadarCard` (shape 2)
 *   - `lib/funnel-benchmark.ts` + `FunnelBenchmarkCard` (shape 2)
 *   - `lib/live-shops.ts`, `lib/live-studio-window-server.ts` (shape 1,
 *     executed against a stubbed client — the log call itself is asserted)
 *   - the remaining shape-1 sites (source-asserted: the exact log line sits
 *     at the exact call site the baseline flagged, comments stripped so a
 *     docblock mentioning the target cannot pass for the fix)
 *
 * 🛡 Sabotage-checked by hand: each rule was reverted, the test confirmed RED,
 * then restored — see the PR body for the before/after transcript.
 */
import test, { before } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import path, { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { countLiveShops } from '@/lib/live-shops';

// Some rendered components (e.g. DemandRadarCard, FunnelBenchmarkCard) use
// `<>…</>` fragment shorthand and are compiled here under the classic JSX
// transform (tsx honours this project's `"jsx": "preserve"` tsconfig, unlike
// esbuild's own default), which expects a `React` global in scope.
(globalThis as unknown as { React: typeof React }).React = React;

/* ── `server-only` shim — same as `lib/booking-reads-are-honest.test.ts` (S41):
 * a bundler assertion with no runtime behaviour, resolved to an empty module.
 * Needed because `lib/demand-radar.ts` imports 'server-only' at module scope. */
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = path.join(process.cwd(), '__server_only_stub_s41c_batch_b__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only') return STUB;
    return original.call(this, request, ...rest);
  };
}

let demandRadar: typeof import('@/lib/demand-radar');
let funnelBenchmark: typeof import('@/lib/funnel-benchmark');
let DemandRadarCard: typeof import('@/app/vendor-dashboard/demand/_components/demand-radar-card').DemandRadarCard;
let FunnelBenchmarkCard: typeof import('@/app/vendor-dashboard/performance/_components/funnel-benchmark-card').FunnelBenchmarkCard;
let windowServer: typeof import('@/lib/live-studio-window-server');

before(async () => {
  demandRadar = await import('@/lib/demand-radar');
  funnelBenchmark = await import('@/lib/funnel-benchmark');
  ({ DemandRadarCard } = await import('@/app/vendor-dashboard/demand/_components/demand-radar-card'));
  ({ FunnelBenchmarkCard } = await import('@/app/vendor-dashboard/performance/_components/funnel-benchmark-card'));
  windowServer = await import('@/lib/live-studio-window-server');
});

/** A minimal thenable query-builder stub — every chain method returns itself;
 *  awaiting it resolves to the given `{ data, error }`, exactly like the real
 *  postgrest-js / rpc builder. */
function stubClient(result: { data: unknown; error: unknown }): SupabaseClient {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'select', 'eq', 'in', 'order', 'limit', 'maybeSingle', 'rpc', 'match']) {
    builder[m] = () => builder;
  }
  builder.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return builder as unknown as SupabaseClient;
}

const quiet = async <T>(fn: () => Promise<T>): Promise<T> => {
  const orig = console.error;
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.error = orig;
  }
};

// ── shape 2 · lib/demand-radar.ts ───────────────────────────────────────────

test('demand radar: a REFUSED RPC read returns DEMAND_RADAR_UNREADABLE, not EMPTY_RADAR', async () => {
  const client = stubClient({ data: null, error: { code: '42501', message: 'denied' } });
  const result = await quiet(() => demandRadar.getVendorDemandRadar(client, 'vp_1'));
  assert.equal(result, demandRadar.DEMAND_RADAR_UNREADABLE);
  assert.notDeepEqual(result, demandRadar.EMPTY_RADAR);
});

test('demand radar: a genuine empty RPC read stays EMPTY_RADAR-shaped (hasData:false), never the unreadable sentinel', async () => {
  const client = stubClient({ data: [], error: null });
  const result = await demandRadar.getVendorDemandRadar(client, 'vp_1');
  assert.notEqual(result, demandRadar.DEMAND_RADAR_UNREADABLE);
  assert.equal((result as { hasData: boolean }).hasData, false);
});

test('demand radar: a REFUSED read logs the reason with the rpc call site', async () => {
  const client = stubClient({ data: null, error: { code: '42501', message: 'denied' } });
  const calls: unknown[][] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => calls.push(args);
  try {
    await demandRadar.getVendorDemandRadar(client, 'vp_1');
  } finally {
    console.error = orig;
  }
  assert.ok(
    calls.some(
      (c) => typeof c[0] === 'string' && c[0].includes('demand-radar.ts') && c[0].includes('rpc:demand_radar_for_vendor'),
    ),
    'expected a [supabase-error] log naming the rpc call site',
  );
});

test('DemandRadarCard: unreadable renders DIFFERENT copy than genuinely-empty', () => {
  const unreadableHtml = renderToStaticMarkup(
    React.createElement(DemandRadarCard, {
      radar: demandRadar.EMPTY_RADAR,
      marketLabel: null,
      scope: 'vendor',
      unreadable: true,
    }),
  );
  const emptyHtml = renderToStaticMarkup(
    React.createElement(DemandRadarCard, {
      radar: demandRadar.EMPTY_RADAR,
      marketLabel: null,
      scope: 'vendor',
      unreadable: false,
    }),
  );
  assert.match(unreadableHtml, /couldn.t load your demand radar/i);
  assert.doesNotMatch(unreadableHtml, /Not enough demand data yet/);
  assert.match(emptyHtml, /Not enough demand data yet/);
  assert.doesNotMatch(emptyHtml, /couldn.t load your demand radar/i);
});

// ── shape 2 · lib/funnel-benchmark.ts ───────────────────────────────────────

test('funnel benchmark: a REFUSED RPC read returns FUNNEL_BENCHMARK_UNREADABLE, not EMPTY_FUNNEL_BENCHMARK', async () => {
  const client = stubClient({ data: null, error: { code: '42501', message: 'denied' } });
  const result = await quiet(() => funnelBenchmark.getVendorFunnelBenchmark(client, 'vp_1'));
  assert.equal(result, funnelBenchmark.FUNNEL_BENCHMARK_UNREADABLE);
  assert.notDeepEqual(result, funnelBenchmark.EMPTY_FUNNEL_BENCHMARK);
});

test('funnel benchmark: a genuine empty RPC read stays EMPTY_FUNNEL_BENCHMARK-shaped (hasBand:false)', async () => {
  const client = stubClient({ data: [], error: null });
  const result = await funnelBenchmark.getVendorFunnelBenchmark(client, 'vp_1');
  assert.notEqual(result, funnelBenchmark.FUNNEL_BENCHMARK_UNREADABLE);
  assert.equal((result as { hasBand: boolean }).hasBand, false);
});

test('FunnelBenchmarkCard: unreadable renders DIFFERENT copy than genuinely-empty', () => {
  const unreadableHtml = renderToStaticMarkup(
    React.createElement(FunnelBenchmarkCard, {
      benchmark: funnelBenchmark.EMPTY_FUNNEL_BENCHMARK,
      unreadable: true,
    }),
  );
  const emptyHtml = renderToStaticMarkup(
    React.createElement(FunnelBenchmarkCard, {
      benchmark: funnelBenchmark.EMPTY_FUNNEL_BENCHMARK,
      unreadable: false,
    }),
  );
  assert.match(unreadableHtml, /couldn.t load your peer comparison/i);
  assert.doesNotMatch(unreadableHtml, /Not enough shops like yours yet/);
  assert.match(emptyHtml, /Not enough shops like yours yet/);
});

// ── shape 1 · executed against a stubbed client ─────────────────────────────

test('live-shops: countLiveShops logs the reason and returns null (never 0) on a refused count', async () => {
  const calls: unknown[][] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => calls.push(args);
  let result: number | null;
  try {
    result = await countLiveShops({
      from: () => ({
        select: () => ({
          match: async () => ({ count: null, error: { code: '42501', message: 'denied' } }),
        }),
      }),
    });
  } finally {
    console.error = orig;
  }
  assert.equal(result, null);
  assert.ok(
    calls.some((c) => typeof c[0] === 'string' && c[0].includes('live-shops.ts') && c[0].includes('vendor_profiles.select')),
    'expected a [supabase-error] log naming the call site',
  );
});

test('live-studio-window-server: fetchWindowAnchor logs the reason on a refused read', async () => {
  const client = stubClient({ data: null, error: { code: '42501', message: 'denied' } });
  const calls: unknown[][] = [];
  const orig = console.error;
  console.error = (...args: unknown[]) => calls.push(args);
  let result: string | null;
  try {
    result = await windowServer.fetchWindowAnchor(client, 'evt_1');
  } finally {
    console.error = orig;
  }
  assert.equal(result, null);
  assert.ok(
    calls.some(
      (c) => typeof c[0] === 'string' && c[0].includes('live-studio-window-server.ts') && c[0].includes('panood_control_state.select'),
    ),
    'expected a [supabase-error] log naming the call site',
  );
});

// ── shape 1 · remaining sites, source-asserted ──────────────────────────────
//
// Each of these is an internal / control-plane / best-effort call site (a
// live-studio provisioning helper, a cron-free background job, an actions.ts
// re-read) where the render is unaffected and the fix is "the reason is now
// on the record". Asserted by SOURCE so a future edit that removes the log
// while leaving the `if (error)` branch in place fails here — comments
// stripped with the shared lexer so a docblock mentioning the target cannot
// stand in for the fix.

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = (rel: string): string => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const SOURCE_LOGGED_SITES: { file: string; needle: string }[] = [
  { file: 'app/vendor-dashboard/shop/inline-docs-actions.ts', needle: 'vendor_verification_applications.select' },
  { file: 'lib/creator-analytics.ts', needle: 'creator_chapters.select' },
  { file: 'lib/email-delivery.server.ts', needle: 'email_deliveries.update' },
  { file: 'lib/live-studio-channel-cameras.ts', needle: 'panood_camera_operators.update' },
  { file: 'lib/live-studio-channel-grants.ts', needle: 'live_studio_channel_grants.select' },
  { file: 'lib/live-studio-encoder-claims.ts', needle: 'live_studio_encoder_claims.insert' },
  { file: 'lib/live-studio-overlays.ts', needle: 'live_studio_overlay_settings.select' },
  { file: 'lib/live-studio-overlays.ts', needle: 'live_studio_highlights.select' },
  { file: 'lib/live-studio-recordings.ts', needle: 'live_studio_roam_streams.update' },
  { file: 'lib/live-studio-roam-provision.ts', needle: 'live_studio_roam_channel_pool.select' },
  { file: 'lib/live-studio-roam-provision.ts', needle: 'live_studio_roam_channel_pool.update' },
  { file: 'lib/nsfw-screen.ts', needle: 'editorial_vendor_media.select' },
  { file: 'lib/onboarding-refinements.ts', needle: 'service_categories.select' },
];

test('every remaining shape-1 site carries a [supabase-error] log naming its own call site', () => {
  for (const { file, needle } of SOURCE_LOGGED_SITES) {
    const text = src(file);
    assert.match(
      text,
      new RegExp(`\\[supabase-error\\][^'"]*${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
      `${file}: expected a [supabase-error] log naming "${needle}"`,
    );
  }
});

test('live-studio-channel-grants: BOTH discarded live_studio_channel_grants.select call sites are logged (baseline count 2)', () => {
  const text = src('lib/live-studio-channel-grants.ts');
  const matches = text.match(/\[supabase-error\][^'"]*live_studio_channel_grants\.select/g) ?? [];
  assert.equal(matches.length, 2, `expected 2 logged call sites, found ${matches.length}`);
});
