-- gown_designs_add_ons
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS; COMMENT ON is a plain overwrite).
--
-- 👗 Gown maker B8 (the chat's design card + the Make a quote pre-fill): the add-ons the bride picked (a veil, gloves,
-- fittings …) were checked on Send and priced into her estimate, then thrown away — only the one estimate was kept.
-- So the shop's own read priced the design WITHOUT them, the card could not say what she asked for, and the quote
-- could not be pre-filled with "the estimate and its extras" (plan step B8). They get their own column.
--
-- WHAT IS IN IT: add-on IDS only (lib/gown-add-ons.ts GOWN_ADD_ONS, append-only), each one the shop offered at Send
-- (buildGownDesign refuses anything else). No money: the shop's amounts live on its own price list and are applied at
-- read time, exactly as the rest of the design is priced.
--
-- WHO READS IT: exactly who reads the rest of the design. `gown_designs` grants SELECT to `authenticated` on the
-- WHOLE TABLE and narrows rows with the one `gown_designs_member_read` policy (the event's hosts, that shop, its
-- Account Manager on their own clients' chats), so a new column needs no grant and no policy of its own, and anon
-- still reaches nothing. Nobody signed in writes it (the table has no INSERT/UPDATE grant; only the server writes).
-- '{}' = none picked (every design sent before this one reads as "none", which is what it priced as for the shop).

ALTER TABLE public.gown_designs
  ADD COLUMN IF NOT EXISTS add_ons TEXT[] NOT NULL DEFAULT '{}'
  CONSTRAINT gown_designs_add_ons_are_ids
  CHECK (cardinality(add_ons) <= 32 AND array_to_string(add_ons, ',') ~ '^([a-z][a-z_]{1,39}(,[a-z][a-z_]{1,39})*)?$');

COMMENT ON COLUMN public.gown_designs.add_ons IS
  'Gown maker B8 (2026-11-28): the add-on ids the bride picked (lib/gown-add-ons.ts GOWN_ADD_ONS), each offered by the shop at Send (lib/gown-maker.server.ts buildGownDesign). No money in it: the shop prices them from its own list at read time. Read like the rest of the design (the table''s one member-read policy); written only by the server on Send. ''{}'' = none.';
