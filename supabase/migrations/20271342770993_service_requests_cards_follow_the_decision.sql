-- Service requests: the cards follow the decision (owner rulings 2026-11-13).
--
-- WHY
-- `taxonomy_category_requests` has held a supplier's "a service you don't list"
-- since 20260811000000, with all four outcomes. What it never had is a link from
-- the supplier's CARDS to the request, so a decision wrote one row and moved
-- nothing. The owner's rulings (DECISION_LOG 2026-11-13, "A SERVICE WE DON'T
-- HAVE" + "TWELVE ANSWERS IN ONE GO"):
--   · a waiting supplier sits under "<category> › Others" as a TAG on the card —
--     the category they picked (the request's tile_id) plus the pending request.
--     NO new taxonomy rows, no global "Miscellaneous".
--   · one decision moves EVERY shop that asked for that name, and each is told.
--
-- WHAT THIS ADDS — three columns, no table, no taxonomy row:
--   1. vendor_services.category_request_id — the tag. NULL on every card that
--      is not waiting on (or was not placed by) a request. ON DELETE SET NULL so
--      deleting a request never deletes a card.
--      🔒 A supplier may write it on their OWN card (the row policy is theirs),
--      so the decision action moves a card only when the card's shop IS the
--      request's shop — `lib/service-requests.ts` `cardMayFollow`. The field is
--      theirs; the request it names must be too.
--   2. taxonomy_category_requests.supplier_seen_at — when the shop opened the
--      decided request. The notice on Services is "decided and not yet seen";
--      written by the server with the service role after a session read proved
--      the row is the caller's (the row policy lets only admins update).
--   3. taxonomy_category_request_drafts gains the AI's fuller draft for a truly
--      new service: a description, search words and inspiration parts. The
--      table stays admin-only and revoked from anon/authenticated (20271177581703),
--      so these columns are reachable by nobody but the service role.
-- Idempotent.

ALTER TABLE public.vendor_services
  ADD COLUMN IF NOT EXISTS category_request_id uuid
    REFERENCES public.taxonomy_category_requests (request_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS vendor_services_category_request_idx
  ON public.vendor_services (category_request_id)
  WHERE category_request_id IS NOT NULL;

COMMENT ON COLUMN public.vendor_services.category_request_id IS
  'The service request this card waits on ("<tile> › Others"), or was placed by. '
  'A decision moves the card only when its shop filed the request. 2026-11-13.';

ALTER TABLE public.taxonomy_category_requests
  ADD COLUMN IF NOT EXISTS supplier_seen_at timestamptz;

COMMENT ON COLUMN public.taxonomy_category_requests.supplier_seen_at IS
  'When the shop opened the decided request; NULL + decided = the notice on '
  'Services still shows. Written server-side after an ownership read. 2026-11-13.';

-- The supplier's own list and the admin's same-name grouping both read by name.
CREATE INDEX IF NOT EXISTS taxonomy_category_requests_label_idx
  ON public.taxonomy_category_requests (lower(btrim(proposed_label)));

ALTER TABLE public.taxonomy_category_request_drafts
  ADD COLUMN IF NOT EXISTS suggested_description text
    CONSTRAINT tcrd_suggested_description_len_chk
    CHECK (suggested_description IS NULL OR char_length(suggested_description) <= 600),
  ADD COLUMN IF NOT EXISTS suggested_search_words text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS suggested_inspirations jsonb NOT NULL DEFAULT '[]'::jsonb
    CONSTRAINT tcrd_suggested_inspirations_is_array_chk
    CHECK (jsonb_typeof(suggested_inspirations) = 'array');

-- A revoke is a point-in-time act; re-assert it for the table we just widened.
REVOKE ALL ON public.taxonomy_category_request_drafts FROM anon;
REVOKE ALL ON public.taxonomy_category_request_drafts FROM authenticated;
