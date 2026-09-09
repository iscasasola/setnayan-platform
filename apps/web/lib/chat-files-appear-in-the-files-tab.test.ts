/**
 * A FILE SHARED IN CHAT CAN BE FOUND AGAIN.
 *
 * ── WHAT THIS PINS ──────────────────────────────────────────────────────────
 * The supplier's Files tab now merges three sources — contracts, handover
 * deliverables, and the files shared in the couple's conversation — into one
 * newest-first list. Three things about that are load-bearing and none of them
 * is visible on the screen today, because production has never had a single
 * chat attachment:
 *
 *   1. THE ORDER. One list, newest first, ACROSS the sources. Three stacked
 *      groups would answer a different question than the one the supplier is
 *      asking ("where is the thing from last week").
 *   2. THE LINK. `chatAttachmentHref` is the only function that turns a chat
 *      message into a URL, and no render site may reach past it into a stored
 *      reference. A raw key in an <img> is a broken glyph; a stored public URL
 *      is a file handed to whoever holds the string.
 *   3. REFUSED IS NOT EMPTY. A denied read returns zero rows in this app, so
 *      "nothing was ever shared" and "you may not see this" are the same shape
 *      unless the error is checked. The tab is told which, and says which.
 *
 * ⚠ IT SCANS THE STRIPPED SOURCE. A guard that matches its own explanation
 * guards nothing, and this file talks about `attachment_url` at length.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import {
  buildSharedFiles,
  chatAttachmentHref,
  describeFileType,
  formatFileSize,
  type ChatFileInput,
  type ContractFileInput,
  type HandoverFileInput,
} from '@/lib/chat-shared-files';

const WEB = join(import.meta.dirname, '..');
const CARD = 'app/vendor-dashboard/clients/[eventId]/page.tsx';
const cardSrc = stripComments(readFileSync(join(WEB, CARD), 'utf8'));

function occurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

const contract: ContractFileInput = {
  contract_id: 'c1',
  title: 'Catering agreement',
  file_name: 'agreement.pdf',
  file_url: 'https://example.test/agreement.pdf',
  status: 'signed',
  created_at: '2026-09-01T10:00:00.000Z',
};

const handover: HandoverFileInput = {
  handover_id: 'h1',
  kind: 'file',
  label: 'Tasting proof',
  payload: 'https://example.test/proof.jpg',
  delivered_at: '2026-09-03T10:00:00.000Z',
};

const chatFile: ChatFileInput = {
  message_id: 'm1',
  sender_role: 'couple',
  created_at: '2026-09-05T10:00:00.000Z',
  attachment_name: 'venue-contract.pdf',
  attachment_mime: 'application/pdf',
  attachment_size_bytes: 2_516_582,
  attachment_url: 'https://example.test/venue-contract.pdf',
};

// ───────────────────────────────────────────────────────────────────────────
// 1 · THE FILE THE COUPLE SENT IS IN THE LIST, AND IT IS AT THE TOP
// ───────────────────────────────────────────────────────────────────────────

test('a file the couple sent in chat appears in the Files tab list', () => {
  const rows = buildSharedFiles({
    contracts: [contract],
    handovers: [handover],
    chatFiles: [chatFile],
    coupleLabel: 'Ana & Leo',
  });

  const fromChat = rows.filter((r) => r.kind === 'chat');
  assert.equal(fromChat.length, 1, 'the conversation attachment must be listed');
  assert.equal(fromChat[0]!.name, 'venue-contract.pdf');
  assert.equal(fromChat[0]!.origin, 'Ana & Leo shared');
  assert.equal(fromChat[0]!.typeLabel, 'PDF');
  assert.equal(fromChat[0]!.sizeLabel, '2.4 MB');
});

test('the list is newest-first ACROSS the three sources, not grouped by source', () => {
  const rows = buildSharedFiles({
    contracts: [contract], // 1 Sep
    handovers: [handover], // 3 Sep
    chatFiles: [chatFile], // 5 Sep
    coupleLabel: 'Ana & Leo',
  });

  assert.deepEqual(
    rows.map((r) => r.kind),
    ['chat', 'handover', 'contract'],
    'a grouped list would put the contract first even though it is the oldest',
  );
});

test('an older chat file sorts BELOW a newer contract — the sort is by date, not by door', () => {
  const rows = buildSharedFiles({
    contracts: [{ ...contract, created_at: '2026-09-08T10:00:00.000Z' }],
    handovers: [],
    chatFiles: [chatFile], // 5 Sep
    coupleLabel: 'Ana & Leo',
  });
  assert.deepEqual(rows.map((r) => r.kind), ['contract', 'chat']);
});

// ───────────────────────────────────────────────────────────────────────────
// 2 · WHO SENT IT — four sender roles, four different sentences
// ───────────────────────────────────────────────────────────────────────────

test('every sender role is attributed, and none of them is put in the couple’s mouth', () => {
  const roles: ChatFileInput['sender_role'][] = ['vendor', 'couple', 'coordinator', 'system'];
  const origins = roles.map((sender_role) => {
    const [row] = buildSharedFiles({
      contracts: [],
      handovers: [],
      chatFiles: [{ ...chatFile, sender_role }],
      coupleLabel: 'Ana & Leo',
    });
    return row!.origin;
  });

  assert.equal(origins[0], 'You shared');
  assert.equal(origins[1], 'Ana & Leo shared');
  assert.equal(
    new Set(origins).size,
    4,
    'a coordinator and the platform are not the couple; collapsing them would attribute a message to somebody who did not send it',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 3 · 🔒 THE LINK
// ───────────────────────────────────────────────────────────────────────────

test('a chat file with no stored reference is still listed, with nothing to click', () => {
  const [row] = buildSharedFiles({
    contracts: [],
    handovers: [],
    chatFiles: [{ ...chatFile, attachment_url: null }],
    coupleLabel: 'Ana & Leo',
  });
  assert.equal(row!.name, 'venue-contract.pdf', 'the supplier still learns the file exists');
  assert.equal(row!.href, null, 'and is not offered a link that resolves to nothing');
});

test('chatAttachmentHref is the only thing that turns a message into a URL', () => {
  assert.equal(chatAttachmentHref(chatFile), chatFile.attachment_url);
  assert.equal(chatAttachmentHref({ ...chatFile, attachment_url: null }), null);
  assert.equal(chatAttachmentHref({ ...chatFile, attachment_url: undefined }), null);
});

test('the customer card never builds a chat-file link of its own', () => {
  // The card may name the column only inside PostgREST query STRINGS (the
  // select list and the has-an-attachment filter). Anywhere else it is a render
  // site reaching past `chatAttachmentHref` — the defect the private-fetch
  // route exists to prevent — so the quoted strings are removed and what is
  // left must not mention it at all.
  const outsideQueryStrings = cardSrc.replace(/'(?:[^'\\\n]|\\.)*'/g, "''");
  assert.equal(
    occurrences(outsideQueryStrings, 'attachment_url'),
    0,
    'attachment_url may appear only inside a PostgREST query string, never in code that renders',
  );
  assert.match(
    cardSrc,
    /\.select\(\s*\n?\s*'[^']*attachment_url[^']*'/,
    'and the select must still fetch it, or the list would silently lose every link',
  );
  // Anchored to the render itself, so it keeps holding after PR #5339 renames
  // the column: no href/src on this page may be built out of an attachment
  // field.
  assert.doesNotMatch(
    cardSrc,
    /(?:href|src)=\{[^}]*attachment/,
    'no href or src on the customer card may be built from an attachment column',
  );
});

test('the Files tab is fed by the shared builder, once', () => {
  assert.equal(
    occurrences(cardSrc, 'buildSharedFiles('),
    1,
    'one call site; a second would be a second wording of the same list',
  );
  assert.doesNotMatch(
    cardSrc,
    /<FilesTab[^>]*chatFiles=/,
    'FilesTab receives built rows, never raw chat_messages rows to interpret itself',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 4 · REFUSED IS NOT EMPTY
// ───────────────────────────────────────────────────────────────────────────

test('a refused read of the conversation files is distinguished from an empty one', () => {
  assert.equal(
    occurrences(cardSrc, 'chatFilesMeasured = false'),
    1,
    'exactly one place flips the flag, and it is the error branch',
  );
  assert.match(
    cardSrc,
    /if \(chatFileRowsError\) \{[\s\S]{0,400}?chatFilesMeasured = false;/,
    'the flag must be set BECAUSE the query errored, not for any other reason',
  );
  assert.match(cardSrc, /chatFilesMeasured=\{chatFilesMeasured\}/, 'and it must reach the tab');
  assert.match(
    cardSrc,
    /\{!chatFilesMeasured \?/,
    'and the tab must render something different when it is false',
  );
});

test('the empty state no longer points the supplier at the chat it is now reading', () => {
  assert.match(cardSrc, /No files shared yet\./);
  assert.doesNotMatch(
    cardSrc,
    /share other files\s*\n?\s*in your chat/,
    'the old copy sent suppliers to look for files in the place this list now covers',
  );
});

// ───────────────────────────────────────────────────────────────────────────
// 5 · THE SMALL FORMATTERS, because a wrong size is a wrong fact
// ───────────────────────────────────────────────────────────────────────────

test('sizes and types read like a person wrote them', () => {
  assert.equal(formatFileSize(0), '0 B');
  assert.equal(formatFileSize(900), '900 B');
  assert.equal(formatFileSize(1024), '1.0 KB');
  assert.equal(formatFileSize(1024 * 1024 * 12), '12 MB');
  assert.equal(formatFileSize(null), null);
  assert.equal(formatFileSize(undefined), null);
  assert.equal(formatFileSize(Number.NaN), null);

  assert.equal(describeFileType('image/jpeg', 'x.jpg'), 'Image');
  assert.equal(describeFileType('application/pdf', 'x.pdf'), 'PDF');
  assert.equal(describeFileType(null, 'contract.docx'), 'DOCX');
  assert.equal(describeFileType(null, 'noextension'), null);
  assert.equal(describeFileType(null, null), null);
});

test('a handover that is only a sentence is not counted as a file', () => {
  const rows = buildSharedFiles({
    contracts: [],
    handovers: [
      { ...handover, handover_id: 'h2', kind: 'note', payload: 'Everything looks great' },
      { ...handover, handover_id: 'h3', kind: 'signoff', payload: 'done' },
      { ...handover, handover_id: 'h4', kind: 'gallery_link', payload: 'https://example.test/g' },
    ],
    chatFiles: [],
    coupleLabel: 'Ana & Leo',
  });
  assert.deepEqual(rows.map((r) => r.key), ['handover:h4']);
  assert.equal(rows[0]!.kind, 'gallery_link', 'a link keeps its own kind so the icon is not guessed from a label');
});
