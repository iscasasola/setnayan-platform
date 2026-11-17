/**
 * today-gear-rides-the-header.test.ts — ⚙ TODAY'S SETTINGS LIVE IN THE HEADER, AND ONLY THERE.
 *
 * Owner, 11 Nov (`supplier_queued_asks_2026-11-11` ask e, *"Today settings yes"*): Today's ⚙ sits top-right on the photo
 * header like Shop's and Portfolio's. Until 17 Nov it also rode onto the pinned "Needs you today" row once the header
 * scrolled away. The clean look (`prototypes/dashboards_clean_look_2026-11-16_fable.html`, owner 17 Nov on the #7901
 * preview) REMOVES that: *"Supplier: the second ⚙, pinned beside 'Needs you today'. It opens the same Today settings as
 * the hero ⚙ (DASH-05). One ⚙ stays, in the header. This undoes 'the gear rides the header'"*. Same ⚙, same sheet — the
 * ride is gone, the check stays (it now holds the new rule).
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. Exactly ONE ⚙ on Today, in the hero's top-right slot on the cover.
 *   2. The pinned Needs-you row never holds a ⚙ — it has no slot for one.
 *   3. The wiring: Today hands the cover `<TodaySettings cover />`, and the first screen no `gear`; no ride.
 *   4. One mount: `<TodaySettings` is mounted by Today's screen (the header) and the new shop's setup only. Portfolio
 *      keeps its own pin (`useHeroPin`), which this never needed.
 *
 * SABOTAGE (each run once, each went red): put a `gear` slot back on the pinned row → 2; hand the first screen a
 * `gear` again → 3; drop the cover's `gear` → 1 + 3.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import React from 'react';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const NOW = Date.UTC(2026, 10, 11, 1);
const TODAY = '2026-11-11';
const GEAR = /aria-label="Today settings"/g;

async function view() {
  const { assembleSupplierToday } = await import('@/lib/supplier-today-view');
  return assembleSupplierToday({
    needsAnswer: [], closed: [], deskIncomplete: false, upcoming: [],
    schedules: { pools: [], outside: [], complete: true }, firstSteps: null, verified: true, findable: true, findability: null,
    feeBills: [], feeEnforced: true, earnings: null, credit: null, payoutReadiness: 'unreadable', payoutHref: '/x',
    shop: { name: 'SetnaProd', categoryWord: 'Photo & video', details: { done: 6, total: 6, complete: true }, awardWord: null, milestoneWord: null },
    views: 12, inquiries28: 1, dayFacts: null, todayIso: TODAY, now: NOW, since: () => new Date(NOW),
  });
}

const parts = (html: string) => ({
  cover: html.slice(html.indexOf('data-today-cover=""'), html.indexOf('</header>')),
  pin: html.slice(html.indexOf('data-today-needs-pin=""'), html.indexOf('data-today-needs-rows')),
});

test('1 · exactly one ⚙ on Today, top-right on the header', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const v = await view();
  const html = renderToStaticMarkup(React.createElement(SupplierTodayScreen, { view: v, outcome: null, shopName: 'SetnaProd', todayIso: TODAY, now: NOW }));
  const { cover, pin } = parts(html);
  assert.ok(cover.length > 0 && pin.length > 0, 'anti-vacuity: the cover or the pinned Needs-you row did not render');
  assert.equal([...html.matchAll(GEAR)].length, 1, 'not exactly one ⚙ on Today');
  assert.match(cover, /data-supplier-hero-gear=""[\s\S]*aria-label="Today settings"/, 'the ⚙ is not in the header’s top-right slot');
});

test('2 · the pinned Needs-you row never holds a ⚙ — no slot for one', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const v = await view();
  const html = renderToStaticMarkup(React.createElement(SupplierTodayScreen, { view: v, outcome: null, shopName: 'SetnaProd', todayIso: TODAY, now: NOW }));
  const { pin } = parts(html);
  assert.doesNotMatch(pin, GEAR, 'a ⚙ sits on the pinned Needs-you row (the clean look removes it)');
  assert.doesNotMatch(pin, /data-today-needs-gear=/, 'the pinned row still has a slot for a second ⚙');
  const first = stripComments(readFileSync(join(process.cwd(), 'app/vendor-dashboard/_components/supplier-today-first-screen.tsx'), 'utf8'));
  assert.doesNotMatch(first, /data-today-needs-gear|\bgear\?: ReactNode/, 'the first screen still takes a ⚙ for the pinned row');
});

const SUPPLIER = join(process.cwd(), 'app/vendor-dashboard');
const read = (rel: string) => stripComments(readFileSync(join(SUPPLIER, rel), 'utf8'));

test('3 · Today hands the header its ⚙, and the first screen none — no ride', () => {
  const src = read('_components/supplier-today-screen.tsx');
  assert.match(src, /<TodayCover[\s\S]*?gear=\{setup \? null : <TodaySettings cover \/>\}/, 'the header no longer gets the ⚙');
  const first = src.slice(src.indexOf('<SupplierTodayFirstScreen'), src.indexOf('/>', src.indexOf('<SupplierTodayFirstScreen')));
  assert.ok(first.length > 0, 'anti-vacuity: Today no longer mounts the first screen');
  assert.doesNotMatch(first, /\bgear=/, 'the first screen is handed a ⚙ again');
  assert.doesNotMatch(src, /TodayGearRide|TodayGearSlot/, 'the ⚙ ride is back');
});

test('4 · one mount: the header and the new shop’s setup only', () => {
  const portfolio = read('collections/_components/portfolio-view.tsx');
  assert.match(portfolio, /useHeroPin\(/, 'Portfolio left the shared pin');
  const seats: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) && /<TodaySettings\b/.test(stripComments(readFileSync(p, 'utf8')))) {
        seats.push(relative(SUPPLIER, p));
      }
    }
  };
  walk(SUPPLIER);
  assert.deepEqual(seats.sort(), ['_components/supplier-today-screen.tsx', 'page.tsx'], `TodaySettings seats: ${seats.join(', ')}`);
  const page = read('page.tsx');
  assert.equal((page.match(/<TodaySettings\b/g) ?? []).length, 1, 'page.tsx mounts more than the new shop’s ⚙');
  const today = read('_components/supplier-today-screen.tsx');
  assert.equal((today.match(/<TodaySettings\b/g) ?? []).length, 1, 'Today mounts more than one ⚙');
});
