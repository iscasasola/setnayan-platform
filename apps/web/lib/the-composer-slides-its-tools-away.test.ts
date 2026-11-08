/**
 * ↔ THE COMPOSER SLIDES ITS TOOLS AWAY (owner, 9 Nov: "fully animate the message when the text box expands and the buttons
 * move to the side away from the screen"; "0.7 second animation is our default" — 03-FINAL-RULINGS).
 *
 *   1. ONE group holds the ＋, the 🔒, the paperclip and the 📷 · 🖼 shortcuts; it goes `out` while a draft or a private
 *      recipient is set and comes back `in` when the box empties or × leaves private. Send is NEVER in it (it stays put).
 *   2. The movement is the house speed and spring — `--sn-pill-dur` + `--sn-pill-spring`, never a typed duration: the
 *      group's one grid column closes while its row slides LEFT (translateX), and the box (flex 1) grows in the same
 *      motion. Reduced motion: the same end states, no transition.
 *   3. Out = not reachable (`aria-hidden` + `inert`); a composer drawn already private never draws the group at all.
 *
 * Sabotage (9 Nov 2026): Send moved into the group → 1 RED; `700ms` typed in place of the token → 2 RED; the reduced-motion
 * rule dropped → 2 RED; `inert` dropped from the out state → 3 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { setPrivateTo } from '@/app/_components/chat/private-to';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const h = React.createElement;

test('1 · one group slides: the ＋, 🔒, paperclip, 📷 and 🖼 — never Send', () => {
  const lead = h('button', { type: 'button', 'data-lab-plus': '' }, '+');
  const html = renderToStaticMarkup(h(ChatSendForm, { threadId: 'thread-slide', sendAction: async () => {}, lead }));
  const at = html.indexOf('data-chat-composer-tools="in"');
  assert.ok(at > 0, 'the tools are not one sliding group (or start out)');
  const group = html.slice(html.lastIndexOf('<div', at), html.indexOf('data-chat-message-box'));
  for (const [what, re] of [['the ＋', /data-lab-plus/], ['the paperclip', /name="attachment"/], ['📷', /data-chat-camera/], ['🖼', /data-chat-photo/]] as const) {
    assert.match(group, re, `${what} does not slide with the group`);
  }
  assert.doesNotMatch(group, /aria-label="Send"/, 'Send slides away — it must stay put');
  assert.match(html.slice(html.indexOf('data-chat-message-box')), /aria-label="Send"/);
  const src = read('app/_components/chat-send-form.tsx');
  assert.match(src, /const toolsOut = Boolean\(privateTo\) \|\| hasDraft;/, 'typing or going private no longer slides the tools out');
  assert.match(src, /data-chat-composer-tools=\{toolsShown \? 'in' : 'out'\}/);
});

test('2 · the house speed and spring, one motion, and none at all under reduced motion', () => {
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const from = css.indexOf('.sn-composer-tools {');
  const block = css.slice(from, css.indexOf('.sn-composer-box { transition: none; }', from) + 40);
  assert.match(block, /transition: grid-template-columns var\(--sn-pill-dur\) var\(--sn-pill-spring\);/, 'the room does not close at the house speed');
  assert.match(block, /\.sn-composer-tools > \* \{\s*min-width: 0;\s*width: max-content;\s*transition: transform var\(--sn-pill-dur\) var\(--sn-pill-spring\), opacity var\(--sn-pill-dur\) var\(--sn-pill-spring\);/, 'the tools do not slide (their own width, off the left edge) and fade at the house speed (v8.3)');
  assert.match(block, /\[data-chat-composer-tools='out'\] \{ grid-template-columns: minmax\(0, 0fr\); \}/);
  assert.match(block, /\[data-chat-composer-tools='out'\] > \* \{ transform: translateX\(-100%\); opacity: 0; \}/, 'the tools do not slide LEFT and fade out (v8.3)');
  assert.match(block, /\.sn-composer-box \{ transition: margin var\(--sn-pill-dur\) var\(--sn-pill-spring\); \}/);
  assert.doesNotMatch(block.slice(0, block.indexOf('@media')), /\d+m?s\b(?![^;]*var)/, 'a hand-typed duration in the composer slide');
  assert.match(block, /@media \(prefers-reduced-motion: reduce\) \{\s*\.sn-composer-tools,\s*\.sn-composer-tools > \*,\s*\.sn-composer-box \{ transition: none; \}/, 'reduced motion still moves');
  assert.match(css, /--sn-pill-dur:\s*700ms;/, 'the house speed is no longer 0.7 s');
  // The unmount after the slide reads the SAME token — no number typed in the component either.
  const src = read('app/_components/chat-send-form.tsx');
  assert.match(src, /pressMs\(getComputedStyle\(document\.documentElement\)\.getPropertyValue\('--sn-pill-dur'\)\)/);
  assert.match(src, /if \(reduceMotion\) \{\s*setToolsMounted\(false\);/, 'reduced motion waits out a slide that does not happen');
});

test('3 · out is unreachable; a composer drawn already private never draws the group', () => {
  const src = read('app/_components/chat-send-form.tsx');
  assert.match(src, /\{\.\.\.\(toolsShown \? \{\} : \{ 'aria-hidden': true, inert: true \}\)\}/, 'a slid-out tool can still be reached');
  setPrivateTo('thread-slide-priv', { userId: '00000000-0000-4000-8000-0000000000e1', name: 'Jose' });
  const priv = renderToStaticMarkup(h(ChatSendForm, { threadId: 'thread-slide-priv', sendAction: async () => {} }));
  setPrivateTo('thread-slide-priv', null);
  assert.doesNotMatch(priv, /data-chat-composer-tools/, 'a private composer draws the tools');
});
