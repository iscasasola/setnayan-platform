-- ============================================================================
-- 20271197508087_ceremony_venue_setting_and_reception_venue_narrowed.sql
--
-- A WEDDING HAS TWO VENUES. THE SCHEMA STORED ONE.
--
-- Owner, 2026-09-03: *"venue is 2. ceremony and reception"* and *"ceremony
-- venue is civil registrar, church, mosque, garden, etc."*
--
-- ── WHAT WAS ACTUALLY THERE (measured against production, not inferred) ─────
--   • `events.venue_setting`  — text, NULLABLE, NO DEFAULT. (The 0043 column
--     was `NOT NULL DEFAULT 'banquet_hall'`; 20260521080000 dropped BOTH so
--     non-wedding events could hold NULL. Anything still describing this column
--     as "NOT NULL DEFAULT banquet_hall" is reading a two-migration-old shape.)
--     `events_wedding_fields_consistency` then makes it NOT NULL *for weddings*
--     via a biconditional, which is why a wedding row always has a value.
--   • `events_venue_setting_check` — NULL OR one of EIGHT values. `restaurant`
--     joined the original seven on 2026-08-05 (20271114090000).
--   • `events.ceremony_type` — the RITE, not a place: catholic · civil · inc ·
--     christian · muslim · cultural · mixed.
--   • A ceremony VENUE column: did not exist. Anywhere.
--
-- `venue_setting` is already the RECEPTION venue in practice, not merely by
-- convention: the 3D Seating Lab renders it as the room guests dine in
-- (`app/dashboard/[eventId]/seating/lab/page.tsx` → `archetypeFor`), and
-- `venueSettingToDirectoryType` maps it onto reception `venue_directory_type`
-- values only.
--
-- ── THE TWO OWNER DECISIONS THIS MIGRATION IMPLEMENTS ───────────────────────
--   1. ADD `ceremony_venue_setting`. KEEP `venue_setting` as the reception
--      venue. NO RENAME — the rename's risk across 10+ readers was weighed and
--      rejected. Both columns get a COMMENT at the bottom of this file saying
--      which is which, because a name that does not say so is exactly how the
--      two got conflated.
--   2. `civil_registrar` moves to the CEREMONY list only. It describes where
--      you marry, never where you dine, and leaving it on the reception axis
--      let "Make it real" bill a couple for a banquet rendered inside a
--      registrar's office.
--
-- ── NULLABLE, DELIBERATELY (unlike venue_setting) ──────────────────────────
-- No DEFAULT and no NOT NULL. A couple who has not said must read as "not set"
-- rather than silently claiming a church. This is the one thing the reception
-- side got wrong and cannot now un-say: both of its writers
-- (`create-event/actions.ts`'s `?? 'banquet_hall'` fallback and
-- `onboarding/wedding/actions.ts`'s `DEFAULT_VENUE`) stamp `banquet_hall` on a
-- couple who never picked, so on that column "banquet_hall" and "never said"
-- are the same bytes. Here they are not.
--
-- It is deliberately NOT added to `events_wedding_fields_consistency`. That
-- biconditional forces the wedding-only columns to NULL on non-weddings; a
-- ceremony venue is not wedding-only — a christening happens in a church, and
-- the column should be able to say so.
--
-- ── THE CEREMONY VALUE LIST, AND WHY EACH VALUE IS ON IT ────────────────────
-- The governing rule: this column names the KIND OF PLACE. `ceremony_type`
-- already names the RITE. A value that encodes the faith would make the faith
-- true in two columns at once — two mechanisms for one fact, each passing its
-- own tests while disagreeing.
--
--   church          The parish church, cathedral or basilica. The commonest
--                   Philippine ceremony venue by a wide margin. Deliberately
--                   NOT split into catholic_church / christian_church the way
--                   `venue_directory_type` splits it: the directory is an
--                   admin catalogue where the faith IS the classification,
--                   whereas here `ceremony_type` already carries it.
--   chapel          A smaller consecrated room — school, hospital, cemetery,
--                   resort or private-estate chapel, and the Iglesia ni Cristo
--                   kapilya. Kept separate from `church` because it differs in
--                   capacity, booking path and cost, which is why couples say
--                   the word at all.
--                   🔑 THIS IS THE ANSWER TO "does INC warrant its own chapel
--                   value?" — NO. `ceremony_type = 'inc'` + `chapel` already
--                   resolves to the directory's `inc_chapel` with zero
--                   ambiguity. An `inc_chapel` value here would put the faith
--                   in both columns, which is the one thing this list is
--                   designed to avoid.
--   mosque          The masjid where the Nikah is solemnised. A building, not
--                   a rite — `ceremony_type = 'muslim'` says the rite.
--   temple          Buddhist / Taoist / Hindu temple. Already a live value of
--                   `venue_directory_type` AND already in
--                   `CEREMONIAL_VENUE_TYPES` (apps/web/lib/religion-readiness.ts),
--                   so the marketplace can already stock one — the couple's
--                   side simply had no way to say it. Chinese-Filipino
--                   weddings are a real and sizeable PH case.
--   civil_registrar The city or municipal hall, the judge's chambers, the
--                   mayor's office. MOVED here from the reception list — this
--                   is owner decision 2, and this list is where the value
--                   always belonged. `venue-settings.ts` had already written
--                   that down in prose ("it is a CEREMONY venue, and the
--                   reception filter never offers it") while the CHECK
--                   continued to allow it as a reception.
--   garden          An outdoor garden ceremony, usually in the grounds of a
--                   garden estate or of the reception venue itself.
--   beach           A beachside ceremony — Boracay, Palawan, Batangas, Cebu.
--                   ⚠ `garden` and `beach` also exist on the reception list and
--                   that duplication is CORRECT, not an oversight: the two
--                   columns are independent, and "garden ceremony, ballroom
--                   reception" is one of the commonest Philippine pairings.
--                   Sharing a word is not sharing a fact.
--   ancestral_house The family's ancestral home — a living Philippine tradition
--                   (Vigan, Taal, Silay, Iloilo) and the owner's own example.
--                   NOT the same as the reception list's `heritage`, which
--                   means a commercial heritage/hacienda venue you rent.
--   hotel_venue     The ceremony held in the hotel's own function room, chapel
--                   or garden, before the reception in its ballroom. Same-venue
--                   weddings are common; without this value such a couple has
--                   to answer "church" and be wrong.
--
-- DELIBERATELY ABSENT: `cultural_site`. It exists in `venue_directory_type` as
-- an admin classification, but a couple describing a cultural rite names the
-- actual place — the ancestral house, the garden, the beach — and
-- `ceremony_type = 'cultural'` already carries the rite. Adding it would be the
-- faith-in-two-columns mistake wearing different clothes.
--
-- ── WHY THE TIGHTENING IS SAFE (a CHECK cannot be added over violating rows) ─
-- Measured against production on 2026-09-03:
--     select venue_setting, count(*) from public.events group by 1;
--       banquet_hall 2 · NULL 2 · heritage 1  →  ZERO rows hold civil_registrar.
-- So today the tightening has nothing to migrate. It is written to be correct
-- either way regardless, because "I checked and there were none" is a fact with
-- a shelf life measured in hours: the UPDATE below runs FIRST, unconditionally,
-- and re-running it after it has already applied matches nothing. Re-measure
-- with the query above rather than trusting these counts.
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. The ceremony venue column — nullable, no default. See the block above.
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS ceremony_venue_setting TEXT;

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_ceremony_venue_setting_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_ceremony_venue_setting_check
  CHECK (
    ceremony_venue_setting IS NULL
    OR ceremony_venue_setting = ANY (ARRAY[
      'church'::text,
      'chapel'::text,
      'mosque'::text,
      'temple'::text,
      'civil_registrar'::text,
      'garden'::text,
      'beach'::text,
      'ancestral_house'::text,
      'hotel_venue'::text
    ])
  );

-- ----------------------------------------------------------------------------
-- 2. Move any existing civil_registrar RECEPTION across to the ceremony side,
--    BEFORE the narrowed constraint is added. A CHECK cannot be added while a
--    row violates it, and the failure would abort the whole deploy.
--
--    Two halves, and the second is the one that needs justifying:
--
--    (a) ceremony_venue_setting ← 'civil_registrar'. This is not an assumption:
--        the couple literally told us the registrar's office was their venue,
--        and the registrar is a ceremony venue. COALESCE so a couple who has
--        ALREADY answered the new question keeps their own answer — this
--        migration must never overwrite a real choice with a derived one.
--
--    (b) venue_setting ← 'banquet_hall'. It cannot be left as-is (the new CHECK
--        forbids it) and it cannot be NULL: `events_wedding_fields_consistency`
--        requires a non-null venue_setting on every wedding row, and only a
--        wedding row can hold a non-null venue_setting in the first place.
--        `banquet_hall` is not a guess about their reception — it is precisely
--        the value this codebase already writes to mean "the couple has not
--        told us yet" (create-event's `?? 'banquet_hall'` fallback and
--        onboarding's `DEFAULT_VENUE`, whose own comment reads "the couple
--        refines it later").
--        🔑 AND IT IS INERT WHERE IT WOULD COST MONEY: the same commit teaches
--        `buildPrompt` to treat exactly `banquet_hall` as unproven and fall
--        back to its generic opening, so a row migrated by this statement can
--        never cause a paid render to depict a ballroom nobody chose. The two
--        halves were written to fit; changing either one alone breaks that.
-- ----------------------------------------------------------------------------

UPDATE public.events
   SET ceremony_venue_setting = COALESCE(ceremony_venue_setting, 'civil_registrar'),
       venue_setting          = 'banquet_hall'
 WHERE venue_setting = 'civil_registrar';

-- ----------------------------------------------------------------------------
-- 3. Narrow the reception CHECK — every value from 20271114090000 except
--    civil_registrar. A DROP + ADD in one transaction, because Postgres has no
--    ALTER CONSTRAINT for the expression; this is the shape both prior
--    migrations of this constraint used.
-- ----------------------------------------------------------------------------

ALTER TABLE public.events
  DROP CONSTRAINT IF EXISTS events_venue_setting_check;
ALTER TABLE public.events
  ADD CONSTRAINT events_venue_setting_check
  CHECK (
    venue_setting IS NULL
    OR venue_setting = ANY (ARRAY[
      'banquet_hall'::text,
      'restaurant'::text,
      'garden'::text,
      'beach'::text,
      'destination'::text,
      'heritage'::text,
      'outdoor_tent'::text
    ])
  );

COMMENT ON CONSTRAINT events_venue_setting_check ON public.events IS
  'RECEPTION settings a host may choose — where the guests dine. Mirrored in '
  'apps/web/lib/venue-settings.ts (VENUE_SETTINGS) and guarded by '
  'venue-settings.test.ts. restaurant added 2026-08-05; civil_registrar REMOVED '
  '2026-09-03 and moved to events_ceremony_venue_setting_check, where it always '
  'belonged.';

COMMENT ON CONSTRAINT events_ceremony_venue_setting_check ON public.events IS
  'CEREMONY venue settings — where the couple marries, complementing '
  'events.ceremony_type (the RITE). Mirrored in apps/web/lib/venue-settings.ts '
  '(CEREMONY_VENUE_SETTINGS) and guarded by venue-settings.test.ts. No value '
  'encodes a faith: ceremony_type already does, and one fact needs one home.';

COMMENT ON COLUMN public.events.venue_setting IS
  'The RECEPTION venue — the kind of room or ground where guests dine. This is '
  'what the 3D Seating Lab draws and what venueSettingToDirectoryType maps to '
  'reception venue_directory_type values. NOT the ceremony venue: that is '
  'events.ceremony_venue_setting (added 20271197508087). Nullable with no '
  'default since 20260521080000, but events_wedding_fields_consistency requires '
  'it on every wedding row. ⚠ Both app writers stamp banquet_hall when the '
  'couple has not chosen, so banquet_hall CANNOT be read as a choice.';

COMMENT ON COLUMN public.events.ceremony_venue_setting IS
  'The CEREMONY venue — where the couple marries (church, chapel, mosque, '
  'temple, civil registrar, garden, beach, ancestral house, hotel). Complements '
  'events.ceremony_type, which carries the RITE; no value here encodes a faith. '
  'NULLABLE ON PURPOSE and with no default: NULL means the couple has not said, '
  'which is the distinction events.venue_setting can no longer make about '
  'itself. Not covered by events_wedding_fields_consistency — a non-wedding '
  'event can legitimately have a ceremony venue (a christening in a church).';

-- ----------------------------------------------------------------------------
-- 4. COLUMN-LEVEL GRANTS — REQUIRED, NOT OPTIONAL.
--
-- public.events revokes table-level SELECT (20271007100000) and table-level
-- UPDATE/INSERT (20271005100000), each re-granting a computed ALLOW-LIST at
-- apply time. A column added later carries NEITHER grant until one is written
-- explicitly — without this block the couple's own
-- `updateCeremonyVenueSetting` save, and every read of the field on the
-- Personalization page, would be refused by PostgREST as a failed query rather
-- than a helpful error. `scripts/lint-events-column-grants.mjs` fails the build
-- on any `ADD COLUMN` with no matching `GRANT SELECT (col)`; this satisfies
-- that guard and the UPDATE half it does not check.
--
-- `authenticated` only, matching 20271193183599 / 20271197327520: anon has no
-- reason to read or write a couple's ceremony venue directly, and RLS
-- (couple_can_update_event) remains the real per-row gate.
-- ----------------------------------------------------------------------------

GRANT SELECT (ceremony_venue_setting) ON public.events TO authenticated;
GRANT UPDATE (ceremony_venue_setting) ON public.events TO authenticated;

-- ----------------------------------------------------------------------------
-- 5. REBUILD `events_host` — the other half of the same obligation.
--
-- public.events_host is a VIEW with an EXPLICIT column projection computed from
-- the SELECT allow-list at apply time, so a column added to the base table is a
-- PHANTOM COLUMN on the view until it is rebuilt — and
-- /dashboard/[eventId]/details THROWS on a query error, killing Personalization
-- for every host on every event type. Copied verbatim from 20271197327520
-- (which last rebuilt it); the private_columns array is unchanged and only the
-- trailing COMMENT differs.
-- ----------------------------------------------------------------------------

DO $$
DECLARE
  private_columns TEXT[] := ARRAY[
    'partner_a_birth_date','partner_a_birth_time',
    'partner_b_birth_date','partner_b_birth_time',
    'bazi_birthdata_consent_at',
    'estimated_budget_centavos','budget_band',
    'wizard_state',
    'photo_delivery_folder_id','photo_delivery_folder_name',
    'photo_delivery_account_email',
    'setnayan_ai_tier_at_purchase',
    'signature_details','honoree_label','honoree_dependent_id'
  ];
  projected TEXT;
BEGIN
  SELECT string_agg('e.' || quote_ident(c.column_name), ', ' ORDER BY c.ordinal_position)
    INTO projected
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'events'
    AND (
      has_column_privilege('authenticated', 'public.events', c.column_name, 'SELECT')
      OR c.column_name = ANY (private_columns)
    );

  IF projected IS NULL THEN
    RAISE EXCEPTION 'refusing to apply: computed events_host projection is empty';
  END IF;

  DROP VIEW IF EXISTS public.events_host;

  EXECUTE format($ddl$
    CREATE VIEW public.events_host
      WITH (security_invoker = false)
      AS
      SELECT %s
        FROM public.events e
       WHERE e.event_id IN (SELECT public.current_couple_event_ids())
          OR e.event_id IN (SELECT public.current_moderator_event_ids())
          OR current_user = 'service_role'
          OR auth.role() = 'service_role'
  $ddl$, projected);
END $$;

REVOKE ALL ON public.events_host FROM PUBLIC;
REVOKE ALL ON public.events_host FROM anon;
REVOKE ALL ON public.events_host FROM authenticated;
GRANT SELECT ON public.events_host TO authenticated, service_role;

COMMENT ON VIEW public.events_host IS
  'Couple/moderator-scoped read path for events, including the columns denied to authenticated on the base table (20271008731642 + 20271025120000: birth data, budget, wizard_state, Drive folder, AI tier, signature_details, honoree_label, honoree_dependent_id). Guests, vendors and coordinators get ZERO rows. security_invoker=false by design. Rebuilt 20271197508087 after ceremony_venue_setting was added.';

-- ----------------------------------------------------------------------------
-- 6. POST-CONDITIONS — asserted against the CATALOG, not against this file.
--
-- A tightening that silently did not apply looks exactly like one that did,
-- until a host saves. Same shape as 20271114090000's postcondition block, which
-- is where this pattern comes from.
-- ----------------------------------------------------------------------------

DO $postcondition$
DECLARE
  v_reception TEXT;
  v_ceremony  TEXT;
  v_value     TEXT;
  v_stragglers BIGINT;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_reception
  FROM pg_constraint c
  WHERE c.conrelid = 'public.events'::regclass
    AND c.conname = 'events_venue_setting_check';
  SELECT pg_get_constraintdef(c.oid) INTO v_ceremony
  FROM pg_constraint c
  WHERE c.conrelid = 'public.events'::regclass
    AND c.conname = 'events_ceremony_venue_setting_check';

  IF v_reception IS NULL THEN
    RAISE EXCEPTION 'events_venue_setting_check is missing — the reception column is now unconstrained';
  END IF;
  IF v_ceremony IS NULL THEN
    RAISE EXCEPTION 'events_ceremony_venue_setting_check is missing — the ceremony column is now unconstrained';
  END IF;

  -- The narrowing actually narrowed. `''civil_registrar''` is quoted with its
  -- literal quotes so this cannot be satisfied by the word appearing inside a
  -- longer identifier or a comment.
  IF position('''civil_registrar''' IN v_reception) > 0 THEN
    RAISE EXCEPTION 'civil_registrar is STILL allowed as a reception venue — the narrowing did not apply';
  END IF;
  IF position('''civil_registrar''' IN v_ceremony) = 0 THEN
    RAISE EXCEPTION 'civil_registrar did not land on the ceremony list — it is now unsayable anywhere';
  END IF;

  -- The narrowing dropped NOTHING ELSE. A reception setting silently lost here
  -- would reject saves for hosts who chose it months ago.
  FOREACH v_value IN ARRAY ARRAY['banquet_hall','restaurant','garden','beach',
                                 'destination','heritage','outdoor_tent']
  LOOP
    IF position('''' || v_value || '''' IN v_reception) = 0 THEN
      RAISE EXCEPTION 'the narrowing DROPPED an existing reception setting: %', v_value;
    END IF;
  END LOOP;

  -- Every ceremony value this migration promises is actually accepted.
  FOREACH v_value IN ARRAY ARRAY['church','chapel','mosque','temple','civil_registrar',
                                 'garden','beach','ancestral_house','hotel_venue']
  LOOP
    IF position('''' || v_value || '''' IN v_ceremony) = 0 THEN
      RAISE EXCEPTION 'ceremony venue % is not accepted by the constraint', v_value;
    END IF;
  END LOOP;

  -- And no row was left behind by the UPDATE. (Belt to the constraint's
  -- suspenders: the ADD CONSTRAINT above would already have refused.)
  SELECT count(*) INTO v_stragglers
  FROM public.events
  WHERE venue_setting = 'civil_registrar';
  IF v_stragglers > 0 THEN
    RAISE EXCEPTION 'still % event(s) holding civil_registrar as a RECEPTION venue', v_stragglers;
  END IF;

  -- The column is genuinely optional. A NOT NULL or a DEFAULT sneaking in
  -- would erase the "has not said" state this column exists to hold.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'events'
      AND column_name = 'ceremony_venue_setting'
      AND (is_nullable <> 'YES' OR column_default IS NOT NULL)
  ) THEN
    RAISE EXCEPTION 'ceremony_venue_setting is NOT NULL or carries a DEFAULT — "not set" is no longer expressible';
  END IF;
END
$postcondition$;

COMMIT;
