-- the wish list two tables
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (IF NOT EXISTS · CREATE OR REPLACE · DROP IF
-- EXISTS), safe to re-run.
--
-- ⚖ OWNER 2026-10-08 (DECISION_LOG "E-GIFTS WISH LIST", design
-- `EGIFTS_WISH_LIST_2026-10-08_fable.md` § 3 — approved: "ok wish list"):
--   the ask      — "E-Gfits can also have a list of their wants like things they
--                   want to buy. They can add the list here as well on e-gifts.
--                   Send money to purchase this."
--   the measure  — "when people send gcash, they also give screenshot of their
--                   payment and the vallue and their message for the couple.
--                   this will be the way to measure."
--   splitting    — "yes. it will accumulate all the gift and mark them one by one"
--   got          — "when amount is reached."
--   price        — "free."
--   and          — "1. per item 2. live"
--
-- ── THE INVARIANT (inherited from event_egift_methods, 20270725802892) ─────
-- Setnayan NEVER holds, sees or moves the money. A guest sends through the
-- couple's OWN GCash / Maya / bank, then tells the couple what they sent. So:
--   · `event_wish_items`   is what the couple would love (a name, an optional
--                          price, a photo, a link, a note);
--   · `event_gift_records` is what a guest SAYS they sent — a claim, never
--                          verified money. No screen built on it may say
--                          "received", "paid", "verified" or "funded"; the word
--                          is "sent". There is no order row, no ledger and no
--                          settlement state here, and nothing in these two
--                          tables moves value.
--
-- ── WHO READS WHAT ─────────────────────────────────────────────────────────
-- Both tables: the HOSTS only, through the exact predicate of
-- `event_egift_methods_host_all` (accepted, not-removed moderators · the legacy
-- `event_members` couple · admin). NO anon policy and NO anon grant.
--   · A guest reads the wishes and each wish's sum through the service-role
--     client behind the published gate — exactly as `/[slug]/pabuya` reads the
--     ways to give.
--   · A guest's record is INSERTED by a server action that first passes the
--     shipped recognition rule (`viewerIsRecognisedForEvent`) and then writes
--     with the admin client — the RSVP's shape. So `authenticated` holds NO
--     INSERT and NO DELETE on `event_gift_records`: a host corrects an amount,
--     moves a gift to another wish or soft-removes it (UPDATE), and never
--     invents or erases one. A guest's name, amount, words and screenshot are
--     the couple's alone.
--
-- ── GOT IT IS SET BY THE ACTION, NOT BY A TRIGGER ──────────────────────────
-- `got_at` / `got_by` are written by the record-writing action (the sum of a
-- wish's not-removed records reaches `price_php` → 'auto'), cleared by the
-- correcting / removing action when the sum falls back below (only when
-- `got_by = 'auto'`), and written 'host' / NULL by the couple's own switch. A
-- wish with no price never marks itself. Two plain tables on purpose.
--
-- ── PUBLIC IDS ─────────────────────────────────────────────────────────────
-- Every single type letter A–Z is already used by some table (measured
-- 2026-10-08: 26 of 26; 'Y' alone by four tables, 'C' by six), so no letter is
-- free and the letter is a reading aid, never a key — uniqueness is per table.
--   · wishes  → 'H' (as designed; shared only with chat_threads);
--   · records → 'Y' — the E-Gifts family letter (`event_egift_methods`). The
--     design proposed 'G', which is `guests`: a gift record sits beside its
--     giver's guest id, and two different S89G- ids on one row would mislead.

-- ── 1 · event_wish_items — what the couple would love ─────────────────────
CREATE TABLE IF NOT EXISTS public.event_wish_items (
  wish_item_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id           TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('H'),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,

  name                TEXT NOT NULL
                        CONSTRAINT event_wish_items_name_check
                        CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  -- Whole pesos. NULL = "any amount": guests send what they like and the wish
  -- never marks itself got.
  price_php           INTEGER
                        CONSTRAINT event_wish_items_price_check
                        CHECK (price_php IS NULL OR price_php > 0),
  -- The tagged `r2://bucket/key` ref (lib/uploads.ts), like qr_r2_key.
  photo_r2_key        TEXT,
  -- The shop page. The registry link's own rule (events_gift_registry_url_check).
  link_url            TEXT
                        CONSTRAINT event_wish_items_link_check
                        CHECK (
                          link_url IS NULL
                          OR (link_url ~ '^https?://[^[:space:]]+$' AND char_length(link_url) <= 500)
                        ),
  note                TEXT
                        CONSTRAINT event_wish_items_note_check
                        CHECK (note IS NULL OR char_length(note) <= 120),
  sort_order          INTEGER NOT NULL DEFAULT 0,

  -- NULL = open. Written by the actions, never by a trigger (see the header).
  got_at              TIMESTAMPTZ,
  got_by              TEXT
                        CONSTRAINT event_wish_items_got_by_check
                        CHECK (got_by IS NULL OR got_by IN ('auto', 'host')),
  -- Got is ONE fact told by two columns: both set, or neither.
  CONSTRAINT event_wish_items_got_pair_check
    CHECK ((got_at IS NULL) = (got_by IS NULL)),

  -- An authorship stamp: the wish belongs to the event and outlives its author.
  created_by_user_id  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Both hot reads — the Studio list and the guest page — take one event's wishes
-- in the couple's order.
CREATE INDEX IF NOT EXISTS event_wish_items_event_idx
  ON public.event_wish_items (event_id, sort_order);

-- RLS AT CREATE TABLE.
ALTER TABLE public.event_wish_items ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_wish_items IS
  'E-Gifts › Wish list (owner 2026-10-08): what the couple would love — a name, an optional price '
  '(NULL = any amount; never marks itself got), a photo, a link, a note. Saved LIVE like the ways to '
  'give. got_at/got_by are written by the actions (auto when the gifts sent reach the price, host by '
  'the couple''s switch), never by a trigger. Hosts only; guests read through the service role behind '
  'the published gate. Setnayan never holds the money.';

-- ── 2 · event_gift_records — what a guest SAYS they sent ──────────────────
CREATE TABLE IF NOT EXISTS public.event_gift_records (
  gift_record_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  public_id           TEXT NOT NULL UNIQUE DEFAULT public.generate_public_id('Y'),
  event_id            UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- NULL = a gift toward no wish ("Any gift"). A removed wish keeps its gifts:
  -- they fall back to "Any gift" rather than vanishing from the couple's list.
  wish_item_id        UUID REFERENCES public.event_wish_items(wish_item_id) ON DELETE SET NULL,

  -- Whole pesos the guest said they sent. The couple may correct it.
  amount_php          INTEGER NOT NULL
                        CONSTRAINT event_gift_records_amount_check
                        CHECK (amount_php > 0),
  -- Asked for first, never enforced (a bank app may give none).
  screenshot_r2_key   TEXT,
  message             TEXT
                        CONSTRAINT event_gift_records_message_check
                        CHECK (message IS NULL OR char_length(message) <= 240),
  giver_name          TEXT NOT NULL
                        CONSTRAINT event_gift_records_giver_name_check
                        CHECK (char_length(btrim(giver_name)) BETWEEN 1 AND 80),
  -- The recognised guest, when there is one. The record outlives the guest row.
  giver_guest_id      UUID REFERENCES public.guests(guest_id) ON DELETE SET NULL,
  -- The way they said they used (an event_egift_methods.method_kind at the time).
  method_kind         TEXT
                        CONSTRAINT event_gift_records_method_kind_check
                        CHECK (method_kind IS NULL OR char_length(method_kind) <= 20),

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- The couple's Remove is SOFT, so a disputed record can be put back. A removed
  -- record never counts toward a wish.
  removed_at          TIMESTAMPTZ
);

-- "Gifts sent to you": every record of one event, newest first.
CREATE INDEX IF NOT EXISTS event_gift_records_event_created_idx
  ON public.event_gift_records (event_id, created_at DESC);
-- A wish's own gifts, and its sum.
CREATE INDEX IF NOT EXISTS event_gift_records_wish_idx
  ON public.event_gift_records (wish_item_id);

-- RLS AT CREATE TABLE.
ALTER TABLE public.event_gift_records ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE public.event_gift_records IS
  'E-Gifts › a gift a guest SAYS they sent (owner 2026-10-08: the screenshot, the value and their '
  'message "will be the way to measure"). A CLAIM, never verified money — no surface may say '
  'received / paid / verified / funded. Inserted only by the server (recognised guest → admin client); '
  'the hosts read, correct the amount, move it to another wish or soft-remove it (removed_at). A '
  'removed record never counts. No order, no ledger, no settlement — Setnayan never holds the money.';

-- ── 3 · grants — explicit, and narrower than the stock GRANT ALL ──────────
-- A new table inherits Supabase's stock grants to anon AND authenticated. Both
-- tables hold what only the hosts may see, and nothing reads them as anon (the
-- guest pages use the service role), so anon gets nothing at all.
REVOKE ALL ON public.event_wish_items FROM PUBLIC;
REVOKE ALL ON public.event_wish_items FROM anon;
REVOKE ALL ON public.event_wish_items FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_wish_items TO authenticated;
GRANT ALL ON public.event_wish_items TO service_role;

REVOKE ALL ON public.event_gift_records FROM PUBLIC;
REVOKE ALL ON public.event_gift_records FROM anon;
REVOKE ALL ON public.event_gift_records FROM authenticated;
-- No INSERT (the server writes a guest's record) and no DELETE (Remove is soft).
GRANT SELECT, UPDATE ON public.event_gift_records TO authenticated;
GRANT ALL ON public.event_gift_records TO service_role;

-- ── 4 · RLS — the hosts, exactly as event_egift_methods_host_all ──────────
DROP POLICY IF EXISTS event_wish_items_host_all ON public.event_wish_items;
CREATE POLICY event_wish_items_host_all ON public.event_wish_items
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND removed_at IS NULL
    )
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND removed_at IS NULL
    )
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

DROP POLICY IF EXISTS event_gift_records_host_all ON public.event_gift_records;
CREATE POLICY event_gift_records_host_all ON public.event_gift_records
  FOR ALL TO authenticated
  USING (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND removed_at IS NULL
    )
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  )
  WITH CHECK (
    event_id IN (
      SELECT event_id FROM public.event_moderators
      WHERE user_id = auth.uid()
        AND accepted_at IS NOT NULL
        AND removed_at IS NULL
    )
    OR event_id IN (
      SELECT event_id FROM public.event_members
      WHERE user_id = auth.uid() AND member_type = 'couple'
    )
    OR public.is_admin()
  );

-- ── 5 · updated_at on a wish ──────────────────────────────────────────────
-- (A gift record has no updated_at: it is a guest's statement, and the couple's
-- corrections are the three columns above.)
CREATE OR REPLACE FUNCTION public.tg_event_wish_items_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS event_wish_items_set_updated_at ON public.event_wish_items;
CREATE TRIGGER event_wish_items_set_updated_at
  BEFORE UPDATE ON public.event_wish_items
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_event_wish_items_set_updated_at();

REVOKE ALL ON FUNCTION public.tg_event_wish_items_set_updated_at() FROM PUBLIC, anon, authenticated;

-- ── 6 · the posture, asserted where it is made ────────────────────────────
DO $$
DECLARE
  t TEXT;
  p TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['public.event_wish_items', 'public.event_gift_records'] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = t::regclass) THEN
      RAISE EXCEPTION '% has row level security switched off', t;
    END IF;
    FOREACH p IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
      IF has_table_privilege('anon', t, p) THEN
        RAISE EXCEPTION 'anon holds % on % — a guest''s gift and the couple''s list are the hosts'' alone', p, t;
      END IF;
    END LOOP;
    IF NOT has_table_privilege('authenticated', t, 'SELECT') THEN
      RAISE EXCEPTION 'authenticated cannot read % — the Studio''s wish list would be refused', t;
    END IF;
  END LOOP;

  IF has_table_privilege('authenticated', 'public.event_gift_records', 'INSERT')
     OR has_table_privilege('authenticated', 'public.event_gift_records', 'DELETE') THEN
    RAISE EXCEPTION 'authenticated may insert or delete a gift record — only the server writes one, and Remove is soft';
  END IF;
END $$;
