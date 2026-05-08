"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentEvent } from "@/lib/db/events";
import { invalidateGuestQrCache } from "@/lib/server/qr";

type ActionResult = { ok: true } | { ok: false; error: string };

/**
 * Re-issue a single guest's QR token.
 *
 * Rotates `guests.qr_token` to a fresh 16-byte hex value, drops the cached SVG
 * for the old token. The previously printed QR stops working immediately —
 * scanning it returns the generic "this invitation has been re-issued" page
 * because the token no longer matches any guest row.
 *
 * Couple-only. Couples sign in via OAuth (Supabase auth), so we use the
 * normal server client and rely on RLS to prevent cross-event mischief.
 */
export async function reissueGuestTokenAction(guestId: string): Promise<ActionResult> {
  // Verify the calling user is a couple of the event that owns the guest.
  const event = await getCurrentEvent();
  if (!event) return { ok: false, error: "Not signed in." };

  const supabase = await createClient();

  const { data: existing, error: lookupErr } = await supabase
    .from("guests")
    .select("guest_id, event_id, qr_token")
    .eq("guest_id", guestId)
    .eq("event_id", event.event_id)
    .maybeSingle();
  if (lookupErr) return { ok: false, error: lookupErr.message };
  if (!existing) return { ok: false, error: "Guest not found in your event." };

  // Generate the new token via Postgres (gen_random_bytes is server-side, safer
  // than browser crypto for this purpose). The admin client bypasses RLS, but
  // we already verified ownership above.
  const admin = createAdminClient();
  const { data: rotated, error: rotateErr } = await admin.rpc("encode_random_bytes_hex", {});
  let newToken: string | null = null;
  if (rotateErr || !rotated) {
    // Fall back to Node crypto if the RPC isn't installed.
    const { randomBytes } = await import("node:crypto");
    newToken = randomBytes(16).toString("hex");
  } else {
    newToken = rotated as unknown as string;
  }

  const { error: updateErr } = await admin
    .from("guests")
    .update({ qr_token: newToken })
    .eq("guest_id", guestId);
  if (updateErr) return { ok: false, error: updateErr.message };

  // Drop the old QR SVG from the in-memory cache.
  invalidateGuestQrCache({
    event_id: event.event_id,
    guest_id: guestId,
    qr_token: existing.qr_token as string,
  });

  revalidatePath("/dashboard/qr-codes");
  return { ok: true };
}
