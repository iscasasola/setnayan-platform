/**
 * today-gear-rides-the-header.test.ts — ⚙ TODAY'S SETTINGS LIVE IN THE HEADER, AND RIDE THE PINNED ROW.
 *
 * Owner, 11 Nov, approving ask e of the Supplier queued-asks prototype (`supplier_queued_asks_2026-11-11`, *"shouldn't
 * today's settings be inside header"*): *"Today settings yes"*. Today's ⚙ sits top-right on the photo header like
 * Shop's and Portfolio's; once the header has scrolled away it rides onto the right end of the pinned "Needs you today"
 * row — Portfolio's shipped `pin` (`useHeroPin`), the house pinned-row template. It is no longer beside the hours
 * ("N · 12 MN – 12 MN") mid-page. Same ⚙, same sheet — only its place moves.
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. Header on screen (the server render / first paint): exactly ONE ⚙, in the hero's top-right slot on the cover;
 *      none on the pinned Needs-you row, none anywhere else.
 *   2. Header gone: the ONE ⚙ is on the pinned Needs-you row's right end (after the hours), and the cover has none.
 *   3. The wiring: Today hands the cover the `cover` slot and the Needs-you row the `pin` slot, inside ONE
 *      `TodayGearRide`; a new shop hands neither (its six steps draw their own ⚙).
 *   4. One mechanism, one mount: the ride uses Portfolio's `useHeroPin` (Portfolio still does too), and
 *      `<TodaySettings` is mounted only by the ride (plus the new shop's setup ⚙ on the page) — no second ⚙ component.
 *
 * SABOTAGE (each run once, each went red): hand `<TodaySettings />` straight to the first screen's `gear` again → 1 + 3
 * + 4; drop the cover's `gear` → 1 + 3; invert the slot test in `TodayGearSlot` → 1 + 2; Portfolio back on its own
 * scroll listener → 4.
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
  hours: html.indexOf('12 MN – 12 MN'),
});

test('1 · header on screen: the one ⚙ is top-right on the header, never beside the hours', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const v = await view();
  const html = renderToStaticMarkup(React.createElement(SupplierTodayScreen, { view: v, outcome: null, shopName: 'SetnaProd', todayIso: TODAY, now: NOW }));
  const { cover, pin } = parts(html);
  assert.ok(cover.length > 0 && pin.length > 0, 'anti-vacuity: the cover or the pinned Needs-you row did not render');
  assert.equal([...html.matchAll(GEAR)].length, 1, 'not exactly one ⚙ on Today');
  assert.match(cover, /data-supplier-hero-gear=""[\s\S]*aria-label="Today settings"/, 'the ⚙ is not in the header’s top-right slot');
  assert.doesNotMatch(pin, GEAR, 'the ⚙ sits on the pinned Needs-you row (beside the hours) while the header is up');
  assert.match(pin, /data-today-needs-gear=""/, 'the pinned row lost the slot the ⚙ rides onto');
});

test('2 · header gone: the one ⚙ rides the pinned Needs-you row’s right end', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayFirstScreen } = await import('./supplier-today-first-screen');
  const { TodayCover } = await import('./today-cover');
  const { TodayGearPinned, TodayGearSlot } = await import('./today-gear-ride');
  const v = await view();
  const slot = (at: 'cover' | 'pin') => React.createElement(TodayGearSlot, { at });
  const screen = React.createElement(SupplierTodayFirstScreen, {
    cover: React.createElement(TodayCover, { shopName: 'SetnaProd', tasks: 3, todayIso: TODAY, now: NOW, gear: slot('cover') }),
    gear: slot('pin'),
    needs: v.needs, needsCount: 3, comingUp: v.comingUp, shop: v.shop,
  });
  const html = renderToStaticMarkup(React.createElement(TodayGearPinned.Provider, { value: true }, screen));
  const { cover, pin, hours } = parts(html);
  assert.ok(cover.length > 0 && hours > 0, 'anti-vacuity: the cover or the hours did not render');
  assert.equal([...html.matchAll(GEAR)].length, 1, 'not exactly one ⚙ once the header has gone');
  assert.doesNotMatch(cover, GEAR, 'the ⚙ stayed on a header that has scrolled away');
  assert.match(pin, /data-today-needs-gear=""[\s\S]*aria-label="Today settings"/, 'the ⚙ is not on the pinned row');
  assert.ok(html.search(GEAR) > hours, 'the ⚙ is not at the pinned row’s right end (after the count)');
});

const SUPPLIER = join(process.cwd(), 'app/vendor-dashboard');
const read = (rel: string) => stripComments(readFileSync(join(SUPPLIER, rel), 'utf8'));

test('3 · Today hands the header and the pinned row the two slots of ONE ride', () => {
  const src = read('_components/supplier-today-screen.tsx');
  assert.equal((src.match(/<TodayGearRide>/g) ?? []).length, 1, 'Today is not wrapped in exactly one TodayGearRide');
  assert.match(src, /<TodayCover[\s\S]*?gear=\{setup \? null : <TodayGearSlot at="cover" \/>\}/, 'the header no longer gets the ⚙');
  assert.match(src, /<SupplierTodayFirstScreen[\s\S]*?gear=\{setup \? null : <TodayGearSlot at="pin" \/>\}/, 'the pinned row no longer gets the ⚙ slot');
  assert.doesNotMatch(src, /<TodaySettings\b/, 'Today mounts the ⚙ directly again, outside the ride');
});

test('4 · Portfolio’s pin is the one mechanism, and the ride is the one Today mount', () => {
  const ride = read('_components/today-gear-ride.tsx');
  assert.match(ride, /useHeroPin\(/, 'Today’s ⚙ does not ride Portfolio’s pin');
  assert.match(ride, /pin >= 0\.5/, 'the ride’s hand-off point drifted from Portfolio’s (pin ≥ 0.5)');
  const portfolio = read('collections/_components/portfolio-view.tsx');
  assert.match(portfolio, /useHeroPin\(/, 'Portfolio left the shared pin (two mechanisms for one hand-off)');
  assert.doesNotMatch(portfolio, /addEventListener\('scroll'/, 'Portfolio grew its own scroll listener again');

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
  assert.deepEqual(seats.sort(), ['_components/today-gear-ride.tsx', 'page.tsx'], `TodaySettings seats: ${seats.join(', ')}`);
  // page.tsx's one mount is the NEW SHOP's setup ⚙ (`SupplierSetupScreen gear`), never the running Today.
  const page = read('page.tsx');
  assert.equal((page.match(/<TodaySettings\b/g) ?? []).length, 1, 'page.tsx mounts more than the new shop’s ⚙');
});
