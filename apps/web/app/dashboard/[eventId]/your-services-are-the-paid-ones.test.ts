/**
 * GUARD — HOME › "YOUR SERVICES" IS THE PAID SERVICES + EVENT HUB PRO, AND
 * NOTHING ELSE (owner 2026-10-14 🧾 "Paid + Event Hub Pro"; ✅ "approve all", the
 * services prototype `renderHome()`).
 *
 * Pins, each where it would break without a sound:
 *   1. the rows are the six — papic · ai · live · music · booth · hub — and a
 *      free tool (Budget, Date finder, the Maker, Chat, Guest list, Seating) is
 *      never one, by key or by name;
 *   2. OWNED rows come first, full size, in the one order; then "Not added" —
 *      slim rows with the price under the name and Add;
 *   3. the iPhone app (store shell) shows owned rows only, as status — no door to
 *      a web-only page, no buy button, no "Not added";
 *   4. NEVER TWICE: the song card's doors are drawn on the music row but marked
 *      to stand down while that card shows; the AI offer card and a not-added
 *      Planner row never stand together.
 *
 * Rendered with the REAL `HomeFirstScreen` and the REAL glances.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { glanceCount, glanceDays, glanceMoney, homeServices, pickHomeNext, type HomeNextInput } from '@/lib/home-first-screen';
import {
  FREE_TOOLS_NEVER_ROWS,
  SERVICE_ROW_ORDER,
  boothGlance,
  hubProGlance,
  liveGlance,
  musicGlance,
  plannerGlance,
  type ServiceRowGlance,
} from '@/lib/services-glance';
import type { HomeFirstScreenProps } from './_components/home-first-screen';

(globalThis as unknown as { React: unknown }).React = React;
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_your_services__.js');
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

const BASE: HomeNextInput = { guide: null, hasDate: true, guests: { total: 32, unsent: 12 }, noun: 'wedding', papicReady: false, aiOffer: false };
const DAY = 'Saturday, 19 December';

/** The prototype's default sample: Planner, Live stream, Music and Hub Pro owned; the booth not added. */
function rows(over: Partial<Record<ServiceRowGlance['key'], 'none' | 'on' | 'waiting'>> = {}): ServiceRowGlance[] {
  const o = { ai: 'on', live: 'on', music: 'on', booth: 'none', hub: 'on', ...over } as const;
  return [
    plannerGlance({ ownership: o.ai, price: 2499, day: 'before', suppliers: 7 }),
    liveGlance({ ownership: o.live, price: 2500, screenPrice: 3000, day: 'before', cameras: 3, live: false, recorded: false, dayWords: DAY }),
    musicGlance({ ownership: o.music, price: 2500, day: 'before', offered: true, song: 'ready', playing: true }),
    boothGlance({ ownership: o.booth, price: 1500, day: 'before', reels: null, dayWords: DAY }),
    hubProGlance({ ownership: o.hub, price: 5000, theme: 'Vintage', background: 'video background' }),
  ];
}

function home(r: ServiceRowGlance[], opts: { storeShell?: boolean; next?: Partial<HomeNextInput> } = {}): string {
  const input = { ...BASE, ...opts.next };
  const next = pickHomeNext(input);
  const props: HomeFirstScreenProps = {
    eventId: 'e1',
    cover: { eyebrow: 'Wedding', name: 'Maria & Jose' },
    next,
    nextAfter: next.kind === 'music' ? pickHomeNext({ ...input, music: false }) : null,
    storeShell: opts.storeShell ?? false,
    days: glanceDays(66),
    coming: glanceCount(21, true),
    noReply: glanceCount(7, true),
    noReplyWaiting: true,
    money: { paid: glanceMoney(0), owing: glanceMoney(0) },
    services: homeServices({ next: next.kind, storeShell: opts.storeShell ?? false, papic: '1,240 credits left', ai: 'Try it', rows: r }),
  };
  return renderToStaticMarkup(React.createElement(Screen!, props));
}

const servicesOf = (html: string) => html.slice(html.indexOf('data-home-services'));
const keysIn = (html: string) => [...servicesOf(html).matchAll(/data-home-service="([^"]+)"/g)].map((m) => m[1]!);

test('1 · the rows are the six paid services — never a free tool, by key or by name', () => {
  assert.equal(SERVICE_ROW_ORDER.length, 6);
  const html = home(rows({ booth: 'none' }));
  for (const k of keysIn(html)) {
    assert.ok((SERVICE_ROW_ORDER as readonly string[]).includes(k) || k === 'nikah', `"${k}" is a row but not a paid service`);
  }
  const names = servicesOf(html);
  for (const tool of FREE_TOOLS_NEVER_ROWS) {
    assert.ok(!keysIn(html).includes(tool), `${tool} is a free tool — never a "Your services" row`);
  }
  for (const word of ['Budget', 'Date finder', 'Chat', 'Guest list', 'Seating']) {
    assert.doesNotMatch(names.replace(/<[^>]+>/g, ' '), new RegExp(`\\b${word}\\b`), `"${word}" is drawn among Your services`);
  }
});

test('2 · owned first, full size, in the one order — then "Not added", slim, price under the name + Add', () => {
  const html = home(rows({ booth: 'none', live: 'none' }));
  assert.deepEqual(keysIn(html), ['papic', 'ai', 'music', 'hub', 'live', 'booth']);
  const notAdded = html.indexOf('data-home-not-added');
  assert.ok(notAdded > html.indexOf('data-home-service="hub"'), '"Not added" must follow every owned row');
  const slim = html.slice(html.indexOf('data-home-service="booth"'));
  assert.match(slim, /^data-home-service="booth" data-ownership="none"/);
  assert.match(slim.slice(0, 1500), /Free to record · <b>₱1,500<\/b> to save &amp; share/, 'the slim row says its price under the name');
  assert.match(slim.slice(0, 2500), /data-testid="service-buy-booth"/, 'the slim row has no Add');
  const full = html.slice(html.indexOf('data-home-service="ai"'), html.indexOf('data-home-service="music"'));
  assert.match(full, /Planner on · <b>7 suppliers watched<\/b>/);
});

test('3 · the iPhone app: owned rows only, as status — no door to a web-only page, no buy button', () => {
  const html = home(rows({ booth: 'none' }), { storeShell: true });
  assert.deepEqual(keysIn(html), ['papic', 'ai', 'live', 'music', 'hub'], 'a service not added is offered in the app');
  const svc = servicesOf(html);
  assert.doesNotMatch(svc, /data-home-not-added/);
  assert.doesNotMatch(svc, /data-testid="service-buy-/, 'a buy button in the store shell');
  assert.doesNotMatch(svc, /href="\/dashboard\/e1\/studio\//, 'a door to a web-only page in the store shell');
  assert.doesNotMatch(svc, /setnayan\.com/, 'the app must never point at the web to buy');
});

test('4 · never twice: the song card\'s doors stand down on the music row while it shows; the AI offer card has no Planner row beside it', () => {
  const song = home(rows(), { next: { music: true } });
  assert.match(song, /data-home-next="music"/);
  const row = song.slice(song.indexOf('data-home-service="music"'));
  assert.match(row.slice(0, 4000), /<span data-while-next="music" class="contents">/, 'the row dropped its doors instead of marking them');
  assert.match(song, /data-home-next-slot="after"/, 'no card waits under the song card — hearing it would leave Home without a step');
  const offer = home(rows({ ai: 'none' }), { next: { aiOffer: true, guests: { total: 32, unsent: 0 } } });
  assert.match(offer, /data-home-next="ai"/);
  assert.ok(!keysIn(offer).includes('ai'), 'the AI offer card and a Planner row stand together');
});
