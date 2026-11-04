/**
 * a-worth-box-has-no-spinner.test.ts — 🔒 "What's included" asks each line's peso worth in a box with NO native number
 * spinner, and the box still takes only a number.
 *
 * Walk 2026-11-01 (card maker, "What's included · One line is enough"): the "worth ₱" box was `type="number"`, so a
 * desktop browser drew ▲▼ arrows inside a 120-px box (and a scroll-wheel over it nudged the price). The property, on
 * the REAL rendered editor in both its shapes (the maker's bare rows and the older fold):
 *   · no worth box is `type="number"` (that type is what draws the spinner);
 *   · each one still opens the numeric keypad (`inputmode="numeric"`) and accepts only digits (`pattern`), which is
 *     what `parseInclusionRows` (services/actions.ts) insists on: a non-negative whole number of pesos.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { renderToStaticMarkup } from 'react-dom/server';
import React from 'react';
import { InclusionsEditor } from './service-list-editors';

(globalThis as unknown as { React: unknown }).React = React;

const worthBoxes = (html: string) => [...html.matchAll(/<input[^>]*name="inclusion_worth"[^>]*>/g)].map((m) => m[0]);

test('the maker’s rows: the worth is an amount row of the Field template — ₱, whole pesos, no spinner', () => {
  // 1 Nov 2026: the maker's lines became rows of the ONE Field template (`TypedRow`). The worth is an AMOUNT row: the pill
  // shows ₱ with commas, the open field takes the numeric keypad and keeps only digits (`amountDigits`), and the form
  // hears the digits through the row's hidden carrier. No `<input type="number">` anywhere, so no spinner.
  const html = renderToStaticMarkup(
    React.createElement(InclusionsEditor, { bare: true, initial: [{ label: 'Same-day edit', worth: '5000' }, { label: 'Drone', worth: '' }] }),
  );
  const boxes = worthBoxes(html);
  assert.equal(boxes.length, 2, `expected a worth carrier per line, found ${boxes.length}`);
  for (const b of boxes) {
    assert.match(b, /type="hidden"/, `a maker worth is a raw box again, not the Field row's carrier: ${b}`);
    const value = /value="([^"]*)"/.exec(b)?.[1] ?? '';
    assert.match(value, /^\d*$/, `a maker worth carries something other than whole pesos: ${b}`);
  }
  assert.doesNotMatch(html, /type="number"/, 'a spinner box is back in the maker');
  assert.match(html, /₱5,000/, 'the worth row does not show its amount with ₱');
  assert.equal([...html.matchAll(/data-form-row="inclusion-worth"/g)].length, 2, 'a line lost its worth row');
});

test('the fold: the worth box is numeric without a spinner', () => {
  const html = renderToStaticMarkup(
    React.createElement(InclusionsEditor, { bare: false, initial: [{ label: 'Same-day edit', worth: '5000' }, { label: 'Drone', worth: '' }] }),
  );
  const boxes = worthBoxes(html);
  assert.equal(boxes.length, 2, `expected a worth box per line, found ${boxes.length}`);
  for (const b of boxes) {
    assert.ok(!/type="number"/.test(b), `a worth box is type="number" — the browser draws a spinner in it: ${b}`);
    assert.ok(/inputMode="numeric"|inputmode="numeric"/.test(b), `a worth box lost the numeric keypad: ${b}`);
    const pattern = /pattern="([^"]*)"/.exec(b)?.[1];
    assert.ok(pattern, `a worth box takes any text: ${b}`);
    const re = new RegExp(`^(?:${pattern})$`);
    assert.ok(re.test('5000') && !re.test('5k') && !re.test('-1') && !re.test('1.5'), `pattern "${pattern}" is not whole pesos`);
  }
});
