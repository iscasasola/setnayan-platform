/**
 * 👥 A SUPPLIER CHAT STARTS SMALL (DECISION_LOG 2026-11-09 👥 + the owner's follow-ups the same day).
 *
 *   1. The supplier NEVER sees the strip's ＋ — the strip draws it only when handed `addable`, and the supplier's thread
 *      page never hands it (nor `memberLeave`).
 *   2. Both face menus: someone else's face → "Message privately"; your own face as a host → "Leave chat", which asks
 *      first (Stay · Leave, one row, equal widths); no `leave` (supplier · coordinator · planner) → nothing.
 *   3. The ＋ list: "Add all" on top only when more than one host is missing; ticks; a host who left says so.
 *   4. The rules: only hosts leave; coordinators and planners are always in (never listed, never leave); the lines.
 *   5. The strip's order — Supplier · coordinator(s) · You · the other hosts; "You" in your own slot, never twice — and
 *      the ＋ last, only while an event host is missing.
 *
 * Sabotage (9 Nov 2026): the ＋ drawn without `addable` → 1 RED; "Leave chat" offered with no `leave` → 2 RED;
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
import { AddHostsList, ChatHostStrip, HostFaceMenu } from '@/app/_components/chat/chat-host-strip';
import {
  addableHosts,
  canAddToChat,
  canLeaveChat,
  everyoneAddedLine,
  memberAddedLine,
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
  assert.match(read('app/dev/_components/lab-picked-chat.tsx'), /side === 'couple' \? \{ memberAdd:/);
});

test('2 · the face menus: someone else → Message privately; you as a host → Leave chat (asked first); else nothing', () => {
  const props = { onPrivate: () => {}, onDone: () => {} };
  const other = renderToStaticMarkup(h(HostFaceMenu, { ...props, who: { id: 'u-jose', name: 'Jose' }, isYou: false, canMessage: true, leave: null }));
  assert.match(other, /Message privately/);
  assert.doesNotMatch(other, /Leave/);
  const you = renderToStaticMarkup(h(HostFaceMenu, { ...props, who: { id: 'u-maria', name: 'You' }, isYou: true, canMessage: true, leave: noop }));
  assert.match(you, /Leave chat/);
  assert.doesNotMatch(you, /Message privately/);
  const confirm = renderToStaticMarkup(
    h(HostFaceMenu, { ...props, who: { id: 'u-maria', name: 'You' }, isYou: true, canMessage: true, leave: noop, initiallyConfirming: true }),
  );
  assert.match(confirm, /data-chat-leave-confirm=""/);
  assert.match(confirm, /grid grid-cols-2 gap-2/, 'Stay and Leave are not one row at equal widths');
  assert.match(confirm, />Stay</);
  assert.match(confirm, />Leave</);
  // The supplier, a coordinator or a planner: the page passes no `leave` → nothing on their own face.
  const noLeave = renderToStaticMarkup(h(HostFaceMenu, { ...props, who: { id: 'u-shop', name: 'You' }, isYou: true, canMessage: true, leave: null }));
  assert.equal(noLeave, '', '"Leave chat" is offered to someone who may not leave');
  // And their own face is not even a button.
  const strip = renderToStaticMarkup(h(ChatHostStrip, { hosts: [MARIA], presentIds: new Set<string>(), youId: 'u-shop', threadId: 't1' }));
  assert.doesNotMatch(strip, /data-chat-host-face="you"/);
  const hostStrip = renderToStaticMarkup(h(ChatHostStrip, { hosts: [JOSE], presentIds: new Set<string>(), youId: 'u-maria', threadId: 't1', leave: noop }));
  assert.match(hostStrip, /data-chat-host-face="you"/);
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
