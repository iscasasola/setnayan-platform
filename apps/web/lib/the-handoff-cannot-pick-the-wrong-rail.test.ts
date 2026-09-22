/**
 * the-handoff-cannot-pick-the-wrong-rail.test.ts
 *
 * "Open GCash" hands a phone off to a wallet app so the payer pastes a number
 * instead of typing eleven digits. Two ways that becomes a defect, and this
 * file is here for both.
 *
 * 1. IT OPENS THE WRONG APP. The rows next to this button are bank rows too.
 *    A match that is fuzzy in any direction — lowercase, trimmed, `includes`,
 *    `startsWith` — eventually catches a provider it was never measured for,
 *    and a payer who lands in GCash for a BDO transfer sends real money down a
 *    rail nobody is watching. Exact match, or nothing.
 *
 * 2. IT SILENTLY STOPS EXISTING. The scheme table is keyed by the EXACT
 *    provider strings in `PAYMENT_PROVIDERS`. Those two lists live in
 *    different files, so renaming "GCash" there — or adding a wallet here
 *    whose spelling does not match — leaves a button that renders for nobody
 *    and a test suite that never notices, because each list still agrees with
 *    itself. 🔑 TWO MECHANISMS FOR ONE FACT EACH PASS THEIR OWN TESTS.
 *
 * What this file deliberately does NOT assert: that `gcash://` works. No test
 * can know that — it was measured on a real phone (see `lib/wallet-handoff.ts`
 * for the reading and its date) and GCash can retire it without telling us.
 * That is exactly why the number and its copy control render beside the
 * button rather than behind it, which is the third test below.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import { PAYMENT_PROVIDERS } from '@/lib/vendor-payment-methods';
import {
  WALLET_SCHEMES,
  hasWalletHandoff,
  walletFallbackFor,
  walletSchemeFor,
} from '@/lib/wallet-handoff';

const here = dirname(fileURLToPath(import.meta.url));
const appDir = join(here, '..', 'app');

test('only an exactly-spelled provider gets a handoff', () => {
  assert.equal(walletSchemeFor('GCash'), 'gcash://');

  // Every near-miss must fall through to null. If any of these starts
  // returning a scheme, the match has gone fuzzy and rule 1 above is live.
  for (const miss of [
    'BDO',
    'Maya',
    'BPI',
    'Other',
    'gcash',
    'GCASH',
    ' GCash',
    'GCash ',
    'G-Cash',
    'Not GCash',
    'GCash Business',
    '',
    null,
    undefined,
  ]) {
    assert.equal(
      walletSchemeFor(miss as string | null | undefined),
      null,
      `"${String(miss)}" must not open a wallet — money would go down the wrong rail`,
    );
    assert.equal(hasWalletHandoff(miss as string | null | undefined), false);
  }
});

test('every wallet we hand off to is a provider that can actually be selected', () => {
  for (const provider of Object.keys(WALLET_SCHEMES)) {
    assert.ok(
      PAYMENT_PROVIDERS.includes(provider),
      `"${provider}" has a scheme but is not in PAYMENT_PROVIDERS — the button ` +
        `would render for nobody. Fix the spelling in one of the two lists, ` +
        `and do not delete this assertion to go green.`,
    );
  }
});

test('nobody is stranded: a scheme always comes with somewhere else to go', () => {
  for (const provider of Object.keys(WALLET_SCHEMES)) {
    const fallback = walletFallbackFor(provider);
    assert.ok(
      typeof fallback === 'string' && fallback.startsWith('https://'),
      `"${provider}" can be opened but has no https fallback — a phone without ` +
        `the app would get a dead tap and no way forward`,
    );
  }
  // A provider with no handoff has no fallback either; there is nothing to
  // fall back FROM, and offering one would advertise a button we never render.
  assert.equal(walletFallbackFor('BDO'), null);
});

test('the number and its copy control never hide behind the handoff', () => {
  // The button can only ever SAVE a tap. If a surface ever renders the wallet
  // handoff INSTEAD of the number, the day GCash drops the scheme is the day
  // that surface stops being payable at all.
  const surfaces = [
    join(appDir, '_components', 'payment', 'payment-rails.tsx'),
    join(appDir, 'dashboard', '[eventId]', '_components', 'vendor-direct-pay.tsx'),
  ];

  for (const file of surfaces) {
    const src = stripComments(readFileSync(file, 'utf8'));
    assert.ok(
      src.includes('<OpenWalletButton'),
      `${file} should render the handoff`,
    );
    assert.ok(
      /<CopyButton|<CopyRow/.test(src),
      `${file} renders the wallet handoff but no copy control — the number must ` +
        `stay copyable beside it, not behind it`,
    );
  }
});

test('the handoff is not sold as carrying an amount', () => {
  // GCash publishes no link format that takes a payee or a figure, so no
  // scheme here may look like it does. The amount-baked QR is the only path
  // that carries money, and conflating them would have a payer believe the
  // figure travelled when it did not.
  for (const scheme of Object.values(WALLET_SCHEMES)) {
    assert.ok(
      !/[?&#]/.test(scheme),
      `"${scheme}" carries parameters — nothing measured supports that, and a ` +
        `scheme that looks like it takes an amount invites someone to add one`,
    );
  }
});
