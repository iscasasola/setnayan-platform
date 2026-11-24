/**
 * supplier-march — who among a couple's booked suppliers sees the Wedding March, read-only, in their event Hub
 * (owner, tracker 2026-10-23: YES — "the band and the coordinator (suppliers booked in those categories) see the
 * Wedding March read-only in their event Hub, the same data the couple's march uses").
 *
 * The band cues the processional to it; the coordinator lines the entourage up by it. Before this, `march_walks` RLS
 * admitted only the couple and their moderators, so the Song Desk read "Processional" with no line-up behind it.
 *
 * Pure: the console reads the march only for a booking this says yes to.
 */
import { isCoordinatorTrade } from '@/lib/coordinator-trade';
import { isMusicToolCategory } from '@/lib/songs';
import type { MarchSection } from '@/lib/march-drag';
import { ENTOURAGE_ROLES, peopleOf, roleLabel, type EntourageGroup } from '@/lib/entourage';

/** A booking in a music category (band · DJ · singer · choir · strings …) or the coordinator trade. */
export function supplierSeesMarch(bookedCategories: readonly string[]): boolean {
  return isMusicToolCategory(bookedCategories) || isCoordinatorTrade(bookedCategories);
}

/** Walks in the march — every row of every section. */
export function marchWalkCount(sections: readonly MarchSection[]): number {
  return sections.reduce((n, s) => n + s.rows.length, 0);
}

/* ── 🧰 THE ENTOURAGE HUB TOOL (DECISION_LOG 2026-11-23; template ② "Per-person sheet") ───────────────────────────── */

export type EntourageSheetPerson = { key: string; name: string; initials: string; role: string | null };
export type EntourageSheetSection = { key: string; label: string; people: EntourageSheetPerson[] };

/** Two letters for the row's round mark: the first and last word of the name, titles ("Atty.", "Dr.") skipped. */
export function nameInitials(name: string): string {
  const words = name
    .split(/\s+/)
    .filter((w) => w && !w.endsWith('.') && /\p{L}/u.test(w));
  if (words.length === 0) return '·';
  const first = words[0]!.match(/\p{L}/u)?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]!.match(/\p{L}/u)?.[0] ?? '') : '';
  return (first + last).toUpperCase();
}

/**
 * The couple's entourage as a supplier's per-person sheet: one row per person, under the couple's own section words,
 * each with the role word the couple's prints use (`roleLabel` with the group's own names). Built from the SAME read
 * the march uses (`loadMarch`: everyone who walks, then the "Not walking" tray — they are still in the entourage), so
 * the sheet and the march never disagree about who is in it. A section in both halves is drawn once, walkers first.
 * Read-only: only the couple changes their entourage.
 *
 * 🔒 ONLY THE PRINTED ENTOURAGE (`ENTOURAGE_ROLES`): the names and roles the couple already publishes on their
 * invitation and Event Hub. The march's own march-only walkers (the couple's sides, read only for the band and the
 * coordinator — `supplierSeesMarch`) never reach this sheet, which any booked shop may switch on.
 */
export function entourageSheet(
  walking: readonly EntourageGroup[],
  out: readonly EntourageGroup[] | null,
): EntourageSheetSection[] {
  const printed = new Set<string>(ENTOURAGE_ROLES);
  const byKey = new Map<string, EntourageSheetSection>();
  for (const group of [...walking, ...(out ?? [])]) {
    const section = byKey.get(group.key) ?? { key: group.key, label: group.label, people: [] };
    for (const p of peopleOf(group)) {
      if (!printed.has(p.role)) continue;
      section.people.push({
        key: `${group.key}:${p.id ?? p.name}:${p.role}`,
        name: p.name,
        initials: nameInitials(p.name),
        role: roleLabel(p.role, group.names),
      });
    }
    byKey.set(group.key, section);
  }
  return [...byKey.values()].filter((s) => s.people.length > 0);
}

/** Everyone on the sheet. */
export function entourageSheetCount(sections: readonly EntourageSheetSection[]): number {
  return sections.reduce((n, s) => n + s.people.length, 0);
}
