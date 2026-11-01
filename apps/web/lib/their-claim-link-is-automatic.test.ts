/**
 * THEIR CLAIM LINK IS AUTOMATIC (owner 2026-10-30, verbatim: "no need to wait to create link. create an automatic
 * link"). Source guard over the two doors — the database half (one link, however often the card opens) is
 * `tests/db/a-price-change-replots-the-unpaid-payments.db.test.ts`.
 *   · the add makes the link on EVERY add (not only when the walk asks for it back);
 *   · the record card makes it when it opens, through the same one writer — never a second token mechanism;
 *   · the card's head has no "No link yet" / "Create their link" state: a link that could not be made is SAID.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './strip-comments';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (...p: string[]) => stripComments(readFileSync(path.join(here, '..', ...p), 'utf8'));
const ACTIONS = read('app', 'dashboard', '[eventId]', 'vendors', 'actions.ts');
const MODAL = read('app', 'dashboard', '[eventId]', '_components', 'new-manual-vendor-modal.tsx');
const PANEL = read('app', 'dashboard', '[eventId]', '_components', 'supplier-connect-panel.tsx');

test('the add makes their link on every add', () => {
  const a = ACTIONS.indexOf('export async function addManualSupplier(');
  const body = ACTIONS.slice(a, ACTIONS.indexOf('\n}\n', a));
  const call = body.indexOf('await createManualVendorInvite({ eventId, vendorId: eventVendorId })');
  assert.ok(call > 0, 'the add no longer makes their link');
  const before = body.slice(Math.max(0, call - 160), call);
  assert.doesNotMatch(before, /if \(formData\.get\('with_link'\) === '1'\)\s*\{\s*(const link = )?$/, 'the link is made only when the walk asks for it back');
});

test('the record card makes it when it opens, through the one writer', () => {
  const a = MODAL.indexOf('function RecordLinkBlock(');
  assert.ok(a > 0);
  const body = MODAL.slice(a, MODAL.indexOf('\n}\n', a));
  assert.match(body, /makeLink = createManualVendorInvite,/, 'the card makes its link some other way than the one writer');
  assert.match(body, /makeLink\(\{ eventId, vendorId \}\)/);
  assert.doesNotMatch(body, /readSupplierInvite|vendor_invites|generateClaimToken/, 'a second way to make or read a link');
  assert.match(body, /Try again/, 'a link that could not be made is no longer said in place');
});

test('the card head has no empty-link state', () => {
  const a = PANEL.indexOf('function ConnectTop(');
  assert.ok(a > 0);
  const body = PANEL.slice(a, PANEL.indexOf('\n}\n', a));
  assert.doesNotMatch(body, /No link yet|Create their link/);
});
