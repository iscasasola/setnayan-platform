-- ============================================================================
-- DELETING A CELEBRATION NOW SEVERS ITS CONNECTIONS.
--
-- Owner, 2026-08-20, after deleting his own event and finding what stayed:
--   "it should remove all connections to that event. Inquiries, payments, etc."
--
-- Most children already cascade. But TEN foreign keys are ON DELETE SET NULL —
-- verified in production by the object, not from a file:
--   chat_message_flags · concierge_unanswered_questions · creator_chapters ·
--   guest_saved_vendors · live_studio_roam_channel_pool · orders ·
--   person_connections · vendor_date_waitlist · vendor_profile_views ·
--   vendor_reuse_requests
-- Their rows SURVIVE with a null event_id. That was the right design while only
-- an admin could delete an event. It is the wrong one now that a couple can.
--
-- The owner's own delete left exactly this: order S89O-GCR6BDC4Z6, PHP 499,
-- unpaid, sitting in the admin payment queue with nothing to tie it to.
--
-- ── WHY A TRIGGER AND NOT THE SERVER ACTION ─────────────────────────────────
-- There are SIX event-delete call sites in app code, and a SEVENTH with no
-- server action at all: RLS policy `couple_can_delete_event` lets a couple
-- DELETE straight through PostgREST. Measured in prod today:
--   has_table_privilege('authenticated','public.events','DELETE') = TRUE
-- So cleanup written in `deleteOwnEvent` would be skipped by a path that
-- already exists. `20271138150255` put the address hold here for exactly this
-- reason and said so: "the hold moves into the database, so no path present or
-- future can miss it, including one nobody has written yet."
--
-- ⚠ BEFORE, NOT AFTER. An FK SET NULL fires as an internal AFTER-delete action,
-- so only a BEFORE trigger can still see `orders.event_id`,
-- `vendor_date_waitlist.event_id` and `checked_out_event_id` populated. After
-- the delete there is no key left to search on.
--
-- ── WHAT THIS DELIBERATELY DOES **NOT** TOUCH ───────────────────────────────
--  · the `event_closed` slug hold — owner-locked; a printed save-the-date QR
--    must not later land a guest on a stranger's wedding.
--  · `person_connections` — a christening creates a ninong relationship that
--    outlives the christening. Deleting one must not un-godparent anybody.
--  · `guest_saved_vendors` · `vendor_profile_views` — a GUEST's bookmark and a
--    supplier's own metrics. Not the couple's records to destroy.
--  · `creator_chapters` the row — somebody else's published writing. Only the
--    stale pointer inside its JSONB is cleared.
--  · anything with a receipt or a payment — `deleteOwnEvent` refuses those
--    events outright, so they never reach this trigger.
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sever_event_connections()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_label text;
BEGIN
  -- Written into admin_notes so an operator meeting a cancelled bill can tell
  -- WHY. Never into `description` — that column is NOT NULL, CHECK'd at 2000
  -- chars, and is the bill's own money text.
  v_label := 'Cancelled ' || to_char(now() AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD')
             || ': the celebration this was bought for ('
             || coalesce(nullif(trim(OLD.display_name), ''), 'untitled')
             || ') was removed by its organiser.';

  -- ── 1 · UNPAID BILLS ARE CANCELLED, NEVER DELETED ────────────────────────
  -- `REVOKE DELETE ON public.orders` is already in force and the repo's own
  -- ruling is "Cancel is the supported verb; delete never was." Deleting would
  -- also be REFUSED outright by order_refunds.order_id ON DELETE RESTRICT, and
  -- would cascade away payments/receipts/order_ledger.
  --
  -- Constrained to the three pre-payment states: `paid`/`fulfilled`/`refunded`/
  -- `lapsed` cannot appear here (deleteOwnEvent refuses such an event), and if
  -- one ever did, this must not quietly rewrite it.
  UPDATE public.orders
     SET status      = 'cancelled',
         admin_notes = coalesce(admin_notes || E'\n', '') || v_label,
         updated_at  = now()
   WHERE event_id = OLD.event_id
     AND status IN ('draft', 'submitted', 'awaiting_payment');

  -- ── 2 · THE WAITLIST STOPS WAITING ───────────────────────────────────────
  -- 🚨 THE ONLY LEFTOVER THAT REACHES OUT AND CONTACTS A PERSON. When the date
  -- frees, the supplier's waitlist emails whoever is queued — "a slot opened" —
  -- for a celebration that no longer exists. It also spends one of that
  -- supplier's tier-capped acceptances on a ghost.
  --
  -- `accepted_at` is cleared too, or the freed date stays consumed forever.
  -- 'cancelled' is a legal couple-side state and does not block a re-join: the
  -- uniqueness index only covers status IN ('pending','notified').
  UPDATE public.vendor_date_waitlist
     SET status      = 'cancelled',
         accepted_at = NULL
   WHERE event_id = OLD.event_id
     AND status <> 'cancelled';

  -- ── 3 · SETNAYAN'S OWN CHANNEL COMES BACK ────────────────────────────────
  -- The row is Setnayan inventory, not the couple's — released, never deleted
  -- (deleting cascades live_studio_channel_grants, which holds an OAuth refresh
  -- token). The automatic return searches by event id, so after the SET NULL it
  -- could never find this row again: a forward primitive with no inverse.
  UPDATE public.live_studio_roam_channel_pool
     SET status                = 'available',
         checked_out_event_id  = NULL,
         checked_out_at        = NULL
   WHERE checked_out_event_id = OLD.event_id;

  -- ── 4 · THE SUPPLIER'S BELL STOPS POINTING AT A 404 ──────────────────────
  -- `notifications` has neither an event_id nor a thread_id column, so nothing
  -- can cascade it: the supplier keeps "New booking inquiry" — with up to 200
  -- characters of the couple's own message — forever, and tapping it 404s.
  --
  -- Matched on the EXACT thread id in related_url. Never on the title or body
  -- (display_name is not unique), and never on a LIKE over the event id (that
  -- would sweep order and payment notifications too). The threads still exist
  -- at BEFORE-delete time, which is the only reason this can be done at all.
  DELETE FROM public.notifications n
   WHERE EXISTS (
     SELECT 1 FROM public.chat_threads t
      WHERE t.event_id = OLD.event_id
        AND n.related_url LIKE '%' || t.thread_id::text || '%'
   );

  -- ── 5 · A PUBLISHED CHAPTER STOPS PROMISING A GALLERY THAT IS GONE ───────
  -- The proper column is SET NULL, but `substrate` keeps a duplicate copy that
  -- no foreign key can reach, and the public chapter page falls back to it —
  -- still telling strangers "a Papic gallery sits behind this chapter" when
  -- every photo is gone. The chapter itself is somebody's published writing and
  -- is KEPT; only the stale pointers go.
  UPDATE public.creator_chapters
     SET substrate = (substrate - 'papic_gallery_id') - 'vendor_ids'
   WHERE event_id = OLD.event_id
     AND substrate IS NOT NULL
     AND (substrate ? 'papic_gallery_id' OR substrate ? 'vendor_ids');

  -- ── 6 · FREE TEXT THE COUPLE TYPED, WITH NOWHERE TO BE READ ──────────────
  -- No screen reads this table, it has zero RLS policies, and it is absent from
  -- the erasure map. It is the couple's own words about their own event; when
  -- the event goes, so do they.
  DELETE FROM public.concierge_unanswered_questions
   WHERE event_id = OLD.event_id;

  RETURN OLD;
END;
$function$;

COMMENT ON FUNCTION public.sever_event_connections() IS
  'BEFORE DELETE on events: cancels unpaid orders and waitlist entries, returns '
  'the Live Studio channel, clears stranded inquiry notifications and chapter '
  'gallery pointers, removes concierge questions. Deliberately does NOT touch '
  'the event_closed slug hold, person_connections, guest_saved_vendors, '
  'vendor_profile_views, or the creator_chapters row itself.';

-- 🔒 REVOKED, NOT BASELINED. `anon-rpc-surface.db.test.ts` fires on any new
-- anon-callable SECURITY DEFINER function, and it is right to: this one cancels
-- orders and deletes rows as the table owner. A trigger function needs NO direct
-- grant — it is invoked by the trigger, never called by a client — so the answer
-- is to close the door, not to write a line in the baseline excusing it. The
-- address-hold trigger three migrations back does exactly this, for this reason.
REVOKE ALL ON FUNCTION public.sever_event_connections() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sever_event_connections() FROM anon, authenticated;

DROP TRIGGER IF EXISTS events_sever_connections_on_delete ON public.events;
CREATE TRIGGER events_sever_connections_on_delete
  BEFORE DELETE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.sever_event_connections();

COMMIT;
