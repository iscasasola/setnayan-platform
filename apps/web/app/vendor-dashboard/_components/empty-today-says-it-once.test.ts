/**
 * 🪞 AN EMPTY TODAY SAYS "NOTHING WAITING" ONCE — owner 2026-10-28, live shot of www.setnayan.com/vendor-dashboard
 * at 390 px: the Next card read "YOUR NEXT STEP · Nothing waiting · No bookings yet… · [See the month]" and directly
 * under it a row "✓ Nothing waiting on you · New asks land here first" — the same empty state, said twice.
 *
 * The rule (`supplier-today-first-screen.tsx`, `sayNothingWaiting`): when the Next card IS the empty state (`clear`)
 * the waiting list's "Nothing waiting on you" row is not drawn. Two controls keep it from being over-applied:
 *   · under any OTHER card (here: payday) with an empty list the row still says so — nothing above has said it;
 *   · an UNREAD desk is never "nothing waiting" anywhere — it says "couldn't load" (reads-are-honest).
 *
 * Asserted on REAL MARKUP: the shipped assembly (`assembleSupplierToday`) and the shipped screen
 * (`SupplierTodayScreen`) are rendered, so the words counted are the words drawn.
 *
 * 🔁 RE-AIMED 2026-11-08 (THE ONE BUILD, v103): the Next card is retired, so the empty state is said by ONE thing —
 * the Needs-you list's "Nothing waiting on you" row (the cover's chip reads "Nothing today", a count, not a second
 * sentence). The same property: said once, never twice; an unread desk never says it.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets `"jsx": "preserve"`.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}

const NOW = Date.parse('2026-10-02T02:00:00Z');
const text = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/&rsquo;/g, '’').replace(/\s+/g, ' ');

async function render(o: { deskIncomplete: boolean; owedPhp: number | null }): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { SupplierTodayScreen } = await import('./supplier-today-screen');
  const { assembleSupplierToday } = await import('@/lib/supplier-today-view');
  const view = assembleSupplierToday({
    needsAnswer: [],
    closed: [],
    deskIncomplete: o.deskIncomplete,
    upcoming: [],
    schedules: { pools: [], outside: [], complete: true },
    firstSteps: null,
    verified: true,
    findable: true,
    findability: null,
    feeBills: [],
    feeEnforced: true,
    earnings: o.owedPhp === null ? null : { confirmedPhp: 0, expectedPhp: o.owedPhp, paydayMeasured: true },
    credit: null,
    payoutReadiness: 'unreadable',
    payoutHref: '/vendor-dashboard/profile#pay',
    shop: { name: 'Lumina Studio', categoryWord: 'Photo & video', details: { done: 6, total: 6, complete: true }, awardWord: null, milestoneWord: null },
    views: 312,
    inquiries28: 14,
    dayFacts: null,
    todayIso: '2026-10-02',
    now: NOW,
    since: () => new Date(NOW),
  });
  return renderToStaticMarkup(
    React.createElement(SupplierTodayScreen, { view, outcome: null, shopName: 'Lumina Studio', todayIso: '2026-10-02', now: NOW }),
  );
}

const SAID = /Nothing waiting on you/g;

test('nothing waiting, read in full: the list says it — once', async () => {
  const html = await render({ deskIncomplete: false, owedPhp: 0 });
  const t = text(html);
  assert.match(html, /data-today-note="waiting-empty"/, 'anti-vacuity: the empty Needs-you row is drawn');
  assert.match(t, /Nothing waiting on you New asks land here first/);
  assert.equal((t.match(SAID) ?? []).length, 1, `the empty state is said more than once: ${t.slice(0, 500)}`);
  assert.match(t, /Nothing today/, 'the cover’s chip does not say the count');
});

test('control: money still to come in does not hide the empty list (it is a stat now, not a card)', async () => {
  const html = await render({ deskIncomplete: false, owedPhp: 48_000 });
  assert.match(html, /data-today-note="waiting-empty"/, 'the empty-list row vanished');
  assert.equal((text(html).match(SAID) ?? []).length, 1);
  assert.match(text(html), /₱48K Money to come in/);
});

test('control: an unread desk is never "nothing waiting" — it says it could not load', async () => {
  const html = await render({ deskIncomplete: true, owedPhp: null });
  const t = text(html);
  assert.doesNotMatch(t, SAID, 'an unread desk reads as "nothing waiting"');
  assert.match(t, /couldn’t load/);
  assert.doesNotMatch(t, /\d+ tasks? today|Nothing today/, 'an unread desk is given a task count');
});
