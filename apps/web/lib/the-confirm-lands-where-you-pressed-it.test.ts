/**
 * the-confirm-lands-where-you-pressed-it.test.ts
 *
 * Owner, live on the payment run, 2026-09-20, from
 * `/vendor-dashboard/clients/<eventId>?tab=details`:
 * *"clicked confirmed and it just bounced to the chat page."*
 *
 * The confirm WORKED — `deposit_acknowledged_at` was written and the booking
 * fee opened — and the supplier was moved to a screen that says nothing about
 * either, because the redirect carried a notice and no `?tab=`, and a tab-less
 * landing on the client page is forwarded to the thread (#5614). A success that
 * looks like a failure is this repo's oldest disease; this guard pins the fix
 * at both ends: the RULE (executed) and the two call sites (source-scanned).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import { stripComments } from './strip-comments';
import {
  MONEY_TAB,
  VENDOR_CLIENT_TABS,
  depositAnswerReturnTo,
  tabOfClientPath,
  vendorClientTabHref,
} from './vendor-client-return';

const WEB = path.join(__dirname, '..');
const EVENT = '2d4f1144-7816-4367-9c99-6ff0f9a6de10';
const THREAD_PATH = '/vendor-dashboard/messages/ab7c1e90-0000-4000-8000-1234567890ab';

function read(rel: string): string {
  return stripComments(readFileSync(path.join(WEB, rel), 'utf8'));
}

test('EVERY deposit answer names a tab — the bug in one assertion', () => {
  const inputs: unknown[] = [
    undefined,
    null,
    '',
    `/vendor-dashboard/clients/${EVENT}`, // the exact shape that bounced
    `/vendor-dashboard/clients/${EVENT}?deposit_ack=ok`,
    `/vendor-dashboard/clients/${EVENT}?tab=details`,
    `/vendor-dashboard/clients/${EVENT}?tab=payments`,
    THREAD_PATH,
  ];
  let checked = 0;
  for (const raw of inputs) {
    const href = depositAnswerReturnTo(raw, EVENT, { deposit_ack: 'ok' });
    const isThread = href.startsWith('/vendor-dashboard/messages/');
    if (!isThread) {
      assert.match(
        href,
        /[?&]tab=/,
        `from ${JSON.stringify(raw)} → ${href} — a client-page landing with no tab is forwarded to the chat`,
      );
      assert.doesNotMatch(href, /[?&]tab=chat\b/, `${href} lands on the door, which forwards to the chat`);
    }
    // The notice always rides along, or the page cannot report what happened.
    assert.match(href, /[?&]deposit_ack=ok\b/, `${href} lost its notice`);
    checked += 1;
  }
  assert.equal(checked, inputs.length, `expected ${inputs.length} inputs checked, got ${checked}`);
});

test('the tab the supplier was on is the tab they come back to', () => {
  for (const tab of VENDOR_CLIENT_TABS) {
    const back = depositAnswerReturnTo(
      `/vendor-dashboard/clients/${EVENT}?tab=${tab}`,
      EVENT,
      { deposit_ack: 'ok' },
    );
    const expected = tab === 'chat' ? MONEY_TAB : tab;
    assert.equal(
      back,
      vendorClientTabHref(EVENT, expected, { deposit_ack: 'ok' }),
      `?tab=${tab} came back to ${back}`,
    );
  }
});

test('an answer given FROM the conversation stays in the conversation', () => {
  const back = depositAnswerReturnTo(THREAD_PATH, EVENT, { deposit_ack: 'ok' });
  assert.equal(back, `${THREAD_PATH}?deposit_ack=ok`);
});

test('return_to is an allow-list of two shapes — never an arbitrary redirect', () => {
  const HOSTILE = [
    'https://evil.example/steal',
    '//evil.example/steal',
    'http://vendor-dashboard/messages/abc',
    '/vendor-dashboard/messages/abc/../../admin',
    '/admin/payments',
    '/dashboard/other-event/vendors',
    // Another event's client page: a real path, the WRONG booking.
    '/vendor-dashboard/clients/00000000-0000-0000-0000-000000000000?tab=payments',
    `/vendor-dashboard/clients/${EVENT}?tab=../../admin`,
    `/vendor-dashboard/clients/${EVENT}?tab=made-up`,
    { toString: () => THREAD_PATH },
  ];
  let refused = 0;
  for (const raw of HOSTILE) {
    const back = depositAnswerReturnTo(raw, EVENT, { deposit_ack: 'ok' });
    assert.equal(
      back,
      vendorClientTabHref(EVENT, MONEY_TAB, { deposit_ack: 'ok' }),
      `${String(raw)} was honoured → ${back}`,
    );
    refused += 1;
  }
  assert.equal(refused, HOSTILE.length, `expected ${HOSTILE.length} refusals, got ${refused}`);

  // And the reader that feeds it refuses the same things.
  assert.equal(tabOfClientPath('https://evil.example?tab=payments', EVENT), null);
  assert.equal(tabOfClientPath(`/vendor-dashboard/clients/${EVENT}?tab=payments`, EVENT), 'payments');
});

test('both deposit actions redirect through the rule, and neither hard-codes a tab-less path', () => {
  const src = read('app/vendor-dashboard/clients/[eventId]/actions.ts');
  const uses = src.match(/depositAnswerReturnTo\(formData\.get\('return_to'\), eventId/g) ?? [];
  assert.equal(uses.length, 2, `expected confirm + refuse to use the rule, found ${uses.length}`);
  // ⚠ Pinned on the PROPERTY — the symbol comes from the rule module — and NOT
  // on the exact import line, which is what this assertion was until a second
  // symbol (`vendorClientSurfaceHref`) joined the same import and turned it red
  // without anything being wrong. A phrasing ban convicts innocent code.
  assert.match(
    src,
    /import \{[^}]*\bdepositAnswerReturnTo\b[^}]*\} from '@\/lib\/vendor-client-return'/,
    'depositAnswerReturnTo is no longer imported from the rule module',
  );

  // The two exact redirects that bounced.
  for (const gone of [/\?deposit_ack=\$\{flag\}`\)/, /\?deposit_reject=\$\{flag\}`\)/]) {
    assert.doesNotMatch(src, gone, 'a tab-less client-page redirect is back');
  }
});

test('the client page posts the tab it is on with every deposit answer', () => {
  const src = read('app/vendor-dashboard/clients/[eventId]/page.tsx');
  const posted = src.match(/name="return_to" value=\{depositReturnTo\}/g) ?? [];
  assert.equal(
    posted.length,
    3,
    `expected return_to on both Confirm forms and the refusal form, found ${posted.length}`,
  );
  // Resolved from the live tab, not a constant.
  assert.match(src, /const depositReturnTo = vendorClientTabHref\(/);
  assert.match(src, /\(rawTab as VendorClientTab\)/);

  // Every <form action={vendorAcknowledgeDeposit|vendorRejectDeposit}> on this
  // page carries one — counted against the forms themselves, so a fourth card
  // added later cannot quietly ship without it.
  const forms = src.match(/<form action=\{vendor(?:AcknowledgeDeposit|RejectDeposit)\}/g) ?? [];
  assert.equal(forms.length, posted.length, `${forms.length} deposit forms, ${posted.length} return_to inputs`);
});
