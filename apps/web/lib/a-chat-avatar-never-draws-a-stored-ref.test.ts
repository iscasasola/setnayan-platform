/**
 * a-chat-avatar-never-draws-a-stored-ref.test.ts — 🖼 A CHAT AVATAR NEVER HANDS AN `r2://` REF TO AN IMAGE.
 *
 * W1, live 08b8522 (RW-327): the couple's Chats list drew a broken shop logo — Liwanag's `logo_url`, a stored
 * `r2://…` ref, went straight to `/_next/image`. The open thread already signed it (`displayLogoUrl`); the list did not.
 *
 *   1 · the couple's Chats list signs every logo through the repo's one logo signer, `displayLogoUrl` (lib/uploads.ts,
 *       → `displayUrlForStoredAsset`) — never a second path;
 *   2 · the one chat avatar (`ThreadListAvatar`, which `LeftChatRow` and the inbox both draw) refuses a stored ref and
 *       draws initials, RENDERED: a raw ref can never reach an image whoever passes it.
 *
 * 🛡 SABOTAGE (seen RED, then restored, 2026-11-15): `displayLogoUrl({ logo_url: stored })` → `stored` in the page
 * (red: 1) · the `isStoredRef` check dropped from the avatar (red: 2).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const code = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

test('1 · the couple’s Chats list signs each logo with displayLogoUrl before the avatar sees it', () => {
  const page = code('app/dashboard/[eventId]/messages/page.tsx');
  assert.match(page, /import \{ displayLogoUrl \} from '@\/lib\/uploads';/);
  assert.match(page, /logoByVendor\.set\(vendorId, await displayLogoUrl\(\{ logo_url: stored \}\)/, 'the list hands the stored ref on unsigned');
  // The stored ref goes only into the signer's input map, never into the map the rows read.
  assert.doesNotMatch(page, /logoByVendor\.set\([^)]*label\.logoUrl\)/, 'the stored ref reaches the rows again');
  // Every chat avatar is the one component (no second <Image> of a logo in the chat lists).
  for (const rel of ['app/_components/chat/left-chat-row.tsx', 'app/dashboard/[eventId]/messages/_components/chat-inbox.tsx']) {
    assert.match(code(rel), /<ThreadListAvatar logoUrl=\{(?:r\.)?logoUrl\}/, `${rel} draws its own avatar`);
    assert.doesNotMatch(code(rel), /from 'next\/image'/, `${rel} draws an image of its own`);
  }
});

test('2 · RENDERED: a stored r2:// ref draws initials, a signed address draws the picture', async () => {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ThreadListAvatar } = await import('@/app/_components/chat/thread-list-card');
  const h = React.createElement;
  for (const ref of ['r2://setnayan-media/vendors/v1/logo.png', ' R2://setnayan-media/x.jpg']) {
    const html = renderToStaticMarkup(h(ThreadListAvatar, { logoUrl: ref, name: 'Liwanag Lights', size: 'lg' }));
    assert.doesNotMatch(html, /<img/, `a stored ref reached an image: ${ref}`);
    assert.match(html, />LL</, 'the refused logo did not fall back to initials');
  }
  const signed = renderToStaticMarkup(
    h(ThreadListAvatar, { logoUrl: '/brand/logo.png', name: 'Liwanag Lights', size: 'lg' }),
  );
  assert.match(signed, /<img/, 'a signed logo no longer draws');
});
