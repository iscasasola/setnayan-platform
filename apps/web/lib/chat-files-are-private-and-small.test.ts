/**
 * A FILE SHARED IN A CONVERSATION IS PRIVATE, AND SMALL.
 *
 * ── WHAT THIS EXISTS TO CATCH ───────────────────────────────────────────────
 * Chat attachments were uploaded under a `chat/` prefix that `bucketForPrefix`
 * had no rule for, so they fell through its `media` default — the PUBLIC bucket
 * — and the row stored a permanent unauthenticated URL that was rendered
 * straight into an <img>/<a>. A contract, a receipt or a bank slip shared in a
 * private conversation was readable forever by anyone the link reached.
 *
 * 🔑 EVERY FAILURE IN THIS AREA IS SILENT. A missing routing rule looks like a
 * working upload. A stored public URL renders perfectly. An erasure sweep that
 * reads the wrong column reports success and leaves the file in the bucket. So
 * the rules are pinned by behaviour where they are pure, and by source where
 * they are not — `lib/storage.ts` and `lib/uploads.ts` both carry
 * `import 'server-only'` and cannot be imported by a node test at all.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';
import { bucketForPrefix } from '@/lib/bucket-routing';
import {
  CHAT_ATTACHMENT_ACCEPT,
  CHAT_ATTACHMENT_MIME,
  CHAT_DOCUMENT_MAX_BYTES,
  chatAttachmentLimit,
  isChatImage,
  isCompressibleImage,
} from '@/lib/chat-attachment-limits';

const WEB = join(import.meta.dirname, '..');
const COMPOSER = 'app/_components/chat-send-form.tsx';
const SENDER = 'lib/chat-send.ts';
const STREAM = 'app/_components/chat-message-stream.tsx';
const ROUTE = 'app/api/chat/attachment/[messageId]/route.ts';
const PURGE = 'lib/erasure/purge.ts';
const STORAGE = 'lib/storage.ts';
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('the scan read real files (an empty read is a green lie)', () => {
  for (const rel of [COMPOSER, SENDER, STREAM, ROUTE, PURGE, STORAGE]) {
    assert.ok(read(rel).length > 300, `${rel} came back empty — the scan is not reading it`);
  }
});

test('🔑 1 · a chat file lands in the PRIVATE bucket', () => {
  assert.equal(bucketForPrefix('chat/abc-123'), 'threadFiles');
  assert.equal(bucketForPrefix('/chat/abc-123'), 'threadFiles');
  // The default is what made this a bug, so pin that it is still the default —
  // this rule must be doing the work, not inheriting it.
  assert.equal(bucketForPrefix('something-else/x'), 'media');
  assert.equal(bucketForPrefix('vendor-logo/x'), 'media');
});

test('🔑 2 · photographs are compressed; evidence is not', () => {
  // Compressed: the ordinary phone photo.
  for (const m of ['image/png', 'image/jpeg', 'image/webp']) {
    assert.equal(isCompressibleImage(m), true, m);
  }
  // ⚠ GIF is the trap: it can be ANIMATED, and drawing it to a canvas keeps one
  // frame — "compressing" a reaction GIF silently turns it into a still.
  assert.equal(isCompressibleImage('image/gif'), false, 'a GIF would become a still');
  assert.equal(isChatImage('image/gif'), true, 'a GIF is still an image');
  // ⚠ A contract must arrive byte-for-byte. Re-encoding one in a browser risks
  // handing somebody a corrupt file at the moment they most need it.
  for (const m of [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
  ]) {
    assert.equal(isCompressibleImage(m), false, m);
    assert.equal(isChatImage(m), false, m);
  }
});

test('🔑 3 · a file is judged against ITS OWN ceiling', () => {
  const doc = chatAttachmentLimit('application/pdf');
  assert.equal(doc.maxBytes, CHAT_DOCUMENT_MAX_BYTES);
  assert.match(doc.tooLargeMessage, /10 MB/);
  const img = chatAttachmentLimit('image/jpeg');
  // A 4 MB phone photo is the most ordinary thing anyone sends and must not be
  // refused — it is about to be compressed in the browser.
  assert.ok(img.maxBytes > 4 * 1024 * 1024, 'an ordinary phone photo would be refused');
  assert.ok(img.maxBytes > doc.maxBytes, 'an image must not be judged by the document cap');
  assert.equal(chatAttachmentLimit(null).maxBytes, CHAT_DOCUMENT_MAX_BYTES, 'unknown fails to the tighter cap');
});

test('🔑 4 · the picker offers exactly what the server accepts', () => {
  // Derived, not hand-typed: the composer used to keep its own copy of this
  // list, which is how a picker comes to offer a type the server refuses.
  for (const m of CHAT_ATTACHMENT_MIME) {
    assert.ok(CHAT_ATTACHMENT_ACCEPT.includes(m), `${m} is accepted but not offered`);
  }
  const composer = read(COMPOSER);
  assert.ok(
    !/image\/png,image\/jpeg/.test(composer),
    'the composer grew its own hand-typed accept list again',
  );
  assert.ok(
    !/25 \* 1024 \* 1024/.test(composer),
    'the composer grew its own hand-typed byte cap again',
  );
});

test('🔑 5 · the composer compresses before the file leaves the browser', () => {
  const composer = read(COMPOSER);
  assert.equal(
    (composer.match(/compressImageForWeb\(/g) ?? []).length,
    1,
    'the composer stopped compressing images before upload',
  );
  assert.equal(
    (composer.match(/isCompressibleImage\(/g) ?? []).length,
    1,
    'compression is no longer gated on what may be compressed',
  );
  assert.ok(
    /formData\.set\('attachment'/.test(composer),
    'the compressed file is not the one that gets sent',
  );
});

test('🔑 6 · the row stores the private REF, never a public URL', () => {
  const sender = read(SENDER);
  assert.ok(
    /attachment_r2_key:/.test(sender),
    'the sender stopped storing the private ref',
  );
  // `up.publicUrl` resolves for a public bucket and would look completely fine
  // here. Storing it is exactly the defect.
  assert.ok(
    !/attachment_url:\s*up\.publicUrl/.test(sender),
    'the sender is storing a public URL on the row again',
  );
  assert.equal(
    (sender.match(/pathPrefix: `chat\//g) ?? []).length,
    1,
    'the chat upload prefix changed — the private routing rule is keyed on it',
  );
});

test('🔑 7 · the file is served through a route that re-proves membership', () => {
  const stream = read(STREAM);
  assert.ok(
    /\/api\/chat\/attachment\/\$\{m\.message_id\}/.test(stream),
    'the stream stopped fetching attachments through the gated route',
  );
  assert.ok(
    !/url=\{m\.attachment_url\}/.test(stream),
    'the stream renders the stored URL directly again',
  );

  const route = read(ROUTE);
  // ⚠ THE READ MUST BE THE CALLER'S OWN SESSION. An admin client here would
  // make the app-side check the entire fence, one forgotten `if` from open.
  assert.ok(!/createAdminClient/.test(route), 'the route reads with the service role');
  assert.equal(
    (route.match(/createClient\(\)/g) ?? []).length,
    1,
    'the route stopped reading as the caller',
  );
  assert.ok(/auth\.getUser\(\)/.test(route), 'the route stopped requiring a signed-in caller');
  // A stranger and a missing message must be answered identically, or the route
  // confirms that somebody else's file exists.
  assert.ok(!/40[13]/.test(route), 'the route answers a stranger differently from a miss');
  assert.ok(/no-store/.test(route), 'a shared cache could hold a redirect to a signed URL');
});

test('🔑 8 · erasure deletes the private files too', () => {
  const purge = read(PURGE);
  // ⚠ ANCHORED TO THE SELECT, NOT THE FILE. A file-level match for
  // `attachment_r2_key` passes on the comment that explains the fix — measured:
  // deleting the column from the query left four other occurrences and this
  // assertion stayed GREEN. A guard that matches its own explanation guards
  // nothing.
  assert.ok(
    /\.select\('attachment_url, attachment_r2_key'\)/.test(purge),
    'erasure reads only the legacy column — every file the person sent would survive them',
  );
  // ⚠ The filter moved OUT of the query (a `.or()` there took forty db tests
  // down with it) and into JS. Assert the JS reads BOTH refs, which is the
  // behaviour that actually matters.
  assert.ok(
    /r\.attachment_r2_key \?\? r\.attachment_url/.test(purge),
    'erasure stopped preferring the private ref — files written since 2026-09-09 would survive an erasure',
  );
  const storage = read(STORAGE);
  // `parseR2Url` understands a public URL only; handed an `r2://` ref it returns
  // null and the delete becomes a silent no-op.
  assert.ok(
    /parseStoredAsset\(args\.publicUrl\)/.test(storage),
    'deletePublicAsset stopped understanding a stored ref — deletes would silently no-op',
  );
});
