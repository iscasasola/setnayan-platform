-- admin_supplier_slice
-- ============================================================================
-- ADMIN SUPPLIER SLICE (owner 2026-10-28: "A"; DECISION_LOG "ADMIN SUPPLIER
-- SLICE APPROVED — BUILD NOW"; prototype prototypes/admin_supplier_slice_2026-10-28/).
--
-- TWO ADDITIVE PARTS. Everything else the slice does rides tables that already
-- ship (vendor_verification_applications · vendor_correction_requests +
-- slug_change_log · vendor_image_flags · event_type_requests · help_messages).
--
--  1. vendor_correction_requests.decline_reason — "Decline with a reason". The
--     request table has the supplier's own `note` (their why) but nowhere for
--     OURS, so a declined rename reached the shop as a bare "declined". The
--     reason is picked from a fixed list in Admin › Work
--     (lib/admin/supplier-work.ts SUPPLIER_WORK_REASONS.name) and the shop reads
--     it on its own request row (RLS: the owner already reads their rows).
--
--  2. category_hub_tools — Admin › Categories › Hub tools: per CATEGORY
--     (a tier-2 service_categories row), which tools of the ONE shared tool
--     library a booked supplier of that category gets in their Hub, and the
--     default scan mode (DECISION_LOG 2026-10-28 "HUB TOOLS BY SERVICE — THE
--     FULL LIST IS THE SEED; ONE SHARED LIBRARY, NEVER PER-SERVICE COPIES" +
--     2026-10-03 "SUPPLIER SCAN = ALL FIVE MODES").
--     🔑 The library and the approved seed live in CODE (lib/hub-tools.ts —
--     a tool is code; a switch cannot invent one). A row exists only once an
--     admin saved that category; no row = the seed. So this table holds the
--     admin's CHOICES, never a second copy of the library.
--     RLS: anyone signed in may READ (the supplier Hub reads it — pattern
--     "reference data"); only an admin writes (is_admin()).
--
-- KEEP THIS MIGRATION IDEMPOTENT.
-- ============================================================================

BEGIN;

-- ── 1 · Decline with a reason ──────────────────────────────────────────────
ALTER TABLE public.vendor_correction_requests
  ADD COLUMN IF NOT EXISTS decline_reason TEXT;

ALTER TABLE public.vendor_correction_requests
  DROP CONSTRAINT IF EXISTS vendor_correction_requests_decline_reason_len;
ALTER TABLE public.vendor_correction_requests
  ADD CONSTRAINT vendor_correction_requests_decline_reason_len
  CHECK (decline_reason IS NULL OR char_length(decline_reason) BETWEEN 1 AND 300);

COMMENT ON COLUMN public.vendor_correction_requests.decline_reason IS
  'Admin › Work "Decline" — the reason the shop reads, picked from a fixed list (lib/admin/supplier-work.ts). NULL when applied, open, or declined before 2026-10-28.';

-- ── 2 · Hub tools per category ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.category_hub_tools (
  category_id   TEXT PRIMARY KEY
                  REFERENCES public.service_categories(id) ON DELETE CASCADE,
  -- Tool keys from the shared library (lib/hub-tools.ts HUB_TOOL_LIBRARY).
  -- Validated app-side against the library; the CHECK keeps the shape sane.
  tools         TEXT[] NOT NULL DEFAULT '{}'::text[]
                  CHECK (cardinality(tools) <= 64),
  -- The five scan modes (DECISION_LOG 2026-10-03). The supplier can change it
  -- per event; this is only the default a new booking starts with.
  scan_default  TEXT NOT NULL DEFAULT 'once'
                  CHECK (scan_default IN ('once', 'ordered_received', 'unlimited', 'group_session', 'roaming')),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES public.users(user_id) ON DELETE SET NULL
);

ALTER TABLE public.category_hub_tools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS category_hub_tools_read ON public.category_hub_tools;
CREATE POLICY category_hub_tools_read
  ON public.category_hub_tools FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS category_hub_tools_admin_write ON public.category_hub_tools;
CREATE POLICY category_hub_tools_admin_write
  ON public.category_hub_tools FOR ALL
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

REVOKE ALL ON public.category_hub_tools FROM anon;

COMMENT ON TABLE public.category_hub_tools IS
  'Admin › Categories › Hub tools (owner 2026-10-28): per category, the switched-on tools of the one shared library (lib/hub-tools.ts) + the default scan mode. No row = the approved seed. Read by the supplier Hub through hubToolsFor().';

COMMIT;
