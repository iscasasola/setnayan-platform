/**
 * isVendorRankBoostEnabled() — the launch flag for merit-first ranking + the
 * capped paid boost + labeled Featured slots.
 *
 * Pins the DARK-BY-DEFAULT contract: with the variable unset — the state of
 * every environment today — the flag reads false, so `category-search.ts` takes
 * the untouched owner-locked 2026-05-31 ladder, issues no extra query, and
 * stamps `featuredSlot: false` on every row. Nothing about the marketplace
 * changes until someone deliberately sets this.
 *
 * Opt-in vocabulary follows the dominant repo convention ('true' | '1' |
 * 'TRUE'); everything else — including 'false', 'yes', and whitespace — stays
 * OFF, so a typo can never accidentally sell top-of-page slots.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isVendorRankBoostEnabled } from './vendor-rank-boost-flag';

const KEY = 'NEXT_PUBLIC_VENDOR_RANK_BOOST_ENABLED';

function withEnv(value: string | undefined, fn: () => void) {
  const prev = process.env[KEY];
  try {
    if (value === undefined) delete process.env[KEY];
    else process.env[KEY] = value;
    fn();
  } finally {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  }
}

test('OFF by default — unset means the marketplace behaves exactly as today', () => {
  withEnv(undefined, () => assert.equal(isVendorRankBoostEnabled(), false));
});

test("ON only for the explicit opt-in values 'true' / '1' / 'TRUE'", () => {
  for (const on of ['true', '1', 'TRUE']) {
    withEnv(on, () =>
      assert.equal(isVendorRankBoostEnabled(), true, `expected ${on} to enable`),
    );
  }
});

test('every other value stays OFF — a typo never sells a Featured slot', () => {
  for (const off of ['false', 'FALSE', '0', '', ' ', 'yes', 'on', 'True', ' true']) {
    withEnv(off, () =>
      assert.equal(
        isVendorRankBoostEnabled(),
        false,
        `expected ${JSON.stringify(off)} to stay dark`,
      ),
    );
  }
});
