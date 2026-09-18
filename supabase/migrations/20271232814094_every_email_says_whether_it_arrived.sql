/*
  EVERY EMAIL SAYS WHETHER IT ARRIVED — the delivery log.

  ── THE HOLE ───────────────────────────────────────────────────────────────
  `emitNotification` records that a notification was CREATED. Nothing recorded
  whether the email that goes with it was SENT, and nothing at all whether it was
  DELIVERED. `lib/email.ts → sendEmail` returned Resend's message id (or the
  reason it failed) to 29 caller files, and every one of them dropped it. So
  "did the couple get the email?" had no answer anywhere we keep, and a Resend
  key that was missing, revoked or rate-limited failed exactly as quietly as a
  Resend key that worked.

  ── THE FIX ────────────────────────────────────────────────────────────────
  One row per send ATTEMPT, written by `sendEmail` itself (the single choke
  point: `git grep -l "import('resend')" -- apps/web` → lib/email.ts only), so
  no caller can forget. Then a cron-free job (`email-delivery-check`, in
  lib/periodic-job-registry.ts) asks Resend for each accepted message's
  `last_event` and writes it back: delivered · bounced · complained · failed ·
  suppressed · delivery_delayed · … — Resend's vocabulary, stored verbatim.
  No webhook is needed, so there is no owner-side setup and no secret.

  ── WHAT IS DELIBERATELY NOT HERE ──────────────────────────────────────────
  · No raw address. `recipient_masked` ("te•••@gmail.com") is enough for the
    owner to tell whose email it was, and keeps this off the RA 10173 surface.
  · No foreign key. A log that cascades away with its user erases itself in
    the case it exists for (same reasoning as event_vendor_deposit_refusals).
  · No CHECK on last_event. It is Resend's vocabulary, not ours; a CHECK would
    make a new Resend event value refuse the write and hide exactly the thing
    this table exists to show.
  · No grant to anon or authenticated. Written and read on the service client
    only (/admin/settings?tab=notifications and the admin home read it there,
    behind the admin layout's is_admin gate). RLS on, no policies.

  🔑 Auth emails (sign-up confirmation) go out through Supabase Auth's SMTP, not
  through sendEmail, so they are NOT in this log. Said on the page, not hidden.
*/

CREATE TABLE IF NOT EXISTS public.email_deliveries (
  delivery_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- What sent it: a notification type ('order_payment_logged', …) or a
  -- sender's own tag. 'other' when the caller named nothing.
  kind                  TEXT NOT NULL DEFAULT 'other',
  recipient_masked      TEXT NOT NULL,
  subject               TEXT NOT NULL,
  -- What OUR side knew at send time.
  --   accepted       — Resend took it and returned a message id
  --   send_failed    — Resend refused it or the call threw
  --   not_configured — no Resend key, so nothing was even tried
  outcome               TEXT NOT NULL,
  provider_message_id   TEXT,
  error                 TEXT,
  scheduled_for         TIMESTAMPTZ,
  -- What RESEND knows afterwards (filled by the email-delivery-check job).
  last_event            TEXT,
  last_event_checked_at TIMESTAMPTZ,
  CONSTRAINT email_deliveries_outcome_check
    CHECK (outcome IN ('accepted', 'send_failed', 'not_configured'))
);

CREATE INDEX IF NOT EXISTS email_deliveries_recent
  ON public.email_deliveries (created_at DESC);

-- The job's work queue: accepted messages whose fate is not settled yet.
CREATE INDEX IF NOT EXISTS email_deliveries_unsettled
  ON public.email_deliveries (last_event_checked_at NULLS FIRST, created_at)
  WHERE outcome = 'accepted' AND provider_message_id IS NOT NULL;

ALTER TABLE public.email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.email_deliveries FROM PUBLIC, anon, authenticated;

COMMENT ON TABLE public.email_deliveries IS
  'One row per email send attempt through lib/email.ts sendEmail: whether Resend '
  'accepted it (outcome) and, later, what Resend says happened to it (last_event: '
  'delivered, bounced, complained, …). Service-client only. Auth emails sent by '
  'Supabase SMTP are not here.';
