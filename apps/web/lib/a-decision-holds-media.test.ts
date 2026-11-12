/**
 * a-decision-holds-media.test.ts — 🔒 a photo, video or file filed under a decision SHOWS, and double-tapping the
 * file itself files it.
 *
 * OWNER 12 Nov 2026: *"can we add media files in a decision?"* The database already let any shared message be filed
 * (migration 20271338412990), but:
 *   - the opened decision drew words only — a caption-less photo read "A message you can't see here";
 *   - the photo in a bubble is a link, so the bubble's double-tap never fired on it — only on the bubble's padding.
 *
 * Held, on the REAL code:
 *   1. A filed caption-less photo renders a preview (the attachment route as its `src`), a video a ▶ tile, a PDF a
 *      file row; an expired file says CHAT_FILE_EXPIRED_LABEL; a masked row still says it can't be seen; bare-link words
 *      are a tappable link. Every file href is the attachment route — never a stored `attachment_url`.
 *   2. The tap rule: on a file, the second quick tap opens the picker (one `LastTap` with the bubble), the first is held
 *      DOUBLE_TAP_MS then opens the file, and a private message's file opens at once (it can never be filed).
 *   3. SOURCE (comments stripped by lib/strip-comments.ts): the stream's AttachmentBlock is gated by `attachmentTap`
 *      and its picker branch reaches `setFilePick`.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from './strip-comments';
import { attachmentTap, DOUBLE_TAP_MS, NO_TAP } from './chat-double-tap';
import { bareUrlOf, filedAttachmentOf, type FiledMessage } from './chat-decisions';
import { CHAT_FILE_EXPIRED_LABEL } from './chat-file-rules';
import { FiledBody } from '../app/_components/chat/decision-panel';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = path.resolve(__dirname, '..');
const ID = '00000000-0000-4000-8000-0000000f0001';

const filed = (body: string | null, attachment: FiledMessage['attachment']): FiledMessage => ({
  messageId: ID,
  body,
  senderUserId: 'u1',
  sentAt: '2026-11-12T01:00:00Z',
  addedByUserId: 'u1',
  addedAt: '2026-11-12T02:00:00Z',
  attachment,
});
const msg = (over: Record<string, unknown>) => ({ body: null, sender_user_id: 'u1', created_at: '2026-11-12T01:00:00Z', ...over });
const draw = (f: FiledMessage) => renderToStaticMarkup(React.createElement(FiledBody, { f, mine: false }));

test('a filed photo with no words renders a preview through the attachment route, not a blank row', () => {
  const a = filedAttachmentOf(ID, msg({ attachment_r2_key: 'r2://x/p.jpg', attachment_name: 'p.jpg', attachment_mime: 'image/jpeg', attachment_size_bytes: 2_000_000 }));
  assert.ok(a, 'a photo message answered no attachment');
  assert.equal(a.href, `/api/chat/attachment/${ID}`);
  const html = draw(filed(null, a));
  assert.match(html, /data-filed-attachment="image"/, 'no photo tile');
  assert.match(html, new RegExp(`<img[^>]*src="/api/chat/attachment/${ID}"`), 'the photo has no preview');
  assert.doesNotMatch(html, /can’t see/, 'a readable photo drew as an unreadable message');
});

test('a video is a play tile, a PDF a file row, an expired file says so, a masked row stays masked', () => {
  const video = filedAttachmentOf(ID, msg({ attachment_r2_key: 'r2://x/v.mp4', attachment_name: 'v.mp4', attachment_mime: 'video/mp4' }));
  assert.match(draw(filed(null, video)), /data-filed-attachment="video"/);
  const pdf = filedAttachmentOf(ID, msg({ attachment_r2_key: 'r2://x/c.pdf', attachment_name: 'Contract.pdf', attachment_mime: 'application/pdf', attachment_size_bytes: 1_240_000 }));
  const pdfHtml = draw(filed('Signed copy', pdf));
  assert.match(pdfHtml, /data-filed-attachment="file"/);
  assert.match(pdfHtml, /Contract\.pdf/);
  assert.match(pdfHtml, /PDF · 1\.2 MB/);
  assert.match(pdfHtml, /Signed copy/, 'the words went missing beside the file');
  // a legacy public URL still opens THROUGH the route, never by handing the stored value back
  const legacy = filedAttachmentOf(ID, msg({ attachment_url: 'https://public.example/x.jpg', attachment_mime: 'image/jpeg' }));
  assert.equal(legacy?.href, `/api/chat/attachment/${ID}`);
  assert.doesNotMatch(draw(filed(null, legacy)), /public\.example/);
  const gone = filedAttachmentOf(ID, msg({ attachment_name: 'Old.pdf' }));
  assert.equal(gone?.expired, true);
  assert.equal(gone?.href, null);
  assert.match(draw(filed(null, gone)), new RegExp(`${CHAT_FILE_EXPIRED_LABEL} · Old\\.pdf`));
  assert.equal(filedAttachmentOf(ID, null), null, 'a masked row grew a file');
  assert.match(draw(filed(null, null)), /A message you can’t see here/);
});

test('words that are only a link are a tappable link row', () => {
  assert.equal(bareUrlOf(' https://example.com/rules '), 'https://example.com/rules');
  assert.equal(bareUrlOf('see https://example.com'), null);
  assert.equal(bareUrlOf('javascript:alert(1)'), null);
  assert.match(draw(filed('https://example.com/rules', null)), /<a[^>]*href="https:\/\/example\.com\/rules"[^>]*data-filed-link/);
});

test('double-tapping a file reaches the picker; a single tap still opens it', () => {
  const first = attachmentTap(NO_TAP, ID, 1000, true);
  assert.deepEqual([first.openPicker, first.openFileAfterMs], [false, DOUBLE_TAP_MS], 'a first tap must wait, then open the file');
  const second = attachmentTap(first.next, ID, 1000 + DOUBLE_TAP_MS - 1, true);
  assert.equal(second.openPicker, true, 'the second quick tap on the file did not open the picker');
  assert.equal(second.openFileAfterMs, null, 'the double-tap also opened the file');
  assert.equal(attachmentTap(first.next, ID, 1000 + DOUBLE_TAP_MS, true).openPicker, false, 'a slow second tap is just a tap');
  const priv = attachmentTap(NO_TAP, ID, 1000, false);
  assert.deepEqual([priv.openPicker, priv.openFileAfterMs], [false, 0], 'a private file must open at once and never file');

  const stream = stripComments(readFileSync(path.join(WEB, 'app/_components/chat-message-stream.tsx'), 'utf8'));
  const at = stream.indexOf('<AttachmentBlock');
  assert.ok(at > 0, 'the stream no longer draws AttachmentBlock');
  const tag = stream.slice(at, stream.indexOf('/>', stream.indexOf('gate=', at)) + 2);
  assert.match(tag, /gate=\{/, 'the in-bubble file is not gated by the double-tap');
  assert.match(tag, /attachmentTap\(lastTap\.current,/, 'the file reads a second tap rule, not the bubble’s');
  assert.match(tag, /if \(tap\.openPicker\) \{\s*setFilePick\(m\.message_id\)/, 'the double-tap on a file never reaches the picker');
  assert.match(tag, /privateWith === null/, 'a private file could be filed');
  assert.doesNotMatch(stream, /function AttachmentBlock\(/, 'a second AttachmentBlock grew back in the stream');
});
