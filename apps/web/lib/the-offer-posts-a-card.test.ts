import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';

/**
 * The WIRING behind the offered-service card.
 *
 * Behaviour lives in `an-offered-service-arrives-as-a-card.test.ts`, which
 * executes the decision. This file guards the four joins that decision cannot
 * see, each of which is a silent failure if it is edited away:
 *
 *   1. offering a service POSTS a message carrying `offered_service_id`;
 *   2. the message stream DISPATCHES on that marker;
 *   3. the marker is SELECTED, or every card is invisible however well it renders;
 *   4. media reaches the page through `displayUrlForStoredAsset`, never as a
 *      stored `r2://…` ref (which renders a broken glyph) and never as a
 *      permanent public URL.
 *
 * ⚠ A source scan proves the call is WRITTEN, never that it runs. It is here
 * because the alternative for these four is nothing at all.
 */

const WEB = join(__dirname, '..');
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');
/**
 * Same file with its prose removed. Used for every NEGATIVE assertion below.
 * A guard that reads comments cannot tell code from an explanation of code —
 * the first run of the media check failed on this very file's own docblock
 * describing what a stored `r2://` ref does to an <img>.
 */
const code = (p: string) => stripComments(read(p));

const CORE = 'lib/offer-service-core.ts';
const STREAM = 'app/_components/chat-message-stream.tsx';
const CARD = 'app/_components/chat-offered-service-card.tsx';
const RESOLVER = 'lib/offered-service-card.ts';
const CHAT = 'lib/chat.ts';

test('offering a service posts a chat message that carries the marker', () => {
  const src = read(CORE);
  const insert = src.indexOf(".from('chat_messages').insert(");
  assert.notEqual(
    insert,
    -1,
    `${CORE} must INSERT a chat message — without it the offer is a chip row again`,
  );
  // Window the assertion on the insert's own call, not the file: a mention of
  // offered_service_id anywhere in a docblock must not satisfy this.
  const call = src.slice(insert, src.indexOf('});', insert));
  assert.match(
    call,
    /offered_service_id:\s*vendorServiceId/,
    'the inserted message must name the offered service',
  );
  assert.match(call, /thread_id:/, 'and it must land in the thread');
});

test('the insert runs under the caller session, never the admin client', () => {
  // `tg_chat_messages_derive_sender` returns early for service_role, so an
  // admin insert lands a message attributed to nobody — no sender_role, no
  // sender_user_id — and the stream cannot side or label it.
  const src = read(CORE);
  const insert = src.indexOf(".from('chat_messages').insert(");
  const before = src.slice(0, insert);
  const receiver = before.slice(before.lastIndexOf('\n', insert - 1));
  assert.match(
    receiver,
    /supabase\s*$|supabase\.$|await supabase/,
    'the offer message must be inserted through the RLS-scoped caller client',
  );
  assert.doesNotMatch(receiver, /admin/, 'not through the admin client');
});

test('a failed card insert fails the offer instead of reporting success', () => {
  // The disease this whole change exists to remove: the vendor reads "sent",
  // the couple sees nothing, and nothing anywhere says the card never arrived.
  const src = read(CORE);
  const insert = src.indexOf(".from('chat_messages').insert(");
  const after = src.slice(insert, insert + 1200);
  assert.match(
    after,
    /if\s*\(\s*cardError\s*\)/,
    'the insert error must be inspected',
  );
  assert.match(
    after,
    /return\s*\{[\s\S]{0,120}status:\s*'error'/,
    'and an insert failure must be returned as an error, not swallowed',
  );
});

test('the message stream renders the card on the marker', () => {
  const src = read(STREAM);
  assert.match(src, /import \{ ChatOfferedServiceCard \}/);
  const branch = src.indexOf('if (m.offered_service_id)');
  assert.notEqual(branch, -1, 'the stream must branch on the marker');
  const body = src.slice(branch, branch + 600);
  assert.match(body, /<ChatOfferedServiceCard/, 'and mount the card there');
  assert.match(body, /fallbackBody=/, 'passing the body so a slow card still reads as an offer');
  // The branch must sit ABOVE the plain-bubble path, or an offer renders twice
  // or not at all.
  assert.ok(
    branch < src.indexOf("m.sender_role === 'system'"),
    'the offer branch must precede the generic message paths',
  );
});

test('the marker is selected, or no card can ever render', () => {
  const src = read(CHAT);
  assert.match(
    src,
    /\.select\(\s*\n?\s*`\$\{MESSAGE_SELECT\}[^`]*offered_service_id/,
    'fetchMessages must read offered_service_id',
  );
  assert.match(src, /offered_service_id\?:\s*string \| null;/, 'and the row type must carry it');
});

test('every media ref is signed — no raw r2:// and no public URL reaches the page', () => {
  const resolver = read(RESOLVER);
  const signed = resolver.match(/displayUrlForStoredAsset\(/g) ?? [];
  assert.equal(
    signed.length,
    2,
    `both refs must be signed — cover and clip — found ${signed.length}`,
  );
  assert.match(resolver, /displayUrlForStoredAsset\(svc\.primary_photo_r2_key\)/);
  assert.match(resolver, /displayUrlForStoredAsset\(svc\.showcase_video_r2_key\)/);

  // The card component must never receive a stored ref to render directly.
  const card = code(CARD);
  assert.doesNotMatch(
    card,
    /r2:\/\//,
    'the renderer must never handle a stored ref — that is a broken image glyph',
  );
  assert.doesNotMatch(
    card,
    /_r2_key/,
    'the renderer takes resolved URLs only, never the stored columns',
  );
});

test('the presigned card is never cached by a shared cache', () => {
  const route = read('app/api/chat/offered-service/[messageId]/route.ts');
  assert.match(route, /'Cache-Control':\s*'private, no-store'/);
  assert.match(route, /status:\s*404/, 'an absent card is a 404');
  assert.match(route, /status:\s*502/, 'a refused read is NOT a 404 — the stream draws them differently');
});

test('the couple never receives a drawing of a button', () => {
  // ServiceCardFace's preview footer is a mock "Request a quote" chip. In a
  // live conversation that is a control a couple presses and that does nothing.
  const card = read(CARD);
  assert.match(card, /footer=\{null\}/, 'the thread must pass its own (empty) footer');
  const face = read('app/vendor-dashboard/services/_components/service-card-face.tsx');
  assert.match(
    face,
    /footer === undefined/,
    'and the face must distinguish an omitted footer from an explicit empty one',
  );
});
