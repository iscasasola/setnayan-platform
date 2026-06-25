-- guest_saved_vendors — Invite/Join v2 (2026-06-26).
--
-- A guest who attends an event can save a vendor they liked there, so it travels
-- to THEIR own future planning. This is distinct from `event_vendors` (vendors in
-- a couple's OWN event plan) — it's an account-level bookmark keyed to the vendor
-- profile, independent of any event the saver hosts. The growth loop: today's
-- guest is tomorrow's couple, arriving with a shortlist already started.
--
-- Owner-signed-off 2026-06-26 (reverses the "no standalone favorites table"
-- convention — `event_vendors` was the only 'saved' surface until now).
-- Idempotent + RLS at create time (user owns their own bookmarks).

CREATE TABLE IF NOT EXISTS public.guest_saved_vendors (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id           uuid NOT NULL REFERENCES public.users(user_id) ON DELETE CASCADE,
  vendor_profile_id uuid NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The event where they saw/liked the vendor (for the "saved at <wedding>" chip).
  source_event_id   uuid REFERENCES public.events(event_id) ON DELETE SET NULL,
  saved_at          timestamptz NOT NULL DEFAULT now(),
  -- One bookmark per vendor per user (idempotent save).
  UNIQUE (user_id, vendor_profile_id)
);

ALTER TABLE public.guest_saved_vendors ENABLE ROW LEVEL SECURITY;

-- Owner-only: a user reads / creates / removes only their OWN bookmarks. The
-- vendor list a guest saves from is read server-side (admin) on the event page;
-- this table never exposes one user's bookmarks to another.
DROP POLICY IF EXISTS guest_saved_vendors_owner_select ON public.guest_saved_vendors;
CREATE POLICY guest_saved_vendors_owner_select ON public.guest_saved_vendors
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS guest_saved_vendors_owner_insert ON public.guest_saved_vendors;
CREATE POLICY guest_saved_vendors_owner_insert ON public.guest_saved_vendors
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS guest_saved_vendors_owner_delete ON public.guest_saved_vendors;
CREATE POLICY guest_saved_vendors_owner_delete ON public.guest_saved_vendors
  FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS guest_saved_vendors_user_idx
  ON public.guest_saved_vendors (user_id);

COMMENT ON TABLE public.guest_saved_vendors IS
  'Invite/Join v2 (2026-06-26): a guest''s account-level bookmark of a vendor they liked at an event they attended, for their own future planning. Distinct from event_vendors (vendors in a couple''s own plan).';
