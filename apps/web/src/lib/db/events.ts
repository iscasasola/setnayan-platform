/**
 * Event-scoped queries. RLS automatically filters to the calling user's events.
 * V1 assumption: each user has at most one event. We pick the most recent.
 */

import { createClient } from "@/lib/supabase/server";
import type { Event } from "./types";

/**
 * Get the current user's event. Returns null if the user is not authenticated
 * or has no event yet.
 */
export async function getCurrentEvent(): Promise<Event | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("events")
    .select(
      "event_id, slug, couple_user_id_1, couple_user_id_2, " +
        "bride_first_name, bride_last_name, groom_first_name, groom_last_name, " +
        "event_date, ceremony_type, ceremony_venue, reception_venue, " +
        "guest_count_estimate, status, tier, monogram_svg, rsvp_deadline, " +
        "photos_released_at, " +
        "paparazzi_tier, gallery_review_window_days, " +
        "gallery_public_unlocked_at, hot_retention_days, custom_monogram_unlocked, " +
        "created_at, updated_at",
    )
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("[getCurrentEvent]", error.message);
    return null;
  }
  return (data as unknown as Event) ?? null;
}
