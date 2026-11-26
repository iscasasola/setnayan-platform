-- gown maker designs shared by qr
-- Created via `pnpm migration:new`. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).
--
-- 👗 THE GOWN MAKER SHARE (owner, 26 Nov 2026, verbatim: *"sharing the design will generate a QR code to place them
-- inside the type of event where the gown is going to be used. this is same as the import QR, as to either just add
-- them to short list, or they are booked already. and this will be seen in their chatpage."*). Additive only — every
-- existing row reads exactly as before.
--
-- RULE 0 — what was checked before adding anything:
--   • The Gown Maker itself is a separate page (a 3D designer outside the platform); its options, fabrics and prices
--     are the tool's own Settings. The platform stores ONLY the design a supplier chose to share, as the tool
--     exported it (lib/gown-maker.ts `parseGownExport`, which checks every field before a write).
--   • Shortlist reuses the shipped Shortlist QR landing (`/{shop}/invite`, `claimVendorInviteToEvent`): the code rides
--     it as `?gown=<share_code>`. Booked reuses the shipped Booked QR (`vendor_locked_qr_tokens` +
--     `vendor_claim_locked_qr`) unchanged: a booked share is linked to the ONE code it was issued with
--     (`locked_token`), so every refusal and the bookings-closed checks stay that code's own. No RPC is replaced.
--   • cake_designs (the Cake Maker's sent design) was checked and REFUSED as the home: it is keyed to a thread that
--     already exists, written by the couple; a gown share exists BEFORE any thread and is the supplier's.
--   What is added: one table, `gown_designs`. The shop's own members read their shares; only the server writes
--   (service role, after parseGownExport). A couple never reads this table: the chat card reads it on the server and
--   hands over the card's fields only (thumbnail · summary lines · the price shown to the client) — never `state`.

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TABLE IF NOT EXISTS public.gown_designs (
  design_id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id     UUID        NOT NULL REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  -- The capability the Shortlist code carries (`/{shop}/invite?gown=<share_code>`). High-entropy, unguessable.
  share_code            TEXT        NOT NULL UNIQUE DEFAULT encode(extensions.gen_random_bytes(12), 'hex'),
  share_as              TEXT        NOT NULL CHECK (share_as IN ('shortlist', 'booked')),
  -- The event type the gown is for (a creatable event type's key; NULL = any).
  event_type            TEXT        NULL CHECK (event_type IS NULL OR char_length(event_type) <= 64),
  -- The coarse vendor_category the shop lands under on the couple's event (event_vendors.category).
  category              TEXT        NULL CHECK (category IS NULL OR char_length(category) <= 64),
  which                 TEXT        NOT NULL CHECK (which IN ('female', 'male')),
  summary               JSONB       NOT NULL CHECK (jsonb_typeof(summary) = 'array' AND pg_column_size(summary) <= 4096),
  -- The proposal price the client sees, as the tool sent it. NULL = the shop quotes in the chat.
  price_shown_centavos  BIGINT      NULL CHECK (price_shown_centavos IS NULL OR price_shown_centavos >= 0),
  -- The tool's PNG thumbnail (≤ 60 KB decoded → ≤ 81,944 base64 characters plus the prefix).
  thumb_data_url        TEXT        NOT NULL CHECK (thumb_data_url LIKE 'data:image/png;base64,%' AND char_length(thumb_data_url) <= 82000),
  -- The tool's own opaque state (it reloads the design from it). The shop's only; never sent to a couple.
  state                 JSONB       NOT NULL CHECK (jsonb_typeof(state) = 'object' AND pg_column_size(state) <= 65536),
  -- A booked share's ONE Booked QR. NULL until the code is made; a shortlist share never has one.
  locked_token          TEXT        NULL UNIQUE REFERENCES public.vendor_locked_qr_tokens(token) ON DELETE SET NULL,
  created_by            UUID        NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT gown_designs_only_booked_has_a_code CHECK (share_as = 'booked' OR locked_token IS NULL)
);

ALTER TABLE public.gown_designs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS gown_designs_vendor_idx ON public.gown_designs (vendor_profile_id, created_at DESC);

COMMENT ON TABLE public.gown_designs IS
  'Gown Maker (2026-11-26): a design a supplier shared from the Gown Maker as a QR — Shortlist (reusable, rides the Shortlist QR landing as ?gown=<share_code>) or Booked (linked to its one Booked QR, locked_token). A scan adds the shop to the couple''s event and posts the design as a card in that couple-supplier chat ("Gown design ref: <design_id>"). The shop''s own members read; only the server writes (service role, after lib/gown-maker.ts parseGownExport). Couples never read it directly: the card''s fields are read on the server, never state.';

DROP POLICY IF EXISTS gown_designs_own_read ON public.gown_designs;
CREATE POLICY gown_designs_own_read
  ON public.gown_designs
  FOR SELECT TO authenticated
  USING (vendor_profile_id IN (SELECT public.current_vendor_profile_ids()));

REVOKE ALL ON TABLE public.gown_designs FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.gown_designs TO authenticated;

COMMIT;
