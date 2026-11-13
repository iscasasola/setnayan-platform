/**
 * 👈 REMOVING YOUR OWN FILE FROM A CHAT — the ↺ undo ring and the swipe (DECISION_LOG 2026-11-13 "CHAT FILE: UNDO RING
 * SHOWS AT ONCE ON SEND…" + "CHAT FILE UNDO DRAWING APPROVED"). The database half is
 * `tests/db/you-may-remove-your-own-file-from-a-chat.db.test.ts`; this holds the drawing and the wiring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React, { createElement } from 'react';
import {
  CHAT_FILE_EVERYONE_CLOSED,
  CHAT_FILE_BOOKING_LINE,
  CHAT_FILE_REMOVE_FAILED,
  everyoneMinutesLeft,
  fileLeftMessage,
  refusalFromError,
  removedForEveryoneLine,
  undoSecondsLeft,
} from '@/lib/chat-file-removal';

// The components compile with the classic JSX runtime under tsx — React must be global before they load.
(globalThis as unknown as { React: unknown }).React = React;
async function draw() {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ChatFileUndoRing, OwnFileRow } = await import('./chat-file-swipe');
  return { renderToStaticMarkup, ChatFileUndoRing, OwnFileRow };
}

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('the ↺ ring sits LEFT of your just-sent file bubble — 44px, the seconds under it', async () => {
  const { renderToStaticMarkup, ChatFileUndoRing, OwnFileRow } = await draw();
  const html = renderToStaticMarkup(
    createElement(
      OwnFileRow,
      { ring: createElement(ChatFileUndoRing, { secondsLeft: 7, onUndo: () => {} }) },
      createElement('div', { 'data-test-bubble': '' }, 'moodboard-v2.jpg'),
    ),
  );
  const ring = html.indexOf('data-chat-file-undo-ring');
  const bubble = html.indexOf('data-test-bubble');
  assert.ok(ring >= 0, 'no ring drawn');
  assert.ok(bubble >= 0, 'no bubble drawn');
  assert.ok(ring < bubble, 'the ring is not before (left of) the bubble');
  assert.match(html, /justify-end/, 'your row is not right-aligned, so "left of the bubble" means nothing');
  assert.match(html, /h-11 w-11/, 'the ring is not 44px');
  assert.match(html, /aria-label="Undo send, 7 seconds left"/);
  assert.match(html, />7 s</);
  // Reduced motion: the arc's slide is motion-safe only.
  assert.match(html, /motion-safe:transition-\[stroke-dashoffset\]/);
});

test('no ring, no button — the row draws the bubble alone once the 10 s are over', async () => {
  const { renderToStaticMarkup, OwnFileRow } = await draw();
  const html = renderToStaticMarkup(createElement(OwnFileRow, { ring: null }, createElement('div', null, 'f')));
  assert.doesNotMatch(html, /data-chat-file-undo-ring/);
});

test('the clock: 10 s from the message’s own time, 5 min for everyone, read off the server’s seconds', () => {
  const sent = '2026-11-13T10:00:00.000Z';
  const t = Date.parse(sent);
  assert.equal(undoSecondsLeft(sent, t), 10);
  assert.equal(undoSecondsLeft(sent, t + 3_200), 7);
  assert.equal(undoSecondsLeft(sent, t + 10_000), 0);
  assert.equal(undoSecondsLeft(sent, t + 60_000), 0, 'come back later: the ring is gone');
  assert.equal(undoSecondsLeft(sent, t - 5_000), 10, 'a phone clock behind the server never shows more than 10');
  assert.equal(everyoneMinutesLeft(0), 5);
  assert.equal(everyoneMinutesLeft(125), 3);
  assert.equal(everyoneMinutesLeft(299), 1);
  assert.equal(everyoneMinutesLeft(300), 0);
  assert.equal(removedForEveryoneLine('You', '10:42 AM'), 'You removed a file · 10:42 AM');
  assert.equal(removedForEveryoneLine('Mara', '10:42 AM'), 'Mara removed a file · 10:42 AM');
  assert.equal(refusalFromError('remove_my_chat_file: BOOKING_FILE — …'), 'booking');
  assert.equal(refusalFromError('remove_my_chat_file: WINDOW_CLOSED — …'), 'window');
  assert.equal(refusalFromError('remove_my_chat_file: NOT_YOURS'), 'refused');
});

test('the approved words', () => {
  assert.equal(CHAT_FILE_EVERYONE_CLOSED, 'Delete for everyone is open for 5 minutes after sending.');
  assert.equal(CHAT_FILE_BOOKING_LINE, 'This file is part of the booking, so it stays for everyone.');
  assert.equal(CHAT_FILE_REMOVE_FAILED, 'Couldn’t delete your file. Try again.');
});

test('only YOUR file bubble gets the ring and the swipe — never words, never a private line, never theirs', () => {
  const s = read('app/_components/chat-message-stream.tsx');
  assert.equal((s.match(/<MaybeChatFileSwipe\b/g) ?? []).length, 1);
  assert.match(s, /const ownFile = mine && privateWith === null && hasFile;/);
  assert.match(s, /<MaybeChatFileSwipe\s+on=\{ownFile\}/);
  assert.match(s, /const hasFile = !hiddenForMe && !!\(m\.attachment_r2_key \|\| m\.attachment_url\)/);
  assert.match(s, /createdAt=\{m\.created_at\}/, 'the ring stopped reading the message’s own time');
});

test('the ring needs no swipe, the swipe opens the sheet, and a failure says so', () => {
  const src = read('app/_components/chat/chat-file-swipe.tsx');
  assert.match(src, /import \{ SwipeToDelete \} from '@\/app\/_components\/swipe-to-delete'/);
  // The ring stands OUTSIDE the swipe, before it, in your row.
  const row = src.indexOf('<OwnFileRow ring={ringLeft > 0 ? <ChatFileUndoRing');
  assert.ok(row > 0, 'the ring is no longer handed to your row');
  assert.ok(row < src.indexOf('<SwipeToDelete'), 'the ring moved inside (or after) the swipe — it must need no swipe');
  assert.match(src, /io\.remove\(messageId, 'undo'\)/);
  assert.match(src, /onDelete=\{\(close\) => \{[^}]*openSheet\(\);/);
  assert.doesNotMatch(src, /deleteWithUndo/, 'the delete still waits out a toast instead of the ring');
  assert.match(src, /setFailed\(true\)/);
  assert.match(src, /\{CHAT_FILE_REMOVE_FAILED\}/);
  // The route: the mode rides the query; options are read before Delete for everyone is offered.
  assert.match(src, /\?mode=\$\{mode\}`, \{ method: 'DELETE' \}/);
  assert.match(src, /\?removal=options`/);
});

test('the route lets the DATABASE decide, then drops only an object under the caller’s own folder — never for "me"', () => {
  const r = read('app/api/chat/attachment/[messageId]/route.ts');
  const del = r.slice(r.indexOf('export async function DELETE('));
  assert.ok(del.length > 0, 'no DELETE on the file route');
  assert.match(del, /supabase\.rpc\('remove_my_chat_file', \{ p_message_id: messageId, p_mode: mode \}\)/);
  assert.doesNotMatch(del, /createAdminClient|from\('chat_messages'\)\.(delete|update)/, 'the route writes past the database’s own check');
  assert.ok(del.indexOf("rpc('remove_my_chat_file'") < del.indexOf('cleanupDelete('), 'the object is dropped before the row');
  // Only when the database hands back a ref (it hands none for Delete for me).
  assert.match(del, /if \(row\.stored_ref\) \{[^]*?cleanupDelete\(row\.stored_ref, chatOwnFileScope\(row\.thread_id, user\.id\)\)/);
  assert.doesNotMatch(del, /\br2Delete\b/);
  const get = r.slice(r.indexOf('export async function GET('), r.indexOf('export async function DELETE('));
  assert.match(get, /supabase\.rpc\('chat_file_removal_options', \{ p_message_id: messageId \}\)/);
});

test('the OTHER side sees it go live — on THIS thread’s filtered UPDATE, never an unfiltered DELETE feed', () => {
  const withFile = { message_id: 'a', attachment_r2_key: 'r2://x' };
  assert.equal(fileLeftMessage(withFile, { message_id: 'a', attachment_r2_key: null }), true);
  assert.equal(fileLeftMessage({ message_id: 'a' }, { message_id: 'a' }), false, 'a words-only update is not a removal');
  assert.equal(fileLeftMessage(undefined, { message_id: 'a' }), false);

  const s = read('app/_components/chat-message-stream.tsx');
  // No DELETE subscription on chat_messages at all: it would send every client other chats' ids (controller, 13 Nov).
  assert.doesNotMatch(s, /event: 'DELETE'[^}]*table: 'chat_messages'/);
  const update = s.slice(s.indexOf("event: 'UPDATE',"), s.indexOf('// ♥ THE SECOND .on()'));
  assert.match(update, /table: 'chat_messages',\s*filter: `thread_id=eq\.\$\{threadId\}`/, 'the UPDATE listener is no longer per thread');
  assert.match(update, /fileLeftMessage\(messagesRef\.current\.find\(.*\), row\)\) void refetchRemovals\(\)/);
  assert.match(update, /prev\.map\(\(m\) => \(m\.message_id === row\.message_id \? row : m\)\)/, 'the cleared row stopped replacing the bubble');
  // The ring's undo is marked and drawn as nothing (the approved "no line"); a for-everyone line still draws.
  assert.match(s, /if \(!hasWords && m\.file_removed_at && !removedLine\) return null;/);
});

test('Delete for everyone is the house DANGER pill; Delete for me and Cancel are neutral (T19)', () => {
  const src = read('app/_components/chat/chat-file-swipe.tsx');
  const sheet = src.slice(src.indexOf('export function ChatFileRemoveSheet'), src.indexOf('// ── 3 · the wired bubble'));
  assert.match(sheet, /<ActionButton\s+tone="danger"\s+main\s+icon=\{Trash2\}[^]*?data-chat-file-remove="everyone"/);
  assert.match(sheet, /<ActionButton\s+tone="neutral"\s+icon=\{EyeOff\}[^]*?data-chat-file-remove="me"/);
  assert.match(sheet, /<ActionButton tone="neutral" icon=\{X\} label="Cancel"/);
  assert.doesNotMatch(sheet, /terracotta|sn-accent|bg-danger|<button/, 'a hand-drawn button instead of the house pill');
});
