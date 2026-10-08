/**
 * home-words.test.ts — H4 of the Home redraw (owner 2026-10-07; Maker PR 4e).
 * The couple's Home says "supplier" never "vendor", "event" never
 * "celebration", "Event Hub" never "website" — on what a person READS (text,
 * aria-label, title) in every state, and in every word `pickHomeNext` can say.
 * (`/vendors` in an href is a route, not a word, and is not read.)
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
const STUB = join(process.cwd(), '__server_only_stub_home_words__.js');
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

const BANNED = /\bvendors?\b|\bcelebrations?\b|\bweb ?sites?\b/i;

test('the rendered Home never says vendor, celebration or website', () => {
  for (const unread of [false, true]) {
    const html = draw(unread);
    assert.doesNotMatch(words(html), BANNED, unread ? 'failed state' : 'read state');
  }
});

test('no Next card says vendor, celebration or website', () => {
  const inputs: HomeNextInput[] = [
    READ,
    UNREAD,
    { ...READ, guide: { done: 1, total: 2, stageTitle: 'Invitation', stageDone: 0, stageTotal: 1, offer: true } },
    { ...READ, guide: { done: 1, total: 2, stageTitle: 'Invitation', stageDone: 0, stageTotal: 1 } },
    { ...READ, hasDate: false },
    { ...READ, hasDate: false, noun: 'event' },
    { ...READ, guests: { total: 0, unsent: 0 } },
    { ...READ, guests: { total: 1, unsent: 0 }, papicReady: true },
    { ...READ, guests: { total: 1, unsent: 0 }, aiOffer: true },
    { ...READ, guests: { total: 1, unsent: 0 } },
  ];
  for (const i of inputs) {
    const n = pickHomeNext(i);
    assert.doesNotMatch(`${n.title} ${n.body} ${n.action}`, BANNED, n.kind);
  }
});

test('the Home\'s own copy (source strings) says supplier, event, Event Hub', () => {
  for (const f of ['_components/home-first-screen.tsx', '_components/home-parts.tsx']) {
    const text = src(f);
    const copy = (text.match(/>[^<{}]+</g) ?? []).join(' ') + ' ' + (text.match(/label[:=]\s*['"`][^'"`]*['"`]/g) ?? []).join(' ');
    assert.doesNotMatch(copy, BANNED, f);
  }
  assert.match(src('_components/home-first-screen.tsx'), /Budget ›/, 'the money line names where it opens (owner: "0% paid · Budget ›")');
});
