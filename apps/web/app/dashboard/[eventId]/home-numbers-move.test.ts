/**
 * home-numbers-move.test.ts — Home's counting numbers MOVE when their inputs
 * do (Root map part 2, slice 5; owner DECISION_LOG 2026-10-02 "THE ROOT MAP
 * ALSO CATCHES A NUMBER THAT LOOKS LIVE BUT IS TYPED IN": "if we say 190 days
 * to go on the screen, but all along the 190 days was hardcoded…").
 *
 * 🔑 THE REAL CHAIN, RENDERED. Home's first screen gets "days to go" from
 * `homeFacts({ eventDate, guests, money })` (lib/home-facts.ts — `daysUntil` →
 * `glanceDays`, `computeGuestStats` → `glanceCount`, `glanceMoney`) →
 * `<HomeFirstScreen days coming noReply money>` (page.tsx). This test runs those exact functions and renders the
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

async function paint(f: {
  days: { value: string; label: string };
  coming: string;
  noReply: string;
  money?: { paid: string; owing: string } | null;
}): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { HomeFirstScreen } = await import('./_components/home-first-screen');
  return renderToStaticMarkup(
    React.createElement(HomeFirstScreen, {
      eventId: 'evt-1',
      cover: { eyebrow: 'Wedding', name: 'A & B' },
      next: { kind: 'plan', title: 'Plan', body: 'Next', action: 'See all' },
      days: f.days,
      coming: f.coming,
      noReply: f.noReply,
      noReplyWaiting: false,
      money: f.money ?? null,
      services: [],
    } as never),
  );
}

const guest = (rsvp_status: string) => ({ rsvp_status, plus_one_count: 0, entry_source: 'host', passed_away: false });

/** The facts Home states, through the ONE function the page calls. */
async function factsFor(over: {
  date?: string | null;
  precision?: string | null;
  guests?: Array<ReturnType<typeof guest>>;
  measured?: boolean;
  money?: { paid: number; owing: number } | null | 'hidden';
}) {
  const { homeFacts } = await import('@/lib/home-facts');
  const { computeGuestStats } = await import('@/lib/guests');
  return homeFacts({
    eventDate: over.date ?? null,
    precision: over.precision ?? 'day',
    timezone: 'Asia/Manila',
    guests: { stats: computeGuestStats((over.guests ?? []) as never), measured: over.measured ?? true },
    money: over.money === undefined ? 'hidden' : over.money,
  });
}

test('page.tsx feeds the first screen — and the dashboard — through the ONE chain this test runs', () => {
  const src = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
  assert.match(src, /facts\s*=\s*homeFacts\(\{[\s\S]{0,400}?eventDate:\s*\(?event\.event_date/, 'the facts come from homeFacts(event.event_date …)');
  assert.match(src, /days=\{facts\.days\}/);
  assert.match(src, /coming=\{facts\.coming\}/);
  assert.match(src, /noReply=\{facts\.noReply\}/);
  assert.match(src, /money=\{facts\.money\}/);
  // …and nothing else on the page works those numbers out a second time.
  assert.doesNotMatch(src, /\bdaysUntil\(/, 'the page must not run its own countdown');
  assert.doesNotMatch(src, /\bcomputeGuestStats\(/, 'the page must not recount the guests');
  assert.doesNotMatch(src, /\bresolveEventMoney\(/, 'the page must not resolve the money a second time');
  // The dashboard is HANDED the same numbers (three mounts), never re-deriving them.
  assert.equal((src.match(/daysOut=\{facts\.daysOut\}/g) ?? []).length, 3, 'every EventDashboard mount gets the same daysOut');
  assert.equal((src.match(/guestStats=\{facts\.guestStats\}/g) ?? []).length, 3, 'every EventDashboard mount gets the same guest counts');
});

test('the dashboard no longer works the first screen\'s numbers out itself', () => {
  const src = stripComments(readFileSync(join(HERE, '_components/event-dashboard.tsx'), 'utf8'));
  assert.doesNotMatch(src, /\bdaysUntil\(/, 'daysUntil lives in lib/home-facts.ts');
  assert.doesNotMatch(src, /\bcomputeGuestStats\(/, 'the guest counts are handed down');
  assert.doesNotMatch(src, /\bresolveEventMoney\(/, 'the money is handed down');
  assert.doesNotMatch(src, /\bfetchGuestsByEvent\(/, 'a second read of the same guest list is gone');
});

test('days to go moves when today moves — and when the date does', async () => {
  const render = async (i: { today: string; date: string }) => {
    mock.timers.enable({ apis: ['Date'], now: new Date(`${i.today}T04:00:00Z`) });
    try {
      const f = await factsFor({ date: i.date });
      return await paint({ days: f.days, coming: '0', noReply: '0' });
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

test('a date that is only a month or a year counts down to nothing', async () => {
  const month = await factsFor({ date: '2027-04-01', precision: 'month' });
  assert.equal(month.daysOut, null);
  assert.equal(month.days.value, '—');
});

test('coming and no-reply move when the guest list does', async () => {
  const render = async (gs: Array<ReturnType<typeof guest>>) => {
    const f = await factsFor({ guests: gs });
    return paint({ days: f.days, coming: f.coming, noReply: f.noReply });
  };
  const small = [guest('attending'), guest('pending'), guest('declined')];
  const big = [...small, guest('attending'), guest('attending'), guest('pending')];
  await assertOutputMoves({ what: 'Home · coming', render, read: (h) => numberBeside(h, /coming/), inputs: [small, big], expect: ['1', '3'] });
  await assertOutputMoves({ what: 'Home · no reply', render, read: (h) => numberBeside(h, /no reply/), inputs: [small, big], expect: ['1', '2'] });
});

test('a guest read that did not happen prints "—", never 0 coming', async () => {
  const f = await factsFor({ guests: [], measured: false });
  const html = await paint({ days: f.days, coming: f.coming, noReply: f.noReply });
  assert.equal(numberBeside(html, /coming/), '—');
  assert.equal(numberBeside(html, /no reply/), '—');
});

test('Paid and Still owing move when the money does — and "—" when it was not read', async () => {
  const render = async (m: { paid: number; owing: number } | null) => {
    const f = await factsFor({ money: m });
    return paint({ days: f.days, coming: '0', noReply: '0', money: f.money });
  };
  const owing = (html: string) => html.match(/Still owing<span[^>]*>([^<]+)</)?.[1] ?? null;
  const paid = (html: string) => html.match(/Paid<span[^>]*>([^<]+)</)?.[1] ?? null;
  const a = await render({ paid: 12_000, owing: 3_000 });
  const b = await render({ paid: 20_000, owing: 500 });
  assert.notEqual(owing(a), owing(b), 'Still owing did not move with the money');
  assert.notEqual(paid(a), paid(b), 'Paid did not move with the money');
  assert.match(owing(a) ?? '', /3,000/);
  assert.match(owing(b) ?? '', /500/);
  assert.equal(owing(await render(null)), '—', 'an unread budget prints —, never ₱0');
  const hidden = await paint({ days: { value: '1', label: 'day to go' }, coming: '0', noReply: '0', money: (await factsFor({ money: 'hidden' })).money });
  assert.equal(owing(hidden), null, 'a viewer the budget is not shared with gets no money line at all');
});

test('the helper refuses a number that did not move', async () => {
  await assert.rejects(
    assertOutputMoves({ what: 'typed in', render: () => '<p>190</p><p>days to go</p>', read: (h) => numberBeside(h, /days to go/), inputs: [1, 2] }),
    /did not/,
  );
});
