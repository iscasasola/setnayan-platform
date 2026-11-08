/**
 * 📐 EVERYTHING PINNED ABOVE THE MESSAGES IS ONE STACK, CAPPED AT 4/9 (owner, 9 Nov — corpus fb2217b6).
 *
 *   1. The cap is ONE constant, `calc(100dvh * 4 / 9)`, and the stack scrolls inside itself (`overflow-y-auto`) in its
 *      own stacking context (`isolate` — a pin never paints over an open panel). Under a head it caps itself at 4/9
 *      minus the head, never below a small floor.
 *   2. The stream draws the host strip, Lane B's `pins`, the Chat · Decisions · Files switch and the expiry line INSIDE
 *      that one stack, and closes it BEFORE the messages / Decisions / Files scrollers — nothing pinned is drawn
 *      outside it, and no second cap is written anywhere.
 *
 * Sabotage (9 Nov 2026): the switch moved out of the stack → 2 RED; `isolate` dropped → 1 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { stripComments } from './strip-comments';
import { ChatPinnedStack, PINNED_STACK_CAP, pinnedStackMaxHeight } from '@/app/_components/chat/chat-pinned-stack';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · one cap, 4/9 of the screen; the stack scrolls inside itself and never paints over a panel', () => {
  assert.equal(PINNED_STACK_CAP, 'calc(100dvh * 4 / 9)');
  const html = renderToStaticMarkup(React.createElement(ChatPinnedStack, null, React.createElement('p', null, 'pin')));
  assert.match(html, /data-chat-pinned-stack=""/);
  assert.match(html, /class="[^"]*\bisolate\b[^"]*"/, 'a pin can paint over an open panel');
  assert.match(html, /class="[^"]*\boverflow-y-auto\b[^"]*"/, 'the stack does not scroll inside itself');
  assert.match(html, /class="[^"]*\bshrink-0\b[^"]*"/);
  assert.match(html, /max-height:calc\(100dvh \* 4 \/ 9\)/, 'the stack is not capped at 4/9');
  // Under a 64 px head: 4/9 minus the head, with a floor so a pin is never cut to nothing.
  assert.equal(pinnedStackMaxHeight(64), 'max(4.5rem, calc(calc(100dvh * 4 / 9) - 64px))');
  assert.equal(pinnedStackMaxHeight(0), PINNED_STACK_CAP);
});

test('2 · the stream pins the strip, Lane B\'s pins, the switch and the expiry line INSIDE the one stack', () => {
  const s = read('app/_components/chat-message-stream.tsx');
  const open = s.indexOf('<ChatPinnedStack>');
  const close = s.indexOf('</ChatPinnedStack>');
  assert.ok(open > 0 && close > open, 'the stream has no pinned stack');
  assert.equal(s.split('<ChatPinnedStack>').length - 1, 1, 'two pinned stacks');
  const inside = s.slice(open, close);
  for (const [what, re] of [
    ['the host strip', /<ChatHostStrip\b/],
    ["Lane B's pins", /\{pins\}/],
    ['the Chat · Decisions · Files switch', /<ThreadViewSwitch\b/],
    ['the file-expiry line', /data-chat-files-expiry/],
  ] as const) {
    assert.match(inside, re, `${what} is drawn outside the pinned stack`);
  }
  // …and it closes before every scroller below it.
  for (const scroller of ["view === 'decisions' ?", '<DecisionsPanel', '<FilesPanel', 'ref={listRef}']) {
    const at = s.indexOf(scroller);
    assert.ok(at > close, `${scroller} sits inside the pinned stack`);
  }
  // No second cap anywhere under app/ (the constant has one home).
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const n of readdirSync(dir)) {
      if (n === 'node_modules' || n === '.next') continue;
      const f = join(dir, n);
      if (statSync(f).isDirectory()) walk(f);
      else if (/\.tsx?$/.test(n) && !n.includes('.test.') && /100dvh \* 4 \/ 9|100dvh\*4\/9/.test(readFileSync(f, 'utf8'))) hits.push(relative(WEB, f));
    }
  };
  walk(join(WEB, 'app'));
  assert.deepEqual(hits, ['app/_components/chat/chat-pinned-stack.tsx'], `a second 4/9 cap: ${hits.join(', ')}`);
});
