import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  adminStatusWord,
  cardMayFollow,
  cardsMoveLine,
  decisionProblem,
  noticeLine,
  othersPlace,
  placeOf,
  sameNameKey,
  serviceNameProblem,
  shopsAskingByName,
  splitWaitingDecided,
  STATUS_FOR_CHOICE,
  supplierStatusWord,
  unseenDecision,
} from './service-requests';

test('the supplier reads the owner’s five words, one per status', () => {
  assert.equal(supplierStatusWord('pending', null).word, 'Waiting');
  assert.equal(supplierStatusWord('promoted', null).word, 'Added as a new service');
  assert.equal(supplierStatusWord('mapped', 'Kakanin').word, 'Moved to “Kakanin”');
  assert.equal(supplierStatusWord('kept_private', null).word, 'Kept just for your shop');
  assert.equal(supplierStatusWord('rejected', null).word, 'Not added');
  // Five statuses, five different tones — a colour never carries two meanings here.
  const tones = new Set(['pending', 'promoted', 'mapped', 'kept_private', 'rejected'].map((s) => supplierStatusWord(s as never, 'x').tone));
  assert.equal(tones.size, 5);
  assert.equal(adminStatusWord('pending').word, 'Pending');
});

test('"<category> › Others" is drawn from the request, never a taxonomy row', () => {
  assert.equal(othersPlace('Make & Take'), 'Make & Take › Others');
  const base = { categoryLabel: 'Make & Take', decided: { categoryLabel: 'Food Carts', serviceLabel: 'Kakanin' } };
  assert.equal(placeOf({ ...base, status: 'pending' }), 'Make & Take › Others');
  assert.equal(placeOf({ ...base, status: 'kept_private' }), 'Make & Take › Others');
  assert.equal(placeOf({ ...base, status: 'rejected' }), 'Make & Take › Others');
  assert.equal(placeOf({ ...base, status: 'mapped' }), 'Food Carts › Kakanin');
  assert.equal(placeOf({ ...base, status: 'promoted' }), 'Food Carts › Kakanin');
  // A decided request whose service no longer resolves still says somewhere true.
  assert.equal(placeOf({ ...base, status: 'mapped', decided: null }), 'Make & Take › Others');
});

test('the same name ignores case and spacing, nothing else', () => {
  assert.equal(sameNameKey('  Kakanin   Bilao '), 'kakanin bilao');
  assert.equal(sameNameKey('KAKANIN bilao'), sameNameKey('kakanin Bilao'));
  assert.notEqual(sameNameKey('Kakanin bilao'), sameNameKey('Kakanin bilaos'));
});

test('a service name is 2–80 characters, like the table’s own CHECK', () => {
  assert.ok(serviceNameProblem(' a '));
  assert.equal(serviceNameProblem('ab'), null);
  assert.equal(serviceNameProblem('x'.repeat(80)), null);
  assert.ok(serviceNameProblem('x'.repeat(81)));
});

test('every decision is checked before anything is written', () => {
  const d = { name: '', tileId: '', target: '', note: '' };
  assert.match(decisionProblem({ ...d, choice: 'add' }) ?? '', /name/);
  assert.match(decisionProblem({ ...d, choice: 'add', name: 'Kakanin' }) ?? '', /category/);
  assert.equal(decisionProblem({ ...d, choice: 'add', name: 'Kakanin', tileId: 'food_carts' }), null);
  assert.match(decisionProblem({ ...d, choice: 'move' }) ?? '', /service to move to/);
  assert.equal(decisionProblem({ ...d, choice: 'move', target: 'kakanin' }), null);
  assert.equal(decisionProblem({ ...d, choice: 'keep' }), null);
  // Not added needs a reason the supplier can read.
  assert.match(decisionProblem({ ...d, choice: 'no' }) ?? '', /reason/);
  assert.match(decisionProblem({ ...d, choice: 'no', note: '   ' }) ?? '', /reason/);
  assert.equal(decisionProblem({ ...d, choice: 'no', note: 'Not listed on Setnayan.' }), null);
  assert.match(decisionProblem({ ...d, choice: 'keep', note: 'x'.repeat(401) }) ?? '', /400/);
  // The four choices write the four shipped outcomes.
  assert.deepEqual(Object.values(STATUS_FOR_CHOICE).sort(), ['kept_private', 'mapped', 'promoted', 'rejected']);
});

test('the cards line says how many move and from where to where — or that they stay', () => {
  assert.equal(cardsMoveLine(2, 'Make & Take › Others', 'Food Carts › Kakanin'), '2 cards move from Make & Take › Others to Food Carts › Kakanin.');
  assert.equal(cardsMoveLine(1, 'A › Others', 'B › C'), '1 card moves from A › Others to B › C.');
  assert.equal(cardsMoveLine(3, 'A › Others', 'A › Others'), '3 cards stay under A › Others.');
  assert.equal(cardsMoveLine(3, 'A › Others', null), '3 cards stay under A › Others.');
  assert.match(cardsMoveLine(0, 'A › Others', 'B › C'), /No cards to move/);
});

test('🔒 a card follows a decision only when its shop filed the request', () => {
  assert.equal(cardMayFollow({ vendor_profile_id: 'v1' }, { proposed_by_vendor_id: 'v1' }), true);
  assert.equal(cardMayFollow({ vendor_profile_id: 'v2' }, { proposed_by_vendor_id: 'v1' }), false);
  assert.equal(cardMayFollow({ vendor_profile_id: '' }, { proposed_by_vendor_id: '' }), false);
});

test('Waiting first, then Decided; the notice is the newest unseen decision', () => {
  const rows = [
    { id: 'a', status: 'pending' as const, created_at: '2026-11-10', reviewed_at: null, supplier_seen_at: null },
    { id: 'b', status: 'mapped' as const, created_at: '2026-11-01', reviewed_at: '2026-11-12', supplier_seen_at: null },
    { id: 'c', status: 'rejected' as const, created_at: '2026-11-02', reviewed_at: '2026-11-11', supplier_seen_at: null },
    { id: 'd', status: 'pending' as const, created_at: '2026-11-12', reviewed_at: null, supplier_seen_at: null },
    { id: 'e', status: 'promoted' as const, created_at: '2026-11-03', reviewed_at: '2026-11-13', supplier_seen_at: '2026-11-13' },
  ];
  const { waiting, decided } = splitWaitingDecided(rows);
  assert.deepEqual(waiting.map((r) => r.id), ['d', 'a']);
  assert.deepEqual(decided.map((r) => r.id), ['e', 'b', 'c']);
  assert.equal(unseenDecision(rows)?.id, 'b');
  assert.equal(unseenDecision(rows.map((r) => ({ ...r, supplier_seen_at: 'x' }))), null);
});

test('the notice line names the outcome and where the cards are', () => {
  assert.match(noticeLine('promoted', 2, 'Food Carts › Kakanin'), /Your 2 cards now show under Food Carts › Kakanin/);
  assert.match(noticeLine('rejected', 1, 'Make & Take › Others'), /stay online under Make & Take › Others/);
  assert.match(noticeLine('kept_private', 1, 'X › Others'), /^Kept just for your shop/);
});

test('"n shops" counts distinct shops asking the same pending name', () => {
  const rows = [
    { proposed_label: 'Kakanin bilao', proposed_by_vendor_id: 'v1', status: 'pending' as const },
    { proposed_label: 'kakanin  BILAO', proposed_by_vendor_id: 'v2', status: 'pending' as const },
    { proposed_label: 'Kakanin bilao', proposed_by_vendor_id: 'v2', status: 'pending' as const },
    { proposed_label: 'Kakanin bilao', proposed_by_vendor_id: 'v3', status: 'rejected' as const },
  ];
  assert.equal(shopsAskingByName(rows).get('kakanin bilao')?.size, 2);
});
