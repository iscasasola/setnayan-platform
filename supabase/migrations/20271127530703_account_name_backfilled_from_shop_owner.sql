-- ─────────────────────────────────────────────────────────────────────────────
-- Give every existing vendor the account name their shop already knows.
--
-- Owner-locked 2026-08-10: *"vendor's name is their account name."*
--
-- ── WHY A BACKFILL IS PART OF THE RULE, NOT A TIDY-UP ────────────────────────
-- Measured in production before this ran: `users.display_name` was **NULL for
-- every single account**, the owner's included — while `vendor_profiles`
-- carried real names people had typed (`setnaprod` → 'Ice Casasola').
--
-- 🔑 A RULE THAT ONLY APPLIES TO ROWS CREATED AFTER IT IS NOT IN FORCE. Without
-- this, "your name comes from your account" would be true for the next vendor
-- and false for every vendor who already exists — and the code that prefers the
-- account name would keep falling through to the typed one, which is exactly
-- the state that let a name be hand-typed in the first place.
--
-- ── WHAT IT WILL NOT DO ──────────────────────────────────────────────────────
-- • It never OVERWRITES an account name that is already set. The account is the
--   authority; the shop is where the value happened to be recorded first.
-- • It never invents one. A shop with no owner name leaves the account blank,
--   which is honest — the vendor is asked for it on My Shop.
-- • One row per person: `vendor_profiles.user_id` is UNIQUE, so there is no
--   choice to make between two shops and no ordering to get wrong.
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE public.users u
   SET display_name = btrim(v.business_owner_name)
  FROM public.vendor_profiles v
 WHERE v.user_id = u.user_id
   -- Only fill a blank. An account name the person set themselves outranks
   -- whatever a shop form recorded.
   AND (u.display_name IS NULL OR btrim(u.display_name) = '')
   AND v.business_owner_name IS NOT NULL
   AND btrim(v.business_owner_name) <> '';

COMMENT ON COLUMN public.users.display_name IS
  'The person''s name. For a vendor this is also their shop''s business_owner_name '
  '— owner-locked 2026-08-10, "vendor''s name is their account name". Edited on '
  'My Shop, which is the only identity surface a vendor can reach '
  '(/vendor-dashboard/profile redirects to it, and the couple-side profile '
  'bounces anyone who owns a shop). That editor writes both rows.';
