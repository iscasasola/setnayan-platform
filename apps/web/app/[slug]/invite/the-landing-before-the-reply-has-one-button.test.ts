/**
 * THE GUEST'S LANDING BEFORE THE REPLY HAS ONE BUTTON (owner 2026-10-01,
 * DECISION_LOG "THE GUEST LANDING BEFORE THE REPLY HAS ONE BUTTON").
 *
 *   1. RENDERED: the pre-reply landing draws exactly ONE link/button — "Reply to
 *      the invitation" — and none of the words that used to sit under it.
 *   2. WHERE IT LIVES: the page returns that component (and only it) for a guest
 *      who has not replied and holds no full ticket.
 *   3. NOTHING WAS LOST: each thing removed from the pre-reply landing is still
 *      drawn by the page after a reply, once.
 *
 * 🪤 `globalThis.React` before the DYNAMIC import (tsconfig `jsx: preserve`).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

(globalThis as unknown as { React: unknown }).React = React;

const ENTER = stripComments(readFileSync(join(__dirname, 'enter', 'page.tsx'), 'utf8'));

async function renderPre(over: Record<string, unknown> = {}) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { LandingPreReply } = await import('./_components/landing-pre-reply');
  return renderToStaticMarkup(
    React.createElement(LandingPreReply as never, {
      message: 'Hi Fred! You’re invited to Ana & Miguel’s wedding.',
      hosts: 'Ana & Miguel',
      replyHref: '/ana-miguel/invite/reply',
      replyByLabel: 'February 13, 2027',
      fadedTicket: true,
      ticketSrc: '/api/guest/pass-card',
      awaitingLine: null,
      ...over,
    } as never),
  );
}
const controls = (html: string) => html.match(/<(a|button)\b/g) ?? [];

test('1 · before the reply the landing draws exactly ONE link — "Reply to the invitation"', async () => {
  const html = await renderPre();
  assert.equal(controls(html).length, 1, `the pre-reply landing has ${controls(html).length} controls: ${controls(html).join(' ')}`);
  assert.match(html, /<a [^>]*href="\/ana-miguel\/invite\/reply"[^>]*>Reply to the invitation<\/a>/);
  // The faded ticket is still a picture — with no pill of its own.
  assert.match(html, /data-landing-ticket="faded"/);
  assert.match(html, /<img\b/, 'the ticket picture is gone');
  for (const gone of [
    'Reply to confirm your ticket',
    'How to use it',
    'Open the save the date',
    'Open the invitation',
    'opens this invitation any time',
    'Copy my link',
    'Save to my account',
    'I agree to the',
    'Send their invite',
  ]) {
    assert.ok(!html.includes(gone), `the pre-reply landing still says "${gone}"`);
  }
  // Still the greeting, the couple, and the reply-by line.
  assert.match(html, /You’re invited to Ana &amp; Miguel’s wedding/);
  assert.match(html, /Please reply by February 13, 2027/);
});

test('1 · a request still waiting adds a sentence, never a control', async () => {
  const html = await renderPre({
    fadedTicket: false,
    awaitingLine: 'The couple will confirm you shortly.',
  });
  assert.equal(controls(html).length, 1);
  assert.doesNotMatch(html, /data-landing-ticket/);
  assert.match(html, /will confirm you shortly/);
});

test('2 · the page returns ONLY that component for an unreplied guest without a full ticket', () => {
  const at = ENTER.indexOf('if (unreplied && ticket !== \'full\') {');
  assert.ok(at > -1, 'the pre-reply early return is gone — the landing shows everything again');
  const end = ENTER.indexOf('\n  }\n', at);
  const block = ENTER.slice(at, end);
  assert.match(block, /<LandingPreReply\b/);
  for (const forbidden of ['<CopyMyLink', '<SaveToAccount', '<YourGuests', 'data-landing="how"', 'data-landing="open"', '<InviteQrPanel', '<TicketPopup', 'openBeforeReplyHref', '<SavePassCardButton']) {
    assert.ok(!block.includes(forbidden), `the pre-reply return still draws ${forbidden}`);
  }
  // Links in the block: none of its own (the component carries the one button).
  assert.ok(!/<Link\b|<a\b|<button\b/.test(block), 'the pre-reply return adds a control beside the component');
});

test('3 · everything removed from the pre-reply landing is drawn after a reply, once', () => {
  const after = ENTER.slice(ENTER.indexOf('if (unreplied && ticket !== \'full\') {'));
  const afterBlock = after.slice(after.indexOf('\n  }\n') + 5);
  for (const [needle, what] of [
    ['<YourGuests', 'Your guests · Send their invite'],
    ['data-landing="how"', 'How to use it'],
    ['data-landing="open"', 'Open the invitation / save the date'],
    ['<CopyMyLink link={invitationUrl} />', 'Copy my link'],
    ['<SaveToAccount', 'Save to my account (and its Terms tick)'],
  ] as const) {
    assert.ok(afterBlock.includes(needle), `${what} no longer appears after the reply`);
  }
  assert.equal((afterBlock.match(/<CopyMyLink\b/g) ?? []).length, 1, 'Copy my link is drawn more than once');
  // The Terms tick is SaveToAccount's own (it is asked where the account is made).
  const save = stripComments(readFileSync(join(__dirname, '..', '_components', 'save-to-account.tsx'), 'utf8'));
  assert.match(save, /I agree to the/, 'the Terms tick left Save to my account — nothing asks for it any more');
});
