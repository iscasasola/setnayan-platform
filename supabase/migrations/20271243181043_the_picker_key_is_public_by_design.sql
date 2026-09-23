-- THE PICKER KEY IS PUBLIC BY DESIGN — one non-secret column, beside the others.
--
-- Owner, 2026-09-23, enabling it: the Google Picker API is on in the project
-- that already backs Drive, and a browser API key is restricted to the
-- setnayan.com referrers and to the Picker API alone.
--
-- ── WHY platform_settings AND NOT platform_integration_secrets ─────────────
-- 🔑 A PICKER KEY IS HANDED TO A BROWSER. It has to be: the Picker is Google's
-- script running on the client, and it reads the key off the page.
--
-- ⚠ WHOSE browser, precisely: the COUPLE'S, in the website editor — not a
-- guest's. The Picker is a dashboard control, and the exposure baseline agrees
-- (anon=- , authenticated=S). It is still public in the sense that matters:
-- anyone signed in can read it out of their own page, so the referrer and
-- API restrictions carry the weight. But a comment claiming EVERY GUEST reads
-- it would be a false claim the next reader inherits.
--
-- So it is NOT a secret and must not be stored as one. An `_enc` column on
-- platform_integration_secrets would encrypt a value we then publish, which is
-- theatre; worse, it would sit in the deny-by-default table beside the OAuth
-- CLIENT SECRET, which must never reach a browser. Two values that travel to
-- opposite places do not belong in one drawer. `platform_settings` already
-- holds exactly this kind of thing — the OAuth client ids and redirect URIs,
-- which are equally public.
--
-- ── WHY THERE IS NO PROJECT-NUMBER COLUMN ──────────────────────────────────
-- The Picker also needs the Cloud project number, and it is ALREADY HERE: a
-- Google OAuth client id is `<project number>-<random>.apps.googleusercontent.com`,
-- and `google_drive_oauth_client_id` is in this same table. Storing it again
-- would be a second source of truth for one fact, free to drift the moment
-- somebody rotates the client. It is derived, in lib/integrations.
--
-- ── WHY THE DATABASE AND NOT A NEXT_PUBLIC_* ENV VAR ───────────────────────
-- `NEXT_PUBLIC_*` is INLINED AT BUILD TIME, so setting one in Vercel changes
-- nothing until the next deploy — and rotating a key would mean a rebuild
-- before the site worked again. A row read at render takes effect immediately.
--
-- Additive + nullable + idempotent → safe on the live pilot.

ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS google_picker_api_key TEXT;

COMMENT ON COLUMN public.platform_settings.google_picker_api_key IS
  'Browser API key for the Google Picker (owner 2026-09-23). PUBLIC BY DESIGN — it is '
  'handed to the browser of the COUPLE using the website editor — not to guests — which is '
  'what the Picker requires; the HTTP-referrer '
  'and Picker-API-only restrictions on the key are what make it safe. Deliberately NOT on '
  'platform_integration_secrets: that table holds the OAuth CLIENT SECRET, which must '
  'never reach a browser, and the two must not sit in one drawer. The Cloud project number '
  'the Picker also needs is DERIVED from google_drive_oauth_client_id (a Google client id '
  'is <project number>-<random>.apps.googleusercontent.com), never stored twice.';

-- ── PROVE IT ────────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'platform_settings'
       AND column_name = 'google_picker_api_key' AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'platform_settings.google_picker_api_key must exist and be nullable — unset means the picker is simply not offered';
  END IF;

  -- 🔒 It must NOT have been added to the secrets table as well. Two homes for
  -- one value is how a public key ends up treated as a secret, or a secret as
  -- public — and only one of those two mistakes is recoverable.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'platform_integration_secrets'
       AND column_name LIKE '%picker%'
  ) THEN
    RAISE EXCEPTION 'a picker column exists on platform_integration_secrets — a key we publish must not be stored as a secret';
  END IF;
END $$;
