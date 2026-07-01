-- custom domains table and resolve rpc
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- ============================================================================
-- PR7 of the slug-routing program: custom BYO domains.
-- A vendor (or user) points their own domain (e.g. sny.theirshop.com) at
-- Setnayan; once verified it serves their existing /v/{slug} (vendor) or
-- /u/{slug} (user) page via a middleware host rewrite. Owner ruling 2026-07-01:
-- FREE FOR ALL, no tier gate.
--
-- BACKEND-ONLY and inert until (a) rows exist and (b) VERCEL_API_TOKEN /
-- VERCEL_PROJECT_ID env vars are set on the runtime. The add/verify UI lands in
-- a later PR; the middleware host-branch that calls resolve_custom_domain()
-- ships alongside this migration.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.custom_domains (
  id                  BIGSERIAL PRIMARY KEY,
  domain_id           UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  domain              TEXT NOT NULL,
  -- vendor_profiles.vendor_profile_id (owner_type='vendor') OR
  -- users.user_id / auth.uid() (owner_type='user').
  owner_type          TEXT NOT NULL CHECK (owner_type IN ('vendor', 'user')),
  owner_id            UUID NOT NULL,
  -- 32-char hex, shown to the owner as the verification value.
  verification_token  TEXT NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  verified_at         TIMESTAMPTZ,
  -- id/name Vercel's Domains API returns, kept for later status polling + removal.
  vercel_domain_id    TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- At most one VERIFIED row per hostname (case-insensitive). Partial (not a full
-- unique index) on purpose: an UNVERIFIED squatter must NOT be able to claim a
-- hostname and block its real owner from adding + verifying it. Verification —
-- which requires DNS/Vercel control — is the tiebreak, and this index guarantees
-- the winner is globally unique. Also serves the resolver's hot-path lookup
-- (WHERE LOWER(domain)=? AND verified_at IS NOT NULL).
CREATE UNIQUE INDEX IF NOT EXISTS custom_domains_verified_domain_idx
  ON public.custom_domains (LOWER(domain)) WHERE verified_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS custom_domains_owner_idx
  ON public.custom_domains (owner_type, owner_id);

ALTER TABLE public.custom_domains ENABLE ROW LEVEL SECURITY;

-- RLS: a vendor team member (current_vendor_profile_ids()) or the user themself
-- manages their own rows; admins get full access. Anon/public NEVER reads this
-- table directly — host resolution goes through the SECURITY DEFINER RPC below,
-- so there is deliberately no public SELECT policy. Hybrid of the canonical
-- self-owned + admin patterns; no new RLS pattern invented.
DROP POLICY IF EXISTS vendor_owns_domain ON public.custom_domains;
CREATE POLICY vendor_owns_domain ON public.custom_domains
  FOR ALL TO authenticated
  USING (owner_type = 'vendor' AND owner_id IN (SELECT public.current_vendor_profile_ids()))
  WITH CHECK (owner_type = 'vendor' AND owner_id IN (SELECT public.current_vendor_profile_ids()));

DROP POLICY IF EXISTS user_owns_domain ON public.custom_domains;
CREATE POLICY user_owns_domain ON public.custom_domains
  FOR ALL TO authenticated
  USING (owner_type = 'user' AND owner_id = auth.uid())
  WITH CHECK (owner_type = 'user' AND owner_id = auth.uid());

DROP POLICY IF EXISTS admin_full_access_domains ON public.custom_domains;
CREATE POLICY admin_full_access_domains ON public.custom_domains
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Verification guard. RLS' WITH CHECK constrains WHICH rows an owner may write,
-- but not WHICH columns — so without this a self-service owner could POST their
-- own row with verified_at=now() and self-mark it verified, bypassing the
-- DNS/Vercel handshake that verified_at is meant to represent (and that the
-- resolver + middleware trust blindly). Gate on current_user (the EFFECTIVE
-- role, INVOKER fn): a self-service writer ('authenticated'/'anon', non-admin)
-- may only CREATE an unverified row and may never change verified_at /
-- vercel_domain_id. service_role (the verify backend), a direct un-elevated
-- connection (postgres, e.g. migrations), and an authenticated admin all bypass.
-- Mirrors the money_path_security_guards.sql column-guard pattern.
CREATE OR REPLACE FUNCTION public.guard_custom_domain_verification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT public.is_admin() THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW.verified_at IS NOT NULL OR NEW.vercel_domain_id IS NOT NULL THEN
        RAISE EXCEPTION 'custom_domains: verified_at/vercel_domain_id may only be set by the verification backend'
          USING errcode = '42501';
      END IF;
    ELSIF TG_OP = 'UPDATE' THEN
      IF NEW.verified_at IS DISTINCT FROM OLD.verified_at
         OR NEW.vercel_domain_id IS DISTINCT FROM OLD.vercel_domain_id THEN
        RAISE EXCEPTION 'custom_domains: verified_at/vercel_domain_id may only be changed by the verification backend'
          USING errcode = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_guard_custom_domain_verification ON public.custom_domains;
CREATE TRIGGER trg_guard_custom_domain_verification
  BEFORE INSERT OR UPDATE ON public.custom_domains
  FOR EACH ROW EXECUTE FUNCTION public.guard_custom_domain_verification();

-- Host -> internal path resolver for the middleware hot path. SECURITY DEFINER +
-- STABLE so an anonymous edge request can map a VERIFIED custom domain to the
-- owner's CURRENT slug — staleness-free (joins live, no denormalized slug that
-- could drift on a rename). Returns e.g. '/v/ice-photography' or '/u/maria', or
-- NULL when the host is unknown / unverified / owner has no slug. Only ever
-- exposes a public slug, nothing sensitive.
CREATE OR REPLACE FUNCTION public.resolve_custom_domain(p_host TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN d.owner_type = 'vendor' THEN '/v/' || vp.business_slug
    WHEN d.owner_type = 'user'   THEN '/u/' || u.slug
  END
  FROM public.custom_domains d
  LEFT JOIN public.vendor_profiles vp
    ON d.owner_type = 'vendor' AND vp.vendor_profile_id = d.owner_id
  LEFT JOIN public.users u
    ON d.owner_type = 'user' AND u.user_id = d.owner_id
  WHERE LOWER(d.domain) = LOWER(p_host)
    AND d.verified_at IS NOT NULL
    AND COALESCE(vp.business_slug, u.slug) IS NOT NULL
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_custom_domain(TEXT) TO anon, authenticated;

