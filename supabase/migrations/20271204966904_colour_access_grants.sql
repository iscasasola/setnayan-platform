-- ============================================================================
-- 20271204966904_colour_access_grants.sql
--
-- MB16 — A STANDING, REVOCABLE COLOUR GRANT, SCOPED TO A LANE.
-- "Let this vendor adjust colours in their own part of your design — you'll
--  always see what changed, and you can undo any single change without
--  touching their access."
--
-- ── 🛑 THE BOUNDARY THAT DOES NOT MOVE ─────────────────────────────────────
-- `events.role_palette` (and `events.reception_design`) are writable by the
-- COUPLE ONLY, and this migration does not widen that by one row:
--
--     couple_can_update_event  (20260513040000_fix_rls_infinite_recursion.sql)
--       USING (event_id IN (SELECT public.current_couple_event_ids())
--              OR public.is_admin())
--     current_couple_event_ids()
--       SELECT event_id FROM event_members
--        WHERE user_id = auth.uid() AND member_type = 'couple'
--
-- A vendor or a coordinator NEVER gains raw UPDATE on `events`. They reach the
-- column through `apply_colour_change`, a SECURITY DEFINER function that checks
-- an ACTIVE grant, performs the write internally, and logs it — the same shape
-- MB8's `moodboard_begin_render` and `moodboard_set_share_consent` already
-- proved, and the same shape MB12's `vendor_agree_to_part` uses to write the
-- freeze. The function is the sanctioned door; the window stays exactly as
-- narrow as it is today.
-- `tests/db/the-events-update-policy-does-not-move.db.test.ts` reads the live
-- policy back out of `pg_policies` and fails on any diff, in either direction.
--
-- ── TWO GRANT TABLES, AND THE REASON IS REFERENTIAL, NOT COSMETIC ──────────
-- A vendor grant's subject is `event_vendors.vendor_id` — a BOOKING. A
-- coordinator's subject is a PERSON: `event_members (event_id, user_id)` with
-- `member_type = 'coordinator'`, which is what `sync_delegate_membership`
-- (20271161203067) mints for every accepted delegate and DELETES when they are
-- removed. One polymorphic table would have to carry two nullable id columns
-- and could FK neither, so "a grant for a booking that no longer exists" and
-- "a grant for somebody who was removed from the event" would both become
-- states the schema permits and something has to remember to check.
--
-- 🔑 SPLIT, BOTH ARE STRUCTURAL. `event_colour_grants.vendor_id` CASCADEs from
-- the booking; `event_colour_grants_coordinator (event_id, user_id)` CASCADEs from the
-- MEMBERSHIP row, so removing a delegate revokes their colour access with no
-- code anywhere doing it on purpose. That wire is the one most likely to be
-- forgotten, so it is a foreign key rather than a rule.
--
-- ── THE LANE IS DERIVED IN SQL, NOT PASSED IN ──────────────────────────────
-- `set_vendor_colour_access` takes NO domain list. It reads
-- `event_vendors.category` — a DB enum — and resolves the lane through
-- `colour_domains_for_category`. MB12's own header warns that "passing the
-- required services into the RPC as a parameter would look stronger and be
-- weaker: a caller who chooses the parameter can choose an empty one"; the
-- same hole points the other way here — a caller who chooses the parameter
-- could choose a WIDER one, and hand a florist the couple's five main colours.
-- MB12 could not close it because its map (`MOODBOARD_SLOT_TRADES`) is
-- TypeScript. This one can, because `category` is a column.
-- `apps/web/lib/colour-access.ts` mirrors the function and
-- `tests/db/the-colour-lane-is-one-map.db.test.ts` fails if the two disagree
-- for ANY member of the enum — the same mirror discipline
-- `public.moderator_area_level` ↔ `resolveAreaLevel` keeps.
--
-- ⚠ AND THE RESOLVED DOMAINS ARE STORED, NOT RE-DERIVED AT WRITE TIME. A
-- booking that is re-categorised later must not silently WIDEN a grant the
-- couple gave a florist. The rows record what was actually granted.
--
-- ── THE STYLIST IS THE ONE WIDE LANE, AND IT IS AN OWNER RULING ────────────
-- `reception_decor` → { decor, main_colours }. Every other trade is narrow. A
-- stylist shapes the whole look, so their lane reaches the couple's five main
-- colours — which ripple into the palette, the 3D room, and everything else
-- that reads them. The couple is told so in words on the card, every time.
--
-- ── THREE INDEPENDENT CONTROLS. NONE TOUCHES ANOTHER. ──────────────────────
--   GRANT   set_vendor_colour_access / set_coordinator_colour_access — writes ONLY the
--           grant tables. Never reads or writes event_colour_changes.
--   NOTIFY  every change writes a row here and the server action emits
--           `colour_changed_in_lane`, which is on EMAIL_ENABLED_TYPES. A
--           notification with no allowlist entry reaches nobody — MB8's
--           payment gap, and the six silenced lock_request_* types before it.
--   REJECT  reject_colour_change — reverts ONE logged value. It does not read
--           or write either grant table, so rejecting a change cannot revoke
--           access, and revoking access cannot erase history.
-- `apps/web/lib/colour-access-controls-are-independent.test.ts` reads the
-- BODIES of these functions out of this file and fails if any of them so much
-- as mentions the other's table. A sentence is not a mechanism.
--
-- ── AND THE FREEZE STILL WINS ──────────────────────────────────────────────
-- 🔑 THE SEAM THAT WOULD HAVE RENDERED AS SUCCESS. MB12 put a BEFORE UPDATE
-- trigger on `events.role_palette` (`events_hold_part_finalization_freeze`)
-- that puts every AGREED part's colours back on every write from every path.
-- A vendor changing a colour a supplier has already signed off on therefore
-- lands, gets silently reverted by the trigger inside the same statement, and
-- returns success. `apply_colour_change` READS THE ROW BACK after the UPDATE
-- and refuses when the value did not take — the check is the mechanism, the
-- pre-check above it is only a better sentence.
--
-- ── 🪤 AND ONE TRAP THE READ-BACK CAUGHT WHILE THIS WAS BEING WRITTEN ─────
-- `jsonb_set(palette, ARRAY['room_dressing','linens'], …)` RETURNS THE INPUT
-- UNCHANGED when `room_dressing` does not exist — a two-element path cannot
-- create its own parent, and the function raises nothing. Most boards carry no
-- `room_dressing` key until somebody overrides a field, so this would have
-- silently swallowed the FIRST change every florist and every stylist ever
-- made, and reported success. The read-back turned it into a refusal instead
-- of a lie; both functions now create the object first.
--
-- ── NO TRIGGERS BEYOND `updated_at`. ──────────────────────────────────────
-- Every invariant is a named CHECK, a primary key, or logic inside an explicit
-- function. A BEFORE INSERT trigger testing IS NOT NULL on a defaulted column
-- refused every insert for five weeks on this repo.
--
-- 🔑 EVERY CHECK IS NAMED. `ugat-schema-claims.db.test.ts` asserts constraints
-- BY NAME, and an autonamed CHECK renumbers the moment a second one lands on
-- the table.
--
-- 🛑 OPEN, DELIBERATELY UNANSWERED: whether the VENDOR should be told that a
-- change of theirs was rejected. Arguments both ways (they may rebuild against
-- a colour that is no longer there / a rejection is a small correction and a
-- notification for it is nagging), and nobody has ruled. No type was invented
-- for it. Surfaced rather than guessed.
--
-- ⚠ DO NOT APPLY THIS DIRECTLY TO PRODUCTION. `deploy-prod.yml` runs
-- `supabase db push --include-all --yes` on merge; a direct apply stamps the
-- prod ledger with a version that has no file on `main` and jams `db push` for
-- every subsequent merge (2026-09-02: seven PRs stranded three hours).
-- ============================================================================

BEGIN;

-- ---- 0 · the lane, as one map ---------------------------------------------
--
-- The four domains: 'main_colours' · 'decor' · 'florals' · 'attire'.
-- Mirrored by COLOUR_DOMAINS in apps/web/lib/colour-access.ts.

CREATE OR REPLACE FUNCTION public.colour_domains_for_category(
  p_category TEXT
) RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE p_category
    -- The one WIDE lane, owner-ruled: a stylist shapes the whole look.
    WHEN 'reception_decor' THEN ARRAY['decor', 'main_colours']
    WHEN 'florist'         THEN ARRAY['florals']
    WHEN 'gown_designer'   THEN ARRAY['attire']
    WHEN 'suit_designer'   THEN ARRAY['attire']
    -- 🔑 A COORDINATOR'S LANE IS NOT ON THE BOOKING. They hold SEVERAL
    -- independent domains at once, granted person by person on
    -- /dashboard/[eventId]/hosts — a booking carries one toggle and cannot
    -- express that. Empty here is an ANSWER, and the vendor card says where
    -- the real door is rather than showing a switch that would mean the wrong
    -- thing.
    WHEN 'planner_coordinator' THEN ARRAY[]::TEXT[]
    -- Every other trade has no colour lane at all. A caterer, a photographer
    -- and a band do not adjust the couple's palette, and an empty array is why
    -- their card renders a sentence instead of a switch.
    ELSE ARRAY[]::TEXT[]
  END;
$$;

COMMENT ON FUNCTION public.colour_domains_for_category(TEXT) IS
  'MB16. The colour domains a booking of this event_vendors.category may be '
  'granted — the lane, derived rather than passed in, so no caller can widen '
  'it. reception_decor (the stylist) is the one wide lane and reaches the '
  'couple''s five main colours. planner_coordinator is EMPTY here on purpose: '
  'a coordinator holds several independent domains, granted on the hosts page. '
  'Mirrored by laneForVendorCategory in apps/web/lib/colour-access.ts; '
  'tests/db/the-colour-lane-is-one-map.db.test.ts fails if they disagree.';

REVOKE ALL ON FUNCTION public.colour_domains_for_category(TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.colour_domains_for_category(TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.colour_domains_for_category(TEXT) TO authenticated;

-- WHICH COLOUR a domain reaches. The write gate, not a display hint.
--
-- ⚠ `ceremony` IS IN NO DOMAIN, AND THAT IS THE ANSWER. The ceremony palette
-- is not reception decor, not florals and not attire, and it is not one of the
-- five main colours. Nobody but the couple changes it. Listing it under
-- `decor` to be tidy would hand a stylist the church.
CREATE OR REPLACE FUNCTION public.colour_domain_covers(
  p_domain      TEXT,
  p_target_kind TEXT,
  p_target_key  TEXT
) RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT CASE
    -- The five majors themselves — role_palette.reception.
    WHEN p_domain = 'main_colours' THEN
      p_target_kind = 'palette' AND p_target_key = 'reception'
    -- The room's dressing overrides, minus the floral one.
    WHEN p_domain = 'decor' THEN
      p_target_kind = 'room_dressing'
      AND p_target_key IN ('linens', 'chairs', 'lighting_warmth')
    WHEN p_domain = 'florals' THEN
      p_target_kind = 'room_dressing' AND p_target_key = 'florals'
    -- Every attire PaletteKey. Mirrors PALETTE_ORDER filtered to
    -- PALETTE_LIMITS[k].family <> 'venue' — a SQL function cannot read
    -- TypeScript, so the list is spelled out here and
    -- tests/db/the-colour-lane-is-one-map.db.test.ts asserts the two agree.
    WHEN p_domain = 'attire' THEN
      p_target_kind = 'palette'
      AND p_target_key IN (
        'bride', 'groom', 'parents_immediate_family', 'muslim_principals',
        'maid_of_honor', 'best_man', 'bridesmaids', 'groomsmen',
        'wedding_party', 'principal_sponsors', 'secondary_sponsors',
        'bearers_flower_girl', 'officiants', 'guest'
      )
    ELSE FALSE
  END;
$$;

COMMENT ON FUNCTION public.colour_domain_covers(TEXT, TEXT, TEXT) IS
  'MB16. TRUE when a colour target lies inside a domain. This is the WRITE '
  'GATE inside apply_colour_change, not a display hint: a florist holding '
  '''florals'' is refused a write to ''reception'' here, in the database, '
  'whatever the UI offered. role_palette.ceremony is in NO domain — only the '
  'couple ever changes it.';

REVOKE ALL ON FUNCTION public.colour_domain_covers(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.colour_domain_covers(TEXT, TEXT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.colour_domain_covers(TEXT, TEXT, TEXT) TO authenticated;

-- ---- 1 · the VENDOR grant --------------------------------------------------
--
-- One row per (event, booking, domain). A stylist's single on-screen switch
-- writes TWO rows, and that is the point: the grant records the lane that was
-- actually given, so re-categorising a booking later cannot widen it.
--
-- REVOCATION IS A FLIP, NOT A DELETE — the same posture as
-- event_render_share_consent's withdrawal. The couple must be able to see that
-- access once existed, and turning it off must not make the change log
-- unexplainable.

CREATE TABLE IF NOT EXISTS public.event_colour_grants (
  event_id           UUID NOT NULL
                       REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The BOOKING, not the shop — event_vendors.vendor_id, the same column
  -- moodboard_part_finalizations and vendor_agree_to_lock take. CASCADE: if
  -- the couple removes the booking, the standing permission goes with it.
  vendor_id          UUID NOT NULL
                       REFERENCES public.event_vendors(vendor_id) ON DELETE CASCADE,
  domain             TEXT NOT NULL
                       CONSTRAINT event_colour_grants_domain_chk
                       CHECK (domain IN ('main_colours', 'decor', 'florals', 'attire')),

  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  revoked_at         TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (event_id, vendor_id, domain),

  -- An INACTIVE row must carry the moment it stopped. Without it "off" and
  -- "off since when" are the same row, and the couple's own audit cannot
  -- answer the second one. Named — see the header.
  CONSTRAINT event_colour_grants_revocation_dated
    CHECK (is_active = TRUE OR revoked_at IS NOT NULL)
);

COMMENT ON TABLE public.event_colour_grants IS
  'MB16. A standing, revocable permission for one BOOKED supplier to change '
  'colours inside one domain of the couple''s board. Written ONLY by '
  'set_vendor_colour_access (couple-only, SECURITY DEFINER); the lane is '
  'derived from event_vendors.category and stored RESOLVED so a later '
  're-categorisation cannot widen it. Revocation flips is_active and stamps '
  'revoked_at — never a delete, because the change log has to stay '
  'explainable. Holding a grant confers NO raw UPDATE on events.';

COMMENT ON COLUMN public.event_colour_grants.is_active IS
  'The couple''s on/off switch. Turning it off stops future writes and touches '
  'NOTHING else — not the change log, not any past change. Independent of '
  'reject_colour_change by construction: neither function mentions the other''s '
  'table.';

CREATE INDEX IF NOT EXISTS event_colour_grants_event_idx
  ON public.event_colour_grants (event_id) WHERE is_active;

-- ---- 2 · the COORDINATOR grant ---------------------------------------------
--
-- ⚠ NAMED `_coordinator`, NOT `_host`, AND A SHIPPED GUARD IS WHY.
-- The first cut called it `event_colour_grants_host`, which made its read
-- policy `event_colour_grants_host_member_read` — and
-- `tests/db/couple-host-policy-scope.db.test.ts` failed it, correctly: that
-- guard exists because ten policies once SAID couple/host and resolved through
-- the member-wide `current_event_ids()`, so an ordinary invited guest got
-- couple-level access to harassment reports and to the consent record that
-- authorises CHECKOUT. Here the word came from the TABLE and meant the SUBJECT
-- of the grant, while the policy's audience really is any member — but a reader
-- cannot tell those apart from the name, which is the entire failure mode the
-- guard watches. `coordinator` is also the more accurate word: the function
-- below requires `event_members.member_type = 'coordinator'`, not "a host".
--
-- Keyed by the PERSON, and by their MEMBERSHIP specifically. `event_members`
-- carries UNIQUE (event_id, user_id), so the composite FK below is legal — and
-- it is what makes "removing a delegate revokes their colour access" a
-- structural fact rather than a step somebody has to remember.

CREATE TABLE IF NOT EXISTS public.event_colour_grants_coordinator (
  event_id           UUID NOT NULL,
  user_id            UUID NOT NULL,
  domain             TEXT NOT NULL
                       CONSTRAINT event_colour_grants_coordinator_domain_chk
                       CHECK (domain IN ('main_colours', 'decor', 'florals', 'attire')),

  is_active          BOOLEAN NOT NULL DEFAULT TRUE,
  granted_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  revoked_at         TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (event_id, user_id, domain),

  -- 🔑 THE WIRE, AS A FOREIGN KEY. sync_delegate_membership DELETEs the
  -- coordinator event_members row when the delegate is removed; this CASCADEs
  -- their standing colour grants away with it. No code performs that revoke.
  CONSTRAINT event_colour_grants_coordinator_membership_fk
    FOREIGN KEY (event_id, user_id)
    REFERENCES public.event_members (event_id, user_id) ON DELETE CASCADE,

  CONSTRAINT event_colour_grants_coordinator_revocation_dated
    CHECK (is_active = TRUE OR revoked_at IS NOT NULL)
);

COMMENT ON TABLE public.event_colour_grants_coordinator IS
  'MB16. A coordinator is NOT one lane — they hold several independent domain '
  'grants at once, one row each, and the couple grants only what they choose. '
  'Keyed to event_members (event_id, user_id) by a composite FK, so removing '
  'the delegate CASCADEs the grants away: sync_delegate_membership deletes the '
  'membership row and nothing has to remember to revoke. Written only by '
  'set_coordinator_colour_access (couple-only, SECURITY DEFINER).';

CREATE INDEX IF NOT EXISTS event_colour_grants_coordinator_event_idx
  ON public.event_colour_grants_coordinator (event_id) WHERE is_active;

-- ---- 3 · the change log — what "reject" operates against -------------------

CREATE TABLE IF NOT EXISTS public.event_colour_changes (
  change_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL
                    REFERENCES public.events(event_id) ON DELETE CASCADE,

  domain          TEXT NOT NULL
                    CONSTRAINT event_colour_changes_domain_chk
                    CHECK (domain IN ('main_colours', 'decor', 'florals', 'attire')),

  -- WHAT moved. 'palette' addresses role_palette.<key>[<index>]; 'room_dressing'
  -- addresses role_palette.room_dressing.<key> and has no index.
  target_kind     TEXT NOT NULL
                    CONSTRAINT event_colour_changes_target_kind_chk
                    CHECK (target_kind IN ('palette', 'room_dressing')),
  target_key      TEXT NOT NULL,
  target_index    SMALLINT,

  old_value       TEXT,
  new_value       TEXT NOT NULL,

  -- WHO. `actor_label` is denormalised ON PURPOSE: it is the shop or person
  -- name AS IT READ AT THE TIME, and the log must still say who did this after
  -- the booking is deleted or the person leaves the event.
  actor_kind      TEXT NOT NULL
                    CONSTRAINT event_colour_changes_actor_kind_chk
                    CHECK (actor_kind IN ('vendor', 'coordinator')),
  actor_user_id   UUID REFERENCES public.users(user_id) ON DELETE SET NULL,
  -- 🪤 SET NULL, AND DELIBERATELY *NOT* PAIRED WITH A CHECK REQUIRING IT.
  -- `CHECK (actor_kind <> 'vendor' OR vendor_id IS NOT NULL)` is the obvious
  -- companion and it would be a trap: SET NULL onto a CHECKed column makes the
  -- FK behave like RESTRICT while still claiming SET NULL, so deleting the
  -- BOOKING would fail with a constraint error nobody could place. The log row
  -- outlives the booking; `actor_label` is what keeps it readable.
  vendor_id       UUID REFERENCES public.event_vendors(vendor_id) ON DELETE SET NULL,
  actor_label     TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- The couple's undo. NULL = still standing.
  reverted_at         TIMESTAMPTZ,
  reverted_by_user_id UUID REFERENCES public.users(user_id) ON DELETE SET NULL,

  -- Both ends of a change are colours, or the log cannot draw the swatch it
  -- promises. `old_value` may be NULL only for a room_dressing field that had
  -- no override yet — there was genuinely nothing there.
  CONSTRAINT event_colour_changes_value_shape
    CHECK (
      new_value ~ '^#[0-9A-Fa-f]{6}$'
      AND (old_value IS NULL OR old_value ~ '^#[0-9A-Fa-f]{6}$')
    ),
  -- A palette slot is CHANGED, never created: apply_colour_change refuses an
  -- index that holds no colour, so a palette row always has something to go
  -- back to. Without this, "reject" on such a row would have to delete an
  -- array element and shift every colour after it.
  CONSTRAINT event_colour_changes_palette_has_prior
    CHECK (target_kind <> 'palette' OR old_value IS NOT NULL),
  -- An index belongs to a palette slot and to nothing else.
  CONSTRAINT event_colour_changes_index_shape
    CHECK ((target_kind = 'palette') = (target_index IS NOT NULL)),
  -- 🪤 ONE DIRECTION ONLY, AND THE MISSING HALF IS THE SAME TRAP AS `vendor_id`
  -- ABOVE. The obvious constraint here is the BICONDITIONAL — a revert has a
  -- date iff it has an author — and it would silently turn
  -- `reverted_by_user_id`'s ON DELETE SET NULL into a RESTRICT: erasing the
  -- account of a partner who once rejected a change would try to null the
  -- author on a row that still carries a date, fail this CHECK, and refuse the
  -- user DELETE with a constraint error nobody could place. This repo has paid
  -- for that shape once already.
  --
  -- So: an AUTHOR implies a DATE (a stamp with no time is unreadable), and a
  -- date with no author is legal — which is exactly what an erased account
  -- leaves behind, and is the truth about that row.
  CONSTRAINT event_colour_changes_revert_dated
    CHECK (reverted_by_user_id IS NULL OR reverted_at IS NOT NULL)
);

COMMENT ON TABLE public.event_colour_changes IS
  'MB16. One row per colour a granted vendor or coordinator changed — who, '
  'what, from, to, when. This is what "reject" operates against: '
  'reject_colour_change reverts ONE row''s value and stamps reverted_at, and '
  'never reads or writes either grant table. Rows are never deleted by a '
  'revoke, and a revoke is never performed by a reject.';

COMMENT ON COLUMN public.event_colour_changes.actor_label IS
  'The shop or person name AS IT READ WHEN THE CHANGE WAS MADE. Denormalised '
  'so the log still says who did this after the booking is deleted (vendor_id '
  'goes NULL) or the person leaves the event.';

COMMENT ON COLUMN public.event_colour_changes.reverted_at IS
  'Stamped by reject_colour_change. Independent of the grant: rejecting a '
  'change never revokes ongoing access, and revoking access never touches this '
  'column. Three controls, none affecting the others.';

CREATE INDEX IF NOT EXISTS event_colour_changes_event_idx
  ON public.event_colour_changes (event_id, created_at DESC);
CREATE INDEX IF NOT EXISTS event_colour_changes_vendor_idx
  ON public.event_colour_changes (vendor_id, created_at DESC)
  WHERE vendor_id IS NOT NULL;

-- ---- 4 · RLS — Pattern B read half; every write is a definer function ------

ALTER TABLE public.event_colour_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_colour_grants_coordinator ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_colour_changes ENABLE ROW LEVEL SECURITY;

-- Any event member may see what colour access this board has handed out — the
-- couple to manage it, the holder to know what they may touch.
DROP POLICY IF EXISTS event_colour_grants_member_read ON public.event_colour_grants;
CREATE POLICY event_colour_grants_member_read
  ON public.event_colour_grants
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()) OR public.is_admin());

-- The asked SUPPLIER is not an event member, and must still be able to read
-- their own grant — otherwise their own screen cannot tell them what they may
-- change. Scoped to the BOOKING, so a shop sees its own row and nothing else.
DROP POLICY IF EXISTS event_colour_grants_vendor_read ON public.event_colour_grants;
CREATE POLICY event_colour_grants_vendor_read
  ON public.event_colour_grants
  FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT public.current_vendor_event_vendor_ids()));

DROP POLICY IF EXISTS event_colour_grants_coordinator_member_read ON public.event_colour_grants_coordinator;
CREATE POLICY event_colour_grants_coordinator_member_read
  ON public.event_colour_grants_coordinator
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()) OR public.is_admin());

DROP POLICY IF EXISTS event_colour_changes_member_read ON public.event_colour_changes;
CREATE POLICY event_colour_changes_member_read
  ON public.event_colour_changes
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()) OR public.is_admin());

DROP POLICY IF EXISTS event_colour_changes_vendor_read ON public.event_colour_changes;
CREATE POLICY event_colour_changes_vendor_read
  ON public.event_colour_changes
  FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT public.current_vendor_event_vendor_ids()));

DROP POLICY IF EXISTS event_colour_grants_admin_all ON public.event_colour_grants;
CREATE POLICY event_colour_grants_admin_all
  ON public.event_colour_grants FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS event_colour_grants_coordinator_admin_all ON public.event_colour_grants_coordinator;
CREATE POLICY event_colour_grants_coordinator_admin_all
  ON public.event_colour_grants_coordinator FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS event_colour_changes_admin_all ON public.event_colour_changes;
CREATE POLICY event_colour_changes_admin_all
  ON public.event_colour_changes FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Supabase grants ALL on every new public table to anon + authenticated and
-- publishes it over REST. RLS is ROW-level and can never hide a COLUMN, so the
-- capability is taken away rather than merely policed — and the grant and the
-- policy audience have to move together
-- (tests/db/anon-table-grants-closed.db.test.ts).
REVOKE ALL ON TABLE public.event_colour_grants      FROM anon;
REVOKE ALL ON TABLE public.event_colour_grants_coordinator FROM anon;
REVOKE ALL ON TABLE public.event_colour_changes     FROM anon;
-- 🛑 NO AUTHENTICATED WRITE, ANYWHERE. A grant a couple never gave, and a
-- change nobody was permitted to make, are UNREPRESENTABLE rather than merely
-- refused by a server action.
REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_colour_grants      FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_colour_grants_coordinator FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.event_colour_changes     FROM authenticated;

-- ---- 5 · the couple's gate, once ------------------------------------------

CREATE OR REPLACE FUNCTION public.colour_access_caller_is_couple(
  p_event_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL THEN
    RETURN FALSE;
  END IF;
  -- 🔑 A NULL auth.uid() IS REFUSED HERE, unlike moodboard_render_caller_may_act.
  -- That function fails OPEN for a trusted server context because spending a
  -- credit on behalf of an event is a thing the server legitimately does.
  -- Handing out standing write access to somebody's design is not: the whole
  -- point of this door is that a specific person authorised it.
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;
  RETURN public.is_admin()
      OR p_event_id IN (SELECT public.current_couple_event_ids());
END;
$$;

COMMENT ON FUNCTION public.colour_access_caller_is_couple(UUID) IS
  'MB16. The grant/reject gate: member_type = ''couple'' on this event, or '
  'admin. Deliberately REFUSES a NULL auth.uid() — a trusted server context '
  'may spend a credit for an event, but it may not hand out standing write '
  'access to somebody''s design.';

REVOKE ALL ON FUNCTION public.colour_access_caller_is_couple(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.colour_access_caller_is_couple(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.colour_access_caller_is_couple(UUID) TO authenticated;

-- ---- 6 · GRANT (vendor) — one switch, the lane resolved in here ------------

CREATE OR REPLACE FUNCTION public.set_vendor_colour_access(
  p_event_id  UUID,
  p_vendor_id UUID,
  p_active    BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
  v_status   TEXT;
  v_event    UUID;
  v_domains  TEXT[];
  v_domain   TEXT;
BEGIN
  IF p_event_id IS NULL OR p_vendor_id IS NULL OR p_active IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  IF NOT public.colour_access_caller_is_couple(p_event_id) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  SELECT ev.category::TEXT, ev.status::TEXT, ev.event_id
    INTO v_category, v_status, v_event
    FROM public.event_vendors ev
   WHERE ev.vendor_id = p_vendor_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'booking_not_found' USING ERRCODE = 'P0002';
  END IF;
  -- A couple must not be able to aim a grant at somebody else's supplier.
  IF v_event <> p_event_id THEN
    RAISE EXCEPTION 'booking_not_on_this_event' USING ERRCODE = '42501';
  END IF;
  -- The same four CONFIRMED statuses request_part_finalization uses. A
  -- shortlisted shop has agreed to nothing and gets no standing write access.
  IF v_status NOT IN ('contracted', 'deposit_paid', 'delivered', 'complete') THEN
    RETURN jsonb_build_object('status', 'not_booked', 'current', v_status);
  END IF;

  v_domains := public.colour_domains_for_category(v_category);
  IF COALESCE(array_length(v_domains, 1), 0) = 0 THEN
    -- No lane exists for this trade. Refusing is the honest answer: an empty
    -- grant would render as "on" and permit nothing.
    RETURN jsonb_build_object('status', 'no_lane', 'category', v_category);
  END IF;

  IF p_active THEN
    FOREACH v_domain IN ARRAY v_domains LOOP
      INSERT INTO public.event_colour_grants AS g
        (event_id, vendor_id, domain, is_active, granted_at, granted_by_user_id, revoked_at)
      VALUES (p_event_id, p_vendor_id, v_domain, TRUE, NOW(), auth.uid(), NULL)
      ON CONFLICT (event_id, vendor_id, domain) DO UPDATE SET
        is_active          = TRUE,
        -- Keep the ORIGINAL grant date across an off/on cycle: the audit
        -- question is "since when has this shop been able to do this", and a
        -- re-grant is not a new relationship.
        granted_at         = COALESCE(g.granted_at, NOW()),
        granted_by_user_id = COALESCE(g.granted_by_user_id, auth.uid()),
        revoked_at         = NULL,
        updated_at         = NOW();
    END LOOP;
  ELSE
    -- OFF. Flip, never delete — and note this statement names ONLY the grant
    -- table. Turning access off touches no change, no revert, no history.
    UPDATE public.event_colour_grants
       SET is_active  = FALSE,
           revoked_at = NOW(),
           updated_at = NOW()
     WHERE event_id = p_event_id
       AND vendor_id = p_vendor_id
       AND is_active;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'domains', to_jsonb(v_domains), 'active', p_active);
END;
$$;

COMMENT ON FUNCTION public.set_vendor_colour_access(UUID, UUID, BOOLEAN) IS
  'MB16. The couple''s one switch for one booked supplier. Takes NO domain '
  'list — the lane is resolved in here from event_vendors.category, so no '
  'caller can widen it, and the resolved rows are stored so a later '
  're-categorisation cannot either. Refuses a booking that is not CONFIRMED '
  'and not on this event. OFF flips is_active and stamps revoked_at; it never '
  'touches event_colour_changes.';

REVOKE ALL ON FUNCTION public.set_vendor_colour_access(UUID, UUID, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_vendor_colour_access(UUID, UUID, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_vendor_colour_access(UUID, UUID, BOOLEAN) TO authenticated;

-- ---- 7 · GRANT (coordinator) — one domain at a time ------------------------

CREATE OR REPLACE FUNCTION public.set_coordinator_colour_access(
  p_event_id UUID,
  p_user_id  UUID,
  p_domain   TEXT,
  p_active   BOOLEAN
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_event_id IS NULL OR p_user_id IS NULL OR p_domain IS NULL OR p_active IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;
  IF NOT public.colour_access_caller_is_couple(p_event_id) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;
  IF p_domain NOT IN ('main_colours', 'decor', 'florals', 'attire') THEN
    RETURN jsonb_build_object('status', 'unknown_domain', 'domain', p_domain);
  END IF;

  -- The target must be an accepted delegate ON THIS EVENT. That membership row
  -- is minted and deleted by sync_delegate_membership, so this check follows
  -- the shipped definition of "a coordinator" rather than inventing a second
  -- one. The composite FK below would refuse a stranger anyway; returning a
  -- reason beats a 23503 the UI has to guess at.
  IF NOT EXISTS (
    SELECT 1 FROM public.event_members em
     WHERE em.event_id = p_event_id
       AND em.user_id = p_user_id
       AND em.member_type = 'coordinator'
  ) THEN
    RETURN jsonb_build_object('status', 'not_a_coordinator');
  END IF;

  IF p_active THEN
    INSERT INTO public.event_colour_grants_coordinator AS h
      (event_id, user_id, domain, is_active, granted_at, granted_by_user_id, revoked_at)
    VALUES (p_event_id, p_user_id, p_domain, TRUE, NOW(), auth.uid(), NULL)
    ON CONFLICT (event_id, user_id, domain) DO UPDATE SET
      is_active          = TRUE,
      granted_at         = COALESCE(h.granted_at, NOW()),
      granted_by_user_id = COALESCE(h.granted_by_user_id, auth.uid()),
      revoked_at         = NULL,
      updated_at         = NOW();
  ELSE
    -- Names only the grant table. See set_vendor_colour_access.
    UPDATE public.event_colour_grants_coordinator
       SET is_active  = FALSE,
           revoked_at = NOW(),
           updated_at = NOW()
     WHERE event_id = p_event_id
       AND user_id  = p_user_id
       AND domain   = p_domain
       AND is_active;
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'domain', p_domain, 'active', p_active);
END;
$$;

COMMENT ON FUNCTION public.set_coordinator_colour_access(UUID, UUID, TEXT, BOOLEAN) IS
  'MB16. ONE domain of ONE coordinator''s colour access. A coordinator is not '
  'one lane — the couple ticks each domain independently and this is called '
  'once per tick, so "reception decor but not the main colours" is expressible '
  'rather than approximated. Requires an accepted-delegate event_members row '
  '(member_type = ''coordinator''), the shipped definition. Never touches '
  'event_colour_changes.';

REVOKE ALL ON FUNCTION public.set_coordinator_colour_access(UUID, UUID, TEXT, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_coordinator_colour_access(UUID, UUID, TEXT, BOOLEAN) FROM anon;
GRANT EXECUTE ON FUNCTION public.set_coordinator_colour_access(UUID, UUID, TEXT, BOOLEAN) TO authenticated;

-- ---- 8 · APPLY — the sanctioned door into events.role_palette --------------
--
-- 🔑 THIS IS THE ONE FUNCTION THE WHOLE MIGRATION EXISTS FOR, AND THE GATE IS
-- IN IT — not in the UI, and not in the server action. Called with no active
-- grant, it refuses. Called with a grant for the WRONG domain, it refuses.
-- Called by a couple (who need no grant and have their own RLS path), it
-- refuses. tests/db/an-inactive-grant-refuses-at-the-function.db.test.ts calls
-- it directly, past every screen, and proves each of those.

CREATE OR REPLACE FUNCTION public.apply_colour_change(
  p_event_id     UUID,
  p_domain       TEXT,
  p_target_kind  TEXT,
  p_target_key   TEXT,
  p_target_index SMALLINT,
  p_new_value    TEXT
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_actor_kind TEXT;
  v_vendor_id  UUID;
  v_label      TEXT;
  v_palette    JSONB;
  v_after      JSONB;
  v_arr        JSONB;
  v_old        TEXT;
  v_rd         JSONB;
  v_new        TEXT;
  v_change_id  UUID;
  v_landed     TEXT;
BEGIN
  IF p_event_id IS NULL OR p_domain IS NULL OR p_target_kind IS NULL
     OR p_target_key IS NULL OR p_new_value IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;

  -- 🔑 NO ANONYMOUS AND NO SERVER-CONTEXT WRITES. A grant belongs to a person
  -- or a shop; "the server is asking" cannot hold one, so a NULL uid here is
  -- not a trusted context, it is an unanswerable question.
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no_colour_grant' USING ERRCODE = '42501';
  END IF;

  v_new := upper(btrim(p_new_value));
  IF v_new !~ '^#[0-9A-F]{6}$' THEN
    RETURN jsonb_build_object('status', 'bad_colour');
  END IF;

  -- ══ WHO IS ASKING, AND MAY THEY ═══════════════════════════════════════
  -- A booked supplier holding an ACTIVE grant in this domain…
  SELECT 'vendor', g.vendor_id
    INTO v_actor_kind, v_vendor_id
    FROM public.event_colour_grants g
   WHERE g.event_id = p_event_id
     AND g.domain   = p_domain
     AND g.is_active
     AND g.vendor_id IN (SELECT public.current_vendor_event_vendor_ids())
   LIMIT 1;

  -- …or a coordinator holding one. Checked second and only if the first found
  -- nothing, so one person cannot be both and get two bites.
  IF v_actor_kind IS NULL THEN
    SELECT 'coordinator'
      INTO v_actor_kind
      FROM public.event_colour_grants_coordinator h
     WHERE h.event_id = p_event_id
       AND h.domain   = p_domain
       AND h.is_active
       AND h.user_id  = v_uid
     LIMIT 1;
  END IF;

  -- 🛑 THE REFUSAL. `is_active = FALSE` lands here exactly like "never
  -- granted", which is the point: turning the switch off stops the write at
  -- the database, not merely by hiding a control.
  IF v_actor_kind IS NULL THEN
    RAISE EXCEPTION 'no_colour_grant' USING ERRCODE = '42501';
  END IF;

  -- ══ IS THE TARGET INSIDE THE LANE ═════════════════════════════════════
  -- A florist holding 'florals' asking for 'reception' dies here, in SQL,
  -- whatever the screen offered.
  IF NOT public.colour_domain_covers(p_domain, p_target_kind, p_target_key) THEN
    RAISE EXCEPTION 'target_outside_lane' USING ERRCODE = '42501';
  END IF;

  -- Who to print on the log row, resolved now because the booking may be gone
  -- when somebody reads it.
  IF v_actor_kind = 'vendor' THEN
    SELECT ev.vendor_name INTO v_label
      FROM public.event_vendors ev WHERE ev.vendor_id = v_vendor_id;
  ELSE
    SELECT COALESCE(NULLIF(btrim(u.display_name), ''), 'Your coordinator')
      INTO v_label FROM public.users u WHERE u.user_id = v_uid;
  END IF;

  -- ══ THE WRITE ═════════════════════════════════════════════════════════
  SELECT COALESCE(e.role_palette, '{}'::jsonb) INTO v_palette
    FROM public.events e WHERE e.event_id = p_event_id FOR UPDATE;
  IF v_palette IS NULL THEN
    RETURN jsonb_build_object('status', 'event_not_found');
  END IF;

  IF p_target_kind = 'palette' THEN
    IF p_target_index IS NULL OR p_target_index < 0 THEN
      RETURN jsonb_build_object('status', 'bad_input');
    END IF;
    v_arr := v_palette -> p_target_key;
    -- 🔑 A SLOT IS CHANGED, NEVER CREATED. Adding a colour to a role is the
    -- couple's own act (it changes how many colours that role has). Refusing
    -- here is also what lets `reject` be a clean in-place restore instead of
    -- an array splice — see event_colour_changes_palette_has_prior.
    IF v_arr IS NULL OR jsonb_typeof(v_arr) <> 'array'
       OR jsonb_array_length(v_arr) <= p_target_index THEN
      RETURN jsonb_build_object('status', 'no_such_slot');
    END IF;
    v_old := v_arr ->> p_target_index;
    IF v_old IS NULL THEN
      RETURN jsonb_build_object('status', 'no_such_slot');
    END IF;
    IF upper(v_old) = v_new THEN
      RETURN jsonb_build_object('status', 'unchanged');
    END IF;
    v_palette := jsonb_set(
      v_palette, ARRAY[p_target_key, p_target_index::TEXT], to_jsonb(v_new), FALSE);
  ELSE
    IF p_target_index IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'bad_input');
    END IF;
    v_rd := COALESCE(v_palette -> 'room_dressing', '{}'::jsonb);
    IF jsonb_typeof(v_rd) <> 'object' THEN v_rd := '{}'::jsonb; END IF;
    -- NULL is legal here and means "no override yet — it was following the
    -- majors". Reverting such a change removes the key again rather than
    -- freezing it at whatever the derived colour happened to be that day.
    v_old := v_rd ->> p_target_key;
    IF v_old IS NOT NULL AND upper(v_old) = v_new THEN
      RETURN jsonb_build_object('status', 'unchanged');
    END IF;
    -- 🪤 `jsonb_set` CANNOT CREATE AN INTERMEDIATE OBJECT. With a two-element
    -- path, if `room_dressing` is absent it returns the input UNCHANGED and
    -- raises nothing — so the UPDATE below would have written the palette back
    -- exactly as it found it and reported success. Measured on a real board:
    -- most events carry no `room_dressing` key at all until somebody overrides
    -- a field, which is precisely the FIRST change a florist would ever make.
    -- The read-back further down caught it (it returned `frozen`, which was
    -- the wrong reason but the right refusal); this is the fix.
    IF jsonb_typeof(v_palette -> 'room_dressing') IS DISTINCT FROM 'object' THEN
      v_palette := jsonb_set(v_palette, '{room_dressing}', '{}'::jsonb, TRUE);
    END IF;
    v_palette := jsonb_set(
      v_palette, ARRAY['room_dressing', p_target_key], to_jsonb(v_new), TRUE);
  END IF;

  UPDATE public.events
     SET role_palette          = v_palette,
         mood_board_updated_at = NOW()
   WHERE event_id = p_event_id;

  -- ══ 🔑 DID IT ACTUALLY LAND ═══════════════════════════════════════════
  -- MB12's `events_hold_part_finalization_freeze` is a BEFORE UPDATE trigger
  -- that puts every AGREED part's colours back on EVERY write to
  -- role_palette, from every path — including this one, and correctly so: a
  -- supplier who signed off on a design must not have it moved under them.
  -- But the trigger reverts silently, inside the statement, and the UPDATE
  -- still reports success. Without this read-back a vendor would be told
  -- "saved", the log would carry a change that never happened, and the board
  -- would show the old colour. So the result is MEASURED, not assumed.
  SELECT COALESCE(e.role_palette, '{}'::jsonb) INTO v_after
    FROM public.events e WHERE e.event_id = p_event_id;
  IF p_target_kind = 'palette' THEN
    v_landed := v_after -> p_target_key ->> p_target_index;
  ELSE
    v_landed := v_after -> 'room_dressing' ->> p_target_key;
  END IF;
  IF v_landed IS NULL OR upper(v_landed) <> v_new THEN
    -- Nothing is logged and nothing is notified: nothing happened.
    RETURN jsonb_build_object('status', 'frozen', 'current', v_landed);
  END IF;

  INSERT INTO public.event_colour_changes
    (event_id, domain, target_kind, target_key, target_index,
     old_value, new_value, actor_kind, actor_user_id, vendor_id, actor_label)
  VALUES
    (p_event_id, p_domain, p_target_kind, p_target_key, p_target_index,
     CASE WHEN v_old IS NULL THEN NULL ELSE upper(v_old) END,
     v_new, v_actor_kind, v_uid, v_vendor_id, v_label)
  RETURNING change_id INTO v_change_id;

  RETURN jsonb_build_object(
    'status', 'ok',
    'change_id', v_change_id,
    'old_value', CASE WHEN v_old IS NULL THEN NULL ELSE upper(v_old) END,
    'new_value', v_new,
    'actor_label', v_label,
    'actor_kind', v_actor_kind);
END;
$$;

COMMENT ON FUNCTION public.apply_colour_change(UUID, TEXT, TEXT, TEXT, SMALLINT, TEXT) IS
  'MB16. The ONLY door by which a vendor or coordinator changes a colour on '
  'events.role_palette. Refuses without an ACTIVE grant in the named domain '
  '(is_active = FALSE is indistinguishable from never granted, on purpose), '
  'refuses a target outside that domain, and READS THE ROW BACK afterwards — '
  'because MB12''s freeze trigger reverts an agreed part''s colour silently '
  'inside the same statement and the UPDATE would still report success. '
  'Returns status=''frozen'' in that case and logs nothing. The couple''s own '
  'RLS boundary on events is untouched.';

REVOKE ALL ON FUNCTION public.apply_colour_change(UUID, TEXT, TEXT, TEXT, SMALLINT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_colour_change(UUID, TEXT, TEXT, TEXT, SMALLINT, TEXT) FROM anon;
GRANT EXECUTE ON FUNCTION public.apply_colour_change(UUID, TEXT, TEXT, TEXT, SMALLINT, TEXT) TO authenticated;

-- ---- 9 · REJECT — one change back, and nothing else ------------------------
--
-- 🔑 READ THE BODY. It names `event_colour_changes` and `events`. It does not
-- name `event_colour_grants` or `event_colour_grants_coordinator` anywhere, and that
-- absence is the guarantee: rejecting a change CANNOT revoke access, because
-- there is no statement here that could.
-- `apps/web/lib/colour-access-controls-are-independent.test.ts` reads this
-- function body out of this file and fails if either grant table appears in it.

CREATE OR REPLACE FUNCTION public.reject_colour_change(
  p_change_id UUID
) RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row     public.event_colour_changes%ROWTYPE;
  v_palette JSONB;
  v_after   JSONB;
  v_arr     JSONB;
  v_landed  TEXT;
  v_rows    INTEGER;
BEGIN
  IF p_change_id IS NULL THEN
    RETURN jsonb_build_object('status', 'bad_input');
  END IF;

  SELECT * INTO v_row
    FROM public.event_colour_changes
   WHERE change_id = p_change_id
     FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'change_not_found' USING ERRCODE = 'P0002';
  END IF;

  -- The couple's own act, on their own board.
  IF NOT public.colour_access_caller_is_couple(v_row.event_id) THEN
    RAISE EXCEPTION 'not_your_event' USING ERRCODE = '42501';
  END IF;

  -- Idempotent: a double-click, a retry or two tabs must not each "revert" and
  -- walk the colour backwards through a history that only has one prior value.
  IF v_row.reverted_at IS NOT NULL THEN
    RETURN jsonb_build_object('status', 'already', 'reverted_at', v_row.reverted_at);
  END IF;

  SELECT COALESCE(e.role_palette, '{}'::jsonb) INTO v_palette
    FROM public.events e WHERE e.event_id = v_row.event_id FOR UPDATE;

  IF v_row.target_kind = 'palette' THEN
    v_arr := v_palette -> v_row.target_key;
    IF v_arr IS NULL OR jsonb_typeof(v_arr) <> 'array'
       OR jsonb_array_length(v_arr) <= v_row.target_index THEN
      -- The slot the change touched no longer exists — the couple has since
      -- shortened that role. There is nowhere to put the old colour back, and
      -- silently doing nothing while reporting success is the failure this
      -- whole session is about.
      RETURN jsonb_build_object('status', 'slot_gone');
    END IF;
    -- old_value is NOT NULL for a palette row by CHECK
    -- (event_colour_changes_palette_has_prior), so this is a clean in-place
    -- restore and never an array splice.
    v_palette := jsonb_set(
      v_palette, ARRAY[v_row.target_key, v_row.target_index::TEXT],
      to_jsonb(v_row.old_value), FALSE);
  ELSE
    IF v_row.old_value IS NULL THEN
      -- There was no override before this change. Putting it "back" means
      -- REMOVING the key so the field follows the majors again, exactly as it
      -- did — not pinning it to today's derived value.
      v_palette := jsonb_set(
        v_palette, '{room_dressing}',
        COALESCE(v_palette -> 'room_dressing', '{}'::jsonb) - v_row.target_key, TRUE);
    ELSE
      -- Same jsonb_set trap as apply_colour_change: a two-element path is a
      -- silent no-op when the parent object is missing.
      IF jsonb_typeof(v_palette -> 'room_dressing') IS DISTINCT FROM 'object' THEN
        v_palette := jsonb_set(v_palette, '{room_dressing}', '{}'::jsonb, TRUE);
      END IF;
      v_palette := jsonb_set(
        v_palette, ARRAY['room_dressing', v_row.target_key],
        to_jsonb(v_row.old_value), TRUE);
    END IF;
  END IF;

  UPDATE public.events
     SET role_palette          = v_palette,
         mood_board_updated_at = NOW()
   WHERE event_id = v_row.event_id;

  -- Same read-back as apply, and for the same reason: if the part has been
  -- signed off since, MB12's freeze trigger puts the vendor's colour back and
  -- the UPDATE still says success. Refuse rather than stamp a revert that did
  -- not happen.
  SELECT COALESCE(e.role_palette, '{}'::jsonb) INTO v_after
    FROM public.events e WHERE e.event_id = v_row.event_id;
  IF v_row.target_kind = 'palette' THEN
    v_landed := v_after -> v_row.target_key ->> v_row.target_index;
  ELSE
    v_landed := v_after -> 'room_dressing' ->> v_row.target_key;
  END IF;
  IF v_row.old_value IS NULL THEN
    IF v_landed IS NOT NULL THEN
      RETURN jsonb_build_object('status', 'frozen', 'current', v_landed);
    END IF;
  ELSIF v_landed IS NULL OR upper(v_landed) <> upper(v_row.old_value) THEN
    RETURN jsonb_build_object('status', 'frozen', 'current', v_landed);
  END IF;

  UPDATE public.event_colour_changes
     SET reverted_at         = NOW(),
         reverted_by_user_id = auth.uid()
   WHERE change_id = p_change_id
     AND reverted_at IS NULL;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    -- Lost the race to a concurrent rejecter between the FOR UPDATE and here.
    RAISE EXCEPTION 'change_reverted_under_us' USING ERRCODE = '40001';
  END IF;

  RETURN jsonb_build_object('status', 'ok', 'restored', v_row.old_value);
END;
$$;

COMMENT ON FUNCTION public.reject_colour_change(UUID) IS
  'MB16. Reverts ONE logged colour change to its prior value. Couple-only, '
  'idempotent on reverted_at, and it NEVER touches either grant table — the '
  'person whose change was rejected keeps their ongoing access and can make '
  'the next change immediately. A room_dressing field that had no override '
  'before goes back to having none, so it follows the majors again rather '
  'than freezing at today''s derived colour.';

REVOKE ALL ON FUNCTION public.reject_colour_change(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_colour_change(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.reject_colour_change(UUID) TO authenticated;

COMMIT;
