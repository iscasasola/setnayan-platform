/**
 * 👁 THE NEXT CARD'S "OPEN" OPENS THE QUEUE — LIVE FIX (owner, /admin/work on 027f641, 16 Nov 2026).
 *
 * Found: the top card read "Next · Oldest 47h · past SLA — Payments · 1 waiting", and its dark Open did nothing.
 * `/admin/payments` opened fine typed in by hand. Cause: the card's Open took the ROW's toggle link whenever the queue
 * can unfold in place — `/admin/work?open=payments`. That unfolds a drawer on the Payments row far down the list (under
 * the notices, the suppliers' inbox, the strip and the chips), out of sight on a phone and on a desk, so the page
 * redrew looking the same; a second press folded it shut. The row in the list keeps its unfold; the card goes to the
 * queue.
 *
 * Measured on the REAL feed, rendered: with Payments ranked first and unfoldable (as live), the Next card's one link
 * is `/admin/payments` — and stays so when `?open=payments` is already set (where the toggle would have CLOSED it).
 *
 * SABOTAGE (run 16 Nov 2026): restoring `canExpand(next.key) ? toggleFor(next.key) : next.href` turns it red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CreditCard, Inbox } from 'lucide-react';

import type { TriageItem } from './queues-triage-feed';

(globalThis as unknown as { React: unknown }).React = React;
// The feed imports server modules; under node there is no Next alias for `server-only` (same shim as
// `app/papic/the-camera-is-the-whole-screen.test.ts`). Loaded after the shim, so dynamically.
{
  const Mod = require('node:module');
  const load = Mod._load;
  Mod._load = function (request: string, ...rest: unknown[]) {
    if (request === 'server-only' || request === 'client-only') return {};
    return load.call(this, request, ...rest);
  };
}
const { EXPANDABLE_QUEUES } = require('@/lib/admin/queue-peek') as typeof import('@/lib/admin/queue-peek');
const { QueuesTriageFeed } = require('./queues-triage-feed') as typeof import('./queues-triage-feed');

const payments: TriageItem = {
  key: 'payments',
  label: 'Payments',
  href: '/admin/payments',
  icon: CreditCard,
  description: 'Payments to match',
  count: 1,
  dueState: 'overdue',
  ageLabel: 'Oldest 47h · past SLA',
};
const other: TriageItem = { key: 'reports', label: 'Reports', href: '/admin/user-reports', icon: Inbox, description: 'Reports', count: 0 };

function nextCardLinks(openKey?: string): string[] {
  const html = renderToStaticMarkup(
    React.createElement(QueuesTriageFeed, { title: 'Work', items: [payments, other], totalOpen: 1, basePath: '/admin/work', openKey }),
  );
  const start = html.indexOf('<section aria-label="Next"');
  assert.ok(start >= 0, 'the Next card is not drawn — this guard is pointed at nothing');
  const card = html.slice(start, html.indexOf('</section>', start));
  return [...card.matchAll(/href="([^"]*)"/g)].map((m) => m[1]!.replace(/&amp;/g, '&'));
}

test('the case is live\'s: Payments unfolds in place on the list', () => {
  assert.ok(EXPANDABLE_QUEUES.has('payments'), 'Payments no longer unfolds in place — re-check what Open did on live');
});

test('Next · Open goes to the queue\'s own page, not the list\'s unfold', () => {
  assert.deepEqual(nextCardLinks(), ['/admin/payments']);
});

test('…and still does when that queue is already unfolded (the toggle would have closed it)', () => {
  assert.deepEqual(nextCardLinks('payments'), ['/admin/payments']);
});
