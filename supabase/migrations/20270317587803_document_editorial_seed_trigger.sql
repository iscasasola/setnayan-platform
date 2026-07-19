-- document editorial seed trigger
-- ============================================================================
-- Documentation-only migration. Adds COMMENTs to the editorial-provisioning
-- trigger added in 20270316888459_provision_event_editorial_on_create.sql.
--
-- Doubles as the first end-to-end proof of the FIXED auto-apply pipeline: the
-- prior fix (PR #2375, --include-all + DO_NOT_TRACK) + the ledger reconciliation
-- were validated via `workflow_dispatch`, but never via the real
-- "push to main touching supabase/migrations/**" trigger. This migration
-- exercises exactly that path. COMMENT statements are fully idempotent.
-- ============================================================================

BEGIN;

COMMENT ON FUNCTION public.seed_event_editorial() IS
  'AFTER INSERT trigger fn on public.events — seeds one draft event_editorial row per new event (owner intent 2026-06-28: "each event created will have an editorial"). Exception-guarded so a seeding fault can never abort event creation; draft_json left empty so the compose engine stays authoritative. Added by 20270316888459.';

COMMENT ON TRIGGER on_event_created_seed_editorial ON public.events IS
  'Provisions a draft editorial for every new event. See public.seed_event_editorial().';

COMMIT;
