-- a_draft_save_never_overwrites_another
-- Created via `pnpm migration:new`.
-- ═══════════════════════════════════════════════════════════════════════════
-- 👥 TWO HOSTS NEVER OVERWRITE EACH OTHER — the Maker draft row gets a VERSION (owner 2026-10-18).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Two hosts on one event (an unlock belongs to the event — both edit), or one host on two phones, save into ONE draft
-- row (`event_site_drafts`, one per event). Every writer read the row, merged its change and wrote the WHOLE row back
-- (`writeHubDraft`, apps/web/lib/hub-draft-store.ts) — so a save that landed between another writer's read and its
-- write was silently gone, with an Undo step. The Maker saves every pick, so this happens whenever two screens are open.
--
-- The fix is a compare-and-set: a writer remembers the version it READ and its UPDATE only lands while the row still
-- carries it (`updateHubDraft` re-reads and builds again on the newer draft when it loses). The version must change on
-- EVERY write and never repeat — so it is a counter, not a clock. `updated_at` (NOW(), the transaction's start) is
-- a clock: two writes inside one clock tick carry the same value, and the test database's clock ticks in whole
-- milliseconds (measured 2026-10-18: a stale write matched and landed). A counter cannot repeat.
--
-- WHAT THIS CHANGES — nothing about who may do what:
--   • `revision bigint NOT NULL DEFAULT 0`, raised by one in the row's existing BEFORE UPDATE trigger;
--   • SELECT is already granted on the table (a table grant covers a new column), so the hosts can read it;
--   • INSERT / UPDATE stay COLUMN grants on (event_id, draft_json, applied_snapshot) / (draft_json, applied_snapshot):
--     nobody can write `revision` — only the trigger moves it. RLS (`event_site_drafts_host_all`) is untouched.

ALTER TABLE public.event_site_drafts
  ADD COLUMN IF NOT EXISTS revision BIGINT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.event_site_drafts.revision IS
  'The draft''s version, raised by one on every UPDATE (trigger touch_event_site_drafts). A writer compares-and-sets on the value it read (apps/web/lib/hub-draft-store.ts updateHubDraft), so two hosts saving at once never overwrite each other. Server-owned: no role may write it.';

-- The row's own trigger, as it was (20271246169682), plus the counter.
CREATE OR REPLACE FUNCTION public.touch_event_site_drafts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  NEW.revision := OLD.revision + 1;
  RETURN NEW;
END $$;

REVOKE ALL ON FUNCTION public.touch_event_site_drafts() FROM PUBLIC, anon, authenticated;
