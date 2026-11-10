/**
 * 🔁 The card's Go online refusal gets its own line (owner screenshot 10 Nov, "Toggle issue").
 * StayForm prints a refused save as a SIBLING of its form. Beside the card that sibling was a flex child of the card
 * row and crushed the card into a one-word column; inside the row it would be one more cell. So the form holds only its
 * hidden fields and sits AFTER the row (Edit · Share · Online/Offline, owner 10 Nov), the switch reaches it with the
 * `form` attribute, and the `[data-stay-error]` line lands under the row, full width — one line per open booking.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const manager = readFileSync(join(__dirname, '_components', 'services-manager.tsx'), 'utf8');
const row = readFileSync(join(__dirname, '_components', 'service-card-menu-row.tsx'), 'utf8');

test('the switch form sits AFTER the row, never inside it, and reaches its switch by the form attribute', () => {
  const line = row.indexOf('data-card-menu-line=""');
  const sw = row.indexOf('role="switch"');
  const form = row.indexOf('<StayForm');
  assert.ok(line > 0 && sw > line && form > 0, 'the row or its StayForm was not found — re-anchor this guard');
  assert.ok(form > sw && row.slice(sw, form).includes('</div>'), 'the StayForm moved inside the row — its refusal would become a cell');
  assert.match(row, /<StayForm id=\{formId\}/, 'the form lost the id its button submits');
  assert.match(row, /form=\{formId\}/, 'the switch no longer submits the form outside the row');
});

test('StayForm still prints its refusal with the data-stay-error hook', () => {
  const stay = readFileSync(join(__dirname, '..', '..', '_components', 'stay-form.tsx'), 'utf8');
  assert.match(stay, /data-stay-error=\{door\}/);
  assert.match(stay, /whitespace-pre-line[^"]*" data-stay-error=\{door\}/, 'a refusal naming several bookings would run onto one line');
});

test('an offline card is not greyed out (owner 10 Nov)', () => {
  assert.doesNotMatch(manager, /opacity:\s*svc\.is_active\s*\?/, 'the card is dimmed again when offline');
});
