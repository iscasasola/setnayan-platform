/**
 * Group paired guests (`pair_with_guest_id`) into single display rows so the
 * UI can show "Cora & Boy Reyes" as one entry instead of two duplicates.
 */

import type { Guest, Household } from "@/lib/db/types";

export type DisplayRow =
  | { kind: "solo"; primary: Guest; partner: null; household: Household | null }
  | { kind: "pair"; primary: Guest; partner: Guest; household: Household | null };

export function buildDisplayRows(guests: Guest[], households: Household[]): DisplayRow[] {
  const byId = new Map(guests.map((g) => [g.guest_id, g]));
  const householdById = new Map(households.map((h) => [h.household_id, h]));
  const visited = new Set<string>();
  const rows: DisplayRow[] = [];

  for (const g of guests) {
    if (visited.has(g.guest_id)) continue;

    if (g.pair_with_guest_id && byId.has(g.pair_with_guest_id)) {
      const partner = byId.get(g.pair_with_guest_id)!;
      if (partner.guest_id !== g.guest_id) {
        // Choose the partner with the lexically smaller first name as primary
        // for stable display order. Falls back to guest_id for ties.
        const [a, b] =
          g.first_name.localeCompare(partner.first_name) <= 0 ? [g, partner] : [partner, g];
        rows.push({
          kind: "pair",
          primary: a,
          partner: b,
          household: a.household_id ? (householdById.get(a.household_id) ?? null) : null,
        });
        visited.add(g.guest_id);
        visited.add(partner.guest_id);
        continue;
      }
    }

    rows.push({
      kind: "solo",
      primary: g,
      partner: null,
      household: g.household_id ? (householdById.get(g.household_id) ?? null) : null,
    });
    visited.add(g.guest_id);
  }

  return rows;
}

export function rowDisplayName(row: DisplayRow): string {
  if (row.kind === "pair") {
    const sameLast = row.primary.last_name === row.partner.last_name;
    return sameLast
      ? `${row.primary.first_name} & ${row.partner.first_name} ${row.primary.last_name}`
      : `${row.primary.first_name} ${row.primary.last_name} & ${row.partner.first_name} ${row.partner.last_name}`;
  }
  return row.primary.display_name?.trim() || `${row.primary.first_name} ${row.primary.last_name}`;
}

export function rowSubtitle(row: DisplayRow): string {
  const parts: string[] = [];
  if (row.kind === "pair") {
    if (row.primary.display_name) parts.push(row.primary.display_name);
    if (row.household) parts.push(row.household.name);
    return parts.join(" · ");
  }
  // solo
  const g = row.primary;
  if (g.display_name && g.display_name !== `${g.first_name} ${g.last_name}`) parts.push(g.display_name);
  if (row.household) parts.push(row.household.name);
  if (parts.length === 0) {
    // Fall back to a relationship-ish hint
    if (g.role !== "guest") parts.push("solo");
    parts.push(groupHint(g.group_category));
  }
  return parts.join(" · ");
}

function groupHint(g: string): string {
  switch (g) {
    case "family":
      return "family";
    case "friends":
      return "friends";
    case "work":
      return "work";
    case "school":
      return "college";
    case "officiant":
      return "officiant";
    default:
      return "guest";
  }
}

export function rowAvatarInitials(row: DisplayRow): string {
  if (row.kind === "pair") {
    return (row.primary.first_name[0] ?? "?") + (row.partner.first_name[0] ?? "?");
  }
  const g = row.primary;
  return ((g.first_name[0] ?? "?") + (g.last_name[0] ?? "?")).toUpperCase();
}

export function rowGuestCount(row: DisplayRow): number {
  return row.kind === "pair" ? 2 : 1;
}
