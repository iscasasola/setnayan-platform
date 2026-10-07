/**
 * home-numbers-count.test.ts — H2 of the Home redraw (owner 2026-10-07:
 * *"all numbers on the app will animate going to that number … upon load or
 * change"*, BUTTON_RULE rule 2/3; Maker PR 4e).
 *
 * days to go · coming · no reply · Paid · Still owing render through the shared
 * `Count`, and the paid bar through `Fill` (`components/count.tsx`, PR #6400) —
 * the ONE engine, keyed by a stable id so a re-render does not replay and only a
 * real change moves. Rendered here: each figure carries its `data-count` id and
 * the final value (SSR prints the value, so a phone with JS off still reads true).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import {
  aiStatus,
  glanceCount,
  glanceDays,
  glanceMoney,
  homeServices,
  papicStatus,
  pickHomeNext,
  type HomeNextInput,
} from '@/lib/home-first-screen';
import type { HomeFirstScreenProps } from './_components/home-first-screen';

// 🪤 The repo's render harness (see the-home-leads-with-one-next.test.ts): React global
// before the dynamic import, and a `server-only` shim for the tour action.
(globalThis as unknown as { React: unknown }).React = React;
type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_home_numbers-count__.js');
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
let WhatsNext: typeof import('./_components/home-parts').HomeWhatsNext | null = null;
test.before(async () => {
  Screen = (await import('./_components/home-first-screen')).HomeFirstScreen;
  WhatsNext = (await import('./_components/home-parts')).HomeWhatsNext;
});
const HERE = dirname(fileURLToPath(import.meta.url));
const src = (rel: string) => stripComments(readFileSync(join(HERE, ...rel.split('/')), 'utf8'));

const READ: HomeNextInput = { guide: null, hasDate: true, guests: { total: 14, unsent: 3 }, noun: 'wedding', papicReady: false, aiOffer: false };
const UNREAD: HomeNextInput = { ...READ, guests: null };

/** The Home as the page draws it — `unread` = every read failed. */
function draw(unread: boolean, input: HomeNextInput = unread ? UNREAD : READ, over: Partial<HomeFirstScreenProps> = {}): string {
  const next = pickHomeNext(input);
  const props: HomeFirstScreenProps = {
    eventId: 'e1',
    cover: { eyebrow: 'Wedding · Fri, Dec 18, 2026', name: 'Cale & Ice' },
    next,
    days: glanceDays(72),
    coming: glanceCount(7, !unread),
    noReply: glanceCount(2, !unread),
    noReplyWaiting: !unread,
    money: { paid: glanceMoney(unread ? null : 0), owing: glanceMoney(unread ? null : 1_056_000) },
    figures: {
      days: 72,
      coming: unread ? null : 7,
      noReply: unread ? null : 2,
      money: unread ? 'unread' : { paid: 0, owing: 1_056_000 },
    },
    services: homeServices({
      next: next.kind,
      storeShell: false,
      papic: papicStatus({ permitted: true, tile: unread ? 'failed' : { photosGathered: 0, preCapture: true } }),
      ai: aiStatus(unread ? null : false),
    }),
    whatsNext: React.createElement(WhatsNext!, {
      open: 3,
      rows: [
        { id: 'b', title: 'Book a supplier', sub: 'Catering · 2 quotes in', href: '/dashboard/e1/vendors', verb: 'book', cta: 'Book' },
        { id: 'p', title: 'Settle a payment', sub: 'Seda · ₱528,000', href: '/dashboard/e1/vendors', verb: 'pay', cta: 'Pay' },
        { id: 'r', title: 'Fill a role', sub: 'Emcee · nobody picked yet', href: '/dashboard/e1/guests', verb: 'role', cta: 'Pick' },
      ],
      checklist: { href: '/dashboard/e1/checklist', pct: 47 },
    }),
    ...over,
  };
  return renderToStaticMarkup(React.createElement(Screen!, props));
}
/** What a person reads: the markup's text plus every aria-label / title. */
const words = (html: string) =>
  [html.replace(/<[^>]+>/g, ' '), ...(html.match(/(?:aria-label|title)="[^"]*"/g) ?? [])].join(' ');
const count = (html: string, needle: string) => html.split(needle).length - 1;

const IDS = ['home-days', 'home-coming', 'home-noreply', 'home-paid', 'home-owing'] as const;

test('the five numbers render through Count, each with its own id and its true value', () => {
  const html = draw(false);
  const value = (id: string) => html.match(new RegExp(`data-count="${id}"[^>]*>([^<]*)<`))?.[1] ?? null;
  for (const id of IDS) assert.equal(count(html, `data-count="${id}"`), 1, `${id} is not a Count`);
  assert.equal(value('home-days'), '72');
  assert.equal(value('home-coming'), '7');
  assert.equal(value('home-noreply'), '2');
  assert.equal(value('home-paid'), '₱0');
  assert.equal(value('home-owing'), '₱1,056,000');
  assert.equal(count(html, 'data-count="home-paid-pct"'), 1, 'the % paid counts too');
  assert.equal(count(html, 'data-count="home-open-n"'), 1, 'What\'s next · N open counts too');
});

test('the paid bar grows through Fill', () => {
  const html = draw(false, READ, { figures: { days: 72, coming: 7, noReply: 2, money: { paid: 250_000, owing: 750_000 } } });
  assert.match(html, /class="meter-fill[^"]*"[^>]*style="width:25%"[^>]*data-fill="home-paid"|data-fill="home-paid"/);
  assert.match(html, /width:25%/, 'the bar stands for 25% paid');
  assert.equal(count(html, 'data-fill="home-paid"'), 1);
});

test('the Home takes Count and Fill from the ONE shared engine — no second counter', () => {
  const screen = src('_components/home-first-screen.tsx');
  assert.match(screen, /import \{ Count, Fill \} from '@\/components\/count';/);
  for (const id of IDS) assert.match(screen, new RegExp(`id="${id}"`), `${id} is not wired to Count`);
  assert.doesNotMatch(screen + src('_components/home-parts.tsx'), /requestAnimationFrame|setInterval/, 'a second animation engine on Home');
});

test('a word ("Today", "—") is printed, not counted', () => {
  const html = draw(false, READ, { days: { value: 'Today', label: 'is the day' }, figures: { days: null, coming: 7, noReply: 2, money: { paid: 0, owing: 1 } } });
  assert.equal(count(html, 'data-count="home-days"'), 0);
  assert.match(html, />Today</);
});
