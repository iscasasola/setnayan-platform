-- ADD 'cake' TO event_inspiration_assets.slot_key — 17 slots → 18.
--
-- Owner, 2026-09-03: *"add cakes on inspiration also. we want to allow vendors
-- to upload their creations so they can get sales."*
--
-- The cake is one of the most photographed objects at a Filipino wedding and
-- had no slot at all, so a couple could collect a ceiling and a tunnel but not
-- the cake standing in the middle of their own reception.
--
-- 🤝 IT IS ALSO A SUPPLIER SLOT, WHICH IS THE POINT. The vendor taxonomy
-- (apps/web/lib/taxonomy.ts) already carries `cake_maker`, `wedding_cake`,
-- `cake_desserts`, `cake_table` and `dessert_station` — so this slot maps onto
-- real trades that can stock it from their own portfolios, exactly like
-- florists fill `flowers` and gown designers fill `bride`. A cake maker's own
-- photograph is content they own and want discovered, which is why the
-- supplier-supplied gallery is both the safer and the better pool (see the
-- 2026-09-03 DECISION_LOG row on the inspiration gallery).
--
-- ⚠ THREE GATES, EDITED TOGETHER — a slot added to only some of them fails in
-- a way that looks like nothing happened:
--   (1) MOODBOARD_SLOT_KEYS in wizard-actions.ts — isMoodboardSlotKey() rejects
--       an unlisted key with "slot_key invalid" BEFORE any DB call;
--   (2) the GROUPS list in inspiration-board.tsx — the only thing that renders
--       a tile at all;
--   (3) this CHECK — Postgres refuses the row after the file already reached R2.
--
-- Additive only: every existing value is preserved verbatim, so no stored row
-- can be invalidated. A NEW migration rather than an edit to 20271194900000,
-- which is already committed and pushed on this branch — history that other
-- sessions may hold is not rewritten to save one ALTER.

ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_slot_key_check_v2;

ALTER TABLE public.event_inspiration_assets
  DROP CONSTRAINT IF EXISTS event_inspiration_assets_slot_key_check_v3;

ALTER TABLE public.event_inspiration_assets
  ADD CONSTRAINT event_inspiration_assets_slot_key_check_v3
  CHECK (slot_key IN (
    'venue','tunnel','stage','table','ceiling','overall',
    'backdrop','flowers','cocktail','reception_venue','cake',
    'palette',
    'groom','bride','principal_sponsor','entourage','parents','guests'
  ));
