/**
 * Final check 25 Nov, area 8, batch 6 (money desks, display only): a failed read on a money screen says "Couldn't
 * read" — never ₱0, "none", "live" or a code default shown as the setting — and a save that would write from an
 * unread value is held back. No amount, fee, plan or price read changes. Read from comment-stripped source.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';

const web = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const code = (p: string) => stripComments(readFileSync(resolve(web, p), 'utf8'));
const has = (src: string, needle: string | RegExp, why: string) =>
  assert.ok(typeof needle === 'string' ? src.includes(needle) : needle.test(src), why);

test('catalogue reads keep their outcome (A-9 · B-7 · F-3 · D-6)', () => {
  const lib = code('lib/v2-catalog.ts');
  has(lib, /export async function fetchV2CustomerCatalogRead\(/, 'customer read keeps its outcome');
  has(lib, /export async function fetchV2BundleCatalogRead\(/, 'bundle read keeps its outcome');
  has(lib, /if \(error\) return \{ rows: \[\], ok: false \};/, 'a refused customer read is ok:false');
  for (const page of ['app/admin/discount-codes/new/page.tsx', 'app/admin/discount-codes/[id]/edit/page.tsx']) {
    const src = code(page);
    has(src, 'const catalogFailed = !customersRead.ok || !bundlesRead.ok || !vendorsRead.ok;', `${page} measures the read`);
    has(src, 'catalogFailed={catalogFailed}', `${page} hands it to the form`);
  }
  const form = code('app/admin/discount-codes/_components/voucher-form.tsx');
  has(form, 'disabled={catalogFailed}', 'A-9: the code form holds Save back');
  has(form, 'Couldn’t read the whole catalogue', 'A-9: and says why');
  const fw = code('app/admin/pricing/_surfaces/free-windows-surface.tsx');
  has(fw, 'const catalogFailed = !catalogRead.ok;', 'B-7: measured');
  has(fw, 'disabled={catalogFailed}', 'B-7: Create is off');
  const gifts = code('app/admin/gifts/page.tsx');
  has(gifts, 'disabled={!vendorCatalogRead}', 'F-3: Create deal is off');
  has(gifts, 'disabled={!customerCatalogRead}', 'F-3: Create free window is off');
  const users = code('app/admin/accounts/_surfaces/users-surface.tsx');
  has(users, /if \(!customersRead\.ok \|\| !bundlesRead\.ok \|\| !vendorsRead\.ok\) throw/, 'D-6: a refusal reaches the "couldn\'t read" path');
  const vendors = code('app/admin/accounts/_surfaces/vendors-surface.tsx');
  has(vendors, '{invitePricesRead ? null : <ReadFailed', 'D-6: the invite says its prices were not read');
});

test('F-1 · an unread gift limit is not the default, and Save is held back', () => {
  const lib = code('lib/gift-limit-settings.server.ts');
  has(lib, /export async function getGiftLimitPctRead[\s\S]*?catch \{\s*return null;/, 'the honest read returns null');
  const page = code('app/admin/gifts/page.tsx');
  has(page, /giftLimitPct === null \? \(\s*<ReadFailed/, 'the form is replaced by Couldn\'t read');
});

test('A-3 · an unread payments list is not "₱0 received"', () => {
  const src = code('app/admin/payments/actions.ts');
  const check = src.indexOf('if (orderPaymentsErr)');
  assert.ok(check >= 0 && check < src.indexOf('const matchedTotal'), 'checked before the total is summed');
});

test('A-11 · the BDO pile stays on screen when nothing is pending', () => {
  const src = code('app/admin/payments/_components/desk.tsx');
  const empty = src.slice(src.indexOf('if (payments.length === 0)'), src.indexOf("'Nothing to reconcile.'"));
  has(empty, '{pileWhenEmpty}', 'the pile renders in the empty branch');
});

test('H-1 · a refused sales read says so and leaves the leaderboard', () => {
  const src = code('app/admin/app-performance/_surfaces/overview-surface.tsx');
  has(src, "const salesUnread = perf.errors.some((e) => e.startsWith('monetization:'));", 'measured');
  has(src, /salesUnread \? \(\s*<ReadFailed what="the sales figures"/, 'the card says it');
  has(src, /\.\.\.\(salesUnread\s*\? \[\]/, 'the Revenue row is left out');
});

test('H-3 · an unread count is "—", never 0 under "live"', () => {
  const lib = code('lib/ugat/data.ts');
  const hc = lib.slice(lib.indexOf('async function headCount('), lib.indexOf('async function loadUgatCounts('));
  assert.ok(!/return 0;/.test(hc), 'headCount never returns 0 for a refusal');
  has(lib, "readFailed: true }", 'a refused table load is marked');
  const ui = code('app/admin/ugat/_components/ugat-console.tsx');
  has(ui, "return n == null ? '—'", 'the console draws —');
  has(ui, 'data.readFailed ?', 'the table says it could not read');
});

test('E-3 · a fee dispute never shows ₱0 or a confident "no chat" on a refused read', () => {
  const src = code('app/admin/disputes/_components/booking-fee-disputes-section.tsx');
  has(src, "if (centavos == null || centavos === '') return '—';", 'a missing amount is —');
  has(src, 'chat: threads.error', 'the chats read is measured');
  has(src, 'save: saves.error', 'the saves read is measured');
  has(src, 'Couldn’t read the bill', 'a refused bill read is said');
});

test('E-4 · dispute evidence says when it could not be read', () => {
  has(code('lib/booking-handovers.server.ts'), /if \(error\) throw error;/, 'handovers read throws');
  has(code('lib/vendor-service-payment-schedules.server.ts'), /if \(error\) throw error;/, 'policy acks read throws');
  const page = code('app/admin/disputes/page.tsx');
  has(page, 'policyAcksByVendor === null ?', 'policy evidence: Couldn\'t read');
  has(page, 'handoversByVendor === null ?', 'handovers: Couldn\'t read');
  has(page, 'suppliersUnread ? ', 'supplier names: Couldn\'t read');
  const pay = code('app/admin/disputes/_components/payment-disputes-section.tsx');
  has(pay, "receiptByPayment.set(r.payment_id, 'unsigned')", 'an unsigned receipt is not "no receipt"');
});

test('B-1 · an unread sign-up discount locks the price saves', () => {
  const actions = code('app/admin/pricing/price-control-actions.ts');
  assert.equal(actions.split('if (settingsErr) return').length - 1, 2, 'both saves refuse');
  has(code('app/admin/pricing/_surfaces/ai-prices-surface.tsx'), 'catalogRes.error || settingsRes.error', 'AI surface locks');
  has(code('app/admin/pricing/_surfaces/papic-ladder-surface.tsx'), 'catRes.error || settingsRes.error', 'ladder hides');
});

test('B-4 · B-8 · the pricing tab says a failed read instead of defaults or empty lines', () => {
  const src = code('app/admin/pricing/_surfaces/pricing-surface.tsx');
  has(src, /settingsRes\.error \? \(\s*<ReadFailed what="the booking fee settings/, 'B-4: no form over code values');
  has(src, /retailRes\.error \|\| bundleRes\.error \|\| vendorRes\.error \? null : \(\s*<PriceCatalogBrowser/, 'B-8: no empty lines under the banner');
  has(code('app/admin/pricing/_surfaces/papic-ladder-surface.tsx'), /catRes\.error \? \(\s*<ReadFailed what="the other Papic prices"/, 'B-8: the rest editor says it');
});
