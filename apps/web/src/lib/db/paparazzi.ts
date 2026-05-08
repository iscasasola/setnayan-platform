/**
 * Paparazzi (0012) — couple-side gallery queries.
 *
 * RLS scopes everything to couples of the event. The four V1 gallery filters
 * (chronological, photos_of_us, untagged, type) live here as named fetchers
 * so the dashboard page stays declarative.
 */

import { createClient } from "@/lib/supabase/server";
import type {
  Capture,
  CaptureTag,
  CaptureType,
  CaptureWithTags,
  PaparazziGalleryFilter,
  PaparazziSeat,
} from "./types";

const CAPTURE_SELECT = `
  capture_id, event_id, paparazzi_seat_id,
  type, duration_seconds, flash_used, orientation,
  client_capture_id, captured_at, uploaded_at,
  r2_object_key, r2_thumbnail_key,
  width_px, height_px, byte_size,
  moderation_status, nsfw_score,
  hidden_by_couple_at, hidden_reason,
  favorite_of_couple, tags_count,
  created_at, updated_at
`;

export interface CoupleGalleryQuery {
  eventId: string;
  filter: PaparazziGalleryFilter;
  /** Required when filter === "photos_of_us" — the couple's two guest_ids. */
  coupleGuestIds?: readonly string[];
  /** Required when filter === "type" and you want to narrow. Omit for "all". */
  typeNarrow?: CaptureType | "all";
  includeHidden?: boolean;
  limit?: number;
  /** ISO timestamp; pages descend by captured_at. */
  cursor?: string | null;
}

export interface CoupleGalleryPage {
  captures: CaptureWithTags[];
  nextCursor: string | null;
}

/**
 * Single entry point for the couple-side gallery. Always sorts by captured_at
 * descending — the spec is firm that out-of-order uploads (from offline queues)
 * still appear chronologically by camera time.
 */
export async function fetchCoupleGalleryPage(
  q: CoupleGalleryQuery,
): Promise<CoupleGalleryPage> {
  const supabase = await createClient();
  const limit = Math.min(Math.max(q.limit ?? 60, 1), 200);

  let query = supabase
    .from("captures")
    .select(CAPTURE_SELECT)
    .eq("event_id", q.eventId)
    .order("captured_at", { ascending: false })
    .limit(limit + 1);

  if (!q.includeHidden) {
    query = query.is("hidden_by_couple_at", null);
  }
  if (q.cursor) {
    query = query.lt("captured_at", q.cursor);
  }

  if (q.filter === "untagged") {
    query = query.eq("tags_count", 0);
  } else if (q.filter === "type") {
    if (q.typeNarrow && q.typeNarrow !== "all") {
      query = query.eq("type", q.typeNarrow);
    }
  } else if (q.filter === "photos_of_us") {
    if (!q.coupleGuestIds || q.coupleGuestIds.length === 0) {
      return { captures: [], nextCursor: null };
    }
    const { data: tagRows, error: tagErr } = await supabase
      .from("capture_tags")
      .select("capture_id")
      .in("guest_id", q.coupleGuestIds as string[]);
    if (tagErr) {
      console.error("[fetchCoupleGalleryPage couple-tags]", tagErr.message);
      return { captures: [], nextCursor: null };
    }
    const ids = Array.from(new Set((tagRows ?? []).map((r) => r.capture_id as string)));
    if (ids.length === 0) return { captures: [], nextCursor: null };
    query = query.in("capture_id", ids);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[fetchCoupleGalleryPage]", error.message);
    return { captures: [], nextCursor: null };
  }

  const rows = (data as Capture[]) ?? [];
  const hasMore = rows.length > limit;
  const visible = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && visible.length > 0 ? visible[visible.length - 1]!.captured_at : null;

  const captureIds = visible.map((c) => c.capture_id);
  const tagsByCapture = new Map<string, string[]>();
  if (captureIds.length > 0) {
    const { data: tagRows, error: tagErr } = await supabase
      .from("capture_tags")
      .select("capture_id, guest_id")
      .in("capture_id", captureIds);
    if (tagErr) {
      console.error("[fetchCoupleGalleryPage tags]", tagErr.message);
    } else {
      for (const t of (tagRows as Pick<CaptureTag, "capture_id" | "guest_id">[]) ?? []) {
        const list = tagsByCapture.get(t.capture_id) ?? [];
        list.push(t.guest_id);
        tagsByCapture.set(t.capture_id, list);
      }
    }
  }

  const captures: CaptureWithTags[] = visible.map((c) => ({
    ...c,
    tagged_guest_ids: tagsByCapture.get(c.capture_id) ?? [],
  }));

  return { captures, nextCursor };
}

export interface GallerySummary {
  total: number;
  photos: number;
  clips: number;
  untagged: number;
  hidden: number;
  pendingModeration: number;
  flagged: number;
}

export async function fetchGallerySummary(eventId: string): Promise<GallerySummary> {
  const supabase = await createClient();

  const counts = (await Promise.all([
    supabase
      .from("captures")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .is("hidden_by_couple_at", null),
    supabase
      .from("captures")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("type", "photo")
      .is("hidden_by_couple_at", null),
    supabase
      .from("captures")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("type", "clip")
      .is("hidden_by_couple_at", null),
    supabase
      .from("captures")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("tags_count", 0)
      .is("hidden_by_couple_at", null),
    supabase
      .from("captures")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .not("hidden_by_couple_at", "is", null),
    supabase
      .from("captures")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("moderation_status", "pending"),
    supabase
      .from("captures")
      .select("*", { count: "exact", head: true })
      .eq("event_id", eventId)
      .eq("moderation_status", "flagged"),
  ])) as Array<{ count: number | null; error: { message: string } | null }>;

  const [total, photos, clips, untagged, hidden, pending, flagged] = counts;
  if (total?.error) console.error("[fetchGallerySummary total]", total.error.message);

  return {
    total: total?.count ?? 0,
    photos: photos?.count ?? 0,
    clips: clips?.count ?? 0,
    untagged: untagged?.count ?? 0,
    hidden: hidden?.count ?? 0,
    pendingModeration: pending?.count ?? 0,
    flagged: flagged?.count ?? 0,
  };
}

export async function fetchSeatsForEvent(eventId: string): Promise<PaparazziSeat[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("paparazzi_seats")
    .select(
      "seat_id, event_id, seat_index, role_label, claim_qr_token, " +
        "claimer_user_id, claimer_label, claimed_at, device_platform, device_app_build, " +
        "last_seen_at, battery_pct_last, handed_off_to_seat_id, revoked_at, " +
        "created_at, updated_at",
    )
    .eq("event_id", eventId)
    .is("revoked_at", null)
    .order("seat_index", { ascending: true });
  if (error) {
    console.error("[fetchSeatsForEvent]", error.message);
    return [];
  }
  return (data as unknown as PaparazziSeat[]) ?? [];
}

/**
 * The two couple guest_ids — the rows on the guests table where role marks the
 * couple. V1 doesn't yet have a 'couple' role enum value, so we infer via the
 * couple_user_id_{1,2} fields on the event matched against any guest row whose
 * email might map. Fallback: empty list — "photos_of_us" will simply return [].
 */
export async function fetchCoupleGuestIds(eventId: string): Promise<string[]> {
  const supabase = await createClient();
  // Heuristic: in V1, the couple typically has guest rows with role='guest'
  // and side='both'. This is best-effort until 0001 introduces an explicit
  // couple-self guest row marker.
  const { data, error } = await supabase
    .from("guests")
    .select("guest_id")
    .eq("event_id", eventId)
    .eq("side", "both")
    .eq("role", "guest")
    .is("deleted_at", null)
    .is("plus_one_of_guest_id", null)
    .limit(2);
  if (error) {
    console.error("[fetchCoupleGuestIds]", error.message);
    return [];
  }
  return ((data as { guest_id: string }[]) ?? []).map((g) => g.guest_id);
}

/**
 * Days remaining in the couple's private review window. Returns null if the
 * gallery has already been publicly unlocked or the event hasn't happened yet
 * (no review countdown to show).
 */
export function reviewWindowDaysLeft(
  event: {
    event_date: string;
    gallery_review_window_days: number;
    gallery_public_unlocked_at: string | null;
  },
  now: Date = new Date(),
): { daysLeft: number; hoursLeft: number; unlocksAt: Date } | null {
  if (event.gallery_public_unlocked_at) return null;
  const eventEnd = new Date(`${event.event_date}T23:59:59`);
  if (now < eventEnd) return null;
  const unlocksAt = new Date(eventEnd.getTime());
  unlocksAt.setDate(unlocksAt.getDate() + event.gallery_review_window_days);
  const msLeft = unlocksAt.getTime() - now.getTime();
  if (msLeft <= 0) return { daysLeft: 0, hoursLeft: 0, unlocksAt };
  const daysLeft = Math.floor(msLeft / 86_400_000);
  const hoursLeft = Math.floor((msLeft % 86_400_000) / 3_600_000);
  return { daysLeft, hoursLeft, unlocksAt };
}
