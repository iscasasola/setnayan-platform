-- ============================================================================
-- Nav / Icon / Menu registry — admin OVERRIDES layer.
--
-- Single source of truth for the NAME (label) + ICON of every menu/route across
-- Setnayan, for all account types. Defaults live in code
-- (apps/web/lib/nav-registry-defaults.ts — the route-meta successor); this table
-- stores ONLY the slots an admin changed. The resolver merges
-- COALESCE(override, default) — see apps/web/lib/nav-registry.ts.
--
-- Governance: single-admin write + audit (owner 2026-06-16) via admin_audit_log.
-- RLS enabled at CREATE TABLE time (Setnayan convention). Nav chrome renders
-- everywhere incl. logged-out marketing → public SELECT.
-- updated_at is stamped by the server action (no trigger dependency).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.nav_slot_override (
  slot_key    TEXT PRIMARY KEY,                       -- references a code-default key (no FK; defaults live in code)
  label       TEXT,                                   -- NULL ⇒ keep the code default label
  icon_kind   TEXT CHECK (icon_kind IN ('lucide', 'custom', 'none')),  -- NULL ⇒ keep the code default icon
  lucide_name TEXT,                                   -- when icon_kind = 'lucide' (validated app-side vs the curated set)
  custom_url  TEXT,                                   -- when icon_kind = 'custom' (R2 public URL of an uploaded SVG/PNG)
  is_hidden   BOOLEAN NOT NULL DEFAULT FALSE,         -- admin can hide a slot without a code change
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT nav_slot_override_lucide_chk CHECK (icon_kind IS DISTINCT FROM 'lucide' OR lucide_name IS NOT NULL),
  CONSTRAINT nav_slot_override_custom_chk CHECK (icon_kind IS DISTINCT FROM 'custom' OR custom_url IS NOT NULL)
);

ALTER TABLE public.nav_slot_override ENABLE ROW LEVEL SECURITY;

-- Idempotent re-apply: Postgres has no CREATE POLICY IF NOT EXISTS, so drop first.
DROP POLICY IF EXISTS nav_slot_override_read ON public.nav_slot_override;
DROP POLICY IF EXISTS nav_slot_override_write ON public.nav_slot_override;

-- Nav chrome renders everywhere (incl. logged-out marketing) → anyone may read.
CREATE POLICY nav_slot_override_read ON public.nav_slot_override
  FOR SELECT USING (TRUE);

-- Single-admin write (governance: single-admin + audit, owner 2026-06-16).
-- NOTE: lucide_name is validated app-side against the curated allowlist
-- (lib/nav-icons.ts) — no DB CHECK, since that allowlist lives in code.
CREATE POLICY nav_slot_override_write ON public.nav_slot_override
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

COMMENT ON TABLE public.nav_slot_override IS
  'Admin overrides for the in-code nav/icon/menu registry (apps/web/lib/nav-registry-defaults.ts). One row per slot an admin changed name/icon/visibility on; resolver merges COALESCE(override, default). Public-read (nav renders everywhere incl. logged-out); single-admin write per is_admin(); audit via admin_audit_log. Nav registry foundation, 2026-06-16.';
