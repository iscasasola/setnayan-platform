-- ═══════════════════════════════════════════════════════════════════════════
-- couples_see_supplier_checklist_ticks — the couple reads their supplier's checklist ticks
-- ═══════════════════════════════════════════════════════════════════════════
--
-- Owner, 23 Nov 2026: "let couples see the checklist ticks." (Drawing
-- `prototypes/hub_tools_working_2026-10-28/`, template ① Checklist: "Tick in place; the couple sees the ticks.")
--
-- The controller's one-home ruling of the same day already named the shape: every new hub tool keeps its rows in
-- `vendor_hub_tool_entries`, the couple reads none of them for now, and "sharing a tool with the couple, if the owner
-- asks, is a per-tool flag on `hub_tools`, never a second table." The owner asked. So:
--
--   1 · `hub_tools.couple_sees` — the per-tool flag (the Tool maker's "couple sees" switch, 2026-10-28, when it is built).
--   2 · ON for the CHECKLIST template only (Paperwork checklist · Load-in & venue access · Delivery & drop-off · Tech
--       rider · Ceremony details · Proofs & approval · Safety permit & cue). Every other template stays supplier-only:
--       a Personalisation list, a count or the dietary sheet are not "ticks", and allergies are health data.
--       (The Shot list keeps its own table and its own couple read; its flag is set too, so the library says the truth.)
--   3 · A SELECT policy for THE COUPLE ONLY — `current_couple_event_ids()` (member_type = 'couple'), never
--       `current_event_ids()`, which also returns guests. Read-only: no write grant changes.
--
-- 🔑 The flag is read INSIDE the policy, so turning a tool's flag off (or the tool itself off, `is_active`) hides its
-- rows from couples at once, with no code change. A tool the Tool maker adds starts supplier-only (DEFAULT FALSE).

ALTER TABLE public.hub_tools
  ADD COLUMN IF NOT EXISTS couple_sees BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.hub_tools.couple_sees IS
  'TRUE = the hosts of an event read a booked supplier''s rows in this tool (vendor_hub_tool_entries_couple_read). Owner 2026-11-23: couples see the checklist ticks — ON for template ''checklist'', OFF for every other template. A new tool starts FALSE.';

UPDATE public.hub_tools SET couple_sees = TRUE WHERE template = 'checklist' AND couple_sees IS DISTINCT FROM TRUE;

DROP POLICY IF EXISTS vendor_hub_tool_entries_couple_read ON public.vendor_hub_tool_entries;
CREATE POLICY vendor_hub_tool_entries_couple_read
  ON public.vendor_hub_tool_entries FOR SELECT TO authenticated
  USING (
    event_id IN (SELECT public.current_couple_event_ids())
    AND tool_key IN (SELECT ht.tool_key FROM public.hub_tools ht WHERE ht.couple_sees AND ht.is_active)
  );
