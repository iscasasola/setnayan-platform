-- 20271030238978_sec_user_delete_fk_sweep_no_action_to_set_null.sql
--
-- SEC · Deleting a user is refused by TWENTY-ONE foreign keys, not one.
--
-- ── HOW THIS WAS FOUND, AND THE MISTAKE THAT PRECEDED IT ───────────────────
-- Earlier today, migration 20271028166046 fixed ONE of these:
-- `vendor_ig_oauth_state.initiated_by -> auth.users(id)` had no ON DELETE
-- clause, so it defaulted to NO ACTION — refuse — and three abandoned
-- Instagram handshakes were blocking the owner's own account from deletion.
--
-- That fix was correct and incomplete. It treated an instance as an instance.
-- Nobody asked whether it was a CLASS until a later sweep tripped over a second
-- one, at which point the real query took ten seconds:
--
--   SELECT conrelid::regclass, pg_get_constraintdef(oid) FROM pg_constraint
--    WHERE contype='f' AND confrelid='auth.users'::regclass AND confdeltype='a';
--
-- Twenty-one rows. This is the general form of the already-known broken admin
-- "Delete user" (see the open PR titled "41 restrictive FKs", 2026-07-21).
--
-- ⚠ FOUR ARE ACTIVELY BLOCKING RIGHT NOW: oauth_state (30 rows),
-- event_moderators (2), slug_change_log (1), event_manual_vendors (1).
--
-- ── THE SPLIT, WHICH IS NOT COSMETIC ───────────────────────────────────────
-- 14 of the 21 columns are NULLABLE, so ON DELETE SET NULL is available and
-- correct: the row is a record of something that happened, and it survives the
-- author's departure with the attribution removed. That is what a stamp is for.
--
-- 7 are NOT NULL, where SET NULL is impossible. Three of those are ephemeral
-- OAuth handshake state — meaningless without the user who started it — and get
-- CASCADE, matching the precedent set this morning for vendor_ig_oauth_state.
--
-- ⚠ THE REMAINING FOUR ARE DELIBERATELY NOT TOUCHED, and they are a product
-- decision rather than a schema one:
--
--   kwento_assignments.assigned_by_user_id   NOT NULL
--   patiktok_oauth_grants.granted_by         NOT NULL
--   patiktok_render_jobs.requested_by        NOT NULL
--   render_jobs.requested_by                 NOT NULL
--
-- For each, the only options are (a) make the column nullable — which retires
-- the assertion "this row always has an author", a real semantic change — or
-- (b) CASCADE, which DELETES render-job history and TikTok grants when a user
-- leaves. Neither is a schema tidy-up. They stay refusing until somebody
-- decides, and they are listed here so the next person does not have to
-- rediscover them.
--
-- ── WHY SET NULL AND NOT CASCADE FOR THE FOURTEEN ──────────────────────────
-- These columns are AUTHORSHIP STAMPS: who recorded a budget decision, who
-- invited a moderator, who scanned a QR. Cascading would delete the event's
-- moderator list because the person who sent the invitations left. The event
-- record belongs to the event, not to whoever typed it.
--
-- ⚠ AND IT IS ALSO THE ERASURE-CORRECT ANSWER. These same columns appear in
-- the export/erasure backlog (UNDECIDED_BACKLOG, lib/erasure/coverage-
-- guardrail.test.ts) under "null the author stamp, keep the row" — so this
-- migration closes one whole group of that backlog as a side effect.
--
-- IDEMPOTENT: each constraint is dropped IF EXISTS, then recreated.

-- ── 1 · Nullable authorship stamps → SET NULL (14) ─────────────────────────

ALTER TABLE public.bespoke_monogram_generations DROP CONSTRAINT IF EXISTS bespoke_monogram_generations_created_by_fkey;
ALTER TABLE public.bespoke_monogram_generations
  ADD CONSTRAINT bespoke_monogram_generations_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.budget_allocation_decisions DROP CONSTRAINT IF EXISTS budget_allocation_decisions_recorded_by_fkey;
ALTER TABLE public.budget_allocation_decisions
  ADD CONSTRAINT budget_allocation_decisions_recorded_by_fkey FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.budget_builds DROP CONSTRAINT IF EXISTS budget_builds_created_by_fkey;
ALTER TABLE public.budget_builds
  ADD CONSTRAINT budget_builds_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_build_picks DROP CONSTRAINT IF EXISTS event_build_picks_picked_by_fkey;
ALTER TABLE public.event_build_picks
  ADD CONSTRAINT event_build_picks_picked_by_fkey FOREIGN KEY (picked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_category_build_state DROP CONSTRAINT IF EXISTS event_category_build_state_set_by_fkey;
ALTER TABLE public.event_category_build_state
  ADD CONSTRAINT event_category_build_state_set_by_fkey FOREIGN KEY (set_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_egift_methods DROP CONSTRAINT IF EXISTS event_egift_methods_created_by_user_id_fkey;
ALTER TABLE public.event_egift_methods
  ADD CONSTRAINT event_egift_methods_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_manual_vendors DROP CONSTRAINT IF EXISTS event_manual_vendors_created_by_user_id_fkey;
ALTER TABLE public.event_manual_vendors
  ADD CONSTRAINT event_manual_vendors_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_moderators DROP CONSTRAINT IF EXISTS event_moderators_invited_by_user_id_fkey;
ALTER TABLE public.event_moderators
  ADD CONSTRAINT event_moderators_invited_by_user_id_fkey FOREIGN KEY (invited_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_sponsors DROP CONSTRAINT IF EXISTS event_sponsors_created_by_user_id_fkey;
ALTER TABLE public.event_sponsors
  ADD CONSTRAINT event_sponsors_created_by_user_id_fkey FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.guest_columns DROP CONSTRAINT IF EXISTS guest_columns_reviewed_by_user_id_fkey;
ALTER TABLE public.guest_columns
  ADD CONSTRAINT guest_columns_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.guest_message_blocks DROP CONSTRAINT IF EXISTS guest_message_blocks_blocked_by_fkey;
ALTER TABLE public.guest_message_blocks
  ADD CONSTRAINT guest_message_blocks_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.photo_messages DROP CONSTRAINT IF EXISTS photo_messages_reviewed_by_user_id_fkey;
ALTER TABLE public.photo_messages
  ADD CONSTRAINT photo_messages_reviewed_by_user_id_fkey FOREIGN KEY (reviewed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.scan_events DROP CONSTRAINT IF EXISTS scan_events_scanner_user_id_fkey;
ALTER TABLE public.scan_events
  ADD CONSTRAINT scan_events_scanner_user_id_fkey FOREIGN KEY (scanner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.slug_change_log DROP CONSTRAINT IF EXISTS slug_change_log_changed_by_fkey;
ALTER TABLE public.slug_change_log
  ADD CONSTRAINT slug_change_log_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;


-- ── 2 · Ephemeral OAuth handshake state → CASCADE (3, all NOT NULL) ────────
-- Meaningless without the user who started it. Same call as vendor_ig_oauth_state
-- this morning. NO ROWS ARE DELETED HERE; they simply stop refusing.

-- oauth_state: 30 rows blocking today
ALTER TABLE public.oauth_state DROP CONSTRAINT IF EXISTS oauth_state_initiated_by_fkey;
ALTER TABLE public.oauth_state
  ADD CONSTRAINT oauth_state_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- live_studio_channel_oauth_state: 0 rows
ALTER TABLE public.live_studio_channel_oauth_state DROP CONSTRAINT IF EXISTS live_studio_channel_oauth_state_initiated_by_fkey;
ALTER TABLE public.live_studio_channel_oauth_state
  ADD CONSTRAINT live_studio_channel_oauth_state_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- patiktok_oauth_state: 0 rows
ALTER TABLE public.patiktok_oauth_state DROP CONSTRAINT IF EXISTS patiktok_oauth_state_initiated_by_fkey;
ALTER TABLE public.patiktok_oauth_state
  ADD CONSTRAINT patiktok_oauth_state_initiated_by_fkey FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE CASCADE;
