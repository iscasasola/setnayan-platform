/**
 * a-failed-seat-read-renders-as-failed.test.ts — 🔒 the RENDER half of
 * `app/[slug]/an-unread-seat-is-not-an-empty-one.test.ts`.
 *
 * That guard reads the source: every seat read binds its error, the flag reaches
 * `guestHubData`, every `<SeatDoorLine` mount passes it. This one renders the
 * real line and reads the HTML a guest's phone gets — because a log line never
 * changed a pixel (platform `CLAUDE.md`: "the measurement must reach the RENDER").
 *
 * Three guests, same event, same page:
 *   · seated, read OK        → "Your seat · Table 3" (a link to find-seat)
 *   · not seated, read OK    → "Find your seat"      (a link to find-seat)
 *   · seat read FAILED       → "Couldn't load your seat" + Reload, and NO
 *                              "Find your seat", NO find-seat link
 *
 * Written failing-first (2026-11-20): against `origin/main`'s `seat-door-line.tsx`
 * (no `unreadable` prop) the third case drew "Find your seat →" and this file
 * went red on it; with the PR's line it is green.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';

(globalThis as unknown as { React: unknown }).React = React;

const ROUTER = { push() {}, replace() {}, refresh() {}, prefetch() {}, back() {}, forward() {} };

async function renderLine(props: { tableLabel: string | null; unreadable?: boolean }): Promise<string> {
  const { AppRouterContext } = await import('next/dist/shared/lib/app-router-context.shared-runtime');
  const { SeatDoorLine } = await import('./seat-door-line');
  const line = React.createElement(SeatDoorLine, { slug: 'maria-and-jose', ...props } as never);
  return renderToStaticMarkup(React.createElement(AppRouterContext.Provider, { value: ROUTER as never }, line));
}

const COULDNT = /Couldn(?:’|&#x27;|&rsquo;)t load your seat/;
const FIND = 'Find your seat';
const FIND_LINK = 'href="/maria-and-jose/find-seat"';

test('the control: a guest with no table (read OK) is still told "Find your seat"', async () => {
  const html = await renderLine({ tableLabel: null });
  assert.ok(html.includes(FIND), html);
  assert.ok(html.includes(FIND_LINK), html);
  assert.ok(!COULDNT.test(html), 'a genuinely unseated guest must not be told the read failed');
});

test('the control: a seated guest (read OK) is told their table', async () => {
  const html = await renderLine({ tableLabel: 'Table 3' });
  assert.ok(html.includes('Your seat · Table 3'), html);
  assert.ok(!COULDNT.test(html));
});

test('a FAILED seat read says "Couldn\'t load your seat", never "Find your seat"', async () => {
  const html = await renderLine({ tableLabel: null, unreadable: true });
  assert.ok(COULDNT.test(html), `a failed seat read must say so — got: ${html}`);
  assert.ok(!html.includes(FIND), `a failed seat read drew the empty state — got: ${html}`);
  assert.ok(!html.includes(FIND_LINK), 'a failed read must not send a seated guest off to look themselves up');
});

test('a FAILED seat read offers Reload — a real button, 44 px tall', async () => {
  const html = await renderLine({ tableLabel: null, unreadable: true });
  const button = html.match(/<button[^>]*>Reload<\/button>/);
  assert.ok(button, `no Reload button — got: ${html}`);
  assert.match(button[0], /type="button"/);
  assert.match(button[0], /min-h-\[44px\]/);
});

test('a failed read is a status line, so a screen reader hears it', async () => {
  const html = await renderLine({ tableLabel: null, unreadable: true });
  assert.match(html, /<p[^>]*role="status"/);
  assert.match(html, /data-seat-door="unreadable"/);
});
