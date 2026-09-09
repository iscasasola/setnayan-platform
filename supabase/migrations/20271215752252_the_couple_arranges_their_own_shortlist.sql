-- ============================================================================
-- 20271215752252_the_couple_arranges_their_own_shortlist.sql
--
-- THE COUPLE'S OWN ORDER ON THE BENCH — one arrangement per category, shared by
-- every host of the celebration.
--
-- Owner 2026-09-09: *"top tier can be long pressed and dragged to be
-- rearranged"* → *"okay then. let both rearrange."* → and, on scope,
-- ***"per category."*** Storage was ruled too: *"all hosts of that event see the
-- same order."*
--
-- ── WHY THIS IS NOT `event_category_build_state` ────────────────────────────
-- That table is ALSO per-(event, category) and ALSO has a column called
-- `pinned_vendor_id`, and reusing it would be wrong. There, "pinned" means the
-- 3-State Build solver's LOCKED PICK — which supplier the build uses. Here it
-- means where the couple dragged a card on the shortlist rail. One column with
-- two meanings is the "second, competing source of truth for one fact" this
-- repo's own RULE 0 warns about; it also holds a SINGLE pin where an
-- arrangement needs an ordered set, and it is dark behind BUILD_3STATE_ENABLED.
--
-- ── WHY A ROW PER PIN, NOT A JSON BLOB ──────────────────────────────────────
-- Removing a supplier from the shortlist is a REAL DELETE on `event_vendors`
-- (`vendors/actions.ts` releases the schedule pools, then `.delete()`), so
-- `ON DELETE CASCADE` takes the pin with it. A blob would keep a dangling id
-- holding a slot open for a supplier who is gone, and nothing would ever clean
-- it up.
--
-- 🔑 AND ONE FK REACHES THE WHOLE RAIL. A manually-added supplier is not a
-- second kind of card: `20260604080000_event_manual_vendors_table.sql` states
-- that "each category gets its own `event_vendors` row", with
-- `event_vendors.manual_vendor_id` hanging the detail off it. So every card the
-- couple can drag is an `event_vendors` row and can be pinned.
--
-- ── PER CATEGORY, WHICH ALSO SCOPES THE RESET ───────────────────────────────
-- `tile` is the bench's own category key (`lib/bench-category-search.ts`), NOT
-- `plan_group_id` — a plan group can hold several tiles, and the rail the couple
-- arranges is one tile. One Reset deletes one (event_id, tile): a couple who
-- arranged their caterers three weeks ago must not lose it by tidying florists
-- today.
--
-- ADDITIVE: no existing table, column, policy or grant is altered. Nothing reads
-- this table until the bench does.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.event_bench_arrangement (
  event_id   UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The bench tile (category) whose rail this arrangement belongs to.
  tile       TEXT NOT NULL CHECK (length(tile) BETWEEN 1 AND 120),
  -- The card the couple moved. CASCADE, so removing the supplier removes the
  -- pin — see the header.
  vendor_id  UUID NOT NULL REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  -- 0-based slot in that rail. Not UNIQUE per (event, tile) on purpose: a
  -- clamp or a stale write can legitimately produce two pins wanting one slot,
  -- and the reader (`lib/bench-arrangement.ts`) resolves that deterministically
  -- rather than the write failing and costing the couple their whole drag.
  position   INT  NOT NULL CHECK (position >= 0 AND position <= 500),
  set_by     UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (event_id, tile, vendor_id)
);

-- The read is always "this event's arrangement for this tile".
CREATE INDEX IF NOT EXISTS event_bench_arrangement_event_tile_idx
  ON public.event_bench_arrangement(event_id, tile);

COMMENT ON TABLE public.event_bench_arrangement IS
  'The couple''s hand-made order for ONE bench category''s rail (owner 2026-09-09 "per category"). One row per card they dragged; everything unpinned is ordered by the chosen lens (lib/bench-arrangement.ts). Stored on the celebration, not per browser, so every host sees the same order. NOT event_category_build_state.pinned_vendor_id — that is the Build solver''s Locked pick, a different fact.';
COMMENT ON COLUMN public.event_bench_arrangement.position IS
  '0-based slot on the rail. Deliberately not unique per (event_id, tile): the reader resolves a collision by taking the next free slot, which is cheaper than failing a write and losing the couple''s drag.';

ALTER TABLE public.event_bench_arrangement ENABLE ROW LEVEL SECURITY;

-- 🔴 REVOKE BEFORE YOU GRANT. Every new relation in `public` ships OPEN — this
-- project carries `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON
-- TABLES TO anon, authenticated`, which is named in
-- `20271014090000_guest_song_requests.sql` as "the root cause of the 368-table
-- exposure". Creating the table and granting only to `authenticated` does NOT
-- withhold anything from `anon`; it silently leaves anon holding
-- INSERT/SELECT/UPDATE/DELETE. Measured on this very migration:
-- `exposure-freeze.db.test.ts` reported all seven columns as "anon column
-- privileges gained INSERT, SELECT, UPDATE" before this line existed.
--
-- RLS would still have refused an anonymous caller (`current_couple_event_ids()`
-- is empty without `auth.uid()`, and the INSERT check demands
-- `set_by = auth.uid()`), so this is defence in depth rather than a live hole —
-- which is exactly why it has to be written down: a hole that RLS happens to
-- cover today is one policy edit away from being a real one.
REVOKE ALL ON TABLE public.event_bench_arrangement FROM PUBLIC, anon, authenticated;

-- ── RLS · couple-own, via the shipped helper ────────────────────────────────
-- `current_couple_event_ids()` is the canonical membership predicate (SECURITY
-- DEFINER, STABLE) and is what every couple-own policy on this surface already
-- uses. Every HOST of the event is a 'couple' member, which is exactly the
-- owner's "all hosts of that event see the same order".

DROP POLICY IF EXISTS couple_reads_bench_arrangement ON public.event_bench_arrangement;
CREATE POLICY couple_reads_bench_arrangement ON public.event_bench_arrangement
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

DROP POLICY IF EXISTS couple_inserts_bench_arrangement ON public.event_bench_arrangement;
CREATE POLICY couple_inserts_bench_arrangement ON public.event_bench_arrangement
  FOR INSERT TO authenticated
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    AND set_by = auth.uid()
  );

DROP POLICY IF EXISTS couple_updates_bench_arrangement ON public.event_bench_arrangement;
CREATE POLICY couple_updates_bench_arrangement ON public.event_bench_arrangement
  FOR UPDATE TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()))
  WITH CHECK (
    event_id IN (SELECT public.current_couple_event_ids())
    AND set_by = auth.uid()
  );

-- Reset is a DELETE of one (event_id, tile), so the couple needs it.
DROP POLICY IF EXISTS couple_deletes_bench_arrangement ON public.event_bench_arrangement;
CREATE POLICY couple_deletes_bench_arrangement ON public.event_bench_arrangement
  FOR DELETE TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()));

-- ── Grants ──────────────────────────────────────────────────────────────────
-- Handed back to `authenticated` only, after the REVOKE above. All four verbs
-- are genuinely needed: the couple INSERTs a pin on the first drag, UPDATEs it
-- on the next one (the write is an upsert on the (event, tile, vendor) key),
-- and DELETEs on Reset. `anon` gets nothing at all — an arrangement is only ever
-- touched by a signed-in host of that celebration.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_bench_arrangement TO authenticated;
