/**
 * home-has-no-go-elsewhere-links.test.ts — H5 of the Home redraw (owner
 * 2026-09-28 "no go-edit-elsewhere links", 2026-10-07 HOME_AND_GUESTS H5; Maker
 * PR 4e). The Home's controls sit in place or are a button that opens the
 * thing: no "→" / "↗" link copy, no "View your full checklist →", no "Open the
 * list ↗", no "Edit in X". Checked on the RENDER, in every state, and on the
 * source of the three files that draw the Home (the dashboard's What's next
 * branch included).
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
const STUB = join(process.cwd(), '__server_only_stub_home_go-elsewhere__.js');
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

// "›" is allowed: the owner's own money line reads "0% paid · Budget ›" (2026-10-07) —
// the tile itself is the door; the chevron marks it, it does not send you to edit elsewhere.
const ARROWS = /[→↗»]|&rarr;|&#x2197;|\bEdit in\b/;

test('no arrow link copy on the rendered Home — read, failed, and every Next card', () => {
  const kinds: HomeNextInput[] = [
    READ,
    UNREAD,
    { ...READ, guide: { done: 9, total: 20, stageTitle: 'Invitation', stageDone: 4, stageTotal: 8 } },
    { ...READ, hasDate: false },
    { ...READ, guests: { total: 0, unsent: 0 } },
    { ...READ, guests: { total: 14, unsent: 0 }, papicReady: true },
    { ...READ, guests: { total: 14, unsent: 0 }, aiOffer: true },
    { ...READ, guests: { total: 14, unsent: 0 } },
  ];
  for (const k of kinds) {
    for (const unread of [false, true]) {
      const html = draw(unread, k);
      assert.doesNotMatch(words(html), ARROWS, `${pickHomeNext(k).kind}${unread ? ' (unread)' : ''}: a go-elsewhere arrow`);
    }
  }
});

test('the Home\'s source draws no arrow link copy', () => {
  const dash = src('_components/event-dashboard.tsx');
  const branch = dash.slice(dash.indexOf("if (only === 'whatsnext')"), dash.indexOf('const inspectorMaster'));
  assert.ok(branch.length > 50, 'the Home branch of What\'s next is gone');
  for (const [file, text] of [
    ['home-first-screen.tsx', src('_components/home-first-screen.tsx')],
    ['home-parts.tsx', src('_components/home-parts.tsx')],
    ['event-dashboard.tsx (What\'s next)', branch],
  ] as const) {
    // String and JSX text only — not `=>` arrows in code.
    const copy = (text.match(/(['"`])(?:(?!\1)[^\\]|\\.)*\1|>[^<{}]+</g) ?? []).join(' ');
    assert.doesNotMatch(copy, ARROWS, `${file}: go-elsewhere copy`);
  }
});

test('every control on the Home is a button with icon + word', () => {
  const html = draw(false);
  const tags = html.match(/<(?:a|button) [^>]*>/g) ?? [];
  // The tiles are whole-tile doors (numbers, money, services) and the What's next row;
  // everything else is an ActionButton (class "ab …") with its word in aria-label.
  const plain = tags.filter((t) => !/class="ab |class="home-tile|class="home-card|class="home-bar/.test(t));
  assert.deepEqual(plain, [], 'a control that is neither an ActionButton nor a Home tile');
  for (const t of tags.filter((x) => x.includes('class="ab '))) assert.match(t, /aria-label="[^"]+"/);
});
