/**
 * today-pins-needs-you-today.test.ts — 📌 TODAY HAS ONE PINNED ROW, AND IT IS "NEEDS YOU TODAY" (Build 5 · Lane A slice 2).
 *
 * Owner, 10 Nov, on the Supplier Menu Plan (Today, scrolled): *"Needs you today is the correct one to be pinned rather
 * than the row above it."* DECISION_LOG 2026-11-10 📌 "SUPPLIER TODAY: NEEDS YOU TODAY IS THE PINNED ROW — NOT THE
 * GREETING ROW ABOVE IT"; Build 5 plan Step 0 row 31 (guard: exactly one sticky row, `[data-today-needs] .hc-k2`).
 *
 * ── THE PROPERTIES ──────────────────────────────────────────────────────────
 *   1. Today draws EXACTLY ONE sticky row, and it is the Needs-you-today heading (`.hc-k2` inside `[data-today-needs]`)
 *      with its count and the ⚙ SLOT at its right end; it joins the pin line (`data-pinned-row`). Since 11 Nov (owner
 *      *"Today settings yes"*) the ONE ⚙ is on the header until it scrolls away, so the server render's slot is empty —
 *      the ride itself is held by `today-gear-rides-the-header.test.ts`.
 *   2. The greeting, the cover and the stats scroll away — no `CollapsingTop` locks them (the greeting's pinned row is
 *      not drawn at all). The cover's ONE control is Today's ⚙, in the hero's top-right slot.
 *   3. A new shop (the six steps take the top, no ⚙ handed in): the Needs heading does NOT pin — the setup heading is
 *      that page's pinned row.
 *
 * SABOTAGE (each run once, each went red): put `CollapsingTop` back around the cover → 1 + 2; drop `sticky` from the
 * heading → 1; draw the ⚙ on the pinned row while the header is up → 1 (and the ride guard).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request.endsWith('.css') || request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

async function render(setup: boolean): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const { assembleSupplierToday } = await import('@/lib/supplier-today-view');
  const NOW = Date.UTC(2026, 10, 10, 1);
  const TODAY = '2026-11-10';
  const view = assembleSupplierToday({
    needsAnswer: [], closed: [], deskIncomplete: false, upcoming: [],
    schedules: { pools: [], outside: [], complete: true }, firstSteps: null, verified: true, findable: true, findability: null,
    feeBills: [], feeEnforced: true, earnings: null, credit: null, payoutReadiness: 'unreadable', payoutHref: '/x',
    shop: { name: 'SetnaProd', categoryWord: 'Photo & video', details: { done: 6, total: 6, complete: true }, awardWord: null, milestoneWord: null },
    views: 12, inquiries28: 1, dayFacts: null, todayIso: TODAY, now: NOW, since: () => new Date(NOW),
  });
  return renderToStaticMarkup(
    React.createElement(SupplierTodayScreen, {
      view, outcome: null, shopName: 'SetnaProd', todayIso: TODAY, now: NOW,
      setup: setup ? React.createElement('section', { 'data-probe-setup': '' }, 'six steps') : null,
    }),
  );
}

/** Every element whose class list says `sticky` — the open tag, whole. */
const stickies = (html: string) => [...html.matchAll(/<[a-z]+\b[^>]*\bclass="(?:[^"]*\s)?sticky(?:\s[^"]*)?"[^>]*>/g)].map((m) => m[0]);

test('1 · exactly one sticky row on Today, and it is the Needs-you-today heading with its ⚙ slot', async () => {
  const html = await render(false);
  assert.match(html, /data-today-needs=""/, 'anti-vacuity: Needs you today did not render');
  const pins = stickies(html);
  assert.equal(pins.length, 1, `Today draws ${pins.length} sticky rows, not one:\n${pins.join('\n')}`);
  const pin = pins[0]!;
  assert.match(pin, /\bhc-k2\b/, 'the sticky row is not the `.hc-k2` heading');
  assert.match(pin, /data-today-needs-pin=""/);
  assert.match(pin, /data-pinned-row=""/, 'the pinned row does not join the pin line');
  // It sits INSIDE [data-today-needs] — the list header, pinned while its rows scroll under it.
  const needsAt = html.indexOf('data-today-needs=""');
  const pinAt = html.indexOf(pin);
  assert.ok(needsAt >= 0 && pinAt > needsAt && pinAt < html.indexOf('data-today-needs-rows'), 'the pinned row is not the Needs-you-today heading');
  const row = html.slice(pinAt, html.indexOf('data-today-needs-rows'));
  assert.match(row, /Needs you today/);
  assert.match(row, /data-today-needs-gear=""/, 'the pinned row lost its ⚙ slot at its right end');
  assert.doesNotMatch(row, /aria-label="Today settings"/, 'Today’s ⚙ sits beside the hours while the header is on screen');
  assert.equal([...html.matchAll(/aria-label="Today settings"/g)].length, 1, 'not exactly one ⚙ on Today');
});

test('2 · the greeting, the cover and the stats scroll away — nothing locks them', async () => {
  const html = await render(false);
  assert.match(html, /data-today-cover=""/, 'anti-vacuity: the cover did not render');
  assert.match(html, /data-today-stats=""/, 'anti-vacuity: the stats did not render');
  assert.doesNotMatch(html, /data-today-top=|data-today-stats-top=|\bsn-ct\b/, 'a CollapsingTop still locks the cover or the stats');
  assert.doesNotMatch(html, /data-today-pinned-row=|data-today-stats-pinned=/, 'the greeting’s (or the stats’) pinned row is still drawn');
  const cover = html.slice(html.indexOf('data-today-cover'), html.indexOf('</header>'));
  const controls = [...cover.matchAll(/<(?:button|a)\b[^>]*>/g)].map((m) => m[0]);
  assert.equal(controls.length, 1, `the cover holds ${controls.length} controls, not just Today’s ⚙:\n${controls.join('\n')}`);
  assert.match(controls[0]!, /aria-label="Today settings"/, 'the cover’s one control is not Today’s ⚙');
});

test('3 · a new shop: the six steps take the top and the Needs heading does not pin', async () => {
  const html = await render(true);
  assert.match(html, /data-probe-setup=""/, 'anti-vacuity: the setup did not render');
  assert.equal(stickies(html).length, 0, 'the Needs heading pins over a new shop’s own pinned setup heading');
  assert.doesNotMatch(html, /aria-label="Today settings"/, 'a second ⚙ beside the setup’s own');
});
