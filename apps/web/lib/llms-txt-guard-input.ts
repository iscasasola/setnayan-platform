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
 *
 * ─── PROVENANCE — WHEN THIS WAS LAST TRUE, AND HOW TO RE-CHECK ──────────────
 * 🔑 CAPTURED 2026-08-31 from the LIVE catalogue, Supabase project
 * `njrupjnvkjkitfctetvi` (setnayan-prod):
 *
 *     select service_code, title, retail_price_php, is_active
 *       from public.platform_retail_catalog_v2
 *      order by service_code;
 *
 * A fixture with no provenance rots INVISIBLY, and this one had. When it was
 * lifted out of `llms-txt.test.ts` it was carrying, unnoticed and green:
 *   · the whole Papic ladder ~40% UNDER production (₱50 where prod says ₱70,
 *     ₱11,200 where prod says ₱15,000 — every one of the seventeen rungs),
 *   · every title in the RETIRED CURRENCY WORD rather than "credits", and
 *   · the Setnayan AI ladder shifted a whole rung (1499/899/499/99 against
 *     production's 2499/1499/899/199).
 *
 * ⚠ THE VOCABULARY IS AN OWNER RULING, NOT A PREFERENCE (2026-08-29, commit
 * 32df56e81). ONLY the CURRENCY meaning moved — a photograph is still "a shot",
 * and the vendor's shot list is deliberately untouched. A product you BUY is the
 * currency meaning. `public-copy-is-not-wedding-only.test.ts` now enforces this
 * on every ACTIVE title here, so the fixture cannot fall a vocabulary behind again.
 *
 * 🔑 NOTHING SHIPPED WAS WRONG, AND THAT IS THE WHOLE POINT. Every figure in
 * `llms-txt.ts` resolves from the catalogue at render, and `AI_TIER_FALLBACK_PHP`
 * in `setnayan-ai-type-pricing.ts` matches production exactly (checked the same
 * day). The defect was never a wrong price on the page — it was a GUARD THAT
 * COULD NOT DETECT ONE, because its reference reality was a reprice behind.
 *
 * ⚠ THE `is_active: false` ROWS BELOW ARE NOT A MIRROR OF PRODUCTION AND MUST
 * NOT BE "CORRECTED" TO MATCH IT. Most of them (EVENT_SUBDOMAIN, CAMERA_BRIDGE,
 * PANOOD_SYSTEM*, LIVE_STUDIO_ROAM, PAPIC_SEATS, PAPIC_CAMERA_UNLIMITED_DAY,
 * KWENTO, PAPIC_ADDON_STORIES, LIVE_WALL, PAPIC_ONE_100) no longer have a
 * catalogue row at all. They are NEGATIVE fixtures: retired products fed in
 * deliberately so the guards can prove the renderer never surfaces one. Deleting
 * them would silently gut "the retired subdomain is gone", "Camera Bridge",
 * "Papic Max" and "5 Seats". The ACTIVE rows mirror production; the inactive
 * ones are the test's own evidence.
 *
 * ⛔ AND A RETIRED ROW'S TITLE READS `(retired — see service_code)`, NOT ITS OLD
 * PRODUCT NAME. `papic-is-one-service.test.ts` bans the strings "Papic One" and
 * "Papic Pool" from every non-`.test.ts` file under `app/` and `lib/`, and it
 * caught this file within minutes of the fixture moving here — correctly.
 *
 * 🔑 THE GUARD IS RIGHT AND NOTHING WAS WEAKENED TO SATISFY IT. No exemption was
 * added, no allow-list, and the file was NOT renamed back under the `.test.ts`
 * blind spot to hide. The titles simply are not needed: `llms-txt.ts` renders
 * `service_code`, `retail_price_php` and `is_active` and **never reads a title
 * at all**, so a retired product's old name was decoration in non-test source —
 * and deleting it is complying with the guard, not evading it. The retired-SKU
 * assertions in `llms-txt.test.ts` carry their own literals, inside a test file,
 * where naming a dead product is exactly right.
 *
 * ⚠ ACTIVE titles still mirror the catalogue exactly, and the db guard compares
 * them. This applies ONLY to rows that are `is_active: false`.
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
  { service_code: 'PAPIC_GUEST_100', title: 'Papic — add 100 credits', retail_price_php: 70, is_active: true },
  { service_code: 'PAPIC_GUEST_200', title: 'Papic — add 200 credits', retail_price_php: 140, is_active: true },
  { service_code: 'PAPIC_GUEST_300', title: 'Papic — add 300 credits', retail_price_php: 210, is_active: true },
  { service_code: 'PAPIC_GUEST_400', title: 'Papic — add 400 credits', retail_price_php: 280, is_active: true },
  { service_code: 'PAPIC_GUEST_500', title: 'Papic — add 500 credits', retail_price_php: 350, is_active: true },
  { service_code: 'PAPIC_GUEST_1K', title: 'Papic — add 1,000 credits', retail_price_php: 700, is_active: true },
  { service_code: 'PAPIC_GUEST_2K', title: 'Papic — add 2,000 credits', retail_price_php: 1400, is_active: true },
  { service_code: 'PAPIC_GUEST', title: 'Papic — add 3,000 credits', retail_price_php: 1680, is_active: true },
  { service_code: 'PAPIC_GUEST_4K', title: 'Papic — add 4,000 credits', retail_price_php: 2240, is_active: true },
  { service_code: 'PAPIC_GUEST_5K', title: 'Papic — add 5,000 credits', retail_price_php: 2800, is_active: true },
  { service_code: 'PAPIC_GUEST_7K', title: 'Papic — add 7,000 credits', retail_price_php: 3920, is_active: true },
  { service_code: 'PAPIC_GUEST_10K', title: 'Papic — add 10,000 credits', retail_price_php: 4500, is_active: true },
  { service_code: 'PAPIC_GUEST_30K', title: 'Papic — add 30,000 credits', retail_price_php: 10800, is_active: true },
  { service_code: 'PAPIC_GUEST_50K', title: 'Papic — add 50,000 credits', retail_price_php: 15000, is_active: true },
  // The 100,000 anchor (owner 2026-08-29). Its price here is the FIXTURE's,
  // not production's — this file only proves the ladder renders every rung it
  // declares, and pinning a live figure in a fixture is how the last drift
  // started. The real price lives in the catalog.
  { service_code: 'PAPIC_GUEST_100K', title: 'Papic — add 100,000 credits', retail_price_php: 24000, is_active: true },
  // ₱1,500 since 2026-09-02 (migration 20271192082215). This row is the SECOND
  // hand-typed copy of the catalog — `llms-fixture-matches-the-catalog.db.test.ts`
  // pins it to the replayed catalog precisely so a reprice cannot land in one place
  // only. It moved in the same PR as the real one, which is the rule the neighbouring
  // fixtures already state.
  { service_code: 'LIVE_STUDIO', title: 'Live Studio', retail_price_php: 1500, is_active: true },
  // Optional "Setnayan supplies the channel" upsell (owner ruling 2026-09-02),
  // seeded by migration 20271192528988. STACKS on LIVE_STUDIO — this file is a
  // SECOND hand-typed copy of the catalog and must move in the same PR as the
  // real one, same rule as every neighbouring fixture row here.
  { service_code: 'LIVE_STUDIO_HOSTED_CHANNEL', title: 'Live Studio — hosted channel', retail_price_php: 1500, is_active: true },
  { service_code: 'PAKANTA', title: 'Pakanta', retail_price_php: 2500, is_active: true },
  // is_active:false since 2026-08-11 — owner set the wall FREE, so the paid row
  // is retired and the prose says "free". See the fixture note on
  // PAPIC_ADDON_STORIES: this file is a SECOND hand-typed copy of the catalog and
  // must move in the same PR as the real one, or the suite passes green while
  // production serves the fallback stub.
  { service_code: 'LIVE_WALL', title: 'Live Venue Photo Wall', retail_price_php: 2500, is_active: false },
  { service_code: 'PAPIC_ADDON_THANK_YOU', title: 'Thank You (Papic Add-on)', retail_price_php: 2500, is_active: true },
  // ⚠ 6,000 IS BACK ON THE LADDER (owner 2026-08-26, ₱2,400) after being retired
  // on 2026-08-11. It was the fixture's example of a retired SKU; that role now
  // belongs to PAPIC_ADDON_STORIES and LIVE_WALL below, so the 'a retired SKU
  // must not be advertised' guard still has real cases to catch.
  { service_code: 'PAPIC_GUEST_6K', title: 'Papic — add 6,000 credits', retail_price_php: 3360, is_active: true },
  { service_code: 'PAPIC_GUEST_20K', title: 'Papic — add 20,000 credits', retail_price_php: 7200, is_active: true },
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
  { service_code: 'SETNAYAN_AI', title: 'Setnayan AI', retail_price_php: 2499, is_active: true },
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
  { service_code: 'PAPIC_ONE_100', title: '(retired — see service_code)', retail_price_php: 100, is_active: false },
  { service_code: 'PAPIC_CAMERA_MINI_DAY', title: '(retired — see service_code)', retail_price_php: 50, is_active: false },
  { service_code: 'CUSTOM_QR_GUEST', title: 'Custom QR per Guest', retail_price_php: 0, is_active: true },
  // --- AI tier ladder: price-source rows, inactive BY DESIGN ---
  { service_code: 'SETNAYAN_AI_B', title: 'Setnayan AI (Tier B · major milestone)', retail_price_php: 1499, is_active: false },
  { service_code: 'SETNAYAN_AI_C', title: 'Setnayan AI (Tier C · standard event)', retail_price_php: 899, is_active: false },
  { service_code: 'SETNAYAN_AI_D', title: 'Setnayan AI (Tier D · light)', retail_price_php: 199, is_active: false },
  // --- present in production, inactive, and NEVER named in the prose ---
  // ⚠ ADDED 2026-08-31 by the full fixture-vs-catalogue diff. The fixture had
  // never carried them, so nothing proved the renderer keeps them out — and
  // `activeRetail` is the only thing that does. SETNAYAN_AI_RENEW matters most:
  // it is a FIFTH Setnayan AI price (₱799) sitting beside the four-rung ladder,
  // exactly the shape that flattened the ladder before.
  { service_code: 'SETNAYAN_AI_RENEW', title: 'Setnayan AI (renewal)', retail_price_php: 799, is_active: false },
  { service_code: 'PAPIC_CAMERA_LTD_DAY', title: 'Papic Ltd (per camera, per day)', retail_price_php: 50, is_active: false },
  { service_code: 'PAPIC_CAMERA_ROLL_DAY', title: 'Papic Mini (legacy roll · per camera, per day)', retail_price_php: 100, is_active: false },
  // --- genuinely retired: must never surface ---
  { service_code: 'EVENT_SUBDOMAIN', title: 'Custom Subdomain', retail_price_php: 999, is_active: false },
  { service_code: 'CAMERA_BRIDGE', title: 'Camera Bridge', retail_price_php: 500, is_active: false },
  { service_code: 'PANOOD_SYSTEM_MOBILE', title: 'Live Studio — Mobile', retail_price_php: 1500, is_active: false },
  { service_code: 'PANOOD_SYSTEM', title: 'Live Studio', retail_price_php: 2500, is_active: false },
  { service_code: 'LIVE_STUDIO_ROAM', title: 'Live Studio Roam', retail_price_php: 3500, is_active: false },
  { service_code: 'PAPIC_SEATS', title: 'Papic (5 Seats)', retail_price_php: 2999, is_active: false },
  { service_code: 'PAPIC_CAMERA_UNLIMITED_DAY', title: 'Papic Max (per camera, per day)', retail_price_php: 200, is_active: false },
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
