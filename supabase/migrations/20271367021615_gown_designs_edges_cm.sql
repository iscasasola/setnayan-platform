-- gown_designs_edges_cm
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS; COMMENT ON is a plain overwrite).
--
-- 👗 Gown maker B9 (prototype v209 "Lines"): the bride's neckline, back, armholes and hem, measured in cm on her by the
-- maker when she presses Send (`lnMeasured`). The designer's cutting blocks draw them as rust "design" lines and the
-- order sheet prints them ("17.5 cm below the collarbone at centre, 14.5 cm wide at the bust line…"). They are
-- measured from her mannequin at Send and cannot be re-derived later on the server, so they are stored with the design.
-- Named `edges_cm`, not `lines`: in this table a "line" is a quote line, and the money-column guard holds that word.
--
-- WHAT IS IN IT: lib/gown-pattern/lines.ts GownOrderLines — {neck, back, hem, armhole}, numbers in cm and the named
-- line words only, checked by sanitizeGownOrderLines on the server before `gown_tool` op `send` writes it. No money.
--
-- WHO READS IT: exactly who reads the rest of the design (her body numbers already live on this row). `gown_designs`
-- grants SELECT to `authenticated` on the WHOLE TABLE and narrows rows with the one `gown_designs_member_read` policy
-- (the event's hosts, that shop, its Account Manager on their own clients' chats), so a new column needs no grant and no
-- policy of its own, and anon still reaches nothing. Nobody signed in writes it (no INSERT/UPDATE grant; the server
-- writes). NULL = no lines sent (every design sent before v209, and a maker that sent none): the blocks draw as before.

ALTER TABLE public.gown_designs
  ADD COLUMN IF NOT EXISTS edges_cm JSONB NULL
  CONSTRAINT gown_designs_edges_cm_is_a_bounded_object
  CHECK (edges_cm IS NULL OR (jsonb_typeof(edges_cm) = 'object' AND pg_column_size(edges_cm) <= 2048));

COMMENT ON COLUMN public.gown_designs.edges_cm IS
  'Gown maker B9 (prototype v209, 2026-11-28): the bride''s neckline, back, armholes and hem in cm, measured on her by the maker at Send (lib/gown-pattern/lines.ts GownOrderLines, checked by sanitizeGownOrderLines). Drawn on the designer''s cutting blocks and printed on the order sheet. Read like the rest of the design (the table''s one member-read policy); written only by the server on Send. No money. NULL = no lines sent.';
