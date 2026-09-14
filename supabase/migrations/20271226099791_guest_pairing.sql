-- guest_pairing
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. Idempotent.
--
-- WHY. `guests.pair_with_guest_id` has existed since the FIRST guests migration
-- (20260513010000, 2026-05-13) as a bare self-FK — no index, no constraints, and
-- (verified 2026-09-14) NO CODE ANYWHERE THAT READS OR WRITES IT. A designed
-- slot that was never built. Filipino entourages pair groomsman↔bridesmaid and
-- ninong↔ninang, so this migration gives that column the invariants a pair
-- actually has, and two functions that maintain BOTH halves atomically.
--
-- ── WHAT A PAIR IS HERE ───────────────────────────────────────────────────
-- A pair is MUTUAL and EXCLUSIVE: A.pair_with_guest_id = B and
-- B.pair_with_guest_id = A, and neither may belong to a second pair. Mutuality
-- cannot be expressed as a row constraint (each row is checked alone), so it is
-- maintained by `pair_guests` / `unpair_guest` below, which write both rows in
-- ONE statement. What CAN be enforced per-row is enforced per-row:
--
--   • no self-pairing (a guest is not their own partner);
--   • at most one guest may point at any given partner — the partial UNIQUE.
--     Without it A→C and B→C both "succeed" and C silently has two partners.
--
-- ⚠ THE FK IS LEFT EXACTLY AS IT IS: single-column, ON DELETE SET NULL. A
-- composite (event_id, pair_with_guest_id) FK would enforce same-event pairing,
-- but its ON DELETE SET NULL would try to null event_id too — and event_id is
-- NOT NULL, so deleting a paired guest would be REFUSED instead of unpairing
-- their partner. That failure mode (a SET NULL that behaves like RESTRICT and
-- blocks the parent delete) has already cost this project real time. Same-event
-- pairing is enforced inside `pair_guests`, which is event-scoped.

-- ── Invariant 1 · a guest is never their own partner ──────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'guests_no_self_pair' AND conrelid = 'public.guests'::regclass
  ) THEN
    ALTER TABLE public.guests
      ADD CONSTRAINT guests_no_self_pair
      CHECK (pair_with_guest_id IS NULL OR pair_with_guest_id <> guest_id) NOT VALID;
    ALTER TABLE public.guests VALIDATE CONSTRAINT guests_no_self_pair;
  END IF;
END $$;

-- ── Invariant 2 · nobody is two people's partner ──────────────────────────
-- Partial: NULL means "unpaired", and any number of guests may be unpaired.
CREATE UNIQUE INDEX IF NOT EXISTS guests_pair_partner_unique
  ON public.guests (pair_with_guest_id)
  WHERE pair_with_guest_id IS NOT NULL;

-- ── pair_guests · make A and B partners, atomically ───────────────────────
-- SECURITY INVOKER (the default): the caller's RLS decides which guests they
-- may touch, exactly as a direct UPDATE would. This function adds atomicity and
-- the same-event check — never reach.
CREATE OR REPLACE FUNCTION public.pair_guests(
  p_event_id UUID,
  p_guest_a  UUID,
  p_guest_b  UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_found INT;
BEGIN
  IF p_guest_a = p_guest_b THEN
    RAISE EXCEPTION 'A guest cannot be paired with themselves';
  END IF;

  -- Both must be real guests OF THIS EVENT. Reading through RLS means a caller
  -- who cannot see a guest gets "not in this event", never someone else's row.
  SELECT count(*) INTO v_found
  FROM public.guests
  WHERE event_id = p_event_id AND guest_id IN (p_guest_a, p_guest_b);

  IF v_found <> 2 THEN
    RAISE EXCEPTION 'Both guests must belong to this event';
  END IF;

  -- Break whatever pairs these two are already in — including each other's, so
  -- re-pairing is idempotent rather than tripping the UNIQUE index. This must
  -- happen before the write, and in the same statement-visible step.
  UPDATE public.guests
     SET pair_with_guest_id = NULL, updated_at = now()
   WHERE event_id = p_event_id
     AND (guest_id IN (p_guest_a, p_guest_b)
          OR pair_with_guest_id IN (p_guest_a, p_guest_b));

  -- ONE statement writes BOTH halves: there is no instant at which the pair is
  -- half-formed, and if either row is refused the whole pairing rolls back.
  UPDATE public.guests
     SET pair_with_guest_id = CASE guest_id
           WHEN p_guest_a THEN p_guest_b
           ELSE p_guest_a
         END,
         updated_at = now()
   WHERE event_id = p_event_id
     AND guest_id IN (p_guest_a, p_guest_b);
END $$;

-- ── unpair_guest · clear BOTH halves ──────────────────────────────────────
-- Clearing only the row you were looking at is the obvious bug here: the
-- partner keeps pointing back and the list shows a pair that no longer exists.
CREATE OR REPLACE FUNCTION public.unpair_guest(
  p_event_id UUID,
  p_guest_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.guests
     SET pair_with_guest_id = NULL, updated_at = now()
   WHERE event_id = p_event_id
     AND (guest_id = p_guest_id OR pair_with_guest_id = p_guest_id);
END $$;

COMMENT ON COLUMN public.guests.pair_with_guest_id IS
  'The guest this one walks with — groomsman<->bridesmaid, ninong<->ninang. '
  'MUTUAL and EXCLUSIVE: maintained only via pair_guests() / unpair_guest(), '
  'which write both halves in one statement. NULL = unpaired.';

GRANT EXECUTE ON FUNCTION public.pair_guests(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unpair_guest(UUID, UUID) TO authenticated;
