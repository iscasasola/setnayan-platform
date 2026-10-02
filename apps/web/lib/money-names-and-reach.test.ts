/**
 * money-names-and-reach.test.ts — the owner's two rulings of 2026-10-02 reach
 * the pixel, not just the source.
 *
 *   • "SAY 'ANY BANK OR E-WALLET'" and a new receiving account (Maribank) must
 *     never show a raw id ("maribank-7k2q") to a couple, a supplier or an admin.
 *   • "Record a payment received" must be reachable on a PHONE.
 *
 * ── HOW EACH CLAIM IS TESTED ────────────────────────────────────────────────
 * RENDERED where the thing is a component (renderToStaticMarkup, the real
 * HTML is read), and WIRED where the page is an async server component that
 * cannot be rendered without a database — there the test reads the page source
 * (comments stripped) and asserts it mounts the rendered component and no
 * longer prints the raw field. A correct component and a correct page can each
 * pass their own test while the line between them is cut; this file is both.
 *
 * SABOTAGE PERFORMED AND UNDONE DURING VERIFICATION — see the PR body.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import { stripComments } from './strip-comments';
import {
  channelLabel,
  namesPhrase,
  ourAccountPhrase,
  receivingAccountsPhrase,
} from './payment-channels';
import { ugatRecordHref } from './ugat/record-href';
import { buildPaymentLoggedAlert, type AdminOrderAlertFacts } from './admin-order-alert';
import { ADMIN_NAV_ALIASES } from '@/app/admin/_components/admin-nav-descriptions';
import { PaymentChannelName } from '@/app/_components/payment/payment-channel-name';
import { PaymentDetailsBlock, QR_PH_LINE } from '@/app/_components/payment/payment-rails';
import { ConsoleTable } from '@/app/admin/_components/console-table';
import { LEDGER_REFERENCE_COLUMN } from '@/app/admin/money/_components/ledger-reference-column';
import { VendorCardTitle } from '@/app/admin/accounts/_surfaces/vendor-card-title';

(globalThis as unknown as { React: unknown }).React = React;

const WEB = process.cwd();
const src = (rel: string) => stripComments(readFileSync(join(WEB, rel), 'utf8'));
const html = (el: React.ReactElement) => renderToStaticMarkup(el);
// A .ts test file cannot hold JSX, so components are made with createElement.
const h = React.createElement as unknown as (type: unknown, props: unknown) => React.ReactElement;

/** The admin's list after they added a third account. */
const SETTINGS = {
  receiving_accounts: [
    { id: 'gcash', kind: 'ewallet', label: 'GCash', number: '09170000000', enabled: true },
    { id: 'bdo', kind: 'bank', label: 'BDO', number: '0012345678', enabled: true },
    { id: 'maribank-7k2q', kind: 'bank', label: 'Maribank', number: '1234567890', enabled: true },
  ],
};

/** Setnayan's real GCash receiving payload — a genuine QR Ph code. */
const QR_PH =
  '00020101021127830012com.p2pqrpay0111GXCHPHM2XXX02089996440303152170200000006560417DWQM4TK3JDNWIWRDY5204601653036085802PH5908Setnayan6011Holy Spirit6104123463045E2D';

// ── 1. a payment's channel is printed as the account's NAME ────────────────

test('RENDER: a payment into a new account shows its NAME, never its id', () => {
  const out = html(h(PaymentChannelName, { settings: SETTINGS, channel: 'maribank-7k2q' }));
  assert.match(out, />Maribank</);
  assert.ok(!out.includes('maribank-7k2q'), `the raw id leaked: ${out}`);
});

test('RENDER: the two original ids keep their names, an admin-typed channel is shown as typed', () => {
  assert.match(html(h(PaymentChannelName, { settings: SETTINGS, channel: 'gcash' })), />GCash</);
  assert.match(html(h(PaymentChannelName, { settings: {}, channel: 'bdo' })), />BDO</);
  assert.match(html(h(PaymentChannelName, { settings: SETTINGS, channel: 'Cash' })), />Cash</);
});

test('WIRED: the couple order page, the supplier fee page and the admin card print names', () => {
  for (const rel of [
    'app/dashboard/[eventId]/orders/[orderId]/page.tsx',
    'app/vendor-dashboard/booking-fees/[orderId]/page.tsx',
  ]) {
    const s = src(rel);
    assert.match(s, /<PaymentChannelName\b[^>]*channel=\{p\.channel\}/, `${rel} must mount PaymentChannelName`);
    assert.doesNotMatch(s, /\{p\.channel\}\s*\n?\s*\{p\.reference/, `${rel} prints the raw channel id`);
    assert.doesNotMatch(s, /·\s*\{p\.channel\}/, `${rel} prints the raw channel id`);
  }
  const admin = src('app/admin/payments/page.tsx');
  assert.match(admin, /channelLabel\(channelSettings, p\.channel\)/, 'the admin payments card must name the account');
  assert.doesNotMatch(admin, /value=\{p\.channel\}/, 'the admin payments card prints the raw channel id');
});

test('the admin alert email names the account (the id never reaches an inbox)', () => {
  const facts: AdminOrderAlertFacts = {
    orderPublicId: 'S89O-7K2M9QX4TB',
    referenceCode: 'SNM51BN2RX',
    hosts: [{ name: 'Ana Reyes', email: null }],
    paidBy: null,
    event: 'none',
    lines: [{ label: 'Papic', pricePhp: 245 }],
    totalPhp: 245,
    payment: {
      amountPhp: 245,
      channel: 'maribank-7k2q',
      channelName: channelLabel(SETTINGS, 'maribank-7k2q'),
      bankReference: null,
      loggedAtIso: '2026-10-02T01:00:00Z',
    },
  };
  const alert = buildPaymentLoggedAlert(facts);
  const everything = JSON.stringify(alert);
  assert.match(everything, /Maribank/);
  assert.ok(!everything.includes('maribank-7k2q'), 'the raw id is in the alert');
  // And the notifier resolves the name from the list rather than passing the id.
  const notify = src('lib/order-admin-notify.ts');
  assert.match(notify, /channelName/, 'the notifier no longer hands the builder a name');
  assert.match(notify, /fetchPlatformSettings\(admin\)/, 'the notifier no longer reads the accounts list');
});

// ── 2. copy reads the list ──────────────────────────────────────────────────

test('names read as a phrase from the list, in the admin order', () => {
  assert.equal(namesPhrase(['GCash']), 'GCash');
  assert.equal(namesPhrase(['GCash', 'BDO']), 'GCash or BDO');
  assert.equal(namesPhrase(['GCash', 'BDO', 'Maribank']), 'GCash, BDO or Maribank');
  assert.equal(namesPhrase([], 'bank or e-wallet'), 'bank or e-wallet');
  assert.equal(receivingAccountsPhrase(SETTINGS), 'GCash, BDO or Maribank');
  assert.equal(ourAccountPhrase(['GCash', 'Maribank']), 'our GCash or Maribank account');
  assert.equal(ourAccountPhrase([]), 'our receiving account');
});

test('no customer or supplier surface hard-codes "BDO or GCash" any more', () => {
  const files = [
    'app/papic/order/[token]/page.tsx',
    'app/dashboard/[eventId]/studio/patiktok/page.tsx',
    'app/(shell)/refunds/page.tsx',
    'app/vendor-dashboard/deep-search/_components/deep-search-runner.tsx',
    'app/vendor-dashboard/subscription/_components/booth-addon-card.tsx',
    'app/vendor-dashboard/subscription/_components/ai-addon-card.tsx',
    'app/vendor-dashboard/subscription/page.tsx',
    'app/vendor-dashboard/booking-fees/[orderId]/page.tsx',
    'app/vendor-dashboard/branches/actions.ts',
    'lib/booking-fee-disclosure.ts',
    'lib/vendor-booking-fees.ts',
    'app/admin/settings/_surfaces/settings-surface.tsx',
    'app/admin/_components/admin-nav-descriptions.ts',
    // Batch-3 audit (2026-10-02): the supplier custom-plan composer and the
    // admin Action Center now read the receiving-accounts list too.
    'app/admin/custom-plans/_components/custom-composer.tsx',
    'app/admin/pricing/_surfaces/custom-plans-surface.tsx',
    'app/admin/app-performance/_components/action-center.tsx',
  ];
  const hard = /(BDO or GCash|GCash or BDO|GCash ?\/ ?BDO|BDO ?\/ ?GCash)/;
  const offenders = files.filter((f) => {
    const s = src(f);
    // Strip the stored-vocabulary alias line (search words, not copy).
    return hard.test(f.endsWith('admin-nav-descriptions.ts') ? s.replace(/payments:.*\n/, '') : s);
  });
  assert.deepEqual(offenders, [], `hard-coded account names remain in: ${offenders}`);
});

test('the help article names no fixed account either (the § 9.1 clause quote is the published text, left alone)', () => {
  assert.doesNotMatch(src('lib/help.ts'), /Send the amount via BDO or GCash/);
  assert.match(src('lib/help.ts'), /any bank or e-wallet app/);
});

test('the surfaces that hold the open rails SAY their names', () => {
  for (const rel of [
    'app/vendor-dashboard/deep-search/_components/deep-search-runner.tsx',
    'app/vendor-dashboard/subscription/_components/booth-addon-card.tsx',
    'app/vendor-dashboard/subscription/_components/ai-addon-card.tsx',
  ]) {
    assert.match(src(rel), /ourAccountPhrase\(openRails\.map/, `${rel} does not read the list`);
  }
  assert.match(
    src('app/vendor-dashboard/booking-fees/[orderId]/page.tsx'),
    /namesPhrase\(\s*openAccounts\(settings\)/,
  );
});

test('a branch order accepts ANY open account id, not just bdo/gcash', () => {
  const s = src('app/vendor-dashboard/branches/actions.ts');
  assert.match(s, /isPayChannel\(channelRaw\)/);
  assert.doesNotMatch(s, /channelRaw !== 'bdo'/);
});

test('the dead hasBdo/hasGcash are gone from checkout', () => {
  const s = src('app/dashboard/[eventId]/checkout/actions.ts');
  assert.doesNotMatch(s, /hasBdo|hasGcash/);
});

// ── 3. the QR line ──────────────────────────────────────────────────────────

const RAIL = {
  id: 'maribank-7k2q',
  label: 'Maribank',
  kind: 'bank' as const,
  name: 'Setnayan',
  number: '1234567890',
  staticUrl: 'https://example.test/qr.png',
  mintedUrl: null,
};

test('RENDER: a QR Ph payload gets the "any bank or e-wallet" line next to the code', () => {
  const out = html(
    h(PaymentDetailsBlock, { info: { ...RAIL, payload: QR_PH }, referenceCode: 'SNM51BN2RX', amountPhp: 500 }),
  );
  assert.ok(out.includes(QR_PH_LINE), 'the QR Ph line is missing');
  assert.equal(QR_PH_LINE, 'Scan with any bank or e-wallet app (QR Ph)');
});

test('RENDER: no QR Ph payload, no promise — unreadable, wrong-currency-ish or absent', () => {
  for (const payload of [null, undefined, 'not a qr payload at all', QR_PH.slice(0, -4) + '0000']) {
    const out = html(
      h(PaymentDetailsBlock, { info: { ...RAIL, payload }, referenceCode: 'SNM51BN2RX', amountPhp: 500 }),
    );
    assert.ok(out.includes('<img'), 'the static QR image should still render');
    assert.ok(!out.includes('any bank or e-wallet app'), `promised "any app" for payload ${String(payload)}`);
  }
});

// ── 4. "Record a payment received" on a phone ───────────────────────────────

test('RENDER: the ledger Reference link has no hidden breakpoint and opens the payments desk', () => {
  const out = html(
    h(ConsoleTable<{ public_id: string; reference_code: string }>, {
      rows: [{ public_id: 'S89O-7K2M9QX4TB', reference_code: 'SNM51BN2RX' }],
      columns: [LEDGER_REFERENCE_COLUMN],
      rowKey: (r: { public_id: string }) => r.public_id,
      label: 'Every transaction',
      empty: { Icon: (() => null) as never, title: 'none', blurb: 'none' },
      readPermitted: true,
    }),
  );
  assert.match(out, /href="\/admin\/payments\?filter=all&amp;q=S89O-7K2M9QX4TB"/);
  // The th and td for this column carry NO `hidden …:table-cell` class.
  const cells = out.match(/<(th|td)\b[^>]*>/g) ?? [];
  assert.ok(cells.length >= 2, 'the column did not render');
  for (const c of cells) assert.ok(!/\bhidden\b/.test(c), `column hidden at some width: ${c}`);
});

test('the ledger mounts that column, and order search lands on the Record card', () => {
  assert.match(src('app/admin/money/_components/transactions-ledger.tsx'), /LEDGER_REFERENCE_COLUMN,/);
  assert.equal(
    ugatRecordHref({ kind: 'order', publicId: 'S89O-7K2M9QX4TB' }),
    '/admin/payments?q=S89O-7K2M9QX4TB',
  );
  assert.equal(ugatRecordHref({ kind: 'order', publicId: null }), '/admin/money');
  const data = src('lib/ugat/data.ts');
  assert.ok(
    (data.match(/ugatRecordHref\(\{ kind: 'order', publicId: o\.public_id/g) ?? []).length >= 2,
    'both order hit builders must pass the public id',
  );
});

// ── 5. the supplier cards open the record page ──────────────────────────────

test('RENDER: a supplier card title links to /admin/vendors/<id>', () => {
  const out = html(h(VendorCardTitle, { vendorProfileId: '11111111-2222-3333-4444-555555555555', name: 'Studio Aral' }));
  assert.match(out, /href="\/admin\/vendors\/11111111-2222-3333-4444-555555555555"/);
  assert.match(out, />Studio Aral</);
});

test('BOTH the claimed and the unclaimed list render that title', () => {
  const s = src('app/admin/accounts/_surfaces/vendors-surface.tsx');
  assert.equal((s.match(/<VendorCardTitle\b/g) ?? []).length, 2);
});

// ── 6. admin search words ───────────────────────────────────────────────────

test('admin search: payments ← record/received/arrived · payment-methods ← bank/e-wallet/receiving account', () => {
  const words = (k: string) => (ADMIN_NAV_ALIASES[k] ?? '').split(/\s+/);
  for (const w of ['record', 'received', 'arrived']) assert.ok(words('payments').includes(w), `payments lacks "${w}"`);
  const pm = ADMIN_NAV_ALIASES['payment-methods'] ?? '';
  for (const w of ['bank', 'e-wallet', 'receiving account']) assert.ok(pm.includes(w), `payment-methods lacks "${w}"`);
});
