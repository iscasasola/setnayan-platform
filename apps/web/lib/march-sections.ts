/**
 * march-sections.ts — the Wedding March as the maker draws it (pure; server-side).
 *
 * Built from `buildEntourage(…, { march: true })` groups — the invitation's own
 * builder, with the couple's sides in their place. Kept apart from
 * `lib/march-drag.ts` (which the client imports) so the role words it reads do
 * not ride into the Maker's bundle.
 */
import { columnOfRole, type EntourageGroup, type EntouragePerson } from '@/lib/entourage';
import { guestRoleLabel } from '@/lib/guests';
import type { MarchPerson, MarchSection } from '@/lib/march-drag';

/**
 * 🚶 The march as the maker draws it (owner 2026-10-06, "THE WEDDING MARCH ITEM IS
 * A DRAG-AND-DROP MARCH MAKER"): every section and walk in walking order —
 * the invitation's own builder in its march form (`{ march: true }`), with the
 * couple's sides in their place — each walk its [left, right]. Which drop may go
 * where is asked of `lib/march-moves.ts` on the client (`lib/march-drag.ts`) and
 * again by each action before it writes.
 */
export function marchSections(groups: readonly EntourageGroup[]): MarchSection[] {
  /* 🔑 ONE PERSON, ONE PLACE. A person holding two roles prints under both, but
     walks ONCE (one `march_walks` row): the march draws them once — where they
     walk WITH someone, else in their first section. */
  const seen = new Map<string, { g: number; paired: boolean }>();
  groups.forEach((g, gi) =>
    g.rows.forEach((row) =>
      row.forEach((p) => {
        if (!p?.id) return;
        const paired = row[0] !== null && row[1] !== null;
        const had = seen.get(p.id);
        if (!had || (!had.paired && paired)) seen.set(p.id, { g: gi, paired });
      }),
    ),
  );
  const keep = (p: EntouragePerson | null, gi: number) => (p && (!p.id || seen.get(p.id)?.g === gi) ? p : null);
  const kept = groups.map((g, gi) =>
    g.rows
      .map((row): [EntouragePerson | null, EntouragePerson | null] => {
        const l = keep(row[0], gi);
        const r = keep(row[1], gi);
        // Someone drawn elsewhere leaves this walk to the one who stays, in their own column.
        if (l && !r && row[1]) return columnOfRole(g.key, l.role) === 1 ? [null, l] : [l, null];
        if (r && !l && row[0]) return columnOfRole(g.key, r.role) === 1 ? [null, r] : [r, null];
        return [l, r];
      })
      .filter((row) => row[0] || row[1]),
  );
  /* 🔗 A walk whose other person stands in ANOTHER section (a groom's parent who
     walked with a bride's parent under the printed "Parents") is TIED: a reorder
     of this section would carry the other person's walk too, so the planner
     splits it first (`lib/march-drag.ts`). */
  const byWalk = new Map<number, Set<string>>();
  for (const rows of kept) for (const row of rows) for (const p of row) if (p?.id && typeof p.walk === 'number') {
    byWalk.set(p.walk, (byWalk.get(p.walk) ?? new Set()).add(p.id));
  }
  const tied = (p: EntouragePerson, row: readonly (EntouragePerson | null)[]) =>
    typeof p.walk === 'number' && [...(byWalk.get(p.walk) ?? [])].some((id) => !row.some((x) => x?.id === id));
  const person = (p: EntouragePerson | null, row: readonly (EntouragePerson | null)[], names: EntourageGroup['names']): MarchPerson | null =>
    p
      ? {
          id: p.id ?? '',
          name: p.name,
          role: p.role,
          // The two people the event is for wear their word (the march's only role line).
          tag: p.role === 'groom' || p.role === 'bride' ? guestRoleLabel(p.role, names) : null,
          ...(tied(p, row) ? { tied: true } : {}),
        }
      : null;
  return groups
    .map((g, gi) => ({
      key: g.key,
      label: g.label,
      rows: kept[gi]!.map((row) => [person(row[0], row, g.names), person(row[1], row, g.names)] as const),
    }))
    .filter((sec) => sec.rows.length > 0);
}
