/**
 * ✅ A BOOKING ASK ANSWERED "BOOKED" SETTLES AS A YES (ship review of #8044, 20 Nov 2026).
 *
 * The ask line stays `asked`; a LATER line answers it (`answeredAs`). That ask folded to a settled line with turn
 * 'old' — struck through, no ✓ — so a confirmed booking read like a refusal. A yes is 'done' whichever line carries it.
 * Rendered, not grepped: the claim is what the reader sees (the ✓, no strike).
 * Run from apps/web: node --import tsx --test app/_components/chat/cards/a-booked-ask-settles-as-a-yes.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { BookRequestCard } from './book-request-card';

// tsx compiles the card's JSX to React.createElement — the same shim the repo's other render tests use.
(globalThis as unknown as { React: unknown }).React = React;

async function draw(props: React.ComponentProps<typeof BookRequestCard>): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return renderToStaticMarkup(React.createElement(BookRequestCard, props));
}
const base = { reason: null, supplierName: 'Lumina Lights & Sound', at: 'Today 10:42' } as const;

test('an ask a later line answered "booked" is a yes: done, not struck', async () => {
  const html = await draw({ ...base, state: 'asked', answeredAs: 'booked' });
  assert.match(html, /data-card-turn="done"/, html);
  assert.doesNotMatch(html, /line-through/);
});

test('the booked line itself is a yes', async () => {
  assert.match(await draw({ ...base, state: 'booked' }), /data-card-turn="done"/);
});

test('an ask answered "not available" stays a no: old, struck', async () => {
  const html = await draw({ ...base, state: 'asked', answeredAs: 'not_available' });
  assert.match(html, /data-card-turn="old"/);
  assert.match(html, /line-through/);
});
