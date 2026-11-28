-- gown_designs_hand_work
-- Created via `pnpm migration:new`. Idempotent (ADD COLUMN IF NOT EXISTS; COMMENT ON is a plain overwrite).
--
-- 👗 Gown maker A7b "Place by hand" (coordinator, 28 Nov 2026): the beads, holes, lace motifs and cuts the bride
-- places by hand can reach about 384 KB, so they cannot live inside `config` (CHECKed at 8192 bytes). They get their
-- own column, sanitized on the server by `sanitizeGownHand` (lib/gown-config.ts, GOWN_HAND_MAX_BYTES = 393216) before
-- `gown_tool` op `send` writes it.
--
-- WHO READS IT: exactly who reads the rest of the design. `gown_designs` grants SELECT to `authenticated` on the
-- WHOLE TABLE and narrows rows with the one `gown_designs_member_read` policy (the event's hosts, that shop, its
-- Account Manager on their own clients' chats), so a new column needs no grant and no policy of its own, and anon
-- still reaches nothing. Nobody signed in writes it (the table has no INSERT/UPDATE grant; only the server writes).
-- The designer's tape stays in `gown_fittings`, readable by the shop only — untouched here.
-- NULL = no hand work (every design sent before this, and every design without it): the send path works without it.

ALTER TABLE public.gown_designs
  ADD COLUMN IF NOT EXISTS hand JSONB NULL
  CONSTRAINT gown_designs_hand_is_a_bounded_object
  CHECK (hand IS NULL OR (jsonb_typeof(hand) = 'object' AND pg_column_size(hand) <= 393216));

COMMENT ON COLUMN public.gown_designs.hand IS
  'Gown maker A7b (2026-11-28): the work the bride placed by hand (GownHand: handBeads, handHoles, handLace, handCuts), sanitized by lib/gown-config.ts sanitizeGownHand and capped at GOWN_HAND_MAX_BYTES (393216). Read like the rest of the design (the table''s one member-read policy); written only by the server on Send. No money in it. NULL = no hand work.';
