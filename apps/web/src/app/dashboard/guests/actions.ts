"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentEvent } from "@/lib/db/events";
import {
  addGuestSchema,
  csvRowSchema,
  editGuestSchema,
  type GuestInput,
} from "@/lib/schemas/guest";

type ActionResult<T = void> = { ok: true; data?: T } | { ok: false; error: string };

async function ensureEvent() {
  const event = await getCurrentEvent();
  if (!event) throw new Error("No event for the current user.");
  return event;
}

/** Insert a guest. Server-side validation via Zod. */
export async function addGuestAction(raw: unknown): Promise<ActionResult> {
  const parsed = addGuestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const event = await ensureEvent();
  const supabase = await createClient();
  const { error } = await supabase.from("guests").insert({
    event_id: event.event_id,
    ...flattenForInsert(parsed.data),
  });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/guests");
  return { ok: true };
}

/** Update an existing guest (partial). */
export async function updateGuestAction(raw: unknown): Promise<ActionResult> {
  const parsed = editGuestSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  const { guest_id, ...patch } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from("guests").update(flattenForInsert(patch)).eq("guest_id", guest_id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/guests");
  return { ok: true };
}

/** Soft-delete a guest by setting deleted_at. */
export async function softDeleteGuestAction(guestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("guests")
    .update({ deleted_at: new Date().toISOString() })
    .eq("guest_id", guestId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/guests");
  return { ok: true };
}

/**
 * Bulk import: pre-validated rows from the client preview. We re-validate
 * server-side and run all inserts in a single statement for atomicity. If
 * any row violates the DB constraints the whole batch fails.
 */
export async function bulkImportGuestsAction(rows: unknown[]): Promise<ActionResult<{ inserted: number }>> {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { ok: false, error: "No rows to import." };
  }
  if (rows.length > 200) {
    return { ok: false, error: "Maximum 200 rows per import." };
  }
  const event = await ensureEvent();
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
  revalidatePath("/dashboard/guests");
  return { ok: true, data: { inserted: toInsert.length } };
}

/** Toggle a single guest's RSVP status — for inline list interactions. */
export async function setRsvpAction(
  guestId: string,
  status: "pending" | "attending" | "declined" | "maybe",
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("guests")
    .update({
      rsvp_status: status,
      rsvp_responded_at: status === "pending" ? null : new Date().toISOString(),
    })
    .eq("guest_id", guestId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/dashboard/guests");
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
