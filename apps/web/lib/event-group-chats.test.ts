/**
 * 💬 EVENT GROUP CHATS — the app's half (specs DECISION_LOG 2026-11-12 "EVENT GROUP CHATS APPROVED AS DRAWN", "FIVE
 * GUARDS APPROVED" (5)). The database's half (who is in, who adds, who leaves, money never in a group, private lines)
 * is tests/db/event-group-chats-and-a-private-line-to-several.db.test.ts.
 *
 *   1. A group's (+) and "/" carry Decision · Poll · Meeting · Photos & files only; Quote · Payment · Form appear as ONE
 *      quiet pointer row that is never a card and never a door.
 *   2. Whose bubble it is, in a group: the WRITER (several suppliers and guests share one side); supplier lines keep
 *      the shipped rule.
 *   3. The words: the list's line, the head's line, the preview; one role-group chat per role group someone holds.
 *   4. Who may add / leave / be put in General (the app draws only what the database allows).
 *   5. 🛡 Guard 5 — the new chat pieces load only when opened: the Chats page's Groups section is a server component
 *      (no script); the group's ▾ sheet and (+) rows are `next/dynamic` imports of the group page only.
 *
 * Sabotage (12 Nov 2026): a Quote card row added to `groupPlusRows` → 1 RED; `isGroupLine` removed from `ownsBubble` →
 * 2 RED; 'use client' on event-groups.tsx → 5 RED; a static import of group-plus-sheet → 5 RED.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GROUP_MONEY_ROW_LABEL, groupPlusRows, sheetSlashRows } from './chat-plus';
import { ownsBubble, isCoHostMessage } from './chat-bubble-owner';
import {
  canAddToGroup,
  canLeaveGroup,
  groupChatBack,
  groupHeadLine,
  groupListLine,
  groupListPreview,
  mayJoinGroup,
  roleGroupChats,
} from './chat-groups';

const WEB = join(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(join(WEB, rel), 'utf8');

test('1 · a group\'s (+) has no money card; the money row is a quiet pointer, never a door', () => {
  const rows = groupPlusRows({ pollOpen: false });
  const cards = rows.map((r) => r.card).filter(Boolean);
  assert.deepEqual(cards, ['decision', 'poll', 'meeting', 'file']);
  for (const bad of ['quote', 'payment', 'form', 'logpay', 'access'] as const) {
    assert.ok(!cards.includes(bad), `a ${bad} card is offered in a group`);
  }
  const money = rows.find((r) => r.label === GROUP_MONEY_ROW_LABEL);
  assert.ok(money && money.card === null && money.door === null && money.shutNow, 'the money row is pressable');
  // The "/" list is the sheet's card rows — the pointer can never be typed.
  const slash = sheetSlashRows(rows.map((r) => ({ key: r.key, card: r.card, shut: r.shutNow ?? null })) as never);
  assert.ok(!JSON.stringify(slash).includes('quote'), '"/quote" reaches a group');
  assert.ok(groupPlusRows({ pollOpen: true }).find((r) => r.key === 'poll')?.shutNow, 'two open polls in one group');
});

test('2 · in a group, the bubble is the writer\'s — whatever their side', () => {
  const g = (sender_role: string, sender_user_id: string) => ({ sender_role, sender_user_id, vendor_profile_id: null });
  assert.equal(ownsBubble(g('vendor', 'rosa'), 'couple', 'rosa'), true, 'Rosa\'s own line is not hers');
  assert.equal(ownsBubble(g('vendor', 'jake'), 'couple', 'rosa'), false, 'Jake\'s line is drawn as Rosa\'s');
  assert.equal(ownsBubble(g('guest', 'carlo'), 'couple', 'carlo'), true);
  assert.equal(isCoHostMessage(g('guest', 'carlo'), 'couple', 'ana'), true, 'a guest\'s run carries no name');
  // A supplier line keeps the shipped rule (the shop speaks as one).
  assert.equal(ownsBubble({ sender_role: 'vendor', sender_user_id: 'team', vendor_profile_id: 'shop' }, 'vendor', 'owner'), true);
});

test('3 · the words', () => {
  assert.equal(groupListLine({ group_kind: 'general', made_by_name: null }), 'Hosts + everyone attending');
  assert.equal(groupListLine({ group_kind: 'made', made_by_name: 'Ana' }), 'Made by Ana');
  assert.equal(groupHeadLine({ group_kind: 'made', member_count: 6, made_by_name: 'Ana' }), '6 inside · made by Ana');
  assert.equal(groupListPreview({ last_body: 'Hi', last_sender_name: 'You', last_is_private: true }), 'You: 🔒 Hi');
  const r = roleGroupChats(['principal_sponsor_ninang', 'groomsman', 'bride', 'guest']);
  assert.deepEqual(r.map((x) => x.key), ['groomsmen', 'principal_sponsors'].sort((a, b) => (a === 'groomsmen' ? -1 : b === 'groomsmen' ? 1 : 0)));
  assert.ok(r.find((x) => x.key === 'principal_sponsors')!.roles.includes('principal_sponsor'), 'a sponsor added later is not in it');
  assert.ok(!r.some((x) => x.key === ('couple' as never)), 'the couple is a role group chat');
});

test('4 · who adds, who leaves, who may be in General', () => {
  assert.equal(canAddToGroup('host', true), true);
  assert.equal(canAddToGroup('coordinator', true), true);
  assert.equal(canAddToGroup('supplier', true), false);
  assert.equal(canAddToGroup('guest', true), false);
  assert.equal(canAddToGroup('host', false), false);
  assert.equal(canLeaveGroup('host'), true);
  for (const k of ['supplier', 'coordinator', 'guest'] as const) assert.equal(canLeaveGroup(k), false);
  assert.equal(mayJoinGroup('general', 'supplier'), false);
  assert.equal(mayJoinGroup('made', 'supplier'), true);
  assert.equal(groupChatBack('supplier', 'e').href, '/vendor-dashboard/messages');
  assert.equal(groupChatBack('host', 'e').href, '/dashboard/e/messages');
});

test('5 · 🛡 the new pieces load only when opened', () => {
  const section = read('app/dashboard/[eventId]/messages/_components/event-groups.tsx');
  assert.doesNotMatch(section, /^['"]use client['"]/m, 'the Groups section ships script to the Chats page');
  const view = read('app/samahan/chat/[threadId]/_components/group-chat-view.tsx');
  assert.match(view, /const GroupSwitcher = dynamic\(\(\) => import\('\.\/group-switcher'\)\);/);
  assert.match(view, /const GroupThreadToolsSheet = dynamic\(\(\) => import\('\.\/group-plus-sheet'\)\);/);
  // (a type-only import is erased at build — it carries no code)
  assert.doesNotMatch(view, /^import (?!type ).* from '\.\/group-(plus-sheet|switcher)';/m, 'a group-only piece is imported statically');
  // Nothing outside the group page and its lab imports the group-only client pieces.
  assert.doesNotMatch(read('app/dashboard/[eventId]/messages/page.tsx'), /group-plus-sheet|group-switcher|group-chat-view/);
});
