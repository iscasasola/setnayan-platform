/**
 * A PESO AMOUNT GETS ITS COMMAS AS IT IS TYPED (owner 2026-10-30: "cannot place commas because it only shows number pad
 * now with period"). The number pad has no comma key, so the field puts them in — and saves the plain number.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatPesoTyping, pesoTypedNumber } from './peso-as-you-type';
import { planAmountNumber } from './self-added-payment-plan';
import { amountDigits } from './form-row';

describe('the words', () => {
  it('100000 → "100,000"', () => assert.equal(formatPesoTyping('100000').text, '100,000'));
  it('"1000000.5" → "1,000,000.5"', () => assert.equal(formatPesoTyping('1000000.5').text, '1,000,000.5'));
  it('pasting "₱295,000" still works', () => assert.equal(formatPesoTyping('₱295,000').text, '295,000'));
  it('one point, two centavo digits, no leading zeros', () => {
    assert.equal(formatPesoTyping('12.3.45').text, '12.34');
    assert.equal(formatPesoTyping('007').text, '7');
    assert.equal(formatPesoTyping('.5').text, '0.5');
  });
  it('whole pesos only (the price): no point at all', () => assert.equal(formatPesoTyping('80000.50', undefined, 0).text, '8,000,050'));
});

describe('the caret stays where the digit went', () => {
  it('typing at the end stays at the end', () => {
    const r = formatPesoTyping('1000', 4);
    assert.deepEqual(r, { text: '1,000', caret: 5 });
  });
  it('typing in the middle stays in the middle', () => {
    // "1,000" with a 5 typed after the 1 → raw "15,000", caret 2 → "15,000", caret after the 5
    const r = formatPesoTyping('15,000', 2);
    assert.equal(r.text, '15,000');
    assert.equal(r.text.slice(0, r.caret).replace(/,/g, ''), '15');
  });
  it('deleting a comma-neighbour keeps the caret on its digit', () => {
    const r = formatPesoTyping('100,00', 3);
    assert.equal(r.text, '10,000');
    assert.equal(r.text.slice(0, r.caret).replace(/,/g, ''), '100');
  });
});

describe('what is saved is the plain number', () => {
  for (const shown of ['100,000', '1,000,000.5', '295,000']) {
    it(`"${shown}"`, () => {
      const n = pesoTypedNumber(shown);
      assert.equal(typeof n, 'number');
      assert.equal(n, Number(shown.replace(/,/g, '')));
      assert.equal(planAmountNumber(shown), n, 'the plan save reads it differently');
    });
  }
  it('the price row keeps the digits', () => assert.equal(amountDigits('100,000'), '100000'));
});
