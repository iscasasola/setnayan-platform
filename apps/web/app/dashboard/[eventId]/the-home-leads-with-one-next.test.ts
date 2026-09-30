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
 *   c · a read that did not happen prints "—", never 0.
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
