-- retire_stories_addon_and_dead_vendor_rows
--
-- Three catalog rows that are on sale and sell nothing. All three are pure
-- `is_active` flips: no schema change, no data loss, and each is reversible by
-- flipping the same boolean back. Idempotent — every statement is guarded by
-- `IS DISTINCT FROM false`, so a re-apply is a no-op.
--
-- ⚠ DO NOT READ A PREFIX AS A GATE. This file's 14-digit prefix sorts after the
-- current head, but that is for the PGlite replay's filename ordering and the
-- UNIQUE rule — NOT because a lower one "would be skipped". Both deploy
-- workflows run `supabase db push --include-all --yes`, which exists precisely
-- to apply migrations dated before the remote head. See the repo CLAUDE.md.
--
-- ── 1 · PAPIC_ADDON_STORIES (₱2,000) — sold nothing ─────────────────────────
-- The guest story maker is owner-locked FREE. lib/guest-stories.ts states it in
-- its own header ("FREE TIER — no entitlement gate, no price; nothing here
-- charges anything") and NO code anywhere asks whether this add-on was bought,
-- so paying ₱2,000 changed nothing for the buyer.
--
-- This is a RE-retirement, not a new decision. Migration 20270328922621 already
-- switched it off for this exact reason ("Retire the stale paid Guest Stories
-- SKU (Guest Stories is owner-locked FREE)"). It came back on 2026-07-10 as
-- collateral of the blanket sweep in 20270710619774, which flipped three codes
-- to is_active=true in one statement — SEATING_3D and PAPIC_ADDON_THANK_YOU are
-- real paid products; this one was swept along with them. Owner re-confirmed off
-- sale 2026-08-11.
--
-- ⚠ THE OTHER TWO STAY ON. They are named here only to record that the sweep is
-- not being reverted wholesale — this touches STORIES alone.
--
-- Zero orders have ever been placed against this code, so nothing anyone owns is
-- affected and there is nothing to refund. The FEATURE is untouched: guests keep
-- making stories for free, exactly as before.
UPDATE public.platform_retail_catalog_v2
   SET is_active  = false,
       updated_at = now()
 WHERE service_code = 'PAPIC_ADDON_STORIES'
   AND is_active IS DISTINCT FROM false;

-- ── 2 · booth_studio (₱1,500) — a dead twin beside a live row ───────────────
-- Sits at display_order 86, immediately under vendor_3d_booth (order 85, also
-- ₱1,500), with a near-identical title — so the admin pricing screen offers two
-- adjacent 3D-booth rows and only one of them does anything.
--
-- `vendor_3d_booth` is the live one: lib/vendor-3d-booth-pricing.ts exports it as
-- VENDOR_3D_BOOTH_SKU_CODE, the subscription action bills it, and the SKU
-- activation hook keys off it. `booth_studio` is referenced by ZERO code as a SKU
-- code.
--
-- ⚠ THE FEATURE CALLED "BOOTH STUDIO" IS NOT AFFECTED — it exists and keeps
-- working. It is gated by the env flag NEXT_PUBLIC_BOOTH_STUDIO_ENABLED
-- (lib/booth-studio-flag.ts), never by this billing row, so switching the row off
-- cannot darken it. Checked before writing this, because a same-named row and
-- feature is exactly how a "dead" row turns out to be load-bearing.
UPDATE public.vendor_billing_catalog
   SET is_active   = false,
       updated_at  = now()
 WHERE sku_code = 'booth_studio'
   AND is_active IS DISTINCT FROM false;

-- ── 3 · vendor_custom_included_token (₱100/cycle) — a retired currency ──────
-- The vendor token currency was retired outright by the owner ("tokens are
-- already retired", 2026-08-07). The Custom plan's ₱100-per-cycle token axis was
-- removed from the code by PR #4223 — lib/vendor-custom-catalog.ts records the
-- retirement — but the catalog row itself stayed is_active=true, so a dead
-- currency still had a price on the admin pricing screen.
--
-- 🪤 CHECKED FOR THE KNOWN NO-OP FIRST. There is a documented trap where
-- deactivating a row does nothing because a hardcoded fallback takes over (the
-- SETNAYAN_AI_RENEW shape). Verified before writing this: nothing reads
-- `vendor_custom_included_token` any more — the only remaining mention in the
-- whole app is the comment recording its retirement — so this flip genuinely
-- removes it rather than handing over to a constant.
UPDATE public.vendor_billing_catalog
   SET is_active   = false,
       updated_at  = now()
 WHERE sku_code = 'vendor_custom_included_token'
   AND is_active IS DISTINCT FROM false;
