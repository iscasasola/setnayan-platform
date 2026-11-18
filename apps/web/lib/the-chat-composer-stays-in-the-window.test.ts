/**
 * the-chat-composer-stays-in-the-window.test.ts — ✍ THE WIRING behind "the chat's message box is in the window, on top".
 *
 * The CLAIM is measured in a real browser by `tests/e2e/the-chat-box-is-in-the-window.spec.ts` (the composer's box
 * inside the window and topmost, at 390 × 844, 768 × 1024 and 1280 × 800, at load and scrolled). Source checks cannot
 * say where a box stands — #7801 passed one while the couple's composer still ended at 1093 of 1024 (W1, RW-330). This
 * file only holds what the spec cannot reach: that the SHIPPED `ChatPanes` calls the function the spec runs, on every
 * event that moves the pane, and that the spec still exists and runs that function.
 *
 * 🛡 SABOTAGE (seen RED, then restored, 2026-11-15): the timer fallback removed (red: 1) · the spec's strip insert
 * removed (red: 2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · ChatPanes hands its root to watchChatPane, which re-fits on everything that moves the pane — frame or timer', () => {
  const panes = code('app/dashboard/[eventId]/messages/_components/chat-panes.tsx');
  assert.match(panes, /import \{ watchChatPane \} from '\.\/chat-pane-fit';/);
  assert.match(panes, /return watchChatPane\(root\);/, 'the watcher is not started, or not stopped on unmount');
  assert.doesNotMatch(panes, /--sn-chat-pane-gap/, 'the guessed gap is back');
  const fit = code('app/dashboard/[eventId]/messages/_components/chat-pane-fit.ts');
  assert.match(fit, /pane\.getBoundingClientRect\(\)\.top/, 'the pane is no longer sized from where it stands');
  assert.match(fit, /window\.addEventListener\('resize', refit\)/);
  assert.match(fit, /window\.addEventListener\('scroll', refit/, 'the pane does not grow when it rises to the pin line');
  assert.match(fit, /new MutationObserver\(refit\)/, 'a strip inserted above the pane is not seen');
  assert.match(fit, /observe\(document\.body, \{ childList: true, subtree: true \}\)/);
  // A tab that runs no frames still re-fits (W1's stuck 93 px, after #7804).
  assert.match(fit, /timer = setTimeout\(run, \d+\);/, 'the re-fit waits for a frame a hidden tab never runs');
  const css = code('app/globals.css');
  assert.match(css, /\[data-chat-panes\] \[data-supplier-cols-pane\] \{\s*height: calc\(100dvh - var\(--sn-chat-pane-top,/);
});

test('2 · the measuring spec exists and runs the shipped watcher on the shipped markup', () => {
  const spec = readFileSync(join(WEB, 'tests/e2e/the-chat-box-is-in-the-window.spec.ts'), 'utf8');
  assert.match(spec, /import \{ fitChatPane, watchChatPane \} from '\.\.\/\.\.\/app\/dashboard\/\[eventId\]\/messages\/_components\/chat-pane-fit';/);
  assert.match(spec, /document\.elementFromPoint\(/, 'the spec no longer checks what is drawn over the composer');
  assert.match(spec, /window\.requestAnimationFrame = \(\) => 0/, 'the spec no longer reproduces a tab that runs no frames');
  assert.match(spec, /await insertStrip\(page\);/, 'the spec no longer inserts the strip after paint');
  const render = readFileSync(join(WEB, 'tests/e2e/the-chat-box-is-in-the-window.render.ts'), 'utf8');
  for (const part of ['ChatPanes', 'ChatThreadFrame', 'ChatBox', 'SwipeToDelete']) {
    assert.match(render, new RegExp(`const \\{ ${part} \\} = await import\\(`), `the spec measures a copy of ${part}`);
  }
});
