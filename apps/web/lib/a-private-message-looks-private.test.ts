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
 *   6. ONE DOOR to the private mode (owner-approved prototype, 11 Nov 2026 — until then a face and "Reply privately"
 *      on a held message were doors too): the composer's 🔒 beside the ＋, a list of exactly the strip's people, you
 *      excluded. A face is a picture; holding a bubble opens nothing.
 *   5. ANY pair (owner, 9 Nov): host → host included — every face but your own is a button, and the server takes a host
 *      as the recipient. The supplier cannot read a host ↔ host message: the thread is read ONLY through the caller's
 *      RLS-scoped client (Lane B's SELECT rule hides it), never the admin client.
 *
 *   7. THE ＋ IS NOT RENDERED WHILE A PRIVATE RECIPIENT IS SET (owner, 9 Nov, corpus 701b38a3), and the whole row is
 *      ONE sky blue: Send, the quiet 🔒 and the × wear the private colour, every focus ring in the row is sky blue, a
 *      pasted picture is refused; × back to everyone restores the ＋ and Send's brand colour.
 *
 * Sabotage (9 Nov 2026): `PrivateMark` drawing its strip for `null` → 1 RED; the composer drawing `lead` while private →
 * 3 + 7 RED; the words-only refusal removed from `sendChatMessageCore` → 4 RED. (11 Nov 2026) a face's
 * `setPrivateTo` put back in the strip → 6 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { stripComments } from './strip-comments';
import { PrivateMark, PrivateTime, PRIVATE_BUBBLE_FILL, PRIVATE_STRIP_TEXT } from '@/app/_components/chat/private-message';
import { ChatSendForm } from '@/app/_components/chat-send-form';
import { setChatPeople, setPrivateTo } from '@/app/_components/chat/private-to';
import { PrivatePeopleList } from '@/app/_components/chat/private-people';
import { CHAT_PRIVATE_FIELD, PRIVATE_BOX_OUTLINE, PRIVATE_FOCUS_RING, PRIVATE_BOX_FILL,
  PRIVATE_MARK, privateOtherId, privateToFromForm } from './chat-private';
import { stripOrder } from '@/lib/chat-members';

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
  // 🔒 Private is SKY BLUE (owner, 9 Nov: "why red? use sky blue"): its own token family, never --color-info's slate.
  assert.match(PRIVATE_BUBBLE_FILL, /bg-\[rgb\(var\(--color-private-tint\)\)\]/, 'the private fill is not the private tint');
  assert.match(PRIVATE_BUBBLE_FILL, /ring-\[rgb\(var\(--color-private\)\/0\.45\)\]/);
  assert.match(PRIVATE_STRIP_TEXT, /--color-private-text/);
  assert.ok(priv.includes(PRIVATE_STRIP_TEXT), 'the strip is not written in the private token');
  assert.ok(time.includes(PRIVATE_MARK), 'the time row\'s lock is not sky blue');
  for (const k of [PRIVATE_BUBBLE_FILL, PRIVATE_STRIP_TEXT, PRIVATE_MARK, PRIVATE_BOX_OUTLINE, PRIVATE_FOCUS_RING]) {
    assert.doesNotMatch(k, /--color-info|--color-link|mulberry|sn-accent|terracotta/, `${k} is not the private blue`);
  }
  // The token family is defined in BOTH themes, with the owner's light values.
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  assert.match(css, /--color-private: 2 132 199;/, 'light --color-private is not #0284C7');
  assert.match(css, /--color-private-text: 3 105 161;/, 'light --color-private-text is not #0369A1');
  assert.match(css, /--color-private-tint: 224 242 254;/, 'light --color-private-tint is not #E0F2FE');
  assert.match(css, /--color-private: 56 189 248;/, 'dark --color-private is not #38BDF8');
  assert.equal((css.match(/--color-private-tint:/g) ?? []).length, 2, 'the tint is not defined for both themes');
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
  assert.ok(box.includes(PRIVATE_BOX_OUTLINE), 'the private box has no sky-blue outline');
  assert.ok(box.includes(PRIVATE_FOCUS_RING), 'the private box focuses in another colour');
  assert.doesNotMatch(box, /focus:ring-sn-accent/, 'the brand focus ring shows inside the private box');
  assert.ok(box.slice(0, box.indexOf('<textarea')).includes(PRIVATE_MARK), 'the box\'s 🔒 is not sky blue');
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
  // The 🔒's list is the strip's people, you excluded (`others` in chat-host-strip.tsx, published by `setChatPeople`):
  // for a host that is the other host AND the supplier; for the supplier, every host. (Since 11 Nov 2026 the faces
  // themselves are pictures — the 🔒 is the one door, test 6.)
  const hosts = [
    { userId: 'u-shop', firstName: 'Lumière', name: 'Lumière', role: 'supplier', label: null },
    { userId: 'u-maria', firstName: 'Maria', name: 'Maria', role: 'bride', label: null },
    { userId: 'u-jose', firstName: 'Jose', name: 'Jose', role: 'groom', label: null },
  ] as const;
  const others = (youId: string, side: 'vendor' | 'couple') =>
    stripOrder([...hosts] as never, youId, side).flatMap((p) => (!p.isYou && p.host ? [p.userId] : [])).sort();
  assert.deepEqual(others('u-maria', 'couple'), ['u-jose', 'u-shop'], 'a host cannot pick another host or the supplier in the 🔒 list');
  assert.deepEqual(others('u-shop', 'vendor'), ['u-jose', 'u-maria'], 'the supplier cannot pick every host in the 🔒 list');
  assert.match(
    read('app/_components/chat/chat-host-strip.tsx'),
    /stripOrder\(hosts, youId, viewerSide\)\.flatMap\(\(p\) => \(!p\.isYou && p\.host \? \[\{ userId: p\.userId, name: hostFirstName\(p\.host\) \}\] : \[\]\)\);\s*useEffect\(\(\) => \{\s*if \(threadId\) setChatPeople\(threadId, others\);/,
    'the strip no longer publishes exactly its other people to the 🔒 list',
  );
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

test('6 · ONE door to the one chip: the composer\'s 🔒 — not a face, not a held message', () => {
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
  // The 🔒 is the ONLY door (owner-approved prototype, 11 Nov 2026): nothing else in the chat sets the private chip —
  // not a face in the strip, not a held bubble ("Reply privately" removed with its menu).
  // Every app file that CALLS setPrivateTo — the composer (its 🔒 list picks, its × clears) and nothing else.
  const callers = (readdirSync(join(WEB, 'app'), { recursive: true }) as string[])
    .filter((f) => /\.tsx?$/.test(f) && !/\.test\.tsx?$/.test(f))
    .map((f) => `app/${f.split(sep).join('/')}`)
    .filter((f) => /\bsetPrivateTo\(/.test(read(f).replace(/export function setPrivateTo\(/, '')));
  assert.deepEqual(callers, ['app/_components/chat-send-form.tsx'], 'a second door to private mode — the 🔒 is the one door');
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.doesNotMatch(stream, /Reply privately|MessageHoldMenu|holdProps/, 'the held-message private door is back');
  assert.doesNotMatch(read('app/_components/chat/chat-host-strip.tsx'), /privately/, 'a face is a private door again');
});

test('7 · the ＋ is not rendered while a private recipient is set; the row is one sky blue; a pasted picture is refused', () => {
  const lead = h('button', { type: 'button', 'data-lab-plus': '' }, '+');
  const send = async () => {};
  const T = 'thread-no-plus';
  setPrivateTo(T, { userId: '00000000-0000-4000-8000-0000000000ef', name: 'Maria' });
  const priv = renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead }));
  setPrivateTo(T, null);
  const back = renderToStaticMarkup(h(ChatSendForm, { threadId: T, sendAction: send, lead }));
  assert.equal((priv.match(/data-lab-plus/g) ?? []).length, 0, 'the ＋ is rendered while a private recipient is set');
  assert.equal((back.match(/data-lab-plus/g) ?? []).length, 1, 'the × back to everyone did not restore the ＋');
  // Send: sky blue while private, the brand again after ×.
  const sendBtn = (m: string) => m.slice(m.lastIndexOf('<button', m.indexOf('aria-label="Send"')), m.indexOf('>', m.indexOf('aria-label="Send"')));
  assert.ok(sendBtn(priv).includes(PRIVATE_MARK), 'Send is not sky blue while private');
  // The box itself is the sky tint while private (v8.3), the house grey again after ×.
  const field = (m: string) => m.slice(m.lastIndexOf('<textarea', m.indexOf('name="body"')), m.indexOf('>', m.indexOf('name="body"')));
  assert.ok(field(priv).includes(PRIVATE_BOX_FILL), 'the private box is not the sky tint');
  assert.ok(!field(back).includes(PRIVATE_BOX_FILL) && field(back).includes('bg-ink/[0.06]'), 'the tint outlived ×');
  assert.doesNotMatch(sendBtn(priv), /sn-accent|mulberry|terracotta/, 'Send keeps the brand colour while private');
  assert.match(sendBtn(back), /text-sn-accent/, 'Send did not go back to the brand');
  // The private composer row draws no brand class anywhere.
  const row = priv.slice(priv.indexOf('data-chat-composer-row'), priv.lastIndexOf('</div>'));
  assert.doesNotMatch(row, /sn-accent|mulberry|terracotta|ab-brand/, 'a brand colour shows in the private composer row');
  // …and its focus rings and quiet buttons are sky blue (the house .ab focus is mulberry — overridden here).
  const css = readFileSync(join(WEB, 'app/globals.css'), 'utf8');
  assert.match(css, /\[data-chat-words-only\] :focus-visible,\s*\[data-chat-words-only\] \.ab:focus-visible \{ outline-color: rgb\(var\(--color-private\)\); \}/, 'a focus ring in the private row is the brand');
  assert.match(css, /\[data-chat-composer-row\] :is\(button, a\)\.ab\.ab-info\.quiet:not\(\.ab-main\) \{ color: rgb\(var\(--color-private\)\); \}/, 'the × / 🔒 are not sky blue');
  assert.ok(css.indexOf('[data-chat-words-only] :focus-visible') > css.indexOf('.ab:focus-visible {'), 'the private focus rule loses to the house .ab focus');
  // A pasted picture is refused while private, in the row's own words.
  const form = read('app/_components/chat-send-form.tsx');
  assert.match(form, /onPaste=\{\(e\) => \{\s*if \(!privateTo\) return;[\s\S]{0,260}kind === 'file'[\s\S]{0,120}e\.preventDefault\(\);\s*setFileError\(PRIVATE_WORDS_ONLY_MESSAGE\);/, 'a pasted picture is not refused while private');
});
