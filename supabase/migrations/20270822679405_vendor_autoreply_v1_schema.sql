-- Vendor Auto-Reply Assistant — Phase 1 schema (config + templates + reply log + chat columns).
-- Build plan: ~/Documents/Claude/Projects/Setnayan/Vendor_Front_Desk_Chatbot_Build_Plan_2026-07-18.md §10.
-- Schema-first, gated by NEXT_PUBLIC_VENDOR_AUTOREPLY_V1 (default OFF); no behaviour ships in this PR.
-- Data-isolation lock (§2A): every table is vendor-scoped by RLS — a vendor's AI sees ONLY its own rows.
-- IDs: BIGSERIAL PKs (all generate_public_id A–Z letters are taken — follows the vendor_web_dossiers precedent).

BEGIN;

-- ============================================================================
-- 1) vendor_bot_config — one row per vendor: the Auto-Reply Assistant settings.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_bot_config (
  vendor_profile_id        UUID PRIMARY KEY
                             REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  enabled                  BOOLEAN NOT NULL DEFAULT false,
  mode                     TEXT    NOT NULL DEFAULT 'free' CHECK (mode IN ('free','smart')),
  daily_reply_cap          INT     NOT NULL DEFAULT 30 CHECK (daily_reply_cap >= 0),
  reply_in_couple_language BOOLEAN NOT NULL DEFAULT false,   -- Pro
  learn_from_past_messages BOOLEAN NOT NULL DEFAULT true,    -- voice opt-out (§7B "Don't learn from my messages")
  voice_profile            JSONB   NOT NULL DEFAULT '{}'::jsonb,
  auto_accept_enabled      BOOLEAN NOT NULL DEFAULT false,
  auto_accept_threshold    INT     NOT NULL DEFAULT 78 CHECK (auto_accept_threshold BETWEEN 0 AND 100),
  daily_auto_accept_cap    INT     NOT NULL DEFAULT 10 CHECK (daily_auto_accept_cap >= 0),
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.vendor_bot_config IS 'Per-vendor Auto-Reply Assistant settings (build plan §10). Vendor sets auto_accept_threshold; no tokens -> no auto-accept is enforced in app/RPC, not here.';

ALTER TABLE public.vendor_bot_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_bot_config_read ON public.vendor_bot_config;
CREATE POLICY vendor_bot_config_read ON public.vendor_bot_config
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('viewer')) OR public.is_admin());

DROP POLICY IF EXISTS vendor_bot_config_write ON public.vendor_bot_config;
CREATE POLICY vendor_bot_config_write ON public.vendor_bot_config
  FOR ALL TO authenticated
  USING      (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')) OR public.is_admin())
  WITH CHECK (vendor_profile_id IN (SELECT public.current_vendor_ids('admin')) OR public.is_admin());

-- ============================================================================
-- 2) vendor_reply_templates — precomputed voice phrasings (Pro; server-written).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_reply_templates (
  id                 BIGSERIAL PRIMARY KEY,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  intent             TEXT NOT NULL,
  service_id         UUID,   -- soft ref to a vendor service (FK deferred to Pro phase; app-enforced)
  package_id         UUID,   -- soft ref to a vendor package (FK deferred to Pro phase; app-enforced)
  phrasings          JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.vendor_reply_templates IS 'Precompute-once natural phrasings per intent x service/package (build plan §7). Regenerated (overwrite) on voice/catalog edit; server-written via service_role.';

CREATE INDEX IF NOT EXISTS idx_vendor_reply_templates_lookup
  ON public.vendor_reply_templates (vendor_profile_id, intent);

ALTER TABLE public.vendor_reply_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_reply_templates_read ON public.vendor_reply_templates;
CREATE POLICY vendor_reply_templates_read ON public.vendor_reply_templates
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('viewer')) OR public.is_admin());

DROP POLICY IF EXISTS vendor_reply_templates_admin ON public.vendor_reply_templates;
CREATE POLICY vendor_reply_templates_admin ON public.vendor_reply_templates
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
-- Generation writes run server-side via service_role, which bypasses RLS.

-- ============================================================================
-- 3) vendor_bot_replies — activity log ("what your AI has said"); server-written.
--     Detail kept 12 months, then rolled up to aggregates (later phase, retention-sweep).
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.vendor_bot_replies (
  id                 BIGSERIAL PRIMARY KEY,
  vendor_profile_id  UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  thread_id          UUID NOT NULL REFERENCES public.chat_threads(thread_id) ON DELETE CASCADE,
  message_id         UUID REFERENCES public.chat_messages(message_id) ON DELETE SET NULL,
  intent             TEXT,
  confidence         NUMERIC(4,3) CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
  action             TEXT NOT NULL CHECK (action IN ('reply','clarify','handoff','auto_accept')),
  was_llm            BOOLEAN NOT NULL DEFAULT false,
  compat_score       INT CHECK (compat_score IS NULL OR compat_score BETWEEN 0 AND 100),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.vendor_bot_replies IS 'Auto-Reply activity log + daily-cap counter + analytics (build plan §7B/§7D). Engine-written via service_role; 12-month detail retention.';

CREATE INDEX IF NOT EXISTS idx_vendor_bot_replies_vendor_created
  ON public.vendor_bot_replies (vendor_profile_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_vendor_bot_replies_thread
  ON public.vendor_bot_replies (thread_id);

ALTER TABLE public.vendor_bot_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_bot_replies_read ON public.vendor_bot_replies;
CREATE POLICY vendor_bot_replies_read ON public.vendor_bot_replies
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_ids('viewer')) OR public.is_admin());

DROP POLICY IF EXISTS vendor_bot_replies_admin ON public.vendor_bot_replies;
CREATE POLICY vendor_bot_replies_admin ON public.vendor_bot_replies
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
-- Engine writes run server-side via service_role, which bypasses RLS.

-- ============================================================================
-- 4) chat columns — bot labelling (§2B AI-disclosure) + compatibility snapshot (§4A).
-- ============================================================================
ALTER TABLE public.chat_messages
  ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;
COMMENT ON COLUMN public.chat_messages.is_bot IS 'True for Auto-Reply Assistant messages. Rendered with a visible AI label to the couple (§2B); never disguised as a human vendor.';

ALTER TABLE public.chat_threads
  ADD COLUMN IF NOT EXISTS compat_score_at_inquiry INT
    CHECK (compat_score_at_inquiry IS NULL OR compat_score_at_inquiry BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS compat_reasons JSONB;
COMMENT ON COLUMN public.chat_threads.compat_score_at_inquiry IS 'Deterministic compat-score snapshot at inquiry time (0-100) for the auto-accept decision + audit (§4A).';
COMMENT ON COLUMN public.chat_threads.compat_reasons IS 'explainCompatScore() drivers captured at inquiry time; powers the voice welcome + audit (§4A).';

COMMIT;
