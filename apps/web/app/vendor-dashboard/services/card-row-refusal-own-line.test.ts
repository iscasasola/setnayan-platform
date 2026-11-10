/**
 * 🔁 The card's Go online refusal gets its own line (owner screenshot 10 Nov, "Toggle issue").
 * StayForm prints a refused save as a SIBLING of its form. Beside the card that sibling was a flex child of the card
 * row and crushed the card into a one-word column; inside the menu row it would be a fourth cell. Since the menu row
 * (Edit · Share · Go online, owner 10 Nov) the form holds only its hidden fields and sits AFTER the row, so the
 * `[data-stay-error]` line lands under the row, full width.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const manager = readFileSync(join(__dirname, '_components', 'services-manager.tsx'), 'utf8');
const row = readFileSync(join(__dirname, '_components', 'service-card-menu-row.tsx'), 'utf8');

test('the Go online form sits AFTER the equal row, never inside it, and reaches its button by the form attribute', () => {
  const rowClose = row.indexOf('</EqualRow>');
  const form = row.indexOf('<StayForm');
  assert.ok(rowClose > 0 && form > 0, 'the menu row or its StayForm was not found — re-anchor this guard');
  assert.ok(form > rowClose, 'the StayForm moved inside the row — its refusal would become a fourth cell');
  assert.match(row, /<StayForm id=\{formId\}/, 'the form lost the id its button submits');
  assert.match(row, /form=\{formId\}/, 'the Go online button no longer submits the form outside the row');
});

test('StayForm still prints its refusal with the data-stay-error hook', () => {
  const stay = readFileSync(join(__dirname, '..', '..', '_components', 'stay-form.tsx'), 'utf8');
  assert.match(stay, /data-stay-error=\{door\}/);
});

test('an offline card is not greyed out (owner 10 Nov)', () => {
  assert.doesNotMatch(manager, /opacity:\s*svc\.is_active\s*\?/, 'the card is dimmed again when offline');
});
