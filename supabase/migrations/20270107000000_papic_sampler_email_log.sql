-- Free Papic sampler — expiry-warning email log (owner 2026-06-16).
--
-- Cron-free expiry emails: when a couple's FIRST sampler photo is captured, the
-- capture hook schedules two emails with the email provider (Resend's
-- scheduledAt) for ~T-7d and ~T-1d before the 30-day expiry. The PROVIDER fires
-- them at the right time — there is no cron / scheduler on our side.
--
-- This one-row-per-event table is the idempotency lock (its PK prevents a second
-- capture from double-scheduling) and stores the provider message ids so a
-- future "cancel on Drive-connect / upgrade" refinement can call cancel(). The
-- shipped emails are worded gracefully ("ignore this if you've already kept
-- them"), so cancellation is optional, not required for correctness.

BEGIN;

CREATE TABLE IF NOT EXISTS public.papic_sampler_email_log (
  event_id     UUID PRIMARY KEY REFERENCES public.events(event_id) ON DELETE CASCADE,
  t7_email_id  TEXT,
  t1_email_id  TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.papic_sampler_email_log ENABLE ROW LEVEL SECURITY;

-- Written only by the service/admin client (the capture after() hook bypasses
-- RLS); admins may read it. No couple/guest/public access is needed.
CREATE POLICY papic_sampler_email_log_admin_all
  ON public.papic_sampler_email_log
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

COMMIT;
