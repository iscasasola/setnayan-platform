/**
 * THE COMPOSER SENDS EVERY FILE THROUGH THE ONE HELPER, AND THE THREAD SAYS WHAT THE FILES RULE SAYS (owner
 * 2026-10-28: *"alway compress files when sending on chat. never keep original size"*; chat-files rule C2 —
 * `lib/chat-file-prepare.ts`, `lib/chat-file-rules.ts`). C1 owns the composer and the thread; C2 owns the rules.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const SEND = read('app/_components/chat-send-form.tsx');

test('a picked file is prepared (compressed) and uploaded by the helper; the form never carries the raw File', () => {
  assert.doesNotMatch(SEND, /compressImageForWeb|compressVideoForWeb/, 'the composer compresses on its own again — one helper');
  const deliver = SEND.slice(SEND.indexOf('const deliver = async'), SEND.indexOf('return (\n    <form'));
  assert.ok(deliver.length > 500, 'deliver was not found');
  const del = deliver.indexOf("formData.delete('attachment')");
  const prep = deliver.indexOf('prepareChatFile(raw)');
  const up = deliver.indexOf('uploadPreparedChatFile({ threadId, userId, prepared: prep.prepared })');
  const ref = deliver.indexOf("formData.set('attachment_ref', up.ref)");
  const send = deliver.indexOf('await sendAction(formData)');
  assert.ok(del > 0 && prep > del && up > prep && ref > up && send > ref, 'the order is not: drop the raw file → prepare → upload → ref → send');
  // The one place the raw file goes back into the form is a FAILED upload, for a Try again — and that branch returns.
  const putBack = deliver.indexOf("formData.set('attachment', raw)");
  if (putBack > 0) {
    const branch = deliver.slice(putBack, deliver.indexOf('}', putBack));
    assert.match(branch, /return;/, 'the raw file can reach the send');
  }
  assert.match(deliver, /settle\(false, prep\.message\)/, 'a refused file is not said in words');
  for (const p of ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx']) {
    assert.match(read(p), /<ChatSendForm[\s\S]{0,400}userId=\{user\.id\}/, `${p}: the composer cannot upload into the sender's folder`);
  }
});

test('the thread says the files rule: the 14-day line, and "File expired" with the name kept — in the flow and in Files', () => {
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.match(stream, /showsExpiryWarning\(new Date\(\), fileExpiry\.eventDate, opts\)/, 'the 14-day line is not decided by the rule');
  assert.match(stream, /expiryWarningLine\(day\)/, 'the line is not the rule\'s own words');
  assert.match(stream, /isExpired\(m\) \?/, 'an expired file is not drawn as expired in the flow');
  assert.match(stream, /CHAT_FILE_EXPIRED_LABEL\} · \{m\.attachment_name\}/, 'an expired file lost its name');
  assert.match(read('lib/chat-shared-files.ts'), /expired: isExpired\(m\)/, 'the Files tab does not know a file expired');
  assert.match(read('app/_components/chat-thread-views.tsx'), /f\.expired \?/, 'the Files tab does not say "File expired"');
  for (const p of ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx']) {
    assert.match(read(p), /fileExpiry=\{\{[\s\S]{0,200}precision:/, `${p}: the stream is not told the event's day and precision`);
  }
});
