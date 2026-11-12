/**
 * 👈 YOUR OWN FILE IN A CHAT SWIPES AWAY (ruling 6076; owner 12 Nov 2026: "delete it outright").
 * The database half is `tests/db/you-may-remove-your-own-file-from-a-chat.db.test.ts`; this holds the wiring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const WEB = join(__dirname, '..', '..', '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('only YOUR file bubble swipes — never words, never a private line, never theirs', () => {
  const s = read('app/_components/chat-message-stream.tsx');
  assert.equal((s.match(/<MaybeChatFileSwipe\b/g) ?? []).length, 1);
  assert.match(s, /<MaybeChatFileSwipe\s+on=\{mine && privateWith === null && !!\(m\.attachment_r2_key \|\| m\.attachment_url\)\}/);
});

test('the swipe is THE ONE SWIPE with Undo, and the delete waits out the window through the file route', () => {
  const src = read('app/_components/chat/chat-file-swipe.tsx');
  assert.match(src, /import \{ SwipeToDelete \} from '@\/app\/_components\/swipe-to-delete'/);
  assert.match(src, /deleteWithUndo\(\{/);
  assert.match(src, /fetch\(`\/api\/chat\/attachment\/\$\{encodeURIComponent\(messageId\)\}`, \{ method: 'DELETE', keepalive: true \}\)/);
});

test('the route lets the DATABASE decide, then drops only an object under this chat’s own folder', () => {
  const r = read('app/api/chat/attachment/[messageId]/route.ts');
  const del = r.slice(r.indexOf('export async function DELETE('));
  assert.ok(del.length > 0, 'no DELETE on the file route');
  assert.match(del, /supabase\.rpc\('remove_my_chat_file', \{ p_message_id: messageId \}\)/);
  assert.doesNotMatch(del, /createAdminClient|from\('chat_messages'\)\.delete/, 'the route deletes past the database’s own check');
  assert.ok(del.indexOf("rpc('remove_my_chat_file'") < del.indexOf('cleanupDelete('), 'the object is dropped before the row');
  // Through the pinned choke point, held to the caller's OWN folder in this chat.
  assert.match(del, /cleanupDelete\(row\.stored_ref, chatOwnFileScope\(row\.thread_id, user\.id\)\)/);
  assert.doesNotMatch(del, /\br2Delete\b/);
});
