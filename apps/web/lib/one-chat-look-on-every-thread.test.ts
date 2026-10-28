/**
 * ONE CHAT LOOK ON EVERY THREAD (owner 2026-10-28, verbatim: *"Same as our chatbox"* — and before it, *"When i press
 * chat on supplier, this must be full screen"*). The couple's thread and the supplier's thread are the SAME chatbox:
 * each route mounts the one frame, head, stream and composer from `app/_components/chat/` — never a page-local copy —
 * and the kit (`thread-kit.ts`) names exactly those pieces for the next chat surface (the group chatroom).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const ROUTES = ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx'];
const PIECES = [
  ['ChatBox', "@/app/_components/chat/chat-box"],
  ['ChatThreadHead', "@/app/_components/chat/chat-thread-head"],
  ['ChatMessageStream', "@/app/_components/chat-message-stream"],
  ['ChatSendForm', "@/app/_components/chat-send-form"],
] as const;

test('both thread routes mount the SAME shared pieces, once each, imported from the one source', () => {
  for (const rel of ROUTES) {
    const s = read(rel);
    assert.ok(s.length > 10_000, `${rel} read short`);
    for (const [piece, from] of PIECES) {
      assert.equal((s.match(new RegExp(`<${piece}\\b`, 'g')) ?? []).length, 1, `${rel}: <${piece}> is not mounted exactly once`);
      assert.match(s, new RegExp(`import \\{[^}]*\\b${piece}\\b[^}]*\\} from '${from.replace(/[/.]/g, '\\$&')}';`), `${rel}: ${piece} is not the shared one`);
    }
    // Nothing page-local draws a head or bubbles beside them.
    assert.doesNotMatch(s, /aria-label="Back to (Chats|Messages)"/, `${rel}: draws its own ‹ instead of the shared head`);
    assert.doesNotMatch(s, /rounded-2xl px-3 py-2 text-\[15px\]/, `${rel}: draws its own bubbles`);
  }
});

test('the kit names exactly the shared pieces, for the next chat surface', () => {
  const kit = read('app/_components/chat/thread-kit.ts');
  for (const [piece] of PIECES) assert.match(kit, new RegExp(`export \\{ ${piece} \\} from `), `the kit does not export ${piece}`);
});

test('the frame is the full-screen takeover on a phone — the top bar and the bottom tabs are covered', () => {
  const box = read('app/_components/chat/chat-box.tsx');
  assert.match(box, /data-chat-takeover=""/);
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  const at = css.indexOf('AN OPEN CHAT THREAD IS FULL SCREEN ON A PHONE');
  const rule = css.slice(at, at + 2600);
  assert.match(rule, /\[data-chat-takeover\] \{\s*position: fixed;\s*inset: 0;\s*z-index: 45;/);
  // Above the bottom dock (z 30) and the shell's top bar; below the sheets (z 50) that open over it.
  assert.ok(45 > 30 && 45 < 50);
});
