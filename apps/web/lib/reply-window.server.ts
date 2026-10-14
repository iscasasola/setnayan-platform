import 'server-only';
import { resolveProfile } from '@/lib/event-type-profile';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { replyFaceOf, replyWindow, type ReplyWindow, type ReplyWindowEvent } from '@/lib/reply-window';

/**
 * 📬 THE REPLY WINDOW FOR AN EVENT ROW A WRITER ALREADY HOLDS (lib/reply-window.ts has the rules).
 *
 * A writer (`submitRsvp`, the join door's request, the reminder email) has read the event row for its
 * own reasons; it adds `REPLY_WINDOW_EVENT_COLUMNS` to THAT read — never a second one — and asks here.
 * The venue's zone comes from its coordinates, exactly as the Event Hub page derives it; the type's
 * face (has a Save the Date? solemn?) from its profile, which is remembered across requests.
 */
export async function replyWindowOfRow(
  row: ReplyWindowEvent & { event_type?: string | null; venue_latitude?: number | null; venue_longitude?: number | null },
  nowMs: number = Date.now(),
): Promise<ReplyWindow> {
  const face = replyFaceOf(await resolveProfile((row.event_type ?? '').trim() || 'wedding'));
  return replyWindow(row, nowMs, eventTimezoneFromCoords(row.venue_latitude ?? null, row.venue_longitude ?? null), face);
}
