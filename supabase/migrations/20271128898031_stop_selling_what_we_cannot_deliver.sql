-- stop_selling_what_we_cannot_deliver
-- ============================================================================
-- TWO LIVE SKUs PROMISE SOMETHING NOTHING IN THE APP CAN HAND OVER.
--
-- Read out of PROD on 2026-08-11, not out of a document:
--
--   EVENT_SUBDOMAIN      ₱999/yr   is_active = TRUE
--     "Your own web address — yourname.setnayan.com — for your wedding
--      website. Renewed yearly."
--     No such address resolves. There is no wildcard DNS and no
--     subdomain-aware routing. A couple pays ₱999 for an address that
--     goes nowhere, every year.
--     ⛔ OWNER RULED 2026-08-10: "TAKE IT OFF SALE." This implements it.
--
--   ANIMATED_MONOGRAM    ₱1,000    is_active = TRUE
--     "…and up on the LED stage screen. Includes the Live Background."
--     The monogram itself works and STAYS ON SALE. The LED half does not:
--     the maker saves a design and no step anywhere produces a file, so a
--     couple cannot hand anything to their venue. `led_background_renders`
--     exists in prod with ZERO rows and ZERO writers.
--     ⇒ The SKU is kept; the SENTENCE is corrected. Selling a working
--       product with a false inclusion is the same defect as selling a
--       product that does not exist, and it is fixed by telling the truth
--       rather than by withdrawing something that works.
--
-- ─── WHY A LABEL WAS NOT ENOUGH ─────────────────────────────────────────
-- `lib/v2-catalog.ts` already marks EVENT_SUBDOMAIN as 'partial', which
-- renders the chip "Partial · in active build" on /pricing. That chip is
-- DECORATION: `build_status` is read only by the pricing page's styling and
-- the onboarding list. It gates NO buy path. `is_active` is the only real
-- purchasability switch, and it was TRUE.
-- 🔑 A STATUS LABEL IS NOT A GATE — the same shape as a comment that
--    describes a rule nothing enforces.
--
-- ─── THE TRAP THIS MIGRATION IS WRITTEN AROUND ──────────────────────────
-- 🪤 DEACTIVATING A SKU CAN BE A NO-OP. On 2026-08-07 a catalog row was
-- deactivated and a HARDCODED fallback silently took over, so the change
-- did nothing and looked done. Checked for this one: no `EVENT_SUBDOMAIN`
-- price or entry is hardcoded anywhere in `apps/web` — the only mentions are
-- the BUILD_STATUS map (a label, updated in this PR) and the /pricing group
-- list, which renders codes from `resolvedGroups` and therefore drops an
-- inactive row automatically. Same convention already used by
-- PANOOD_SYSTEM and LIVE_BACKGROUND: the code stays LISTED so the
-- retirement is legible rather than looking like an accidental deletion.
--
-- ─── NOT TOUCHED, DELIBERATELY ──────────────────────────────────────────
-- PAPIC_ADDON_THANK_YOU (₱2,499, is_active = TRUE, nothing produces it) is
-- LEFT ON SALE because the owner ruled "BUILD IT" on 2026-08-10, and the
-- rails to build it on are real: `lib/reel-render.ts` is a 1,214-line
-- client-side 9:16 encoder already shared by two shipping products. Taking
-- it off sale would reverse an owner decision; the maker is the next PR.
-- ⚠ Until that lands, this SKU is the one remaining thing on sale that
--   nothing delivers. It is named here so the gap is on the record.
-- ============================================================================

-- ── 1. The subdomain comes off sale ─────────────────────────────────────
-- Idempotent by construction: setting FALSE twice is FALSE. Scoped by
-- service_code so it can never widen to another row.
UPDATE public.platform_retail_catalog_v2
   SET is_active  = FALSE,
       updated_at = NOW()
 WHERE service_code = 'EVENT_SUBDOMAIN'
   AND is_active IS DISTINCT FROM FALSE;

-- ── 2. The monogram stops promising the LED screen ──────────────────────
-- The replacement names only what the SKU actually delivers today. The LED
-- clause returns the day a couple can hand a file to their venue — and the
-- guard below is what makes that a deliberate act rather than an oversight.
UPDATE public.platform_retail_catalog_v2
   SET description = 'Your monogram, drawn to life across your QR, your page, and your signage.',
       updated_at  = NOW()
 WHERE service_code = 'ANIMATED_MONOGRAM'
   AND description IS DISTINCT FROM
       'Your monogram, drawn to life across your QR, your page, and your signage.';

-- ── 3. The promise cannot come back while the file cannot be made ───────
-- A CHECK would be wrong here (it would fight a legitimate future edit and
-- has no way to know whether the renderer exists). Instead the rule is
-- carried by a test that reads the LIVE description —
-- `apps/web/tests/db/sellable-promises.db.test.ts` — so re-adding the LED
-- sentence fails CI with the reason attached, and re-adding it *together
-- with* a working renderer is a one-line edit to that test's allowlist.
--
-- 🔑 WHY NOT JUST A COMMENT: a comment does not travel with the value. The
--    sentence being corrected here was itself written by someone who
--    believed the LED file shipped.
COMMENT ON COLUMN public.platform_retail_catalog_v2.description IS
  'Customer-facing SKU blurb. ⚠ It is a PROMISE — do not describe a capability '
  'the app cannot perform today. ANIMATED_MONOGRAM claimed "up on the LED stage '
  'screen. Includes the Live Background" while led_background_renders had zero '
  'writers, so a paying couple could not hand anything to their venue '
  '(corrected 2026-08-11). sellable-promises.db.test.ts enforces this.';
