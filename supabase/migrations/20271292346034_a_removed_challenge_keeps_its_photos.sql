-- A REMOVED CHALLENGE KEEPS ITS PHOTOS.
--
-- Prefix allocated by `pnpm migration:new`. Idempotent throughout.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- THE OWNER'S ASK, 2026-10-26 (DECISION_LOG "PAPIC CHALLENGES: A LIVE SWITCH AND AN ✕")
-- ═══════════════════════════════════════════════════════════════════════════
-- Verbatim: *"challenges will have a toggle to make that challenge live and
-- happening on the app. but it also needs a (X) to remove that challenge. if the
-- challenge is removed and someone did the challenge, the photo and challenge is
-- saved but anything after, you do not have the challenge"*.
--
-- Until now the ✕ (`deleteCoupleChallengeAction`) was a hard DELETE, and
-- `papic_mission_completions.mission_id` is `ON DELETE CASCADE` — so removing a
-- challenge a guest had already answered threw away the link between the photo
-- and the question it answered. The photo survived (the capture is its own row);
-- its challenge tag did not.
--
-- ═══════════════════════════════════════════════════════════════════════════
-- WHY A TIMESTAMP BESIDE `is_active`, AND NOT A NEW STATE MACHINE (RULE 0.3)
-- ═══════════════════════════════════════════════════════════════════════════
-- `is_active = false` ALREADY means "no guest may see or answer this": the
-- guest board (`papic_guest_missions`), the completion (`papic_complete_mission`)
-- and arming (`papic_arm_challenge`) all filter `m.is_active`, and the Setnayan
-- fill treats an inactive row as a veto tombstone (`ensure_papic_board`). So a
-- removal is `is_active = false` PLUS `removed_at` — no SQL function changes,
-- because every guest path is already closed by the flag it reads.
--
-- `removed_at` answers the one question `is_active` cannot: the host's own list.
-- The switch (`is_active`) is PAUSED-AND-STILL-LISTED; `removed_at` is GONE from
-- the host's list too, for good. The row stays, so every completion keeps its
-- mission and Memories keeps the challenge's name on the photos already taken.
--
-- 🔒 THE CHECK BELOW IS THE BACKSTOP: a removed challenge can never be live
-- again. The switch's action also scopes to `removed_at IS NULL`; this makes a
-- stale tab, a hand-built POST or a future writer that forgets it fail loudly
-- rather than quietly putting a removed challenge back on every guest's board.
--
-- RLS: unchanged. `papic_missions_member_all` (couple / coordinator / admin)
-- already governs who may UPDATE this table; a new column inherits it, and the
-- table's grants are table-level (anon was revoked in 20271030569442).

BEGIN;

ALTER TABLE public.papic_missions
  ADD COLUMN IF NOT EXISTS removed_at TIMESTAMPTZ;

COMMENT ON COLUMN public.papic_missions.removed_at IS
  'When the host removed this challenge (the ✕, owner 2026-10-26). NULL = listed. A removed challenge is also is_active = false (CHECK papic_missions_removed_is_off), so no guest path offers it; the row is kept so completions and Memories keep the challenge on photos already taken.';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'papic_missions_removed_is_off'
      AND conrelid = 'public.papic_missions'::regclass
  ) THEN
    ALTER TABLE public.papic_missions
      ADD CONSTRAINT papic_missions_removed_is_off
      CHECK (removed_at IS NULL OR is_active = false);
  END IF;
END $$;

COMMIT;
