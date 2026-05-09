"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getEventByIdForUser } from "@/lib/db/events";
import {
  addGuestSchema,
  csvRowSchema,
  editGuestSchema,
  type GuestInput,
} from "@/lib/schemas/guest";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function ensureEvent(eventId: string) {
  const event = await getEventByIdForUser(eventId);
  if (!event) throw new Error("No access to this event.");
  return event;
}

function guestsPath(eventId: string) {
  return `/dashboard/${eventId}/guests`;
}

/**
 * Insert a guest. Server-side validation via Zod.
 *
 * If `plus_one_allowed` is true, ALSO inserts a second `guests` row for the
 * +1 (per work order 0001 plus-one model upgrade, 2026-05-09): the +1 is a
 * first-class guest with its own qr_token, RSVP, meal preference, etc. The
 * primary's `plus_one_allowed` flag stays true; `plus_one_of_guest_id` on
 * the +1 row points at the primary.
 */
export async function addGuestAction(eventId: string, raw: unknown): Promise<ActionResult> {
  const parsed = addGuestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const event = await ensureEvent(eventId);
  const supabase = await createClient();

  // Strip the staging-only fields (they don't map to columns on the primary row).
  const {
    plus_one_first_name,
    plus_one_last_name,
    plus_one_mode,
    ...primaryFields
  } = parsed.data;

  // Insert primary, capture id + the fields we'll mirror onto the +1 row.
  const { data: primaryRows, error: primaryErr } = await supabase
    .from("guests")
    .insert({ event_id: event.event_id, ...flattenForInsert(primaryFields) })
    .select("guest_id, side, group_category, household_id, invited_to_blocks");
  if (primaryErr) return { ok: false, error: primaryErr.message };
  const primary = primaryRows?.[0] as
    | {
        guest_id: string;
        side: string;
        group_category: string;
        household_id: string | null;
        invited_to_blocks: string[];
      }
    | undefined;
  if (!primary) return { ok: false, error: "Primary guest insert returned no row." };

  // If a +1 was opted in, create the +1 as its own row.
  if (parsed.data.plus_one_allowed) {
    const mode = plus_one_mode ?? "full";
    const fn = (plus_one_first_name ?? "").trim();
    const ln = (plus_one_last_name ?? "").trim();
    const { error: plusOneErr } = await supabase.from("guests").insert({
      event_id: event.event_id,
      first_name: fn,
      last_name: ln,
      side: primary.side,
      group_category: primary.group_category,
      role: "guest",
      household_id: primary.household_id,
      plus_one_of_guest_id: primary.guest_id,
      plus_one_mode: mode,
      photo_consent: true,
      // Default the +1 to the same blocks the primary is invited to so the
      // couple doesn't have to re-toggle them.
      invited_to_blocks: primary.invited_to_blocks,
    });
    if (plusOneErr) {
      // Best-effort: don't roll back the primary. Surface the error to the UI.
      return { ok: false, error: `Primary guest saved, but +1 row failed: ${plusOneErr.message}` };
    }
  }

  revalidatePath(guestsPath(event.event_id));
  return { ok: true };
}

/** Update an existing guest (partial). Plus-one staging fields are ignored —
 * the +1 row, once created, is managed via its own row (Edit / Remove /
 * RSVP buttons on its own list entry). */
export async function updateGuestAction(eventId: string, raw: unknown): Promise<ActionResult> {
  const parsed = editGuestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const event = await ensureEvent(eventId);
  const { guest_id, plus_one_first_name, plus_one_last_name, plus_one_mode, ...patch } = parsed.data;
  void plus_one_first_name;
  void plus_one_last_name;
  void plus_one_mode;
  const supabase = await createClient();
  const { error } = await supabase
    .from("guests")
    .update(flattenForInsert(patch))
    .eq("guest_id", guest_id)
    .eq("event_id", event.event_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(guestsPath(event.event_id));
  return { ok: true };
}

/** Soft-delete a guest by setting deleted_at. */
export async function softDeleteGuestAction(eventId: string, guestId: string): Promise<ActionResult> {
  const event = await ensureEvent(eventId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("guests")
    .update({ deleted_at: new Date().toISOString() })
    .eq("guest_id", guestId)
    .eq("event_id", event.event_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(guestsPath(event.event_id));
  return { ok: true };
}

/**
 * Bulk import: pre-validated rows from the client preview. We re-validate
 * server-side and run all inserts in a single statement for atomicity. If
 * any row violates the DB constraints the whole batch fails.
 */
export async function bulkImportGuestsAction(eventId: string, rows: unknown[]): Promise<ActionResult<{ inserted: number }>> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "No rows to import." };
  }
  if (rows.length > 200) {
    return { ok: false, error: "Maximum 200 rows per import." };
  }
  const event = await ensureEvent(eventId);
  const supabase = await createClient();

  // Resolve household names from this import to existing household_ids on the event.
  const { data: existingHouseholds } = await supabase
    .from("households")
    .select("household_id, name")
    .eq("event_id", event.event_id);
  const householdByName = new Map<string, string>();
  for (const h of existingHouseholds ?? []) {
    householdByName.set((h as { name: string }).name.trim().toLowerCase(), (h as { household_id: string }).household_id);
  }

  // Parse + map each row.
  const toInsert: Array<Record<string, unknown>> = [];
  for (const r of rows) {
    const parsed = csvRowSchema.safeParse(r);
    if (!parsed.success) {
      return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid CSV row" };
    }
    const { household, ...rest } = parsed.data;
    const householdId = household ? householdByName.get(household.trim().toLowerCase()) ?? null : null;
    toInsert.push({
      event_id: event.event_id,
      household_id: householdId,
      first_name: rest.first_name,
      last_name: rest.last_name,
      side: rest.side,
      group_category: rest.group_category,
      role: rest.role,
      plus_one_allowed: rest.plus_one_allowed,
      email: rest.email ?? null,
      mobile: rest.mobile ?? null,
    });
  }

  const { error } = await supabase.from("guests").insert(toInsert);
  if (error) return { ok: false, error: error.message };
  revalidatePath(guestsPath(event.event_id));
  return { ok: true, data: { inserted: toInsert.length } };
}

/** Toggle a single guest's RSVP status — for inline list interactions. */
export async function setRsvpAction(
  eventId: string,
  guestId: string,
  status: "pending" | "attending" | "declined" | "maybe",
): Promise<ActionResult> {
  const event = await ensureEvent(eventId);
  const supabase = await createClient();
  const { error } = await supabase
    .from("guests")
    .update({
      rsvp_status: status,
      rsvp_responded_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("guest_id", guestId)
    .eq("event_id", event.event_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath(guestsPath(event.event_id));
  return { ok: true };
}

// ─── helpers ────────────────────────────────────────────────────────────────

function flattenForInsert(input: Partial<GuestInput>): Record<string, unknown> {
  // Drop undefined keys so PG defaults / existing values stick.
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) out[k] = v;
  }
  return out;
}
