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
const noop = async () => {};
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
  const actions = {
    acceptInquiry: noop, declineInquiry: noop, confirmLock: noop, rejectLock: noop, agreeLock: noop, declineLock: noop,
    agreeDeletion: noop, declineDeletion: noop, answerDateChange: noop, postReviewReply: noop, respondMeeting: noop, markServiceComplete: noop,
  };
  return renderToStaticMarkup(
    React.createElement(SupplierTodayScreen, { view, outcome: null, feeForecasts: {}, cards: [], askStatus: '', deskIncomplete: o.deskIncomplete, actions }),
  );
}

const SAID = /Nothing waiting/g;

test('nothing waiting, read in full: the Next card says it — and nothing under it says it again', async () => {
  const html = await render({ deskIncomplete: false, owedPhp: 0 });
  const t = text(html);
  assert.match(html, /data-today-next="clear"/, 'anti-vacuity: this is the empty Today (the Next card is `clear`)');
  assert.match(t, /Nothing waiting No bookings yet/, 'the Next card no longer says the empty state');
  assert.match(t, /See the month/, 'the Next card lost its one action');
  assert.equal((t.match(SAID) ?? []).length, 1, `the empty state is said more than once: ${t.slice(0, 500)}`);
  assert.doesNotMatch(html, /data-today-note="waiting-empty"/, 'the duplicate "Nothing waiting on you" row is drawn under the card that already said it');
  // The waiting list still ends in its door — dropping the row did not drop the way to the whole list.
  assert.match(html, /All customers/);
});

test('control: under ANOTHER card, an empty waiting list still says so (nothing above has)', async () => {
  const html = await render({ deskIncomplete: false, owedPhp: 48_000 });
  assert.match(html, /data-today-next="payday"/, 'anti-vacuity: the Next card is payday here, not the empty state');
  assert.match(html, /data-today-note="waiting-empty"/, 'the empty-list row vanished from a Today whose card does not say "nothing waiting"');
  assert.equal((text(html).match(SAID) ?? []).length, 1);
});

test('control: an unread desk is never "nothing waiting" — it says it could not load', async () => {
  const html = await render({ deskIncomplete: true, owedPhp: null });
  const t = text(html);
  assert.match(html, /data-today-next="unread"/);
  assert.doesNotMatch(t, SAID, 'an unread desk reads as "nothing waiting"');
  assert.match(t, /couldn’t load/);
});
