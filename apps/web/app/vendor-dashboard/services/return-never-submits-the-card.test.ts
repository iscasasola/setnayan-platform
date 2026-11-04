/**
 * return-never-submits-the-card.test.ts — RETURN MOVES ON; ONLY CREATE / SAVE SAVES.
 *
 * 🔴 Owner, iPhone, live, 2026-11-04: "after i placed the price, it finished". He typed the price, pressed the
 * keyboard's Return, and the browser's implicit submission CREATED the card (no cover, not live) in production.
 *
 * Pinned: (1) the card form wires the ONE form-level handler, (2) the handler's decision — which keys on which fields
 * move on — runs for real here, (3) every one-line field is told its Return key reads "next".
 * There is no DOM in this runner (`tsx --test`), so (1) and (3) are read from the source, comments stripped.
 *
 * Sabotage (2026-11-04): `onKeyDown={returnMovesOn}` removed from the form → "the card form stops Return" red;
 * `if (tagName !== 'INPUT') return false;` deleted → "a textarea keeps its new lines" red. Both restored green.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { returnShouldMoveOn } from '@/lib/return-moves-on';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const MAKER = stripComments(readFileSync(join(WEB, 'app/vendor-dashboard/services/_components/canvas-maker.tsx'), 'utf8'));

test('the maker source actually read back', () => {
  assert.ok(MAKER.length > 5000);
});

test('the card form stops Return — at the form, once', () => {
  const at = MAKER.indexOf('id={CARD_FORM_ID}');
  assert.ok(at > 0, 'the card form is gone');
  const formTag = MAKER.slice(MAKER.lastIndexOf('<form', at), MAKER.indexOf('>', MAKER.indexOf('noValidate', at)));
  assert.match(formTag, /action=\{commitVendorService\}/, 'this is not the card form');
  assert.match(formTag, /onKeyDown=\{returnMovesOn\}/, 'the card form no longer stops Return — a price + Return creates the card again');
  assert.match(MAKER, /import \{ markReturnAsNext, returnMovesOn \} from '@\/lib\/return-moves-on';/);
});

test('every one-line field is told Return reads "next"', () => {
  assert.match(MAKER, /markReturnAsNext\(formRef\.current\)/, 'the iPhone Return key no longer reads "next"');
});

test('Return in a one-line field moves on (text, number, price, search …)', () => {
  for (const type of ['text', 'number', 'tel', 'email', 'url', 'search', 'time', 'date', null]) {
    assert.equal(returnShouldMoveOn('Enter', 'INPUT', type), true, `Return in a ${type ?? 'typeless'} input would submit`);
  }
});

test('a textarea keeps its new lines; buttons, checkboxes and radios keep their own Return', () => {
  assert.equal(returnShouldMoveOn('Enter', 'TEXTAREA', null), false);
  assert.equal(returnShouldMoveOn('Enter', 'BUTTON', 'submit'), false);
  for (const type of ['submit', 'button', 'checkbox', 'radio', 'file']) {
    assert.equal(returnShouldMoveOn('Enter', 'INPUT', type), false, `Return on a ${type} input was hijacked`);
  }
});

test('other keys, and Return while an IME is composing, are left alone', () => {
  assert.equal(returnShouldMoveOn('Tab', 'INPUT', 'text'), false);
  assert.equal(returnShouldMoveOn('a', 'INPUT', 'text'), false);
  assert.equal(returnShouldMoveOn('Enter', 'INPUT', 'text', true), false);
});
