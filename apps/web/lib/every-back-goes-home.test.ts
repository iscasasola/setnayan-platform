/**
 * every-back-goes-home.test.ts — EVERY PAGE GOES BACK TO THE RIGHT HOME, AND NOTHING NEW BREAKS THE RULES.
 *
 * Owner, 28 Oct 2026 (DECISION_LOG "EVERY PAGE GOES BACK TO THE RIGHT HOME AND FOLLOWS THE DESIGN RULES"):
 * *"so many of the pages has or might have wrong back links. it should be fixed. some also does not need
 * back links."* · *"we want everything mapped and following rules and templates"*.
 *
 * What it holds:
 *   1. THE MAP IS TOTAL AND TRUE. Every page on disk (lib/design-rules-scan.ts `listPages`) gets a home from
 *      `lib/page-home.ts` that is a live page — never a redirect stub, never a retired page — or an honest
 *      "no back". No `HOMES` entry is stale.
 *   2. THE MAP'S BAR ROOTS ARE TODAY'S BARS — read from the shipped account, event, supplier and admin bars.
 *   3. EVERY BACK LINK GOES HOME. `<BackButton route=…>` names its own page; every `href` back link (the
 *      shared button's deprecated `href`, and the ad-hoc ones) lands on `pageHome(route)`. Today's
 *      disagreements are baselined and RATCHET DOWN: a new one fails, a fixed one must leave the baseline.
 *   4. NO NEW AD-HOC BACK. Per file, today's count of back links drawn by hand instead of `BackButton`;
 *      a new one fails, a removed one must leave the baseline (strict both ways).
 *   5. NO NEW RAW COLOUR OR RAW <select>. Per file, raw hex / raw Tailwind palette colours / `<select>`
 *      may never rise above today's count, and a new file starts at zero.
 *
 * The baseline (`lib/design-rules.baseline.json`) is GENERATED — `pnpm --filter @setnayan/web
 * design-rules:baseline --write` — never hand-edited.
 *
 * Sabotage (each must fail): point a HOMES entry at a redirect stub (`/vendor-dashboard/clients`); drop a
 * tab from BAR_ROOTS; put `href="/"` back on a token page; add an ad-hoc "← Back" Link to a page; add a
 * `#123456` to a page; add a `<select>` to a page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';

import { stripComments } from '@/lib/strip-comments';
import { buildCustomerMenuTree } from '@/lib/customer-menu';
import { customerLandingHref } from '@/app/vendor-dashboard/customers/anchors';
import { BAR_ROOTS, HOMES, fillRoute, pageBackLink, pageHome } from '@/lib/page-home';
import { WEB } from '@/lib/design-rules-scan';
import {
  BASELINE_PATH,
  adHocCounts,
  backFindings,
  designCounts,
  mapProblems,
  type Baseline,
} from '@/lib/design-rules-findings';

(globalThis as unknown as { React: unknown }).React = React;

const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const pathOf = (href: string) => href.split(/[?#]/)[0]!;
const sorted = (xs: Iterable<string>) => [...new Set(xs)].sort();

const baseline: Baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const REGEN = 'regenerate: pnpm --filter @setnayan/web design-rules:baseline --write';

/* ── 1 · the map ─────────────────────────────────────────────────────────────────────────────────────── */

test('every page on disk has a home that is a live page — or an honest "no back"', () => {
  const problems = mapProblems();
  assert.deepEqual(problems, [], `lib/page-home.ts:\n  ${problems.join('\n  ')}`);
});

test('the map decides the way it says it does', () => {
  // a bar root draws no back
  assert.deepEqual(pageHome('/dashboard/[eventId]/guests'), { kind: 'none', reason: 'bar-root' });
  assert.deepEqual(pageHome('/vendor-dashboard/shop'), { kind: 'none', reason: 'bar-root' });
  // a one-time token page draws no back
  assert.deepEqual(pageHome('/papic/me/[token]'), { kind: 'none', reason: 'token' });
  // an exact entry beats a pattern, a longer pattern beats a shorter one
  assert.equal((pageHome('/dashboard/[eventId]/studio/papic/recap') as { home: string }).home, '/dashboard/[eventId]/memories');
  assert.equal((pageHome('/dashboard/[eventId]/studio/papic/crew') as { home: string }).home, '/dashboard/[eventId]');
  assert.equal((pageHome('/dashboard/[eventId]/website/living-hero') as { home: string }).home, '/dashboard/[eventId]/website/hero-photo');
  assert.equal((pageHome('/dashboard/[eventId]/website/stories') as { home: string }).home, '/dashboard/[eventId]/launch');
  // otherwise the page it sits under
  assert.deepEqual(pageHome('/dashboard/[eventId]/guests/new'), { kind: 'home', home: '/dashboard/[eventId]/guests', label: 'Guests' });
  // a guest page goes to ITS event's hub, never the marketing front page
  for (const r of ['/papic/guest', '/papic/decorate', '/join/[eventId]', '/[slug]/invite/reply']) {
    assert.equal((pageHome(r) as { home: string }).home, '/[slug]', r);
  }
  // params fill; a missing one is a bug, never `/undefined`
  assert.deepEqual(pageBackLink('/dashboard/[eventId]/story', { eventId: 'S89E-1' }), { href: '/dashboard/S89E-1/launch', label: 'Hub' });
  assert.throws(() => fillRoute('/dashboard/[eventId]', {}), /no value for \[eventId\]/);
});

test('the supplier folds the map names are the shipped Customers landings', () => {
  // 2026-10-28 · a supplier chat goes back to the Customers EVENTS list (People), where it was opened from (C1).
  assert.equal((pageHome('/vendor-dashboard/messages/[threadId]') as { home: string }).home, '/vendor-dashboard/customers?seg=people');
  assert.equal((pageHome('/vendor-dashboard/contracts/[contractId]') as { home: string }).home, customerLandingHref('contracts'));
});

test('BackButton draws the map: the home on a page with one, nothing on a page without', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { BackButton } = await import('@/app/_components/back-button');
  const story = renderToStaticMarkup(React.createElement(BackButton, { route: '/dashboard/[eventId]/story', params: { eventId: 'E1' } }));
  assert.match(story, /href="\/dashboard\/E1\/launch"/);
  assert.match(story, />Hub</);
  const token = renderToStaticMarkup(React.createElement(BackButton, { route: '/papic/me/[token]' }));
  assert.equal(token, '', 'a token page draws no back');
  const legacy = renderToStaticMarkup(React.createElement(BackButton, { href: '/admin/settings', label: 'Back to settings' }));
  assert.match(legacy, /href="\/admin\/settings"/, 'the deprecated href still works');
});

/* ── 2 · the bars ────────────────────────────────────────────────────────────────────────────────────── */

/** The `href: '…'` values at `indent` inside the block that opens at `anchor` (to its closing `};` / `];`). */
function hrefsAfter(rel: string, anchor: RegExp, indent: string): string[] {
  const s = src(rel);
  const at = s.search(anchor);
  assert.ok(at >= 0, `${rel}: ${anchor} moved — point this reader at the bar`);
  const ends = [s.indexOf('\n};', at), s.indexOf('\n];', at)].filter((i) => i > 0);
  const block = s.slice(at, Math.min(...ends));
  return [...block.matchAll(new RegExp(`^${indent}href: '([^']+)'`, 'gm'))].map((m) => m[1]!);
}

test('the map’s bar roots are today’s bars', () => {
  const account = hrefsAfter('app/dashboard/(launcher)/_components/account-bottom-nav.tsx', /const TAB: Record<AccountBarTab/, '    ');
  // The account bar's Shop tab is the supplier's Today — it lands in the supplier set.
  assert.deepEqual(sorted(account.map(pathOf).filter((p) => p !== '/vendor-dashboard')), sorted(BAR_ROOTS.account));
  assert.ok(account.map(pathOf).includes('/vendor-dashboard') && (BAR_ROOTS.supplier as readonly string[]).includes('/vendor-dashboard'));

  const event = buildCustomerMenuTree('[eventId]', { websiteEnabled: true, seatingEnabled: true }).map((t) => pathOf(t.href));
  assert.deepEqual(sorted(event), sorted(BAR_ROOTS.event));

  const supplier = hrefsAfter('app/vendor-dashboard/_components/vendor-nav-destinations.ts', /export const VENDOR_DESTINATIONS/, '    ');
  assert.deepEqual(sorted(supplier), sorted(BAR_ROOTS.supplier));

  const admin = hrefsAfter('app/admin/_components/admin-bottom-nav.tsx', /export const ADMIN_BOTTOM_NAV_ITEMS: BottomNavItem\[\] = \[/, '    ');
  assert.deepEqual(sorted(admin), sorted(BAR_ROOTS.admin));
});

/* ── 3 · every back link goes home ──────────────────────────────────────────────────────────────────── */

test('every back link lands on the map’s home — today’s exceptions ratchet DOWN', () => {
  const found = backFindings().map((f) => f.key);
  const known = new Set(baseline.wrongBacks);
  const fresh = found.filter((k) => !known.has(k));
  assert.deepEqual(
    fresh,
    [],
    `A back link disagrees with lib/page-home.ts. Use <BackButton route="<this page>" params={…} />, or point it at the home the map names (or fix the map, if the map is wrong):\n  ${fresh.join('\n  ')}`,
  );
  const now = new Set(found);
  const fixed = baseline.wrongBacks.filter((k) => !now.has(k));
  assert.deepEqual(fixed, [], `Fixed — drop these from the baseline (${REGEN}):\n  ${fixed.join('\n  ')}`);
});

test('no route= on a BackButton names another page — and none is baselined', () => {
  assert.equal(baseline.wrongBacks.filter((k) => k.includes('BackButton route=')).length, 0);
});

/* ── 4 · no new ad-hoc back ─────────────────────────────────────────────────────────────────────────── */

test('no NEW ad-hoc back link — the shared BackButton draws every back; the hand-drawn ones ratchet DOWN', () => {
  const now = adHocCounts();
  const up = Object.entries(now)
    .filter(([f, n]) => n > (baseline.adHocBacks[f] ?? 0))
    .map(([f, n]) => `${f}: ${baseline.adHocBacks[f] ?? 0} → ${n}`);
  assert.deepEqual(up, [], `A back link drawn by hand. Use <BackButton route="<this page>" … /> (app/_components/back-button.tsx):\n  ${up.join('\n  ')}`);
  const down = Object.entries(baseline.adHocBacks)
    .filter(([f, n]) => (now[f] ?? 0) < n)
    .map(([f, n]) => `${f}: ${n} → ${now[f] ?? 0}`);
  assert.deepEqual(down, [], `Paid down — lower the baseline (${REGEN}):\n  ${down.join('\n  ')}`);
});

/* ── 5 · no new raw colour, no new raw <select> ─────────────────────────────────────────────────────── */

for (const [rule, fix] of [
  ['hex', 'a colour token (tailwind.config / globals.css), never a raw #rrggbb'],
  ['palette', 'a colour token, never a raw Tailwind palette colour (text-red-600 …)'],
  ['select', 'PickMenu (app/_components/pick-menu), never a raw <select>'],
] as const) {
  test(`no file draws more raw ${rule} than it did — ${fix}`, () => {
    const now = designCounts()[rule];
    const up = Object.entries(now)
      .filter(([f, n]) => n > (baseline[rule][f] ?? 0))
      .map(([f, n]) => `${f}: ${baseline[rule][f] ?? 0} → ${n}`);
    assert.deepEqual(up, [], `Use ${fix}:\n  ${up.join('\n  ')}`);
  });
}

test('the baseline is the generator’s, not a hand edit', () => {
  assert.ok(existsSync(BASELINE_PATH));
  assert.match(baseline._, /^GENERATED by/);
  for (const rule of ['adHocBacks', 'hex', 'palette', 'select'] as const) {
    const keys = Object.keys(baseline[rule]);
    assert.deepEqual(keys, [...keys].sort(), `${rule} keys are sorted as the generator writes them`);
    assert.ok(Object.values(baseline[rule]).every((n) => Number.isInteger(n) && n > 0), `${rule}: positive counts only`);
  }
  assert.deepEqual(baseline.wrongBacks, [...baseline.wrongBacks].sort());
  assert.ok(Object.keys(HOMES).length > 0);
});
