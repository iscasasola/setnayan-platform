/**
 * change-order-notice.test.ts — a change in what the couple owes says how much,
 * from the row, and says it the same way to both sides.
 *
 * In-app notices (owner 2026-10-11: no new emails) —
 * `couple-supplier-notices-reach-email.test.ts` fails if one is emailed, and
 * its test 8 pins the four sites.
 * This file executes THE WORDS.
 *
 * SABOTAGE (each seen red, restored): print the figure with toLocaleString ·
 * show the figure on a decline · read the figure from the form.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  changeOrderAmountPhrase,
  changeOrderAnsweredNotice,
  changeOrderProposedNotice,
} from './change-order-notice';
import { formatPhp } from './php';

test('the figure is signed in words, through formatPhp, and absent when it is not known', () => {
  assert.equal(changeOrderAmountPhrase(5000), `adds ${formatPhp(5000)} to the total`);
  assert.equal(changeOrderAmountPhrase(-2500), `takes ${formatPhp(2500)} off the total`);
  // NUMERIC(12,2) can arrive as a string — and a centavo is never dropped or mis-spelled.
  assert.equal(changeOrderAmountPhrase('837.50'), 'adds ₱837.50 to the total');
  assert.equal(changeOrderAmountPhrase(1234567.5), 'adds ₱1,234,567.50 to the total');
  for (const unknown of [null, undefined, '', 'abc', 0, '0.00', Number.NaN]) {
    assert.equal(changeOrderAmountPhrase(unknown as never), '', `${String(unknown)} must print no figure`);
  }
});

test('proposed — the shipped sentence, with the row\'s figure when the row was read', () => {
  const row = { title: 'Extra hour of coverage', delta_amount_php: 5000 };
  assert.deepEqual(changeOrderProposedNotice({ from: 'couple', row, typedTitle: 'typed' }), {
    title: 'A couple proposed a change order',
    body: 'Extra hour of coverage (adds ₱5,000 to the total) — open the client to accept or decline.',
  });
  assert.deepEqual(
    changeOrderProposedNotice({ from: 'supplier', supplierName: ' Lente Studio ', row, typedTitle: 'typed' }),
    {
      title: 'Lente Studio proposed a change order',
      body: 'Extra hour of coverage (adds ₱5,000 to the total) — open the supplier to accept or decline.',
    },
  );
  // 🔑 The row could not be read: the notice still goes, names what was typed,
  // and prints NO figure — never the amount the form sent.
  assert.deepEqual(changeOrderProposedNotice({ from: 'couple', row: null, typedTitle: 'Extra hour' }), {
    title: 'A couple proposed a change order',
    body: 'Extra hour — open the client to accept or decline.',
  });
  assert.equal(changeOrderProposedNotice({ from: 'supplier', row: null, typedTitle: 'x' }).title, 'A supplier proposed a change order');
});

test('answered — a yes says what it moved; a no moves nothing and prints no figure', () => {
  const row = { title: 'Drop the second shooter', delta_amount_php: '-8000.00' };
  assert.deepEqual(changeOrderAnsweredNotice({ by: 'couple', decision: 'accept', row }), {
    title: 'Change order accepted',
    body: 'The couple accepted "Drop the second shooter" — it takes ₱8,000 off the total.',
  });
  assert.deepEqual(changeOrderAnsweredNotice({ by: 'supplier', decision: 'decline', row }), {
    title: 'Change order declined',
    body: 'Your supplier declined "Drop the second shooter".',
  });
  // Unreadable row: still a sentence.
  assert.equal(
    changeOrderAnsweredNotice({ by: 'supplier', decision: 'accept', row: null }).body,
    'Your supplier accepted "Change order".',
  );
});

test('no notice says "vendor", "celebration" or a bare peso figure', () => {
  const row = { title: 'Extra hour', delta_amount_php: 12500.5 };
  const all = [
    changeOrderProposedNotice({ from: 'couple', row, typedTitle: 't' }),
    changeOrderProposedNotice({ from: 'supplier', supplierName: 'Shop', row, typedTitle: 't' }),
    changeOrderAnsweredNotice({ by: 'couple', decision: 'accept', row }),
    changeOrderAnsweredNotice({ by: 'supplier', decision: 'accept', row }),
  ].flatMap((n) => [n.title, n.body]);
  for (const text of all) {
    assert.doesNotMatch(text, /vendor|celebration/i, text);
    // Every ₱ figure carries its commas and both centavo digits.
    for (const fig of text.match(/₱[\d,.]+/g) ?? []) assert.equal(fig.replace(/[.,]$/, ''), '₱12,500.50', text);
  }
});
