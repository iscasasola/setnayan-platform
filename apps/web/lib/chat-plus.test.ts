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

import { PLUS_CARD_TOPIC, PLUS_ROW_PAGE, hostPlusRows, plusGate, supplierPlusRows, type PlusRow, type RunningTopic } from './chat-plus';
import { CHAT_TOPICS } from './topic-icons';
import type { PickedClientPage } from './upcoming-schedule-door';
import { PICKED_CLIENT_PAGES } from '@/app/vendor-dashboard/clients/[eventId]/_components/picked-client-menu';

test('1 · supplier rows: Decision · Ask for access · Quote · Payment · Form · Meeting · Camera · Photos & files · Report a problem', () => {
  assert.deepEqual(
    supplierPlusRows({ paid: false }).map((r) => r.label),
    ['Decision', 'Ask for access', 'Quote', 'Payment', 'Form', 'Meeting', 'Camera', 'Photos & files', 'Report a problem'],
  );
  assert.equal(supplierPlusRows({ paid: true }).find((r) => r.key === 'quote')!.label, 'Change quote');
  const photos = supplierPlusRows({ paid: false }).find((r) => r.key === 'photos')!;
  assert.equal(photos.line, 'From your phone or your portfolio');
  assert.equal(photos.card, 'photos', 'Photos & files drops the card whose phone path is the composer’s own picker');
  const camera = supplierPlusRows({ paid: false }).find((r) => r.key === 'camera')!;
  assert.equal(camera.attach, 'camera', 'Camera opens the composer’s camera input inside the tap');
  assert.equal(camera.card, null);
});

test('1b · host rows: Decision · Log a payment · Meeting · Camera · Photo · File · Report a problem (no Log a payment without the right)', () => {
  assert.deepEqual(
    hostPlusRows({ canLogPayment: true }).map((r) => r.label),
    ['Decision', 'Log a payment', 'Meeting', 'Camera', 'Photo', 'File', 'Report a problem'],
  );
  assert.deepEqual(
    hostPlusRows({ canLogPayment: false }).map((r) => r.label),
    ['Decision', 'Meeting', 'Camera', 'Photo', 'File', 'Report a problem'],
  );
  assert.equal(hostPlusRows({ canLogPayment: true }).find((r) => r.key === 'photo')!.attach, 'photo');
});

test('1c · a row that cannot open yet is shut with its reason — never hidden', () => {
  const shut = supplierPlusRows({ paid: false }).filter((r) => r.shutUntilAgreement);
  // Ask for access is the shipped ask, which is for a supplier booked on the event (chat gaps, 8 Nov).
  assert.deepEqual(shut.map((r) => r.key), ['access', 'payment', 'form']);
  for (const r of shut) assert.ok(r.shutUntilAgreement!.reason.length > 0);
});

/** The menu's order, read from the menu itself — the one list the sheet's groups are the mirror of. */
const MENU_ORDER: readonly PickedClientPage[] = PICKED_CLIENT_PAGES.map((p) => p.id);
function pagesOf(rows: PlusRow[]): PickedClientPage[] {
  return rows.map((r) => PLUS_ROW_PAGE[r.key]);
}

test('1d · the (+) follows the menu: every row’s page is in the menu, in the menu’s order, Report last — both sides', () => {
  for (const [side, rows] of [
    ['supplier', supplierPlusRows({ paid: false })],
    ['supplier · paid', supplierPlusRows({ paid: true })],
    ['host', hostPlusRows({ canLogPayment: true })],
    ['host · coordinator', hostPlusRows({ canLogPayment: false })],
  ] as const) {
    const pages = pagesOf([...rows]);
    for (const p of pages) assert.ok(MENU_ORDER.includes(p), `${side}: a (+) row sits under '${p}', which is not a page of the picked client`);
    const ranks = pages.map((p) => MENU_ORDER.indexOf(p));
    for (let i = 1; i < ranks.length; i++) {
      assert.ok(
        ranks[i]! >= ranks[i - 1]!,
        `${side}: '${rows[i]!.label}' (${pages[i]}) is drawn above the menu's order — after '${rows[i - 1]!.label}' (${pages[i - 1]})`,
      );
    }
    assert.equal(rows.at(-1)!.key, 'report', `${side}: Report a problem is not last`);
    assert.equal(PLUS_ROW_PAGE.report, 'report');
  }
  // The expected order, DERIVED: stable-sort the rows by the menu and they must already be in that order.
  const rows = supplierPlusRows({ paid: false });
  const derived = [...rows].sort((a, b) => MENU_ORDER.indexOf(PLUS_ROW_PAGE[a.key]) - MENU_ORDER.indexOf(PLUS_ROW_PAGE[b.key]));
  assert.deepEqual(rows.map((r) => r.key), derived.map((r) => r.key));
  // The words the sheet draws over the groups are the tabs' own (Chat · Details · Quotation · Payment · Forms · Schedule · Files · Report).
  const groups = [...new Set(pagesOf(rows))].map((p) => PICKED_CLIENT_PAGES.find((m) => m.id === p)!.label);
  assert.deepEqual(groups, ['Chat', 'Details', 'Quotation', 'Payment', 'Forms', 'Schedule', 'Files', 'Report']);
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
