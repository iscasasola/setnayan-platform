/**
 * THE HOST STRIP OPENS NO CONNECTION (THE ONE BUILD; spec B1 §5 guard 10). Who is "in this chat now" is read from the
 * stream's EXISTING presence channel (`chat-presence-${threadId}` → `presentIds`, passed as a prop); the hearts ride a
 * second `.on()` on the EXISTING `chat-${threadId}` channel. Sabotage (2026-11-08): `supabase.channel(` in the strip → red.
 *
 * 🟢 THE RING IS NEVER CLIPPED (Build 2 #26b, 8 Nov). The scrolling list clips on every side; the "in this chat now"
 * ring draws outside the avatar (ring width + ring offset). The list's padding on each side must be at least that.
 * Sabotage (8 Nov): `p-1` back to the shipped `pb-1` → red ("top padding 0px < ring 4px").
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

test('the "in chat" ring is never clipped: the scrolling list pads at least the ring\'s width on every side', () => {
  const src = read('app/_components/chat/chat-host-strip.tsx');
  const ring = /ring-(\d+) ring-success-600 ring-offset-(\d+)/.exec(src);
  assert.ok(ring, 'the ring classes moved — re-anchor this test on the new ring');
  const ringPx = Number(ring[1]) + Number(ring[2]);
  const ul = /<ul\s+className="([^"]+)"/.exec(src);
  assert.ok(ul, 'the strip lost its <ul>');
  const cls = (ul[1] ?? '').split(/\s+/);
  assert.ok(cls.includes('overflow-x-auto'), 'the list no longer scrolls — re-read the clipping rule');
  const px = (side: 't' | 'b' | 'l' | 'r') => {
    let n = 0;
    for (const c of cls) {
      const m = /^p([xytblr]?)-(\d+(?:\.\d+)?)$/.exec(c);
      if (!m) continue;
      const k = m[1];
      if (k === '' || k === side || (k === 'x' && (side === 'l' || side === 'r')) || (k === 'y' && (side === 't' || side === 'b'))) {
        n = Math.max(n, Number(m[2]) * 4);
      }
    }
    return n;
  };
  for (const [side, name] of [['t', 'top'], ['b', 'bottom'], ['l', 'left'], ['r', 'right']] as const) {
    assert.ok(px(side) >= ringPx, `${name} padding ${px(side)}px < ring ${ringPx}px — the ring is clipped`);
  }
});
