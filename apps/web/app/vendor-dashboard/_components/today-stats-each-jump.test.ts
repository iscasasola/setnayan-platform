/**
 * today-stats-each-jump.test.ts — 📊 TODAY'S FIVE STATS EACH JUMP (THE ONE BUILD A4, A2 guard 4; v103/v104 "stats jump",
 * retiring DL 2026-10-28 "counts FILTER in place" on Today).
 *
 *   · five links, to five places: Views → Shop · Inquiries → Clients › Asked · Booked → Clients › Booked ·
 *     Portfolio → Portfolio · Money → the money ledger (To collect);
 *   · the words the owner ruled: "last 28 days" (the read IS 28 days — WRONG row 19) and "to come in" (WRONG row 23);
 *   · a figure that could not be read says "couldn’t load" — never 0, never ₱0; the Portfolio count draws no figure
 *     until C4's `getPortfolioCount` lands (never a guessed count).
 *
 * ⤴ SUCCEEDS `the-counts-filter-in-place.test.ts` (retired with the counts row it held, THE ONE BUILD A5): DL 2026-10-28
 * "counts FILTER in place" is superseded on Today by v103/v104 "stats jump" (corpus SUPPLIER_DASHBOARD_BUILD_PLAN
 * 2026-11-08). Its honesty claim — an unread payday says "couldn't load", never ₱0 — is test 3 here.
 *
 * SABOTAGE (seen red once): a null Money drawn as ₱0 → 3 red; Booked pointed at `/vendor-dashboard` → 1 red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TODAY_STAT_HREFS, TodayStats, todayStatsOf } from './today-stats';

(globalThis as unknown as { React: unknown }).React = React;
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();

test('1 · five links to five places', () => {
  const html = renderToStaticMarkup(React.createElement(TodayStats, { stats: { views: 1240, inquiries: 4, booked: 6, portfolio: { used: 32, free: 50 }, toComeInPhp: 48000 } }));
  const links = [...html.matchAll(/<a[^>]*href="([^"]+)"[^>]*data-today-stat="(\w+)"|<a[^>]*data-today-stat="(\w+)"[^>]*href="([^"]+)"/g)].map((m) => [m[2] ?? m[3], (m[1] ?? m[4])!.replace(/&amp;/g, '&')]);
  assert.deepEqual(links.map(([id]) => id), ['views', 'inquiries', 'booked', 'portfolio', 'money']);
  assert.deepEqual(Object.fromEntries(links), {
    views: '/vendor-dashboard/shop',
    inquiries: '/vendor-dashboard/customers?door=asking',
    booked: '/vendor-dashboard/customers?door=booked',
    portfolio: '/vendor-dashboard/collections',
    money: TODAY_STAT_HREFS.money,
  });
  assert.match(TODAY_STAT_HREFS.money, /^\/vendor-dashboard\/customers\?seg=money/, 'Money does not open the money ledger');
  assert.equal(new Set(Object.values(TODAY_STAT_HREFS)).size, 5, 'two stats share a door');
});

test('2 · the ruled words', () => {
  const t = text(renderToStaticMarkup(React.createElement(TodayStats, { stats: { views: 1240, inquiries: 4, booked: 6, portfolio: { used: 32, free: 50 }, toComeInPhp: 48000 } })));
  assert.match(t, /1,240 Views last 28 days/);
  assert.match(t, /4 Inquiries asked · last 28 days/);
  assert.match(t, /6 Booked this month/);
  assert.match(t, /32 of 50 Portfolio free photos/);
  assert.match(t, /₱48K Money to come in/);
  assert.doesNotMatch(t, /to collect|this month.*Views/, 'the money stat says "to collect" (WRONG row 23)');
});

test('3 · an unread figure says "couldn’t load" — never 0 or ₱0', () => {
  const stats = todayStatsOf({ views: null, inquiries: null, booked: null, portfolio: null, toComeInPhp: null });
  for (const s of stats) {
    assert.equal(s.figure, null, `${s.id}: a figure is drawn over an unread read`);
    assert.equal(s.line, 'couldn’t load', `${s.id}: an unread read is not said`);
  }
  const t = text(renderToStaticMarkup(React.createElement(TodayStats, { stats: { views: null, inquiries: 0, booked: null, portfolio: undefined, toComeInPhp: null } })));
  assert.doesNotMatch(t, /₱0/);
  assert.match(t, /0 Inquiries/, 'a real zero is still drawn');
  // Not wired yet ≠ refused: the Portfolio stat draws no figure and no failure until C4's count lands.
  const p = todayStatsOf({ views: 1, inquiries: 1, booked: 1, portfolio: undefined, toComeInPhp: 1 }).find((s) => s.id === 'portfolio')!;
  assert.equal(p.figure, null);
  assert.notEqual(p.line, 'couldn’t load');
});
