/**
 * 🚫 A BUBBLE IS NOT A DECISION (THE ONE BUILD, owner 8 Nov 2026: "bubble → decision" removed; spec B1 §5 guard 7).
 *
 * Tap on a chat bubble HEARTS it (v111) and does nothing else. Decisions come from the shipped facts
 * (`lib/thread-decisions.ts`, read by the stream's Decisions panel) — never from a message somebody picks.
 * ⚠ Corrected from the plan's wording: the stream DOES import `thread-decisions` (its Decisions panel has for months);
 * what is pinned is that the HEART code never does, and the bubble's tap calls nothing but the heart.
 * Sabotage (2026-11-08): add a "Make this a decision" button to message-heart.tsx → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the heart code imports nothing about decisions', () => {
  for (const rel of ['app/_components/chat/message-heart.tsx', 'lib/chat-hearts.ts', 'app/_components/chat/chat-host-strip.tsx']) {
    const src = read(rel);
    assert.ok(src.length > 200, `${rel} read short`);
    assert.doesNotMatch(src, /thread-decisions|[Dd]ecision/, `${rel} reaches for decisions`);
  }
});

test("the bubble's own tap does nothing but heart", () => {
  const stream = read('app/_components/chat-message-stream.tsx');
  const at = stream.indexOf('data-chat-heartable=""');
  assert.ok(at > 0, 'the heartable bubble is gone');
  const open = stream.lastIndexOf('<div', at);
  const tag = stream.slice(open, stream.indexOf('>', at));
  // 11 Nov 2026: the press-and-hold "Reply privately" menu is gone (the 🔒 is the one private door) — a tap is a heart.
  assert.match(tag, /onClick=\{\(e\) => \{\s*if \(tapMeansHeart\(e\.target as Element\)\) toggleHeart\(m\.message_id\);\s*\}\}/);
  assert.doesNotMatch(stream, /(Make|Turn) (this|it) (into )?a decision/i, 'a bubble action names a decision');
});
