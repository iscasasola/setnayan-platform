/**
 * 🔒 SUPPLIER BUILD 2 LANE E — the three UI promises the db tests cannot see (2026-11-08).
 *
 *   1. BOOKED QRs HAVE A ROW IN CLIENTS ⚙ — `customers-settings-body.tsx` draws a "Booked QRs" row whose link is the
 *      QR codes page's Booked mode WITH its ledger open (Waiting · Used · Deleted), and the invite page still opens
 *      that fold on `ledger`.
 *   2. EVERY MONEY ACTION IS CONFIRMED — "Record a refund" asks (`useConfirm`) BEFORE it calls `recordClientRefund`,
 *      and a "no" returns before any write. The swipe-left remove goes through `deleteWithUndo` (Undo), never a bare
 *      call.
 *   3. THE REFUND REACHES THE BALANCE AND THE CLIENT NAME REACHES THE CODE — the Payment page hands the refund total to
 *      `clientPaymentView`; the Booked QR form posts `client_name` and the issue action writes it.
 *
 * Source anchors are strings, never line numbers. Run from apps/web: `npx tsx --test <this file>`.
 * SABOTAGE (seen red, 8 Nov 2026): moving `recordClientRefund(fd)` above the `confirm(` call → case 2 red; deleting the
 * Booked QRs `DatesRow` → case 1 red.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => fs.readFileSync(path.join(HERE, rel), 'utf8');

test('1 · Clients ⚙ has a "Booked QRs" row that opens the Booked QR ledger', () => {
  const gear = read('customers/_components/customers-settings-body.tsx');
  assert.match(gear, /export const BOOKED_QRS_HREF = '\/vendor-dashboard\/invite\?mode=locked&ledger=1';/, 'the Booked QRs link moved off the ledger');
  const row = gear.match(/<DatesRow[^>]*?data="customers-gear-booked-qrs"[\s\S]{0,400}?\/>/);
  assert.ok(row, 'Clients ⚙ lost its Booked QRs row');
  assert.match(row![0], /href=\{BOOKED_QRS_HREF\}/, 'the Booked QRs row does not link to the ledger');
  const invite = read('invite/page.tsx');
  assert.match(invite, /search\.ledger/, 'the QR codes page no longer opens its ledger on ?ledger=');
});

test('2 · "Record a refund" is confirmed before it writes; a remove has Undo', () => {
  const src = read('clients/[eventId]/_components/client-refunds.tsx');
  const save = src.slice(src.indexOf('async function save()'), src.indexOf('function remove('));
  assert.ok(save.length > 0, 'save() not found');
  const ask = save.indexOf('await confirm(');
  const no = save.indexOf('if (!yes) return;');
  const write = save.indexOf('recordClientRefund(fd)');
  assert.ok(ask >= 0, 'the refund is saved without asking');
  assert.ok(no > ask, 'a "no" does not stop the save');
  assert.ok(write > no, 'the refund is written before (or without) the confirm');
  const remove = src.slice(src.indexOf('function remove('));
  assert.match(remove, /deleteWithUndo\(\{[\s\S]{0,400}?commit: async \(\) => \{[\s\S]{0,300}?recordClientRefund\(fd\)/, 'the swipe remove is not behind Undo');
  assert.match(src, /<SwipeToDelete[^>]*onDelete=\{\(\) => remove\(r\)\}/, 'a refund row is not swipe-left to remove');
});

test('3 · the refund lowers Paid; the client name reaches the code', () => {
  const pay = read('clients/[eventId]/_pages/payment.tsx');
  assert.match(pay, /refundedPhp: refunds \? \(refunds\.measured \? refundedTotalPhp\(refunds\.rows\) : null\) : 0/, 'the Payment page does not hand its refunds to the balance');
  const form = read('invite/_components/locked-qr-generator.tsx');
  assert.match(form, /fieldName="client_name"/, 'the Booked QR form lost its Client name field');
  const action = read('invite/actions.ts');
  assert.match(action, /formData\.get\('client_name'\)/, 'issueLockedQr does not read client_name');
  assert.match(action, /client_name: clientName,/, 'issueLockedQr does not write client_name');
});
