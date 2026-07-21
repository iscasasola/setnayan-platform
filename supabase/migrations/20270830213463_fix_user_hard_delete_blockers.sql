-- Fix admin hard-delete of users (2026-07-21)
--
-- PROBLEM
-- `deleteUser()` (apps/web/app/admin/users/actions.ts) calls
-- auth.admin.deleteUser(), which issues DELETE FROM auth.users. That delete
-- was blocked for any user with real activity by two things:
--
--   1. 41 foreign keys pointing at auth.users / public.users declared
--      ON DELETE NO ACTION. NO ACTION *restricts* — it neither cascades nor
--      nulls — so a single referencing row aborted the whole delete.
--      Measured 2026-07-21: one active account had 43 blocking rows across
--      9 tables.
--   2. vendor_team_guard() raised VENDOR_LAST_ADMIN unconditionally when a
--      store's only admin was removed, with no exemption for "the store
--      itself is being deleted". Every vendor is the sole admin of their own
--      store, so no vendor account could ever be deleted.
--
-- Net effect: the admin console's Delete / Blacklist buttons threw for
-- essentially every real user, and /admin/account-deletions (the RA 10173
-- right-to-erasure queue, which delegates to the same action) threw with them.
--
-- APPROACH
-- Every NO ACTION FK below is re-declared with an explicit rule. The choice
-- per column is deliberate, not mechanical:
--
--   CASCADE  — the row is *about* the departing user or is ephemeral scratch
--              state. It has no meaning once they are gone.
--   SET NULL — the row must OUTLIVE the user: audit trails, financial
--              records, and event content that belongs to the couple rather
--              than to whoever happened to type it. The row survives
--              de-identified, which is also what RA 10173 erasure wants —
--              erase the person, keep the business record.
--
-- Columns in the SET NULL group that were NOT NULL have the constraint
-- dropped, since de-identifying requires a nullable column.

BEGIN;

-- ---------------------------------------------------------------------------
-- A. NOT NULL → CASCADE. Row is about the user, or is ephemeral OAuth/job
--    scratch state. Deleting the user should delete the row.
-- ---------------------------------------------------------------------------

-- An abuse flag raised against a departing account is meaningless without them.
ALTER TABLE public.concierge_abuse_flags
  DROP CONSTRAINT concierge_abuse_flags_flagged_user_id_fkey,
  ADD  CONSTRAINT concierge_abuse_flags_flagged_user_id_fkey
       FOREIGN KEY (flagged_user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

-- The delegation grant IS the person; revoking it with them is correct.
ALTER TABLE public.event_delegates
  DROP CONSTRAINT event_delegates_delegate_user_id_fkey,
  ADD  CONSTRAINT event_delegates_delegate_user_id_fkey
       FOREIGN KEY (delegate_user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

-- Founder time tracking is per-person.
ALTER TABLE public.founder_time_log
  DROP CONSTRAINT founder_time_log_user_id_fkey,
  ADD  CONSTRAINT founder_time_log_user_id_fkey
       FOREIGN KEY (user_id) REFERENCES public.users(user_id) ON DELETE CASCADE;

-- Ephemeral OAuth handshake state — worthless without the initiator.
ALTER TABLE public.oauth_state
  DROP CONSTRAINT oauth_state_initiated_by_fkey,
  ADD  CONSTRAINT oauth_state_initiated_by_fkey
       FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.patiktok_oauth_state
  DROP CONSTRAINT patiktok_oauth_state_initiated_by_fkey,
  ADD  CONSTRAINT patiktok_oauth_state_initiated_by_fkey
       FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.vendor_ig_oauth_state
  DROP CONSTRAINT vendor_ig_oauth_state_initiated_by_fkey,
  ADD  CONSTRAINT vendor_ig_oauth_state_initiated_by_fkey
       FOREIGN KEY (initiated_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- A third-party token grant is bound to the granting account.
ALTER TABLE public.patiktok_oauth_grants
  DROP CONSTRAINT patiktok_oauth_grants_granted_by_fkey,
  ADD  CONSTRAINT patiktok_oauth_grants_granted_by_fkey
       FOREIGN KEY (granted_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Render jobs are per-requester work items, not records worth keeping.
ALTER TABLE public.patiktok_render_jobs
  DROP CONSTRAINT patiktok_render_jobs_requested_by_fkey,
  ADD  CONSTRAINT patiktok_render_jobs_requested_by_fkey
       FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.render_jobs
  DROP CONSTRAINT render_jobs_requested_by_fkey,
  ADD  CONSTRAINT render_jobs_requested_by_fkey
       FOREIGN KEY (requested_by) REFERENCES auth.users(id) ON DELETE CASCADE;

-- ---------------------------------------------------------------------------
-- B. NOT NULL → nullable + SET NULL. These rows must survive the person.
--    Audit trails, money, and event content the couple still owns.
-- ---------------------------------------------------------------------------

-- Per-event audit trail. Losing it on user delete would gut the ability to
-- reconstruct what happened at an event.
ALTER TABLE public.event_action_log ALTER COLUMN performed_by_user_id DROP NOT NULL;
ALTER TABLE public.event_action_log
  DROP CONSTRAINT event_action_log_performed_by_user_id_fkey,
  ADD  CONSTRAINT event_action_log_performed_by_user_id_fkey
       FOREIGN KEY (performed_by_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- Financial ledger — BIR-relevant. Must never be deleted by a user purge.
ALTER TABLE public.order_ledger ALTER COLUMN actor_user_id DROP NOT NULL;
ALTER TABLE public.order_ledger
  DROP CONSTRAINT order_ledger_actor_user_id_fkey,
  ADD  CONSTRAINT order_ledger_actor_user_id_fkey
       FOREIGN KEY (actor_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- Redemption history is a financial record; keep it, de-identified.
ALTER TABLE public.discount_code_redemptions ALTER COLUMN couple_user_id DROP NOT NULL;
ALTER TABLE public.discount_code_redemptions
  DROP CONSTRAINT discount_code_redemptions_couple_user_id_fkey,
  ADD  CONSTRAINT discount_code_redemptions_couple_user_id_fkey
       FOREIGN KEY (couple_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- Admin attribution only. CASCADE here would delete the discount CODE itself
-- when the admin who created it leaves — a live footgun.
ALTER TABLE public.discount_codes ALTER COLUMN created_by_admin_id DROP NOT NULL;
ALTER TABLE public.discount_codes
  DROP CONSTRAINT discount_codes_created_by_admin_id_fkey,
  ADD  CONSTRAINT discount_codes_created_by_admin_id_fkey
       FOREIGN KEY (created_by_admin_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- Likewise: an admin leaving must not revoke couples' code eligibility.
ALTER TABLE public.discount_code_eligible_users ALTER COLUMN added_by_admin_id DROP NOT NULL;
ALTER TABLE public.discount_code_eligible_users
  DROP CONSTRAINT discount_code_eligible_users_added_by_admin_id_fkey,
  ADD  CONSTRAINT discount_code_eligible_users_added_by_admin_id_fkey
       FOREIGN KEY (added_by_admin_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- Who granted the delegation is attribution; the grant row itself is still
-- needed to explain the delegate's access.
ALTER TABLE public.event_delegates ALTER COLUMN granted_by_user_id DROP NOT NULL;
ALTER TABLE public.event_delegates
  DROP CONSTRAINT event_delegates_granted_by_user_id_fkey,
  ADD  CONSTRAINT event_delegates_granted_by_user_id_fkey
       FOREIGN KEY (granted_by_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- Event content belongs to the event, not to whoever uploaded it. A guest or
-- co-planner leaving must not silently strip the couple's mood board.
ALTER TABLE public.event_inspiration_assets ALTER COLUMN added_by_user_id DROP NOT NULL;
ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT event_inspiration_assets_added_by_user_id_fkey,
  ADD  CONSTRAINT event_inspiration_assets_added_by_user_id_fkey
       FOREIGN KEY (added_by_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.event_playlist_picks ALTER COLUMN created_by_user_id DROP NOT NULL;
ALTER TABLE public.event_playlist_picks
  DROP CONSTRAINT event_playlist_picks_created_by_user_id_fkey,
  ADD  CONSTRAINT event_playlist_picks_created_by_user_id_fkey
       FOREIGN KEY (created_by_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- Kwento assignment survives the assigner.
ALTER TABLE public.kwento_assignments ALTER COLUMN assigned_by_user_id DROP NOT NULL;
ALTER TABLE public.kwento_assignments
  DROP CONSTRAINT kwento_assignments_assigned_by_user_id_fkey,
  ADD  CONSTRAINT kwento_assignments_assigned_by_user_id_fkey
       FOREIGN KEY (assigned_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- C. Already nullable → SET NULL. Pure attribution columns; de-identify.
-- ---------------------------------------------------------------------------

ALTER TABLE public.bespoke_monogram_generations
  DROP CONSTRAINT bespoke_monogram_generations_created_by_fkey,
  ADD  CONSTRAINT bespoke_monogram_generations_created_by_fkey
       FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.budget_allocation_decisions
  DROP CONSTRAINT budget_allocation_decisions_recorded_by_fkey,
  ADD  CONSTRAINT budget_allocation_decisions_recorded_by_fkey
       FOREIGN KEY (recorded_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.budget_builds
  DROP CONSTRAINT budget_builds_created_by_fkey,
  ADD  CONSTRAINT budget_builds_created_by_fkey
       FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.concierge_abuse_flags
  DROP CONSTRAINT concierge_abuse_flags_reviewed_by_fkey,
  ADD  CONSTRAINT concierge_abuse_flags_reviewed_by_fkey
       FOREIGN KEY (reviewed_by) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.concierge_brain_chunks
  DROP CONSTRAINT concierge_brain_chunks_last_verified_by_user_id_fkey,
  ADD  CONSTRAINT concierge_brain_chunks_last_verified_by_user_id_fkey
       FOREIGN KEY (last_verified_by_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.concierge_plan_templates
  DROP CONSTRAINT concierge_plan_templates_admin_edited_by_user_id_fkey,
  ADD  CONSTRAINT concierge_plan_templates_admin_edited_by_user_id_fkey
       FOREIGN KEY (admin_edited_by_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.concierge_response_cache
  DROP CONSTRAINT concierge_response_cache_admin_edited_by_user_id_fkey,
  ADD  CONSTRAINT concierge_response_cache_admin_edited_by_user_id_fkey
       FOREIGN KEY (admin_edited_by_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.concierge_unanswered_questions
  DROP CONSTRAINT concierge_unanswered_questions_resolved_by_user_id_fkey,
  ADD  CONSTRAINT concierge_unanswered_questions_resolved_by_user_id_fkey
       FOREIGN KEY (resolved_by_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.event_build_picks
  DROP CONSTRAINT event_build_picks_picked_by_fkey,
  ADD  CONSTRAINT event_build_picks_picked_by_fkey
       FOREIGN KEY (picked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_category_build_state
  DROP CONSTRAINT event_category_build_state_set_by_fkey,
  ADD  CONSTRAINT event_category_build_state_set_by_fkey
       FOREIGN KEY (set_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_delegates
  DROP CONSTRAINT event_delegates_revoked_by_user_id_fkey,
  ADD  CONSTRAINT event_delegates_revoked_by_user_id_fkey
       FOREIGN KEY (revoked_by_user_id) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.event_egift_methods
  DROP CONSTRAINT event_egift_methods_created_by_user_id_fkey,
  ADD  CONSTRAINT event_egift_methods_created_by_user_id_fkey
       FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_manual_vendors
  DROP CONSTRAINT event_manual_vendors_created_by_user_id_fkey,
  ADD  CONSTRAINT event_manual_vendors_created_by_user_id_fkey
       FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_moderators
  DROP CONSTRAINT event_moderators_invited_by_user_id_fkey,
  ADD  CONSTRAINT event_moderators_invited_by_user_id_fkey
       FOREIGN KEY (invited_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.event_sponsors
  DROP CONSTRAINT event_sponsors_created_by_user_id_fkey,
  ADD  CONSTRAINT event_sponsors_created_by_user_id_fkey
       FOREIGN KEY (created_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.founder_seats
  DROP CONSTRAINT founder_seats_granted_by_fkey,
  ADD  CONSTRAINT founder_seats_granted_by_fkey
       FOREIGN KEY (granted_by) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.guest_message_blocks
  DROP CONSTRAINT guest_message_blocks_blocked_by_fkey,
  ADD  CONSTRAINT guest_message_blocks_blocked_by_fkey
       FOREIGN KEY (blocked_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.moodboard_library_assets
  DROP CONSTRAINT moodboard_library_assets_uploaded_by_fkey,
  ADD  CONSTRAINT moodboard_library_assets_uploaded_by_fkey
       FOREIGN KEY (uploaded_by) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.owner_alerts
  DROP CONSTRAINT owner_alerts_acknowledged_by_fkey,
  ADD  CONSTRAINT owner_alerts_acknowledged_by_fkey
       FOREIGN KEY (acknowledged_by) REFERENCES public.users(user_id) ON DELETE SET NULL;

ALTER TABLE public.photo_messages
  DROP CONSTRAINT photo_messages_reviewed_by_user_id_fkey,
  ADD  CONSTRAINT photo_messages_reviewed_by_user_id_fkey
       FOREIGN KEY (reviewed_by_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.scan_events
  DROP CONSTRAINT scan_events_scanner_user_id_fkey,
  ADD  CONSTRAINT scan_events_scanner_user_id_fkey
       FOREIGN KEY (scanner_user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.slug_change_log
  DROP CONSTRAINT slug_change_log_changed_by_fkey,
  ADD  CONSTRAINT slug_change_log_changed_by_fkey
       FOREIGN KEY (changed_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.users
  DROP CONSTRAINT users_concierge_banned_by_fkey,
  ADD  CONSTRAINT users_concierge_banned_by_fkey
       FOREIGN KEY (concierge_banned_by) REFERENCES public.users(user_id) ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- D. vendor_team_guard() — exempt the "store is being deleted" case.
--
-- The guard protects a LIVE store from losing its last admin. It must not
-- fire when the store itself is going away. vendor_team_members.vendor_profile_id
-- is ON DELETE CASCADE, so by the time this BEFORE DELETE trigger runs during a
-- store delete, the parent vendor_profiles row is already gone — that absence
-- is the signal. Every other branch is unchanged.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.vendor_team_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_actor       UUID := auth.uid();
  v_approved    BOOLEAN := COALESCE(current_setting('app.vendor_admin_change_approved', true), '') = 'true';
  v_other_admins INT;
BEGIN
  -- Store teardown: the parent vendor_profiles row is already deleted (the FK
  -- cascade fired this trigger), so there is no live store left to protect.
  -- Without this, deleting a store — or the sole-admin user behind it — raised
  -- VENDOR_LAST_ADMIN and aborted the whole transaction.
  IF TG_OP = 'DELETE' AND NOT EXISTS (
    SELECT 1 FROM public.vendor_profiles WHERE vendor_profile_id = OLD.vendor_profile_id
  ) THEN
    RETURN OLD;
  END IF;

  IF TG_OP = 'DELETE' AND OLD.role = 'admin' THEN
    SELECT count(*) INTO v_other_admins FROM public.vendor_team_members
      WHERE vendor_profile_id = OLD.vendor_profile_id AND role = 'admin'
        AND vendor_team_member_id <> OLD.vendor_team_member_id;
    IF v_other_admins < 1 THEN
      RAISE EXCEPTION 'VENDOR_LAST_ADMIN: a store must keep at least one admin';
    END IF;
    -- Removing ANOTHER admin needs the approved flag; self-removal is allowed.
    IF v_actor IS NOT NULL AND OLD.user_id <> v_actor AND NOT v_approved THEN
      RAISE EXCEPTION 'VENDOR_ADMIN_CHANGE_NEEDS_VOTE: removing another admin needs a team vote';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.role = 'admin' AND NEW.role <> 'admin' THEN
    SELECT count(*) INTO v_other_admins FROM public.vendor_team_members
      WHERE vendor_profile_id = OLD.vendor_profile_id AND role = 'admin'
        AND vendor_team_member_id <> OLD.vendor_team_member_id;
    IF v_other_admins < 1 THEN
      RAISE EXCEPTION 'VENDOR_LAST_ADMIN: a store must keep at least one admin';
    END IF;
    IF v_actor IS NOT NULL AND OLD.user_id <> v_actor AND NOT v_approved THEN
      RAISE EXCEPTION 'VENDOR_ADMIN_CHANGE_NEEDS_VOTE: demoting another admin needs a team vote';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$function$;

COMMIT;
