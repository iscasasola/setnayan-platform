/**
 * the-chat-composer-stays-in-the-window.test.ts — ✍ THE WIRING behind "the chat's message box is in the window, on top".
 *
 * The CLAIM is measured in a real browser by `tests/e2e/the-chat-box-is-in-the-window.spec.ts` (the composer's box
 * inside the window and topmost, at 390 × 844, 768 × 1024 and 1280 × 800, at load and scrolled). Source checks cannot
 * say where a box stands — #7801 passed one while the couple's composer still ended at 1093 of 1024 (W1, RW-330). This
 * file only holds what the spec cannot reach: that the SHIPPED `ChatPanes` calls the function the spec runs, on every
 * event that moves the pane, and that the spec still exists and runs that function.
 *
 * 🛡 SABOTAGE (seen RED, then restored, 2026-11-15): the scroll listener removed (red: 1) · the spec's `fitChatPane`
 * import removed (red: 2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · ChatPanes sizes the pane with fitChatPane on load, resize, scroll and any change in the page’s height', () => {
  const panes = code('app/dashboard/[eventId]/messages/_components/chat-panes.tsx');
  assert.match(panes, /import \{ fitChatPane \} from '\.\/chat-pane-fit';/);
  assert.match(panes, /fitChatPane\(root\);/, 'the pane is not sized on load');
  assert.match(panes, /window\.addEventListener\('resize', measure\)/);
  assert.match(panes, /window\.addEventListener\('scroll', measure/, 'the pane does not grow when it rises to the pin line');
  assert.match(panes, /watch\?\.observe\(document\.body\)/, 'a strip that arrives late is not seen');
  assert.doesNotMatch(panes, /--sn-chat-pane-gap/, 'the guessed gap is back');
  const fit = code('app/dashboard/[eventId]/messages/_components/chat-pane-fit.ts');
  assert.match(fit, /pane\.getBoundingClientRect\(\)\.top/, 'the pane is no longer sized from where it stands');
  const css = code('app/globals.css');
  assert.match(css, /\[data-chat-panes\] \[data-supplier-cols-pane\] \{\s*height: calc\(100dvh - var\(--sn-chat-pane-top,/);
});

test('2 · the measuring spec exists and runs the shipped fitChatPane on the shipped markup', () => {
  const spec = readFileSync(join(WEB, 'tests/e2e/the-chat-box-is-in-the-window.spec.ts'), 'utf8');
  assert.match(spec, /import \{ fitChatPane \} from '\.\.\/\.\.\/app\/dashboard\/\[eventId\]\/messages\/_components\/chat-pane-fit';/);
  assert.match(spec, /document\.elementFromPoint\(/, 'the spec no longer checks what is drawn over the composer');
  const render = readFileSync(join(WEB, 'tests/e2e/the-chat-box-is-in-the-window.render.ts'), 'utf8');
  for (const part of ['ChatPanes', 'ChatThreadFrame', 'ChatBox', 'SwipeToDelete']) {
    assert.match(render, new RegExp(`const \\{ ${part} \\} = await import\\(`), `the spec measures a copy of ${part}`);
  }
});
