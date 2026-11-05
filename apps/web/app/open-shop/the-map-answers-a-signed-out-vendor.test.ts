/**
 * The address lookup and the pin naming WORK for a vendor who is not signed in.
 *
 * ── WHY THIS EXISTS (2026-11-05) ───────────────────────────────────────────
 * `/open-shop` renders its wizard to signed-out visitors — the account is only
 * created by the final submit. But both geocode actions in `city-actions.ts`
 * opened with `if (!user) return empty`, so for every NEW supplier (the only
 * people the wizard is for) typing an address read *"Couldn't find that — drop
 * your pin on the map instead"* and dropping the pin read *"Couldn't name that
 * spot"*. A gate that refuses everyone the page exists for looks exactly like a
 * geocoder miss, so nothing ever went red.
 *
 * The gate's real job — keeping Nominatim from becoming an open proxy — now
 * belongs to a per-IP budget (`enforceRateLimit`). This test holds both halves:
 * no session check comes back, and the budget stays in front of every lookup.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const SRC = readFileSync('app/open-shop/city-actions.ts', 'utf8');
// Comments may explain the old gate; only the code is judged.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

function body(fn: string): string {
  const start = CODE.indexOf(`export async function ${fn}`);
  assert.ok(start >= 0, `${fn} is missing from city-actions.ts`);
  const next = CODE.indexOf('export ', start + 10);
  return CODE.slice(start, next < 0 ? undefined : next);
}

test('neither geocode action asks for a session — the wizard is signed out', () => {
  assert.doesNotMatch(
    CODE,
    /auth\.getUser\(|getSession\(|if \(!user\)/,
    'a session check is back in city-actions.ts — every new supplier on /open-shop is ' +
      'signed out, so the lookup returns empty for all of them',
  );
});

for (const fn of ['detectShopCity', 'locateShopAddress']) {
  test(`${fn} spends the per-IP budget before it calls the geocoder`, () => {
    const b = body(fn);
    const gate = b.indexOf('geocodeAllowed()');
    const call = Math.max(b.indexOf('reverseGeocodeNominatim('), b.indexOf('geocodeAddressWithCity('));
    assert.ok(gate >= 0, `${fn} calls the geocoder with no rate limit — an open proxy to Nominatim`);
    assert.ok(call > gate, `${fn} reaches the geocoder before the rate limit is checked`);
  });
}

test('the budget is keyed on the caller IP through the shared limiter', () => {
  assert.match(CODE, /enforceRateLimit\(GEOCODE_BUCKET, clientIp\(await headers\(\)\), GEOCODE_LIMIT\)/);
});
