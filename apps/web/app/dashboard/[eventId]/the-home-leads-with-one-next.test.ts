/**
 * the-home-leads-with-one-next.test.ts — 2026-10-01.
 *
 * Owner-APPROVED 2026-10-01 (DECISION_LOG "THE SIMPLE PHONE APP — APPROVED",
 * frame 1 "Home"): ONE "Next" card → an always-there **Edit your Event Hub**
 * button → three numbers + one Paid / Still owing line. Nothing else above the
 * fold on a 390 × 844 phone.
 *
 * Three properties, each RENDERED (not grepped) where it can be — the harness
 * is the neighbouring render tests' (`globalThis.React`, dynamic import):
 *   a · exactly one Next card, and it leads the Home's plan branch;
 *   b · the Edit your Event Hub button is drawn in every state;
 *   c · a read that did not happen prints "—", never 0;
 *   d · "Your services" (Papic · Setnayan AI, owner 2026-10-01): present, "—"
 *       on a failed read, never the service that is already the Next card,
 *       absent in the store shell.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { stripComments } from '@/lib/strip-comments';
import {
  HOME_NEXT_ORDER,
  aiStatus,
  homeServices,
  papicStatus,
  glanceCount,
  glanceDays,
  glanceMoney,
  pickHomeNext,
  type HomeNextInput,
} from '@/lib/home-first-screen';
import type { HomeFirstScreenProps } from './_components/home-first-screen';

// 🪤 The repo's render harness: `"jsx": "preserve"` compiles to the classic
// runtime, so `React` must be global BEFORE the component is (dynamically) imported.
(globalThis as unknown as { React: unknown }).React = React;
let Screen: typeof import('./_components/home-first-screen').HomeFirstScreen | null = null;
test.before(async () => {
  Screen = (await import('./_components/home-first-screen')).HomeFirstScreen;
});

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));

const NOTHING: HomeNextInput = { guide: null, hasDate: true, noun: 'wedding', papicReady: false, aiOffer: false };
const GUIDE = { round: 2, roundTitle: 'Invitations', done: 3, total: 7, nextTitle: 'Schedule' };

/** One input per kind, so every branch of the picker is drawn. */
const EVERY_STATE: HomeNextInput[] = [
  { ...NOTHING, guide: GUIDE, hasDate: false, papicReady: true, aiOffer: true },
  { ...NOTHING, hasDate: false, papicReady: true, aiOffer: true },
  { ...NOTHING, papicReady: true, aiOffer: true },
  { ...NOTHING, aiOffer: true },
  NOTHING,
];

function draw(over: Partial<HomeFirstScreenProps> = {}, input: HomeNextInput = NOTHING): string {
  const props: HomeFirstScreenProps = {
    eventId: 'e1',
    cover: { eyebrow: 'Wedding · March 13, 2027', name: 'Ana & Miguel' },
    next: pickHomeNext(input),
    days: glanceDays(163),
    coming: glanceCount(96, true),
    noReply: glanceCount(35, true),
    noReplyWaiting: true,
    money: { paid: glanceMoney(120000), owing: glanceMoney(45000) },
    services: homeServices({
      next: pickHomeNext(input).kind,
      storeShell: false,
      papic: papicStatus({ permitted: true, tile: { photosGathered: 12, preCapture: false } }),
      ai: aiStatus(false),
    }),
    ...over,
  };
  return renderToStaticMarkup(React.createElement(Screen!, props));
}

const count = (html: string, needle: string) => html.split(needle).length - 1;

test('the picker walks the order the Home already stacked its nudges in', () => {
  assert.deepEqual(
    EVERY_STATE.map((s) => pickHomeNext(s).kind),
    [...HOME_NEXT_ORDER],
    'each state must land on the next kind in HOME_NEXT_ORDER — the first that applies wins',
  );
});

test('a · exactly ONE Next card with ONE button, in every state', () => {
  for (const state of EVERY_STATE) {
    const html = draw({}, state);
    const kind = pickHomeNext(state).kind;
    assert.equal(count(html, 'data-home-next='), 1, `${kind}: the first screen must carry exactly one Next card`);
    const card = html.slice(html.indexOf('data-home-next='), html.indexOf('>Recommended<'));
    assert.equal(count(card, '<a '), 1, `${kind}: the Next card must hold exactly one button`);
  }
});

test('a · the first screen LEADS the plan branch — nothing of the dashboard above it', () => {
  assert.equal(count(PAGE, '<HomeFirstScreen'), 1, 'the first screen is drawn once, in one place');
  const at = PAGE.indexOf('{homeFirstScreen}');
  assert.ok(at > 0, 'the plan branch must render the first screen');
  const allAt = PAGE.indexOf('id="home-all"', at);
  const dashAt = PAGE.indexOf('<EventDashboard', at);
  assert.ok(allAt > at && dashAt > allAt, 'the dashboard must come AFTER the first screen, under #home-all');
  const branch = PAGE.slice(PAGE.lastIndexOf('<>', at), at);
  assert.equal(branch.trim(), '<>', `something renders above the first screen in the plan branch: ${branch}`);
});

test('b · Edit your Event Hub is drawn in every state — no data can hide it', () => {
  const states: Array<[string, string]> = [
    ...EVERY_STATE.map((s): [string, string] => [pickHomeNext(s).kind, draw({}, s)]),
    ['nothing measured', draw({ coming: glanceCount(0, false), noReply: glanceCount(0, false), money: { paid: glanceMoney(null), owing: glanceMoney(null) }, days: glanceDays(null) })],
    ['budget not shared', draw({ money: null })],
  ];
  for (const [label, html] of states) {
    assert.equal(count(html, 'data-home-edit-hub'), 1, `${label}: the Edit your Event Hub button is missing`);
    assert.match(html, /href="\/dashboard\/e1\/launch"[^>]*>Edit your Event Hub</, `${label}: it must open the Maker`);
  }
});

test('c · an unread number prints "—", never 0', () => {
  assert.equal(glanceCount(0, false), '—');
  assert.equal(glanceCount(180, false), '—', 'unmeasured is unknown, whatever the rows say');
  assert.equal(glanceCount(0, true), '0', 'a MEASURED zero is a fact and may be stated');
  assert.equal(glanceMoney(null), '—');
  assert.equal(glanceDays(null).value, '—');

  const html = draw({
    coming: glanceCount(0, false),
    noReply: glanceCount(0, false),
    noReplyWaiting: false,
    money: { paid: glanceMoney(null), owing: glanceMoney(null) },
  });
  const numbers = html.slice(html.indexOf('data-home-numbers'));
  assert.doesNotMatch(numbers, />0</, 'an unread count rendered as 0');
  assert.doesNotMatch(numbers, /₱0/, 'an unread sum rendered as ₱0');
  assert.ok(count(numbers, '>—<') >= 4, 'coming · no reply · paid · still owing must each read "—"');
});

test('c · the page hands the measurement to the render, not only the rows', () => {
  assert.match(PAGE, /fetchGuestsByEventMeasured\(/, 'Home must take the measured guest read');
  assert.match(PAGE, /glanceCount\(homeStats\.attending,\s*guestsMeasured\)/, '"coming" must know whether it was measured');
  assert.match(PAGE, /glanceCount\(homeStats\.pending,\s*guestsMeasured\)/, '"no reply" must know whether it was measured');
  assert.match(PAGE, /glanceMoney\(moneyNow\?\.paid \?\? null\)/, 'Paid must print "—" when the money read failed');
  assert.match(PAGE, /glanceMoney\(moneyNow\?\.owing \?\? null\)/, 'Still owing must print "—" when the money read failed');
  assert.doesNotMatch(PAGE, /measured:\s*true[^}]*\}\s*as Awaited/, 'a failed guest read must never be recast as measured');
});

test('d · the services row is on the first screen, after the numbers, before "See all"', () => {
  const html = draw();
  assert.equal(count(html, 'data-home-services'), 1, 'the Your services row is missing');
  const at = html.indexOf('data-home-services');
  assert.ok(at > html.indexOf('data-home-money') && at < html.indexOf('See all'), 'the row sits under the money line, above See all');
  assert.match(html, /<a data-home-service="papic"[^>]*href="\/dashboard\/e1\/studio\/papic"[^>]*>[\s\S]*?On · 12 photos/, 'Papic opens its page with its status');
  assert.match(html, /<a data-home-service="ai"[^>]*href="\/dashboard\/e1\/studio\/setnayan-ai"[^>]*>[\s\S]*?Try it/, 'Setnayan AI opens its page with its status');
});

test('d · each status is the shipped reader\'s answer, and a failed read is "—"', () => {
  assert.equal(papicStatus({ permitted: true, tile: 'failed' }), '—', 'a thrown Papic read');
  assert.equal(papicStatus({ permitted: true, tile: { photosGathered: null, preCapture: false } }), '—', 'a refused count is not "nothing shot"');
  assert.equal(papicStatus({ permitted: true, tile: { photosGathered: 0, preCapture: true } }), 'Free camera ready');
  assert.equal(papicStatus({ permitted: true, tile: null }), 'Not added');
  assert.equal(papicStatus({ permitted: true, tile: { photosGathered: 1, preCapture: false } }), 'On · 1 photo');
  assert.equal(aiStatus(null), '—');
  assert.equal(aiStatus(true), 'On');
  assert.equal(aiStatus(false), 'Try it');
  const html = draw({ services: homeServices({ next: 'guide', storeShell: false, papic: papicStatus({ permitted: true, tile: 'failed' }), ai: aiStatus(null) }) });
  const row = html.slice(html.indexOf('data-home-services'));
  assert.equal(count(row, '>—<'), 2, 'both services must read "—" when their reads failed');
  assert.doesNotMatch(row, />0</);
});

test('d · never twice: the service that is Next is left out of the row', () => {
  for (const kind of HOME_NEXT_ORDER) {
    const keys = homeServices({ next: kind, storeShell: false, papic: 'x', ai: 'y' }).map((s) => s.key);
    if (kind === 'papic') assert.deepEqual(keys, ['ai'], 'Papic is Next — the row must show only Setnayan AI');
    else if (kind === 'ai') assert.deepEqual(keys, ['papic'], 'Setnayan AI is Next — the row must show only Papic');
    else assert.deepEqual(keys, ['papic', 'ai']);
  }
  const html = draw({}, { ...NOTHING, papicReady: true });
  assert.equal(count(html, '/studio/papic'), 1, 'Papic is linked twice on one screen');
});

test('d · the store shell draws no services row (both are STORE_SHELL_HIDDEN_ADDON_KEYS)', () => {
  assert.deepEqual(homeServices({ next: 'plan', storeShell: true, papic: 'x', ai: 'y' }), []);
  assert.equal(count(draw({ services: [] }), 'data-home-services'), 0);
  assert.match(PAGE, /homeServices\(\{[\s\S]*?storeShell,/, 'the page must hand the store-shell answer to the row');
  assert.match(PAGE, /papicReady: Boolean\([^)]*!storeShell\)/, 'the Papic Next card must not send a store-shell user to a web-only page');
});
