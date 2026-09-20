/**
 * signup-intent.test.ts — the couple door stays a couple door.
 *
 * This guard EXECUTES the decision rather than grepping `/signup/page.tsx`.
 * That split is the whole point of the sibling module: a server component can't
 * be rendered by a unit test, so a source-scan guard would have to recognise
 * 'customer' inside a branch it never takes — and the bug this fixes was
 * precisely a branch nobody took (`as=couple` arriving, and being ignored).
 *
 * ⚠ The FIRST test is the owner's sentence, not a style preference. If it goes
 * red, an NFC tap is asking a couple whether they are a vendor again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  accountTypeForSignup,
  showsCoupleConsent,
  type SignupAccountType,
} from './signup-intent';

test('an NFC vendor card signs somebody up as a couple — the thing the owner tapped', () => {
  // The literal param the five couple-intent entries send, verbatim from
  // /vendor-invite/[slug]/page.tsx: `/signup?as=couple&next=…`.
  assert.equal(accountTypeForSignup('couple'), 'customer');
});

test('a bare /signup is a couple too — owner-locked 2026-09-20', () => {
  // Somebody typing the address, or arriving from the front door with no intent
  // attached. Before this change they were asked; now the main door assumes a
  // person, and vendors arrive through their own.
  assert.equal(accountTypeForSignup(undefined), 'customer');
});

test('the direct vendor application still works — it is the ONE way in', () => {
  assert.equal(accountTypeForSignup('vendor'), 'vendor');
});

test('only the exact word opens the vendor door', () => {
  // Case, whitespace and near-misses all fail CLOSED. A stranger cannot talk
  // themselves into a vendor account by editing the address bar, and a typo in
  // one of our own links degrades to a customer rather than to a wrong role.
  for (const junk of ['Vendor', 'VENDOR', ' vendor', 'vendor ', 'vendors', 'v', '', 'customer']) {
    assert.equal(
      accountTypeForSignup(junk),
      'customer',
      `"${junk}" must not produce a vendor account`,
    );
  }
});

test('a repeated ?as= param does not become a vendor', () => {
  // Next.js types a repeated search param as `string[]`, and `['vendor'] ===
  // 'vendor'` is false — but only because the comparison is strict. Pinned so a
  // later "helpful" loosening to `String(as)` or `as?.includes('vendor')` is
  // caught here instead of in production: `/signup?as=couple&as=vendor` would
  // hand a vendor account to somebody who tapped a couple's link.
  assert.equal(accountTypeForSignup(['vendor']), 'customer');
  assert.equal(accountTypeForSignup(['couple', 'vendor']), 'customer');
});

test('the couple consent block follows the account type, not a CSS selector', () => {
  // The Public Event Summary consent (RA 10173 safe-harbour, locked 2026-05-19)
  // is a question about showcasing a WEDDING. It used to hide itself with a
  // `:has(input[value='vendor']:checked)` rule aimed at the radio — a selector
  // that, with the radio deleted, can never match. Asked of a vendor it is
  // nonsense; worse, a ticked box would be a consent nobody meaningfully gave.
  assert.equal(showsCoupleConsent('couple'), true);
  assert.equal(showsCoupleConsent(undefined), true);
  assert.equal(showsCoupleConsent('vendor'), false);
});

test('the two helpers can never disagree about one sign-up', () => {
  // showsCoupleConsent is defined in terms of accountTypeForSignup today. If
  // somebody re-implements it standalone, this catches the drift — a vendor
  // being shown the couple consent, or a couple being denied it.
  for (const as of [undefined, 'couple', 'vendor', 'Vendor', '', 'nonsense']) {
    const type: SignupAccountType = accountTypeForSignup(as);
    assert.equal(
      showsCoupleConsent(as),
      type === 'customer',
      `consent visibility and account type disagree for as=${String(as)}`,
    );
  }
});
