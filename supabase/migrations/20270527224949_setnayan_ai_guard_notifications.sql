-- setnayan ai guard notifications
-- Created via `pnpm migration:new`. Prefix auto-allocated to sort AFTER every
-- existing migration. KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied):
--   • CREATE TABLE IF NOT EXISTS …   (+ ALTER TABLE … ENABLE ROW LEVEL SECURITY in the SAME migration)
--   • ALTER TABLE … ADD COLUMN IF NOT EXISTS …
--   • CREATE INDEX IF NOT EXISTS …
--   • CREATE OR REPLACE FUNCTION …
--   • DROP POLICY IF EXISTS … ; CREATE POLICY …   (policies have no IF NOT EXISTS)

-- ============================================================================
-- Setnayan AI guard notifications (Setnayan_AI_Realtime_Notifications_2026-07-02
-- spec · "make guards notify", owner-greenlit 2026-07-09).
--
-- Two pieces:
--   1. Two new notification_type enum values so the trigger engine's GUARD
--      interventions can reach public.notifications at all (code-verified
--      2026-07-08: the union/enum had NO AI/guard member — guard notifications
--      were structurally impossible).
--        • ai_payment_due  → GRD-01 (vendor payment milestone approaching).
--          On the email allowlist per spec § 4.1 ("payment due soon → email").
--        • ai_guard_alert  → every other guard template the snapshot can
--          honestly source today (GRD-02 statutory deadline, GRD-05 over
--          budget). In-app only — spec § 4.1 keeps non-payment guards out of
--          the interrupt channels.
--   2. setnayan_ai_guard_log — the PERSISTENT dedup/cooldown state the spec's
--      restraint engine requires (§ 4.2 "one notification per dedupe key per
--      cooldown window; never the same alert twice"). One row per
--      (event, dedupe_key); `notified_at` is the cooldown clock. The reserved
--      dedupe_key '__sweep__' throttles the lazy sweep itself (the cron-free
--      invocation — lib/setnayan-ai-notify.ts).
--
-- Adding the enum values does NOT use them in this migration (transaction-safe
-- on PG12+); the emitting code fails soft until this is applied.
-- ============================================================================

ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ai_payment_due';
ALTER TYPE public.notification_type ADD VALUE IF NOT EXISTS 'ai_guard_alert';

CREATE TABLE IF NOT EXISTS public.setnayan_ai_guard_log (
  -- Internal plumbing table (no public surface) → hidden bigserial only, no
  -- public_id (the S89… generator is for entities that leave the backend).
  id           BIGSERIAL PRIMARY KEY,
  event_id     UUID NOT NULL REFERENCES public.events(event_id) ON DELETE CASCADE,
  -- The trigger engine's stable Intervention.dedupeKey (e.g.
  -- 'GRD-01:Bloom Florals:2026-02-01'), or the reserved '__sweep__' throttle
  -- row, or a '<dedupeKey>#d1' marker for the Resend scheduledAt day-before
  -- payment email (stamped once so a re-sweep never double-schedules it).
  dedupe_key   TEXT NOT NULL,
  template_id  TEXT NOT NULL,
  notified_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (event_id, dedupe_key)
);

COMMENT ON TABLE public.setnayan_ai_guard_log IS
  'Setnayan AI guard-notification dedup/cooldown state (restraint engine § 4.2 of Setnayan_AI_Realtime_Notifications_2026-07-02). One row per (event, dedupe_key); notified_at is the cooldown clock. Reserved dedupe_key __sweep__ throttles the lazy sweep. Service-role write-only; couple read-own via RLS.';

CREATE INDEX IF NOT EXISTS setnayan_ai_guard_log_event_notified_idx
  ON public.setnayan_ai_guard_log (event_id, notified_at DESC);

ALTER TABLE public.setnayan_ai_guard_log ENABLE ROW LEVEL SECURITY;

-- Couple reads only their own event's rows (canonical event-scoped pattern —
-- lets a future "why did/didn't Suri ping me?" surface render without service
-- role). Writes are service-role ONLY (the sweep runs on the admin client);
-- deliberately NO authenticated INSERT/UPDATE policy — a couple must not be
-- able to fabricate or reset their own cooldowns.
DROP POLICY IF EXISTS couple_reads_setnayan_ai_guard_log ON public.setnayan_ai_guard_log;
CREATE POLICY couple_reads_setnayan_ai_guard_log ON public.setnayan_ai_guard_log
  FOR SELECT TO authenticated
  USING (event_id IN (SELECT public.current_event_ids()));

-- Admin read for ops debugging (canonical is_admin() helper).
DROP POLICY IF EXISTS admin_reads_setnayan_ai_guard_log ON public.setnayan_ai_guard_log;
CREATE POLICY admin_reads_setnayan_ai_guard_log ON public.setnayan_ai_guard_log
  FOR SELECT TO authenticated
  USING (public.is_admin());
