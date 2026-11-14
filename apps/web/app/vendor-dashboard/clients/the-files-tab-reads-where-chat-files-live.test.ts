/**
 * CHAT-02 (live walk, 14 Nov 2026) — the supplier's Files tab listed every chat
 * file as "File expired", unlinked. Its read named `attachment_url` (legacy, no
 * writer since 2026-09-09) and NOT `attachment_r2_key`, where every chat file
 * actually lives — so `chatAttachmentHref` saw no reference and `isExpired`
 * saw a name with nothing behind it.
 *
 * This pins the read: the chat-files select must name `attachment_r2_key`, and
 * its row filter must admit a row that carries only that column.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildSharedFiles } from '@/lib/chat-shared-files';
import { stripComments } from '@/lib/strip-comments';

const src = stripComments(readFileSync(join(__dirname, '[eventId]', 'page.tsx'), 'utf8'));

test('the Files tab reads the column chat files are stored in', () => {
  const at = src.indexOf(".from('chat_messages')");
  assert.ok(at > 0, 'the chat-files read exists');
  const block = src.slice(at, at + 900);
  const select = /\.select\(\s*'([^']+)'/.exec(block)?.[1] ?? '';
  assert.ok(select.split(',').includes('attachment_r2_key'), `select names attachment_r2_key: ${select}`);
  const or = /\.or\('([^']+)'\)/.exec(block)?.[1] ?? '';
  assert.ok(or.split(',').includes('attachment_r2_key.not.is.null'), `filter admits an r2-only row: ${or}`);
});

test('a chat file with only its private reference opens and is not "expired"', () => {
  const [row] = buildSharedFiles({
    contracts: [],
    handovers: [],
    coupleLabel: 'Ana & Leo',
    chatFiles: [
      {
        message_id: 'm1',
        sender_role: 'couple',
        created_at: new Date().toISOString(),
        attachment_name: 'photo.jpg',
        attachment_mime: 'image/jpeg',
        attachment_size_bytes: 26329,
        attachment_r2_key: 'r2://setnayan-thread-files/chat/t1/photo.jpg', // gitleaks:allow — a column value, not a key
        attachment_url: null,
      },
    ],
  });
  assert.ok(row, 'the chat file is listed');
  assert.equal(row.href, '/api/chat/attachment/m1');
  assert.notEqual(row.expired, true);
});
