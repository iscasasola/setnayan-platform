/**
 * GUARD — the couple's unread count is ONE rule (P3, 2026-10-01):
 * `readCoupleUnread` + `coupleUnreadCount` over the same active-thread
 * predicate. These rules pin the rule itself and that the Chats list still
 * calls it. (Until 2026-10-08 a chat icon on the Suppliers header read it too;
 * that second door is retired — rule 4 now holds that it stays gone.) Sabotaged when written:
 * counting archived threads (rule 2 red) and an unmeasured read as 0 (rule 3 red).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
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

test('4 · the inbox reads the one rule, and Suppliers carries no second chat door', () => {
  const root = join(__dirname, '..', 'app', 'dashboard', '[eventId]');
  const inbox = readFileSync(join(root, 'messages', 'page.tsx'), 'utf8');
  assert.match(inbox, /readCoupleUnread\(/, 'messages/page no longer reads the one unread rule');
  assert.match(inbox, /coupleUnreadCount\(unread, threads\)/, 'messages/page counts unread its own way');
  assert.match(inbox, /threads\.filter\(isActiveInboxThread\)/, 'the list splits active its own way');
  // ⚖ Owner 2026-10-07 (the one-screen Suppliers shell, PR1): the chat icon on
  // the Suppliers header was a SECOND inbox door beside the top bar's Messages
  // icon — two chat icons on one screen. It is retired; the top bar's is the
  // only door. A second door coming back is what this now refuses.
  assert.equal(existsSync(join(root, 'vendors', '_components', 'chats-door.tsx')), false, 'the Suppliers chat door is back');
  const page = readFileSync(join(root, 'vendors', 'page.tsx'), 'utf8');
  assert.doesNotMatch(page, /ChatsDoor|chatSlot=/, 'the Suppliers page mounts a chat door of its own again');
  const shell = readFileSync(join(root, 'vendors', '_components', 'services-takeover.tsx'), 'utf8');
  assert.doesNotMatch(shell, /\{chatSlot\}|data-chats-door/, 'the Suppliers shell places a chat door again');
});
