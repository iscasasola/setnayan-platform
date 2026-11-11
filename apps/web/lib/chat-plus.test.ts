/**
 * ＋ ONE (+) AT A TIME, AND ITS ROWS ARE THE APPROVED ONES — IN THE MENU'S ORDER (Supplier Build 3 · lane B;
 * DECISION_LOG 📌 2026-11-08 · the 9 Nov "Report a problem back into the (+)" ruling · 2026-11-11 "THE PICKED-CLIENT
 * MENU AND THE CHAT (+) FOLLOW ONE ORDER").
 *
 * What would silently undo it:
 *   1. a row the prototype names drops out, changes order, or Report a problem stops being LAST on both sides;
 *   1d. the (+) and the picked client's menu drift apart — a row sits under a page that comes LATER in the menu than the
 *       page of the row above it (the order is DERIVED here from `PICKED_CLIENT_PAGES`, never hand-copied), or a row
 *       names a page the menu does not have;
 *   1e. the dupe comes back — two rows on the supplier's (+) that both pick from the phone's gallery (owner 11 Nov:
 *       *"The (+) has dupes?"*), or the one Photos & files row stops saying it takes the phone's photos;
 *   2. what the app pins by itself (booking ask, confirm a payment, call time, guest count) creeps back in as a row;
 *   3. the (+) stays open while the reader's own card is open — or SHUTS on the other side's card;
 *   4. a card wears a glyph of its own instead of its topic's.
 *
 * SABOTAGE (11 Nov): swapping Quote above Ask for access in `supplierPlusRows` → 1 and 1d RED; mapping `decision` to
 * 'files' in `PLUS_ROW_PAGE` → 1d RED; adding a `photo` row back to the supplier → 1e RED.
 *
 * Run: cd apps/web && npx tsx --test lib/chat-plus.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  NEGOTIATE_GROUP,
  ONE_POLL_REASON,
  PLUS_CARD_TOPIC,
  PLUS_ROW_PAGE,
  filterSlash,
  hostPlusRows,
  plusGate,
  slashPick,
  slashQuery,
  sheetSlashRows,
  slashRows,
  supplierPlusRows,
  type PlusRow,
  type RunningTopic,
} from './chat-plus';
import { CHAT_TOPICS } from './topic-icons';
import type { PickedClientPage } from './upcoming-schedule-door';
import { PICKED_CLIENT_PAGES } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu';

test('1 · supplier rows: Negotiate (Change quote · Propose a payment plan · See every version) · Decision · Poll · Ask for access · Payment · Form · Meeting · Camera · Photos & files · Report a problem', () => {
  assert.deepEqual(
    supplierPlusRows({ paid: false }).map((r) => r.label),
    ['Change quote', 'Propose a payment plan', 'See every version', 'Decision', 'Poll', 'Ask for access', 'Payment', 'Form', 'Meeting', 'Camera', 'Photos & files', 'Report a problem'],
  );
  assert.equal(supplierPlusRows({ paid: true }).find((r) => r.key === 'quote')!.line, 'A new version · the paid one is the floor');
  const photos = supplierPlusRows({ paid: false }).find((r) => r.key === 'photos')!;
  assert.equal(photos.line, 'From your phone or your portfolio');
  assert.equal(photos.card, 'photos', 'Photos & files drops the card whose phone path is the composer’s own picker');
  const camera = supplierPlusRows({ paid: false }).find((r) => r.key === 'camera')!;
  assert.equal(camera.attach, 'camera', 'Camera opens the composer’s camera input inside the tap');
  assert.equal(camera.card, null);
});

const HOST_NEGOTIATE = ['Ask for a change', 'Counter with a price', 'Propose a payment plan', 'See every version'];

test('1b · host rows: Negotiate · Decision · Poll · Log a payment · Meeting · Camera · Photos & files · Report a problem (no Log a payment without the right)', () => {
  assert.deepEqual(
    hostPlusRows({ canLogPayment: true }).map((r) => r.label),
    [...HOST_NEGOTIATE, 'Decision', 'Poll', 'Log a payment', 'Meeting', 'Camera', 'Photos & files', 'Report a problem'],
  );
  assert.deepEqual(
    hostPlusRows({ canLogPayment: false }).map((r) => r.label),
    [...HOST_NEGOTIATE, 'Decision', 'Poll', 'Meeting', 'Camera', 'Photos & files', 'Report a problem'],
  );
  // 11 Nov (the host's side of the dupe, mirrored from the supplier's): ONE phone picker — Photos & files (the approved prototype's word, the supplier's own), which says so.
  const host = hostPlusRows({ canLogPayment: true });
  assert.deepEqual(
    host.filter((r) => r.attach === 'photo' || r.card === 'file' || r.card === 'photos').map((r) => r.key),
    ['file'],
    'two rows on the host’s (+) pick from the phone again — the 11 Nov dupe',
  );
  assert.match(host.find((r) => r.key === 'file')!.line, /phone/i, 'File no longer says it takes the phone’s files');
});

test('1c · a row that cannot open yet is shut with its reason — never hidden', () => {
  const shut = supplierPlusRows({ paid: false }).filter((r) => r.shutUntilAgreement);
  // Ask for access is the shipped ask, which is for a supplier booked on the event (chat gaps, 8 Nov).
  assert.deepEqual(shut.map((r) => r.key), ['access', 'payment', 'form']);
  for (const r of shut) assert.ok(r.shutUntilAgreement!.reason.length > 0);
});

/** The menu's order, read from the menu itself — the one list the sheet's groups are the mirror of. */
const MENU_ORDER: readonly PickedClientPage[] = PICKED_CLIENT_PAGES.map((p) => p.id);
/** The rows UNDER the menu's mirror — everything after the Negotiate group (which sits above the mirror, 12 Nov). */
function menuRows(rows: readonly PlusRow[]): PlusRow[] {
  return rows.filter((r) => PLUS_ROW_PAGE[r.key] !== NEGOTIATE_GROUP);
}
function pagesOf(rows: PlusRow[]): PickedClientPage[] {
  return menuRows(rows).map((r) => PLUS_ROW_PAGE[r.key] as PickedClientPage);
}

test('1d · the (+) follows the menu: every row’s page is in the menu, in the menu’s order, Report last — both sides', () => {
  for (const [side, rows] of [
    ['supplier', supplierPlusRows({ paid: false })],
    ['supplier · paid', supplierPlusRows({ paid: true })],
    ['host', hostPlusRows({ canLogPayment: true })],
    ['host · coordinator', hostPlusRows({ canLogPayment: false })],
  ] as const) {
    const pages = pagesOf([...rows]);
    const under = menuRows(rows);
    for (const p of pages) assert.ok(MENU_ORDER.includes(p), `${side}: a (+) row sits under '${p}', which is not a page of the picked client`);
    const ranks = pages.map((p) => MENU_ORDER.indexOf(p));
    for (let i = 1; i < ranks.length; i++) {
      assert.ok(
        ranks[i]! >= ranks[i - 1]!,
        `${side}: '${under[i]!.label}' (${pages[i]}) is drawn above the menu's order — after '${under[i - 1]!.label}' (${pages[i - 1]})`,
      );
    }
    assert.equal(rows.at(-1)!.key, 'report', `${side}: Report a problem is not last`);
    assert.equal(PLUS_ROW_PAGE.report, 'report');
  }
  // The expected order, DERIVED: stable-sort the rows under the mirror by the menu and they must already be in that order.
  const rows = menuRows(supplierPlusRows({ paid: false }));
  const rank = (r: PlusRow) => MENU_ORDER.indexOf(PLUS_ROW_PAGE[r.key] as PickedClientPage);
  const derived = [...rows].sort((a, b) => rank(a) - rank(b));
  assert.deepEqual(rows.map((r) => r.key), derived.map((r) => r.key));
  // The words the sheet draws over the groups are the tabs' own (Chat · Details · Payment · Forms · Schedule · Files ·
  // Report) — Quotation's one row, Change quote, moved up into Negotiate on 12 Nov.
  const groups = [...new Set(pagesOf(rows))].map((p) => PICKED_CLIENT_PAGES.find((m) => m.id === p)!.label);
  assert.deepEqual(groups, ['Chat', 'Details', 'Payment', 'Forms', 'Schedule', 'Files', 'Report']);
});

test('1e · ONE phone picker on the supplier’s (+): Photos & files takes the phone’s photos and videos; Camera is the other act', () => {
  const rows = supplierPlusRows({ paid: false });
  const fromPhone = rows.filter((r) => r.attach === 'photo' || r.card === 'photos' || r.card === 'file');
  assert.deepEqual(fromPhone.map((r) => r.key), ['photos'], 'two rows pick from the phone again — the 11 Nov dupe');
  assert.match(rows.find((r) => r.key === 'photos')!.line, /phone/i, 'the merged row no longer says it takes the phone’s files');
  assert.equal(rows.filter((r) => r.attach === 'camera').length, 1, 'Camera (take one now) stays — it is a different act');
  assert.ok(!rows.some((r) => r.key === 'photo'), 'the separate Photo row is back');
});

test('2 · what pins by itself is NOT a (+) row', () => {
  const all = [...supplierPlusRows({ paid: false }), ...hostPlusRows({ canLogPayment: true })].map((r) => r.label.toLowerCase());
  for (const gone of ['answer their booking ask', 'confirm a payment', 'your call time', 'guest count changed', 'won', 'lost']) {
    assert.ok(!all.some((l) => l.includes(gone)), gone);
  }
});

test('3 · the gate shuts the (+) for the card\'s opener only, with the words the tap shows', () => {
  const mine: RunningTopic = { key: 'k', card: 'meeting', title: 'Meeting', by: 'you', status: 'draft', anchorId: 'a' };
  assert.deepEqual(plusGate(null), { shut: false });
  assert.deepEqual(plusGate(mine), { shut: true, message: 'Finish or close: Meeting' });
  assert.deepEqual(plusGate({ ...mine, status: 'sent' }), { shut: true, message: 'Finish or close: Meeting' });
  assert.deepEqual(plusGate({ ...mine, by: 'them' }), { shut: false });
});

test('4 · every card wears a known topic (its icon is TOPIC_ICON[topic])', () => {
  for (const [card, topic] of Object.entries(PLUS_CARD_TOPIC)) {
    assert.ok((CHAT_TOPICS as readonly string[]).includes(topic), `${card} → ${topic}`);
  }
  assert.equal(PLUS_CARD_TOPIC.meeting, 'schedule');
  assert.equal(PLUS_CARD_TOPIC.photos, 'files');
});

// ── 🗳 THE POLL ROW AND ⌨ THE SLASH LIST (owner 11 Nov 2026) ─────────────────────────────────────────────────────────
// What would silently undo it:
//   5. the Poll row stops sitting under Chat right after Decision on either side, or stops going grey (with its reason,
//      never hidden) while a poll is open — or goes grey when none is;
//   6. the slash list stops being the (+)'s own rows: a card row missing, an extra row, another order, other words, or a
//      shut row losing its reason;
//   7. Enter picks a greyed row.
// SABOTAGE (11 Nov): dropping `pollRow(opts.pollOpen)` from hostPlusRows → 1b and 5 RED; `shutNow` ignored in slashRows
// → 6 and 7 RED.

test('5 · the Poll row: under Chat right after Decision on both sides, greyed with its reason only while a poll is open', () => {
  for (const [side, rowsOf] of [
    ['supplier', (pollOpen: boolean) => supplierPlusRows({ paid: false, pollOpen })],
    ['host', (pollOpen: boolean) => hostPlusRows({ canLogPayment: true, pollOpen })],
  ] as const) {
    const free = menuRows(rowsOf(false));
    assert.deepEqual(free.slice(0, 2).map((r) => r.key), ['decision', 'poll'], `${side}: Poll is not right after Decision`);
    assert.equal(PLUS_ROW_PAGE.poll, 'chat');
    const poll = free.find((r) => r.key === 'poll')!;
    assert.equal(poll.card, 'poll');
    assert.equal(poll.shutNow, undefined, `${side}: the Poll row is shut with no poll open`);
    const held = rowsOf(true).find((r) => r.key === 'poll')!;
    assert.deepEqual(held.shutNow, { reason: ONE_POLL_REASON }, `${side}: the Poll row is not greyed while a poll is open`);
    assert.equal(ONE_POLL_REASON, 'One poll at a time · close the open one first');
    // Only the Poll row — an open poll shuts nothing else.
    assert.deepEqual(rowsOf(true).filter((r) => r.shutNow).map((r) => r.key), ['poll']);
  }
  // A SENT poll never keeps the (+) shut — only the draft is a running card (the 8 Nov rule).
  assert.equal(PLUS_CARD_TOPIC.poll, 'poll');
});

test('6 · the slash list IS the (+): the same card rows, order, words and reasons — both sides, every state', () => {
  const cases = [
    ['supplier · asked', supplierPlusRows({ paid: false }), false],
    ['supplier · booked', supplierPlusRows({ paid: false }), true],
    ['supplier · paid · poll open', supplierPlusRows({ paid: true, pollOpen: true }), true],
    ['host', hostPlusRows({ canLogPayment: true }), true],
    ['host · coordinator · poll open', hostPlusRows({ canLogPayment: false, pollOpen: true }), true],
  ] as const;
  for (const [side, rows, booked] of cases) {
    const list = slashRows(rows, booked);
    const cards = rows.filter((r) => r.card);
    assert.deepEqual(list.map((r) => r.key), cards.map((r) => r.key), `${side}: the slash list is not the (+)'s card rows in order`);
    assert.deepEqual(list.map((r) => r.label), cards.map((r) => r.label), `${side}: other words`);
    assert.deepEqual(list.map((r) => r.line), cards.map((r) => r.line), `${side}: other lines`);
    for (const [i, r] of cards.entries()) {
      const want = r.shutNow ?? (r.shutUntilAgreement && !booked ? r.shutUntilAgreement : null);
      assert.deepEqual(list[i]!.shut, want, `${side}: '${r.label}' shut reason differs from the (+)`);
    }
  }
  // The composer's list is published from the rows the (+) SHEET draws (its shut already decided) — the same list.
  for (const [side, rows, booked] of cases) {
    const drawn = rows.map((r) => ({ ...r, shut: r.shutNow ?? (r.shutUntilAgreement && !booked ? r.shutUntilAgreement : null) }));
    assert.deepEqual(sheetSlashRows(drawn), slashRows(rows, booked), `${side}: the composer's list is not the sheet's`);
  }
  // The words the ruling names (M14 + /meeting /decision /poll), Negotiate's first (12 Nov: /quote · /plan; the hosts' /ask · /counter).
  assert.deepEqual(slashRows(supplierPlusRows({ paid: false }), true).map((r) => `/${r.word}`), [
    '/quote', '/plan', '/decision', '/poll', '/access', '/payment', '/form', '/meeting', '/file',
  ]);
  assert.deepEqual(slashRows(hostPlusRows({ canLogPayment: true }), true).slice(0, 3).map((r) => `/${r.word}`), ['/ask', '/counter', '/plan']);
  // "/p" → Propose a payment plan (its word /plan) · Poll · Payment · Photos & files.
  assert.deepEqual(filterSlash(slashRows(supplierPlusRows({ paid: false }), false), 'p').map((r) => r.label), ['Propose a payment plan', 'Poll', 'Payment', 'Photos & files']);
  assert.equal(slashQuery('/po'), 'po');
  assert.equal(slashQuery('/'), '');
  assert.equal(slashQuery('hello /poll'), null, 'a slash that is not the first character is just a character');
  assert.equal(slashQuery('/poll now'), null, 'a space ends the shortcut');
});

test('7 · Enter never picks a greyed row', () => {
  const asked = slashRows(supplierPlusRows({ paid: false, pollOpen: true }), false);
  const byKey = (k: string) => asked.findIndex((r) => r.key === k);
  assert.equal(slashPick(asked, byKey('poll')), null, 'Enter opened a second poll');
  assert.equal(slashPick(asked, byKey('payment')), null, 'Enter picked a row shut until they book you');
  assert.equal(slashPick(asked, byKey('decision')), 'decision');
  assert.equal(slashPick(asked, 99), null);
});

// ── 🤝 NEGOTIATE IS FIRST ON BOTH SIDES (approved design 12 Nov · Piece 1 · PR-3) ──────────────────────────────────────
// What would silently undo it: a Negotiate row slides below a page group, a page row climbs above Negotiate, or a row
// the design names leaves the group. SABOTAGE (12 Nov): moving the supplier's Change quote back under Decision → 8 RED;
// mapping `counter` to 'payments' in PLUS_ROW_PAGE → 8 RED.
test('8 · Negotiate is FIRST on both (+) menus, holding exactly the design’s rows', () => {
  for (const [side, rows, want] of [
    ['supplier', supplierPlusRows({ paid: false }), ['Change quote', 'Propose a payment plan', 'See every version']],
    ['supplier · paid', supplierPlusRows({ paid: true }), ['Change quote', 'Propose a payment plan', 'See every version']],
    ['host', hostPlusRows({ canLogPayment: true }), HOST_NEGOTIATE],
    ['host · coordinator', hostPlusRows({ canLogPayment: false }), HOST_NEGOTIATE],
  ] as const) {
    const groups = rows.map((r) => PLUS_ROW_PAGE[r.key]);
    const n = groups.filter((g) => g === NEGOTIATE_GROUP).length;
    assert.ok(n > 0, `${side}: no Negotiate group`);
    assert.deepEqual(groups.slice(0, n), Array(n).fill(NEGOTIATE_GROUP), `${side}: Negotiate is not the first group`);
    assert.ok(!groups.slice(n).includes(NEGOTIATE_GROUP), `${side}: a Negotiate row sits below a page group`);
    assert.deepEqual(rows.slice(0, n).map((r) => r.label), [...want], `${side}: the Negotiate rows differ from the design`);
  }
  // Every Negotiate card row drops a card; See every version presses the shipped versions sheet.
  const v = hostPlusRows({ canLogPayment: true }).find((r) => r.key === 'versions')!;
  assert.equal(v.card, null);
  assert.equal(v.act, 'versions');
});
