"use server";

import { revalidatePath } from "next/cache";
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
