/**
 * ＋ ONE (+) AT A TIME, AND ITS ROWS ARE THE APPROVED ONES (Supplier Build 3 · lane B; DECISION_LOG 📌 2026-11-08 and
 * the 9 Nov "Report a problem back into the (+)" ruling).
 *
 * What would silently undo it:
 *   1. a row the prototype names drops out, changes order, or Report a problem stops being LAST on both sides;
 *   2. what the app pins by itself (booking ask, confirm a payment, call time, guest count) creeps back in as a row;
 *   3. the (+) stays open while the reader's own card is open — or SHUTS on the other side's card;
 *   4. a card wears a glyph of its own instead of its topic's.
 *
 * Run: cd apps/web && npx tsx --test lib/chat-plus.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { PLUS_CARD_TOPIC, hostPlusRows, plusGate, supplierPlusRows, type RunningTopic } from './chat-plus';
import { CHAT_TOPICS } from './topic-icons';

test('1 · supplier rows: Quote · Payment · Meeting · Form · Photos & files · Decision · Report a problem', () => {
  assert.deepEqual(
    supplierPlusRows({ paid: false }).map((r) => r.label),
    ['Quote', 'Payment', 'Meeting', 'Form', 'Photos & files', 'Decision', 'Report a problem'],
  );
  assert.equal(supplierPlusRows({ paid: true })[0]!.label, 'Change quote');
  const photos = supplierPlusRows({ paid: false }).find((r) => r.key === 'photos')!;
  assert.equal(photos.line, 'From your portfolio, or a file from your phone');
});

test('1b · host rows: Meeting · Log a payment · File · Decision · Report a problem (no Log a payment without the right)', () => {
  assert.deepEqual(
    hostPlusRows({ canLogPayment: true }).map((r) => r.label),
    ['Meeting', 'Log a payment', 'File', 'Decision', 'Report a problem'],
  );
  assert.deepEqual(
    hostPlusRows({ canLogPayment: false }).map((r) => r.label),
    ['Meeting', 'File', 'Decision', 'Report a problem'],
  );
});

test('1c · a row that cannot open yet is shut with its reason — never hidden', () => {
  const shut = supplierPlusRows({ paid: false }).filter((r) => r.shutUntilAgreement);
  assert.deepEqual(shut.map((r) => r.key), ['payment', 'form']);
  for (const r of shut) assert.ok(r.shutUntilAgreement!.reason.length > 0);
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
