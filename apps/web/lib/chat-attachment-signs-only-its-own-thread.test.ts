/**
 * A FILE IN A CONVERSATION OPENS ONLY FROM OUR OWN STORAGE, ONLY FROM THAT
 * CONVERSATION'S FOLDER — the app half of "the chat cannot be used to leave the
 * app" (the database half is tests/db/the-chat-cannot-leave-the-app.db.test.ts).
 *
 * 🚪 THE DOOR (measured 2026-09-10 on the code this replaces): the attachment
 * route read the stored value through `displayUrlForStoredAsset`, which passes
 * any non-`r2://` value through verbatim, and 302'd to it. A message carrying
 * `https://wa.me/…`, `viber://…` or `m.me/…` rendered as a file card on
 * setnayan.com and opened WhatsApp or Viber — a way out of the app AND an open
 * redirect on our domain.
 *
 * Pure and client-safe: it exercises `parseClientRef` + `chatAttachmentPolicy`
 * (what the route signs through) and reads the route's own source, comments
 * stripped, for the wiring.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { chatAttachmentPolicy, parseClientRef } from './r2-client-ref';
import { stripComments } from './strip-comments';

const WEB = join(import.meta.dirname, '..');
const ROUTE = join(WEB, 'app', 'api', 'chat', 'attachment', '[messageId]', 'route.ts');
const SENDER = join(WEB, 'lib', 'chat-send.ts');

const THREAD = '6f1d8f2e-4b3a-4c8d-9e7f-1a2b3c4d5e6f';
const OTHER_THREAD = '0a9b8c7d-6e5f-4a3b-8c2d-1e0f9a8b7c6d';
const SENDER_UID = '11111111-2222-4333-8444-555555555555';
const BASE = `r2://setnayan-thread-files/chat/${THREAD}`;

const signs = (value: string) => parseClientRef(value, chatAttachmentPolicy(THREAD)) !== null;

test('🔑 1 · a file in this conversation’s private folder is signed', () => {
  assert.ok(signs(`${BASE}/${SENDER_UID}/0b6c6f1e-contract.pdf`), 'the sender’s own file stopped opening');
  // Every party may open every file in the conversation — the per-sender pin is
  // on WRITE (the database), not on read.
  assert.ok(signs(`${BASE}/some-other-party/0b6c6f1e-photo.jpg`), 'the other party’s file stopped opening');
});

test('🔑 2 · every door out of the app is refused', () => {
  const doors = [
    'https://wa.me/639171234567',
    'wa.me/639171234567',
    'viber://chat?number=639171234567',
    'https://m.me/exitband',
    'https://t.me/exitband',
    'https://www.facebook.com/exitband',
    'https://setnayan.com/looks-like-us',
    '//evil.example/x.pdf',
    'javascript:alert(1)',
    'data:text/html,<a href="https://wa.me/1">',
  ];
  const leaked = doors.filter(signs);
  console.log(`# doors out refused: ${doors.length - leaked.length}/${doors.length}`);
  assert.deepEqual(leaked, [], `the route would redirect to: ${leaked.join(' · ')}`);
});

test('🔑 3 · another bucket, another thread, a traversal, a bare folder — refused', () => {
  const foreign = [
    `r2://setnayan-media/chat/${THREAD}/${SENDER_UID}/x.pdf`,
    `r2://setnayan-vendor-verification/chat/${THREAD}/${SENDER_UID}/gov.png`,
    `r2://setnayan-thread-files/chat/${OTHER_THREAD}/${SENDER_UID}/x.pdf`,
    `r2://setnayan-thread-files/payments/${THREAD}/x.png`,
    `${BASE}/../${OTHER_THREAD}/x.pdf`,
    `${BASE}/${SENDER_UID}/../../${OTHER_THREAD}/x.pdf`,
    `${BASE}/`,
    `r2://setnayan-thread-files/chat/${THREAD}x/evil.pdf`,
  ];
  const leaked = foreign.filter(signs);
  console.log(`# foreign refs refused: ${foreign.length - leaked.length}/${foreign.length}`);
  assert.deepEqual(leaked, [], `signed a file that is not this conversation’s: ${leaked.join(' · ')}`);
});

test('🔑 4 · the route signs ONLY through that policy, and never passes a stored value through', () => {
  const route = stripComments(readFileSync(ROUTE, 'utf8'));
  assert.ok(route.length > 500, 'read an empty route — a green lie');
  assert.match(
    route,
    /presignClientRef\(\s*stored\s*,\s*chatAttachmentPolicy\(\s*row\.thread_id\s*\)/,
    'the route no longer signs through chatAttachmentPolicy(row.thread_id)',
  );
  for (const passthrough of ['displayUrlForStoredAsset', 'presignDisplayUrl', 'parseStoredAsset', 'publicAssetTarget']) {
    assert.ok(
      !route.includes(passthrough),
      `the route calls ${passthrough} again — that helper passes a non-r2 value (a wa.me link) straight through`,
    );
  }
  // One redirect, and its target is the value presignClientRef returned.
  assert.equal((route.match(/NextResponse\.redirect\(/g) ?? []).length, 1, 'the route redirects from more than one place');
  assert.match(route, /const url = await presignClientRef\(/, 'the redirect target is not the signed URL');
  assert.match(route, /NextResponse\.redirect\(url,/, 'the route redirects to something other than the signed URL');
  assert.match(route, /\.select\('thread_id,/, 'the route no longer reads the thread it pins the file to');
});

test('🔑 5 · the app files every upload under the SENDER’S OWN folder — the database accepts nothing else', () => {
  const sender = stripComments(readFileSync(SENDER, 'utf8'));
  const prefixes = [...sender.matchAll(/pathPrefix:\s*`([^`]+)`/g)].map((m) => m[1]);
  assert.deepEqual(
    prefixes,
    ['chat/${thread.thread_id}/${user.id}'],
    'the chat upload folder changed — migration 20271221089848 refuses any attachment outside chat/<thread>/<sender>/, so every file send would fail',
  );
  assert.ok(!/attachment_r2_key:\s*[^,\n]*publicUrl/.test(sender), 'a public URL is stored as the attachment again');
});
