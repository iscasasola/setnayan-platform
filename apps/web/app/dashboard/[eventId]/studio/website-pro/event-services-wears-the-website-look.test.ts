/**
 * event-services-wears-the-website-look.test.ts — 🔒 EVENT SERVICES IN THE WEBSITE'S LOOK (owner 23 Nov 2026, "Yes,
 * approve" on the v5 redraw: specs DECISION_LOG "EVENT SERVICES v5 (WEBSITE TEMPLATE) APPROVED, WITH THE TODAY DOOR",
 * drawing `prototypes/buy_event_services_one_place_2026-11-23/frames_v5_website/` + `strip-v5.jpg`; HOUSE_DESIGN_STANDARD
 * Part H). The functions are v4's and stay held by their own guards; this file holds only the LOOK:
 *
 *   1 · the sheet is the page's alone: every rule scoped to the page or its two layers on <body> (the cart bar, the
 *       Apple step), loaded by the page and the lab
 *       (never globals, never a unit-rendered part), made of existing tokens — no hex, no rgb() literal, no motion;
 *   2 · a white page, and none of the forbidden looks: no peach band, no floating lifted card, no coloured side stripe;
 *   3 · plan rows split by hairlines, each pack with its tick circle, the saving an outlined tag;
 *   4 · the ⓘ opens the pack's list IN PLACE in a note box — no Sheet, no hover note;
 *   5 · ONE terracotta: Pay is the one main button; every other button on the page is a quiet hairline pill.
 *
 * SABOTAGE (each seen red once, 24 Nov, then restored): the white-page rule removed (2) · `<Tick />` dropped from the
 * pack row (3) · the ⓘ list moved back into a `<Sheet>` (4) · `quiet` dropped from the Switch button (5).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { EventServicesView } from './_components/event-services-view';
import { PLAN_PRICE_CODES } from '@/lib/event-plans';
import { stripComments } from '@/lib/strip-comments';
import type { EventServicesFacts, PackFact, PackKey } from '@/lib/event-services';

(globalThis as unknown as { React: unknown }).React = React;
const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..', '..', '..');
const read = (...rel: string[]) => readFileSync(join(WEB, ...rel), 'utf8');
const sheet = () => stripComments(readFileSync(join(HERE, '_components', 'event-services-website.css'), 'utf8'));
const view = () => stripComments(readFileSync(join(HERE, '_components', 'event-services-view.tsx'), 'utf8'));

/* TEST INPUTS — odd figures on purpose. */
const pack = (key: PackKey, php: number, over: Partial<PackFact> = {}): PackFact => ({
  key,
  code: PLAN_PRICE_CODES[key],
  name: key === 'plus' ? 'Event Plus' : key === 'pro' ? 'Event Pro' : 'Event Ultra',
  credits: 1000,
  addsCredits: 1000,
  php,
  upgrade: false,
  state: 'buy',
  savePhp: 77,
  fits: null,
  info: ['Everything in Event Plus', 'A seventh line nobody types'],
  ...over,
});
const facts: EventServicesFacts = {
  eyebrow: 'Ana & Miguel · Sat 12 Dec 2026',
  plan: 'free',
  planName: 'Free',
  photosLeft: 151,
  packs: [pack('plus', 1234), pack('pro', 2345), pack('ultra', 5678)],
  singles: [
    { key: 'hub', code: 'EVENT_HUB', php: 1111, state: 'buy' },
    { key: 'ai', code: 'SETNAYAN_AI', php: 2222, state: 'buy' },
    { key: 'live', code: 'LIVE_STUDIO', php: 3333, state: 'buy' },
  ],
  photos: [{ code: 'PAPIC_GUEST_1K', points: 1000, php: 444 }],
};
const draw = (over: Record<string, unknown> = {}) =>
  renderToStaticMarkup(React.createElement(EventServicesView, { eventId: 'EVENT', facts, ordersHref: '/dashboard/EVENT/orders', lab: true, ...over }));

test('1 · the sheet is the page’s alone, loaded where the page draws, and made of tokens', () => {
  const css = sheet();
  for (const rule of css.split('}').map((r) => r.trim()).filter(Boolean)) {
    const selector = rule.slice(0, rule.indexOf('{')).trim();
    assert.match(selector, /\[data-event-services(-cart|-apple-step)?\]/, `a rule reaches past Event services: ${selector}`);
  }
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/i, 'a typed hex colour');
  assert.doesNotMatch(css, /\brgba?\(\s*\d/, 'a typed rgb() colour');
  assert.doesNotMatch(css, /\b\d+ms\b|cubic-bezier|transition|animation/, 'the page’s look grew a motion of its own');
  assert.match(stripComments(read('app', 'dashboard', '[eventId]', 'studio', 'website-pro', 'page.tsx')), /import '\.\/_components\/event-services-website\.css';/, 'the page does not load the sheet');
  assert.match(stripComments(read('app', 'dev', 'pro-parts-lab', 'page.lab.tsx')), /event-services-website\.css'/, 'the lab no longer shows what the page shows');
  assert.doesNotMatch(read('app', 'globals.css'), /event-services-website/, 'the sheet was folded into the global stylesheet');
  assert.doesNotMatch(view(), /\.css'/, 'the view imports CSS (it is unit-rendered with no CSS loader)');
});

test('2 · a white page, and none of the forbidden looks', () => {
  const css = sheet();
  assert.match(css, /html:not\(\.dark\):has\(\[data-event-services\]\)\s*\{\s*--sn-page-bg: var\(--color-raised\);/, 'the page is not white');
  assert.doesNotMatch(css, /box-shadow:(?!\s*(?:0 0 0 2px|none))/, 'a lifted (shadowed) card is back');
  assert.doesNotMatch(css, /border-left/, 'a coloured side stripe is back');
  assert.doesNotMatch(view(), /sn-frame|shadow-sn|bg-peach|band/, 'a framed card or band is back in the view');
});

test('3 · plan rows split by hairlines; each pack wears its tick circle; the saving is an outlined tag', () => {
  const css = sheet();
  assert.match(css, /\.es-rows > \.es-item \+ \.es-item \{\s*border-top: 1px solid var\(--web-line\);/, 'the rows are no longer split by a hairline');
  assert.match(css, /\.es-tag \{[^}]*border: 1px solid currentColor/, 'the tag is not outlined');
  const html = draw({ initialPick: { pack: 'pro', singles: [], photos: null } });
  for (const k of ['plus', 'pro', 'ultra']) {
    const row = html.slice(html.indexOf(`data-event-services-pack="${k}"`));
    assert.match(row.slice(0, row.indexOf('</li>')), /class="es-tick"/, `${k}: the pack row lost its tick circle`);
  }
  assert.match(html, /class="es-item es-on"[^>]*data-event-services-pack="pro"/, 'the picked pack is not marked on');
  assert.match(html, /<em class="es-tag">Save ₱77<\/em>/, 'the saving is not the outlined tag');
});

test('4 · the ⓘ opens the pack’s list in place, in a note box — no Sheet', () => {
  const v = view();
  assert.doesNotMatch(v, /<Sheet\b|from '@\/app\/_components\/sheet'|InfoTip/, 'the ⓘ list moved back into a sheet or a hover note');
  const shut = draw();
  assert.doesNotMatch(shut, /data-event-services-info="/, 'a list is open with nothing tapped');
  assert.match(shut, /data-event-services-info-open="pro"[^>]*>|aria-expanded="false"/, 'the ⓘ lost its hook');
  const open = draw({ initialInfo: 'pro' });
  const row = open.slice(open.indexOf('data-event-services-pack="pro"'));
  const li = row.slice(0, row.indexOf('data-event-services-pack="ultra"'));
  assert.match(li, /class="es-note es-note-list" data-event-services-info="pro"/, 'the list is not a note box inside the row');
  assert.match(li, /A seventh line nobody types/, 'the note box does not carry the pack’s own list');
});

test('5 · ONE terracotta: Pay is the main button; every other button is a quiet pill', () => {
  const v = view();
  const buttons = [...v.matchAll(/<ActionButton\b[\s\S]*?\/>/g)].map((m) => m[0]);
  assert.ok(buttons.length >= 3, 'the view’s buttons were not found');
  const mains = buttons.filter((b) => /\bmain\b/.test(b));
  assert.equal(mains.length, 1, 'more than one main (terracotta) button');
  assert.match(mains[0] ?? '', /data-event-services-pay/, 'the one main button is not Pay');
  for (const b of buttons.filter((x) => !/\bmain\b/.test(x))) assert.match(b, /\bquiet\b/, `a button is not a quiet pill: ${b.slice(0, 80)}`);
  assert.match(sheet(), /\[data-event-services\] :is\(button, a\)\.ab\.ab\.ab\.quiet \{[^}]*border: 1px solid var\(--web-line\);/, 'the quiet pill lost its hairline');
});
