-- Recurring-billing scaffold (owner 2026-07-10): renewal-reminder infrastructure
-- for prepaid subscription orders (Custom Subdomain ₱999/yr + any order carrying
-- an `expires_at` window). No auto-charge yet — this sends a "renew before X" email
-- N days before expiry; the gateway/auto-charge webhook plugs into the same seam later.

-- Per-(order, window) idempotency lock so a daily cron never double-sends.
CREATE TABLE IF NOT EXISTS public.renewal_reminder_log (
  id              BIGSERIAL PRIMARY KEY,
  order_id        UUID NOT NULL,
  reminder_window TEXT NOT NULL,   -- e.g. '7d' — the offset bucket this reminder covers
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (order_id, reminder_window)
);

ALTER TABLE public.renewal_reminder_log ENABLE ROW LEVEL SECURITY;

-- Admin-only surface; the cron writes via the service-role admin client (bypasses RLS).
-- No public/self policy — renewal state is operational, never couple/vendor-writable.
DROP POLICY IF EXISTS renewal_reminder_log_admin ON public.renewal_reminder_log;
CREATE POLICY renewal_reminder_log_admin ON public.renewal_reminder_log
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Candidates due for a renewal reminder: paid orders whose prepaid window expires
-- within p_days and that haven't been reminded for that window yet. Returns the
-- BUYER (orders.user_id → users) so the cron mails whoever renews. SECURITY DEFINER
-- so the cron's read is join-clean; the cron still inserts the lock row atomically.
CREATE OR REPLACE FUNCTION public.subscriptions_due_for_renewal_reminder(p_days INT DEFAULT 7)
RETURNS TABLE (
  order_id    UUID,
  service_key TEXT,
  expires_at  TIMESTAMPTZ,
  buyer_email TEXT,
  buyer_name  TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT o.order_id, o.service_key, o.expires_at, u.email, u.display_name
  FROM public.orders o
  JOIN public.users u ON u.user_id = o.user_id
  WHERE o.status = 'paid'
    AND o.expires_at IS NOT NULL
    AND o.expires_at > now()
    AND o.expires_at <= now() + make_interval(days => GREATEST(p_days, 1))
    AND u.email IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.renewal_reminder_log l
      WHERE l.order_id = o.order_id
        AND l.reminder_window = (GREATEST(p_days, 1) || 'd')
    )
  ORDER BY o.expires_at ASC
  LIMIT 200;
$$;

GRANT EXECUTE ON FUNCTION public.subscriptions_due_for_renewal_reminder(INT) TO service_role;
