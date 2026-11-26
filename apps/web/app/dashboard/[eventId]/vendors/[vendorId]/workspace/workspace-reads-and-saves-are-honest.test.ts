/**
 * Final check 25 Nov, area 7 — the hosts' per-supplier workspace:
 *   · A7-27 — "Save costs" / "Save crew" never throw the whole screen away: both forms are `CostsForm`, which calls the
 *     same action, keeps the row and says "That did not save…", and re-throws only Next's own redirects.
 *   · A7-22 — a refused contact read draws no contact form (its Save would write the blank address over the stored one).
 *   · A7-23 — refused delivered-work, appointments, colour-sharing and crew-meal reads say so, never "nothing there".
 * Read off the page source (it needs a signed-in couple and a database to render).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGE = stripComments(readFileSync(join(HERE, 'page.tsx'), 'utf8'));
const FORM = stripComments(readFileSync(join(HERE, '_components/costs-form.tsx'), 'utf8'));

test('A7-27: the costing forms keep the row and say it did not save', () => {
  assert.doesNotMatch(PAGE, /<form action=\{updateVendorCosts\}/, 'a bare form lets the action throw the screen away');
  assert.equal((PAGE.match(/<CostsForm className=/g) ?? []).length, 2, 'both Save costs and Save crew go through CostsForm');
  assert.match(FORM, /await updateVendorCosts\(formData\)/);
  assert.match(FORM, /catch \(err\) \{\s*unstable_rethrow\(err\);\s*setFailed\(true\);/);
  // Typed values survive a failure: onSubmit + preventDefault + a transition, never a form `action` (React resets a
  // form whose action resolved — and a caught failure resolves).
  assert.match(FORM, /<form className=\{className\} onSubmit=\{onSubmit\}/);
  assert.doesNotMatch(FORM, /<form[^>]*\baction=/, 'the form resets its fields again on a failed save');
  assert.match(FORM, /e\.preventDefault\(\);/);
  assert.match(FORM, /const formData = new FormData\(e\.currentTarget\);/);
  assert.match(FORM, /<SubmitButton pendingLabel="Saving…" pending=\{pending\}/, 'the button no longer shows it is saving');
  assert.equal((PAGE.match(/<CostsSubmit className=/g) ?? []).length, 2);
  assert.match(FORM, /That did not save\. Nothing changed — please try again\./);
});

test('A7-22: a refused contact read draws the notice, not the contact form', () => {
  assert.match(PAGE, /selfAdded && manualContactRes\?\.error \? \(\s*<ReadRefusedNotice what="their contact details" \/>/);
});

test('A7-23: refused reads on the workspace say so', () => {
  for (const what of [
    'what this supplier delivered',
    'your appointments with this supplier',
    'what this supplier may change in your colours',
    'the crew meal count',
  ]) {
    assert.match(PAGE, new RegExp(`<ReadRefusedNotice what="${what}" />`), `"${what}" has no refused-read notice`);
  }
  assert.match(PAGE, /\{handoverRowsError \? \(/);
  assert.match(PAGE, /appointmentsReadRefused = true;/);
  assert.match(PAGE, /colourReadRefused = Boolean\(grantErr \|\| changeErr\);/);
});
