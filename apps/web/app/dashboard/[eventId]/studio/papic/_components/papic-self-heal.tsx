import { eventEntitlementClient } from '@/lib/event-entitlement-client.server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';
import { resolveStoredWindow } from '@/lib/papic-window';
import { provisionFreeCamerasAdmin, provisionUploadsCameraAdmin } from '@/lib/papic-cameras';
import { ensureFreePapicPoolGrantAdmin } from '@/lib/papic-free-grant';
import { papicIsOn } from '@/lib/event-answers';
import {
  countLimitedGuests,
  fetchActiveLimitedSnapshot,
  reconcileLimitedSnapshot,
  syncGuestCameras,
} from '@/lib/papic-limited';

/**
 * papic-self-heal.tsx — THE PAPIC PAGE'S SELF-HEALS, MOVED WITH ITS CARD TO HOME (the page was removed 2026-10-26;
 * owner: *"that papic frame with toggle, place that on home and remove that page"*). Draws nothing.
 *
 * The page ran four idempotent, best-effort writes on every couple's visit, and they were the BACKSTOP for writes
 * event creation makes: the three free cameras (seats 100..102 — without them the free allowance has no seats to
 * meter), the free pool grant (without it `papic_reserve_event_points` takes its "fence absent → allow" branch and
 * capture runs UNMETERED), the couple's Uploads camera (seat 150), and the guest-camera snapshot sync (a couple who
 * paid for guest cameras keeps them in step with late RSVPs). Removing the page without moving these would have
 * removed the backstop silently.
 *
 * ⛔ SERVICE-ROLE WRITES, SO THE ORDER IS THE PAGE'S: the host-only entitlement check FIRST (it refuses a visitor who
 * is not a host — a refusal here writes nothing), and the event row read on the visitor's OWN session, so the event id
 * is the route's and the row is one they may read. Home renders this ONLY inside the couple's Papic card (the viewer's
 * own membership read), streamed behind the card so it never delays Home's first paint.
 *
 * 🗂 The free pool is not armed where the host answered "Photos from your guests? — No" (`papic_on = false`): an off
 * event takes no capture, and arming it would undo the answer (owner 2026-10-02). 🔒 `self-heal-is-unconditional.test.ts`.
 */
export async function PapicSelfHeal({ eventId }: { eventId: string }) {
  try {
    await eventEntitlementClient(eventId);
  } catch {
    return null; // not a host — nothing is written
  }
  const supabase = await createClient();
  const { data: ev, error } = await supabase
    .from('events')
    .select('event_id, event_date, papic_window_start, papic_window_end, papic_on')
    .eq('event_id', eventId)
    .maybeSingle();
  if (error) logQueryError('PapicSelfHeal.event', error, { eventId }, 'graceful_degrade');
  if (!ev) return null;
  const win = resolveStoredWindow({
    windowStart: (ev.papic_window_start as string | null) ?? null,
    windowEnd: (ev.papic_window_end as string | null) ?? null,
    eventDate: (ev.event_date as string | null) ?? null,
  });
  const admin = createAdminClient();
  const answeredNo = !papicIsOn((ev as { papic_on?: unknown }).papic_on);
  try {
    // ⏱ Three different rows, none reads another's, each best-effort — one trip for all three.
    await Promise.all([
      provisionFreeCamerasAdmin(admin, eventId, { validFrom: win.startIso, validUntil: win.endIso }),
      answeredNo ? Promise.resolve() : ensureFreePapicPoolGrantAdmin(admin, eventId),
      provisionUploadsCameraAdmin(admin, eventId, { validFrom: win.startIso, validUntil: win.endIso }),
    ]);
    // The guest-camera snapshot (historical money keeps working): reconcile, then sync cameras if the list moved.
    const snapshot = await fetchActiveLimitedSnapshot(supabase, eventId);
    if (snapshot) {
      const status = await reconcileLimitedSnapshot(admin, snapshot);
      const guests = await countLimitedGuests(supabase, eventId);
      const { count, error: seatsErr } = await supabase
        .from('paparazzi_seats')
        .select('seat_id', { count: 'exact', head: true })
        .eq('event_id', eventId)
        .not('guest_id', 'is', null)
        .is('revoked_at', null);
      if (seatsErr) logQueryError('PapicSelfHeal.guestCameraCount', seatsErr, { event_id: eventId }, 'graceful_degrade');
      // An unread count is not a count of zero — no write is triggered by a read that failed.
      if (!seatsErr && (count ?? 0) !== Math.min(guests, snapshot.camera_cap)) {
        await syncGuestCameras(admin, eventId, { ...snapshot, status });
      }
    }
  } catch {
    // best-effort; the next render retries
  }
  return null;
}
