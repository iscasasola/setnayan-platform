/**
 * ⤴ "ANSWER THEIR BOOKING ASK" RISES FULL SCREEN, ABOVE THE COMPOSER (CHAT-18, W1 walk 16 Nov 2026).
 *
 * Measured live (shot CHAT-book-sheet-under-composer): the booking ask opened in the tray UNDER the message box, about
 * half the screen, with ＋ / lock / Message / Send drawn above it. It is a form to fill, so it rises full screen
 * (DECISION_LOG 2026-11-10 "RISE FULL SCREEN"); pickers and menus such as the ＋ stay half (2026-11-12).
 *
 * SABOTAGE (seen red, then restored): `rise: true` removed from the booking-ask panel (test 1 red); the page's
 * `rise={t.rise}` removed (test 2 red); `ThreadToolPanel` drawing the tray body even when `rise` (test 3 red).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VENDOR_THREAD_PANELS } from './vendor-thread-tools';
import { stripComments } from './strip-comments';
import { ThreadToolPanel } from '../app/_components/chat/thread-tool-panel';

(globalThis as { React?: typeof React }).React = React;

// `children` arrives as the third argument; the cast only relaxes the prop type's required `children`
// (react/no-children-prop forbids passing it as a prop) — the same shape as element-style.test.ts.
const Panel = ThreadToolPanel as unknown as React.FC<Omit<React.ComponentProps<typeof ThreadToolPanel>, 'children'> & { children?: React.ReactNode }>;

const read = (...p: string[]) => stripComments(readFileSync(join(__dirname, '..', ...p), 'utf8'));

test('1 · the booking ask is the panel that rises; the other tools keep the tray', () => {
  const rising = VENDOR_THREAD_PANELS.filter((p) => p.rise).map((p) => p.id);
  assert.deepEqual(rising, ['booking-ask'], 'the booking ask no longer rises full screen');
});

test('2 · the supplier thread page passes it through', () => {
  const src = read('app', 'vendor-dashboard', 'messages', '[threadId]', 'page.tsx');
  assert.match(src, /<ThreadToolPanel[\s\S]{0,200}rise=\{t\.rise\}/, 'the page drops the panel’s rise');
});

test('3 · a rising panel draws no tray body — only the hidden reveal target, and the rise uses the one RiseScreen', () => {
  const html = renderToStaticMarkup(
    React.createElement(Panel, { id: 'booking-ask', label: 'Answer their booking ask', hint: 'Agree', rise: true }, 'BODY'),
  );
  assert.match(html, /id="booking-ask"/, 'revealThreadTool has nothing to open');
  assert.match(html, /data-thread-tool-rise/);
  assert.doesNotMatch(html, /max-h-\[55dvh\]/, 'the booking ask is drawn in the half-height tray again');
  assert.doesNotMatch(html, /BODY/, 'the form is drawn under the composer while closed');
  const tray = renderToStaticMarkup(React.createElement(Panel, { id: 'x', label: 'X', hint: 'h' }, 'BODY'));
  assert.match(tray, /max-h-\[55dvh\]/);
  const rise = read('app', '_components', 'chat', 'thread-tool-rise.tsx');
  assert.match(rise, /<RiseScreen\b/);
  assert.match(rise, /from '@\/app\/_components\/rise\/rise-screen'/);
});
