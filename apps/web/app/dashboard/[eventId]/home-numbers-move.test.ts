/**
 * home-numbers-move.test.ts — Home's counting numbers MOVE when their inputs
 * do (Root map part 2, slice 5; owner DECISION_LOG 2026-10-02 "THE ROOT MAP
 * ALSO CATCHES A NUMBER THAT LOOKS LIVE BUT IS TYPED IN": "if we say 190 days
 * to go on the screen, but all along the 190 days was hardcoded…").
 *
 * 🔑 THE REAL CHAIN, RENDERED. Home's first screen gets "days to go" from
 * `daysUntil(events.event_date, events.timezone)` → `glanceDays` →
 * `<HomeFirstScreen days>`, and "coming / no reply" from
 * `computeGuestStats(guests)` → `glanceCount` → `<HomeFirstScreen coming
 * noReply>` (page.tsx). This test runs those exact functions and renders the
 * exact component, for two "today"s and two guest lists, and reads the number
 * back out of the HTML — `assertOutputMoves` (lib/ugat/output-moves.ts) fails
 * if it stayed put. A source check pins page.tsx to the same chain, so the
 * test cannot drift into testing functions the page stopped calling.
 *
 * 🪤 `globalThis.React` before the dynamic imports, and the `server-only`
 * shim — see app/pay/[reference]/_components/one-stage-at-a-time.test.ts.
 */
import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { assertOutputMoves, numberBeside } from '@/lib/ugat/output-moves';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

type CjsModuleCtor = {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
  _cache: Record<string, unknown>;
  new (id: string): { filename: string; loaded: boolean; exports: unknown; paths: string[] };
};
const nodeRequire = createRequire(import.meta.url);
const CjsModule = (nodeRequire('node:module') as { Module: CjsModuleCtor }).Module;
const STUB = join(process.cwd(), '__server_only_stub_home_numbers__.js');
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

const HERE = dirname(fileURLToPath(import.meta.url));

async function paint(p: { days: { value: string; label: string }; coming: string; noReply: string }): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HomeFirstScreen } = await import('./_components/home-first-screen');
  return renderToStaticMarkup(
    React.createElement(HomeFirstScreen, {
      eventId: 'evt-1',
      cover: { eyebrow: 'Wedding', name: 'A & B' },
      next: { kind: 'plan', title: 'Plan', body: 'Next', action: 'See all' },
      days: p.days,
      coming: p.coming,
      noReply: p.noReply,
      noReplyWaiting: false,
      money: null,
      services: [],
    } as never),
  );
}

const guest = (rsvp_status: string) => ({ rsvp_status, plus_one_count: 0, entry_source: 'host', passed_away: false });

test('page.tsx feeds the first screen through the chain this test runs', () => {
  const src = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
  assert.match(src, /homeDaysOut\s*=[\s\S]{0,200}?daysUntil\(\s*\(?event\.event_date/, 'days come from daysUntil(event.event_date)');
  assert.match(src, /days=\{glanceDays\(homeDaysOut\)\}/);
  assert.match(src, /homeStats\s*=\s*computeGuestStats\(guests\)/);
  assert.match(src, /coming=\{glanceCount\(homeStats\.attending/);
  assert.match(src, /noReply=\{glanceCount\(homeStats\.pending/);
});

test('days to go moves when today moves — and when the date does', async () => {
  const { daysUntil } = await import('./_components/event-dashboard');
  const { glanceDays } = await import('@/lib/home-first-screen');
  const render = async (i: { today: string; date: string }) => {
    mock.timers.enable({ apis: ['Date'], now: new Date(`${i.today}T04:00:00Z`) });
    try {
      return await paint({ days: glanceDays(daysUntil(i.date, 'Asia/Manila')), coming: '0', noReply: '0' });
    } finally {
      mock.timers.reset();
    }
  };
  const read = (html: string) => numberBeside(html, /days? to go/);
  await assertOutputMoves({
    what: 'Home · days to go, two todays',
    render,
    read,
    inputs: [
      { today: '2026-10-02', date: '2027-04-20' },
      { today: '2026-10-03', date: '2027-04-20' },
    ],
    expect: ['200', '199'],
  });
  await assertOutputMoves({
    what: 'Home · days to go, two events',
    render,
    read,
    inputs: [
      { today: '2026-10-02', date: '2026-12-01' },
      { today: '2026-10-02', date: '2027-04-20' },
    ],
    expect: ['60', '200'],
  });
});

test('coming and no-reply move when the guest list does', async () => {
  const { computeGuestStats } = await import('@/lib/guests');
  const { glanceCount, glanceDays } = await import('@/lib/home-first-screen');
  const render = (gs: Array<ReturnType<typeof guest>>) => {
    const s = computeGuestStats(gs as never);
    return paint({ days: glanceDays(null), coming: glanceCount(s.attending, true), noReply: glanceCount(s.pending, true) });
  };
  const small = [guest('attending'), guest('pending'), guest('declined')];
  const big = [...small, guest('attending'), guest('attending'), guest('pending')];
  await assertOutputMoves({ what: 'Home · coming', render, read: (h) => numberBeside(h, /coming/), inputs: [small, big], expect: ['1', '3'] });
  await assertOutputMoves({ what: 'Home · no reply', render, read: (h) => numberBeside(h, /no reply/), inputs: [small, big], expect: ['1', '2'] });
});

test('the helper refuses a number that did not move', async () => {
  await assert.rejects(
    assertOutputMoves({ what: 'typed in', render: () => '<p>190</p><p>days to go</p>', read: (h) => numberBeside(h, /days to go/), inputs: [1, 2] }),
    /did not/,
  );
});
