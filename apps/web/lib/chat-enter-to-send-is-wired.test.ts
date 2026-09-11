/**
 * chat-enter-to-send-is-wired.test.ts — the decision lives in
 * chat-enter-to-send.ts; this guard makes sure the composer actually calls it
 * rather than growing a second, drifted copy of "is this Enter-to-send" inline
 * in the JSX (which is exactly how the tour composer had its OWN hand-rolled
 * `if (e.key === 'Enter' && !e.shiftKey)` — correct-looking, but missing the
 * IME, modifier and coarse-pointer holdbacks entirely).
 *
 * Reads SOURCE, comment-stripped via the repo's one string-aware stripper
 * (lib/strip-comments.ts) — a comment claiming the wiring exists is not the
 * wiring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');

const REAL_COMPOSER = join(WEB, 'app/_components/chat-send-form.tsx');
const TOUR_COMPOSER = join(WEB, 'app/tour/_components/tour-chat-thread.tsx');

function textareaBlock(code: string): string {
  const open = code.indexOf('<textarea');
  assert.notEqual(open, -1, 'no <textarea> found — this file no longer has a composer');
  const close = code.indexOf('/>', open);
  return close === -1 ? code.slice(open) : code.slice(open, close);
}

test('ChatSendForm — the real composer wires onKeyDown to shouldSendOnEnter', () => {
  const code = stripComments(readFileSync(REAL_COMPOSER, 'utf8'));

  assert.match(
    code,
    /import\s*{[^}]*shouldSendOnEnter[^}]*}\s*from\s*['"]@\/lib\/chat-enter-to-send['"]/,
    'ChatSendForm must import shouldSendOnEnter from lib/chat-enter-to-send, not ' +
      'reimplement the Enter/Shift+Enter decision inline',
  );

  const textarea = textareaBlock(code);
  assert.match(
    textarea,
    /onKeyDown=/,
    'the <textarea> has no onKeyDown — Enter would fall back to the browser default ' +
      '(insert a newline), and the send button would be the only way to send',
  );
  assert.match(
    textarea,
    /shouldSendOnEnter\(/,
    'onKeyDown exists but does not call shouldSendOnEnter — this is the drift the ' +
      'guard exists to catch: a hand-rolled `key === \'Enter\'` check that quietly ' +
      'loses the IME/modifier/coarse-pointer holdbacks',
  );
  assert.match(
    textarea,
    /requestSubmit\(/,
    'shouldSendOnEnter deciding to send is not enough — the handler must call ' +
      'form?.requestSubmit() (after preventDefault) or nothing actually sends',
  );
});

test('TourChatThread — the demo composer matches the real one, not a hand-rolled copy', () => {
  const code = stripComments(readFileSync(TOUR_COMPOSER, 'utf8'));

  assert.match(
    code,
    /import\s*{[^}]*shouldSendOnEnter[^}]*}\s*from\s*['"]@\/lib\/chat-enter-to-send['"]/,
    'TourChatThread must reuse the shared shouldSendOnEnter — its markup is copied ' +
      'from ChatSendForm on purpose, and the key handling should not drift from it',
  );

  const textarea = textareaBlock(code);
  assert.match(textarea, /onKeyDown=/, 'the tour composer\'s <textarea> lost its onKeyDown');
  assert.match(
    textarea,
    /shouldSendOnEnter\(/,
    'the tour composer has its own inline Enter check again instead of the shared helper',
  );
});
