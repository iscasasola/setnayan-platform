/**
 * 💸 THE SETTLE SHEET SAYS WHERE TO PAY (owner 13 Nov: *"how can they settle if they do not have the QR Code or
 * information where to pay"*) — and it says it in the ONE paying style (owner 20 Sep).
 *
 * The booking-fee settle sheets (a top-up's, and the carry-over's) render `SettlePayBy`, which renders the SHIPPED
 * `PaymentDetailsBlock` — never a block of their own — with codes minted on the SERVER from /pay's own figure.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { stripComments } from '@/lib/strip-comments';

const WEB = process.cwd();
const read = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));

const PAY_BY = 'app/_components/payment/settle-pay-by.tsx';
const READER = 'lib/booking-fee-settle-pay.server.ts';
const SHEETS = [
  'app/_components/top-up-settle-sheet.tsx',
  'app/vendor-dashboard/clients/[eventId]/_components/top-up-carry-over.tsx',
] as const;

test('Pay by is ONE dropdown, then the shipped pay block, then the Receipt — in that order', () => {
  const src = read(PAY_BY);
  assert.match(src, /from '\.\/payment-rails'/, 'the pay part must use the shipped rails');
  assert.doesNotMatch(src, /function (MethodCard|ChannelToggle|PaymentDetailsBlock)\(/, 'a second copy of the rails');
  const pick = src.indexOf('<PickMenu');
  const block = src.indexOf('<PaymentDetailsBlock');
  const receipt = src.indexOf('Receipt\n');
  assert.ok(pick > 0 && block > pick && receipt > block, 'order: Pay by ▾ → the pay block → Receipt');
  assert.match(src, /how you pay Setnayan/, 'the sub-line under Pay by');
  assert.match(src, /railCardWords\(/, 'the choices must read as the rail cards do');
});

test('every settle sheet renders the pay part', () => {
  for (const rel of SHEETS) {
    assert.match(read(rel), /<SettlePayBy\b/, `${rel} does not say where to pay`);
  }
});

test('the codes are minted on the server, from /pay\'s own figure, for the OPEN accounts', () => {
  const src = read(READER);
  assert.match(src, /fetchPayableByReference\(/, 'the figure must be /pay\'s, never a second money rule');
  assert.match(src, /mintedQrImage\(a\.qrPayload, payable\.amountPhp\)/, 'mint each open rail with /pay\'s amount');
  assert.match(src, /openAccounts\(settings\)/, 'the open accounts, in the admin\'s order');
  assert.doesNotMatch(src, /payload:/, 'no payload for a browser to draw — the ₱0 static code would hold the screen');
});

test('the account name and number wrap, never truncate', () => {
  const src = read('app/_components/payment/payment-rails.tsx');
  assert.doesNotMatch(src, /truncate font-mono text-\[13px\] text-ink">\s*\{(name|number)\}/, 'a cut account value');
});
