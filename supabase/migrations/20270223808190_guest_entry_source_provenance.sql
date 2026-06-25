-- Iteration 0000 ADDENDUM (2026-06-25) — Invite/Join v2: typed guest provenance.
--
-- The invite/join flow moves to "name-as-answer-key · optimistic admit": a guest
-- types their name, it's matched against the couple's list; a confident match
-- links + inherits the host-assigned role, anything else is STILL admitted but
-- flagged for the couple to reconcile (Link / Keep / Delete). This replaces the
-- ad-hoc `custom_tags['self_joined']` marker (accountless self-join) and the
-- separate `guest_claims` OTP/pending-review ledger with ONE first-class column
-- so the couple's list, the reconcile queue, and analytics all read provenance
-- the same way.
--
-- Spec: 0000_ADDENDUM_invite_join_model_2026-06-25.md.
-- Additive + idempotent + safe default → backward-compatible with shipped code
-- (which ignores the new column until the v2 actions land).

DO $$ BEGIN
  CREATE TYPE public.guest_entry_source AS ENUM (
    -- The couple typed this name into their list (the default for every row,
    -- and what a reconciled/"Kept" guest is promoted back to).
    'host_seeded',
    -- A joiner whose typed name did NOT confidently match the list. Admitted
    -- immediately (never blocked) but surfaced in the couple's reconcile queue.
    'self_added_unlisted'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.guests
  ADD COLUMN IF NOT EXISTS entry_source public.guest_entry_source
    NOT NULL DEFAULT 'host_seeded';

-- Backfill: the prior accountless self-join (selfJoinAction) tagged its rows
-- custom_tags['self_joined']. Those are exactly the "admitted, not on the list"
-- rows the couple should reconcile, so map them onto the new column.
UPDATE public.guests
  SET entry_source = 'self_added_unlisted'
  WHERE 'self_joined' = ANY(custom_tags)
    AND entry_source = 'host_seeded';

-- The couple's reconcile queue is: unlisted, undeleted rows for one event.
CREATE INDEX IF NOT EXISTS guests_event_entry_source_idx
  ON public.guests (event_id, entry_source)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.guests.entry_source IS
  'Invite/Join v2 provenance (0000 ADDENDUM 2026-06-25): host_seeded = couple typed it; self_added_unlisted = a joiner whose name did not match, admitted + queued for couple reconcile.';
