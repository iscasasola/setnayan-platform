-- ═══════════════════════════════════════════════════════════════════════════
-- event_site_drafts — the Event Hub Maker edits a DRAFT (Maker Phase 2).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- WHY THIS TABLE EXISTS AT ALL
-- Owner, 2026-09-24 (DECISION_LOG "EDIT … AS A DRAFT: Apply · Restore · Reset to
-- default"): *"have a button to apply save. so they can restore to last state or
-- reset back to default."* And 2026-09-25 "Try then pay": a free couple may try a
-- Pro change in the draft on their own page and pays at Apply.
--
-- Until now every Event Hub writer (`website/widgets/actions.ts`,
-- `website/editor/actions.ts`, …) wrote the LIVE columns guests read. There was
-- nowhere to put a change that guests must not see yet.
--
-- RULE 0 — no existing table expresses this. `event_editorial.draft_json` is the
-- Post Event story's own document (its `status` IS the audience), not a draft of
-- the hub; `invitation_widgets.config_json` and the `events` look columns are the
-- live page. ONE ROW PER EVENT: the row existing IS "there is a draft"; Restore
-- deletes it; Apply writes what it may and deletes what it wrote.
--
-- WHAT draft_json HOLDS (shape owned by `apps/web/lib/hub-draft.ts`, sanitised on
-- every read and write — the database only fences type and size):
--   { v: 1,
--     events:  { <allow-listed events column>: value | null },
--     widgets: { <widget_type>: { mode?, display_order?, canvas? } },
--     history: [ …up to ten earlier {events, widgets} states, for Undo ] }
--
-- applied_snapshot — what the LIVE page held for every key the last Apply wrote,
-- taken just before it wrote. Nothing reads it back automatically; it is the
-- record that makes "what did Apply change?" answerable after the fact.
--
-- ⚠ NO `updated_by` COLUMN, deliberately (the build plan named one). A user id on
-- this row would be personal data with a FK the erasure and user-delete surfaces
-- must then handle (`user-fk-behaviour.generated.txt`), for no reader: nothing
-- shows who edited the draft. The row belongs to the EVENT and dies with it.
--
-- WHO MAY DO WHAT
--   • the event's HOSTS — the couple (`current_couple_event_ids()`) or an accepted
--     co-host / coordinator (`current_moderator_event_ids()`), the same two sources
--     `lib/host-gate.ts` `requireHostMembership` accepts — read and write the row;
--   • admins (`is_admin()`);
--   • anyone else, INCLUDING AN INVITED GUEST — nothing.
-- 🔑 NOT `current_event_ids()`. That helper returns an event for EVERY member
-- type, guests included (see its COMMENT, and migration 20271015300000 which
-- narrowed ten *_couple_* / *_host_* policies off it for exactly this reason). A
-- draft is an unpublished page: a guest reading it would see what the couple has
-- not decided to show.
--
-- ⚠ DEFAULT ACL: every new relation in `public` ships OPEN to anon AND
-- authenticated on this project. The REVOKE ALL in § 3 is load-bearing.

-- ── 1 · The table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.event_site_drafts (
  event_id          UUID PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,

  -- An object, and bounded. 200 kB of JSON text is far above any real draft
  -- (sixteen sections' canvases plus ten undo states is a few kB); the ceiling
  -- only stops a hand-crafted POST from parking megabytes on a row.
  draft_json        JSONB NOT NULL DEFAULT '{}'::jsonb
                    CHECK (jsonb_typeof(draft_json) = 'object'
                           AND octet_length(draft_json::text) <= 200000),

  applied_snapshot  JSONB
                    CHECK (applied_snapshot IS NULL
                           OR (jsonb_typeof(applied_snapshot) = 'object'
                               AND octet_length(applied_snapshot::text) <= 200000)),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.event_site_drafts ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_site_drafts IS
  'The Event Hub Maker''s unpublished edits for one event — one row per event, present only while there is a draft. Hosts see it overlaid on their own preview (?editor=1); guests always read the live columns. Apply writes what it may (Pro keys only with Event Hub Pro) and removes what it wrote; Restore deletes the row. Shape: apps/web/lib/hub-draft.ts.';

COMMENT ON COLUMN public.event_site_drafts.applied_snapshot IS
  'What the live page held for every key the last Apply wrote, captured just before writing. A record, not an undo source.';

-- ── 2 · updated_at trigger ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.touch_event_site_drafts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS event_site_drafts_touch ON public.event_site_drafts;
CREATE TRIGGER event_site_drafts_touch
  BEFORE UPDATE ON public.event_site_drafts
  FOR EACH ROW EXECUTE FUNCTION public.touch_event_site_drafts();

REVOKE ALL ON FUNCTION public.touch_event_site_drafts() FROM PUBLIC, anon, authenticated;

-- ── 3 · Privileges — REVOKE FIRST, then grant back the minimum ─────────────

REVOKE ALL ON public.event_site_drafts FROM PUBLIC;
REVOKE ALL ON public.event_site_drafts FROM anon;
REVOKE ALL ON public.event_site_drafts FROM authenticated;

-- INSERT and UPDATE are COLUMN lists: RLS is row-level and cannot constrain a
-- value, so only the grant keeps the timestamps server-owned and keeps an UPDATE
-- from re-pointing a draft at another event (event_id is insert-only).
GRANT SELECT, DELETE ON public.event_site_drafts TO authenticated;
GRANT INSERT (event_id, draft_json, applied_snapshot) ON public.event_site_drafts TO authenticated;
GRANT UPDATE (draft_json, applied_snapshot) ON public.event_site_drafts TO authenticated;
GRANT ALL ON public.event_site_drafts TO service_role;

-- ── 4 · RLS ────────────────────────────────────────────────────────────────
-- One FOR ALL policy: the hosts of the event, or an admin. USING and WITH CHECK
-- are identical, so a row can neither be read nor written onto an event the
-- caller does not host.

DROP POLICY IF EXISTS event_site_drafts_host_all ON public.event_site_drafts;
CREATE POLICY event_site_drafts_host_all
  ON public.event_site_drafts FOR ALL TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (SELECT public.current_moderator_event_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    OR event_id IN (SELECT public.current_moderator_event_ids())
    OR public.is_admin()
  );
