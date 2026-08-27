-- host_and_celebrant_are_two_words
--
-- Owner ruling 2026-08-27, verbatim: *"each event can be set to a single host or
-- multiple host. depending on the type of event. yes, there can be multiple
-- hosts for every event, but the one celebratiing is the celebrant that can be
-- single, couple, or multiple people."*
--
-- ── WHAT WAS WRONG, AND IT WAS ONE FIELD DOING TWO JOBS ─────────────────────
-- `event_type_profiles.terminology.organizer_noun` holds a MIX of two different
-- concepts, and always has: `celebrant` / `graduate` / `couple` name whoever is
-- being HONOURED, while `host` / `organizer` / `family` name whoever RUNS the
-- thing. For a wedding they are the same two people, which is why nobody felt
-- it. At a seven-year-old's birthday they are not, and the guest tree had to
-- work around it — six sentences DROPPED the person entirely rather than print
-- "The celebrant is still arranging the venue layout" (owner ruling
-- 2026-08-18). That workaround is now retired: with two words the sentence can
-- name the right people instead of naming nobody.
--
-- ── WHY HOSTS GET NO COLUMN AND THE CELEBRANT DOES ──────────────────────────
-- 🔑 HOW MANY HOSTS AN EVENT HAS IS ALREADY STORED — it is the count of its
-- `event_members` rows whose `member_type` is a host type. A second copy of a
-- fact the database already holds is the shape this repo keeps paying for, so
-- there is no `host_count` anywhere: the word is fixed, the number is counted.
--
-- The CELEBRANT cannot be counted from anything we store. A wedding's two
-- celebrants may both hold accounts, one may, or neither; `honoree_label` is one
-- free-text first name and cannot tell twins from an only child. So the shape is
-- a per-type default plus a per-event override — the only part of this that
-- needs to be written down.

BEGIN;

-- ── 1 · THE PER-TYPE WORDS ──────────────────────────────────────────────────
--
-- ⚠ MERGE OVER THE STORED BLOB, NEVER REBUILD IT. `terminology` is JSONB and
-- carries the funeral's `register: 'solemn'` and every type's `occasion_noun`;
-- a rebuild here would strip them exactly as the admin editor once did
-- (repaired 2026-08-24). `||` merges right-over-left, so each row keeps
-- everything this statement does not name.
--
-- 🔒 EVERY VALUE BELOW IS WHAT THE CODE ALREADY DERIVES. Writing them down
-- changes no wording anywhere; it makes the DB state what the fallback was
-- guessing, so an admin editing a row can SEE the two words rather than
-- discovering that one field meant two things. The one exception is stated at
-- its row.
UPDATE public.event_type_profiles p
   SET terminology = p.terminology || jsonb_build_object(
         -- The organiser noun IS the host noun, unless it names the honoree —
         -- in which case the host is a plain 'host'. Same rule as
         -- `defaultHostNoun()` in lib/event-type-profile.ts; derived here from
         -- the row rather than re-typed per type, so the two cannot drift.
         'host_noun',
           CASE WHEN p.terminology ->> 'organizer_noun' IN ('celebrant', 'graduate')
                THEN 'host'
                ELSE COALESCE(p.terminology ->> 'organizer_noun', 'host')
           END,
         -- The celebrant noun is the row's OWN organiser noun. Defaulting it to
         -- anything else would have silently downgraded fifteen seeded types to
         -- "the host" — a regression dressed as a default.
         'celebrant_noun', COALESCE(p.terminology ->> 'organizer_noun', 'host'),
         'celebrant_shape',
           CASE
             -- A wedding's celebrant is two people, and 'couple' is collective:
             -- no shape can ever pluralise it, which is the property that keeps
             -- the only event type in production byte-identical.
             WHEN p.event_type = 'wedding' THEN 'couple'
             -- ⚖ THE ONE ROW WHOSE SHAPE IS NOT ITS OLD DEFAULT. A wedding
             -- anniversary honours a couple; its noun stays 'celebrant', and
             -- 'couple' is a countable noun's shape, so this changes no rendered
             -- word today either. It is recorded because it is TRUE, and because
             -- the per-event override below inherits it.
             WHEN p.event_type = 'anniversary' THEN 'couple'
             -- A trip honours everyone on it.
             WHEN p.event_type = 'travel' THEN 'multiple'
             ELSE 'single'
           END
       )
 WHERE p.terminology IS NOT NULL;

-- ── 2 · THE PER-EVENT OVERRIDE ──────────────────────────────────────────────
--
-- NULL means "use this event type's default", which is every row that exists
-- today — so there is no backfill and nothing reads differently on apply.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS celebrant_shape TEXT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'events_celebrant_shape_chk'
  ) THEN
    ALTER TABLE public.events
      ADD CONSTRAINT events_celebrant_shape_chk
      CHECK (celebrant_shape IS NULL OR celebrant_shape IN ('single', 'couple', 'multiple'));
  END IF;
END $$;

COMMENT ON COLUMN public.events.celebrant_shape IS
  'How many people THIS celebration''s celebrant is: single | couple | multiple. '
  'NULL (the default, and every pre-2026-08-27 row) means "use the event type''s '
  'own shape". Owner-set 2026-08-27: hosts may be many on any event and are '
  'COUNTED from event_members, never stored; the celebrant''s shape cannot be '
  'derived from anything we hold — honoree_label is one free-text first name and '
  'cannot tell twins from an only child — so it is the one part written down. '
  'Only ever visible on a countable noun: ''couple'' and ''family'' are '
  'collective and no shape pluralises them.';

-- ── 3 · THE GRANT, AND WHY A COLUMN ON THIS TABLE IS NOT DONE WHEN IT EXISTS ─
--
-- 🚨 `events` REVOKES TABLE-LEVEL SELECT AND RE-GRANTS A PER-COLUMN ALLOWLIST.
-- An ungranted column is not merely unreadable — PostgREST refuses the WHOLE
-- query, so every user-session read of `events` goes silently empty. The db
-- coverage tests structurally cannot catch it: their `before()` re-applies the
-- lockdown and recomputes the allowlist over the new column.
GRANT SELECT (celebrant_shape) ON public.events TO authenticated;
GRANT UPDATE (celebrant_shape) ON public.events TO authenticated;
-- ⚠ `anon` gets nothing. A signed-out visitor reads the WORD on the page; how
-- the celebration configured it is not theirs. The guest tree resolves the word
-- server-side, so nothing on a public page needs this column client-side.
-- No INSERT: the shape is not answered at creation. A celebration is minted on
-- its type's default and changed later, and a column the create path can name
-- is a column a create path can get wrong.

-- ── 4 · AND THE HOST VIEW HAS TO BE REBUILT WITH IT ─────────────────────────
-- `events_host` has an EXPLICIT column projection computed from the grants
-- above, so a new column is a PHANTOM COLUMN on it until the view is rebuilt —
-- and /dashboard/[eventId]/details THROWS on a query error, which would kill
-- Personalization for every host on every event type. Same family as the
-- phantom column · enum value · RPC argument: refused, not thrown.
DROP VIEW IF EXISTS public.events_host;

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

  -- Derived from the GRANT above, so this asserts the grant TOOK rather than
  -- assuming it did.
  IF projected NOT LIKE '%celebrant_shape%' THEN
    RAISE EXCEPTION 'refusing to apply: celebrant_shape missing from the events_host projection — the GRANT above did not take';
  END IF;

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

COMMIT;
