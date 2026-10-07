/**
 * home-never-reads-a-failed-read-as-on-track.test.ts — H3 of the Home redraw
 * (owner 2026-10-07, `HOME_AND_GUESTS_CHECK_2026-10-07_fable.md`; Maker PR 4e).
 *
 * The defect it pins, measured on origin/main before the redraw: a guest read
 * that THREW reached `pickHomeNext` as `null`, fell through papic → ai → plan,
 * and the couple was told "You are on track — Nothing is waiting on you". A
 * money read that failed printed "—" quietly; a thrown read must never look
 * like success or like emptiness.
 *
 *   1 · a thrown guest read → the Next card says "We couldn't read your guest
 *       list" with ⟳ Reload, never "You are on track" / "Nothing is waiting";
 *   2 · the two guest numbers become ONE "Guest counts couldn't load" tile with
 *       ⟳ Reload, never 0;
 *   3 · a failed money read is SAID on the money tile (not hidden like "not
 *       shared", never ₱0);
 *   4 · a thrown service read prints "—", never a zero count.
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
const STUB = join(process.cwd(), '__server_only_stub_home_never-reads__.js');
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

test('1 · a thrown guest read is said on the Next card, with Reload — never "on track"', () => {
  assert.equal(pickHomeNext(UNREAD).kind, 'unread');
  // Whatever else is waiting (Papic, the AI offer), an unread list comes first.
  assert.equal(pickHomeNext({ ...UNREAD, papicReady: true, aiOffer: true }).kind, 'unread');
  const html = draw(true);
  const card = html.slice(html.indexOf('data-home-next='), html.indexOf('data-home-doors'));
  assert.match(card, /We couldn’t read your guest list/);
  assert.match(card, /data-next-bad=""/, 'the card is drawn in the failure wash');
  assert.match(card, /aria-label="Reload"/, 'the card offers the read again');
  assert.doesNotMatch(words(html), /You are on track|Nothing is waiting/i, 'a failed read read as success');
  assert.match(card, /this is not “on track”/, 'the card says plainly that this is not success');
});

test('2 · the guest numbers say they could not load — one tile, with Reload, never 0', () => {
  const html = draw(true);
  const nums = html.slice(html.indexOf('data-home-numbers'), html.indexOf('data-home-money'));
  assert.match(nums, /Guest counts couldn’t load/);
  assert.match(nums, /Not zero — unread\./);
  assert.match(nums, /aria-label="Reload"/);
  assert.doesNotMatch(nums, />0</, 'an unread count printed as 0');
  assert.doesNotMatch(nums, />coming</, 'a "coming" tile drawn from a read that did not happen');
});

test('3 · a failed money read is said, not hidden and not ₱0', () => {
  const html = draw(true);
  assert.equal(count(html, 'data-home-money'), 1, 'the money tile vanished like "not shared"');
  const money = html.slice(html.indexOf('data-home-money'), html.indexOf('data-home-whats-next'));
  assert.match(money, /Money couldn’t load/);
  assert.doesNotMatch(money, /₱0/);
  // …while "not shared" (money === null) is still absent, as it was.
  assert.equal(count(draw(false, READ, { money: null, figures: { days: 72, coming: 7, noReply: 2, money: null } }), 'data-home-money'), 0);
});

test('4 · a thrown service read prints "—", never a zero count', () => {
  const html = draw(true);
  const row = html.slice(html.indexOf('data-home-services'));
  assert.equal(count(row, '>—<'), 2, 'Papic and Setnayan AI must each read "—"');
  assert.doesNotMatch(words(row), /\b0 (orders?|photos?)\b/);
});

test('the page hands a failed guest read to the picker as null — never as an empty list', () => {
  const page = src('page.tsx');
  assert.match(page, /guests: homeGuestsRead\(guests, guestsMeasured\),/);
  assert.match(page, /figures=\{facts\.figures\}/, 'the money and guest measurements reach the render');
  const facts = stripComments(readFileSync(join(HERE, '..', '..', '..', 'lib', 'home-facts.ts'), 'utf8'));
  assert.match(facts, /money === null \? 'unread'/, 'a failed money read must arrive as "unread", not as no tile');
});
