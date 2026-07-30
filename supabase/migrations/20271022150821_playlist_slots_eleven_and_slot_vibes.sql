-- ============================================================================
-- ELEVEN MOMENTS, AND A VIBE PER MOMENT.  (Song Desk PRs 6 + 4, landed together)
--
-- Owner-answered 2026-07-30:
--   PR 6 — "add all three": prelude (guest arrival) · grand_entrance (the couple
--          into the reception) · recessional (the walk out). 11 slots total.
--   PR 4 — the six vibe names are FROZEN as the artwork already reads them:
--          acoustic · classical · jazz · opm · pop · showband.
--
-- They land in ONE migration because they share `lib/playlist.ts` and because a
-- vibe is meaningless without the slot list it hangs off.
--
-- ── ⚠ THE POSTGRES TRAP THIS MIGRATION HAS TO RESPECT ──────────────────────
--
-- `ALTER TYPE … ADD VALUE` may run inside a transaction on PG12+ (this is PG17),
-- but the new label CANNOT BE USED in that same transaction — no cast, no
-- comparison, no insert. So the post-conditions below check `pg_enum` by STRING
-- rather than casting 'prelude'::playlist_slot_type, which would fail with
-- "unsafe use of new value of enum type" even though the value exists.
--
-- ── WHY BEFORE/AFTER RATHER THAN APPENDING ─────────────────────────────────
--
-- Enum declaration order is what `ORDER BY slot_type` sorts by, and
-- `fetchPlaylistPicks` orders by that column. Both consumers regroup through
-- `groupPicksBySlot` (which walks the TypeScript array), so appending would not
-- have broken render order — but anyone reading the table in psql would get the
-- night out of sequence, and that is a needless trap to leave behind. Placed
-- chronologically instead:
--
--   prelude · processional · ceremony · recessional · grand_entrance ·
--   cocktail_hour · first_dance · parents_dance · dinner · open_floor ·
--   banned_songs        (the anti-pick list stays last, as it always was)
--
-- ── ⚠⚠ THE READER THAT THROWS — the reason PR 6 was flagged as risky ───────
--
-- `groupPicksBySlot` (lib/playlist.ts) builds a HARDCODED Record literal of every
-- slot and then does `out[row.slot_type].push(row)`. A row whose slot is absent
-- from that Record dereferences `undefined` → **TypeError**, not a missing
-- section. So adding these three values to the enum WITHOUT adding them to that
-- Record would crash the couple's playlist studio the first time anyone picked a
-- song for the grand entrance. The union is extended in the same commit, which
-- makes `tsc` walk every `Record<PlaylistSlotType, …>` site — that compile error
-- is the good case, and it is why the TS change ships with this SQL rather than
-- after it. (`buildHostPlaylist` defends itself via `isPick`; the studio did not.)
--
-- ── THE VIBE IS A SEPARATE, SPARSE TABLE — not a column, not a rival ───────
--
-- Owner's model: "a slot must be able to carry BOTH" — jazz for dinner, but you
-- must play Through the Years. So a vibe is not an alternative to picks and must
-- not live on a pick row (there may be no picks at all, and a vibe is one value
-- per moment rather than per song). One row per (event × slot), absent row = no
-- vibe stated. Sparse like `vendor_dayof_configs`: a couple who never sets one
-- costs zero rows.
--
-- ── WHY TEXT + CHECK, DEVIATING FROM THE SLOT ENUM NEXT DOOR ───────────────
--
-- The slot list is an enum; the vibe list is TEXT with a CHECK. Deliberate: the
-- owner froze SIX names and declined both a seventh ("Band's call" — absence
-- already means that, so it does not earn a value) and a rename ("Showband"
-- stays). The residual risk is therefore a RENAME, and renaming an enum label
-- means rewriting every dependent view/policy while a CHECK is one DROP/ADD
-- CONSTRAINT. Same guarantee at the boundary, cheaper to correct.
--
-- Vendor-side read audience deliberately matches `event_playlist_picks` exactly
-- (the shared booked helper + day-of grantees): a band reading "jazz for dinner"
-- next to the songs is the whole point, and two different audiences for two
-- halves of one screen is how the mismatches this stream spent all day fixing
-- got created in the first place.
-- ============================================================================

BEGIN;

-- ── PR 6 · the three missing moments ───────────────────────────────────────
ALTER TYPE public.playlist_slot_type ADD VALUE IF NOT EXISTS 'prelude' BEFORE 'processional';
ALTER TYPE public.playlist_slot_type ADD VALUE IF NOT EXISTS 'recessional' AFTER 'ceremony';
ALTER TYPE public.playlist_slot_type ADD VALUE IF NOT EXISTS 'grand_entrance' AFTER 'recessional';

-- ── PR 4 · the vibe per moment ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.event_playlist_slot_vibes (
  vibe_id     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- TEXT, not the enum: this migration cannot reference the three labels it just
  -- added (see the header), and a slot the couple can set a vibe for must include
  -- them from day one. The FK-less pairing is guarded by the app + the CHECK
  -- below; a stale slot string simply never renders.
  slot_type   TEXT NOT NULL CHECK (char_length(slot_type) BETWEEN 3 AND 32),
  vibe        TEXT NOT NULL CHECK (vibe IN ('acoustic','classical','jazz','opm','pop','showband')),
  set_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- One vibe per moment. The couple changes it by UPSERT, never by accumulating
  -- rows — a second "dinner" vibe would make the surface pick one arbitrarily.
  CONSTRAINT event_playlist_slot_vibes_one_per_slot UNIQUE (event_id, slot_type)
);

CREATE INDEX IF NOT EXISTS event_playlist_slot_vibes_event_idx
  ON public.event_playlist_slot_vibes (event_id);

-- RLS AT CREATE TIME, and the REVOKE that every relation in `public` needs —
-- ALTER DEFAULT PRIVILEGES grants arwdDxtm to anon AND authenticated, which is
-- the root cause of the 368-table exposure. Revoke first, grant back narrowly.
ALTER TABLE public.event_playlist_slot_vibes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.event_playlist_slot_vibes FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.event_playlist_slot_vibes TO authenticated;

-- The couple owns their own night: read + write, FOR ALL (setting a vibe and
-- clearing it are the same gesture).
DROP POLICY IF EXISTS event_playlist_slot_vibes_couple_write ON public.event_playlist_slot_vibes;
CREATE POLICY event_playlist_slot_vibes_couple_write
  ON public.event_playlist_slot_vibes FOR ALL
  TO authenticated
  USING (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin())
  WITH CHECK (event_id IN (SELECT public.current_couple_event_ids()) OR public.is_admin());

-- The act reads it, on EXACTLY the audience `event_playlist_picks` uses — the
-- shared booked definition plus day-of grantees. Two audiences for two halves of
-- one screen is precisely the class of bug this stream spent 2026-07-30 closing.
DROP POLICY IF EXISTS event_playlist_slot_vibes_vendor_read ON public.event_playlist_slot_vibes;
CREATE POLICY event_playlist_slot_vibes_vendor_read
  ON public.event_playlist_slot_vibes FOR SELECT
  TO authenticated
  USING (
    event_id IN (SELECT public.current_vendor_booked_event_ids())
    OR event_id IN (SELECT public.current_vendor_dayof_grant_event_ids())
  );

COMMENT ON TABLE public.event_playlist_slot_vibes IS
  'One music vibe per (event × playlist moment) — owner-locked 2026-07-30, six '
  'frozen names (acoustic/classical/jazz/opm/pop/showband) matching the artwork at '
  'public/onboarding/prefs/music_*.webp. ALONGSIDE the picks in '
  'event_playlist_picks, never instead of them: a slot can carry both ("jazz for '
  'dinner, but you must play Through the Years"). SPARSE — an absent row means the '
  'couple stated no vibe, which is also what "let the band decide" means, so no '
  'seventh enum value was spent on it. Vendor read audience is kept identical to '
  'event_playlist_picks on purpose.';

CREATE OR REPLACE FUNCTION public.tg_event_playlist_slot_vibes_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS event_playlist_slot_vibes_set_updated_at ON public.event_playlist_slot_vibes;
CREATE TRIGGER event_playlist_slot_vibes_set_updated_at
  BEFORE UPDATE ON public.event_playlist_slot_vibes
  FOR EACH ROW EXECUTE FUNCTION public.tg_event_playlist_slot_vibes_set_updated_at();

-- ── Post-conditions ────────────────────────────────────────────────────────
-- ⚠ Checked by STRING against pg_enum, never by casting the new labels — see the
-- header. A cast here would fail the migration for a value that exists.
DO $$
DECLARE
  v_missing TEXT;
  v_order   TEXT;
BEGIN
  SELECT string_agg(want, ', ') INTO v_missing
  FROM unnest(ARRAY['prelude','recessional','grand_entrance']) AS want
  WHERE NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'playlist_slot_type' AND e.enumlabel = want
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'playlist_slot_type is missing: %', v_missing;
  END IF;

  -- The night must read chronologically for anyone querying the raw table.
  SELECT string_agg(e.enumlabel, ',' ORDER BY e.enumsortorder) INTO v_order
  FROM pg_enum e JOIN pg_type t ON t.oid = e.enumtypid
  WHERE t.typname = 'playlist_slot_type';
  IF v_order <> 'prelude,processional,ceremony,recessional,grand_entrance,'
              || 'cocktail_hour,first_dance,parents_dance,dinner,open_floor,banned_songs' THEN
    RAISE EXCEPTION 'playlist_slot_type is out of chronological order: %', v_order;
  END IF;

  IF has_table_privilege('anon', 'public.event_playlist_slot_vibes', 'SELECT') THEN
    RAISE EXCEPTION 'anon can read the vibes table — the REVOKE did not take';
  END IF;
END $$;

COMMIT;
