-- ═══════════════════════════════════════════════════════════════════════════
-- THE EMCEE'S SCRIPT LAYER — what a host will SAY at each moment of the night.
--
-- Owner, 2026-07-29: *"we want to help the emcees be able to help creating
-- their scripts, and plotting of the planned scripts for each part of the
-- event."*
--
-- ── THE MODEL: A LAYER, NOT A DOCUMENT ────────────────────────────────────
--
-- The emcee does not author a script file. He annotates the couple's night.
-- Three things already sit on a schedule block and this adds the fourth:
--
--   event_schedule_blocks.label   — what happens          (the couple's)
--   event_schedule_blocks.notes   — what they want said   (the couple's)
--   lib/emcee-script.BLOCK_CUE    — the shared prompt      (ours)
--   vendor_block_scripts.body     — what HE will say       (his)  ← this table
--
-- One row per (block × vendor). The couple moves dinner and his line moves
-- with it, because the line is attached to the moment rather than to a
-- position in a document.
--
-- ── VENDOR-PRIVATE, AND THAT IS THE POINT ─────────────────────────────────
--
-- The couple booked a HOST, not a manuscript. His working copy — "slow, full
-- names, Atty. first, pause for applause" — is craft, not a deliverable, and
-- showing it to them would change what he is willing to write down. So there
-- is exactly ONE read policy: the owning vendor (plus admin). Not the couple.
-- Not the coordinator. Not another supplier on the same event.
--
-- This mirrors `vendor_client_notes` ("vendor-org-only RLS — off-limits to
-- couples and to Setnayan HQ admins" — its own words), which is the shipped
-- precedent for a vendor's private working material.
--
-- ⚠ NOT named `_host_` / `_couple_` on purpose: those names carry an
-- expectation of `current_couple_event_ids()` scoping (see the 2026-07-29
-- `_host_`-policy lesson, where a member-wide function let a guest write the
-- couple's picks). This is vendor-scoped, and the name says so.
--
-- ── WHY NOT REUSE vendor_client_notes ─────────────────────────────────────
--
-- Checked first. It has the right privacy but the wrong GRANULARITY: it is one
-- note stream per CLIENT, with a remind-date, for CRM ("chase the balance").
-- A script must hang off a BLOCK so it survives a retime and can be read in
-- running order on the night. Different key, different life. Both stay.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

CREATE TABLE IF NOT EXISTS public.vendor_block_scripts (
  script_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id          UUID NOT NULL
                    REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The moment this line belongs to. CASCADE: if the couple deletes the
  -- moment, the line for it stops existing too — a script for a block that is
  -- gone is worse than no script.
  block_id          UUID NOT NULL
                    REFERENCES public.event_schedule_blocks(block_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL
                    REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- What he will say. Generous but bounded — this is a cue, not an essay, and
  -- an unbounded TEXT on a per-block row is how a table becomes a document
  -- store.
  body              TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One line per vendor per moment. Two hosts on one wedding each keep their
  -- own; neither sees the other's.
  UNIQUE (block_id, vendor_profile_id)
);

-- The only read the desk does: this vendor's whole script for this event, in
-- one shot, joined to the blocks by the caller.
CREATE INDEX IF NOT EXISTS vendor_block_scripts_vendor_event_idx
  ON public.vendor_block_scripts (vendor_profile_id, event_id);

ALTER TABLE public.vendor_block_scripts ENABLE ROW LEVEL SECURITY;

-- ONE policy, both directions. The owning vendor reads and writes their own
-- lines; nobody else reads them at all. `current_vendor_ids()` is the canonical
-- vendor-scoping helper (the same one `vendor_activities` and `vendor_songs`
-- use to let a vendor manage their own rows).
DROP POLICY IF EXISTS vendor_block_scripts_owner_all ON public.vendor_block_scripts;
CREATE POLICY vendor_block_scripts_owner_all
  ON public.vendor_block_scripts FOR ALL
  TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  )
  WITH CHECK (
    vendor_profile_id IN (SELECT public.current_vendor_ids())
    OR public.is_admin()
  );

COMMENT ON TABLE public.vendor_block_scripts IS
  'A host/MC''s spoken script, one line per schedule block. VENDOR-PRIVATE by design (owner 2026-07-29): the couple booked a host, not a manuscript — no couple or coordinator read policy exists, only the owning vendor. Attached to block_id so it survives a retime. Sibling of vendor_client_notes (same privacy, per-client rather than per-block).';

-- ── Close the default-open grant ──────────────────────────────────────────
-- Every new table in `public` ships OPEN — the default ACL grants arwdDxtm to
-- anon + authenticated, and RLS does not undo a table-level GRANT. This is the
-- documented root cause of the 368-table exposure, so the REVOKE is mandatory.
-- No `anon` grant at all: an unauthenticated stranger has no business here.

REVOKE ALL ON public.vendor_block_scripts FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_block_scripts TO authenticated;

COMMIT;
