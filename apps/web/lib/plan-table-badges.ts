/**
 * 🪑 THE SHORT NAME A TABLE WEARS ON THE SEAT PLAN, one per table and never two alike (bug, 27 Nov 2026, Apple build 10
 * walkthrough of Maria & Jose's 2D plan: one round read "·" and two tables both read "9").
 *
 * The plan drew `label.match(/\d+/)` and "·" when there was no number. So every table a couple names in words
 * ("Entourage", "Sweetheart Table", "Family of the Bride") read "·", and two tables whose names hold the same number
 * (a linked unit's members wear the unit's name; "Table 9" and "Principal Sponsors 9") read the same.
 *
 * Now, for every table on the plan at once:
 *   1. the table's number when its name (the linked unit's name for a member) holds one: "Table 12" → "12", "9A" → "9A";
 *   2. else the initials of its first two words, small words left out: "Entourage" → "E", "Family of the Bride" → "FB";
 *   3. a name with neither (blank) → "T";
 *   4. two tables that would read alike take a part mark in plan order (sort_order, then id): a number takes a letter
 *      ("9A", "9B"), initials take a count ("FB1", "FB2"), skipping any mark another table already wears.
 * Words only: the table's own name is untouched, and the plan's tap and the guest list still say it in full.
 */

export type PlanBadgeTable = {
  table_id: string;
  table_label: string | null;
  link_group_label?: string | null;
  sort_order?: number | null;
};

/** Words that never make an initial ("Family of the Bride" → "FB", "Table ng Pamilya" → "P"). */
const SMALL_WORDS = new Set(['table', 'tables', 'mesa', 'of', 'the', 'and', 'for', 'at', 'ng', 'sa', 'mga', 'para', 'ang']);

/** The badge one table would wear on its own, before any clash is settled. */
export function planBadgeBase(name: string | null | undefined): string {
  const text = (name ?? '').trim();
  const num = /\d+[a-z]?(?![\p{L}\p{N}])/iu.exec(text)?.[0];
  if (num) return num.toUpperCase();
  const words = text.split(/[^\p{L}\p{N}]+/u).filter((w) => w && !SMALL_WORDS.has(w.toLowerCase()));
  const initials = words
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');
  if (initials) return initials;
  const first = text.split(/[^\p{L}\p{N}]+/u).find(Boolean)?.charAt(0).toUpperCase();
  return first || 'T';
}

const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';

/** Every table's badge, by `table_id` — unique across the plan. */
export function planTableBadges(tables: ReadonlyArray<PlanBadgeTable>): Map<string, string> {
  const ordered = [...tables].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.table_id.localeCompare(b.table_id),
  );
  const base = new Map(ordered.map((t) => [t.table_id, planBadgeBase(t.link_group_label ?? t.table_label)]));
  const count = new Map<string, number>();
  for (const b of base.values()) count.set(b, (count.get(b) ?? 0) + 1);
  // A badge no one shares is kept as it is, and no part mark may take it.
  const taken = new Set([...base.values()].filter((b) => count.get(b) === 1));
  const out = new Map<string, string>();
  const next = new Map<string, number>();
  for (const t of ordered) {
    const b = base.get(t.table_id)!;
    if (count.get(b) === 1) {
      out.set(t.table_id, b);
      continue;
    }
    const byLetter = /\d$/.test(b);
    let k = next.get(b) ?? 0;
    let mark = '';
    do {
      mark = byLetter ? `${b}${LETTERS[k % LETTERS.length]}${k >= LETTERS.length ? Math.floor(k / LETTERS.length) + 1 : ''}` : `${b}${k + 1}`;
      k += 1;
    } while (taken.has(mark));
    next.set(b, k);
    taken.add(mark);
    out.set(t.table_id, mark);
  }
  return out;
}
