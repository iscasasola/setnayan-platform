-- ============================================================================
-- 20271238868040_notifications_know_their_event.sql
--
-- `public.notifications` gets an `event_id`.
--
-- WHY: the table has carried `user_id, type, title, body, related_url, read_at,
-- created_at` since iteration 0028 and NOTHING ELSE — so there has never been a
-- way to ask "what happened on THIS wedding". Every consumer that needed it had
-- to match the event's uuid as a SUBSTRING of `related_url`:
--
--   • `sever_event_connections()` (BEFORE DELETE on events) says so in its own
--     comment — "`notifications` has neither an event_id nor a thread_id column,
--     so nothing can cascade it" — and works around it with a LIKE over the
--     THREAD id, explicitly refusing a LIKE over the event id because that
--     "would sweep order and payment notifications too".
--   • Measured 2026-09-22 on production: 100 notification rows, 23 distinct
--     types, and only 21 rows even CONTAIN an event uuid in `related_url`
--     (2 rows have no `related_url` at all). A per-event supplier feed built on
--     string matching would silently miss every row whose link is not
--     event-shaped.
--
-- ⚖ ON DELETE **SET NULL**, DELIBERATELY — NOT CASCADE.
-- CASCADE would change what deleting a wedding does: it would sweep that
-- event's order and payment notifications, which is precisely the outcome
-- `sever_event_connections()` avoided on purpose. SET NULL keeps today's
-- behaviour byte-for-byte (those rows survive, exactly as they do now) and adds
-- the column. Whether a deleted wedding SHOULD take its notifications with it is
-- a product decision, and it is left to the owner rather than smuggled in here.
-- 🔑 SET NULL is also safe on this column because it carries no CHECK — a
-- SET NULL onto a CHECKed column behaves like RESTRICT and blocks the parent
-- DELETE while still claiming SET NULL.
--
-- 🔒 NO GRANT IS NEEDED, AND A COLUMN-LEVEL REVOKE HERE WOULD BE A NO-OP.
-- Measured on production: `anon`, `authenticated`, `postgres` and `service_role`
-- each hold SELECT/INSERT/UPDATE on `public.notifications` at the TABLE level, so
-- a new column inherits those privileges the moment it exists. Reading is still
-- fenced by RLS, which is unchanged and row-level: policy
-- `notifications_recipient_read` restricts SELECT to `user_id = auth.uid()`, and
-- `notifications_recipient_update` the same for UPDATE. There is no INSERT
-- policy, so only the service-role client (the `emitNotification` writer) can
-- create rows. Adding a column changes none of that.
--
-- BACKFILL: derived from `related_url` for historical rows, and ONLY where the
-- uuid is a real event — an unmatched uuid would violate the new FK and the
-- statement would abort. The app derives the same value the same way for new
-- rows (`apps/web/lib/notification-event-id.ts`, unit-tested), so history and
-- new writes agree.
--
-- Idempotent.
-- ============================================================================

BEGIN;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS event_id UUID
    REFERENCES public.events(event_id) ON DELETE SET NULL;

COMMENT ON COLUMN public.notifications.event_id IS
  'The wedding this notice is about, or NULL for account-level notices (a '
  'connection request, a security alert) and for rows whose event has since '
  'been deleted (ON DELETE SET NULL, deliberately not CASCADE — see the '
  'migration header). Written by emitNotification, which derives it from '
  'related_url when a caller does not pass one.';

-- The per-event feed reads "this event, newest first". Partial: account-level
-- notices are never queried this way.
CREATE INDEX IF NOT EXISTS notifications_event_created_idx
  ON public.notifications(event_id, created_at DESC)
  WHERE event_id IS NOT NULL;

-- ── BACKFILL ────────────────────────────────────────────────────────────────
-- `/dashboard/<event uuid>/…` is the only event-scoped link shape the app
-- emits (`/dashboard/people`, `/admin/…` and the bare `/dashboard` are not
-- event-scoped, and a non-uuid first segment cannot match). The EXISTS guard is
-- load-bearing: without it a stale uuid violates the new FK and aborts the
-- whole migration.
UPDATE public.notifications n
   SET event_id = sub.derived
  FROM (
    SELECT notification_id,
           substring(
             related_url
             FROM '^/dashboard/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})(?:[/?#]|$)'
           )::uuid AS derived
      FROM public.notifications
     WHERE event_id IS NULL
       AND related_url ~ '^/dashboard/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}([/?#]|$)'
  ) sub
 WHERE n.notification_id = sub.notification_id
   AND sub.derived IS NOT NULL
   AND EXISTS (SELECT 1 FROM public.events e WHERE e.event_id = sub.derived);

COMMIT;
