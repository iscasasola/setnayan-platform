/**
 * the-chat-composer-stays-in-the-window.test.ts — ✍ FROM 701 THE CHAT'S MESSAGE BOX IS ALWAYS IN THE WINDOW.
 *
 * W1, live 08b8522 (RW-327), after #7547 put the open thread beside the list: the composer's foot sat BELOW the window
 * — couple 1093 of 1024 at 768 and 861 of 800 at 1280, supplier 916 of 800 at 1280. Two causes, one guard each:
 *
 *   1 · the couple's "Plan with peace of mind" strip arrives after `ChatPanes` measured the gap above its column, so the
 *       pane stayed sized for a column that had moved down by the strip's height. The gap is now re-measured whenever
 *       the page above changes height (a ResizeObserver on the body), not only on a window resize;
 *   2 · a busy thread (head + notice + pinned band + the stream's 14rem floor) outgrows a short window, the column
 *       scrolls itself, and the composer scrolled with it. In the pane the composer now holds the column's foot.
 *
 * 🛡 SABOTAGE (seen RED, then restored, 2026-11-15): `watch?.observe(document.body)` removed (red: 1) · the sticky
 * composer rule deleted from globals.css (red: 2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the pane’s gap is re-measured when the page above the chat changes height', () => {
  const panes = code('app/dashboard/[eventId]/messages/_components/chat-panes.tsx');
  assert.match(panes, /root\.style\.setProperty\('--sn-chat-pane-gap'/, 'the pane no longer subtracts the gap above it');
  assert.match(panes, /new ResizeObserver\(measure\)/, 'the gap is measured once and goes stale when a strip arrives');
  assert.match(panes, /watch\?\.observe\(document\.body\)/, 'nothing watches the page grow above the chat');
  assert.match(panes, /watch\?\.disconnect\(\)/, 'the watcher outlives the chat');
});

test('2 · from 701 the composer holds the thread column’s foot while the rest scrolls above it', () => {
  const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));
  // The rule must sit inside the 701 media block that seats the chat in its pane.
  const at = css.indexOf('[data-chat-panes] [data-supplier-cols-pane] [data-chat-composer-gutter]');
  assert.ok(at > 0, 'the composer is not held in the pane');
  const block = css.slice(css.lastIndexOf('@media', at), at);
  assert.match(block, /^@media \(min-width: 701px\)/, 'the composer rule is not the pane’s (from 701)');
  const rule = css.slice(at, css.indexOf('}', at));
  assert.match(rule, /position:\s*sticky/);
  assert.match(rule, /bottom:\s*0/);
  assert.match(rule, /background-color:/, 'the stream would show through the held composer');
  // The composer's gutter is the element the rule names.
  assert.match(code('app/_components/chat/chat-box.tsx'), /data-chat-composer-gutter=""/, 'the composer lost its handle');
});
