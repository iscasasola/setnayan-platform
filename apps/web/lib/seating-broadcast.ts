import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Broadcasts a seating change event on the `seating-changes:{eventId}` channel.
 *
 * Called after any server action that modifies guest→table assignments so that
 * open guest-facing pages (seat-finder, seat-pass) can silently re-read the
 * latest data without a manual refresh.
 *
 * Uses the admin client (service-role key, no RLS) because the channel must be
 * reachable by anonymous guest browsers that have no authenticated session.
 * The payload is intentionally empty — the subscriber calls router.refresh()
 * to re-fetch server-rendered data; no assignment details travel over the wire.
 *
 * Fire-and-forget: callers should `void broadcastSeatingChange(...)` rather than
 * awaiting it. A broadcast failure MUST NOT block or surface to the editor.
 */
export async function broadcastSeatingChange(eventId: string): Promise<void> {
  try {
    const supabase = createAdminClient();
    await supabase
      .channel(`seating-changes:${eventId}`)
      .send({ type: 'broadcast', event: 'assignment_updated', payload: {} });
  } catch {
    // Intentionally swallowed — realtime broadcast is best-effort.
    // Correctness rides on the guest's next manual refresh / page load.
  }
}
