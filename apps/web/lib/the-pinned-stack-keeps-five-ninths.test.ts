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
 *   3. PINNED STAYS PINNED (owner, 9 Nov, "the pinned on top should stay pinned"): the strip and the switch sit in the
 *      stack's FIXED part, which never scrolls; only the region below (Lane B's pins, the expiry line) scrolls when over
 *      the cap. Measured in the labs too: the strip's top y is unchanged after the messages and the pin region scroll.
 *
 *   4. INSIDE A PICKED PAGE THE CHAT IS IN FLOW: both picked shells fill the body with Chat (`fillPages={['chat']}`), the
 *      body does not scroll then, the thread's phone takeover becomes an in-flow box (`position: relative`) under the
 *      shell's own pinned row and menu, the embedded wrappers fill (no `min-h-[70dvh]`), and a picked chat draws no
 *      empty 52 px head row. Measured 9 Nov: the takeover had covered the shell's ✕ and page menu and scrolled the strip
 *      away with it.
 *
 * Sabotage (9 Nov 2026): the switch moved out of the stack → 2 RED; `isolate` dropped → 1 RED; the strip moved into the
 * scrolling region → 3 RED; the stack itself made to scroll again (`overflow-y-auto`) → 1 RED.
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
  const html = renderToStaticMarkup(
    React.createElement(ChatPinnedStack, { fixed: React.createElement('b', null, 'strip') }, React.createElement('p', null, 'pin')),
  );
  const outer = html.slice(0, html.indexOf('>') + 1);
  assert.match(outer, /data-chat-pinned-stack=""/);
  assert.match(outer, /class="[^"]*\bisolate\b[^"]*"/, 'a pin can paint over an open panel');
  assert.match(outer, /class="[^"]*\boverflow-hidden\b[^"]*"/, 'the stack itself scrolls — the strip would scroll away');
  assert.doesNotMatch(outer, /overflow-y-auto/, 'the stack itself scrolls — the strip would scroll away');
  assert.match(outer, /class="[^"]*\bshrink-0\b[^"]*"/);
  // The fixed part never scrolls; the region below it does, inside the cap.
  assert.match(html, /<div class="shrink-0" data-chat-pinned-fixed=""><b>strip<\/b><\/div>/, 'the fixed part can scroll');
  assert.match(html, /<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain" data-chat-pinned-scroll=""><p>pin<\/p><\/div>/, 'the pin region does not scroll inside the stack');
  assert.match(html, /max-height:calc\(100dvh \* 4 \/ 9\)/, 'the stack is not capped at 4/9');
  // Under a 64 px head: 4/9 minus the head, with a floor so a pin is never cut to nothing.
  assert.equal(pinnedStackMaxHeight(64), 'max(4.5rem, calc(calc(100dvh * 4 / 9) - 64px))');
  assert.equal(pinnedStackMaxHeight(0), PINNED_STACK_CAP);
  // The fixed part (strip + switch) is never clipped: on a short screen the cap gives way to it.
  assert.equal(pinnedStackMaxHeight(161, 155), 'max(155px, 4.5rem, calc(calc(100dvh * 4 / 9) - 161px))');
});

test('2 · the stream pins the strip, Lane B\'s pins, the switch and the expiry line INSIDE the one stack', () => {
  const s = read('app/_components/chat-message-stream.tsx');
  const open = s.indexOf('<ChatPinnedStack');
  const close = s.indexOf('</ChatPinnedStack>');
  assert.ok(open > 0 && close > open, 'the stream has no pinned stack');
  assert.equal(s.split('<ChatPinnedStack').length - 1, 1, 'two pinned stacks');
  const inside = s.slice(open, close);
  for (const [what, re] of [
    ['the host strip', /<ChatHostStrip\b/],
    ["Lane B's pins", /\{pins\}/],
    ['the Chat · Decisions · Files switch', /<ThreadViewSwitch\b/],
    ['the file-expiry line', /data-chat-files-expiry/],
  ] as const) {
    assert.match(inside, re, `${what} is drawn outside the pinned stack`);
  }
  // …and it closes before every scroller below it (the routed pages' full Decisions / Files views and the messages).
  // v8.3 round 2: inside a picked shell the 📎 opens Files + Decisions as a PANEL inside the stack, on purpose — so the
  // full views are counted from the stack's close, and the in-stack copies must be that panel and nothing else.
  const below = s.slice(close);
  for (const scroller of ["{!inPicked && view === 'decisions' ?", '<DecisionsPanel', '<FilesPanel', 'ref={listRef}']) {
    assert.ok(below.includes(scroller), `${scroller} is not below the pinned stack`);
  }
  for (const panel of ['<DecisionsPanel', '<FilesPanel']) {
    const inStack = inside.split(panel).length - 1;
    assert.ok(inStack <= 1, `${panel} is drawn more than once inside the stack`);
    if (inStack) assert.match(inside, new RegExp(`\\{inPicked && filesOpen \\? \\([\\s\\S]*${panel}`), `${panel} is inside the stack outside the picked 📎 panel`);
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

test('3 · pinned stays pinned: the strip and the switch are FIXED; only the pins and the expiry line scroll', () => {
  const s = read('app/_components/chat-message-stream.tsx');
  const open = s.indexOf('<ChatPinnedStack');
  const fixedAt = s.indexOf('fixed={', open);
  const bodyAt = s.indexOf('{pins}', open);
  const close = s.indexOf('</ChatPinnedStack>');
  assert.ok(open > 0 && fixedAt > open && bodyAt > fixedAt && close > bodyAt, 'the stack lost its fixed part');
  const fixed = s.slice(fixedAt, bodyAt);
  const scrolling = s.slice(bodyAt, close);
  assert.match(fixed, /<ChatHostStrip\b/, 'the who\'s-here strip can scroll away');
  assert.match(fixed, /<ThreadViewSwitch\b/, 'the Chat · Decisions · Files switch can scroll away');
  assert.doesNotMatch(scrolling, /<ChatHostStrip\b|<ThreadViewSwitch\b/, 'a fixed row is inside the scrolling region');
  assert.match(scrolling, /\{pins\}/);
  assert.match(scrolling, /data-chat-files-expiry/);
});

test('4 · inside a picked page the chat is in flow under the shell’s head and menu, and the body never scrolls it away', () => {
  for (const f of [
    'app/dashboard/[eventId]/vendors/[vendorId]/workspace/_components/picked-supplier-shell.tsx',
    'app/vendor-dashboard/clients/[eventId]/_components/picked-client-shell.tsx',
  ]) assert.match(read(f), /fillPages=\{\['chat'\]\}/, `${f}: Chat does not fill the picked body`);
  const shell = read('app/_components/picked/picked-shell.tsx');
  assert.match(shell, /const fills = fillPages\.includes\(page\);/);
  assert.match(shell, /fills \? 'flex flex-col overflow-y-hidden' : 'overflow-y-auto'/, 'a filled page can still scroll the body (and the pinned stack with it)');
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const at = css.indexOf('[data-picked-fill] [data-chat-takeover] {');
  assert.ok(at > 0, 'no in-flow rule for a chat inside a picked page');
  const rule = css.slice(at, css.indexOf('}', at));
  assert.match(rule, /position: relative;/, 'the takeover still fixes itself over the picked shell');
  assert.match(rule, /min-height: 0;/);
  for (const f of [
    'app/dashboard/[eventId]/messages/[threadId]/page.tsx',
    'app/vendor-dashboard/messages/[threadId]/page.tsx',
    'app/dev/_components/lab-picked-chat.tsx',
  ]) {
    const src = read(f);
    assert.doesNotMatch(src, /data-picked-[a-z]+-(page|chat)=[^>]*min-h-\[70dvh\]/, `${f}: the embedded chat is a fixed minimum again, so the body overflows`);
  }
  assert.match(read('app/_components/chat/chat-box.tsx'), /\{header \? \(/, 'a picked chat draws an empty head row');
  // Each message scroller holds its own sr-only labels (a containing block), or they stretch the box into a 2nd scroller.
  assert.match(read('app/_components/chat-message-stream.tsx'), /const scrollerChrome = `relative /, 'the scrollers are not containing blocks — their sr-only labels make the chat box scroll');
});

test('5 · a picked page opens OVER a full-screen Chats list — the list steps down while it is open', () => {
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const at = css.indexOf('body:has([data-picked-client]) .sn-vt-page:has([data-chat-takeover]),');
  assert.ok(at > 0, 'nothing lowers a full-screen Chats list under the picked page (z 45 over z 40)');
  const rule = css.slice(at, css.indexOf('}', at));
  assert.match(rule, /\[data-chat-takeover\]:not\(\[data-picked-client\] \[data-chat-takeover\]\)/, 'the picked page’s own chat would step down too');
  assert.match(rule, /z-index: var\(--sn-z-raised\);/);
  // …and the supplier's Chats list IS a takeover, so this rule is what lets the picked client show at all.
  assert.match(read('app/vendor-dashboard/messages/_components/supplier-chats.tsx'), /data-chat-takeover/);
});
