/**
 * 🔒 A PRIVATE MESSAGE LOOKS PRIVATE, AND IS WORDS ONLY (DECISION_LOG 2026-11-09 🔒; owner: *"need to make it evident a
 * private message"*, then *"private messages are just words. everything else is public."*).
 *
 *   1. The strip — "🔒 Private · only you and Jose" — draws for a private message and NEVER for a normal one (the one
 *      part, `PrivateMark`, renders nothing for `null`), and the time row repeats the lock.
 *   2. The stream's bubble wears the private fill + strip exactly when the message is private — stored and pending alike.
 *   3. The composer in PRIVATE MODE — inside the message box, no extra row (owner, 9 Nov): the box reads "Private
 *      message to Jose" with the info outline, a 🔒 at its left and an × inside at its right (back to "Message"); the
 *      hidden recipient; NO chip row; and NO ＋ and NO attach (paperclip · camera · photo). Off: everything back.
 *   4. The server is the net: a private message with a file is refused; it never wakes the auto-reply; only the one
 *      person is notified.
 *   6. THREE DOORS to the one private mode (owner, 9 Nov: "they can also send private message anytime"): a face · the
 *      composer's 🔒 beside the ＋ (a list of exactly the strip's people, you excluded) · "Reply privately" on a held
 *      message, which pre-picks its SENDER — any other person, by user not by side (another host's message too).
 *   5. ANY pair (owner, 9 Nov): host → host included — every face but your own is a button, and the server takes a host
 *      as the recipient. The supplier cannot read a host ↔ host message: the thread is read ONLY through the caller's
 *      RLS-scoped client (Lane B's SELECT rule hides it), never the admin client.
 *
 * Sabotage (9 Nov 2026): `PrivateMark` drawing its strip for `null` → 1 RED; the composer drawing `lead` while private →
 * 3 RED; the words-only refusal removed from `sendChatMessageCore` → 4 RED; "Reply privately" gated on the side
 * (`!mine`) again → 6 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { PrivateMark, PrivateTime, PRIVATE_BUBBLE_FILL, PRIVATE_STRIP_TEXT } from '@/app/_components/chat/private-message';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { setChatPeople, setPrivateTo } from '@/app/_components/chat/private-to';
import { PrivatePeopleList } from '@/app/_components/chat/private-people';
import { MessageHoldMenu } from '@/app/_components/chat/message-hold-menu';
import { CHAT_PRIVATE_FIELD, privateOtherId, privateToFromForm } from './chat-private';
import { ChatHostStrip } from '@/app/_components/chat/chat-host-strip';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const h = React.createElement;

test('1 · the strip draws for a private message and never for a normal one; the time row repeats the lock', () => {
  const priv = renderToStaticMarkup(h(PrivateMark, { privateWith: 'Jose' }));
  assert.match(priv, /data-chat-private-strip=""/);
  assert.match(priv, /Private · only you and Jose/);
  assert.match(priv, /<svg/, 'the strip lost its lock');
  assert.equal(renderToStaticMarkup(h(PrivateMark, { privateWith: null })), '', 'a normal message wears the private strip');
  const time = renderToStaticMarkup(h(PrivateTime, { at: '2026-11-09T02:05:00Z', alignEnd: true }));
  assert.match(time, /data-chat-private-time=""/);
  assert.match(time, /<svg/, 'the time row lost its lock');
  assert.match(time, /10:05 AM/);
  // 🔵 Private is BLUE (owner, 9 Nov): the fill, its ring and the strip's words are the --color-info token.
  assert.match(PRIVATE_BUBBLE_FILL, /bg-\[rgb\(var\(--color-info\)\/0\.14\)\]/, 'the private fill is not the info token');
  assert.match(PRIVATE_STRIP_TEXT, /--color-info/);
  assert.ok(priv.includes(PRIVATE_STRIP_TEXT), 'the strip is not written in the info token');
});

test('2 · the stream draws the private look exactly when the message is private — stored and pending', () => {
  const s = read('app/_components/chat-message-stream.tsx');
  assert.match(s, /const privateWithId = privateOtherId\(m, currentUserId\);/);
  assert.match(s, /privateWith !== null\s*\?\s*PRIVATE_BUBBLE_FILL/);
  assert.match(s, /<PrivateMark privateWith=\{privateWith\} \/>/);
  assert.match(s, /\{privateWith !== null \? <PrivateTime at=\{m\.created_at\} alignEnd=\{mine\} \/> : null\}/);
  assert.match(s, /<PrivateMark privateWith=\{p\.privateTo \?\? null\} \/>/, 'a pending private message is drawn as a normal one');
  // No NORMAL bubble wears the private blue: the only place the stream names it is through PRIVATE_BUBBLE_FILL.
  assert.doesNotMatch(s, /--color-info|\b(?:bg|ring)-link\b|\bbg-info-/, 'a normal bubble uses the private blue');
  // The other person, as each side sees it.
  assert.equal(privateOtherId({ sender_user_id: 'a', recipient_user_id: 'b' }, 'a'), 'b');
  assert.equal(privateOtherId({ sender_user_id: 'a', recipient_user_id: 'b' }, 'b'), 'a');
  assert.equal(privateOtherId({ sender_user_id: 'a', recipient_user_id: null }, 'a'), null);
});

test('3 · private mode lives inside the message box, and the composer is WORDS ONLY: no ＋, no attach', () => {
  const lead = h('button', { type: 'button', 'data-lab-plus': '' }, '+');
  const send = async () => {};
  const T = 'thread-words-only';
  setPrivateTo(T, null);
  const open = renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead }));
  assert.match(open, /data-lab-plus=""/, 'the ＋ is gone from a normal composer');
  assert.match(open, /data-chat-camera=""/);
  assert.match(open, /data-chat-photo=""/);
  assert.match(open, /name="attachment"/);
  assert.doesNotMatch(open, /data-chat-private-box/);
  assert.match(open, /placeholder="Message"/);

  setPrivateTo(T, { userId: '00000000-0000-4000-8000-0000000000ee', name: 'Jose' });
  const priv = renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead }));
  setPrivateTo(T, null);
  assert.match(priv, /data-chat-private-box=""/, 'private mode is not in the message box');
  assert.match(priv, /placeholder="Private message to Jose"/, 'the box lost the owner\'s words');
  assert.doesNotMatch(priv, /data-chat-private-chip|Messaging Jose privately/, 'the retired chip row came back');
  // The box: the info outline, a 🔒 at its left, the × inside it (all within data-chat-message-box).
  const box = priv.slice(priv.lastIndexOf('<div', priv.indexOf('data-chat-message-box')), priv.indexOf('</div>', priv.indexOf('data-testid="chat-private-clear"')));
  assert.match(box, /ring-\[rgb\(var\(--color-info\)\)\]/, 'the private box has no info outline');
  assert.ok(box.indexOf('<svg') < box.indexOf('<textarea'), 'the 🔒 is not at the box\'s left');
  assert.ok(box.indexOf('<textarea') < box.indexOf('data-testid="chat-private-clear"'), 'the × is not inside the box, after the words');
  assert.match(box, /aria-label="Stop the private message to Jose/);
  assert.match(priv, new RegExp(`name="${CHAT_PRIVATE_FIELD}" value="00000000-0000-4000-8000-0000000000ee"`));
  assert.match(priv, /data-chat-words-only=""/);
  assert.doesNotMatch(priv, /data-lab-plus/, 'the ＋ (cards) is open while private');
  assert.doesNotMatch(priv, /data-chat-camera|data-chat-photo/, 'a photo can be sent privately');
  assert.doesNotMatch(priv, /name="attachment"/, 'a file can be sent privately');
});

test('4 · the server is the net: words only, no auto-reply, only the one person told', () => {
  const core = read('lib/chat-send.ts');
  assert.match(core, /if \(privateTo\) \{\s*if \(hasAttachment \|\| storedRef\) \{\s*return \{ ok: false, code: 'private_words_only'/);
  assert.match(core, /if \(!asHost\.data && !asShop\.data\) \{/, 'a private message to a stranger is not refused');
  assert.match(core, /\[CHAT_PRIVATE_RECIPIENT_COLUMN\]: privateTo/);
  assert.match(core, /senderRole === 'couple' && !privateTo && vendorAutoReplyEnabled\(\)/, 'a private message wakes the auto-reply');
  const notify = read('lib/chat-actions.ts');
  const fn = notify.slice(notify.indexOf('export async function notifyOtherParty('));
  const priv = fn.slice(fn.indexOf('if (args.privateTo) {'));
  assert.ok(fn.indexOf('if (args.privateTo) {') > 0 && fn.indexOf('if (args.privateTo) {') < fn.indexOf("if (args.senderRole === 'couple')"), 'the private branch is not first');
  assert.match(priv.slice(0, priv.indexOf('return;')), /userId: args\.privateTo,/);
  // Yourself and a malformed id are everyone.
  assert.equal(privateToFromForm('00000000-0000-4000-8000-0000000000ee', '00000000-0000-4000-8000-0000000000ee'), null);
  assert.equal(privateToFromForm('not-a-user', null), null);
  assert.equal(privateToFromForm(null, null), null);
});

test('5 · any pair, host → host included; the thread is read only through the caller\'s RLS client', () => {
  // A host's strip: the other host and the supplier are both buttons; your own face is not (no Leave given here).
  const strip = renderToStaticMarkup(
    h(ChatHostStrip, {
      hosts: [
        { userId: 'u-shop', firstName: 'Lumière', name: 'Lumière', role: 'supplier', label: null },
        { userId: 'u-maria', firstName: 'Maria', name: 'Maria', role: 'bride', label: null },
        { userId: 'u-jose', firstName: 'Jose', name: 'Jose', role: 'groom', label: null },
      ],
      presentIds: new Set<string>(),
      youId: 'u-maria',
      threadId: 't1',
      viewerSide: 'couple',
    }),
  );
  assert.match(strip, /data-chat-host-face="u-jose"/, 'a host cannot message another host privately');
  assert.match(strip, /data-chat-host-face="u-shop"/, 'a host cannot message the supplier privately');
  assert.doesNotMatch(strip, /data-chat-host-face="u-maria"|data-chat-host-face="you"/);
  // A supplier's strip: every host is a button.
  const sup = renderToStaticMarkup(
    h(ChatHostStrip, {
      hosts: [{ userId: 'u-maria', firstName: 'Maria', name: 'Maria', role: 'bride', label: null }],
      presentIds: new Set<string>(),
      youId: 'u-shop',
      threadId: 't1',
    }),
  );
  assert.match(sup, /data-chat-host-face="u-maria"/);
  // The server takes a HOST as the recipient (and the shop) — host → host is a valid pair.
  const core = read('lib/chat-send.ts');
  assert.match(core, /\.eq\('user_id', privateTo\)\s*\.eq\('member_type', 'couple'\)/);
  // Who READS it: both thread pages and the live stream read through the caller's own session, never the admin client —
  // so a third member (the supplier, for a host ↔ host message) gets what RLS gives them, and RLS gives them nothing.
  assert.match(read('app/dashboard/[eventId]/messages/[threadId]/page.tsx'), /const messagesRead = fetchMessages\(supabase, threadId\);/);
  assert.match(read('app/vendor-dashboard/messages/[threadId]/page.tsx'), /fetchMessages\(supabase, threadId\)/);
  for (const rel of ['app/dashboard/[eventId]/messages/[threadId]/page.tsx', 'app/vendor-dashboard/messages/[threadId]/page.tsx', 'app/_components/chat-message-stream.tsx']) {
    assert.doesNotMatch(read(rel), /fetchMessages\((?:admin|createAdminClient\(\)|decisionAdmin|paxAdmin)/, `${rel} reads the thread with the admin client`);
  }
});

test('6 · three doors to the one chip: a face, the composer\'s 🔒, and Reply privately on a held message', () => {
  const send = async () => {};
  const lead = h('button', { type: 'button', 'data-lab-plus': '' }, '+');
  const T = 'thread-doors';
  // Nobody else in the chat → no 🔒 (nothing to pick).
  setChatPeople(T, []);
  setPrivateTo(T, null);
  assert.doesNotMatch(renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead })), /chat-private-open/);
  // Someone else in the chat → the 🔒 stands beside the ＋, an info ActionButton.
  setChatPeople(T, [{ userId: '00000000-0000-4000-8000-0000000000ee', name: 'Jose' }]);
  const open = renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead }));
  assert.match(open, /data-testid="chat-private-open"/, 'the composer has no 🔒 door');
  assert.ok(open.indexOf('data-lab-plus') < open.indexOf('chat-private-open'), 'the 🔒 is not beside the ＋');
  assert.match(open, /class="ab ab-info[^"]*"[^>]*data-testid="chat-private-open"|data-testid="chat-private-open"[^>]*class="ab ab-info/, 'the 🔒 is not tone info');
  // While the chip is on, the 🔒 steps aside with the rest (words only).
  setPrivateTo(T, { userId: '00000000-0000-4000-8000-0000000000ee', name: 'Jose' });
  const priv = renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead }));
  setPrivateTo(T, null);
  setChatPeople(T, []);
  assert.doesNotMatch(priv, /chat-private-open/);
  // The 🔒's list: one info button per person, equal width.
  const list = renderToStaticMarkup(
    h(PrivatePeopleList, { people: [{ userId: 'u-shop', name: 'Lumière' }, { userId: 'u-jose', name: 'Jose' }], onPick: () => {} }),
  );
  assert.equal((list.match(/class="ab ab-info[^"]*w-full/g) ?? []).length, 2, 'a person is not one full-width info button');
  assert.match(list, /aria-label="Message Jose privately"/);
  // The strip publishes exactly its faces (you excluded) for that list.
  assert.match(read('app/_components/chat/chat-host-strip.tsx'), /if \(threadId\) setChatPeople\(threadId, others\);/);
  // Reply privately: an info button; offered on any OTHER person's message (by user, not side), pre-picking the sender.
  const menu = renderToStaticMarkup(h(MessageHoldMenu, { senderName: 'Jose', alignEnd: true, onReplyPrivately: () => {} }));
  assert.match(menu, /class="ab ab-info/);
  assert.match(menu, />Reply privately</);
  assert.match(menu, /aria-label="Reply to Jose privately"/);
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.match(stream, /const replyTo = !m\.is_bot && m\.sender_user_id && m\.sender_user_id !== currentUserId \? m\.sender_user_id : null;/, 'Reply privately is gated on the wrong thing');
  assert.match(stream, /setPrivateTo\(threadId, \{ userId: replyTo, name: personName\(replyTo\) \}\)/);
  assert.match(stream, /if \(hold\.consumeTap\(\)\) return;/, 'the hold also toggles the heart');
});
