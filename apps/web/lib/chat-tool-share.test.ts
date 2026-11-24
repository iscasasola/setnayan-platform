/**
 * 🧰 "SHARE FROM YOUR TOOLS" — the rules (DECISION_LOG 2026-11-23 "SPECIALIZED TOOLS WORK ON THEIR OWN AND SHARE INTO
 * CHAT", specs dee66686; drawing `prototypes/supplier_store_graphs_badges_2026-11-23` frame 7).
 *
 *   1. Five shareable tools, the planning ones, in the drawing's order. The event-day tools and the Papic challenge
 *      never appear in chat.
 *   2. A tool the shop does NOT have never appears in the picker: a paid tool not bought / not with the plan / not in
 *      the trial; a free tool not added to Your tools. A paid tool that could not be read is never offered.
 *   3. The send refuses a share of a tool the shop does not hold (the server, not the hidden row), and it is the
 *      shipped chat send — no new server action.
 *   4. The couple NEVER sees a price or a lock: no ₱, no "buy", no lock on either face, and the card never imports a
 *      price reader, a peso formatter or a lock icon.
 *   5. A share and its OK are exact words; only the hosts' side approves, and only a later line of the same kind.
 *   6. ONE ＋ row, in the supplier's tray, before Every version; never on the host's or a group's.
 *
 * Sabotage (each seen red, then restored): add 'scanner' to SHAREABLE_TOOLS (1) · drop the `toolIsYours` filter in
 * `shareableTools` (2) · delete the `readShareableTools` refusal in chat-send.ts (3) · put a ₱ price in a card's words (4) ·
 * count a vendor line as an approval (5).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from './strip-comments';
import {
  SHAREABLE_TOOLS,
  TOOL_SHARE_WORDS,
  approvedToolShares,
  toolApprovalBody,
  toolApprovalFromLine,
  toolShareBody,
  toolShareFace,
  toolShareFromLine,
} from './chat-tool-share';
import { shareableTools } from './chat-tool-share-held';
import { SPECIALIZED_TOOLS } from './specialized-tools';
import { PAID_STORE_TOOLS, type ToolFacts } from './supplier-store';
import { groupPlusRows, hostPlusRows, supplierPlusRows } from './chat-plus';

const WEB = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const facts = (over: Partial<ToolFacts> = {}): ToolFacts => ({
  freeOpen: true,
  owned: new Set(),
  pending: new Set(),
  subscribed: false,
  prices: { cake_tool: 1, song_bank: 1, papic_challenge: 1, plan_3d: 1 },
  picked: [],
  toolsOff: [],
  categoryLabels: [],
  services: [],
  ...over,
});

test('1 · five planning tools, in the drawing’s order; event-day tools never appear', () => {
  assert.deepEqual([...SHAREABLE_TOOLS], ['cake_tool', 'plan_3d', 'run_of_show', 'emcee_script', 'song_bank']);
  for (const k of ['scanner', 'headcount', 'live_watch', 'floor_command', 'song_desk', 'papic_challenge']) {
    assert.ok(!(SHAREABLE_TOOLS as readonly string[]).includes(k), `${k} is an event-day tool — never in chat`);
  }
  // Every shareable key is a shipped tool, named the Store's way.
  for (const k of SHAREABLE_TOOLS) {
    const t = SPECIALIZED_TOOLS.find((x) => x.key === k);
    assert.ok(t, `${k} is not a shipped tool`);
    assert.equal(TOOL_SHARE_WORDS[k].tool, t!.title);
  }
});

test('2 · a tool the shop does not have never appears in the picker', () => {
  // Nothing bought, nothing added → nothing to share.
  assert.deepEqual(shareableTools(facts()), { tools: [], unread: false });
  // A free tool appears only once added to Your tools — and only while free tools open (Verified up).
  assert.deepEqual(shareableTools(facts({ picked: ['run_of_show'] })).tools, ['run_of_show']);
  assert.deepEqual(shareableTools(facts({ picked: ['run_of_show'], freeOpen: false })).tools, [], 'a shop below Verified shares no free tool');
  assert.deepEqual(shareableTools(facts({ picked: ['scanner', 'headcount'] })).tools, [], 'event-day tools added are still never offered');
  // A paid tool (owner a02673ac): bought AND on Plus, Pro or Ultra. No trial; the plan alone opens nothing.
  assert.deepEqual(shareableTools(facts({ owned: new Set(['cake_tool']), subscribed: true })).tools, ['cake_tool']);
  assert.deepEqual(shareableTools(facts({ subscribed: true })).tools, [], 'a plan alone shares nothing');
  assert.deepEqual(
    shareableTools(facts({ owned: new Set(['cake_tool', 'plan_3d', 'song_bank', 'papic_challenge']), subscribed: true })).tools,
    ['cake_tool', 'plan_3d', 'song_bank'],
    'every paid shareable tool bought and subscribed (the Papic challenge is never shared)',
  );
  // Bought but off-plan ("Works again when you subscribe"), a payment still in review, or a price on the shelf is NOT shared.
  assert.deepEqual(shareableTools(facts({ owned: new Set(['cake_tool']), subscribed: false })).tools, [], 'a locked tool is never shared');
  assert.deepEqual(shareableTools(facts({ pending: new Set(['plan_3d']), subscribed: true })).tools, []);
  // A paid tool the shop has only on sale is never offered, whatever its price.
  for (const k of PAID_STORE_TOOLS) {
    assert.ok(!shareableTools(facts()).tools.includes(k as never), `${k} offered without being held`);
  }
  // An unread paid state is never offered — and the picker is told it could not load.
  const unread = shareableTools(facts({ owned: null, picked: ['emcee_script'] }));
  assert.deepEqual(unread, { tools: ['emcee_script'], unread: true });
});

test('2b · the picker reads the Store’s own facts — never the layout alone', () => {
  const held = read('lib/chat-tool-share-held.ts');
  assert.match(held, /toolIsOpen\(s\)/, 'the Store’s own "does it work now" decides (a02673ac: bought AND subscribed)');
  assert.match(held, /toolStatus\(k, f\)/);
  const server = read('lib/supplier-store.server.ts');
  assert.match(server, /export async function readShareableTools[\s\S]{0,600}readStoreToolFacts\(admin, admin, vendorProfileId, services, layout\)/);
  assert.match(server, /return shareableTools\(/);
  const page = read('app/vendor-dashboard/messages/[threadId]/page.tsx');
  assert.match(page, /readShareableTools\(createAdminClient\(\), profile\.vendor_profile_id/, 'the chat page reads the list');
  assert.match(page, /<ThreadToolsSheet[^>]*share=\{shareTools\}/, 'and hands it to the ＋');
  const sheet = read('app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx');
  assert.match(sheet, /const shareTools = share\?\.tools \?\? \[\];/);
  assert.match(sheet, /\{shareTools\.map\(\(tool\) =>/, 'the picker draws ONLY the held list');
});

test('3 · the send refuses a share of a tool not held — the shipped send, no new action', () => {
  const send = read('lib/chat-send.ts');
  assert.match(send, /const shared = toolShareFromLine\(trimmed\);/);
  assert.match(send, /if \(!held\.tools\.includes\(shared\)\) return \{ ok: false, code: 'tool_share_refused'/);
  assert.match(send, /if \(unverified\) return \{ ok: false, code: 'tool_share_refused'/, 'a ＋ tool needs a verified shop');
  // The picker and the card post through the composer's own action — nothing new is exported as a server action.
  const sheet = read('app/vendor-dashboard/messages/[threadId]/_components/thread-tools-sheet.tsx');
  assert.match(sheet, /await sendChatMessage\(fd\);/);
  assert.match(sheet, /fd\.set\(CHAT_SENT_AS_FIELD, 'vendor'\);/, 'a share speaks for the shop');
  const card = read('app/_components/chat/cards/tool-share-card.tsx');
  assert.match(card, /sendApproval = sendChatMessage/);
  for (const f of ['lib/chat-tool-share.ts', 'lib/chat-tool-share-held.ts', 'app/_components/chat/cards/tool-share-card.tsx']) {
    assert.doesNotMatch(readFileSync(join(WEB, f), 'utf8'), /^'use server'/m, `${f} adds a server action`);
  }
});

test('4 · the couple never sees a price or a lock', () => {
  const words: string[] = [];
  for (const k of SHAREABLE_TOOLS) {
    words.push(toolShareBody(k), toolApprovalBody(k), ...Object.values(TOOL_SHARE_WORDS[k]));
    for (const approved of [false, true]) {
      for (const viewer of ['couple', 'vendor'] as const) words.push(...Object.values(toolShareFace(k, viewer, approved)).filter((x): x is string => !!x));
    }
  }
  for (const w of words) {
    assert.doesNotMatch(w, /₱|PHP|\bprice\b|\bbuy\b|\bpay\b|\block(ed)?\b|one-time|trial|upgrade|\bPro\b|\bPlus\b/i, `"${w}" speaks of money or a lock`);
  }
  // The card itself: no price reader, no peso formatter, no lock icon, no plan gate.
  const card = read('app/_components/chat/cards/tool-share-card.tsx');
  assert.doesNotMatch(card, /\bLock\b|formatPhp|formatCentavos|lib\/php|supplier-store|vendor_billing_catalog|toolFootWords|toolStatus|price/i);
  // The couple's face has Open and Approve; the shop's has neither.
  assert.deepEqual(
    (({ open, approve }) => ({ open, approve }))(toolShareFace('song_bank', 'couple', false)),
    { open: 'Open', approve: 'Approve' },
  );
  assert.deepEqual((({ open, approve }) => ({ open, approve }))(toolShareFace('song_bank', 'vendor', false)), { open: null, approve: null });
});

test('5 · exact words; only the hosts approve, and only a later share of the same kind', () => {
  for (const k of SHAREABLE_TOOLS) {
    assert.equal(toolShareFromLine(toolShareBody(k)), k);
    assert.equal(toolApprovalFromLine(toolApprovalBody(k)), k);
    assert.equal(toolShareFromLine(`${toolShareBody(k)} extra`), null, 'never guessed');
  }
  assert.equal(toolShareFromLine('🧰 Cake design'), null);
  const rows = [
    { id: 'a', body: toolShareBody('cake_tool'), senderRole: 'vendor' },
    { id: 'b', body: toolShareBody('plan_3d'), senderRole: 'vendor' },
    { id: 'x', body: toolApprovalBody('plan_3d'), senderRole: 'vendor' }, // the shop cannot approve its own
    { id: 'y', body: toolApprovalBody('plan_3d'), senderRole: 'system' }, // nor can a system line
    { id: 'c', body: toolApprovalBody('cake_tool'), senderRole: 'couple' },
    { id: 'd', body: toolShareBody('cake_tool'), senderRole: 'vendor' }, // a later share waits again
    { id: 'e', body: toolShareBody('run_of_show'), senderRole: 'couple' }, // a host typing a share is not a share
    { id: 'f', body: toolApprovalBody('run_of_show'), senderRole: 'coordinator' },
  ];
  assert.deepEqual([...approvedToolShares(rows)].sort(), ['a']);
});

test('6 · one ＋ row on the supplier’s tray, before Every version; never the host’s or a group’s', () => {
  const sup = supplierPlusRows({ paid: false });
  const share = sup.filter((r) => r.key === 'share');
  assert.equal(share.length, 1);
  assert.equal(share[0]!.label, 'Share from your widgets');
  assert.equal(share[0]!.opensTools, true);
  assert.equal(share[0]!.card, null, 'the row opens the picker; it is not a draft card');
  assert.equal(sup.at(-1)!.key, 'versions');
  assert.equal(sup.at(-2)!.key, 'share');
  assert.ok(supplierPlusRows({ paid: false, verified: false }).find((r) => r.key === 'share')!.shutNow, 'an unverified shop’s row is locked like every tile');
  assert.ok(!hostPlusRows({ canLogPayment: true }).some((r) => r.key === 'share'));
  assert.ok(!groupPlusRows({}).some((r) => r.key === 'share'));
  // The stream draws the card only for the shop's line.
  const stream = read('app/_components/chat-message-stream.tsx');
  assert.match(stream, /const sharedTool = m\.sender_role === 'vendor' \? toolShareFromLine\(m\.body\) : null;/);
  assert.match(stream, /<ToolShareCard[\s\S]{0,200}approved=\{approvedShares\.has\(m\.message_id\)\}/);
});
