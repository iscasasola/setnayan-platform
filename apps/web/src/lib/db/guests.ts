/**
 * Guest-list queries. All filtered by RLS to the calling user's event(s).
 */

import { createClient } from "@/lib/supabase/server";
import type { Guest, Household, WeddingTable } from "./types";

const GUEST_SELECT = `
  guest_id, event_id, household_id, pair_with_guest_id,
  first_name, last_name, display_name,
  side, group_category, role,
  plus_one_allowed, plus_one_name,
  email, mobile, address,
  meal_preference, dietary_restrictions, photo_consent,
  table_assignment_id,
  invited_to_blocks, custom_tags,
  rsvp_status, rsvp_responded_at, invitation_sent_at,
  notes, qr_token,
  created_at, updated_at, deleted_at
`;

/**
 * Get all guests for an event (excluding soft-deleted) plus joined household
 * and table info.
 */
export async function getGuestsForEvent(eventId: string): Promise<{
  guests: Guest[];
  households: Household[];
  tables: WeddingTable[];
}> {
  const supabase = await createClient();

  const [guestsRes, householdsRes, tablesRes] = await Promise.all([
    supabase
      .from("guests")
      .select(GUEST_SELECT)
      .eq("event_id", eventId)
      .is("deleted_at", null)
      .order("last_name", { ascending: true })
      .order("first_name", { ascending: true }),
    supabase
      .from("households")
      .select(
        "household_id, event_id, name, address, created_at, updated_at",
      )
      .eq("event_id", eventId)
      .order("name", { ascending: true }),
    supabase
      .from("wedding_tables")
      .select(
        "table_id, event_id, table_name, capacity, position_x, position_y, created_at",
      )
      .eq("event_id", eventId)
      .order("table_name", { ascending: true }),
  ]);

  if (guestsRes.error) console.error("[getGuestsForEvent guests]", guestsRes.error.message);
  if (householdsRes.error) console.error("[getGuestsForEvent households]", householdsRes.error.message);
  if (tablesRes.error) console.error("[getGuestsForEvent tables]", tablesRes.error.message);

  return {
    guests: (guestsRes.data as Guest[]) ?? [],
    households: (householdsRes.data as Household[]) ?? [],
    tables: (tablesRes.data as WeddingTable[]) ?? [],
  };
}
