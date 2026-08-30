/**
 * THE ONE HAND-TYPED COPY OF THE CATALOG — shared by every guard that renders
 * llms.txt.
 *
 * ⚠ IT USED TO LIVE INSIDE `llms-txt.test.ts`, and it moved here the moment a
 * SECOND guard needed it (`public-copy-is-not-wedding-only.test.ts`, 2026-08-31).
 * That file's own comments say, four times over, that a hand-written fixture is
 * a second copy of the catalog which drifts silently — so the answer to a third
 * reader is NEVER a third copy. Import this. Do not paste rows.
 *
 * ⚠ EVERYTHING THE ORIGINAL COMMENTS WARN ABOUT STILL APPLIES, verbatim: when a
 * SKU's price or `is_active` changes in production, it changes HERE in the SAME
 * PR — otherwise CI passes green while `llms-txt.ts` throws on rebuild and
 * production serves the 603-byte fallback stub. That has happened for real.
 */
import type { LlmsTxtInput, RetailRow } from './llms-txt';

/** Mirrors the shape of live prod on 2026-07-31, retired rows included. */
export const RETAIL: RetailRow[] = [
  // --- active ---
  { service_code: 'COUPLE_WEBSITE_PRO', title: 'Event Hub Pro', retail_price_php: 3500, is_active: true },
  // ── THE PAPIC LADDER, owner 2026-08-26 ──────────────────────────────────
  // ⚠ SIXTEEN ROWS, and this fixture is the SECOND hand-typed copy of the
  // catalog that this file's own docblock warns about. When a rung's price or
  // is_active changes in prod, it changes here in the SAME PR — otherwise the
  // suite passes green while llms-txt.ts throws MissingSkuError on rebuild and
  // production serves the fallback stub.
  { service_code: 'PAPIC_GUEST_100', title: 'Papic — add 100 shots', retail_price_php: 50, is_active: true },
  { service_code: 'PAPIC_GUEST_200', title: 'Papic — add 200 shots', retail_price_php: 100, is_active: true },
  { service_code: 'PAPIC_GUEST_300', title: 'Papic — add 300 shots', retail_price_php: 150, is_active: true },
  { service_code: 'PAPIC_GUEST_400', title: 'Papic — add 400 shots', retail_price_php: 200, is_active: true },
  { service_code: 'PAPIC_GUEST_500', title: 'Papic — add 500 shots', retail_price_php: 250, is_active: true },
  { service_code: 'PAPIC_GUEST_1K', title: 'Papic — add 1,000 shots', retail_price_php: 500, is_active: true },
  { service_code: 'PAPIC_GUEST_2K', title: 'Papic — add 2,000 shots', retail_price_php: 1000, is_active: true },
  { service_code: 'PAPIC_GUEST', title: 'Papic — add 3,000 shots', retail_price_php: 1200, is_active: true },
  { service_code: 'PAPIC_GUEST_4K', title: 'Papic — add 4,000 shots', retail_price_php: 1600, is_active: true },
  { service_code: 'PAPIC_GUEST_5K', title: 'Papic — add 5,000 shots', retail_price_php: 2000, is_active: true },
  { service_code: 'PAPIC_GUEST_7K', title: 'Papic — add 7,000 shots', retail_price_php: 2800, is_active: true },
  { service_code: 'PAPIC_GUEST_10K', title: 'Papic — add 10,000 shots', retail_price_php: 3200, is_active: true },
  { service_code: 'PAPIC_GUEST_30K', title: 'Papic — add 30,000 shots', retail_price_php: 7500, is_active: true },
  { service_code: 'PAPIC_GUEST_50K', title: 'Papic — add 50,000 shots', retail_price_php: 11200, is_active: true },
  // The 100,000 anchor (owner 2026-08-29). Its price here is the FIXTURE's,
  // not production's — this file only proves the ladder renders every rung it
  // declares, and pinning a live figure in a fixture is how the last drift
  // started. The real price lives in the catalog.
  { service_code: 'PAPIC_GUEST_100K', title: 'Papic — add 100,000 shots', retail_price_php: 24000, is_active: true },
  { service_code: 'LIVE_STUDIO', title: 'Live Studio', retail_price_php: 3000, is_active: true },
  { service_code: 'PAKANTA', title: 'Pakanta', retail_price_php: 2500, is_active: true },
  // is_active:false since 2026-08-11 — owner set the wall FREE, so the paid row
  // is retired and the prose says "free". See the fixture note on
  // PAPIC_ADDON_STORIES: this file is a SECOND hand-typed copy of the catalog and
  // must move in the same PR as the real one, or the suite passes green while
  // production serves the fallback stub.
  { service_code: 'LIVE_WALL', title: 'Live Venue Photo Wall', retail_price_php: 2500, is_active: false },
  { service_code: 'PAPIC_ADDON_THANK_YOU', title: 'Thank You', retail_price_php: 2500, is_active: true },
  // ⚠ 6,000 IS BACK ON THE LADDER (owner 2026-08-26, ₱2,400) after being retired
  // on 2026-08-11. It was the fixture's example of a retired SKU; that role now
  // belongs to PAPIC_ADDON_STORIES and LIVE_WALL below, so the 'a retired SKU
  // must not be advertised' guard still has real cases to catch.
  { service_code: 'PAPIC_GUEST_6K', title: 'Papic — add 6,000 shots', retail_price_php: 2400, is_active: true },
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
  // PABATI is GONE from this fixture on purpose. It went FREE on 2026-08-21 and
  // was RETIRED the same day ("we do not need pabati. retire it because it is
  // part of papic"), so it is no longer in REQUIRED_RETAIL and no longer named
  // in the prose. A fixture row for it would assert a catalog entry the
  // document must never read.
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

export const VENDOR = [
  { sku_code: 'solo_vendor_monthly', title: 'Solo (28d)', price_php: 1000, is_active: true },
  { sku_code: 'solo_vendor_annual', title: 'Solo (yr)', price_php: 10400, is_active: true },
  { sku_code: 'pro_vendor_monthly', title: 'Pro (28d)', price_php: 2500, is_active: true },
  { sku_code: 'pro_vendor_annual', title: 'Pro (yr)', price_php: 26000, is_active: true },
  { sku_code: 'enterprise_vendor_monthly', title: 'Ent (28d)', price_php: 10000, is_active: true },
  { sku_code: 'enterprise_vendor_annual', title: 'Ent (yr)', price_php: 104000, is_active: true },
  { sku_code: 'vendor_additional_branch', title: 'Branch', price_php: 1000, is_active: true },
];

export const INPUT_FOR_GUARDS: LlmsTxtInput = { retail: RETAIL, vendor: VENDOR, refreshedOn: '2026-07-31' };
