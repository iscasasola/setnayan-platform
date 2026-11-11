/**
 * 👥 A SUPPLIER CHAT STARTS SMALL (DECISION_LOG 2026-11-09 👥 + the owner's follow-ups the same day).
 *
 *   1. The supplier NEVER sees the strip's ＋ — the strip draws it only when handed `addable`, and the supplier's thread
 *      page never hands it (nor `memberLeave`).
 *   2. The faces: someone else's face → private mode AT ONCE (no menu — owner, 9 Nov); your own face as a host → the
 *      house confirm box "Leave this chat?" with an optional note (≤ 200, Enter = Leave) and Leave · Not now at equal
 *      widths; no `leave` (supplier · coordinator · planner) → their face is not a button.
 *   6. A chat you left stays in your Chats list, greyed; a tap asks "Join this chat again?" ("You left on … — “note”",
 *      or "Couldn't load" for a refused read); joining posts "[name] joined"; the leave note is in no line.
 *   3. The ＋ list: "Add all" on top only when more than one host is missing; ticks; a host who left says so.
 *   4. The rules: only hosts leave; coordinators and planners are always in (never listed, never leave); the lines.
 *   5. The strip's order — Supplier · coordinator(s) · You · the other hosts; "You" in your own slot, never twice — and
 *      the ＋ last, only while an event host is missing.
 *
 * Sabotage (9 Nov 2026): the ＋ drawn without `addable` → 1 RED; "Leave chat" offered with no `leave` → 2 RED (and,
 * after the in-box ruling, another face given `aria-controls` again → 2 RED);
 * "Add all" shown for one missing host → 3 RED; a planner allowed to leave → 4 RED; the ＋ drawn with
 * no host missing → 5 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import { AddHostsList, ChatHostStrip } from '@/app/_components/chat/chat-host-strip';
import { LeaveNoteField, joinChatBody } from '@/app/_components/chat/leave-chat-dialogs';
import {
  addableHosts,
  canAddToChat,
  canLeaveChat,
  everyoneAddedLine,
  leaveNoteFrom,
  LEAVE_NOTE_MAX,
  memberAddedLine,
  memberJoinedLine,
  memberLeftLine,
  stripOrder,
} from './chat-members';
import type { ChatHost } from './chat-hosts';

(globalThis as unknown as { React: unknown }).React = React;
const WEB = join(__dirname, '..');
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const h = React.createElement;
const noop = async () => {};
const host = (userId: string, firstName: string, role: string | null = 'bride'): ChatHost => ({ userId, firstName, name: firstName, role, label: null });
const MARIA = host('u-maria', 'Maria');
const JOSE = host('u-jose', 'Jose', 'groom');

test('1 · the supplier never sees the ＋', () => {
  const base = { hosts: [MARIA, JOSE], presentIds: new Set<string>(), youId: 'u-shop', threadId: 't1' };
  const supplier = renderToStaticMarkup(h(ChatHostStrip, base));
  assert.doesNotMatch(supplier, /data-chat-host-add-open/, 'the ＋ is drawn with no `addable`');
  const hostSide = renderToStaticMarkup(
    h(ChatHostStrip, { ...base, youId: 'u-maria', hosts: [JOSE], addable: { candidates: [{ ...host('u-lea', 'Lea'), left: false }], add: noop } }),
  );
  assert.match(hostSide, /data-chat-host-add-open=""/);
  // The supplier's thread page hands neither the ＋ nor Leave to its stream.
  const supplierThread = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.doesNotMatch(supplierThread, /memberAdd|memberLeave/, 'the supplier\'s chat was handed the ＋ or Leave');
  // …and the labs only hand them to the event side.
  assert.match(read('app/dev/_components/lab-picked-chat.tsx'), /side === 'couple' && actions\.add && actions\.leave \? \{ memberAdd:/);
});

test('2 · the faces: someone else is a picture (the 🔒 is the one private door); your own face as a host → "Leave this chat?"; else nothing', () => {
  // The supplier, a coordinator or a planner: no `leave` → their own face is not even a button.
  const strip = renderToStaticMarkup(h(ChatHostStrip, { hosts: [MARIA], presentIds: new Set<string>(), youId: 'u-shop', threadId: 't1' }));
  assert.doesNotMatch(strip, /data-chat-host-face="you"/);
  const hostStrip = renderToStaticMarkup(h(ChatHostStrip, { hosts: [JOSE], presentIds: new Set<string>(), youId: 'u-maria', threadId: 't1', leave: noop }));
  const you = hostStrip.match(/<button[^>]*data-chat-host-face="you"[^>]*>/)?.[0] ?? '';
  assert.match(you, /aria-haspopup="dialog"/, 'your own face does not open the Leave pop-up');
  assert.match(you, /aria-label="Leave this chat"/);
  // Another face is a PICTURE (owner-approved prototype, 11 Nov 2026): the 🔒 beside the message box is the ONE door to
  // a private message (lib/a-private-message-looks-private.test.ts 6).
  assert.doesNotMatch(hostStrip, /data-chat-host-face="u-jose"/, 'another face is a button again');
  assert.doesNotMatch(hostStrip, /privately/, 'a face is a private-message door again');
  const src = read('app/_components/chat/chat-host-strip.tsx');
  assert.doesNotMatch(src, /setPrivateTo/, 'the strip opens private mode again — the 🔒 is the one door');
  assert.match(src, /\{leave \? \(\s*<LeaveChatDialog/, 'Leave is not the pop-up');
  assert.doesNotMatch(src, /data-chat-leave-confirm|HostFaceMenu/, 'the retired inline Leave row came back');

  // The pop-up IS the house confirm box — no new modal — with the answer first, both halves equal.
  const dlg = read('app/_components/chat/leave-chat-dialogs.tsx');
  const leave = dlg.slice(dlg.indexOf('export function LeaveChatDialog'), dlg.indexOf('export function joinChatBody'));
  for (const want of [/<ConfirmDialog\b/, /title="Leave this chat\?"/, /confirmLabel="Leave"/, /cancelLabel="Not now"/, /\bdestructive\b/, /\bequalRow\b/]) {
    assert.match(leave, want, `the Leave pop-up lost ${want}`);
  }
  const box = read('app/_components/confirm-dialog.tsx');
  assert.match(box, /\{equalRow \? \(\s*<div className="mt-5 grid grid-cols-2 gap-2"[^>]*>\s*<ActionButton\s+tone=\{destructive \? 'danger' : 'brand'\}/, 'the equal row is not answer-first at equal widths');
  // The note: optional, ≤ 200, Enter = Leave.
  const field = renderToStaticMarkup(h(LeaveNoteField, { value: '', onChange: () => {}, onEnter: () => {} }));
  assert.match(field, /Your note for leaving/);
  // The house Field template (TypedRow, lint:field-template): ≤ 200, and its Enter hands the words to Leave.
  assert.match(dlg, /<TypedRow\b[\s\S]*?maxLength=\{LEAVE_NOTE_MAX\}[\s\S]*?onEnter=\{onEnter\}/, 'the note is not the Field template, ≤ 200, Enter = Leave');
  assert.equal(LEAVE_NOTE_MAX, 200);
  assert.match(dlg, /<LeaveNoteField value=\{note\} onChange=\{setNote\} onEnter=\{leave\} \/>/, 'Enter does not leave');
  assert.equal(leaveNoteFrom('   '), null);
  assert.equal(leaveNoteFrom('x'.repeat(250))?.length, 200);
});

test('3 · the ＋ list: Add all only when more than one is missing; ticks; who left says so', () => {
  const two = renderToStaticMarkup(
    h(AddHostsList, {
      addable: { candidates: [{ ...host('u-lea', 'Lea', 'parent_of_bride'), left: true }, { ...host('u-lu', 'Tita Lu', 'ninang'), left: false }], add: noop },
      onDone: () => {},
    }),
  );
  assert.match(two, /data-chat-host-add-all=""/);
  assert.ok(two.indexOf('data-chat-host-add-all') < two.indexOf('data-chat-host-candidate'), '"Add all" is not on top');
  assert.equal((two.match(/role="checkbox"/g) ?? []).length, 2, 'a host row has no tick');
  assert.match(two, /left this chat/);
  const one = renderToStaticMarkup(h(AddHostsList, { addable: { candidates: [{ ...host('u-lu', 'Tita Lu'), left: false }], add: noop }, onDone: () => {} }));
  assert.doesNotMatch(one, /data-chat-host-add-all/, '"Add all" for a single missing host');
  const none = renderToStaticMarkup(h(AddHostsList, { addable: { candidates: [], add: noop }, onDone: () => {} }));
  assert.match(none, /data-chat-host-add="empty"/);
});

test('4 · only hosts leave; coordinators and planners are always in; the system lines', () => {
  assert.equal(canLeaveChat({ side: 'couple', role: 'bride' }), true);
  assert.equal(canLeaveChat({ side: 'couple', role: 'wedding_planner_external' }), false, 'a planner may leave');
  assert.equal(canLeaveChat({ side: 'vendor', role: null }), false, 'the supplier may leave');
  assert.equal(canAddToChat({ side: 'vendor' }), false, 'the supplier may add');
  assert.equal(canAddToChat({ side: 'couple' }), true);
  const planner = host('u-plan', 'Pia', 'wedding_planner_external');
  const lea = host('u-lea', 'Lea', 'parent_of_bride');
  const list = addableHosts([MARIA, JOSE, planner, lea], new Set(['u-maria']), new Set(['u-lea']));
  assert.deepEqual(list.map((x) => [x.userId, x.left]), [['u-jose', false], ['u-lea', true]], 'the ＋ list is wrong');
  assert.equal(memberAddedLine('Lea', 'Marco', false), 'Lea added Marco');
  assert.equal(memberAddedLine('Lea', 'Marco', true), 'Lea added Marco back');
  assert.equal(everyoneAddedLine('Lea'), 'Lea added everyone');
  assert.equal(memberLeftLine('Marco'), 'Marco left');
});

test('6 · a chat you left stays greyed in Chats; "Join this chat again?"; the note is in no line', () => {
  assert.equal(joinChatBody({ at: '2026-11-08T09:30:00Z', note: 'Mama is on it' }), 'You left on Nov 8, 2026 — “Mama is on it”');
  assert.equal(joinChatBody({ at: '2026-11-08T09:30:00Z', note: null }), 'You left on Nov 8, 2026', 'a blank note still draws its dash');
  assert.match(joinChatBody('unread'), /Couldn.t load/, 'a refused read invents a date');
  assert.equal(memberJoinedLine('Marco'), 'Marco joined');
  assert.equal(memberLeftLine.length, 1, 'the "left" line takes the note — it is shown to nobody else');
  const dlg = read('app/_components/chat/leave-chat-dialogs.tsx');
  const join = dlg.slice(dlg.indexOf('export function JoinChatDialog'));
  for (const want of [/<ConfirmDialog\b/, /title="Join this chat again\?"/, /confirmLabel="Join chat"/, /cancelLabel="Not now"/, /\bequalRow\b/]) {
    assert.match(join, want, `the Join pop-up lost ${want}`);
  }
  assert.doesNotMatch(join, /\bdestructive\b/, 'joining is drawn as a delete');
  // The Chats list keeps the row — greyed, never removed — and a tap asks first.
  const inbox = read('app/dashboard/[eventId]/messages/_components/chat-inbox.tsx');
  assert.match(inbox, /r\.left && join \? \(\s*<LeftChatRow\b/, 'a chat you left is not drawn as one');
  const row = read('app/_components/chat/left-chat-row.tsx');
  assert.match(row, /opacity-55/, 'a left chat is not greyed');
  assert.match(row, /<JoinChatDialog\b/);
  assert.match(row, /await join\(threadId\);\s*router\.push\(href\);/, 'joining does not open the chat');
});

test('5 · the strip\'s order, "You" never twice, and the ＋ last only while a host is missing', () => {
  const shop = host('u-shop', 'Lumière', 'supplier');
  const pia = host('u-pia', 'Pia', 'wedding_planner_external');
  const ids = (xs: { userId: string; isYou: boolean }[]) => xs.map((x) => (x.isYou ? `you:${x.userId}` : x.userId));
  // A host's view: Supplier · coordinator · You · the other hosts.
  assert.deepEqual(ids(stripOrder([MARIA, JOSE, pia, shop], 'u-maria', 'couple')), ['u-shop', 'u-pia', 'you:u-maria', 'u-jose']);
  // The supplier's view (not in the list): You first, then the coordinator, then the hosts.
  assert.deepEqual(ids(stripOrder([MARIA, pia, JOSE], 'u-shop', 'vendor')), ['you:u-shop', 'u-pia', 'u-maria', 'u-jose']);
  // The coordinator's view: You in the coordinator's slot — once.
  const coord = ids(stripOrder([shop, MARIA, pia], 'u-pia', 'couple'));
  assert.deepEqual(coord, ['u-shop', 'you:u-pia', 'u-maria']);
  assert.equal(coord.filter((x) => x.startsWith('you:')).length, 1, '"You" drawn twice');

  // Drawn: the ＋ last, and only while a host is missing.
  const base = { hosts: [shop, MARIA, JOSE], presentIds: new Set<string>(), youId: 'u-maria', threadId: 't1', viewerSide: 'couple' as const };
  const missing = renderToStaticMarkup(
    h(ChatHostStrip, { ...base, addable: { candidates: [{ ...host('u-lea', 'Lea', 'parent_of_bride'), left: true }], add: noop } }),
  );
  assert.match(missing, /data-chat-host-add-open=""/);
  assert.ok(missing.lastIndexOf('data-chat-host-face') < missing.indexOf('data-chat-host-add-open'), 'the ＋ is not last');
  const you = missing.indexOf('>You<span class="sr-only">');
  assert.ok(missing.indexOf('Lumière') < you && you < missing.indexOf('Jose'), 'the drawn order is wrong');
  const full = renderToStaticMarkup(h(ChatHostStrip, { ...base, addable: { candidates: [], add: noop } }));
  assert.doesNotMatch(full, /data-chat-host-add-open/, 'the ＋ is drawn with every host already in');
  assert.equal((full.match(/>You<span class="sr-only">/g) ?? []).length, 1, '"You" drawn twice');
});
