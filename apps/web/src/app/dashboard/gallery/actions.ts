"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEvent } from "@/lib/db/events";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function ensureEvent() {
  const event = await getCurrentEvent();
  if (!event) throw new Error("No event for the current user.");
  return event;
}

/**
 * Bulk hide captures from the public gallery during the couple's review window.
 * Hidden captures stay visible to the couple in this dashboard — they're just
 * suppressed from the public guest view.
 */
export async function bulkHideCapturesAction(
  captureIds: readonly string[],
  reason?: string,
): Promise<ActionResult<{ hidden: number }>> {
  if (captureIds.length === 0) return { ok: true, data: { hidden: 0 } };
  const event = await ensureEvent();
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("captures")
    .update(
      { hidden_by_couple_at: new Date().toISOString(), hidden_reason: reason ?? null },
      { count: "exact" },
    )
    .eq("event_id", event.event_id)
    .in("capture_id", captureIds as string[])
    .is("hidden_by_couple_at", null)
    .select("capture_id");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/gallery");
  return { ok: true, data: { hidden: count ?? 0 } };
}

export async function bulkUnhideCapturesAction(
  captureIds: readonly string[],
): Promise<ActionResult<{ unhidden: number }>> {
  if (captureIds.length === 0) return { ok: true, data: { unhidden: 0 } };
  const event = await ensureEvent();
  const supabase = await createClient();

  const { error, count } = await supabase
    .from("captures")
    .update({ hidden_by_couple_at: null, hidden_reason: null }, { count: "exact" })
    .eq("event_id", event.event_id)
    .in("capture_id", captureIds as string[])
    .not("hidden_by_couple_at", "is", null)
    .select("capture_id");

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/gallery");
  return { ok: true, data: { unhidden: count ?? 0 } };
}

/**
 * Release the gallery to the public early — sets gallery_public_unlocked_at to
 * NOW() so the 7-day countdown stops. Once set, public guests can view the
 * gallery on the landing page.
 */
export async function releaseGalleryEarlyAction(): Promise<ActionResult> {
  const event = await ensureEvent();
  const supabase = await createClient();

  const { error } = await supabase
    .from("events")
    .update({ gallery_public_unlocked_at: new Date().toISOString() })
    .eq("event_id", event.event_id)
    .is("gallery_public_unlocked_at", null);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/gallery");
  return { ok: true };
}

/**
 * Extend the review window by N days (default 1). No-op if the gallery has
 * already been unlocked or N is non-positive.
 */
export async function extendReviewWindowAction(extraDays = 1): Promise<ActionResult> {
  if (!Number.isFinite(extraDays) || extraDays <= 0) {
    return { ok: false, error: "extraDays must be positive" };
  }
  const event = await ensureEvent();
  if (event.gallery_public_unlocked_at) {
    return { ok: false, error: "Gallery already publicly unlocked" };
  }
  const newWindow = Math.min(event.gallery_review_window_days + extraDays, 14);
  const supabase = await createClient();

  const { error } = await supabase
    .from("events")
    .update({ gallery_review_window_days: newWindow })
    .eq("event_id", event.event_id);

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/gallery");
  return { ok: true };
}

/**
 * Regenerate a paparazzi seat's claim_qr_token. Used when a paparazzo loses
 * their phone before the event and needs a fresh claim QR. The old token is
 * immediately invalidated; this iteration's spec reserves the same flow for
 * the support dashboard, but couples can also self-serve here.
 */
export async function regenerateSeatTokenAction(
  seatId: string,
): Promise<ActionResult<{ claim_qr_token: string }>> {
  const event = await ensureEvent();
  const supabase = await createClient();

  // 16 random bytes hex-encoded — matches the column DEFAULT.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  const token = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");

  const { data, error } = await supabase
    .from("paparazzi_seats")
    .update({
      claim_qr_token: token,
      claimer_user_id: null,
      claimed_at: null,
      device_platform: null,
      device_app_build: null,
    })
    .eq("seat_id", seatId)
    .eq("event_id", event.event_id)
    .select("claim_qr_token")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/gallery");
  return { ok: true, data: { claim_qr_token: data!.claim_qr_token as string } };
}
