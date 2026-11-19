/**
 * 🔖 THE SHORTLIST QR IS AN IMPORT QR (owner 2026-11-16, specs DECISION_LOG 1abf35b — supersedes d7f4b97f "the
 * Shortlist QR stays free but is not an import"). It writes its OWN source (`vendor_shortlist_qr`, never the own-client
 * `vendor_invite`), and that source is supplier-brought: the first-supplier rule (d4899cd5 / 9fe95ebe) decides it in SQL.
 *
 * The bill itself is held by `tests/db/the-shortlist-qr-is-not-an-import.db.test.ts` and the two Shortlist QR rows of
 * `fee-rule-b-cases.ts` (run through BOTH the app rule and `booking_fee_attribution_for`). This file holds the app
 * side: the one writer, and the sets every reader of the source goes through.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { bookingFeeAttributionFromFacts, SETNAYAN_SAVE_SOURCES, SHORTLIST_QR_SOURCE, SUPPLIER_BROUGHT_SOURCES } from './booking-fee-gate';
import { stripComments } from './strip-comments';

const read = (p: string) => stripComments(readFileSync(join(__dirname, '..', p), 'utf8'));

test('the Shortlist QR writes its own source, and that source is an import QR, never a save on Setnayan', () => {
  assert.equal(SHORTLIST_QR_SOURCE, 'vendor_shortlist_qr');
  assert.ok(!SETNAYAN_SAVE_SOURCES.has(SHORTLIST_QR_SOURCE), 'the Shortlist QR reads as Setnayan finding the couple');
  assert.ok(SUPPLIER_BROUGHT_SOURCES.has(SHORTLIST_QR_SOURCE), 'the Shortlist QR is not treated as an import QR');
  const src = read('lib/vendor-couple-invite.ts');
  const writer = src.slice(src.indexOf('export async function importVendorToEventShortlist'));
  assert.match(writer, /source: SHORTLIST_QR_SOURCE,/, 'the Shortlist QR no longer writes its own source');
  assert.doesNotMatch(writer, /'vendor_invite'/, 'the Shortlist QR writes an own-client source again');
});

test('a Shortlist QR row reads like any import: no Setnayan fact first → import; a Setnayan view first → sourced', () => {
  const facts = { threadSources: [], rowIsManualRecord: false, recordTiedToShop: true, savesBefore: [], viewSourcesBefore: [] };
  assert.equal(bookingFeeAttributionFromFacts({ ...facts, rowSource: SHORTLIST_QR_SOURCE }), 'import');
  assert.equal(bookingFeeAttributionFromFacts({ ...facts, rowSource: SHORTLIST_QR_SOURCE, viewSourcesBefore: ['search'] }), 'sourced');
  assert.equal(bookingFeeAttributionFromFacts({ ...facts, rowSource: 'vendor_invite' }), 'import', 'the own-client invite changed too');
});

test('the chat a couple starts from a Shortlist QR row counts as found on Setnayan', () => {
  // contact-shortlist-vendor.ts keeps its own copy of the supplier-brought set; only those rows open an unsourced chat.
  const src = read('app/dashboard/[eventId]/vendors/_actions/contact-shortlist-vendor.ts');
  const set = src.match(/const SUPPLIER_BROUGHT_SOURCES[^=]*= new Set\(\[([^\]]*)\]\)/);
  assert.ok(set, 'the shortlist chat no longer names which rows the supplier brought');
  assert.deepEqual(set![1]!.split(',').map((s) => s.trim().replace(/'/g, '')).sort(), [...SUPPLIER_BROUGHT_SOURCES].sort());
});

test('the migration teaches the SQL fee rule the same value, and takes imports off the Completed bookings badge', () => {
  const dir = join(__dirname, '..', '..', '..', 'supabase', 'migrations');
  const file = readdirSync(dir).find((f) => f.endsWith('_shortlist_qr_is_not_an_import_and_imports_are_not_completed_bookings.sql'));
  assert.ok(file, 'the migration is gone');
  const sql = readFileSync(join(dir, file!), 'utf8').replace(/--.*$/gm, '');
  const saveList = /'host_marketplace_search', 'auto_cascade_from_finalize', 'vendor_shortlist_qr'/g;
  assert.equal((sql.match(saveList) ?? []).length, 3, 'a SQL save list does not know the Shortlist QR');
  const view = sql.slice(sql.indexOf('CREATE MATERIALIZED VIEW public.vendor_public_completed_events_stats'));
  assert.match(view, /AND COALESCE\(ev\.source, ''\) NOT IN \('vendor_invite', 'vendor_locked_qr', 'reuse_accept'\)/, 'imports count toward Completed bookings');
  assert.doesNotMatch(sql, /vendor_full_completed_events_stats/, 'the supplier’s own count was changed too');
});
