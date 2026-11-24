-- supplier_offline_engine
-- ============================================================================
-- THE SUPPLIER DASHBOARD WORKS OFFLINE AND CATCHES UP WHEN BACK ONLINE
-- (owner, 24 Nov 2026 — DECISION_LOG "2026-11-24 · The supplier dashboard works
-- offline and catches up when back online"). Engine only; the screens wait for
-- the approved drawing.
--
-- ⚖ The ruling, as this file keeps it:
--   · FIRST SAVE WINS. A couple's lock or a teammate's earlier change is never
--     overwritten by a phone coming back online. A stale write returns a typed
--     clash ({why, by, at}), never a silent merge.
--   · VERSIONED ITEMS. Every schedule item carries a version. This is the
--     SHIPPED table (`vendor_calendar_blocks` — "not available" blocks and
--     outside clients) and the shipped day states, never a parallel one.
--   · EXPO MODE. While online a member claims a date range; until they sync or
--     release it, only the holder may write into it — offline AND online.
--   · OFFLINE CLIENT QR, NO STOCK (owner 24 Nov, DECISION_LOG 7d618cb3). Each
--     phone makes its own ECDSA P-256 key once, online; the private key never
--     leaves the phone and the server keeps only the public half
--     (`vendor_offline_devices`). Offline, every QR gets a new random code id
--     and is signed by the phone. The server checks the signature against that
--     phone's ACTIVE key (`lib/supplier-offline/qr.server.ts`, node:crypto) and
--     this file takes each code id once (`vendor_offline_code_uses`, UNIQUE):
--     ONE CODE, ONE ENTRY, whoever arrives first (the client scanning it, or the
--     supplier's phone syncing it). A stopped phone's codes are refused.
--   · MADE OFFLINE. The mark, the member and the phone's time are kept on the
--     client and schedule rows; the server orders by its own clock.
--
-- WHAT THIS FILE ADDS (nothing existing changes meaning):
--   1. `vendor_offline_devices` — each phone's public key (service role only),
--      its status (active · stopped) and when it was last seen online;
--      `vendor_offline_code_uses` — each code id, taken once.
--   2. `vendor_calendar_blocks` + version / created_by / updated_by /
--      made_offline / phone_time / offline_code_id / offline_item_id.
--      `vendor_calendar_day_states` + version / updated_by. ONE trigger bumps
--      the version on every update, from any writer.
--   3. `vendor_offline_holds` — expo-mode date claims; a trigger refuses an
--      online member's write into another member's held dates.
--   4. (R5, corrected) teammates see "last seen" from the device row — never a
--      count of changes still on another phone, which the server cannot see.
--   5. `vendor_offline_writes` — one row per queued item: the idempotency key
--      and the outcome a retry is answered with.
--   6. `vendor_client_invites` + made_offline / offline_code_id / phone_time.
--   7. Three doors, service role only, called by `lib/supplier-offline/`
--      after its own sign-in, member and role checks:
--        supplier_offline_schedule_write · supplier_offline_hold ·
--        supplier_offline_code_use
--
-- RLS at CREATE (the canonical helpers only: current_vendor_profile_ids,
-- is_admin). No session writes any of these tables — the server does.
-- KEEP IDEMPOTENT. 🛑 NEVER APPLIED BY HAND. The pipeline pushes this file.
-- ============================================================================

BEGIN;

-- ── 1 · each phone's key, and each code taken once ──────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_offline_devices (
  -- random, made on the phone with its key (a phone whose storage was wiped makes a new one)
  device_id         TEXT PRIMARY KEY
                      CONSTRAINT vendor_offline_devices_id_shape
                      CHECK (device_id ~ '^[A-Za-z0-9_-]{16,64}$'),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  member_user_id    UUID NOT NULL,
  -- the PUBLIC half only, as a JWK ({kty: EC, crv: P-256, x, y}). The server stores no secret.
  public_key        JSONB NOT NULL
                      CONSTRAINT vendor_offline_devices_key_shape
                      CHECK (public_key->>'kty' = 'EC' AND public_key->>'crv' = 'P-256'
                             AND (public_key->>'x') ~ '^[A-Za-z0-9_-]{43}$'
                             AND (public_key->>'y') ~ '^[A-Za-z0-9_-]{43}$'
                             AND NOT (public_key ? 'd')),
  status            TEXT NOT NULL DEFAULT 'active'
                      CONSTRAINT vendor_offline_devices_status_allowed
                      CHECK (status IN ('active', 'stopped')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- how many changes this phone said it still held when last seen — PRIVATE (service role only): never shown to a
  -- teammate (R5); only this phone compares it, to notice a queue the browser erased (iPhone's 7-day wipe)
  last_queue_count  INTEGER NOT NULL DEFAULT 0
                      CONSTRAINT vendor_offline_devices_queue_range CHECK (last_queue_count BETWEEN 0 AND 10000),
  stopped_at        TIMESTAMPTZ,
  stopped_by        UUID,
  stop_reason       TEXT
                      CONSTRAINT vendor_offline_devices_stop_reason_allowed
                      CHECK (stop_reason IS NULL OR stop_reason IN ('lost', 'signed_out', 'left_team')),
  CONSTRAINT vendor_offline_devices_stop_shape
    CHECK ((status = 'stopped') = (stopped_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS vendor_offline_devices_shop_idx
  ON public.vendor_offline_devices (vendor_profile_id, member_user_id);

COMMENT ON TABLE public.vendor_offline_devices IS
  'Offline client QR, no stock (owner 2026-11-24, DECISION_LOG 7d618cb3): one row per phone key — the PUBLIC '
  'half only. Offline the phone signs each QR; the server checks it against this key while it is active. '
  '"Stop QR codes from this phone" (a Shop Manager, or the Branch Manager for that branch) and signing out set '
  'it stopped, and every code from it nobody has scanned is refused. last_seen_at is the teammates'' "last '
  'seen" (R5). Service role only.';

ALTER TABLE public.vendor_offline_devices ENABLE ROW LEVEL SECURITY;
-- No policy on purpose: Settings › Offline reads it through the server door after its own role check.
REVOKE ALL ON TABLE public.vendor_offline_devices FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.vendor_offline_code_uses (
  -- the random id the phone put in the QR — taken ONCE (the primary key is the whole one-use rule)
  code_id           UUID PRIMARY KEY,
  device_id         TEXT NOT NULL
                      REFERENCES public.vendor_offline_devices(device_id) ON DELETE CASCADE,
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  member_user_id    UUID NOT NULL,
  used_via          TEXT NOT NULL
                      CONSTRAINT vendor_offline_code_uses_via_allowed
                      CHECK (used_via IN ('client', 'supplier')),
  used_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  booked_date       DATE NOT NULL,
  booked_time       TIME,
  pool_id           UUID REFERENCES public.vendor_schedule_pools(pool_id) ON DELETE SET NULL,
  -- the deal the QR showed, as signed (services; ₱, whole pesos) — kept for the record, nothing is charged from it
  service_ids       UUID[] NOT NULL DEFAULT '{}'
                      CONSTRAINT vendor_offline_code_uses_services_max CHECK (cardinality(service_ids) <= 3),
  total_php         INTEGER
                      CONSTRAINT vendor_offline_code_uses_total_range CHECK (total_php IS NULL OR total_php >= 0),
  first_php         INTEGER
                      CONSTRAINT vendor_offline_code_uses_first_range CHECK (first_php IS NULL OR first_php >= 0),
  phone_time        TIMESTAMPTZ,
  block_id          UUID,
  invite_id         UUID REFERENCES public.vendor_client_invites(invite_id) ON DELETE SET NULL,
  claimed_event_id  UUID REFERENCES public.events(event_id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS vendor_offline_code_uses_shop_idx
  ON public.vendor_offline_code_uses (vendor_profile_id, used_at DESC);

COMMENT ON TABLE public.vendor_offline_code_uses IS
  'Each offline client QR code id, taken once (owner 2026-11-24): the first arrival — the client scanning it or '
  'the supplier''s phone syncing it — makes the one entry (supplier_offline_code_use); the second only fills in '
  'what it knows. Keeps the made-offline facts: the phone, the member, the phone''s time. Shop members read; '
  'only the server writes.';

ALTER TABLE public.vendor_offline_code_uses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_offline_code_uses_shop_read ON public.vendor_offline_code_uses;
CREATE POLICY vendor_offline_code_uses_shop_read
  ON public.vendor_offline_code_uses
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.vendor_offline_code_uses FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.vendor_offline_code_uses FROM authenticated;

-- ── 2 · versioned schedule items (the SHIPPED tables) ────────────────────────
ALTER TABLE public.vendor_calendar_blocks
  ADD COLUMN IF NOT EXISTS version         INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS created_by      UUID DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS updated_by      UUID,
  ADD COLUMN IF NOT EXISTS made_offline    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS phone_time      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offline_code_id UUID,
  ADD COLUMN IF NOT EXISTS offline_item_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_calendar_blocks_offline_code_fk'
  ) THEN
    ALTER TABLE public.vendor_calendar_blocks
      ADD CONSTRAINT vendor_calendar_blocks_offline_code_fk
      FOREIGN KEY (offline_code_id) REFERENCES public.vendor_offline_code_uses(code_id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendor_offline_code_uses_block_fk'
  ) THEN
    ALTER TABLE public.vendor_offline_code_uses
      ADD CONSTRAINT vendor_offline_code_uses_block_fk
      FOREIGN KEY (block_id) REFERENCES public.vendor_calendar_blocks(block_id) ON DELETE SET NULL;
  END IF;
END $$;

-- One queued item lands once; one code makes one entry.
CREATE UNIQUE INDEX IF NOT EXISTS vendor_calendar_blocks_offline_item_unique
  ON public.vendor_calendar_blocks (offline_item_id) WHERE offline_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS vendor_calendar_blocks_offline_code_unique
  ON public.vendor_calendar_blocks (offline_code_id) WHERE offline_code_id IS NOT NULL;

ALTER TABLE public.vendor_calendar_day_states
  ADD COLUMN IF NOT EXISTS version    INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS updated_by UUID;

-- THE ONE VERSION BUMP: every update of a schedule item, from any writer (the
-- calendar actions, the RPCs, the offline door), moves its version on. An
-- offline edit made against the old version then meets a clash, never a merge.
CREATE OR REPLACE FUNCTION public.supplier_schedule_item_versioned()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only a REAL change moves the version (review #2): a write that leaves every field as it was is no change.
  IF (to_jsonb(NEW) - ARRAY['version', 'updated_at', 'updated_by']) = (to_jsonb(OLD) - ARRAY['version', 'updated_at', 'updated_by']) THEN
    NEW.version := OLD.version;
    RETURN NEW;
  END IF;
  NEW.version := OLD.version + 1;
  NEW.updated_by := COALESCE(auth.uid(), NEW.updated_by);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

-- A trigger's function is never called by a session.
REVOKE ALL ON FUNCTION public.supplier_schedule_item_versioned() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_calendar_blocks_versioned ON public.vendor_calendar_blocks;
CREATE TRIGGER vendor_calendar_blocks_versioned
  BEFORE UPDATE ON public.vendor_calendar_blocks
  FOR EACH ROW EXECUTE FUNCTION public.supplier_schedule_item_versioned();

DROP TRIGGER IF EXISTS vendor_calendar_day_states_versioned ON public.vendor_calendar_day_states;
CREATE TRIGGER vendor_calendar_day_states_versioned
  BEFORE UPDATE ON public.vendor_calendar_day_states
  FOR EACH ROW EXECUTE FUNCTION public.supplier_schedule_item_versioned();

-- ── 3 · expo mode: date holds ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_offline_holds (
  hold_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  member_user_id    UUID NOT NULL,
  -- NULL = every schedule of the shop.
  pool_id           UUID REFERENCES public.vendor_schedule_pools(pool_id) ON DELETE CASCADE,
  start_date        DATE NOT NULL,
  end_date          DATE NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  released_at       TIMESTAMPTZ,
  release_reason    TEXT
                      CONSTRAINT vendor_offline_holds_release_allowed
                      CHECK (release_reason IS NULL OR release_reason IN ('synced', 'released')),
  released_by       UUID,
  CONSTRAINT vendor_offline_holds_range
    CHECK (end_date >= start_date AND end_date - start_date <= 31),
  CONSTRAINT vendor_offline_holds_release_shape
    CHECK ((released_at IS NULL) = (release_reason IS NULL))
);

CREATE INDEX IF NOT EXISTS vendor_offline_holds_live_idx
  ON public.vendor_offline_holds (vendor_profile_id, start_date)
  WHERE released_at IS NULL;

COMMENT ON TABLE public.vendor_offline_holds IS
  'Expo mode (owner 2026-11-24, team-clash rule 1): a member, while online, claims a date range; until they '
  'release it (or its end date passes) only they may write into it (supplier_offline_hold_in_the_way — the offline '
  'door and the vendor_calendar_blocks trigger both ask it). Service role only; teammates read it through the door.';

ALTER TABLE public.vendor_offline_holds ENABLE ROW LEVEL SECURITY;
-- No policy on purpose (review #2): every teammate reads holds through the server door (`team.read`) after its own
-- member check — `current_vendor_profile_ids()` admits only the shop's owner and admins, not the whole team.
REVOKE ALL ON TABLE public.vendor_offline_holds FROM anon, authenticated;

-- The ONE test of "a hold is in the way": a live hold (not released, not yet
-- past) of ANOTHER member, on any day of the range, on the same schedule (or a
-- shop-wide one on either side). The newest hold first.
CREATE OR REPLACE FUNCTION public.supplier_offline_hold_in_the_way(
  p_vendor_profile_id UUID,
  p_member_user_id    UUID,
  p_pool_id           UUID,
  p_start             DATE,
  p_end               DATE
) RETURNS TABLE (hold_id UUID, member_user_id UUID, created_at TIMESTAMPTZ, start_date DATE, end_date DATE)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT h.hold_id, h.member_user_id, h.created_at, h.start_date, h.end_date
    FROM public.vendor_offline_holds h
   WHERE h.vendor_profile_id = p_vendor_profile_id
     AND h.released_at IS NULL
     AND h.member_user_id IS DISTINCT FROM p_member_user_id
     -- a member who left the team (or was deactivated) holds nothing any more
     AND NOT EXISTS (
       SELECT 1 FROM public.vendor_team_members tm
        WHERE tm.vendor_profile_id = h.vendor_profile_id AND tm.user_id = h.member_user_id
          AND tm.deactivated_at IS NOT NULL
     )
     AND h.end_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date
     AND h.start_date <= p_end
     AND h.end_date >= p_start
     AND (h.pool_id IS NULL OR p_pool_id IS NULL OR h.pool_id = p_pool_id)
   ORDER BY h.created_at DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.supplier_offline_hold_in_the_way(UUID, UUID, UUID, DATE, DATE) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_offline_hold_in_the_way(UUID, UUID, UUID, DATE, DATE) TO service_role;

-- An ONLINE member's write into another member's held dates is refused too
-- ("only the holder can book them"). The service role (auth.uid() NULL) is the
-- offline door, which asks the same function with the queued item's member.
CREATE OR REPLACE FUNCTION public.vendor_calendar_blocks_respect_holds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_start DATE;
  v_end   DATE;
  v_hold  RECORD;
BEGIN
  IF v_uid IS NULL OR NEW.block_source NOT IN ('manual', 'external_client') THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.blocked_at = OLD.blocked_at
     AND NEW.blocked_until = OLD.blocked_until
     AND NEW.pool_id IS NOT DISTINCT FROM OLD.pool_id THEN
    RETURN NEW;
  END IF;
  v_start := (NEW.blocked_at AT TIME ZONE 'Asia/Manila')::date;
  v_end := GREATEST((NEW.blocked_until AT TIME ZONE 'Asia/Manila')::date, COALESCE(NEW.repeat_until, v_start));
  SELECT * INTO v_hold
    FROM public.supplier_offline_hold_in_the_way(NEW.vendor_profile_id, v_uid, NEW.pool_id, v_start, v_end);
  IF FOUND THEN
    RAISE EXCEPTION 'date_held'
      USING ERRCODE = 'P0001',
            DETAIL = format('held by %s since %s (%s to %s)', v_hold.member_user_id, v_hold.created_at,
                            v_hold.start_date, v_hold.end_date);
  END IF;
  RETURN NEW;
END;
$$;

-- A trigger's function is never called by a session.
REVOKE ALL ON FUNCTION public.vendor_calendar_blocks_respect_holds() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_calendar_blocks_respect_holds ON public.vendor_calendar_blocks;
CREATE TRIGGER vendor_calendar_blocks_respect_holds
  BEFORE INSERT OR UPDATE ON public.vendor_calendar_blocks
  FOR EACH ROW EXECUTE FUNCTION public.vendor_calendar_blocks_respect_holds();

-- ── 4a · a day lock is a booking write too: a teammate's held day is refused online ──
CREATE OR REPLACE FUNCTION public.vendor_calendar_day_states_respect_holds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_hold RECORD;
BEGIN
  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_hold
    FROM public.supplier_offline_hold_in_the_way(NEW.vendor_profile_id, v_uid, NEW.pool_id, NEW.state_date, NEW.state_date);
  IF FOUND THEN
    RAISE EXCEPTION 'date_held'
      USING ERRCODE = 'P0001', DETAIL = format('held by %s since %s', v_hold.member_user_id, v_hold.created_at);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_calendar_day_states_respect_holds() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_calendar_day_states_respect_holds ON public.vendor_calendar_day_states;
CREATE TRIGGER vendor_calendar_day_states_respect_holds
  BEFORE INSERT OR UPDATE ON public.vendor_calendar_day_states
  FOR EACH ROW EXECUTE FUNCTION public.vendor_calendar_day_states_respect_holds();

-- ── 4b · a member who leaves the team: their phones stop signing QR codes ──
CREATE OR REPLACE FUNCTION public.vendor_offline_devices_stop_on_leave()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' OR (NEW.deactivated_at IS NOT NULL AND OLD.deactivated_at IS NULL) THEN
    UPDATE public.vendor_offline_devices
       SET status = 'stopped', stopped_at = NOW(), stop_reason = 'left_team'
     WHERE vendor_profile_id = OLD.vendor_profile_id AND member_user_id = OLD.user_id AND status = 'active';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;
REVOKE ALL ON FUNCTION public.vendor_offline_devices_stop_on_leave() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS vendor_team_members_stop_offline_devices ON public.vendor_team_members;
CREATE TRIGGER vendor_team_members_stop_offline_devices
  AFTER DELETE OR UPDATE OF deactivated_at ON public.vendor_team_members
  FOR EACH ROW EXECUTE FUNCTION public.vendor_offline_devices_stop_on_leave();

-- ── 5 · every queued item, once ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.vendor_offline_writes (
  item_id           UUID NOT NULL,
  vendor_profile_id UUID NOT NULL
                      REFERENCES public.vendor_profiles(vendor_profile_id) ON DELETE CASCADE,
  member_user_id    UUID NOT NULL,
  kind              TEXT NOT NULL
                      CONSTRAINT vendor_offline_writes_kind_shape
                      CHECK (kind ~ '^[a-z_.]{3,40}$'),
  -- The phone's clock, shown as phone time. The server orders by received_at.
  phone_time        TIMESTAMPTZ NOT NULL,
  received_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- NULL while it is being applied; then the answer every retry gets.
  outcome           JSONB,
  settled_at        TIMESTAMPTZ,
  -- keyed by shop + item (review #2): one shop's item id can never answer for another shop
  PRIMARY KEY (vendor_profile_id, item_id)
);

CREATE INDEX IF NOT EXISTS vendor_offline_writes_shop_idx
  ON public.vendor_offline_writes (vendor_profile_id, received_at DESC);

COMMENT ON TABLE public.vendor_offline_writes IS
  'One row per supplier action made offline and sent when back online (owner 2026-11-24): the idempotency key '
  '(a retry gets the first answer, never a second write), the member, the phone''s time and the outcome. '
  'Shop members read; only the server writes.';

ALTER TABLE public.vendor_offline_writes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS vendor_offline_writes_shop_read ON public.vendor_offline_writes;
CREATE POLICY vendor_offline_writes_shop_read
  ON public.vendor_offline_writes
  FOR SELECT TO authenticated
  USING (
    vendor_profile_id IN (SELECT public.current_vendor_profile_ids())
    OR (SELECT public.is_admin())
  );

REVOKE ALL ON TABLE public.vendor_offline_writes FROM anon;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON TABLE public.vendor_offline_writes FROM authenticated;

-- ── 6 · the made-offline mark on the client row ──────────────────────────────
ALTER TABLE public.vendor_client_invites
  ADD COLUMN IF NOT EXISTS made_offline    BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS offline_code_id UUID REFERENCES public.vendor_offline_code_uses(code_id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS phone_time      TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS vendor_client_invites_offline_code_unique
  ON public.vendor_client_invites (offline_code_id) WHERE offline_code_id IS NOT NULL;

-- ── 7a · the schedule door ───────────────────────────────────────────────────
-- ONE function for every offline schedule write, under the SAME per-shop lock
-- the yes takes (`lock_shop_day_counts`'s key), so an offline write and an
-- online booking can never both take the last seat of a day.
--
-- p: { op: add_client | add_block | edit | remove | day_state,
--      vendor_profile_id, member_user_id, item_id, kind, phone_time, made_offline,
--      code_id?, pool_id?, start_date?, end_date?, client_time?, label?,
--      client_name?, client_contact?, client_note?, day_part?,
--      block_id?, base_version?, state_date?, day_state?, note? }
-- Answers (jsonb): status applied | clash | invalid, and for a clash
--   { why: held | booked | closed | changed | removed, by, by_kind, at, start_date?, end_date? }.
-- Every final answer is written to vendor_offline_writes in the same
-- transaction, so a retry after a lost reply gets the same answer.
CREATE OR REPLACE FUNCTION public.supplier_offline_schedule_write(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op      TEXT := p->>'op';
  v_shop    UUID := NULLIF(p->>'vendor_profile_id', '')::uuid;
  v_member  UUID := NULLIF(p->>'member_user_id', '')::uuid;
  v_item    UUID := NULLIF(p->>'item_id', '')::uuid;
  v_kind    TEXT := COALESCE(NULLIF(p->>'kind', ''), 'schedule.' || COALESCE(p->>'op', 'unknown'));
  v_phone   TIMESTAMPTZ := COALESCE(NULLIF(p->>'phone_time', '')::timestamptz, NOW());
  v_offline BOOLEAN := COALESCE((p->>'made_offline')::boolean, TRUE);
  v_code    UUID := NULLIF(p->>'code_id', '')::uuid;
  v_pool    UUID := NULLIF(p->>'pool_id', '')::uuid;
  v_start   DATE := NULLIF(p->>'start_date', '')::date;
  v_end     DATE;
  v_block   UUID := NULLIF(p->>'block_id', '')::uuid;
  v_base    INTEGER := NULLIF(p->>'base_version', '')::integer;
  v_name    TEXT := NULLIF(btrim(COALESCE(p->>'client_name', '')), '');
  v_contact TEXT := NULLIF(btrim(COALESCE(p->>'client_contact', '')), '');
  v_note    TEXT := NULLIF(btrim(COALESCE(p->>'client_note', '')), '');
  v_label   TEXT := NULLIF(btrim(COALESCE(p->>'label', '')), '');
  v_time    TIME := NULLIF(p->>'client_time', '')::time;
  v_part    TEXT := COALESCE(NULLIF(p->>'day_part', ''), 'all_day');
  v_prev    JSONB;
  v_out     JSONB;
  v_row     public.vendor_calendar_blocks%ROWTYPE;
  v_state   public.vendor_calendar_day_states%ROWTYPE;
  v_hold    RECORD;
  v_taker   RECORD;
  v_cap     INTEGER;
  v_taken   INTEGER;
  v_day     DATE;
  v_id      UUID;
  v_from    TEXT;
  v_to      TEXT;
BEGIN
  IF v_shop IS NULL OR v_member IS NULL OR v_op IS NULL
     OR v_op NOT IN ('add_client', 'add_block', 'edit', 'remove', 'day_state') THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'shape');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('setnayan.shop-day-counts:' || v_shop::text, 0));

  -- A retry of an item that already has its answer gets the same answer.
  IF v_item IS NOT NULL THEN
    SELECT w.outcome INTO v_prev FROM public.vendor_offline_writes w WHERE w.vendor_profile_id = v_shop AND w.item_id = v_item;
    IF v_prev IS NOT NULL THEN
      RETURN v_prev || jsonb_build_object('repeat', TRUE);
    END IF;
  END IF;

  -- ── add an outside client / a "not available" block ───────────────────────
  IF v_op IN ('add_client', 'add_block') THEN
    v_end := COALESCE(NULLIF(p->>'end_date', '')::date, v_start);
    IF v_start IS NULL OR v_end < v_start OR v_end - v_start > 31 THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'dates');
    END IF;
    IF v_pool IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.vendor_schedule_pools sp
       WHERE sp.pool_id = v_pool AND sp.vendor_profile_id = v_shop AND sp.is_active
    ) THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'pool');
    END IF;
    IF v_op = 'add_client' AND v_pool IS NULL THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'pool');
    END IF;
    IF v_op = 'add_client' AND v_code IS NULL AND v_name IS NULL THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'name');
    END IF;
    IF v_op = 'add_block' AND v_part NOT IN ('all_day', 'morning', 'afternoon', 'evening') THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'day_part');
    END IF;

    -- ONE CODE, ONE ENTRY: the code already made its entry — the details fill in.
    IF v_code IS NOT NULL THEN
      SELECT * INTO v_row FROM public.vendor_calendar_blocks b WHERE b.offline_code_id = v_code FOR UPDATE;
      IF FOUND THEN
        UPDATE public.vendor_calendar_blocks
           SET client_name    = COALESCE(client_name, v_name),
               client_contact = COALESCE(client_contact, v_contact),
               client_note    = COALESCE(client_note, v_note),
               block_label    = CASE WHEN client_name IS NULL AND v_name IS NOT NULL THEN left(v_name, 120) ELSE block_label END,
               updated_by     = v_member
         WHERE block_id = v_row.block_id
         RETURNING * INTO v_row;
        v_out := jsonb_build_object('status', 'applied', 'deduped', TRUE, 'block_id', v_row.block_id,
                                    'version', v_row.version);
        IF v_item IS NOT NULL THEN
          INSERT INTO public.vendor_offline_writes
            (item_id, vendor_profile_id, member_user_id, kind, phone_time, outcome, settled_at)
          VALUES (v_item, v_shop, v_member, v_kind, v_phone, v_out, NOW())
          ON CONFLICT (vendor_profile_id, item_id) DO UPDATE SET outcome = EXCLUDED.outcome, settled_at = EXCLUDED.settled_at;
        END IF;
        RETURN v_out;
      END IF;
    END IF;

    -- Expo mode: another member holds these dates.
    SELECT * INTO v_hold FROM public.supplier_offline_hold_in_the_way(v_shop, v_member, v_pool, v_start, v_end);
    IF FOUND THEN
      v_out := jsonb_build_object('status', 'clash', 'why', 'held', 'by', v_hold.member_user_id,
                                  'by_kind', 'member', 'at', v_hold.created_at,
                                  'start_date', v_hold.start_date, 'end_date', v_hold.end_date);
    END IF;

    -- An outside client takes a seat: the day must be open and not full.
    IF v_out IS NULL AND v_op = 'add_client' THEN
      SELECT sp.daily_booking_capacity INTO v_cap FROM public.vendor_schedule_pools sp WHERE sp.pool_id = v_pool;
      v_day := v_start;
      WHILE v_out IS NULL AND v_day <= v_end LOOP
        -- closed by a whole-day "not available" block (this schedule or shop-wide)
        SELECT b.created_by AS who, b.created_at AS at INTO v_taker
          FROM public.vendor_calendar_blocks b
         WHERE b.vendor_profile_id = v_shop
           AND b.block_source = 'manual'
           AND COALESCE(b.day_part, 'all_day') = 'all_day'
           AND (b.pool_id IS NULL OR b.pool_id = v_pool)
           AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, v_day)
         ORDER BY b.created_at DESC
         LIMIT 1;
        IF FOUND THEN
          v_out := jsonb_build_object('status', 'clash', 'why', 'closed', 'by', v_taker.who, 'by_kind', 'member',
                                      'at', v_taker.at, 'start_date', v_day, 'end_date', v_day);
          EXIT;
        END IF;
        -- closed by a locked day
        SELECT s.updated_by AS who, s.updated_at AS at INTO v_taker
          FROM public.vendor_calendar_day_states s
         WHERE s.vendor_profile_id = v_shop
           AND s.state_date = v_day
           AND s.day_state = 'locked'
           AND (s.pool_id IS NULL OR s.pool_id = v_pool)
         LIMIT 1;
        IF FOUND THEN
          v_out := jsonb_build_object('status', 'clash', 'why', 'closed', 'by', v_taker.who, 'by_kind', 'member',
                                      'at', v_taker.at, 'start_date', v_day, 'end_date', v_day);
          EXIT;
        END IF;
        -- full: the seats are taken (couples' bookings + outside clients — the shipped count)
        v_taken := public.schedule_pool_taken_on(v_pool, v_day, NULL);
        IF v_taken >= COALESCE(v_cap, 1) THEN
          SELECT x.who, x.kind, x.at INTO v_taker FROM (
            SELECT b.created_by AS who, 'member'::text AS kind, b.created_at AS at
              FROM public.vendor_calendar_blocks b
             WHERE b.pool_id = v_pool AND b.block_source = 'external_client'
               AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, v_day)
            UNION ALL
            SELECT NULL::uuid, 'couple'::text, pb.created_at
              FROM public.vendor_schedule_pool_bookings pb
             WHERE pb.pool_id = v_pool AND pb.booked_date = v_day AND pb.released_at IS NULL
          ) x
          ORDER BY x.at DESC
          LIMIT 1;
          v_out := jsonb_build_object('status', 'clash', 'why', 'booked', 'by', v_taker.who,
                                      'by_kind', COALESCE(v_taker.kind, 'member'), 'at', v_taker.at,
                                      'start_date', v_day, 'end_date', v_day);
          EXIT;
        END IF;
        v_day := v_day + 1;
      END LOOP;
    END IF;

    IF v_out IS NULL THEN
      IF v_op = 'add_client' THEN
        INSERT INTO public.vendor_calendar_blocks
          (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source, is_private,
           client_name, client_contact, client_note, client_time,
           created_by, made_offline, phone_time, offline_code_id, offline_item_id)
        VALUES
          (v_shop, v_pool,
           (v_start::text || ' 00:00:00+08')::timestamptz,
           (v_end::text   || ' 23:30:00+08')::timestamptz,
           left(COALESCE(v_name, v_label, 'Client from your QR'), 120),
           'external_client', TRUE,
           v_name, v_contact, v_note, date_trunc('minute', v_time)::time,
           v_member, v_offline, v_phone, v_code, v_item)
        RETURNING block_id INTO v_id;
      ELSE
        -- The stored hours of each part of the day — the calendar's own (`DAY_PART_STORED`).
        v_from := CASE v_part WHEN 'morning' THEN '06:00' WHEN 'afternoon' THEN '12:00' WHEN 'evening' THEN '18:00' ELSE '00:00' END;
        v_to   := CASE v_part WHEN 'morning' THEN '12:00' WHEN 'afternoon' THEN '18:00' ELSE '23:30' END;
        INSERT INTO public.vendor_calendar_blocks
          (vendor_profile_id, pool_id, blocked_at, blocked_until, block_label, block_source, is_private,
           repeat_rule, day_part, created_by, made_offline, phone_time, offline_item_id)
        VALUES
          (v_shop, v_pool,
           (v_start::text || ' ' || v_from || ':00+08')::timestamptz,
           (v_end::text   || ' ' || v_to   || ':00+08')::timestamptz,
           left(COALESCE(v_label, 'Unavailable'), 120),
           'manual', TRUE, 'once', v_part,
           v_member, v_offline, v_phone, v_item)
        RETURNING block_id INTO v_id;
      END IF;
      v_out := jsonb_build_object('status', 'applied', 'block_id', v_id, 'version', 1);
    END IF;

  -- ── edit / remove one item, against the version the phone saw ─────────────
  ELSIF v_op IN ('edit', 'remove') THEN
    IF v_block IS NULL OR v_base IS NULL THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'base_version');
    END IF;
    SELECT * INTO v_row FROM public.vendor_calendar_blocks b
     WHERE b.block_id = v_block AND b.vendor_profile_id = v_shop FOR UPDATE;
    IF NOT FOUND THEN
      IF v_op = 'remove' THEN
        v_out := jsonb_build_object('status', 'applied', 'already', TRUE, 'block_id', v_block);
      ELSE
        v_out := jsonb_build_object('status', 'clash', 'why', 'removed', 'by', NULL, 'by_kind', 'member', 'at', NULL);
      END IF;
    ELSIF v_row.block_source NOT IN ('manual', 'external_client') THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'source');
    ELSIF v_row.version <> v_base THEN
      v_out := jsonb_build_object('status', 'clash', 'why', 'changed',
                                  'by', COALESCE(v_row.updated_by, v_row.created_by), 'by_kind', 'member',
                                  'at', v_row.updated_at, 'version', v_row.version);
    ELSIF v_op = 'remove' THEN
      DELETE FROM public.vendor_calendar_blocks WHERE block_id = v_block;
      v_out := jsonb_build_object('status', 'applied', 'block_id', v_block);
    ELSE
      v_start := COALESCE(v_start, (v_row.blocked_at AT TIME ZONE 'Asia/Manila')::date);
      v_end := COALESCE(NULLIF(p->>'end_date', '')::date, CASE WHEN p ? 'start_date' THEN v_start END,
                        (v_row.blocked_until AT TIME ZONE 'Asia/Manila')::date);
      IF v_end < v_start OR v_end - v_start > 31 THEN
        RETURN jsonb_build_object('status', 'invalid', 'reason', 'dates');
      END IF;
      SELECT * INTO v_hold
        FROM public.supplier_offline_hold_in_the_way(v_shop, v_member, v_row.pool_id, v_start, v_end);
      IF FOUND THEN
        v_out := jsonb_build_object('status', 'clash', 'why', 'held', 'by', v_hold.member_user_id,
                                    'by_kind', 'member', 'at', v_hold.created_at,
                                    'start_date', v_hold.start_date, 'end_date', v_hold.end_date);
      ELSIF v_row.block_source = 'external_client' THEN
        SELECT sp.daily_booking_capacity INTO v_cap FROM public.vendor_schedule_pools sp WHERE sp.pool_id = v_row.pool_id;
        v_day := v_start;
        WHILE v_day <= v_end LOOP
          -- the same closed-day and locked-day checks the add path makes
          IF EXISTS (
            SELECT 1 FROM public.vendor_calendar_blocks b
             WHERE b.vendor_profile_id = v_shop AND b.block_source = 'manual'
               AND COALESCE(b.day_part, 'all_day') = 'all_day'
               AND (b.pool_id IS NULL OR b.pool_id = v_row.pool_id)
               AND public.calendar_block_on_day(b.blocked_at, b.blocked_until, b.repeat_rule, b.repeat_until, v_day)
          ) OR EXISTS (
            SELECT 1 FROM public.vendor_calendar_day_states ds
             WHERE ds.vendor_profile_id = v_shop AND ds.state_date = v_day AND ds.day_state = 'locked'
               AND (ds.pool_id IS NULL OR ds.pool_id = v_row.pool_id)
          ) THEN
            v_out := jsonb_build_object('status', 'clash', 'why', 'closed', 'by', NULL, 'by_kind', 'member',
                                        'at', NULL, 'start_date', v_day, 'end_date', v_day);
            EXIT;
          END IF;
          -- this item's own seat on the day is not counted against itself
          v_taken := public.schedule_pool_taken_on(v_row.pool_id, v_day, NULL)
                     - CASE WHEN public.calendar_block_on_day(v_row.blocked_at, v_row.blocked_until, v_row.repeat_rule,
                                                              v_row.repeat_until, v_day) THEN 1 ELSE 0 END;
          IF v_taken >= COALESCE(v_cap, 1) THEN
            v_out := jsonb_build_object('status', 'clash', 'why', 'booked', 'by', NULL, 'by_kind', 'member',
                                        'at', NULL, 'start_date', v_day, 'end_date', v_day);
            EXIT;
          END IF;
          v_day := v_day + 1;
        END LOOP;
      END IF;
      IF v_out IS NULL THEN
        UPDATE public.vendor_calendar_blocks
           SET blocked_at     = CASE WHEN block_source = 'external_client'
                                     THEN (v_start::text || ' 00:00:00+08')::timestamptz
                                     ELSE (v_start::text || ' ' || to_char(blocked_at AT TIME ZONE 'Asia/Manila', 'HH24:MI') || ':00+08')::timestamptz END,
               blocked_until  = CASE WHEN block_source = 'external_client'
                                     THEN (v_end::text || ' 23:30:00+08')::timestamptz
                                     ELSE (v_end::text || ' ' || to_char(blocked_until AT TIME ZONE 'Asia/Manila', 'HH24:MI') || ':00+08')::timestamptz END,
               block_label    = left(COALESCE(v_label, v_name, block_label), 120),
               client_name    = CASE WHEN block_source = 'external_client' THEN COALESCE(v_name, client_name) ELSE client_name END,
               client_contact = CASE WHEN block_source = 'external_client' THEN COALESCE(v_contact, client_contact) ELSE client_contact END,
               client_note    = CASE WHEN block_source = 'external_client' THEN COALESCE(v_note, client_note) ELSE client_note END,
               client_time    = CASE WHEN block_source = 'external_client' AND p ? 'client_time'
                                     THEN date_trunc('minute', v_time)::time ELSE client_time END,
               updated_by     = v_member,
               made_offline   = made_offline OR v_offline,
               phone_time     = v_phone
         WHERE block_id = v_block
         RETURNING * INTO v_row;
        v_out := jsonb_build_object('status', 'applied', 'block_id', v_block, 'version', v_row.version);
      END IF;
    END IF;

  -- ── a day's state (locked · whitelist · cleared), against the version seen ──
  ELSE
    v_day := NULLIF(p->>'state_date', '')::date;
    IF v_day IS NULL OR v_base IS NULL
       OR (NULLIF(p->>'day_state', '') IS NOT NULL AND p->>'day_state' NOT IN ('locked', 'whitelist')) THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'day_state');
    END IF;
    IF v_pool IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.vendor_schedule_pools sp WHERE sp.pool_id = v_pool AND sp.vendor_profile_id = v_shop
    ) THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'pool');
    END IF;
    SELECT * INTO v_state FROM public.vendor_calendar_day_states s
     WHERE s.vendor_profile_id = v_shop AND s.state_date = v_day
       AND s.pool_id IS NOT DISTINCT FROM v_pool
     FOR UPDATE;
    -- base 0 = the phone saw no state on that day. A teammate's held day is refused first.
    SELECT * INTO v_hold FROM public.supplier_offline_hold_in_the_way(v_shop, v_member, v_pool, v_day, v_day);
    IF FOUND THEN
      v_out := jsonb_build_object('status', 'clash', 'why', 'held', 'by', v_hold.member_user_id, 'by_kind', 'member',
                                  'at', v_hold.created_at, 'start_date', v_hold.start_date, 'end_date', v_hold.end_date);
    ELSIF v_state.day_state_id IS NOT NULL AND v_state.version <> v_base THEN
      v_out := jsonb_build_object('status', 'clash', 'why', 'changed', 'by', v_state.updated_by,
                                  'by_kind', 'member', 'at', v_state.updated_at, 'version', v_state.version);
    ELSIF v_state.day_state_id IS NULL AND v_base <> 0 THEN
      v_out := jsonb_build_object('status', 'clash', 'why', 'removed', 'by', NULL, 'by_kind', 'member', 'at', NULL);
    ELSIF NULLIF(p->>'day_state', '') IS NULL THEN
      DELETE FROM public.vendor_calendar_day_states WHERE day_state_id = v_state.day_state_id;
      v_out := jsonb_build_object('status', 'applied', 'day_state', NULL);
    ELSIF v_state.day_state_id IS NOT NULL THEN
      UPDATE public.vendor_calendar_day_states
         SET day_state = p->>'day_state', note = left(NULLIF(p->>'note', ''), 300), updated_by = v_member
       WHERE day_state_id = v_state.day_state_id
       RETURNING * INTO v_state;
      v_out := jsonb_build_object('status', 'applied', 'day_state', v_state.day_state, 'version', v_state.version);
    ELSE
      INSERT INTO public.vendor_calendar_day_states (vendor_profile_id, pool_id, state_date, day_state, note, updated_by)
      VALUES (v_shop, v_pool, v_day, p->>'day_state', left(NULLIF(p->>'note', ''), 300), v_member)
      RETURNING * INTO v_state;
      v_out := jsonb_build_object('status', 'applied', 'day_state', v_state.day_state, 'version', v_state.version);
    END IF;
  END IF;

  IF v_item IS NOT NULL THEN
    INSERT INTO public.vendor_offline_writes
      (item_id, vendor_profile_id, member_user_id, kind, phone_time, outcome, settled_at)
    VALUES (v_item, v_shop, v_member, v_kind, v_phone, v_out, NOW())
    ON CONFLICT (vendor_profile_id, item_id) DO UPDATE SET outcome = EXCLUDED.outcome, settled_at = EXCLUDED.settled_at;
  END IF;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_offline_schedule_write(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_offline_schedule_write(JSONB) TO service_role;

-- ── 7b · expo mode: claim · release · release on sync ────────────────────────
-- p: { op: claim | release | synced, vendor_profile_id, member_user_id,
--      pool_id?, start_date?, end_date?, hold_id?, may_release_any? }
CREATE OR REPLACE FUNCTION public.supplier_offline_hold(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_op     TEXT := p->>'op';
  v_shop   UUID := NULLIF(p->>'vendor_profile_id', '')::uuid;
  v_member UUID := NULLIF(p->>'member_user_id', '')::uuid;
  v_pool   UUID := NULLIF(p->>'pool_id', '')::uuid;
  v_start  DATE := NULLIF(p->>'start_date', '')::date;
  v_end    DATE := COALESCE(NULLIF(p->>'end_date', '')::date, NULLIF(p->>'start_date', '')::date);
  v_hold   RECORD;
  v_id     UUID;
  v_n      INTEGER;
BEGIN
  IF v_shop IS NULL OR v_member IS NULL OR v_op NOT IN ('claim', 'release', 'synced') THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'shape');
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended('setnayan.shop-day-counts:' || v_shop::text, 0));

  IF v_op = 'claim' THEN
    IF v_start IS NULL OR v_end < v_start OR v_end - v_start > 31
       OR v_end < (NOW() AT TIME ZONE 'Asia/Manila')::date THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'dates');
    END IF;
    IF v_pool IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.vendor_schedule_pools sp WHERE sp.pool_id = v_pool AND sp.vendor_profile_id = v_shop
    ) THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'pool');
    END IF;
    SELECT * INTO v_hold FROM public.supplier_offline_hold_in_the_way(v_shop, v_member, v_pool, v_start, v_end);
    IF FOUND THEN
      RETURN jsonb_build_object('status', 'clash', 'why', 'held', 'by', v_hold.member_user_id, 'by_kind', 'member',
                                'at', v_hold.created_at, 'start_date', v_hold.start_date, 'end_date', v_hold.end_date);
    END IF;
    -- at most 5 live holds per member (review #2)
    IF (SELECT count(*) FROM public.vendor_offline_holds h
         WHERE h.vendor_profile_id = v_shop AND h.member_user_id = v_member AND h.released_at IS NULL
           AND h.end_date >= (NOW() AT TIME ZONE 'Asia/Manila')::date) >= 5 THEN
      RETURN jsonb_build_object('status', 'invalid', 'reason', 'hold_cap');
    END IF;
    INSERT INTO public.vendor_offline_holds (vendor_profile_id, member_user_id, pool_id, start_date, end_date)
    VALUES (v_shop, v_member, v_pool, v_start, v_end)
    RETURNING hold_id INTO v_id;
    RETURN jsonb_build_object('status', 'applied', 'hold_id', v_id);
  ELSIF v_op = 'release' THEN
    UPDATE public.vendor_offline_holds
       SET released_at = NOW(), release_reason = 'released', released_by = v_member
     WHERE hold_id = NULLIF(p->>'hold_id', '')::uuid
       AND vendor_profile_id = v_shop
       AND released_at IS NULL
       AND (member_user_id = v_member OR COALESCE((p->>'may_release_any')::boolean, FALSE));
    GET DIAGNOSTICS v_n = ROW_COUNT;
    IF v_n = 0 THEN
      RETURN jsonb_build_object('status', 'refused', 'reason', 'not_yours_or_gone');
    END IF;
    RETURN jsonb_build_object('status', 'applied', 'released', v_n);
  ELSE
    UPDATE public.vendor_offline_holds
       SET released_at = NOW(), release_reason = 'synced', released_by = v_member
     WHERE vendor_profile_id = v_shop AND member_user_id = v_member AND released_at IS NULL;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RETURN jsonb_build_object('status', 'applied', 'released', v_n);
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_offline_hold(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_offline_hold(JSONB) TO service_role;

-- ── 7c · one code, one entry ─────────────────────────────────────────────────
-- Called AFTER the server checked the QR's signature against the phone's
-- ACTIVE public key (`lib/supplier-offline/qr.server.ts`). Whoever arrives
-- first — the client scanning it ('client') or the supplier's phone syncing its
-- queued copy ('supplier') — takes the code id (the primary key) and makes THE
-- entry through supplier_offline_schedule_write; a clash gives the code id back,
-- so the other side meets the same answer. The second arrival only fills in what
-- it knows (the supplier's copy carries the client's name; the client's scan
-- carries the event they picked). The phone is checked again here, under lock:
-- a code from a stopped phone is refused even after the signature passed.
-- p: { code_id, device_id, via, booked_date, client_time?, pool_id, service_ids?, total_php?, first_php?,
--      phone_time?, item_id?, event_id?, label?, client_name?, client_contact?, client_note? }
CREATE OR REPLACE FUNCTION public.supplier_offline_code_use(p JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code   UUID := NULLIF(p->>'code_id', '')::uuid;
  v_device TEXT := NULLIF(p->>'device_id', '');
  v_via    TEXT := p->>'via';
  v_event  UUID := NULLIF(p->>'event_id', '')::uuid;
  v_date   DATE := NULLIF(p->>'booked_date', '')::date;
  v_d      public.vendor_offline_devices%ROWTYPE;
  v_u      public.vendor_offline_code_uses%ROWTYPE;
  v_r      JSONB;
  v_n      INTEGER;
BEGIN
  IF v_code IS NULL OR v_device IS NULL OR v_via NOT IN ('client', 'supplier') OR v_date IS NULL THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'shape');
  END IF;
  SELECT * INTO v_d FROM public.vendor_offline_devices WHERE device_id = v_device FOR SHARE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'code');
  END IF;
  IF v_d.status <> 'active' THEN
    RETURN jsonb_build_object('status', 'stopped', 'at', v_d.stopped_at);
  END IF;

  INSERT INTO public.vendor_offline_code_uses
    (code_id, device_id, vendor_profile_id, member_user_id, used_via, booked_date, booked_time, pool_id,
     service_ids, total_php, first_php, phone_time, claimed_event_id)
  VALUES
    (v_code, v_device, v_d.vendor_profile_id, v_d.member_user_id, v_via, v_date,
     NULLIF(p->>'client_time', '')::time, NULLIF(p->>'pool_id', '')::uuid,
     COALESCE(ARRAY(SELECT jsonb_array_elements_text(CASE WHEN jsonb_typeof(p->'service_ids') = 'array' THEN p->'service_ids' ELSE '[]'::jsonb END))::uuid[], '{}'),
     NULLIF(p->>'total_php', '')::integer, NULLIF(p->>'first_php', '')::integer, NULLIF(p->>'phone_time', '')::timestamptz,
     CASE WHEN v_via = 'client' THEN v_event END)
  ON CONFLICT (code_id) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;

  IF v_n = 1 THEN
    -- the first arrival makes the entry, under the clash rules
    v_r := public.supplier_offline_schedule_write(p || jsonb_build_object(
      'op', 'add_client', 'vendor_profile_id', v_d.vendor_profile_id, 'member_user_id', v_d.member_user_id,
      'kind', 'qr.booking', 'start_date', v_date, 'end_date', v_date, 'made_offline', TRUE,
      'item_id', CASE WHEN v_via = 'supplier' THEN p->>'item_id' END));
    IF v_r->>'status' <> 'applied' THEN
      -- a clash gives the code id back: the other side meets the same answer when it arrives
      DELETE FROM public.vendor_offline_code_uses WHERE code_id = v_code;
      RETURN v_r;
    END IF;
    UPDATE public.vendor_offline_code_uses SET block_id = NULLIF(v_r->>'block_id', '')::uuid WHERE code_id = v_code;
    RETURN v_r || jsonb_build_object('used_via', v_via, 'claimed_event_id', CASE WHEN v_via = 'client' THEN v_event END);
  END IF;

  -- the code id is taken: the second arrival
  SELECT * INTO v_u FROM public.vendor_offline_code_uses WHERE code_id = v_code FOR UPDATE;
  IF v_u.device_id <> v_device OR v_u.booked_date IS DISTINCT FROM v_date THEN
    RETURN jsonb_build_object('status', 'invalid', 'reason', 'date');
  END IF;
  IF v_via = 'client' THEN
    IF v_u.claimed_event_id IS NOT NULL AND v_event IS NOT NULL AND v_u.claimed_event_id <> v_event THEN
      RETURN jsonb_build_object('status', 'used', 'at', v_u.used_at);
    END IF;
    IF v_u.claimed_event_id IS NULL AND v_event IS NOT NULL THEN
      UPDATE public.vendor_offline_code_uses SET claimed_event_id = v_event WHERE code_id = v_code;
    END IF;
    RETURN jsonb_build_object('status', 'applied', 'deduped', TRUE, 'block_id', v_u.block_id,
                              'invite_id', v_u.invite_id, 'claimed_event_id', COALESCE(v_u.claimed_event_id, v_event),
                              'used_via', v_u.used_via);
  END IF;
  -- the entry this code made was removed since: never re-made behind a teammate's back
  IF v_u.block_id IS NULL THEN
    RETURN jsonb_build_object('status', 'clash', 'why', 'removed', 'by', NULL, 'by_kind', 'member', 'at', NULL,
                              'invite_id', v_u.invite_id, 'claimed_event_id', v_u.claimed_event_id);
  END IF;
  -- the supplier's queued copy of an entry the client already made: fill in the details
  v_r := public.supplier_offline_schedule_write(p || jsonb_build_object(
    'op', 'add_client', 'vendor_profile_id', v_d.vendor_profile_id, 'member_user_id', v_d.member_user_id,
    'kind', 'qr.booking', 'start_date', v_date, 'end_date', v_date, 'made_offline', TRUE));
  RETURN v_r || jsonb_build_object('invite_id', v_u.invite_id, 'claimed_event_id', v_u.claimed_event_id,
                                   'used_via', v_u.used_via);
END;
$$;
REVOKE ALL ON FUNCTION public.supplier_offline_code_use(JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.supplier_offline_code_use(JSONB) TO service_role;

COMMIT;
