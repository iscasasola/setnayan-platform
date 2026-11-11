/**
 * chat-gaps.test.ts — THE SIX CHAT GAPS, EACH HELD (owner 8 Nov 2026: "yes build them" · "suppliers also get ask for
 * access").
 *
 *   1 · UNREAD — a message that arrives while the chat is open is marked read (one debounced write, only in view);
 *       "Seen" moves live over the stream's own presence channel; a NULL sender is never unread.
 *   2 · CO-HOST NAMES — on the hosts' side "mine" is the signed-in person; another co-host's run is theirs, named.
 *   3 · NOTICES — a host's message reaches the shop's team who may chat and the OTHER hosts; in the app only.
 *   4 · TEAM MEMBERS SEND — the shop's team members RLS admits are senders, not `not_member`; the block covers them.
 *   5 · PAYMENTS SHOW AT ONCE — a Setnayan line re-draws the open chat once; a payment ask posts one.
 *   6 · ASK FOR ACCESS in the supplier's (+) — the shipped ask, one dropdown, and the thread shows a plain line.
 *
 * Pure rules are run; wiring is read from the source (every sabotage below was seen red once — see the PR body).
 * The SQL half of 1 and 4 is tests/db/a-line-nobody-wrote-is-never-unread.db.test.ts.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { countsAsUnreadFor, createReadDebouncer, latestRead } from './chat-read-live';
import { isCoHostMessage, ownsBubble } from './chat-bubble-owner';
import { bubbleRun } from './chat-bubble-runs';
import { chatNoticeRecipients, shopChatPeopleFrom, shopSideIds } from './chat-shop-people';
import { refreshesTheChat } from './chat-live-refresh';
import { accessAskedLine, paymentAskedLine } from './chat-gap-lines';
import { supplierPlusRows, hostPlusRows, PLUS_CARD_TOPIC } from './chat-plus';
import { PUSH_LEVEL } from './push-levels';
import { coupleSupplierNotice } from './couple-supplier-notices';

const here = dirname(fileURLToPath(import.meta.url));
const web = join(here, '..');
const read = (rel: string) => readFileSync(join(web, rel), 'utf8');
const STREAM = 'app/_components/chat-message-stream.tsx';

// ── 1 · UNREAD ──────────────────────────────────────────────────────────────

test('1 · a NULL sender is never unread; mine is never unread; a private line to someone else is not mine to read', () => {
  assert.equal(countsAsUnreadFor({ sender_user_id: null }, 'me'), false, 'a Setnayan line counted as unread');
  assert.equal(countsAsUnreadFor({ sender_user_id: 'me' }, 'me'), false);
  assert.equal(countsAsUnreadFor({ sender_user_id: 'co-host' }, 'me'), true, 'a co-host’s message is unread for me');
  assert.equal(countsAsUnreadFor({ sender_user_id: 'shop', recipient: 'me' }, 'me'), true);
  assert.equal(countsAsUnreadFor({ sender_user_id: 'shop', recipient: 'someone' }, 'me'), false);
  assert.equal(latestRead('2026-11-08T10:00:00Z', '2026-11-08T09:00:00Z'), '2026-11-08T10:00:00Z', 'Seen went backwards');
  assert.equal(latestRead(null, '2026-11-08T09:00:00Z'), '2026-11-08T09:00:00Z');
});

test('1 · ONE mark per burst of live arrivals, never while hidden, and a hidden arrival is marked when it comes back', () => {
  const timers: Array<{ fn: () => void; live: boolean }> = [];
  let visible = true;
  let marks = 0;
  const d = createReadDebouncer({
    mark: () => (marks += 1),
    isVisible: () => visible,
    setTimer: (fn) => {
      const t = { fn, live: true };
      timers.push(t);
      return t;
    },
    clearTimer: (h) => {
      (h as { live: boolean }).live = false;
    },
  });
  const flush = () => {
    for (const t of timers.splice(0)) if (t.live) t.fn();
  };
  d.arrived();
  d.arrived();
  d.arrived();
  flush();
  assert.equal(marks, 1, 'three live messages made more than one write');
  visible = false;
  d.arrived();
  flush();
  assert.equal(marks, 1, 'a hidden tab marked the chat read');
  visible = true;
  d.shown();
  flush();
  assert.equal(marks, 2, 'the arrival that waited in a hidden tab was never marked');
  d.shown();
  flush();
  assert.equal(marks, 2, 'coming back with nothing owed wrote anyway');
  d.arrived();
  d.cancel();
  flush();
  assert.equal(marks, 2, 'a mark ran after unmount');
});

test('1 · the stream marks live arrivals, says "read" on its own presence channel, and Seen is live state', () => {
  const s = read(STREAM);
  assert.match(s, /if \(countsAsUnreadFor\(m, currentUserId\)\) arrived = true;/, 'live arrivals are not judged by the one rule');
  assert.match(s, /if \(arrived\) readDebouncerRef\.current\?\.arrived\(\);/, 'a live arrival no longer marks the chat read');
  assert.match(s, /void markThreadRead\(threadId\)\s*\.then\(\(\) => \{[\s\S]{0,80}sayReadRef\.current\(at\);/, 'a live mark is not said to the other side');
  assert.match(s, /\.on\('broadcast', \{ event: CHAT_READ_BROADCAST \}/, 'the presence channel does not hear the other side read');
  assert.match(s, /if \(side === viewerRole \|\|/, 'a co-host’s read would count as the other side’s Seen');
  assert.match(s, /lastOwnLine\(\{ lastStored: ownLast, pendings, viewerRole, theirLastReadAt: theirRead \}\)/, 'Seen is still the frozen prop');
  // No new socket: the read rides `chat-presence-${threadId}`; the only channels are the two that shipped.
  assert.equal((s.match(/supabase\s*\.channel\(|supabase\.channel\(/g) ?? []).length, 2, 'the stream opened a new channel');
});

test('1 · only the Chat view marks: the picked client keeps ONE MarkReadWhenShown, and no stream sits in Details/Quotation', () => {
  const page = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.equal((page.match(/<MarkReadWhenShown /g) ?? []).length, 1);
  // The chat box is drawn into the Chat node and the full-screen frame — nowhere else (the quote page is a tool node).
  assert.equal((page.match(/\{chatBox\}/g) ?? []).length, 2, 'the chat box (and its stream) is drawn somewhere a mark would be wrong');
});

test('1 · the browser’s own unread mirror drops NULL senders too', () => {
  const inbox = read('lib/couple-inbox.ts');
  assert.equal((inbox.match(/\.not\('sender_user_id', 'is', null\)\s*\.neq\('sender_user_id', userId\)/g) ?? []).length, 2);
  assert.doesNotMatch(inbox, /sender_user_id\.is\.null/, 'a NULL sender is counted as unread again');
});

// ── 2 · CO-HOST NAMES ───────────────────────────────────────────────────────

test('2 · on the hosts’ side "mine" is the signed-in person; the shop side is unchanged', () => {
  const coHost = { sender_role: 'couple', sender_user_id: 'ben' };
  assert.equal(ownsBubble(coHost, 'couple', 'ana'), false, 'a co-host’s message is drawn as mine');
  assert.equal(ownsBubble({ sender_role: 'couple', sender_user_id: 'ana' }, 'couple', 'ana'), true);
  assert.equal(ownsBubble({ sender_role: 'couple', sender_user_id: null }, 'couple', 'ana'), true, 'a legacy row lost its owner');
  assert.equal(ownsBubble({ sender_role: 'vendor', sender_user_id: 'team-1' }, 'vendor', 'owner'), true, 'the shop no longer speaks as one');
  assert.equal(ownsBubble({ sender_role: 'vendor', sender_user_id: 'sol' }, 'couple', 'ana'), false);
  assert.equal(isCoHostMessage(coHost, 'couple', 'ana'), true);
  assert.equal(isCoHostMessage(coHost, 'vendor', 'sol'), false);
});

test('2 · two co-hosts writing back to back are two runs, so each carries their own name', () => {
  const at = (s: number) => new Date(Date.UTC(2026, 10, 8, 10, 0, s)).toISOString();
  const rows = [
    { sender_role: 'couple', sender_user_id: 'ana', created_at: at(0) },
    { sender_role: 'couple', sender_user_id: 'ben', created_at: at(5) },
    { sender_role: 'couple', sender_user_id: 'ben', created_at: at(9) },
  ];
  assert.deepEqual(bubbleRun(rows, 1), { first: true, last: false }, 'Ben’s run joined Ana’s');
  assert.deepEqual(bubbleRun(rows, 2), { first: false, last: true });
});

test('2 · the stream asks the person rule, and names a co-host’s run from the receipts read', () => {
  const s = read(STREAM);
  assert.match(s, /const mine = ownsBubble\(m, viewerRole, currentUserId\);/);
  assert.doesNotMatch(s, /function ownsBubble\(/, 'a second, side-only ownsBubble is back in the stream');
  assert.match(s, /senderNames\[m\.sender_user_id\] \?\? \(coHost \? 'A co-host' : null\)/, 'a co-host’s run is not named');
  const receipts = read('lib/chat-thread-receipts.server.ts');
  assert.match(receipts, /else if \(args\.viewerRole === 'couple' && m\.sender_role === 'couple'\) coHosts\.add\(m\.sender_user_id\);/);
  assert.match(receipts, /\.\.\.coHosts\]\);/, 'the co-hosts are not in the one names read');
});

// ── 3 · NOTICES ─────────────────────────────────────────────────────────────

test('3 · a host writes → the shop owner, its team who may chat, and the OTHER hosts; never the writer, never twice', () => {
  const told = chatNoticeRecipients({
    senderRole: 'couple',
    senderUserId: 'ana',
    shopOwnerUserId: 'sol',
    shopPeople: ['sol', 'ada', 'gus'],
    threadMembers: ['ana', 'ben'],
    coordinators: ['cora'],
  });
  assert.deepEqual(told, { shopOwner: 'sol', shopTeam: ['ada', 'gus'], hostsAsBefore: [], hostsInApp: ['ben', 'cora'] });
  const fromShop = chatNoticeRecipients({
    senderRole: 'vendor',
    senderUserId: 'ada',
    shopOwnerUserId: 'sol',
    shopPeople: ['sol', 'ada'],
    threadMembers: ['ana', 'ben'],
    coordinators: ['cora'],
  });
  assert.deepEqual(fromShop, { shopOwner: null, shopTeam: [], hostsAsBefore: ['ana', 'ben'], hostsInApp: ['cora'] });
});

test('3 · everyone this build adds is told IN THE APP ONLY — a type of its own, never on the email allowlist', () => {
  const emit = read('lib/notification-emit.ts');
  const allow = emit.slice(emit.indexOf('const EMAIL_ENABLED_TYPES'), emit.indexOf(']);', emit.indexOf('const EMAIL_ENABLED_TYPES')));
  assert.doesNotMatch(allow, /'chat_message_in_app'/, 'the new recipients are emailed');
  assert.equal(coupleSupplierNotice('chat_message_in_app')?.reach, 'app_only');
  assert.equal(PUSH_LEVEL.chat_message_in_app, 'normal', 'its phone notice does not follow the push levels');
  const actions = read('lib/chat-actions.ts');
  const fn = actions.slice(actions.indexOf('export async function notifyOtherParty'), actions.indexOf('async function findPriorLockedEventName'));
  assert.match(fn, /for \(const userId of told\.shopTeam\) await tellShop\(userId, false\);/);
  // tellShop(…, false) is the app-only face; every co-host / coordinator notice is app-only.
  assert.match(fn, /: emitNotification\(\{\s*userId,\s*type: 'chat_message_in_app',/);
  assert.equal((fn.match(/type: 'chat_message_in_app'/g) ?? []).length, 3, 'a new recipient is told with an emailed type');
});

// ── 4 · TEAM MEMBERS SEND ───────────────────────────────────────────────────

test('4 · the shop side is the policy’s three branches — never wider (a deactivated member is out)', () => {
  const team = [
    { vendor_team_member_id: 't1', user_id: 'ada', role: 'admin', deactivated_at: null },
    { vendor_team_member_id: 't2', user_id: 'gus', role: 'agent', deactivated_at: null },
    { vendor_team_member_id: 't3', user_id: 'vic', role: 'viewer', deactivated_at: null },
    { vendor_team_member_id: 't4', user_id: 'old', role: 'admin', deactivated_at: '2026-10-01T00:00:00Z' },
  ];
  assert.deepEqual(shopChatPeopleFrom({ ownerUserId: 'sol', team, servingMemberIds: new Set() }), ['sol', 'ada']);
  assert.deepEqual(shopChatPeopleFrom({ ownerUserId: 'sol', team, servingMemberIds: new Set(['t2']) }), ['sol', 'ada', 'gus']);
  assert.deepEqual(shopSideIds('sol', ['ada', 'sol', null, 'gus']), ['sol', 'ada', 'gus'], 'the owner is not first, or a person twice');
});

test('4 · chat-send admits the team the policy admits before "not_member"; the block check counts the team', () => {
  const send = read('lib/chat-send.ts');
  assert.match(
    send,
    /\} else if \(\(await shopPeopleRead\(\)\)\.userIds\.includes\(user\.id\)\) \{\s*senderRole = 'vendor';\s*\} else \{\s*return \{ ok: false, code: 'not_member'/,
    'a team member RLS admits is refused as not_member',
  );
  const block = read('lib/chat-block.ts');
  assert.match(block, /\.from\('vendor_team_members'\)/, 'the app-layer block check stops at the owner');
  assert.match(block, /return shopSideIds\(owner, team\);/);
  const actions = read('lib/chat-actions.ts');
  assert.match(actions, /if \(shop\.userIds\.includes\(userId\)\) return 'vendor';/, 'a team member cannot block or report');
});

// ── 5 · PAYMENTS SHOW AT ONCE ───────────────────────────────────────────────

test('5 · a Setnayan line re-draws the open chat once; a person’s words do not', () => {
  assert.equal(refreshesTheChat({ sender_role: 'system', sender_user_id: null }), true);
  assert.equal(refreshesTheChat({ sender_role: 'couple', sender_user_id: 'ana' }), false);
  const s = read(STREAM);
  assert.match(s, /if \(refreshesTheChat\(m\)\) refresh = true;/, 'a payment line no longer refreshes the chat');
  assert.match(s, /if \(refresh && !refreshTimerRef\.current\) \{/, 'the refresh is not one-at-a-time');
  assert.match(s, /visibilityState === 'visible'\) router\.refresh\(\);/);
});

test('5 · a payment ask posts one plain line (no free-text note in it)', () => {
  assert.equal(paymentAskedLine({ amountPhp: 5000, dueDate: '2026-12-12' }), 'Payment asked · ₱5,000 · due 12 Dec 2026');
  assert.equal(paymentAskedLine({ amountPhp: 5000, dueDate: null }), 'Payment asked · ₱5,000');
  const actions = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const core = actions.slice(actions.indexOf('async function askForPaymentCore'), actions.indexOf('export async function vendorWithdrawPaymentAsk'));
  assert.match(core, /await postThreadSystemLine\(createAdminClient\(\), \{[\s\S]*?body: paymentAskedLine\(\{ amountPhp: amount, dueDate \}\),/);
});

// ── 6 · ASK FOR ACCESS IN THE SUPPLIER (+) ──────────────────────────────────

test('6 · every supplier (and the coordinator) has the row; it waits for the booking, like the shipped ask', () => {
  for (const paid of [false, true]) {
    const row = supplierPlusRows({ paid }).find((r) => r.key === 'access');
    assert.ok(row, 'the supplier (+) has no Ask for access');
    assert.equal(row.card, 'access');
    assert.ok(row.shutUntilAgreement?.reason, 'the row is hidden rather than shut with its reason');
  }
  assert.ok(!hostPlusRows({ canLogPayment: true }).some((r) => r.key === 'access'), 'the hosts were given an ask for access');
  assert.equal(PLUS_CARD_TOPIC.access, 'access');
});

test('6 · the card is the SHIPPED ask, one dropdown — and the ask posts a plain line in the chat', () => {
  const card = read('app/_components/chat/cards/access-step-card.tsx');
  assert.match(card, /await askHostForAccess\(eventId, picked, null\)/, 'the card is a second ask, not the shipped one');
  assert.equal((card.match(/<PickMenu\b/g) ?? []).length, 1, 'the parts are not one dropdown');
  assert.doesNotMatch(card, /^'use server'/m);
  const draft = read('app/_components/chat/plus-draft.tsx');
  assert.match(draft, /draft\.kind === 'access' && side === 'vendor' \? \(\s*<AccessStepCard eventId=\{eventId\}/);
  const ask = read('app/vendor-dashboard/on-the-day/live/[eventId]/_components/floor-command/access-actions.ts');
  assert.match(ask, /body: accessAskedLine\(\{ shopName: profile\.business_name \?\? '', areas \}\)/, 'the ask posts no line');
  // ONE exported action, still — no new route against the server-action budget.
  assert.equal((ask.match(/^export async function /gm) ?? []).length, 1);
  assert.equal(
    accessAskedLine({ shopName: 'Sol Studio', areas: ['seat_plan', 'guest_list'] }),
    'Sol Studio asked to open: Seat plan, Guest list — the hosts answer in Access requests.',
  );
});
