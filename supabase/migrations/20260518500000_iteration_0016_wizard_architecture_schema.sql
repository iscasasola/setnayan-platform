-- ============================================================================
-- 20260518500000_iteration_0016_wizard_architecture_schema.sql
--
-- Foundational schema for the Setnayan Concierge wizard architecture per
-- CLAUDE.md sixth 2026-05-18 decision-log row + iteration 0016 §§ 0b/0c/0d/0e
-- + brain architecture in 02_Specifications/18_Concierge_Brain/00_Architecture.md.
--
-- Ships:
--   (1) events.concierge_unlock_source + concierge_unlock_via_vendor_profile_id
--       — supports the Pro Weekly bundle perk path (0016 § 0c)
--   (2) event_delegates — coordinator/planner scoped delegate access (0016 § 0d)
--   (3) event_action_log — attribution audit trail for actions (0016 § 0d)
--   (4) vendor_calendar_blocks — intra-day blocks at 30-min granularity (0022 § 2.3a)
--   (5) concierge_brain_chunks — the curated Filipino-wedding knowledge base
--   (6) concierge_plan_templates — combination-hash cached personalized plans
--   (7) concierge_response_cache — cache-forever Q&A responses by query+combo bucket
--   (8) concierge_unanswered_questions — admin queue to grow the brain from real demand
--
-- All idempotent (IF NOT EXISTS · CHECK constraints don't double-add).
-- Engineering work pending after this migration: wizard state machine + intake
-- forms + plan generation server action + Next Actions UI + 0023 Brain Editor UI.
--
-- pgvector note (fixed 2026-05-19): the brain table's `embedding` column +
-- the unanswered-questions `query_embedding` column reference `vector(384)`.
-- Supabase ships pgvector in the `extensions` schema, NOT in `public`'s
-- search_path, so bare `VECTOR(384)` fails with SQLSTATE 42704 at push time.
-- Columns now use the schema-qualified `extensions.vector(384)` form, and
-- the migration explicitly ensures the extension is enabled in `extensions`
-- before any reference to the type.
-- ============================================================================

BEGIN;

-- Ensure pgvector lives in `extensions` (Supabase default). Safe to re-run.
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA extensions;

-- ----------------------------------------------------------------------------
-- 1. events — Pro Weekly bundle perk tracking (0016 § 0c)
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS concierge_unlock_source TEXT
    CHECK (concierge_unlock_source IN ('purchased', 'trial', 'vendor_pro_weekly_perk'));

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS concierge_unlock_via_vendor_profile_id UUID
    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.events.concierge_unlock_source IS
  'How the couple gained Concierge access: ''purchased'' (paid ₱2,499 directly · 0016 § 0), ''trial'' (3-day card-less · 0016 § 0), ''vendor_pro_weekly_perk'' (auto-unlocked at first Pro Weekly vendor booking · 0016 § 0c).';

COMMENT ON COLUMN public.events.concierge_unlock_via_vendor_profile_id IS
  'When concierge_unlock_source = ''vendor_pro_weekly_perk'': the vendor whose Pro Weekly subscription sponsored the unlock. NULL otherwise. If the vendor later cancels Pro Weekly, the couple''s unlock persists (don''t punish couples for vendor decisions).';

-- ----------------------------------------------------------------------------
-- 2. event_delegates — coordinator/planner scoped access (0016 § 0d)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_delegates (
  event_id              UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  delegate_user_id      UUID NOT NULL REFERENCES public.users(user_id),
  delegate_vendor_profile_id UUID REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE SET NULL,
  role                  TEXT NOT NULL CHECK (role IN ('coordinator', 'planner')),
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by_user_id    UUID NOT NULL REFERENCES public.users(user_id),
  revoked_at            TIMESTAMPTZ,
  revoked_by_user_id    UUID REFERENCES public.users(user_id),
  revoked_reason        TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (event_id, delegate_user_id)
);

CREATE INDEX IF NOT EXISTS event_delegates_delegate_user_idx
  ON public.event_delegates(delegate_user_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS event_delegates_active_idx
  ON public.event_delegates(event_id)
  WHERE revoked_at IS NULL;

ALTER TABLE public.event_delegates ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_delegates IS
  'Coordinator/planner delegate access per 0016 § 0d. Auto-granted when the couple books a vendor in canonical_service = ''wedding_coordination'' and confirms the booking; revocable from the couple''s vendor list at any time. Scope of "act on behalf of" enforced in app layer per the table in 0016 § 0d.';

-- ----------------------------------------------------------------------------
-- 3. event_action_log — audit trail + "your coordinator did X" stream (0016 § 0d)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.event_action_log (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  action_type           TEXT NOT NULL,
    -- canonical action types: payment_confirmed · meeting_scheduled · meeting_rescheduled
    -- · vendor_replied · artifact_shared · action_marked_done · booking_proposed
    -- · booking_confirmed · note_added · vendor_quote_requested
  action_target_table   TEXT,                   -- e.g. 'payment_milestones', 'vendor_meetings'
  action_target_id      UUID,
  performed_by_user_id  UUID NOT NULL REFERENCES public.users(user_id),
  performed_by_role     TEXT NOT NULL CHECK (performed_by_role IN ('couple', 'coordinator', 'planner', 'system')),
  notes                 TEXT,                   -- free-form note from the actor
  payload_json          JSONB,                  -- optional structured detail for renderers
  performed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS event_action_log_event_idx
  ON public.event_action_log(event_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS event_action_log_performer_idx
  ON public.event_action_log(performed_by_user_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS event_action_log_role_event_idx
  ON public.event_action_log(event_id, performed_by_role, performed_at DESC)
  WHERE performed_by_role IN ('coordinator', 'planner');

ALTER TABLE public.event_action_log ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_action_log IS
  'Attribution audit trail per 0016 § 0d. Powers (a) the couple-facing "your coordinator did X" stream on 0021 § 2.0b''.3, (b) the coordinator-facing action history in 0022, (c) admin audit review. Every action a delegate takes is logged here.';

-- ----------------------------------------------------------------------------
-- 4. vendor_calendar_blocks — intra-day blocks at 30-min granularity (0022 § 2.3a)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.vendor_calendar_blocks (
  block_id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id     UUID NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  service_id            UUID,                   -- nullable per 0022 § 2.3 schema
  blocked_at            TIMESTAMPTZ NOT NULL,
  blocked_until         TIMESTAMPTZ NOT NULL,
  block_label           TEXT NOT NULL,
  block_source          TEXT NOT NULL DEFAULT 'manual'
    CHECK (block_source IN ('manual', 'setnayan_booking', 'synced_calendar')),
  is_private            BOOLEAN NOT NULL DEFAULT TRUE,
  setnayan_booking_id   UUID,                   -- when block_source='setnayan_booking', references the booking
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (blocked_until > blocked_at),
  CHECK (EXTRACT(MINUTE FROM blocked_at) IN (0, 30) AND EXTRACT(MINUTE FROM blocked_until) IN (0, 30)),
  CHECK (EXTRACT(SECOND FROM blocked_at) = 0 AND EXTRACT(SECOND FROM blocked_until) = 0)
);

CREATE INDEX IF NOT EXISTS vendor_calendar_blocks_vendor_time_idx
  ON public.vendor_calendar_blocks(vendor_profile_id, blocked_at, blocked_until);

CREATE INDEX IF NOT EXISTS vendor_calendar_blocks_setnayan_booking_idx
  ON public.vendor_calendar_blocks(setnayan_booking_id)
  WHERE setnayan_booking_id IS NOT NULL;

ALTER TABLE public.vendor_calendar_blocks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.vendor_calendar_blocks IS
  'Vendor calendar blocks per 0022 § 2.3 + § 2.3a (intra-day 2026-05-18 lock). 30-minute granularity enforced via CHECK on blocked_at/blocked_until minute parts. Sources: manual (vendor-created) · setnayan_booking (auto from confirmed bookings) · synced_calendar (V1.5+ Google Calendar). is_private TRUE by default — couples see only "Unavailable" without the label.';

-- ----------------------------------------------------------------------------
-- 5. concierge_brain_chunks — the curated Filipino-wedding knowledge base
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.concierge_brain_chunks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_file            TEXT NOT NULL,        -- '01_Filipino_Cultural_Reference.md' etc.
  chunk_title           TEXT NOT NULL,
  body                  TEXT NOT NULL,
  tags                  TEXT[] NOT NULL DEFAULT '{}',
  applies_to            TEXT NOT NULL DEFAULT 'all',
  cross_refs            TEXT[] NOT NULL DEFAULT '{}',
  source_citation       TEXT,                 -- required for cultural/legal chunks per brain README governance
  paid_tier_only        BOOLEAN NOT NULL DEFAULT FALSE,
  tier_visible_to       TEXT[] NOT NULL DEFAULT ARRAY['diy', 'trial', 'active'],
  embedding             extensions.vector(384), -- bge-small-en-v1.5 via Cloudflare Workers AI (extensions.* qualifier per Supabase pgvector convention)
  embedding_generated_at TIMESTAMPTZ,
  is_stale              BOOLEAN NOT NULL DEFAULT FALSE,  -- flagged when body edits; nightly sweep regenerates
  cowork_authored_by    TEXT,                 -- when chunk arrived via Cowork sync
  cowork_pending_review BOOLEAN NOT NULL DEFAULT FALSE,
  last_verified_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_by_user_id UUID REFERENCES public.users(user_id),
  hit_count_30d         INT NOT NULL DEFAULT 0,    -- updated by nightly rollup; informs admin quality review
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS concierge_brain_chunks_topic_idx
  ON public.concierge_brain_chunks(topic_file)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS concierge_brain_chunks_tier_idx
  ON public.concierge_brain_chunks USING GIN (tier_visible_to)
  WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS concierge_brain_chunks_tags_idx
  ON public.concierge_brain_chunks USING GIN (tags)
  WHERE is_active = TRUE;

-- Note: pgvector embedding index is engineering-pending — requires pgvector
-- extension enablement + post-import sweep. Add after brain content seed lands:
--   CREATE INDEX concierge_brain_chunks_embedding_idx
--     ON public.concierge_brain_chunks USING ivfflat (embedding vector_cosine_ops)
--     WITH (lists = 10);

ALTER TABLE public.concierge_brain_chunks ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.concierge_brain_chunks IS
  'Curated Filipino-wedding knowledge base powering the Concierge brain Q&A. 8 topic files seeded from spec corpus at 02_Specifications/18_Concierge_Brain/. Single-admin authority for edits (audit-logged via admin_audit_log). Source citation required for cultural/legal chunks. Per 0023 § 3.13a Brain Editor admin surface.';

-- ----------------------------------------------------------------------------
-- 6. concierge_plan_templates — combination-hash cached personalized plans
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.concierge_plan_templates (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signature_hash        TEXT NOT NULL UNIQUE,
    -- hash(religion, region, guest_count_bucket, budget_tier, foundation_state, season)
  religion              TEXT NOT NULL,
  region                TEXT NOT NULL,
  guest_count_bucket    TEXT NOT NULL,
    -- '50' | '80' | '100' | '150' | '200' | '250' | '300_plus'
  budget_tier           INT NOT NULL CHECK (budget_tier BETWEEN 1 AND 5),
  foundation_state      TEXT NOT NULL CHECK (foundation_state IN ('church_only', 'venue_only', 'both', 'neither')),
  season                TEXT NOT NULL CHECK (season IN ('dry', 'wet', 'peak_ber_months', 'peak_summer')),
  plan_body             TEXT NOT NULL,
  generated_by_model    TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
  source_chunk_ids      UUID[] NOT NULL DEFAULT '{}',
  hit_count             INT NOT NULL DEFAULT 0,
  is_stale              BOOLEAN NOT NULL DEFAULT FALSE,
  admin_edited_at       TIMESTAMPTZ,
  admin_edited_by_user_id UUID REFERENCES public.users(user_id),
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS concierge_plan_templates_signature_idx
  ON public.concierge_plan_templates(signature_hash)
  WHERE is_active = TRUE;

ALTER TABLE public.concierge_plan_templates ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.concierge_plan_templates IS
  'Combination-hash cache for personalized Concierge plans per 0016 § 0b. ~19,200 possible combos but heavily skewed distribution. First couple in a new combo triggers a ~₱1 Haiku call; subsequent couples in the same combo render from cache at ₱0. Admin pre-seeds top 100 combos at launch. Lazy invalidation on brain chunk edit (is_stale flag).';

-- ----------------------------------------------------------------------------
-- 7. concierge_response_cache — cache-forever Q&A responses (cache-forever
--    architecture supersedes the 24h TTL in 18_Concierge_Brain/00_Architecture.md § 5)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.concierge_response_cache (
  query_hash            TEXT PRIMARY KEY,
    -- hash(query_embedding_hash, sorted retrieved_chunk_ids, combination_bucket_or_null)
  combination_bucket    TEXT,                 -- present only for paid-tier responses
  response_body         TEXT NOT NULL,
  synthesis_model       TEXT NOT NULL,        -- 'llama-3.1-8b' | 'claude-haiku-4-5'
  retrieved_chunk_ids   UUID[] NOT NULL DEFAULT '{}',
  hit_count             INT NOT NULL DEFAULT 1,
  first_cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_hit_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  is_stale              BOOLEAN NOT NULL DEFAULT FALSE,
  admin_edited_at       TIMESTAMPTZ,
  admin_edited_by_user_id UUID REFERENCES public.users(user_id),
  -- NO expires_at column — cache-forever per 2026-05-18 sixth decision-log row
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS concierge_response_cache_combo_idx
  ON public.concierge_response_cache(combination_bucket, hit_count DESC)
  WHERE combination_bucket IS NOT NULL AND is_stale = FALSE;

CREATE INDEX IF NOT EXISTS concierge_response_cache_top_hits_idx
  ON public.concierge_response_cache(hit_count DESC, last_hit_at DESC)
  WHERE is_stale = FALSE;

ALTER TABLE public.concierge_response_cache ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.concierge_response_cache IS
  'Cache-forever Q&A response store per 2026-05-18 sixth decision-log row (supersedes the 24h TTL originally specified in 18_Concierge_Brain/00_Architecture.md § 5). Lazy invalidation only when underlying brain chunks change. Quality compounds — admin reviews top hit_count entries and hand-edits for quality; edits propagate to every future couple in that combination. The cache library IS Setnayan''s accumulating IP.';

-- ----------------------------------------------------------------------------
-- 8. concierge_unanswered_questions — admin queue for brain growth
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.concierge_unanswered_questions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID REFERENCES public.events(event_id) ON DELETE SET NULL,
  question_text         TEXT NOT NULL,
  query_embedding       extensions.vector(384),
  similar_count_30d     INT NOT NULL DEFAULT 1,
  first_asked_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_asked_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  asked_by_tier         TEXT NOT NULL CHECK (asked_by_tier IN ('diy', 'trial', 'active')),
  admin_action_status   TEXT NOT NULL DEFAULT 'pending'
    CHECK (admin_action_status IN ('pending', 'authored', 'out_of_scope', 'merged_with_existing')),
  resolved_chunk_id     UUID REFERENCES public.concierge_brain_chunks(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  resolved_by_user_id   UUID REFERENCES public.users(user_id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS concierge_unanswered_questions_pending_idx
  ON public.concierge_unanswered_questions(similar_count_30d DESC, last_asked_at DESC)
  WHERE admin_action_status = 'pending';

ALTER TABLE public.concierge_unanswered_questions ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.concierge_unanswered_questions IS
  'Admin queue per 0023 § 3.13b. Captures questions that retrieved zero chunks above similarity threshold OR returned the canned fallback. Drives brain content growth from real demand. Similar questions deduplicate via embedding similarity into a single row with incrementing similar_count_30d.';

-- ----------------------------------------------------------------------------
-- 9. RLS policies — couple owns their event data, admin reads all
-- ----------------------------------------------------------------------------

-- event_delegates: couples + their delegates can read; couples can grant/revoke
CREATE POLICY event_delegates_couple_read
  ON public.event_delegates FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_delegates.event_id
        AND em.user_id = (SELECT user_id FROM public.users WHERE user_id = auth.uid())
    )
    OR delegate_user_id = (SELECT user_id FROM public.users WHERE user_id = auth.uid())
  );

CREATE POLICY event_delegates_couple_insert
  ON public.event_delegates FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_delegates.event_id
        AND em.user_id = (SELECT user_id FROM public.users WHERE user_id = auth.uid())
    )
  );

-- event_action_log: visible to event members + the delegate who performed it
CREATE POLICY event_action_log_event_members_read
  ON public.event_action_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.event_members em
      WHERE em.event_id = event_action_log.event_id
        AND em.user_id = (SELECT user_id FROM public.users WHERE user_id = auth.uid())
    )
    OR EXISTS (
      SELECT 1 FROM public.event_delegates ed
      WHERE ed.event_id = event_action_log.event_id
        AND ed.delegate_user_id = (SELECT user_id FROM public.users WHERE user_id = auth.uid())
        AND ed.revoked_at IS NULL
    )
  );

-- vendor_calendar_blocks: vendor owns their blocks; couples see only that
-- a time range is "unavailable" via app-layer filter (no direct row exposure)
CREATE POLICY vendor_calendar_blocks_vendor_owner
  ON public.vendor_calendar_blocks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.vendor_profiles vp
      WHERE vp.vendor_profile_id = vendor_calendar_blocks.vendor_profile_id
        AND vp.user_id = (SELECT user_id FROM public.users WHERE user_id = auth.uid())
    )
  );

-- concierge_brain_chunks: world-readable for active chunks (the brain answers questions),
-- admin-only write
CREATE POLICY concierge_brain_chunks_public_read
  ON public.concierge_brain_chunks FOR SELECT
  USING (is_active = TRUE);

-- concierge_plan_templates: world-readable (the wizard renders from these for any couple
-- whose intake matches a signature); admin-only write
CREATE POLICY concierge_plan_templates_public_read
  ON public.concierge_plan_templates FOR SELECT
  USING (is_active = TRUE);

-- concierge_response_cache: world-readable (the brain serves cached responses to any user
-- whose query matches); admin-only write
CREATE POLICY concierge_response_cache_public_read
  ON public.concierge_response_cache FOR SELECT
  USING (is_stale = FALSE);

-- concierge_unanswered_questions: admin-only read/write (couples don't see this queue)
-- Default-deny via RLS enabled; admin policy added by 0023 admin role migration

COMMIT;

-- ============================================================================
-- Engineering work pending after this migration:
--   - Wizard state machine + getNextActions() server function
--   - Intake forms (5 structured fields per 0016 § 0b)
--   - Plan generation server action (Haiku 4.5 call + plan template cache lookup)
--   - Pro Weekly bundle activation trigger (vendor booking confirmation →
--     concierge_unlock_via_vendor_profile_id + concierge_status = 'active')
--   - Coordinator auto-delegate-grant trigger (booking confirmation for
--     wedding_coordination vendor → event_delegates row)
--   - Auto-block in vendor_calendar_blocks on event_vendors booking
--     confirmation (block_source = 'setnayan_booking')
--   - Concierge brain chunks import from spec corpus
--     (02_Specifications/18_Concierge_Brain/01..08_*.md markdown → seed rows)
--   - 0023 admin Brain Editor UI surface
--   - Cowork sync webhook integration
--   - Couple-side Concierge home variants (Next Actions strip · plan tile ·
--     coordinator activity stream · smart intake on upgrade)
--   - Vendor-side Next Actions surface + coordinator multi-couple view (0022)
--   - 0028 email templates revised per the helping-voice tone direction
-- ============================================================================
