/**
 * Guard for the generated AI-crawler surface `/llms.txt`.
 *
 * REPLACES `llms-price-drift.test.ts` + `llms-price-fixture.ts`, which asserted
 * that a hand-typed FILE matched a hand-typed ALLOW-LIST. Both sides were typed
 * by a human, neither was ever compared to the catalog, so the pair drifted
 * together and CI stayed green for three weeks while the file advertised a
 * product structure that no longer existed.
 *
 * The old check also tested SET MEMBERSHIP — "does this figure appear anywhere
 * in the catalog?" — which structurally cannot catch a price attached to the
 * WRONG product, nor a retired product still being sold. Those are the failures
 * that actually happened. So this file tests the RENDERER instead: feed it rows
 * (including retired ones) and assert what it does and does not emit.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  renderLlmsTxt,
  buildPriceBook,
  aiLadder,
  peso,
  MissingSkuError,
  RetiredSkuError,
  LINKED_ROUTES,
  type LlmsTxtInput,
  type RetailRow,
} from './llms-txt';
import { KNOWN_PUBLIC_ROUTES } from './seo/health-checks';

/** Mirrors the shape of live prod on 2026-07-31, retired rows included. */
const RETAIL: RetailRow[] = [
  // --- active ---
  { service_code: 'COUPLE_WEBSITE_PRO', title: 'Couple Website PRO', retail_price_php: 3500, is_active: true },
  { service_code: 'PAPIC_GUEST_10K', title: 'Papic — add 10,000 shots', retail_price_php: 3000, is_active: true },
  { service_code: 'LIVE_STUDIO', title: 'Live Studio', retail_price_php: 2999, is_active: true },
  { service_code: 'PAKANTA', title: 'Pakanta', retail_price_php: 2500, is_active: true },
  // is_active:false since 2026-08-11 — owner set the wall FREE, so the paid row
  // is retired and the prose says "free". See the fixture note on
  // PAPIC_ADDON_STORIES: this file is a SECOND hand-typed copy of the catalog and
  // must move in the same PR as the real one, or the suite passes green while
  // production serves the fallback stub.
  { service_code: 'LIVE_WALL', title: 'Live Venue Photo Wall', retail_price_php: 2500, is_active: false },
  { service_code: 'PAPIC_ADDON_THANK_YOU', title: 'Thank You', retail_price_php: 2499, is_active: true },
  // Retired 2026-08-11 with the one-product model — kept in the fixture, and
  // INACTIVE, so the 'a retired SKU must not be advertised' guard has a real
  // case to catch rather than a hypothetical one.
  { service_code: 'PAPIC_GUEST_6K', title: 'Papic — add 6,000 shots', retail_price_php: 2000, is_active: false },
  { service_code: 'PAPIC_GUEST_100', title: 'Papic — add 100 shots', retail_price_php: 50, is_active: true },
  { service_code: 'PAPIC_GUEST_20K', title: 'Papic — add 20,000 shots', retail_price_php: 5000, is_active: true },
  // is_active:false since 2026-08-11 — taken off sale (PR #4354, migration
  // 20271132214645) because the ₱2,000 add-on sold nothing: the story maker is
  // owner-locked FREE and no code read whether it was bought. Prod-verified.
  // ⚠ THIS FIXTURE IS HAND-WRITTEN AND DID NOT KNOW. It still said is_active:true
  // after the row went dark in production, so the whole suite passed green while
  // llms-txt.ts was one rebuild away from throwing RetiredSkuError and serving
  // its fallback stub. A fixture is a SECOND hand-typed copy of the catalog —
  // when a SKU's is_active changes in prod, it must change here in the same PR.
  { service_code: 'PAPIC_ADDON_STORIES', title: 'Stories', retail_price_php: 2000, is_active: false },
  { service_code: 'PATIKTOK_COMPILER', title: 'Patiktok', retail_price_php: 1500, is_active: true },
  { service_code: 'SEATING_3D', title: '3D Plan', retail_price_php: 1500, is_active: true },
  { service_code: 'SETNAYAN_AI', title: 'Setnayan AI', retail_price_php: 1499, is_active: true },
  { service_code: 'PABATI', title: 'Pabati', retail_price_php: 1299, is_active: true },
  { service_code: 'PAPIC_GUEST', title: 'Papic Pool — add 3,000 shots', retail_price_php: 1000, is_active: true },
  { service_code: 'ANIMATED_MONOGRAM', title: 'Animated Monogram', retail_price_php: 1000, is_active: true },
  // KWENTO is FREE since 2026-08-21 (owner: "kwento is free") — its row is
  // deactivated in prod by migration 20271156242842, and this fixture is a
  // second hand-typed copy of that catalog which CI reads instead of the
  // database. Kept listed, inactive, so the change is legible here rather than
  // looking like an accidental deletion — same convention as the rows below.
  { service_code: 'KWENTO', title: 'Kwento', retail_price_php: 299, is_active: false },
  { service_code: 'PAPIC_ONE_100', title: 'Papic One — 100 shots', retail_price_php: 100, is_active: false },
  { service_code: 'PAPIC_CAMERA_MINI_DAY', title: 'Papic One — 50 shots', retail_price_php: 50, is_active: false },
  { service_code: 'CUSTOM_QR_GUEST', title: 'Custom QR per Guest', retail_price_php: 0, is_active: true },
  // --- AI tier ladder: price-source rows, inactive BY DESIGN ---
  { service_code: 'SETNAYAN_AI_B', title: 'Setnayan AI (Tier B)', retail_price_php: 899, is_active: false },
  { service_code: 'SETNAYAN_AI_C', title: 'Setnayan AI (Tier C)', retail_price_php: 499, is_active: false },
  { service_code: 'SETNAYAN_AI_D', title: 'Setnayan AI (Tier D)', retail_price_php: 99, is_active: false },
  // --- genuinely retired: must never surface ---
  { service_code: 'EVENT_SUBDOMAIN', title: 'Custom Subdomain', retail_price_php: 999, is_active: false },
  { service_code: 'CAMERA_BRIDGE', title: 'Camera Bridge', retail_price_php: 500, is_active: false },
  { service_code: 'PANOOD_SYSTEM_MOBILE', title: 'Live Studio — Mobile', retail_price_php: 1500, is_active: false },
  { service_code: 'PANOOD_SYSTEM', title: 'Live Studio', retail_price_php: 2500, is_active: false },
  { service_code: 'LIVE_STUDIO_ROAM', title: 'Live Studio Roam', retail_price_php: 3500, is_active: false },
  { service_code: 'PAPIC_SEATS', title: 'Papic (5 Seats)', retail_price_php: 2999, is_active: false },
  { service_code: 'PAPIC_CAMERA_UNLIMITED_DAY', title: 'Papic Max', retail_price_php: 200, is_active: false },
];

const VENDOR = [
  { sku_code: 'solo_vendor_monthly', title: 'Solo (28d)', price_php: 1000, is_active: true },
  { sku_code: 'solo_vendor_annual', title: 'Solo (yr)', price_php: 10000, is_active: true },
  { sku_code: 'pro_vendor_monthly', title: 'Pro (28d)', price_php: 2500, is_active: true },
  { sku_code: 'pro_vendor_annual', title: 'Pro (yr)', price_php: 25000, is_active: true },
  { sku_code: 'enterprise_vendor_monthly', title: 'Ent (28d)', price_php: 8000, is_active: true },
  { sku_code: 'enterprise_vendor_annual', title: 'Ent (yr)', price_php: 80000, is_active: true },
  { sku_code: 'vendor_branch_28day', title: 'Branch', price_php: 999, is_active: true },
];

const INPUT: LlmsTxtInput = { retail: RETAIL, vendor: VENDOR, refreshedOn: '2026-07-31' };

/** Peso figures in the rendered body, deduped. */
function figures(body: string): Set<string> {
  return new Set(body.match(/₱[0-9][0-9,]*/g) ?? []);
}

test('every ACTIVE retail price is quoted somewhere in the file', () => {
  const body = renderLlmsTxt(INPUT);
  const found = figures(body);
  for (const row of RETAIL.filter((r) => r.is_active)) {
    const want = peso(Number(row.retail_price_php));
    assert.ok(found.has(want), `${row.service_code} (${want}) is active but never appears in llms.txt`);
  }
});

test('every quoted figure traces back to a catalog row — no invented numbers', () => {
  const body = renderLlmsTxt(INPUT);
  const known = new Set<string>([
    ...RETAIL.map((r) => peso(Number(r.retail_price_php))),
    ...VENDOR.map((r) => peso(Number(r.price_php))),
  ]);
  for (const fig of figures(body)) {
    assert.ok(known.has(fig), `llms.txt quotes ${fig}, which matches no catalog row`);
  }
});

test('RETIRED products never appear — the 2026-07-31 drift cases', () => {
  const body = renderLlmsTxt(INPUT);

  // Camera Bridge was is_active=false while llms.txt still sold it at ₱500/day.
  assert.ok(!/Camera Bridge/i.test(body), 'Camera Bridge is retired and must not be advertised');

  // Live Studio was sold as a Mobile/Desktop device split. That split is retired;
  // it is ONE SKU now. Guard the STRUCTURE, not just the numbers — the old prices
  // (₱1,299 / ₱2,499) still exist elsewhere in the catalog, which is precisely
  // why a set-membership check could never catch this.
  assert.ok(!/Live Studio Mobile/i.test(body), 'the Live Studio device split is retired');
  assert.ok(!/Live Studio Desktop/i.test(body), 'the Live Studio device split is retired');
  assert.ok(!/Papic Max/i.test(body), 'Papic Max is retired');
  assert.ok(!/5 Seats/i.test(body), 'Papic 5-Seats is retired');

  // Papic Pool repriced charm → round. The old figures must be gone.
  assert.ok(!body.includes('₱1,999'), 'Papic Pool 6k is ₱2,000 now, not ₱1,999');
});

test('the Setnayan AI ladder renders all four priced tiers, despite B/C/D being inactive', () => {
  const body = renderLlmsTxt(INPUT);
  for (const php of [1499, 899, 499, 99]) {
    assert.ok(body.includes(peso(php)), `AI tier price ${peso(php)} missing from llms.txt`);
  }
  // The bug this replaces: filtering on is_active flattened the ladder to ₱1,499.
  const ladder = aiLadder(buildPriceBook(INPUT));
  assert.deepEqual(
    ladder.map((t) => t.php),
    [1499, 899, 499, 99],
  );
});

test('every linked route is in the audit KNOWN_PUBLIC_ROUTES set', () => {
  for (const route of LINKED_ROUTES) {
    assert.ok(
      KNOWN_PUBLIC_ROUTES.has(route),
      `llms.txt links ${route}, which the SEO audit does not consider public`,
    );
  }
});

test('every link in the rendered body resolves to an allow-listed route', () => {
  const body = renderLlmsTxt(INPUT);
  const allowed = new Set<string>(LINKED_ROUTES);
  for (const m of body.matchAll(/https:\/\/www\.setnayan\.com(\/[^\s)\]]*)?/g)) {
    const path = m[1] ?? '/';
    const anchored = path.startsWith('/v/') ? '/v/' : path;
    assert.ok(allowed.has(anchored), `llms.txt links ${path}, which is not in LINKED_ROUTES`);
  }
});

test('a missing SKU refuses to render, and names EVERY missing code at once', () => {
  // ⚠ KWENTO was one of the two codes stripped here until 2026-08-21. It is no
  // longer in REQUIRED_RETAIL (it is free), so removing it proves nothing —
  // the assertion would have gone on passing while testing one code instead of
  // two. Swapped for PABATI, which is still required.
  const stripped = RETAIL.filter(
    (r) => r.service_code !== 'PAKANTA' && r.service_code !== 'PABATI',
  );
  assert.throws(
    () => renderLlmsTxt({ ...INPUT, retail: stripped }),
    (err: unknown) => {
      assert.ok(err instanceof MissingSkuError);
      assert.deepEqual([...err.codes].sort(), ['PABATI', 'PAKANTA']);
      return true;
    },
    'a catalog missing a named SKU must throw rather than emit a half-true file',
  );
});

test('a reprice propagates without touching this repo', () => {
  const repriced = RETAIL.map((r) =>
    r.service_code === 'PAKANTA' ? { ...r, retail_price_php: 3200 } : r,
  );
  const body = renderLlmsTxt({ ...INPUT, retail: repriced });
  assert.ok(body.includes('₱3,200'), 'a catalog reprice must appear in llms.txt with no code change');
  assert.ok(!body.includes('₱2,500 . Custom Filipino'), 'the old Pakanta price must be gone');
});

// ─── A RETIRED SKU MUST STOP BEING ADVERTISED ──────────────────────────────
// Added 2026-08-11 with the EVENT_SUBDOMAIN retirement. The catalog flag alone
// never removed a product from this file — the prose and REQUIRED_RETAIL are
// hand-written, so `is_active = FALSE` left the SKU advertised with a live
// price to every AI assistant reading llms.txt. This module's docblock records
// two earlier cases (Camera Bridge; the retired Live Studio device split) that
// shipped exactly that way, green.

test('the retired subdomain is gone from the rendered file', () => {
  const out = renderLlmsTxt(INPUT);
  assert.ok(
    !/Custom Subdomain/i.test(out),
    'llms.txt still advertises the Custom Subdomain. It was taken off sale ' +
      '2026-08-11 (owner 2026-08-10) and no address ever resolved.',
  );
  assert.ok(
    !/setnayan\.com\/?\)?\s*$|yourname\.setnayan\.com/i.test(out),
    'llms.txt still promises a yourname.setnayan.com address. Nothing resolves it.',
  );
});

test('the monogram no longer promises the LED background', () => {
  const out = renderLlmsTxt(INPUT);
  assert.ok(
    /Animated Monogram/.test(out),
    'The Animated Monogram is still on sale and must still be listed — only its ' +
      'LED claim was removed.',
  );
  assert.ok(
    !/includes the LED Live Background/i.test(out),
    'llms.txt still claims the monogram includes the LED Live Background. The LED ' +
      'wall backdrop was REMOVED from the product on 2026-08-11 — no maker, no ' +
      'renderer, nothing to include — so this sentence advertises a thing that ' +
      'does not exist to every model that reads this file.',
  );
});

test('advertising a SKU that is off sale REFUSES to render', () => {
  // 🔑 THE MUTATION IS THE TEST. Flip a prose-named SKU to inactive and the
  // build must refuse rather than quietly keep selling it. If this ever passes
  // without throwing, the guard is decoration and the drift is back.
  const retired = {
    ...INPUT,
    retail: INPUT.retail.map((r) =>
      r.service_code === 'PABATI' ? { ...r, is_active: false } : r,
    ),
  };
  assert.throws(
    () => renderLlmsTxt(retired),
    (err: unknown) => {
      assert.ok(err instanceof RetiredSkuError, `expected RetiredSkuError, got ${err}`);
      assert.match((err as Error).message, /PABATI/);
      return true;
    },
    'A SKU named in the prose was taken off sale and llms.txt rendered anyway — ' +
      'which is how Camera Bridge stayed advertised after retirement.',
  );
});

test('the deliberately-inactive AI ladder rows do NOT trip the refusal', () => {
  // ⚠ A guard that cries wolf gets skimmed past. Tiers B/C/D are inactive BY
  // DESIGN as price sources and are resolved through AI_TIER_SKU, never named in
  // the prose — so the baseline INPUT (which contains all three) must render.
  assert.doesNotThrow(() => renderLlmsTxt(INPUT));
});
