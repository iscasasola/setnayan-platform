/**
 * ↩ A CLIENT CARD OPENED FROM A CLIENTS LIST CLOSES — and lands back on that list (EB-246, 16 Nov 2026).
 *
 * Found on the every-button walk: Clients › "Overdue 6 ›" › "Debut 18" opened the card on Payment; ✕ (twice) and Esc
 * changed the address but the card stayed on screen — only a reload got out.
 *
 * WHY: the tile lists (Schedules · To collect · Overdue · Unread) and the Money rows recorded no list origin, so the
 * shell's close PUSHED `/vendor-dashboard/customers`. On a soft navigation Next keeps a parallel slot's last page when the
 * new address does not name the slot (`default.tsx` only answers a hard load), so the `client` slot kept the card over a
 * changed URL; the shell's `closingRef` then swallowed every later ✕.
 *
 * The claims, measured on the real parts:
 *   1. every row of the four tile lists and of Money, RENDERED, sits inside `RememberPickedOrigin` with the same
 *      address it links — so the press records where it was;
 *   2. that press recorded from the Overdue list is found by the client page, and the close then goes BACK (to the
 *      Overdue list, filter and scroll kept) — never a push;
 *   3. the `client` slot answers the bare Clients address with nothing, so ANY push to the list address (a hard-loaded
 *      card, a door with no origin) also takes the card away.
 *
 * SABOTAGE (run 16 Nov 2026): unwrapping the PaymentsList row turns 1 and 2 red; deleting `@client/page.tsx` turns 3 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { MeetingsList, PaymentsList, UnreadList } from './_components/clients-tile-lists';
import {
  forgetPickedOrigin,
  pickedCloseStep,
  readPickedOrigin,
  rememberPickedOrigin,
  SUPPLIER_PICKED_LISTS,
} from '../../_components/picked/picked-motion';
import type { MoneyRow } from '@/lib/vendor-money';

(globalThis as unknown as { React: unknown }).React = React;

const HERE = import.meta.dirname;
const EVENT = 'S89E-DEBUT18XXX';

const moneyRow = {
  key: 'k1',
  eventId: EVENT,
  title: 'Debut 18',
  line: 'First payment · Nov 13',
  amountPhp: 5350,
  badge: { tone: 'warn', word: 'Overdue' },
} as unknown as MoneyRow;

/** Every link to a client in the markup, and whether it sits inside a RememberPickedOrigin naming the same address. */
function clientLinks(html: string): { href: string; remembered: boolean }[] {
  const out: { href: string; remembered: boolean }[] = [];
  for (const m of html.matchAll(/<a [^>]*href="(\/vendor-dashboard\/clients\/[^"]+)"/g)) {
    const before = html.slice(0, m.index);
    const open = before.lastIndexOf('data-remember-picked-origin');
    const close = before.lastIndexOf('</span>');
    out.push({ href: m[1]!.replace(/&amp;/g, '&'), remembered: open > close });
  }
  return out;
}

test('1 · every tile-list row records the list it was pressed on', () => {
  const lists = {
    overdue: renderToStaticMarkup(React.createElement(PaymentsList, { rows: [moneyRow], failed: false, data: 'overdue', empty: '' })),
    schedules: renderToStaticMarkup(
      React.createElement(MeetingsList, {
        meetings: [{ appointmentId: 'a1', eventId: EVENT, label: 'Tasting', scheduledAt: '2026-11-20T02:00:00Z', status: 'confirmed' } as never],
        nameOf: () => 'Debut 18',
        failed: false,
      }),
    ),
    unread: renderToStaticMarkup(
      React.createElement(UnreadList, { rows: [{ eventId: EVENT, title: 'Debut 18', threadId: 't1' }], countOf: () => 2, failed: false }),
    ),
  };
  for (const [name, html] of Object.entries(lists)) {
    const links = clientLinks(html);
    assert.ok(links.length > 0, `${name}: no client row rendered — this guard is pointed at nothing`);
    for (const l of links) assert.ok(l.remembered, `${name}: the row to ${l.href} records no origin, so its ✕ pushes and the card stays`);
  }
});

test('2 · a press on the Overdue list is found by the card, and ✕ goes BACK to that list', () => {
  const store = new Map<string, string>();
  const g = globalThis as unknown as { window?: unknown };
  const had = g.window;
  g.window = {
    location: { pathname: '/vendor-dashboard/customers', search: '?view=overdue' },
    sessionStorage: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    },
  };
  try {
    // The press: the href the rendered Overdue row carries, recorded by the same helper the wrapper calls.
    const html = renderToStaticMarkup(React.createElement(PaymentsList, { rows: [moneyRow], failed: false, data: 'overdue', empty: '' }));
    const [link] = clientLinks(html);
    assert.ok(link?.remembered, 'the Overdue row records nothing — the close below could only push');
    rememberPickedOrigin(null, link!.href);

    const origin = readPickedOrigin(`/vendor-dashboard/clients/${EVENT}`, SUPPLIER_PICKED_LISTS);
    assert.equal(origin?.from, '/vendor-dashboard/customers?view=overdue', 'the card does not know it came from Overdue');
    assert.equal(pickedCloseStep(origin, 3), 'back', '✕ must go back to the Overdue list, not push the Clients address');
    // No origin (a hard load) — and only then — pushes the list address (claim 3 makes that push close the card).
    assert.equal(pickedCloseStep(null, 3), 'push');
    assert.equal(pickedCloseStep(origin, 1), 'push', 'nothing to go back through — never history.back() out of the app');
    forgetPickedOrigin();
  } finally {
    g.window = had;
  }
});

test('3 · the client slot answers the bare Clients address with nothing', async () => {
  const page = join(HERE, '@client', 'page.tsx');
  assert.ok(existsSync(page), '@client/page.tsx is gone — a soft push to /vendor-dashboard/customers keeps the card on screen');
  const mod = (await import('./@client/page')) as { default: () => unknown };
  assert.equal(mod.default(), null, 'the slot draws something over the Clients list');
});
