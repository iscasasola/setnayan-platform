/**
 * insights-setup-and-shell-say-what-is-true.test.ts — final check area 8,
 * batch 10 (checker 8-1). Insights, Setup, Home and the shell. Paired unit
 * tests: lib/admin/admin-log-words.test.ts (C-11), lib/admin/growth-csv.test.ts
 * (H-11).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { adminMergedForward } from '@/lib/admin/admin-pages';
import { shippedScreens } from '../../../../scripts/staging/areas';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

function body(src: string, name: string): string {
  const at = src.search(new RegExp(`(?:^|\\n)(?:export )?(?:async )?function ${name}\\(`));
  assert.ok(at >= 0, `${name} not found`);
  const rest = src.slice(at + 1);
  const next = rest.search(/\n(?:export )?(?:async )?function /);
  return next < 0 ? src.slice(at) : src.slice(at, at + 1 + next);
}

test('A8·C-4 · an "Answered on Focus" ask is answered in place in Full mode too', () => {
  const s = read('app/admin/page.tsx');
  const answers = s.indexOf('const answersInPlace = Boolean(asked && Object.hasOwn(FOCUS_ASK_ANSWERS, asked));');
  const full = s.indexOf("if (mode === 'full' && !answersInPlace) return AdminWorkLanding(props);");
  assert.ok(answers > 0 && full > answers, 'Full mode sends a known ask to the in-place answer, not the Work list');
  assert.doesNotMatch(s, /if \(mode === 'full'\) return AdminWorkLanding\(props\);/);
  // Every Focus ask the palette offers is one the page answers.
  const dest = read('app/admin/_components/admin-destinations.ts');
  const focus = read('app/admin/_components/focus-home.tsx');
  for (const m of dest.matchAll(/href: '\/admin\?ask=([a-z-]+)'/g)) {
    assert.match(focus, new RegExp(`\\b${m[1]}: \\{`), `ask=${m[1]} has no in-place answer`);
  }
});

test('A8·H-7 · each Overview card answers for its own failed read', () => {
  const s = read('app/admin/app-performance/_surfaces/overview-surface.tsx');
  assert.match(s, /<ContextTile label="Users" value=\{count\(popUnread, growth\.population\.accountHolders\)\}/);
  assert.match(s, /value=\{count\(editorialsUnread, perf\.editorials\.total\)\}/);
  assert.match(s, /breakdownsUnread \? \([\s\S]{0,160}Couldn&rsquo;t read the events by type/);
  assert.match(s, /\{count\(reportsUnread, perf\.reports\.openNow\)\}/);
  assert.match(s, /loadsUnread \? \(\s*<WiringNote text="Couldn’t read the load times/);
  assert.doesNotMatch(s, /value=\{nf\.format\(growth\.population\./, 'no raw population number without its read check');
  const slow = read('app/admin/app-performance/_surfaces/slow-loads-surface.tsx');
  assert.match(slow, /data\.errors\.includes\(LOAD_TIMES_UNREAD\) \? 'couldn’t read how many were measured'/);
  assert.match(read('lib/telemetry/load-timing.server.ts'), /error: LOAD_TIMES_UNREAD/);
});

test('A8·H-8 · an entity row in Fastest movers says "not computed", and the footnote is true', () => {
  const s = read('app/admin/app-performance/_surfaces/overview-surface.tsx');
  assert.match(s, /notComputed: true,/);
  assert.doesNotMatch(s, /lands with the\s+Action Center PR/);
  assert.match(read('app/admin/app-performance/_components/charts.tsx'), /notComputed\s*\?\s*'not computed'/);
});

test('A8·H-9 · Operations shows when its numbers are from and says a failed read', () => {
  const s = read('app/admin/app-performance/_surfaces/operations-surface.tsx');
  assert.doesNotMatch(s, /Live — refreshed when stale/);
  assert.match(s, /about=\{signalsAbout\}/);
  assert.match(s, /stale: this view is not refreshing/);
  assert.match(s, /signalsUnread \? \(\s*<p role="alert"[^>]*>Couldn&rsquo;t read the bottleneck signals/);
  assert.match(s, /alerts === null \? \(/);
  const q = read('lib/hiring-guide/queries.ts');
  assert.match(body(q, 'readBottleneckSignals'), /return 'unread';/);
  assert.match(body(q, 'getRecentAlerts'), /if \(error\) \{[\s\S]*?return null;/);
});

test('A8·H-16 · every comparison names what it compares against', () => {
  const charts = read('app/admin/app-performance/_components/charts.tsx');
  assert.doesNotMatch(charts, /vs prev period/);
  assert.match(body(charts, 'DeltaPct'), /against: string;/);
  const files = [
    'app/admin/app-performance/_components/expenses.tsx',
    'app/admin/app-performance/_surfaces/overview-surface.tsx',
  ];
  for (const f of files) {
    const s = read(f);
    for (const m of s.matchAll(/<DeltaPct\b[^>]*\/>/g)) assert.match(m[0], /against=/, `${f}: ${m[0]}`);
  }
  assert.match(read('app/admin/app-performance/_components/expenses.tsx'), /against="vs last month"/);
  assert.match(read('app/admin/app-performance/_surfaces/funnels-surface.tsx'), /header: 'of previous step',/);
});

test('A8·I-3 · a failed settings read shows every field as "Couldn’t read" and every save is off', () => {
  const form = read('app/admin/business/_components/business-identity-form.tsx');
  const fn = body(form, 'BusinessIdentityForm');
  const unread = fn.indexOf('if (readFailed) {');
  assert.ok(unread > 0 && unread < fn.indexOf('<form action={saveBusinessIdentity}'), 'the unread branch posts no form');
  assert.match(fn, /<FactRow key=\{name\} name=\{name\} value="Couldn’t read" where=/);
  const page = read('app/admin/business/page.tsx');
  assert.match(page, /settingsReadFailed\s*\?\s*'Last updated: couldn’t read'/);
  assert.match(page, /settingsReadFailed \? \(\s*<p[^>]*data-brand-unread=""/);
  assert.match(page, /\{settingsReadFailed \? null : \(\s*<div[^>]*>\s*<BrandIconUploadForm/);
  assert.match(page, /readLoaderSettingsMeasured\(\)/);
  assert.match(page, /loaderConfig === null \? \(\s*<TemplateFail/);
});

test('A8·I-6 · the owner’s numbers are editable from Business and round-trip to saveBusinessIdentity', () => {
  const form = read('app/admin/business/_components/business-identity-form.tsx');
  const keys = [...form.matchAll(/\{ key: '([a-z0-9_]+)', name: /g)].map((m) => m[1] ?? '');
  const actions = read('app/admin/settings/actions.ts');
  const saved = new Set<string>([
    ...[...body(actions, 'saveBusinessIdentity').matchAll(/\['([a-z0-9_]+)', '[^']+', \d+\]/g)].map((m) => m[1] ?? ''),
    'trust_search_step',
  ]);
  assert.deepEqual([...keys].sort(), [...saved].sort(), 'every number the action saves has an editor, and no more');
  assert.match(form, /fieldName=\{n\.key\}/, 'each row posts its own key');
  const page = read('app/admin/business/page.tsx');
  for (const k of keys) assert.match(page, new RegExp(`${k}: num\\(`), `${k} is read into the form`);
  assert.match(page, /owner_numbers: ownerNumbers,/);
});

test('A8·L-5 · each of the nine pages has its own skeleton, and the shared one is not the old overview', () => {
  for (const p of ['work', 'offers', 'business', 'switches', 'vendor-partnerships', 'admin-log', 'ask', 'team', 'verification-docs']) {
    assert.ok(existsSync(join(WEB, `app/admin/${p}/loading.tsx`)), `/admin/${p} has no loading.tsx`);
  }
  const shared = read('app/admin/loading.tsx');
  assert.doesNotMatch(shared, /terracotta|Action queues panel|Nav tiles/);
});

test('A8·L-9 · the kit lists each admin address where it really lands', () => {
  const byRoute = new Map(shippedScreens().map((s) => [s.route, s.redirectsTo]));
  for (const old of ['/admin/discount-codes', '/admin/referrals', '/admin/spotlight-awards', '/admin/queues']) {
    const live = adminMergedForward(old);
    assert.ok(live, `${old} is not a middleware forward any more`);
    assert.equal(byRoute.get(old), live, `${old}: the kit says ${byRoute.get(old)}, the middleware sends to ${live}`);
  }
});

test('A8·P-B-3 · each supplier under review says why it is listed, and that listing charges nothing', () => {
  const s = read('app/admin/booking-fees/page.tsx');
  assert.match(s, /data-review-why=""/);
  assert.match(s, /Listed: \{r\.events\}/);
  assert.match(s, /data-review-note=""[\s\S]{0,80}Listed for review only/);
});
