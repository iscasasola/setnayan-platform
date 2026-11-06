import 'server-only';

import { createAdminClient } from '@/lib/supabase/admin';
import { getDayOfPhase } from '@/lib/day-of-mode';
import { eventTimezoneFromCoords } from '@/lib/event-timezone.server';
import { getLifecyclePhase, manualLaunchPhase } from '@/lib/invitation-widgets';
import { resolveEffectiveVisibility } from '@/lib/launch-save-the-date';
import { openToStrangers } from '@/lib/event-visibility';
import { rememberedLiveRead } from '@/lib/live-day-cache';
import { onlyWhatGuestsMaySee } from '@/lib/schedule';
import { guestsMaySeeSeatsFor } from '@/lib/guests-may-see-seats';
import { PULSE_GUEST_WINDOW_MS, PULSE_SHARED_SECONDS, type PulseAnswer } from '@/lib/event-pulse';
import { guestPulseKey, pulseFromRows } from '@/lib/event-pulse-stamp';

/**
 * event-pulse.server.ts — "HAS ANYTHING CHANGED?", ANSWERED ONCE PER EVENT (2026-10-18, live-day polling).
 *
 * 🧯 WHY. On the day, the guest hub, the seat page, find-my-table and find-seat each re-ran their WHOLE server render
 * every 45 s on every open phone (`router.refresh()`), to catch a reseat or an advance that almost never came. Measured
 * in the lab: ~32 database reads per refresh, so a hub left open was ~35 reads a minute per guest — and the answer was
 * "nothing changed" nearly every time. Now a phone asks this small question instead, and re-renders only when the
 * answer moves.
 *
 * THE ANSWER (`PulseAnswer`, lib/event-pulse.ts):
 *   · `v` — one short stamp over everything about the EVENT those pages draw and that can change while it is live:
 *     the event row (stage pin, watch links, wall switch, visibility, venue…) with the day-of phase and lifecycle
 *     stage its clock gives (so crossing into "after" moves it too), the guests' schedule rows (an advance), the seat
 *     plan (assignments + tables + its published flag) and the hero row that holds "What guests see".
 *   · `g` — per GUEST, the moment something of theirs changed in the last few minutes: an arrival (`guest_checkins`)
 *     or a photo tag (`photo_tags`). Keyed by `guestPulseKey` — a one-way hash, never a guest id — so a phone learns
 *     only that ITS OWN key moved. These two churn all evening, which is exactly why they are per guest: folded into
 *     `v` they would re-render every phone at every arrival.
 *
 * 🔑 IT IS ONE ANSWER PER EVENT: read with the service client, remembered for `LIVE_DAY_SECONDS`
 * (`rememberedLiveRead`), so 200 phones asking every ~12 s are ONE set of these reads per event per `PULSE_SHARED_SECONDS`. The pages
 * also take their starting stamp from here (`pulseBaseline`), from the same remembered answer.
 *
 * ⚠ WHAT IT DOES NOT WATCH, ON PURPOSE (each re-renders at the next change that IS watched, or when the phone comes
 * back after `PULSE_AWAY_MS` away): a purchase made during the event (Papic, the roll camera), a newly added e-gift
 * destination or venue booking, a published album. All rare, all host actions — not worth a read every 10 s each.
 *
 * ⛔ A REFUSED READ THROWS (nothing remembered); the route answers 503 and a phone that misses three answers in a row
 * falls back to one full refresh (lib/use-event-pulse.ts) — a broken pulse must never freeze a page silently.
 */

export type EventPulse = PulseAnswer & {
  eventId: string;
  /** The event's effective visibility — the route decides from it whether the answer may be cached for strangers. */
  visibility: string;
  openToStrangers: boolean;
};

export { guestPulseKey };

const SCHEMA_MISSING = new Set(['42P01', '42703', 'PGRST205', 'PGRST204']);

/** A read that answered → its rows; a table/column this install lacks → 'absent' (stable); anything else throws. */
function rowsOf<T>(label: string, res: { data: T | null; error: { code?: string; message?: string } | null }): T | 'absent' {
  if (res.error) {
    if (res.error.code && SCHEMA_MISSING.has(res.error.code)) return 'absent';
    throw new Error(`event pulse: ${label} did not answer (${res.error.code ?? ''} ${res.error.message ?? ''})`);
  }
  return (res.data ?? null) as T;
}

async function readPulse(slug: string): Promise<EventPulse | null> {
  const admin = createAdminClient();
  const eventRes = await admin.from('events').select('*').ilike('slug', slug).maybeSingle();
  const event = rowsOf<Record<string, unknown>>('events', eventRes);
  if (event === 'absent') throw new Error('event pulse: events unreadable');
  if (!event) return null;
  const eventId = String(event.event_id);

  const since = new Date(Date.now() - PULSE_GUEST_WINDOW_MS).toISOString();
  const [blocks, seats, tables, seatsShown, hero, arrivals, tags] = await Promise.all([
    // 🔒 The guests' fence — the stamp moves only for lines a guest may see (lib/schedule.ts).
    onlyWhatGuestsMaySee(admin.from('event_schedule_blocks').select('*').eq('event_id', eventId)),
    admin.from('event_seat_assignments').select('*').eq('event_id', eventId),
    admin.from('event_tables').select('*').eq('event_id', eventId),
    // 🪑 The ONE seat rule, not the floor plan's flag by hand (lib/guests-may-see-seats.ts) — a refused read throws.
    guestsMaySeeSeatsFor(admin, eventId, { throwOnReadError: true }),
    admin.from('invitation_widgets').select('widget_type, config_json').eq('event_id', eventId).eq('widget_type', 'hero'),
    admin.from('guest_checkins').select('guest_id, checked_in_at').eq('event_id', eventId).gte('checked_in_at', since).limit(2000),
    admin
      .from('photo_tags')
      .select('guest_id, created_at, removed_at')
      .eq('event_id', eventId)
      .or(`created_at.gte.${since},removed_at.gte.${since}`)
      .limit(2000),
  ]);

  const eventDate = (event.event_date as string | null) ?? null;
  const tz = eventTimezoneFromCoords(
    (event.venue_latitude as number | null) ?? null,
    (event.venue_longitude as number | null) ?? null,
  );
  const clock = {
    day: eventDate ? getDayOfPhase(eventDate, tz) : 'inactive',
    stage:
      manualLaunchPhase(event.launch_mode as string | null, event.manual_phase as string | null) ??
      getLifecyclePhase(eventDate, tz, (event.event_end_date as string | null) ?? null, undefined, (event.std_invitation_launch_date as string | null) ?? null),
  };
  const { v, g } = pulseFromRows({
    event,
    clock,
    blocks: rowsOf<Record<string, unknown>[]>('schedule', blocks),
    seats: rowsOf<Record<string, unknown>[]>('seat assignments', seats),
    tables: rowsOf<Record<string, unknown>[]>('tables', tables),
    floor: seatsShown,
    hero: rowsOf<unknown>('hero row', hero),
    arrivals: rowsOf<{ guest_id: string; checked_in_at: string | null }[]>('arrivals', arrivals),
    tags: rowsOf<{ guest_id: string; created_at: string | null; removed_at: string | null }[]>('photo tags', tags),
  });

  const visibility = resolveEffectiveVisibility(event as Parameters<typeof resolveEffectiveVisibility>[0]);
  return { eventId, visibility, openToStrangers: openToStrangers(visibility), v, g };
}

/** The event's pulse, remembered per event (`null` — no event has this address). Throws when it could not be read. */
export async function eventPulse(slug: string): Promise<EventPulse | null> {
  const key = slug.toLowerCase();
  return rememberedLiveRead(`event-pulse-v1:${key}`, key, () => readPulse(key), PULSE_SHARED_SECONDS);
}

/**
 * What a page hands its phone to compare against: the stamp the render was drawn under, this guest's key, and when
 * the render began. `null` (the pulse could not be read) → the page keeps the old 45 s refresh, never a frozen page.
 */
export async function pulseBaseline(
  slug: string | null | undefined,
  guest: { eventId: string; guestId: string } | null,
  renderedAt: string,
): Promise<{ v: string; guestKey: string | null; renderedAt: string } | null> {
  if (!slug) return null;
  try {
    const pulse = await eventPulse(slug);
    if (!pulse) return null;
    return { v: pulse.v, guestKey: guest ? guestPulseKey(guest.eventId, guest.guestId) : null, renderedAt };
  } catch {
    return null;
  }
}
