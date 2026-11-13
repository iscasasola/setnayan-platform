/**
 * 👤 A HOST WITH NO NAME IS STILL A HOST (walk 13 Nov 2026). A brand-new couple account — no display name, no first
 * name — asked a supplier for a quote; "Hosted by" on the supplier's side said "No host has joined on Setnayan yet."
 * `hostsInOrder` dropped every member it could not name. It now lists them as "Host", keeping "Asked you" and the role.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { hostsInOrder, UNNAMED_HOST } from '@/lib/supplier-event-lines';

(globalThis as unknown as { React: unknown }).React = React;

test('an unnamed host is listed, asked-you first, its role kept and never said twice', () => {
  const names = new Map([['u2', 'Claire']]);
  const roles = new Map<string, string | null>([
    ['u1', 'Host'],
    ['u2', 'Co-host'],
  ]);
  assert.deepEqual(hostsInOrder(['u1', 'u2'], 'u1', names, roles), [
    { name: UNNAMED_HOST, askedYou: true, role: null },
    { name: 'Claire', askedYou: false, role: 'Co-host' },
  ]);
  assert.deepEqual(hostsInOrder(['u1'], 'u1', new Map(), new Map([['u1', 'Bride']])), [{ name: UNNAMED_HOST, askedYou: true, role: 'Bride' }]);
  assert.deepEqual(hostsInOrder(['u1'], 'u1', new Map()), [{ name: UNNAMED_HOST, askedYou: true }]);
});

test('"Hosted by" draws the unnamed host, not "No host has joined"', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { EventLinesBody } = await import('@/app/vendor-dashboard/_components/event-lines');
  const html = renderToStaticMarkup(
    React.createElement(EventLinesBody, {
      lines: {
        eventId: 'e1',
        threadId: 't1',
        stage: 'asking',
        read: true,
        type: 'Birthday',
        celebrant: null,
        location: 'Pasig',
        date: 'May 22, 2027 · option',
        pax: null,
        hosts: hostsInOrder(['u1'], 'u1', new Map()),
        requested: [],
        alsoOffer: [],
        alsoBooked: [],
        forYou: [],
        firstEvent: null,
      },
    }),
  );
  assert.doesNotMatch(html, /No host has joined/);
  assert.match(html, /Asked you/);
  assert.match(html, /May 22, 2027 · option/);
});
