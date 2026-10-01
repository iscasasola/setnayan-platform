/**
 * GUARD — the chat icon's badge on the Suppliers header equals the Chats list's
 * unread count (P3, 2026-10-01). Both read `readCoupleUnread` and count with
 * `coupleUnreadCount` over the same active-thread predicate; these rules pin
 * the rule itself and that both pages still call it. Sabotaged when written:
 * counting archived threads (rule 2 red) and an unmeasured read as 0 (rule 3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  coupleUnreadCount,
  isActiveInboxThread,
  unreadThreadsFrom,
  COUPLE_UNREAD_UNKNOWN,
} from './couple-inbox';

const threads = [
  { thread_id: 't1', inquiry_status: 'accepted', archived: false, archived_at: null },
  { thread_id: 't2', inquiry_status: 'accepted', archived: false, archived_at: null },
  { thread_id: 't3', inquiry_status: 'pending', archived: false, archived_at: null },
  { thread_id: 't4', inquiry_status: 'accepted', archived: true, archived_at: null },
  { thread_id: 't5', inquiry_status: 'displaced', archived: false, archived_at: null },
];

// Messages from the OTHER side only (the reader drops the viewer's own).
const messages = [
  { thread_id: 't1', created_at: '2026-10-01T10:00:00Z' }, // after the read → unread
  { thread_id: 't2', created_at: '2026-09-30T10:00:00Z' }, // before the read → read
  { thread_id: 't3', created_at: '2026-09-29T10:00:00Z' }, // never read → unread
  { thread_id: 't4', created_at: '2026-10-01T10:00:00Z' }, // unread, but archived
  { thread_id: 't5', created_at: '2026-10-01T10:00:00Z' }, // unread, but displaced
];
const reads = [
  { thread_id: 't1', last_read_at: '2026-10-01T09:00:00Z' },
  { thread_id: 't2', last_read_at: '2026-10-01T09:00:00Z' },
];

test('1 · the SQL rule: newer than my last read, or never read', () => {
  assert.deepEqual([...unreadThreadsFrom({ messages, reads })].sort(), ['t1', 't3', 't4', 't5']);
});

test('2 · the badge equals the dots on the active list', () => {
  const unread = { threadIds: unreadThreadsFrom({ messages, reads }), measured: true };
  const badge = coupleUnreadCount(unread, threads);
  const dots = threads.filter(isActiveInboxThread).filter((t) => unread.threadIds.has(t.thread_id)).length;
  assert.equal(badge, 2);
  assert.equal(badge, dots);
});

test('3 · a refused read is unknown — no badge, never "0"', () => {
  assert.equal(coupleUnreadCount(COUPLE_UNREAD_UNKNOWN, threads), null);
});

test('4 · both doors read the one rule', () => {
  const root = join(__dirname, '..', 'app', 'dashboard', '[eventId]');
  const door = readFileSync(join(root, 'vendors', '_components', 'chats-door.tsx'), 'utf8');
  const inbox = readFileSync(join(root, 'messages', 'page.tsx'), 'utf8');
  for (const [name, src] of [['chats-door', door], ['messages/page', inbox]] as const) {
    assert.match(src, /readCoupleUnread\(/, `${name} no longer reads the one unread rule`);
    assert.match(src, /coupleUnreadCount\(unread, threads\)/, `${name} counts unread its own way`);
  }
  assert.match(inbox, /threads\.filter\(isActiveInboxThread\)/, 'the list splits active its own way');
  const page = readFileSync(join(root, 'vendors', 'page.tsx'), 'utf8');
  assert.match(page, /chatSlot=\{<ChatsDoor /, 'the chat icon left the Suppliers header');
});
