-- 20271300404545_push_subscriptions_carry_apns_device_tokens.sql
--
-- THE IPHONE APP'S DEVICE TOKEN IS A PUSH SUBSCRIPTION TOO.
--
-- Owner, 2026-10-31: guest replies go to the phone ("The notification on the
-- phone not on the app"), and Web Push never reaches inside the iOS app's
-- WKWebView. The Capacitor app registers with APNs after the same one-time ask
-- as the website, and its device token is saved HERE, next to the browser
-- subscriptions, as `kind = 'apns'` — one table, one set of RLS policies, one
-- erasure path (lib/erasure/coverage.ts already purges push_subscriptions by
-- user_id).
--
--   · kind     'web' (every existing row) | 'apns'.
--   · endpoint for an apns row is the device token (hex) — still UNIQUE, so a
--              re-registration collapses onto one row and re-homes it to whoever
--              signed in on that phone.
--   · p256dh / auth are Web Push encryption keys: required for 'web', absent for
--              'apns' (NOT NULL dropped; a CHECK keeps 'web' rows whole).
--
-- RLS: unchanged — the four owner policies (user_id = auth.uid()) from
-- 20261107000000_push_subscriptions.sql cover the new rows exactly as they cover
-- browser rows. Applied by the pipeline (db push --include-all), never by hand.

BEGIN;

ALTER TABLE public.push_subscriptions
  ADD COLUMN IF NOT EXISTS kind TEXT NOT NULL DEFAULT 'web';

DO $$ BEGIN
  ALTER TABLE public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_kind_check CHECK (kind IN ('web', 'apns'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.push_subscriptions ALTER COLUMN p256dh DROP NOT NULL;
ALTER TABLE public.push_subscriptions ALTER COLUMN auth DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.push_subscriptions
    ADD CONSTRAINT push_subscriptions_web_has_keys
    CHECK (kind <> 'web' OR (p256dh IS NOT NULL AND auth IS NOT NULL));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

COMMENT ON COLUMN public.push_subscriptions.kind IS
  '''web'' = a browser Web Push subscription (endpoint + p256dh + auth); '
  '''apns'' = the iPhone app''s APNs device token, held in endpoint. '
  'lib/web-push.ts sends to web rows, lib/apns.ts to apns rows.';

COMMIT;
