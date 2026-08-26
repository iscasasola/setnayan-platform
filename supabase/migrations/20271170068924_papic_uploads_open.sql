-- papic_uploads_open — "can photos be added by hand to this celebration?"
--
-- Owner 2026-08-26: *"a toggle will set if they will allow people to upload
-- photos manually as well"* and *"uploading can depend on the toggle for photo
-- upload."*
--
-- ⚖ IT DEFAULTS OPEN, AND THAT IS A CHOICE WORTH STATING. Papic's purpose is
-- now *"the source where they collect media files for that event"* (owner, same
-- day), so a library that refuses the most obvious way to put something in it
-- would be closed against its own point. An upload costs a credit exactly like
-- a shot, so an open door is not a free one. A couple who wants only what was
-- caught in the moment can shut it.
--
-- ⚠ ITS SIBLINGS DEFAULT DIFFERENTLY AND THAT IS NOT AN INCONSISTENCY.
-- `papic_guest_capture_early` defaults FALSE because it hands a capability to
-- OTHER PEOPLE, and a wedding must never quietly acquire one.
-- `papic_vendor_challenges_enabled` defaults TRUE for the same reason this one
-- does: it governs a thing the couple already owns.
--
-- ── WHAT IT GOVERNS TODAY, AND WHAT IT WILL ─────────────────────────────────
-- Today the only manual-upload path in the product is the couple's own "Add to
-- your library" picker, so this is the couple's switch over their own library.
-- When guests and suppliers get an upload path, they read the SAME column.
--
-- 🔑 AND THE SERVER MUST READ IT THEN, NOT JUST THE SCREEN. Hiding the picker
-- is enough while the only holder of the Uploads camera is the couple
-- themselves — a couple bypassing their own preference harms nobody. The moment
-- somebody ELSE can upload, a hidden control is not a closed door: this
-- codebase has paid for that distinction repeatedly (the live photo wall
-- mirrored to every guest's phone while the only "off" switch closed the venue
-- screens). **Gate the write, not the button.**

BEGIN;

ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS papic_uploads_open BOOLEAN NOT NULL DEFAULT TRUE;

COMMENT ON COLUMN public.events.papic_uploads_open IS
  'Can photos and clips be added BY HAND to this celebration (as opposed to '
  'captured live)? Owner-set 2026-08-26. Defaults TRUE: Papic is the event''s '
  'media library and an upload already costs a credit, so an open door is not a '
  'free one. Today it governs the couple''s own picker; when guests or suppliers '
  'gain an upload path they read this same column — and the SERVER must check it '
  'then, not only the screen. Hiding a control is not closing a door.';

-- ── THE GRANT, AND WHY A COLUMN ON THIS TABLE IS NOT DONE WHEN IT EXISTS ─────
--
-- 🚨 `events` REVOKES TABLE-LEVEL SELECT AND RE-GRANTS A PER-COLUMN ALLOWLIST.
-- An ungranted column is not merely unreadable — PostgREST refuses the WHOLE
-- query, so every surface reading `events` through a user session goes silently
-- empty. This migration shipped without the grant on its first push and
-- `lint-events-column-grants` is what caught it; the db coverage tests
-- structurally cannot, because their `before()` re-applies the lockdown and
-- recomputes the allowlist over the new column.
--
-- SELECT + UPDATE only. No INSERT: the switch is not answered at creation — a
-- celebration is minted with the default and the couple changes it later, and a
-- column the create path can name is a column a create path can get wrong.
GRANT SELECT (papic_uploads_open) ON public.events TO authenticated;
GRANT UPDATE (papic_uploads_open) ON public.events TO authenticated;
-- ⚠ `anon` is deliberately given nothing. Whether the couple's own library
-- accepts hand-added files is not a signed-out visitor's business.

-- ── AND THE HOST VIEW HAS TO BE REBUILT WITH IT ─────────────────────────────
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

  -- The projection is derived from the GRANT above, so this asserts the grant
  -- took rather than assuming it did.
  IF projected NOT LIKE '%papic_uploads_open%' THEN
    RAISE EXCEPTION 'refusing to apply: papic_uploads_open missing from the events_host projection — the GRANT above did not take';
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
