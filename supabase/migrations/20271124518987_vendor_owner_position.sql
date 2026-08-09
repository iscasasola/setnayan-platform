-- Who the person filling in the shop actually is.
--
-- Owner 2026-08-10, listing the step-2 fields: *"your name / your position -
-- just text box so we know what their position is."*
--
-- `business_owner_name` already exists and is asked for at onboarding, but it
-- carries no ROLE — so a shop is contacted by "Ana Reyes" with no way to know
-- whether that is the proprietor, a booking coordinator, or an assistant
-- answering for someone else. That matters on two live paths: the verification
-- reviewer deciding whether the person submitting government documents can
-- speak for the business, and a couple deciding how much weight a quote carries.
--
-- FREE TEXT, DELIBERATELY. A dropdown would need a canonical list of Philippine
-- small-business roles, and the honest answers ("Owner", "Co-owner", "Manager",
-- "Sales Head", "Anak ng may-ari") do not fit one. The owner asked for a text
-- box; a picker here would refuse the real answer to make the data tidy.
--
-- OPTIONAL. Nothing is gated on it and no existing shop has one, so requiring it
-- would block every returning vendor mid-onboarding for a field that did not
-- exist when they registered. The onboarding form asks; the server accepts blank.
--
-- 64 chars matches `location_city` and the other short profile strings.

ALTER TABLE public.vendor_profiles
  ADD COLUMN IF NOT EXISTS business_owner_position TEXT;

COMMENT ON COLUMN public.vendor_profiles.business_owner_position IS
  'Free-text role of the person named in business_owner_name — "Owner", "Manager", '
  '"Booking Coordinator". Asked at onboarding (owner 2026-08-10), optional, nothing '
  'gated on it. Free text on purpose: no canonical list of PH small-business roles '
  'covers the real answers.';

-- ── Exposure ────────────────────────────────────────────────────────────────
-- `vendor_profiles` already carries its RLS policies and grants; a new column
-- inherits them, so there is no new GRANT to make here. It IS readable wherever
-- the row is readable — including the public marketplace read — which is correct
-- and intended: a couple seeing "Ana Reyes · Owner" is the entire point.
--
-- ⚠ Recorded explicitly because the exposure baseline must be regenerated in the
-- SAME PR as any column change (`pnpm --filter @setnayan/web exposure:baseline`),
-- and a reviewer should be able to see that this column being publicly readable
-- was a decision rather than an oversight. It holds a role title the vendor types
-- about themselves for public display — no more sensitive than their name.
