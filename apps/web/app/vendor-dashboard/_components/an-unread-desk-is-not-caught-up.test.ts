/**
 * AN UNREAD DESK IS NOT "ALL CAUGHT UP" — 2026-09-20, the #5724 sweep-left.
 *
 * The Overview's answers desk is fed by four reads of the shop's bookings
 * (deposits to confirm, booking asks on a 7-day fuse, deletion asks, answered
 * deposits). `fetchLockAgreementRequests` used to DISCARD its error, so a
 * refused read drew "You're all caught up" — byte-identical to a shop with
 * nothing waiting. The reads now report `complete`, and `WhatsNewFeed` takes
 * `incomplete`.
 *
 * Asserted on REAL MARKUP: the feed is rendered, so the words tested are the
 * words drawn.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import — tsconfig sets
 * `"jsx": "preserve"`, so components compile to bare `React.createElement`.
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

const noop = async () => {};

async function renderFeed(incomplete: boolean, cards: unknown[] = []): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { WhatsNewFeed } = await import('./overview-sections');
  return renderToStaticMarkup(
    React.createElement(WhatsNewFeed, {
      cards: cards as never,
      incomplete,
      acceptInquiry: noop,
      declineInquiry: noop,
      confirmLock: noop,
      rejectLock: noop,
      agreeLock: noop,
      declineLock: noop,
      agreeDeletion: noop,
      declineDeletion: noop,
      postReviewReply: noop,
      respondMeeting: noop,
    }),
  );
}

const COULDNT = /couldn(?:&rsquo;|’|&#x27;|')t load/;
const CAUGHT_UP = /all caught up/i;

test('an empty desk whose reads did not finish says "couldn\'t load", never "all caught up"', async () => {
  const html = await renderFeed(true);
  assert.match(html, COULDNT);
  assert.match(html, /role="status"/);
  assert.doesNotMatch(html, CAUGHT_UP);
});

test('a desk with cards whose reads did not finish still says so above the cards', async () => {
  const html = await renderFeed(true, [
    {
      kind: 'contract_draft',
      id: 'cd-k1',
      contractId: 'k1',
      eventId: 'e1',
      title: 'Rosa & Ben — photography',
      createdAt: '2026-09-01T00:00:00Z',
    },
  ]);
  assert.ok(html.includes('Rosa &amp; Ben'), 'the card itself is drawn');
  assert.match(html, COULDNT);
});

test('a desk that read in full and is empty is "all caught up" (the control)', async () => {
  const html = await renderFeed(false);
  assert.match(html, CAUGHT_UP);
  assert.doesNotMatch(html, COULDNT);
});
