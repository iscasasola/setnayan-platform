-- ============================================================================
-- 20260518300000_couple_waitlist_signups.sql
--
-- Couple waitlist for the dual-timeline pre-launch (locked 2026-05-18):
--   • Vendors pre-register starting 2026-06-01
--   • Couples sign up for the waitlist between 2026-06-01 and 2026-12-01
--   • Public launch for couples on 2026-12-01 (engagement season opens)
--
-- A couple visiting setnayan.com in that window can browse the marketplace
-- and join this waitlist, but cannot create a couple account or place an
-- order until the launch date. Owner pushes a launch email to this list on
-- 2026-12-01 (notified_at gets stamped at send time).
--
-- INSERT is open to anon (the public waitlist form). SELECT is admin-only
-- so the email list stays private.
--
-- Idempotent. No drops.
-- ============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.couple_waitlist_signups (
  waitlist_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email            TEXT NOT NULL
                   CHECK (length(email) BETWEEN 3 AND 320 AND email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name        TEXT
                   CHECK (full_name IS NULL OR length(full_name) BETWEEN 1 AND 200),
  partner_name     TEXT
                   CHECK (partner_name IS NULL OR length(partner_name) BETWEEN 1 AND 200),
  wedding_date     DATE,
  location_city    TEXT
                   CHECK (location_city IS NULL OR length(location_city) BETWEEN 1 AND 100),
  source           TEXT
                   CHECK (source IS NULL OR length(source) <= 200),  -- utm_source / referrer
  ip_address       INET,
  user_agent       TEXT
                   CHECK (user_agent IS NULL OR length(user_agent) <= 500),
  notified_at      TIMESTAMPTZ,  -- when we sent the launch email
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Email uniqueness (case-insensitive). Duplicate signups are idempotent updates.
CREATE UNIQUE INDEX IF NOT EXISTS couple_waitlist_signups_email_unique
  ON public.couple_waitlist_signups (LOWER(email));

CREATE INDEX IF NOT EXISTS couple_waitlist_signups_created_at_idx
  ON public.couple_waitlist_signups (created_at DESC);

CREATE INDEX IF NOT EXISTS couple_waitlist_signups_notified_idx
  ON public.couple_waitlist_signups (notified_at)
  WHERE notified_at IS NULL;

ALTER TABLE public.couple_waitlist_signups ENABLE ROW LEVEL SECURITY;

-- INSERT: anyone (including unauthenticated visitors) can join the waitlist.
DROP POLICY IF EXISTS couple_waitlist_signups_public_insert
  ON public.couple_waitlist_signups;
CREATE POLICY couple_waitlist_signups_public_insert
  ON public.couple_waitlist_signups FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- SELECT: admin-only. Email list stays private.
DROP POLICY IF EXISTS couple_waitlist_signups_admin_read
  ON public.couple_waitlist_signups;
CREATE POLICY couple_waitlist_signups_admin_read
  ON public.couple_waitlist_signups FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- UPDATE: admin-only (used for the notified_at stamp on launch day).
DROP POLICY IF EXISTS couple_waitlist_signups_admin_update
  ON public.couple_waitlist_signups;
CREATE POLICY couple_waitlist_signups_admin_update
  ON public.couple_waitlist_signups FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
