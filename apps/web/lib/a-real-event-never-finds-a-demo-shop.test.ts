/**
 * 🧪 A REAL EVENT NEVER FINDS A DEMO SHOP — AND A DEMO EVENT FINDS ONLY DEMO SHOPS.
 *
 * Owner, DECISION_LOG 2026-11-06 "Demo catalogue — owner clicks": real couples see demo shops on Explore and the front
 * page (marked "(DEMO ONLY)") *"but never inside their own event's supplier search"*; and "DEMO CATALOGUE — scope":
 * *"The goal is the demo events can only see demo suppliers to try to run suppliers as well."*
 *
 * The rule is `lib/demo-scope.ts` (`events.is_sample` must equal `vendor_profiles.is_demo`). This guard holds the
 * other half: EVERY reader that lists suppliers inside an event asks that module, applies the scope, and none still
 * runs the retired admin-cookie exclusion (`demoVendorIdsHiddenFrom` / `fetchDemoVendorIds`), under which an admin's
 * demo cookie put demo shops inside a real wedding's search and a refused id read listed every demo shop.
 *
 * Anchored PER FILE on the symbol that applies the scope (never a file-level word match), and every count is printed,
 * so a sabotage that drops one site turns this red instead of staying green on a sibling's match.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { eventSearchScopeOf, shopInEventScope } from '@/lib/demo-vendor-exclusion';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { fetchWizardVendorRecommendations as FetchRecs } from '@/lib/wizard-recommendations';

// The engine reaches `lib/uploads.ts` (`import 'server-only'`); stub the marker, then load the modules lazily.
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const ROOT = process.cwd();
const code = (rel: string) => stripComments(readFileSync(join(ROOT, rel), 'utf8'));

/** Every reader that lists suppliers inside (or for) an event, and the line that applies its scope. */
const READERS: ReadonlyArray<{ file: string; scope: RegExp; applies: RegExp; min: number }> = [
  {
    file: 'app/dashboard/[eventId]/vendors/_actions/category-search.ts',
    scope: /await demoScopeFor\(admin, eventId\)/g,
    applies: /fetchWizardVendorRecommendations\(admin, \{[\s\S]{0,200}?demoScope,/g,
    min: 1,
  },
  {
    file: 'app/dashboard/[eventId]/vendors/_actions/bench-marketplace-search.ts',
    scope: /demoScopeFor\(admin, eventId\)/g,
    applies: /\.filter\(\(r\) => shopInEventScope\(scope, r\.vendor_profile_id\)\)/g,
    min: 1,
  },
  {
    file: 'app/dashboard/[eventId]/wizard-actions.ts',
    scope: /const demoScope = await demoScopeFor\(admin, args\.eventId\);/g,
    applies: /fetchWizardVendorRecommendations\(admin, \{\s*demoScope,/g,
    min: 1,
  },
  {
    file: 'lib/wizard-recommendations.ts',
    scope: /const demoScope: DemoScope \| null = args\.demoScope \?\? \(args\.includeDemoUnverified \? null : \{ is_demo: false \}\);/g,
    applies: /\.in\('vendor_profile_id', demoIds\)|\.not\('vendor_profile_id', 'in', `\(\$\{demoIds\.join\(','\)\}\)`\)/g,
    min: 2,
  },
  {
    file: 'lib/venue-recommendations.ts',
    scope: /args\.eventId \? await demoScopeFor\(admin, args\.eventId\) : null/g,
    applies: /if \(demoScope\?\.is_demo === true\) \{\s*q = q\.eq\('is_demo', true\);/g,
    min: 1,
  },
  {
    file: 'lib/same-day-vendors.ts',
    scope: /demoScope: DemoScope,/g,
    applies: /\.eq\('is_demo', demoScope\.is_demo\)/g,
    min: 1,
  },
  {
    file: 'app/dashboard/[eventId]/page.tsx',
    scope: /demoScopeFor\(adminClient, eventId\)/g,
    applies: /findSameDayVendors\(\s*supabase,[\s\S]{0,400}?demoScope,\s*\)/g,
    min: 1,
  },
  {
    file: 'app/dashboard/[eventId]/date-selection/page.tsx',
    scope: /const demoScope = await demoScopeFor\(admin, eventId\);/g,
    applies: /\.eq\('is_demo', demoScope\.is_demo\)/g,
    min: 1,
  },
  {
    file: 'app/onboarding/wedding/actions.ts',
    scope: /const ONBOARDING_DEMO_SCOPE = demoScopeOfEvent\(\{ is_sample: false \}\);/g,
    applies: /demoScope: ONBOARDING_DEMO_SCOPE,|\.eq\('is_demo', ONBOARDING_DEMO_SCOPE\.is_demo\)/g,
    min: 3,
  },
];

test('every event supplier search asks lib/demo-scope and applies the scope — per file, per site', () => {
  const report: string[] = [];
  for (const r of READERS) {
    const src = code(r.file);
    assert.match(src, /from '(?:@\/lib|\.)\/demo-scope'/, `${r.file} does not import the one demo rule (lib/demo-scope.ts)`);
    const scopes = (src.match(r.scope) ?? []).length;
    const applies = (src.match(r.applies) ?? []).length;
    report.push(`${r.file}: scope ${scopes} · applied ${applies} (floor ${r.min})`);
    assert.ok(scopes >= 1, `${r.file} no longer reads the event's demo scope`);
    assert.ok(applies >= r.min, `${r.file} applies the demo scope at ${applies} site(s), floor ${r.min}`);
  }
  console.log(report.join('\n'));
});

test('no event search still runs the retired admin-cookie exclusion', () => {
  const offenders = READERS.map((r) => r.file).filter((f) =>
    /\b(fetchDemoVendorIds|demoVendorIdsHiddenFrom|demoShopsShownTo)\(/.test(code(f)),
  );
  assert.deepEqual(offenders, [], `the cookie no longer reaches inside an event: ${offenders.join(', ')}`);
  const exclusion = code('lib/demo-vendor-exclusion.ts');
  assert.doesNotMatch(exclusion, /DEMO_MODE_COOKIE_NAME|cookies\(\)/, 'the event search scope reads the admin demo cookie again');
});

test('the scope keeps exactly one side of the line, and nothing when the demo list could not be read', () => {
  const ids = ['d1', 'd2'];
  const real = eventSearchScopeOf({ is_demo: false }, ids);
  const demo = eventSearchScopeOf({ is_demo: true }, ids);
  const shops = ['d1', 'r1', 'd2', 'r2'];
  assert.deepEqual(shops.filter((s) => shopInEventScope(real, s)), ['r1', 'r2']);
  assert.deepEqual(shops.filter((s) => shopInEventScope(demo, s)), ['d1', 'd2']);
  assert.deepEqual(shops.filter((s) => shopInEventScope(eventSearchScopeOf({ is_demo: false }, null), s)), []);
});

// ── behaviour: a fake PostgREST builder that records every filter and answers from rows in memory ──────────────────

type Row = Record<string, unknown>;
type Call = { table: string; op: string; args: unknown[] };

function fakeClient(tables: Record<string, Row[] | 'refused'>, calls: Call[]) {
  return {
    from(table: string) {
      const filters: Array<(r: Row) => boolean> = [];
      const rec = (op: string, args: unknown[]) => calls.push({ table, op, args });
      const builder: Record<string, unknown> = {};
      const chain = (op: string, f?: (...a: unknown[]) => ((r: Row) => boolean) | null) =>
        (...args: unknown[]) => {
          rec(op, args);
          const p = f?.(...args);
          if (p) filters.push(p);
          return builder;
        };
      Object.assign(builder, {
        select: chain('select'),
        eq: chain('eq', (c, v) => (r) => r[c as string] === v),
        neq: chain('neq', (c, v) => (r) => r[c as string] !== v),
        in: chain('in', (c, v) => (r) => (v as unknown[]).includes(r[c as string])),
        not: chain('not', (c, op, v) =>
          op === 'in' ? (r) => !String(v).slice(1, -1).split(',').includes(String(r[c as string])) : null,
        ),
        or: chain('or'),
        overlaps: chain('overlaps'),
        order: chain('order'),
        limit: chain('limit'),
        then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
          rec('await', []);
          const t = tables[table];
          const out =
            t === 'refused'
              ? { data: null, error: { message: 'permission denied', code: '42501' } }
              : { data: (t ?? []).filter((r) => filters.every((f) => f(r))), error: null };
          return Promise.resolve(out).then(resolve, reject);
        },
      });
      return builder;
    },
  };
}

const LIVE = { public_visibility: 'verified', verification_state: 'verified', same_day_available: true, tier_state: 'pro' };
const SHOPS: Row[] = [
  { vendor_profile_id: 'real-1', business_name: 'Real Shop', is_demo: false, ...LIVE },
  { vendor_profile_id: 'demo-1', business_name: 'Demo Shop', is_demo: true, ...LIVE },
];

test('same-day help: a real event gets only real shops, a demo event only demo shops', async () => {
  const { findSameDayVendors } = await import('@/lib/same-day-vendors');
  for (const [scope, want] of [
    [{ is_demo: false }, ['real-1']],
    [{ is_demo: true }, ['demo-1']],
  ] as const) {
    const calls: Call[] = [];
    const got = await findSameDayVendors(fakeClient({ vendor_profiles: SHOPS }, calls) as unknown as SupabaseClient, { lat: null, lng: null, region: null }, scope);
    assert.deepEqual(got.map((v) => v.vendorProfileId), want);
    assert.ok(calls.some((c) => c.op === 'eq' && c.args[0] === 'is_demo' && c.args[1] === scope.is_demo));
  }
});

test('the recommendation engine draws the demo line by id — and stops when the demo list is refused', async () => {
  const { fetchWizardVendorRecommendations } = await import('@/lib/wizard-recommendations');
  const run = async (tables: Record<string, Row[] | 'refused'>, args: Partial<Parameters<typeof FetchRecs>[1]>) => {
    const calls: Call[] = [];
    let refused = false;
    await fetchWizardVendorRecommendations(fakeClient(tables, calls) as unknown as SupabaseClient, {
      canonicalServices: ['photography'],
      ceremonyType: null,
      venueSetting: null,
      onReadRefused: () => {
        refused = true;
      },
      ...args,
    });
    const market = calls.filter((c) => c.table === 'vendor_market_stats');
    return { market, refused };
  };

  const real = await run({ vendor_profiles: SHOPS }, { demoScope: { is_demo: false } });
  assert.ok(
    real.market.some((c) => c.op === 'not' && c.args[0] === 'vendor_profile_id' && c.args[1] === 'in' && c.args[2] === '(demo-1)'),
    'a real event search does not drop the demo shop ids',
  );

  const omitted = await run({ vendor_profiles: SHOPS }, {});
  assert.ok(
    omitted.market.some((c) => c.op === 'not' && c.args[2] === '(demo-1)'),
    'a search that forgets to pass a scope is not treated as a real one',
  );

  const demo = await run({ vendor_profiles: SHOPS }, { demoScope: { is_demo: true } });
  assert.ok(
    demo.market.some((c) => c.op === 'in' && c.args[0] === 'vendor_profile_id' && JSON.stringify(c.args[1]) === '["demo-1"]'),
    'a demo event search is not narrowed to demo shops',
  );

  const refused = await run({ vendor_profiles: 'refused' }, { demoScope: { is_demo: false } });
  assert.equal(refused.refused, true, 'a refused demo list is not reported as refused');
  assert.equal(refused.market.filter((c) => c.op === 'await').length, 0, 'a refused demo list still ran the unfiltered search');
});
