-- event_vendor_working_notes
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
-- ============================================================================
-- Coordinator P4 — per-vendor WORKING FOLDER notes (corpus
-- Coordinator_Role_Feature_Spec_2026-07-18.md § 4 P4 / Coordinator_Whats_Next
-- § 5 P4): "private coordinator notes vs couple-visible notes".
--
-- Append-only note rows attached to one event_vendors booking. No UPDATE
-- policy anywhere — a note is never edited, only added (and removable by its
-- own author as the privacy safety valve for a note misfired into 'shared').
-- Proposal VERSIONING is deliberately NOT built here: the spec's "proposal
-- versioning" clause is about vendor proposals, not notes — append-only rows
-- beat an edit-history machine.
--
-- Visibility model (THE feature):
--   • 'coordinator_private' — readable by the event's accepted coordinators
--     (event_moderators, via current_moderator_event_ids()) and NOT by the
--     couple. ⚠ This intentionally inverts the usual Pattern B direction
--     ("couple reads everything on their event") — see the policy comments.
--   • 'shared'              — readable by couple + coordinators.
--
-- Authoring:
--   • Coordinator (accepted event delegate) — either visibility, stamped
--     author_user_id = auth.uid(), author_role = 'coordinator'.
--   • Couple — 'shared' only (a couple-authored "coordinator-private" note is
--     a contradiction), author_role = 'couple'.
--
-- RLS mapping: canonical Pattern B (per-event collaborative data) using the
-- shipped coordinator split idiom from coordinator_feature_recommendations
-- (mig 20270215220130): coordinator side gates on
-- current_moderator_event_ids(), couple side on current_couple_event_ids(),
-- with the couple's SELECT additionally predicated on visibility = 'shared'.
-- Money never touches this table.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_vendor_working_notes (
  id               BIGSERIAL PRIMARY KEY,
  note_id          UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  event_id         UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  event_vendor_id  UUID NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  author_user_id   UUID NOT NULL,
  author_role      TEXT NOT NULL CHECK (author_role IN ('coordinator', 'couple')),
  visibility       TEXT NOT NULL DEFAULT 'coordinator_private'
                     CHECK (visibility IN ('coordinator_private', 'shared')),
  body             TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A couple-authored note is always couple-visible.
  CONSTRAINT evwn_couple_notes_are_shared
    CHECK (author_role <> 'couple' OR visibility = 'shared')
);

-- The denormalized event_id is load-bearing for RLS, so make it impossible to
-- attach a note to a vendor row from a DIFFERENT event: a composite FK against
-- (vendor_id, event_id). The unique index it needs is trivially satisfied
-- (vendor_id alone is the PK).
CREATE UNIQUE INDEX IF NOT EXISTS event_vendors_vendor_event_uq
  ON public.event_vendors (vendor_id, event_id);

ALTER TABLE public.event_vendor_working_notes
  DROP CONSTRAINT IF EXISTS event_vendor_working_notes_vendor_event_fk;
ALTER TABLE public.event_vendor_working_notes
  ADD CONSTRAINT event_vendor_working_notes_vendor_event_fk
  FOREIGN KEY (event_vendor_id, event_id)
  REFERENCES public.event_vendors (vendor_id, event_id)
  ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS event_vendor_working_notes_vendor_idx
  ON public.event_vendor_working_notes (event_vendor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_vendor_working_notes_event_idx
  ON public.event_vendor_working_notes (event_id);

ALTER TABLE public.event_vendor_working_notes ENABLE ROW LEVEL SECURITY;

-- ── Coordinator (accepted event delegate / moderator) ─────────────────────
-- Reads EVERY note on their events — private notes are the coordinator's own
-- working space; shared notes are the conversation with the couple.
DROP POLICY IF EXISTS evwn_moderator_select ON public.event_vendor_working_notes;
CREATE POLICY evwn_moderator_select ON public.event_vendor_working_notes
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_moderator_event_ids()));

-- Writes notes at either visibility, stamped with their own uid.
DROP POLICY IF EXISTS evwn_moderator_insert ON public.event_vendor_working_notes;
CREATE POLICY evwn_moderator_insert ON public.event_vendor_working_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_moderator_event_ids())
    AND author_user_id = auth.uid()
    AND author_role = 'coordinator'
  );

-- ── Couple (event owner) ──────────────────────────────────────────────────
-- ⚠ UNUSUAL DIRECTION, deliberate: the couple can NOT read
-- 'coordinator_private' rows on their own event. Everywhere else Pattern B
-- gives the event owner full read; here the visibility predicate carves the
-- coordinator's private prep out of the couple's view — that privacy split IS
-- the P4 feature (industry "private vs client notes").
DROP POLICY IF EXISTS evwn_couple_select ON public.event_vendor_working_notes;
CREATE POLICY evwn_couple_select ON public.event_vendor_working_notes
  FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    AND visibility = 'shared'
  );

-- Couple may add notes to the folder too — always 'shared' (belt to the CHECK).
DROP POLICY IF EXISTS evwn_couple_insert ON public.event_vendor_working_notes;
CREATE POLICY evwn_couple_insert ON public.event_vendor_working_notes
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    AND author_user_id = auth.uid()
    AND author_role = 'couple'
    AND visibility = 'shared'
  );

-- ── Author safety valve ───────────────────────────────────────────────────
-- Append-only means no UPDATE — but the author may remove their OWN note
-- (e.g. a private observation accidentally posted as 'shared'). Nobody can
-- delete anyone else's note.
DROP POLICY IF EXISTS evwn_author_delete ON public.event_vendor_working_notes;
CREATE POLICY evwn_author_delete ON public.event_vendor_working_notes
  FOR DELETE TO authenticated
  USING (author_user_id = auth.uid());

-- ── Admin observability ───────────────────────────────────────────────────
-- Read-only lens for abuse response (same idiom as
-- coordinator_feature_recommendations). No admin write.
DROP POLICY IF EXISTS evwn_admin_select ON public.event_vendor_working_notes;
CREATE POLICY evwn_admin_select ON public.event_vendor_working_notes
  FOR SELECT TO authenticated
  USING (public.is_admin());
