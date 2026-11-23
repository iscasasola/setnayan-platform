-- ═══════════════════════════════════════════════════════════════════════════
-- hub_tool_lists_ride_the_shot_list — four hub tools keep their rows on the
-- shipped shot-list table (DECISION_LOG 2026-11-23, the ten most-shared unbuilt
-- hub tools; this PR builds Queue counter · Entourage · Paperwork checklist ·
-- Load-in & venue access · Delivery & drop-off).
-- ═══════════════════════════════════════════════════════════════════════════
--
-- RULE 0 — a column, not a table. `event_shot_list_items` is already the
-- CHECKLIST template's store: one supplier's rows for one event, a label, an
-- order and a done-at moment, with booked-supplier write + couple read RLS
-- (20271234188149). `shot_list` is itself a hub tool record (`hub_tools`,
-- template 'checklist'). Three more checklist tools — Paperwork checklist,
-- Load-in & venue access, Delivery & drop-off — are the same shape, so they
-- ride the same rows, told apart by `tool_key`.
--
-- The Queue counter (template 'counter') rides them too: each ＋ is ONE row
-- (label "Served", `captured_at` = the moment), each − removes the latest one,
-- and the count is the number of rows. An insert per serve is atomic, so two
-- phones at one booth never overwrite each other's count, and every serve keeps
-- its time.
--
-- Entourage (template 'per_person') stores nothing: it reads the couple's own
-- entourage (`loadMarch`), read-only.
--
-- `tool_key` REFERENCES `hub_tools` (the ONE library), so a row can only name a
-- tool record; ON DELETE RESTRICT matches the library's "turn off, never delete".
-- Existing rows default to 'shot_list' — the only tool that wrote here before.
--
-- RLS is unchanged: the policies are per (event, supplier), and a tool is a
-- slice of that supplier's own rows. INSERT gains the column (insert-only, like
-- event_id / vendor_profile_id: an UPDATE can never move a row to another tool).

ALTER TABLE public.event_shot_list_items
  ADD COLUMN IF NOT EXISTS tool_key TEXT NOT NULL DEFAULT 'shot_list'
    REFERENCES public.hub_tools(tool_key) ON DELETE RESTRICT;

COMMENT ON COLUMN public.event_shot_list_items.tool_key IS
  'Which hub tool this row belongs to (hub_tools.tool_key): shot_list · paperwork_checklist · load_in_and_venue_access · delivery_and_drop_off (checklists), queue_counter (one row per serve). Insert-only.';

-- The read pattern is now (event, supplier, tool) in order.
CREATE INDEX IF NOT EXISTS event_shot_list_items_event_vendor_tool_idx
  ON public.event_shot_list_items (event_id, vendor_profile_id, tool_key, position);
-- FK covering index for the hub_tools RESTRICT check.
CREATE INDEX IF NOT EXISTS event_shot_list_items_tool_idx
  ON public.event_shot_list_items (tool_key);

GRANT INSERT (tool_key) ON public.event_shot_list_items TO authenticated;
