"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createAdminClient } from "@/lib/supabase/admin";
import { clearGuestSessionCookie, readGuestSession } from "@/lib/server/guest-session";
import {
  DANCE_STYLES,
  MEAL_PREFERENCES,
  RSVP_STATUSES,
} from "@/lib/db/types";

type ActionResult = { ok: true } | { ok: false; error: string };

const rsvpInputSchema = z.object({
  rsvp_status: z.enum(RSVP_STATUSES),
  plus_one_name: z.string().trim().max(80).optional().or(z.literal("").transform(() => undefined)),
  meal_preference: z.enum(MEAL_PREFERENCES).optional().or(z.literal("").transform(() => undefined)),
  dietary_restrictions: z.string().trim().max(500).optional().or(z.literal("").transform(() => undefined)),
  notes: z.string().trim().max(1000).optional().or(z.literal("").transform(() => undefined)),
});

const extrasInputSchema = z.object({
  song_request: z.string().trim().max(200).optional(),
  dance_style: z.enum(DANCE_STYLES).optional(),
  photo_challenges_opt_in: z.boolean().optional(),
  freeform_note: z.string().trim().max(1000).optional(),
});

/**
 * Submit / update a guest's RSVP. Cookie-authenticated; service-role write.
 */
export async function submitRsvpAction(
  raw: unknown,
  extrasRaw?: unknown,
): Promise<ActionResult> {
  const session = await readGuestSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const parsed = rsvpInputSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid RSVP" };
  }

  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    rsvp_status: parsed.data.rsvp_status,
    rsvp_responded_at: parsed.data.rsvp_status === "pending" ? null : new Date().toISOString(),
  };
  if (parsed.data.plus_one_name !== undefined) update.plus_one_name = parsed.data.plus_one_name;
  if (parsed.data.meal_preference !== undefined) update.meal_preference = parsed.data.meal_preference;
  if (parsed.data.dietary_restrictions !== undefined)
    update.dietary_restrictions = parsed.data.dietary_restrictions;
  if (parsed.data.notes !== undefined) update.notes = parsed.data.notes;

  const { error } = await admin
    .from("guests")
    .update(update)
    .eq("guest_id", session.guest_id)
    .eq("qr_token", session.qr_token);
  if (error) return { ok: false, error: error.message };

  // Optional: registered-guest extras (only if extrasRaw is supplied AND the
  // guest is account-authenticated. V1 has no guest accounts — these writes
  // are gated client-side by the locked-state UI; the server still validates.)
  if (extrasRaw) {
    const extrasParsed = extrasInputSchema.safeParse(extrasRaw);
    if (extrasParsed.success) {
      await admin
        .from("guest_rsvp_extras")
        .upsert({
          guest_id: session.guest_id,
          event_id: session.event_id,
          song_request: extrasParsed.data.song_request ?? null,
          dance_style: extrasParsed.data.dance_style ?? null,
          photo_challenges_opt_in: extrasParsed.data.photo_challenges_opt_in ?? true,
          freeform_note: extrasParsed.data.freeform_note ?? null,
          updated_at: new Date().toISOString(),
        });
    }
  }

  // Force re-render of the guest's invitation page so persisted values show.
  // The slug isn't bound to the action; revalidate everything under /.
  revalidatePath("/", "layout");
  return { ok: true };
}

/**
 * Sign out a guest from the personal invitation site. Clears the cookie but
 * does NOT invalidate the underlying qr_token (so re-scanning still works).
 */
export async function signOutGuestAction(): Promise<ActionResult> {
  await clearGuestSessionCookie();
  revalidatePath("/", "layout");
  return { ok: true };
}

// ─── +1 onboarding (0002 v2) ───────────────────────────────────────────────

const confirmPlusOneSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(80, "Too long"),
  last_name: z.string().trim().min(1, "Last name is required").max(80, "Too long"),
});

/**
 * TBA +1 confirms their identity on first scan. Updates `guests.first_name`,
 * `guests.last_name`, and `guests.plus_one_name_confirmed_at`. Logs the
 * onboarding scan event. Redirects to the personal invitation site.
 *
 * Server-side guards:
 *   - Cookie session must be valid.
 *   - Target guest must be a +1 row (`plus_one_of_guest_id` non-null) — defends
 *     against a primary calling the action via a forged request.
 */
export async function confirmPlusOneIdentityAction(raw: unknown): Promise<ActionResult> {
  const session = await readGuestSession();
  if (!session) return { ok: false, error: "Not signed in." };

  const parsed = confirmPlusOneSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid name" };
  }

  const admin = createAdminClient();

  // Verify the session's guest IS a +1, and fetch the slug for the redirect.
  const { data: guestRow } = await admin
    .from("guests")
    .select("guest_id, plus_one_of_guest_id, events!inner(slug)")
    .eq("guest_id", session.guest_id)
    .eq("qr_token", session.qr_token)
    .is("deleted_at", null)
    .maybeSingle();

  if (!guestRow) return { ok: false, error: "Guest record not found." };
  if (!guestRow.plus_one_of_guest_id) {
    return { ok: false, error: "Onboarding only applies to +1 guests." };
  }

  // Supabase returns embedded resources as objects OR arrays depending on
  // query shape — handle both forms defensively.
  const eventsRaw = (guestRow as { events?: unknown }).events;
  const eventsObj = Array.isArray(eventsRaw) ? eventsRaw[0] : eventsRaw;
  const slug = (eventsObj as { slug?: string } | undefined)?.slug;
  if (!slug) return { ok: false, error: "Event lookup failed." };

  const { error } = await admin
    .from("guests")
    .update({
      first_name: parsed.data.first_name,
      last_name: parsed.data.last_name,
      plus_one_name_confirmed_at: new Date().toISOString(),
    })
    .eq("guest_id", session.guest_id);
  if (error) return { ok: false, error: error.message };

  // Best-effort onboarding-scan log.
  void admin.from("scan_events").insert({
    event_id: session.event_id,
    guest_id: session.guest_id,
    source: "browser",
    context: { onboarding: true, primary_guest_id: guestRow.plus_one_of_guest_id },
  });

  revalidatePath(`/${slug}`);
  redirect(`/${slug}`);
}

/**
 * "This isn't me — I scanned the wrong code" link on the onboarding screen.
 * Clears the cookie session so the next visit doesn't auto-claim, then routes
 * to the generic landing page. No mutation to the guests row.
 */
export async function exitNotMeAction(): Promise<ActionResult> {
  await clearGuestSessionCookie();
  redirect("/");
}
