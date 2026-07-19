-- Admin daily digest — cron-free lazy-send settings on the single
-- platform_settings row.
--
--   admin_digest_enabled       — owner toggle. OFF by default: no recurring
--                                email goes out until the owner flips this on
--                                (recipients = internal admins, send hour =
--                                08:00 Asia/Manila, sender = lib/admin/digest-flush.ts).
--   admin_digest_last_sent_at  — the per-day claim lock (mirrors
--                                social_publish_settings.last_flush_at). The flush
--                                does a conditional UPDATE on this column, so the
--                                daily send is double-send-safe across concurrent
--                                requests / serverless instances — the row-level
--                                lock means only one caller wins the day's claim.
--
-- Additive + nullable/defaulted; platform_settings already enables RLS (the
-- service-role flush bypasses it), so no policy change is required here.
ALTER TABLE public.platform_settings
  ADD COLUMN IF NOT EXISTS admin_digest_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS admin_digest_last_sent_at timestamptz;
