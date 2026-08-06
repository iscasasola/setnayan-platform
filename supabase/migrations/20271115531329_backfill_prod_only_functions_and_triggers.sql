-- backfill_prod_only_functions_and_triggers
-- ============================================================================
-- SIX FUNCTIONS AND TWO TRIGGERS LIVE IN PRODUCTION THAT NO MIGRATION CREATES.
-- ============================================================================
--
-- Reconciled against prod (project njrupjnvkjkitfctetvi) on 2026-08-06 by
-- diffing `pg_proc` / `pg_trigger` / `pg_event_trigger` in schema `public`
-- against every name any file in supabase/migrations mentions:
--
--   public.rls_auto_enable()                      + EVENT TRIGGER ensure_rls
--   public.notify_chat_message_webhook()          + TRIGGER chat_messages_notify_webhook
--   public.get_vendor_mood_board(uuid)
--   public.confirm_guest_delivery(uuid, text, text)
--   public.undo_guest_delivery(uuid, text)
--   public.list_vendor_delivery_bookings()
--
-- WHY THIS IS NOT COSMETIC. Every guard this repo owns is built on REPLAYING
-- THE MIGRATIONS — the exposure freeze, the anon-RPC surface, the schema-drift
-- check, the FK-behaviour file. An object created out of band is invisible to
-- all of them at once. Four of the six are SECURITY DEFINER and anon-EXECUTE
-- in prod, so the surface those guards report has been six functions short of
-- the truth since the day each was applied by hand. Back-filling is how they
-- come under guard; see supabase/security/README.md, "Scope, honestly".
--
-- BODIES ARE COPIED FROM `pg_get_functiondef()` IN PROD, NOT REWRITTEN, with
-- exactly two deliberate deviations, both called out inline below:
--   1. notify_chat_message_webhook() had a webhook CREDENTIAL hard-coded in its
--      body. It is NOT reproduced here. See section 5.
--   2. That same function was SECURITY DEFINER with NO `SET search_path`. It is
--      pinned here.
--
-- IDEMPOTENT AND SAFE TO RE-APPLY. Every function is CREATE OR REPLACE; the row
-- trigger is DROP-then-CREATE; the event trigger is created only when absent
-- (CREATE EVENT TRIGGER needs privileges the hosted `postgres` role may not
-- have, and prod already has it — so in prod that branch never runs).
--
-- STILL OUT OF SCOPE, ON PURPOSE: `event_service_deliveries` and
-- `pioneer_incentive_logs` are prod-only TABLES, tracked as KNOWN_GAPS in
-- apps/web/tests/db/schema-snapshot.ts. Section 4's three functions read
-- `event_service_deliveries`, which is why this file turns off
-- `check_function_bodies` — see the note there.
-- ============================================================================

-- One SQL-language function below references a prod-only table. Postgres
-- name-resolves LANGUAGE sql bodies at CREATE time, so without this the file
-- cannot replay on a fresh database. plpgsql bodies are unaffected either way.
-- RESET at the bottom of this file.
SET check_function_bodies = off;

-- ----------------------------------------------------------------------------
-- 1. rls_auto_enable() + EVENT TRIGGER ensure_rls
--    Enables RLS on every table created in `public`. A real safety net that
--    the repository has never known about: the memory note "new public tables
--    ship OPEN" describes the GRANTS, and this is the reason the *RLS* half of
--    that has never actually gone wrong in prod.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rls_auto_enable()
RETURNS event_trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog'
AS $function$
DECLARE
  cmd record;
BEGIN
  FOR cmd IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE TABLE', 'CREATE TABLE AS', 'SELECT INTO')
      AND object_type IN ('table','partitioned table')
  LOOP
     IF cmd.schema_name IS NOT NULL AND cmd.schema_name IN ('public') AND cmd.schema_name NOT IN ('pg_catalog','information_schema') AND cmd.schema_name NOT LIKE 'pg_toast%' AND cmd.schema_name NOT LIKE 'pg_temp%' THEN
      BEGIN
        EXECUTE format('alter table if exists %s enable row level security', cmd.object_identity);
        RAISE LOG 'rls_auto_enable: enabled RLS on %', cmd.object_identity;
      EXCEPTION
        WHEN OTHERS THEN
          RAISE LOG 'rls_auto_enable: failed to enable RLS on %', cmd.object_identity;
      END;
     ELSE
        RAISE LOG 'rls_auto_enable: skip % (either system schema or not in enforced list: %.)', cmd.object_identity, cmd.schema_name;
     END IF;
  END LOOP;
END;
$function$;

DO $ensure_rls$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_event_trigger WHERE evtname = 'ensure_rls') THEN
    EXECUTE 'CREATE EVENT TRIGGER ensure_rls ON ddl_command_end EXECUTE FUNCTION public.rls_auto_enable()';
    RAISE NOTICE 'created EVENT TRIGGER ensure_rls';
  END IF;
EXCEPTION
  WHEN insufficient_privilege THEN
    -- Hosted Postgres may refuse CREATE EVENT TRIGGER to a non-superuser. Prod
    -- already HAS it, so this branch only ever matters on a fresh environment,
    -- where losing the safety net must not abort the whole migration run.
    RAISE NOTICE 'ensure_rls: insufficient privilege to create the event trigger; skipping';
END
$ensure_rls$;

-- ----------------------------------------------------------------------------
-- 2. get_vendor_mood_board(uuid)
--    LIVE. Called from apps/web/app/vendor-dashboard/clients/[eventId]/mood-board.
--    Gate: the caller must own a vendor_profiles row (auth.uid()) AND be booked
--    on the event. Anonymous callers fail on the first check.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_vendor_mood_board(p_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $function$
DECLARE
  v_vendor_profile_id uuid;
  v_event record;
  v_inspirations jsonb;
BEGIN
  SELECT vp.vendor_profile_id INTO v_vendor_profile_id
  FROM vendor_profiles vp
  WHERE vp.user_id = auth.uid()
  LIMIT 1;

  IF v_vendor_profile_id IS NULL THEN
    RAISE EXCEPTION 'not_a_vendor';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM event_vendors ev
    WHERE ev.event_id = p_event_id
      AND ev.marketplace_vendor_id = v_vendor_profile_id
  ) THEN
    RAISE EXCEPTION 'not_booked';
  END IF;

  SELECT
    e.display_name,
    e.role_palette,
    e.reception_design,
    e.mood_board_updated_at
  INTO v_event
  FROM events e
  WHERE e.event_id = p_event_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'event_not_found';
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'slot_key',      ia.slot_key,
      'slot_position', ia.slot_position,
      'image_url',     ia.image_url
    ) ORDER BY ia.slot_position
  ) INTO v_inspirations
  FROM event_inspiration_assets ia
  WHERE ia.event_id = p_event_id
    AND ia.removed_at IS NULL;

  RETURN jsonb_build_object(
    'display_name',          v_event.display_name,
    'role_palette',          COALESCE(v_event.role_palette,     '{}'::jsonb),
    'reception_design',      COALESCE(v_event.reception_design, '{}'::jsonb),
    'mood_board_updated_at', v_event.mood_board_updated_at,
    'inspirations',          COALESCE(v_inspirations,           '[]'::jsonb)
  );
END;
$function$;

-- ----------------------------------------------------------------------------
-- 3–4. The per-guest delivery RPCs — ORPHANED, captured rather than dropped.
--
--    confirm_guest_delivery / undo_guest_delivery / list_vendor_delivery_bookings
--
--    ⚠ NOTHING IN THIS REPOSITORY CALLS ANY OF THE THREE. Verified 2026-08-06:
--    a repo-wide grep for all three names outside node_modules hits only
--    supabase/security/README.md and a changelog fragment — no route, no server
--    action, no client, no test. They read a prod-only table
--    (`event_service_deliveries`) which also has zero code references, and a
--    `vendor_services.per_guest_delivery` flag no shipped surface sets.
--
--    DROPPING THEM IS THE RIGHT END STATE and is proposed to the owner in the
--    pull request, not performed here: a DROP is one-way, and "no caller in
--    this repo" is not the same as "no caller anywhere" (an Edge Function or a
--    console query would not show up in a grep). Capturing them first is what
--    makes the eventual DROP a visible, reviewable diff instead of another
--    out-of-band act.
--
--    Gate on all three: `current_vendor_event_vendor_ids()`, which is
--    auth.uid()-derived and empty for an anonymous caller, so anon gets
--    'not_owner' / zero rows rather than data.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.confirm_guest_delivery(
  p_event_vendor_id uuid,
  p_qr_token text,
  p_method text DEFAULT 'qr_scan'::text
)
RETURNS TABLE(result text, total_delivered integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_event_id UUID; v_guest_id UUID;
  v_method TEXT := CASE WHEN p_method = 'manual' THEN 'manual' ELSE 'qr_scan' END;
BEGIN
  SELECT ev.event_id INTO v_event_id
  FROM public.event_vendors ev
  JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
  WHERE ev.vendor_id = p_event_vendor_id
    AND ev.vendor_id IN (SELECT public.current_vendor_event_vendor_ids())
    AND vs.per_guest_delivery = true;
  IF v_event_id IS NULL THEN RETURN QUERY SELECT 'not_owner'::TEXT, 0; RETURN; END IF;
  SELECT g.guest_id INTO v_guest_id FROM public.guests g
  WHERE lower(g.qr_token) = lower(btrim(p_qr_token)) AND g.event_id = v_event_id AND g.deleted_at IS NULL;
  IF v_guest_id IS NULL THEN
    RETURN QUERY SELECT 'not_found'::TEXT,
      (SELECT count(*)::INT FROM public.event_service_deliveries d WHERE d.event_vendor_id = p_event_vendor_id);
    RETURN;
  END IF;
  INSERT INTO public.event_service_deliveries (event_id, event_vendor_id, guest_id, delivered_by_user_id, method)
  VALUES (v_event_id, p_event_vendor_id, v_guest_id, auth.uid(), v_method)
  ON CONFLICT (event_vendor_id, guest_id) DO NOTHING;
  RETURN QUERY SELECT CASE WHEN FOUND THEN 'delivered' ELSE 'already' END::TEXT,
    (SELECT count(*)::INT FROM public.event_service_deliveries d WHERE d.event_vendor_id = p_event_vendor_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.undo_guest_delivery(
  p_event_vendor_id uuid,
  p_qr_token text
)
RETURNS TABLE(result text, total_delivered integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE v_event_id UUID; v_guest_id UUID;
BEGIN
  SELECT ev.event_id INTO v_event_id
  FROM public.event_vendors ev
  JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
  WHERE ev.vendor_id = p_event_vendor_id
    AND ev.vendor_id IN (SELECT public.current_vendor_event_vendor_ids())
    AND vs.per_guest_delivery = true;
  IF v_event_id IS NULL THEN RETURN QUERY SELECT 'not_owner'::TEXT, 0; RETURN; END IF;
  SELECT g.guest_id INTO v_guest_id FROM public.guests g
  WHERE lower(g.qr_token) = lower(btrim(p_qr_token)) AND g.event_id = v_event_id AND g.deleted_at IS NULL;
  IF v_guest_id IS NOT NULL THEN
    DELETE FROM public.event_service_deliveries d
    WHERE d.event_vendor_id = p_event_vendor_id AND d.guest_id = v_guest_id;
  END IF;
  RETURN QUERY SELECT 'undone'::TEXT,
    (SELECT count(*)::INT FROM public.event_service_deliveries d WHERE d.event_vendor_id = p_event_vendor_id);
END; $function$;

CREATE OR REPLACE FUNCTION public.list_vendor_delivery_bookings()
RETURNS TABLE(event_vendor_id uuid, event_label text, service_title text, delivered integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT ev.vendor_id,
         COALESCE(NULLIF(e.display_name, ''), 'Your event'),
         COALESCE(NULLIF(vs.title, ''), ev.category::text, 'Service'),
         (SELECT count(*)::INT FROM public.event_service_deliveries d WHERE d.event_vendor_id = ev.vendor_id)
  FROM public.event_vendors ev
  JOIN public.events e ON e.event_id = ev.event_id
  JOIN public.vendor_services vs ON vs.vendor_service_id = ev.service_id
  WHERE ev.vendor_id IN (SELECT public.current_vendor_event_vendor_ids())
    AND vs.per_guest_delivery = true
  ORDER BY e.event_date NULLS LAST;
$function$;

-- ----------------------------------------------------------------------------
-- 5. notify_chat_message_webhook() + TRIGGER chat_messages_notify_webhook
--
--    🚨 THE LIVE PROD BODY EMBEDS A WEBHOOK CREDENTIAL IN PLAINTEXT.
--
--    The version running in production today builds its `x-webhook-secret`
--    header from a 64-hex-character literal typed straight into the function
--    body, and `pg_proc.prosrc` is world-readable inside the database. That
--    value is NOT reproduced here, and this migration does not carry any secret.
--
--    ⚠ OWNER ACTION — the live value must be ROTATED. It has been readable in
--    the database since the day the function was applied by hand. Rotating means
--    three places must agree: `NOTIFY_WEBHOOK_SECRET` in Vercel, the Vault
--    secret named below, and nothing else.
--
--    NEW SHAPE — same pattern migration 20270930270000 already established for
--    the quarterly-2307 cron job: read the secret from Supabase Vault
--    (`vault.decrypted_secrets`), never from the body, and degrade FAIL-CLOSED.
--    If the Vault row is missing, this sends NOTHING rather than posting a chat
--    message to an endpoint with no credential — a missed push notification, not
--    an unauthenticated call carrying message text.
--
--    URL: overridable via the Vault secret `notify_webhook_url`; the default is
--    the same canonical host the 2307 cron job posts to. (For the record: the
--    live function points at https://setnayan-platform-web.vercel.app/api/notify,
--    which is NOT stale-and-broken — it is the standing fallback host used by
--    ~10 modules in apps/web. It is simply not the canonical one.)
--
--    The prod function is also SECURITY DEFINER with NO `SET search_path`. That
--    is pinned here and every cross-schema call is fully qualified.
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.notify_chat_message_webhook()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_secret text;
  v_url    text;
BEGIN
  SELECT s.decrypted_secret INTO v_secret
  FROM vault.decrypted_secrets s
  WHERE s.name = 'notify_webhook_secret'
  LIMIT 1;

  IF v_secret IS NULL OR btrim(v_secret) = '' THEN
    -- FAIL CLOSED. /api/notify rejects a request with no/!matching header
    -- (401), so posting without one would only leak the message row to the
    -- network for nothing.
    RAISE LOG 'notify_chat_message_webhook: vault secret ''notify_webhook_secret'' is unset — webhook skipped';
    RETURN NULL;
  END IF;

  SELECT s.decrypted_secret INTO v_url
  FROM vault.decrypted_secrets s
  WHERE s.name = 'notify_webhook_url'
  LIMIT 1;

  PERFORM net.http_post(
    url := COALESCE(NULLIF(btrim(v_url), ''), 'https://www.setnayan.com/api/notify'),
    body := row_to_json(NEW)::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-webhook-secret', v_secret
    ),
    timeout_milliseconds := 5000
  );
  RETURN NULL;
END;
$function$;

DROP TRIGGER IF EXISTS chat_messages_notify_webhook ON public.chat_messages;
CREATE TRIGGER chat_messages_notify_webhook
  AFTER INSERT ON public.chat_messages
  FOR EACH ROW EXECUTE FUNCTION public.notify_chat_message_webhook();

COMMENT ON FUNCTION public.notify_chat_message_webhook() IS
  'Fires /api/notify on chat_messages INSERT. Secret + URL come from Supabase Vault (notify_webhook_secret / notify_webhook_url) — NEVER from this body. Missing secret = no call (fail closed). Back-filled 2026-08-06 from a prod-only function that hard-coded the credential.';

RESET check_function_bodies;
