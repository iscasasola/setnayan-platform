/**
 * Event-scoped queries.
 *
 * Two access modes after 0000:
 *   - URL-scoped: /dashboard/[event_id]/...  uses getEventByIdForUser()
 *   - Picker:     /dashboard                  uses listCoupleEventsForUser()
 *
 * The legacy single-event helper getCurrentEvent() now returns the user's
 * primary (or fallback first active) event, used only by routes that haven't
 * migrated under [event_id]/ yet plus the welcome state.
 */

import { createClient } from "@/lib/supabase/server";
import type { Event, EventCard } from "./types";

const EVENT_SELECT =
  "event_id, slug, couple_user_id_1, couple_user_id_2, " +
  "bride_first_name, bride_last_name, groom_first_name, groom_last_name, " +
  "event_date, ceremony_type, ceremony_venue, reception_venue, " +
  "guest_count_estimate, status, tier, monogram_svg, rsvp_deadline, " +
  "photos_released_at, " +
  "paparazzi_tier, gallery_review_window_days, " +
  "gallery_public_unlocked_at, hot_retention_days, custom_monogram_unlocked, " +
  "is_primary, archived, event_type, " +
  "created_at, updated_at";

/**
 * The user's primary event (or oldest non-archived fallback). Returns null
 * for unauthenticated users or users without any couple membership.
 *
 * Existing flat routes (/dashboard, /dashboard/guests, /dashboard/qr-codes,
 * /dashboard/gallery) call this. Once those move under /dashboard/[event_id]/
 * they should use getEventByIdForUser() instead.
 */
export async function getCurrentEvent(): Promise<Event | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("archived", false)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getCurrentEvent]", error.message);
    return null;
  }
  return (data as unknown as Event) ?? null;
}

/**
 * Read a specific event the calling user is a couple-member of. Returns null
 * if the event doesn't exist OR the user isn't a couple of it (RLS prevents
 * leaking the existence of events the user has no access to).
 */
export async function getEventByIdForUser(eventId: string): Promise<Event | null> {
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return null;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SELECT)
    .eq("event_id", eventId)
    .maybeSingle();

  if (error) {
    console.error("[getEventByIdForUser]", error.message);
    return null;
  }
  return (data as unknown as Event) ?? null;
}

/**
 * Pick-one-of-many: the events this user is a couple of. Used by the
 * /dashboard event picker. Sorted: primary first, then oldest first.
 * Excludes archived events; pass includeArchived=true for the picker's
 * collapsed "Archived" section.
 */
export async function listCoupleEventsForUser({
  includeArchived = false,
}: { includeArchived?: boolean } = {}): Promise<EventCard[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  let query = supabase
    .from("event_members")
    .select(
      "member_type, joined_at, " +
        "events:event_id ( event_id, slug, bride_first_name, groom_first_name, " +
        "event_date, is_primary, archived, guest_count_estimate )",
    )
    .eq("user_id", user.id)
    .eq("member_type", "couple");

  if (!includeArchived) {
    // No direct way to filter on a joined table; we'll filter client-side.
  }

  const { data, error } = await query;
  if (error) {
    console.error("[listCoupleEventsForUser]", error.message);
    return [];
  }

  type Row = {
    member_type: "couple" | "guest" | "vendor";
    events: {
      event_id: string;
      slug: string;
      bride_first_name: string;
      groom_first_name: string;
      event_date: string;
      is_primary: boolean;
      archived: boolean;
      guest_count_estimate: number | null;
    } | null;
  };

  const rows = ((data as unknown as Row[]) ?? []).filter(
    (r) => r.events && (includeArchived || !r.events.archived),
  ) as Array<Row & { events: NonNullable<Row["events"]> }>;

  return rows
    .map<EventCard>((r) => ({
      event_id: r.events.event_id,
      slug: r.events.slug,
      bride_first_name: r.events.bride_first_name,
      groom_first_name: r.events.groom_first_name,
      event_date: r.events.event_date,
      is_primary: r.events.is_primary,
      archived: r.events.archived,
      guest_count_estimate: r.events.guest_count_estimate,
      member_type: r.member_type,
    }))
    .sort((a, b) => {
      if (a.archived !== b.archived) return a.archived ? 1 : -1;
      if (a.is_primary !== b.is_primary) return a.is_primary ? -1 : 1;
      return a.event_date.localeCompare(b.event_date);
    });
}

/**
 * Verify the calling user is a couple-member of the given event. Used by
 * server actions before privileged writes. Throws if not — server actions
 * surface that as a generic "no access" error to clients.
 */
export async function ensureEventCoupleMembership(eventId: string): Promise<{
  user_id: string;
}> {
  const event = await getEventByIdForUser(eventId);
  if (!event) throw new Error("No access to this event.");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No access to this event.");
  return { user_id: user.id };
}
