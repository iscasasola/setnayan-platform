/**
 * THE HOST STRIP OPENS NO CONNECTION (THE ONE BUILD; spec B1 §5 guard 10). Who is "in this chat now" is read from the
 * stream's EXISTING presence channel (`chat-presence-${threadId}` → `presentIds`, passed as a prop); the hearts ride a
 * second `.on()` on the EXISTING `chat-${threadId}` channel. Sabotage (2026-11-08): `supabase.channel(` in the strip → red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(import.meta.dirname, '..', '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the strip and the heart chip open no channel and read presence from props', () => {
  for (const rel of ['app/_components/chat/chat-host-strip.tsx', 'app/_components/chat/message-heart.tsx']) {
    const src = read(rel);
    assert.doesNotMatch(src, /\.channel\(|createClient\(/, `${rel} opens its own connection`);
  }
  assert.match(read('app/_components/chat/chat-host-strip.tsx'), /presentIds: ReadonlySet<string>/);
});

test('the stream opens no NEW channel for the strip or the hearts', () => {
  const stream = read('app/_components/chat-message-stream.tsx');
  const channels = [...stream.matchAll(/\.channel\(`([^`]+)`/g)].map((m) => m[1]);
  assert.deepEqual(channels.sort(), ['chat-${threadId}', 'chat-presence-${threadId}'].sort(), `channels: ${channels.join(', ')}`);
  assert.match(stream, /table: 'chat_message_hearts',\s*filter: `thread_id=eq\.\$\{threadId\}`/, 'hearts are not on the shared channel');
  assert.match(stream, /setPresentIds\(new Set\(Object\.keys\(state\)\)\)/, 'the ring is not fed by the existing presence channel');
});
