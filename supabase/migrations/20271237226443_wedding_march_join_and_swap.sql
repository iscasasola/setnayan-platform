-- wedding_march_join_and_swap
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent (CREATE OR REPLACE + REVOKE/GRANT).
--
-- ⚖ OWNER 2026-09-21, on the Wedding March: "tapping [an empty place] should
-- allow us to pair them as well with someone. or the name can be dragged there
-- to pair." And: "dragging a name to another will swap the names."
--
-- Two moves, each ONE atomic write. Why not the existing pieces from TS:
--
--   JOIN is a pairing AND an order change — the joiner must take the anchor
--   line's `entourage_order`, or the new pair jumps to wherever the joiner used
--   to stand. Two round trips leave a window with a pair on the wrong line.
--
--   SWAP moves FOUR pointers (A, B and both partners) and two order values.
--   As two `pair_guests` calls, the first breaks the second pair before it
--   re-forms it, and a failure in between leaves two people walking alone that
--   nobody asked to separate.
--
-- Both are SECURITY INVOKER, exactly like `pair_guests`: the caller's own RLS
-- decides which guests they may touch. These add atomicity and the same-event
-- check — never reach. WHICH moves are allowed (column rules, same group) is
-- decided in `apps/web/lib/march-moves.ts` against a fresh read, before either
-- is called; the database enforces what a pair IS, the app decides where one
-- may stand.

-- ── join_entourage_line · the joiner takes the empty place beside the anchor ─
CREATE OR REPLACE FUNCTION public.join_entourage_line(
  p_event_id UUID,
  p_anchor   UUID,
  p_joiner   UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order INT;
BEGIN
  IF p_anchor = p_joiner THEN
    RAISE EXCEPTION 'A guest cannot walk with themselves';
  END IF;

  SELECT entourage_order INTO v_order
  FROM public.guests
  WHERE event_id = p_event_id AND guest_id = p_anchor
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Both guests must belong to this event';
  END IF;

  -- The pairing itself: one definition, not a second copy of its rules.
  PERFORM public.pair_guests(p_event_id, p_anchor, p_joiner);

  -- The joiner now stands on the anchor's line. NULL stays NULL: an unplaced
  -- line is ordered by surname, and inventing a number here would pin it.
  UPDATE public.guests
     SET entourage_order = v_order, updated_at = now()
   WHERE event_id = p_event_id AND guest_id = p_joiner;
END $$;

-- ── swap_entourage_places · A and B trade partners AND spots ──────────────
CREATE OR REPLACE FUNCTION public.swap_entourage_places(
  p_event_id UUID,
  p_a        UUID,
  p_b        UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_pa UUID;  v_oa INT;
  v_pb UUID;  v_ob INT;
  v_found INT;
BEGIN
  IF p_a = p_b THEN
    RAISE EXCEPTION 'Pick a different guest to swap with';
  END IF;

  SELECT count(*) INTO v_found
  FROM public.guests
  WHERE event_id = p_event_id AND guest_id IN (p_a, p_b);
  IF v_found <> 2 THEN
    RAISE EXCEPTION 'Both guests must belong to this event';
  END IF;

  SELECT pair_with_guest_id, entourage_order INTO v_pa, v_oa
  FROM public.guests WHERE event_id = p_event_id AND guest_id = p_a FOR UPDATE;
  SELECT pair_with_guest_id, entourage_order INTO v_pb, v_ob
  FROM public.guests WHERE event_id = p_event_id AND guest_id = p_b FOR UPDATE;

  IF v_pa = p_b OR v_pb = p_a THEN
    RAISE EXCEPTION 'These two already walk together';
  END IF;

  -- A dangling pointer (A→X but X→somebody else) is not a partner, and must
  -- not be handed to anyone. Only a MUTUAL partner travels.
  IF v_pa IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guests
    WHERE event_id = p_event_id AND guest_id = v_pa AND pair_with_guest_id = p_a
  ) THEN
    v_pa := NULL;
  END IF;
  IF v_pb IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.guests
    WHERE event_id = p_event_id AND guest_id = v_pb AND pair_with_guest_id = p_b
  ) THEN
    v_pb := NULL;
  END IF;

  -- 🔑 CLEAR FIRST. `guests_pair_partner_unique` is not deferrable, so it is
  -- checked row by row: re-pointing A at B's partner while B still points
  -- there trips it mid-statement. With all four cleared, every target in the
  -- write below is distinct.
  UPDATE public.guests
     SET pair_with_guest_id = NULL, updated_at = now()
   WHERE event_id = p_event_id
     AND guest_id IN (p_a, p_b, v_pa, v_pb);

  -- ONE statement re-forms both pairs and moves the two names' spots. The
  -- partners keep their own `entourage_order` — their line did not move; the
  -- person beside them changed.
  UPDATE public.guests
     SET pair_with_guest_id = CASE guest_id
           WHEN p_a THEN v_pb
           WHEN p_b THEN v_pa
           WHEN v_pa THEN p_b
           WHEN v_pb THEN p_a
         END,
         entourage_order = CASE guest_id
           WHEN p_a THEN v_ob
           WHEN p_b THEN v_oa
           ELSE entourage_order
         END,
         updated_at = now()
   WHERE event_id = p_event_id
     AND guest_id IN (p_a, p_b, v_pa, v_pb);
END $$;

-- 🔒 REVOKE FROM PUBLIC FIRST — Postgres grants EXECUTE on a new function to
-- PUBLIC, so a GRANT to authenticated alone would leave anon able to call it.
REVOKE EXECUTE ON FUNCTION public.join_entourage_line(UUID, UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.swap_entourage_places(UUID, UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.join_entourage_line(UUID, UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.swap_entourage_places(UUID, UUID, UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.join_entourage_line(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.swap_entourage_places(UUID, UUID, UUID) TO authenticated;
