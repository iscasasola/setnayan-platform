/**
 * home-shows-every-paid-service.test.ts — 🧾 EVERY PAID SERVICE HAS EXACTLY ONE HOME ROW STATE.
 *
 * Owner, 2026-10-14 (DECISION_LOG "HOME › YOUR SERVICES = THE PAID SERVICES + EVENT HUB PRO; FREE TOOLS
 * STAY OUT" + "APPROVE ALL: THE SERVICES PROTOTYPE"): Guest photos · Planner · Live stream · Music ·
 * Video booth · Event Hub Pro — owned with their state, not added as one slim "· ₱<catalog> · Add" line.
 * Owner, live on cale-ice 2026-10-20, seeing only Guest photos and Planner: *"i thought we will have our
 * other paid services here in home?"* — the row had only ever been built for those two (2026-10-01).
 *
 * The PROPERTY held here, not a phrasing: for every paid service the one list names
 * (`lib/service-names.ts` SERVICE_NAMES + Event Hub Pro), across every combination of what the page can
 * read (on · waiting · not added · read failed · no read), offered or not, sellable today or not, priced or
 * not, in the store shell or not — the service lands in EXACTLY ONE state (`homePaidState`), and Home draws
 * exactly one row for it unless that state is the event's own "absent" (not offered / the day has passed /
 * the store shell). A new service in SERVICE_NAMES with no Home row turns this red. "Left off" at onboarding
 * (`lib/event-needs.ts`) can never hide one: Papic is always on, and no other paid service is a need — and
 * whatever IS left off keeps its ONE "Switch on more" row.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import { SERVICE_NAMES } from '@/lib/service-names';
import { EVERY_ADD_ON, ADD_ONS, type AddOnEntry } from '@/lib/add-ons-catalog';
import {
  HOME_PAID_CARD,
  HOME_PAID_KEYS,
  HOME_PAID_SKU,
  homePaidState,
  homeServices,
  glanceCount,
  glanceDays,
  glanceMoney,
  pickHomeNext,
  type HomePaidState,
  type HomeSkuKey,
  type HomeNextInput,
} from '@/lib/home-first-screen';
import { homePaidFacts, type HomeSkuRead } from '@/lib/home-paid-services';
import { NEED_PRESETS, needOn, needRows, needsForPreset, switchOnRows } from '@/lib/event-needs';
import type { HomeFirstScreenProps } from './_components/home-first-screen';

(globalThis as unknown as { React: unknown }).React = React;
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_home_paid__.js');
{
  const stub = new CjsModule(STUB);
  stub.filename = STUB;
  stub.loaded = true;
  stub.exports = {};
  stub.paths = [];
  CjsModule._cache[STUB] = stub;
  const original = CjsModule._resolveFilename;
  CjsModule._resolveFilename = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return STUB;
    return original.call(this, request, ...rest);
  };
}
let Screen: typeof import('./_components/home-first-screen').HomeFirstScreen | null = null;
test.before(async () => {
  Screen = (await import('./_components/home-first-screen')).HomeFirstScreen;
});

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..', '..', '..');
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const E = 'e1';
const SKU_KEYS = HOME_PAID_KEYS.filter((k): k is HomeSkuKey => k !== 'papic');
const STATES: readonly HomePaidState[] = ['owned', 'pending', 'add', 'open', 'unread', 'absent'];

const ON: HomeSkuRead = { active: true, pending: false };
const OFF: HomeSkuRead = { active: false, pending: false };
const WAIT: HomeSkuRead = { active: false, pending: true };
const FAILED: HomeSkuRead = { active: null, pending: null };
const READS = { ON, OFF, WAIT, FAILED, NONE: undefined } as const;
type ReadName = keyof typeof READS;
const PRICE: Record<HomeSkuKey, string> = { ai: '₱11', live: '₱22', music: '₱33', booth: '₱44 / day', hub: '₱55' };

/** The catalogue entry each row stands for — whichever of a card's keys the catalogue holds first. */
function entryOf(key: HomeSkuKey, catalogue: ReadonlyArray<AddOnEntry>): AddOnEntry | undefined {
  const keys = key === 'hub' ? ['website-pro'] : key === 'live' ? ['live-studio-roam', 'panood'] : [({ ai: 'setnayan-ai', music: 'pakanta', booth: 'patiktok' } as const)[key]];
  return keys.map((k) => catalogue.find((a) => a.key === k)).find(Boolean);
}

test('1 · the six rows are the one list of services, plus Event Hub Pro — none forgotten', () => {
  const cards = new Set(Object.values(HOME_PAID_CARD));
  for (const k of Object.keys(SERVICE_NAMES)) {
    assert.ok(k === 'papic' || cards.has(k), `SERVICE_NAMES has "${k}" but Home has no row for it (HOME_PAID_CARD)`);
  }
  assert.deepEqual([...HOME_PAID_KEYS], ['papic', 'ai', 'live', 'music', 'booth', 'hub'], 'the approved order');
  for (const k of SKU_KEYS) assert.ok(HOME_PAID_SKU[k], `no catalogue SKU for ${k}`);
  assert.equal(HOME_PAID_SKU.hub, 'COUPLE_WEBSITE_PRO');
});

test('2 · every combination → exactly one state per service, and exactly one row unless "absent"', () => {
  let combos = 0;
  for (const catalogue of [EVERY_ADD_ON, ADD_ONS]) {
    for (const readName of Object.keys(READS) as ReadName[]) {
      for (const priced of [true, false]) {
        for (const offered of [true, false]) {
          for (const sellable of [true, false]) {
            for (const aiSellable of [true, false]) {
              for (const storeShell of [false, true]) {
                const reads = Object.fromEntries(SKU_KEYS.map((k) => [HOME_PAID_SKU[k], READS[readName]]));
                const prices = new Map(priced ? SKU_KEYS.map((k) => [HOME_PAID_SKU[k], PRICE[k]] as const) : []);
                const facts = homePaidFacts({
                  eventId: E,
                  catalogue,
                  reads,
                  prices,
                  offered: () => offered,
                  // Reality's rule (`addOnSellableNow`): only a day-of service stops selling.
                  sellableNow: (e) => sellable || !e.dayOfOnly,
                  aiSellable,
                  refusesPath: () => false,
                });
                const rows = homeServices({ next: 'plan', storeShell, papic: 'x', ai: 'y', eventId: E, paid: facts });
                for (const key of SKU_KEYS) {
                  combos++;
                  const state = homePaidState(facts[key]);
                  const where = `${key} read=${readName} priced=${priced} offered=${offered} sellable=${sellable} aiSellable=${aiSellable} shell=${storeShell}`;
                  assert.ok(STATES.includes(state), `${where}: no state`);
                  const drawn = rows.filter((r) => r.key === key);
                  assert.equal(drawn.length, storeShell || state === 'absent' ? 0 : 1, `${where}: ${drawn.length} rows for state ${state}`);
                  if (drawn[0]) assert.equal(drawn[0].paid?.state, state, `${where}: the row draws another state`);

                  // The oracle — what the state MUST be.
                  const entry = entryOf(key, catalogue);
                  const isOffered = Boolean(entry) && offered;
                  const dayGone = Boolean(entry?.dayOfOnly) && !sellable && key !== 'hub';
                  const r = READS[readName];
                  let want: HomePaidState;
                  if (!isOffered) want = 'absent';
                  // Setnayan AI with no price for this kind is not offered unless already theirs (the More menu's rule).
                  else if (key === 'ai' && !aiSellable && !(r?.active || r?.pending)) want = 'absent';
                  else if (!r || r.active === null) want = 'unread';
                  else if (r.active) want = 'owned';
                  else if (r.pending) want = 'pending';
                  else if (dayGone) want = 'absent';
                  else if (entry?.tier === 'free') want = 'open';
                  else want = 'add';
                  assert.equal(state, want, where);

                  if (state === 'add') {
                    const words = drawn[0]?.paid?.price ?? (storeShell ? PRICE[key] : '');
                    if (!storeShell) assert.ok(priced ? words.includes(PRICE[key]) : words === 'See the price', `${where}: slim words "${words}"`);
                    assert.doesNotMatch(words, /₱0\b|\bFree$/, `${where}: an unknown price reads as free`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  assert.ok(combos > 1000, `only ${combos} combinations walked — the sweep is broken`);
});

test('3 · what an event leaves off never hides a paid service, and keeps its Switch on more', () => {
  const paidNeeds = needRows({ marketplace: true }).filter((r) => (HOME_PAID_KEYS as readonly string[]).includes(r));
  assert.deepEqual(paidNeeds, ['papic'], 'only Papic is a need, and it has no switch');
  for (const p of NEED_PRESETS) {
    const n = needsForPreset(p, { marketplace: true });
    assert.equal(needOn('papic', n), true, `${p}: Papic must stay on`);
    const off = switchOnRows({ ...n }, { marketplace: true });
    const html = draw({ needs: { ...n, switchOn: off } });
    if (off.length > 0) assert.equal(html.split('data-home-switch-on').length - 1, 1, `${p}: what is off must keep its ONE Switch on more row`);
    assert.equal(html.split('data-home-paid=').length - 1, 5, `${p}: a need preset hid a paid row`);
  }
  // homeServices takes no needs at all — nothing the onboarding left off can reach these rows.
  const fn = src('lib/home-first-screen.ts');
  const body = fn.slice(fn.indexOf('export function homeServices'), fn.indexOf('export function glanceLineText'));
  assert.doesNotMatch(body, /needs/, 'homeServices must not read the event needs');
});

const ALL_ON = homePaidFacts({
  eventId: E,
  catalogue: EVERY_ADD_ON,
  reads: Object.fromEntries(SKU_KEYS.map((k) => [HOME_PAID_SKU[k], ON])),
  prices: new Map(),
  offered: () => true,
  sellableNow: () => true,
  aiSellable: true,
  refusesPath: () => false,
});
const NONE_ADDED = homePaidFacts({
  eventId: E,
  catalogue: EVERY_ADD_ON,
  reads: Object.fromEntries(SKU_KEYS.map((k) => [HOME_PAID_SKU[k], OFF])),
  prices: new Map(SKU_KEYS.map((k) => [HOME_PAID_SKU[k], PRICE[k]] as const)),
  offered: () => true,
  sellableNow: () => true,
  aiSellable: true,
  refusesPath: () => false,
});
const NOTHING: HomeNextInput = { guide: null, hasDate: true, guests: { total: 96, unsent: 0 }, noun: 'wedding', papicReady: false, aiOffer: false };

function draw(over: Partial<HomeFirstScreenProps> = {}, paid = ALL_ON, storeShell = false): string {
  const props: HomeFirstScreenProps = {
    eventId: E,
    cover: { eyebrow: 'Wedding · December 18, 2026', name: 'Cale & Ice' },
    next: pickHomeNext(NOTHING),
    days: glanceDays(59),
    coming: glanceCount(96, true),
    noReply: glanceCount(35, true),
    noReplyWaiting: true,
    money: { paid: glanceMoney(1000), owing: glanceMoney(500) },
    services: homeServices({ next: 'plan', storeShell, papic: 'On · 12 photos', ai: 'Try it', eventId: E, paid }),
    ...over,
  };
  return renderToStaticMarkup(React.createElement(Screen!, props));
}
const tagOf = (html: string, key: string) => html.match(new RegExp(`<div[^>]*data-home-service="${key}"[^>]*>[\\s\\S]*?</div>\\s*</div>`))?.[0] ?? '';

test('4 · an event that owns everything (cale-ice: an internal host) draws all six, each with its state', () => {
  const html = draw();
  for (const key of ['papic', ...SKU_KEYS]) assert.match(html, new RegExp(`data-home-service="${key}"`), `${key} missing`);
  assert.equal(html.split('data-home-paid="owned"').length - 1, 5, 'five owned rows besides Papic');
  assert.doesNotMatch(html, /Not added/, 'nothing is "not added" on an event that owns it all');
  assert.match(tagOf(html, 'hub'), /Pro on/, 'Event Hub Pro says it is on');
  assert.match(html, /href="\/dashboard\/e1\/launch"[^>]*aria-label="Open the Maker"|aria-label="Open the Maker"[^>]*href="\/dashboard\/e1\/launch"/, 'Pro opens the Maker');
  assert.match(html, /aria-label="Open controller"/, 'Live stream offers its controller');
});

test('5 · nothing added: one "Not added" heading, each service ONE slim line with its catalogue price and Add', () => {
  const html = draw({}, NONE_ADDED);
  assert.equal(html.split('>Not added<').length - 1, 1, 'the heading appears once');
  for (const key of SKU_KEYS) {
    const row = tagOf(html, key);
    assert.match(row, /data-slim=""/, `${key} is not the slim line`);
    assert.ok(row.includes(PRICE[key]), `${key} does not carry its catalogue price`);
    assert.match(row, /aria-label="Add"/, `${key} has no Add`);
  }
  // Owned rows come before the slim lines (prototype: owned, then Not added).
  assert.ok(html.indexOf('data-home-service="papic"') < html.indexOf('>Not added<'));
});

test('6 · the iPhone app (store shell) draws no paid row — nothing sold there but through Apple', () => {
  const html = draw({}, ALL_ON, true);
  assert.equal(html.split('data-home-paid=').length - 1, 0);
  assert.equal(homeServices({ next: 'plan', storeShell: true, papic: 'x', ai: 'y', eventId: E, paid: NONE_ADDED }).length, 0);
});

test('7 · the page hands Home every fact, and no price is typed in the row code', () => {
  const page = src('app/dashboard/[eventId]/page.tsx');
  assert.match(page, /const homePaidRead = startAhead\(/, 'the paid reads are started with the rest');
  assert.match(page, /paid: homePaidFactsNow,/, 'Home is handed the paid facts');
  for (const sku of ['live', 'music', 'booth', 'hub']) assert.match(page, new RegExp(`HOME_PAID_SKU\\.${sku}`), `the page never reads ${sku}`);
  assert.match(page, /getCustomerSkuPriceLabel\(sku\)/, 'prices come from the catalogue');
  for (const f of ['lib/home-first-screen.ts', 'lib/home-paid-services.ts', 'app/dashboard/[eventId]/_components/home-first-screen.tsx']) {
    assert.doesNotMatch(src(f), /₱\s?\d/, `${f} types a peso figure`);
  }
});
