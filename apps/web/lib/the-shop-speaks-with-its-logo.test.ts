/**
 * 🏪 A MESSAGE SENT AS THE SHOP WEARS THE SHOP'S LOGO (owner, live, 12 Nov 2026).
 *
 * The couple's chat drew the shop's face as initials only — `chat-message-stream.tsx` filled the avatar from
 * `hostInitials` / `initialsOf(counterpartyLabel)` and nothing else. Now the couple's thread page presigns the logo it
 * ALREADY reads (`couple_thread_supplier_names` → `logoUrl`, sent only once the name is REVEALED — a logo is as
 * identifying as the name) and the stream draws it, round and 28px like the initials, on the shop side's messages; a
 * missing or broken picture falls back to the initials.
 *
 * SABOTAGE (done once, 12 Nov): the `m.sender_role === 'vendor'` gate removed → RED; the page's
 * `shopLogoUrl={shopLogoUrl}` dropped → RED; the logo read from anything but `vendorRead` → RED.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const STREAM = read('app/_components/chat-message-stream.tsx');
const PAGE = read('app/dashboard/[eventId]/messages/[threadId]/page.tsx');

test('the stream draws the shop logo on the shop side, round and the initials’ size, falling back to initials', () => {
  assert.match(STREAM, /shopLogoUrl && !shopLogoBroken && m\.sender_role === 'vendor' \?/);
  const at = STREAM.indexOf('data-chat-shop-face');
  assert.ok(at > 0, 'the shop face is gone');
  const face = STREAM.slice(STREAM.lastIndexOf('<span', at), STREAM.indexOf('</span>', at));
  assert.match(face, /h-7 w-7/);
  assert.match(face, /rounded-full/);
  assert.match(face, /src=\{shopLogoUrl\}/);
  assert.match(face, /onError=\{\(\) => setShopLogoBroken\(true\)\}/);
  assert.equal(/next\/image/.test(STREAM), false, 'the stream stays free of next/image (bundle budget)');
});

test('the couple page hands over ONLY the revealed logo, presigned', () => {
  assert.match(PAGE, /vendorRead\.then\(\(v\) => \(v\.logoUrl \? displayLogoUrl\(\{ logo_url: v\.logoUrl \}\)/);
  assert.match(PAGE, /shopLogoUrl=\{shopLogoUrl\}/);
});
