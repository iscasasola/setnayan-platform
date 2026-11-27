/**
 * 🪑 THE NAME A TABLE SHOWS — read, never stored (owner 2026-11-27, ruling R6: "the majority of who is seated there
 * if it has a group will be the table's name"; corpus SEAT-PLAN-COMPLETE-2026-11-27.md § 4.3).
 *
 *   1. Host name: a name the host typed (`label_is_auto = false`) is shown as typed and never changes when guests move.
 *   2. Majority group: otherwise the `guest_groups.label` holding MORE THAN HALF of the table's seated seats. A +1 or a
 *      kid counts under their guest's group (`plus_one_of_guest_id`). A guest in several groups counts in each; when
 *      two groups qualify, more seats wins, then the label A→Z.
 *   3. No majority, or an empty table: the table's own default label ("Table N").
 *   4. Unique: host names are kept; an auto name that clashes with a host name or an earlier auto name takes " 2",
 *      " 3" in plan order (`sort_order`, then id). A host name equal to another table's shown name is refused
 *      (`hostNameClash`).
 *
 * ONE reader. Every surface that shows a table's name — the list cards, the table screen, the 2D/3D plan and its
 * badges, search lines, the caterer sheet, escort and place cards, `/[slug]/seat` and find-seat — reads it from here
 * (`table-names-have-one-reader.test.ts`). A second copy is a defect. Pure: no I/O (the server read is
 * `lib/table-auto-name.server.ts`).
 */

import { nextTableName } from '@/lib/seating';

export type NameTable = {
  table_id: string;
  table_label: string | null;
  /** FALSE = the host typed `table_label`. Absent (an older read) counts as host-typed, so nothing is ever renamed by a stale row. */
  label_is_auto?: boolean | null;
  sort_order?: number | null;
};

export type NameSeat = { guest_id: string; table_id: string };

export type NameGroups = {
  /** The event's groups: id → label. */
  labels: ReadonlyArray<{ group_id: string; label: string }>;
  /** Every guest's group memberships (a guest may hold several). */
  members: ReadonlyArray<{ guest_id: string; group_id: string }>;
  /** A +1 or kid → the guest who brought them (`guests.plus_one_of_guest_id`). */
  broughtBy?: ReadonlyMap<string, string> | ReadonlyArray<{ guest_id: string; plus_one_of_guest_id: string | null }>;
};

/** Why a table shows the name it shows — the Name row's line under the box. */
export type TableNameWhy =
  | { kind: 'host' }
  | { kind: 'group'; groupLabel: string; groupSeats: number; seated: number }
  | { kind: 'none'; seated: number };

export type TableNameInfo = { name: string; why: TableNameWhy };

/** The default label a new table takes ("Table 7"). Anything else was typed by a person. */
export function isDefaultTableLabel(label: string | null | undefined): boolean {
  return /^table\s+\d+$/i.test((label ?? '').trim());
}

const key = (s: string) => s.trim().replace(/\s+/g, ' ').toLowerCase();

function planOrder<T extends NameTable>(tables: ReadonlyArray<T>): T[] {
  return [...tables].sort(
    (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0) || a.table_id.localeCompare(b.table_id),
  );
}

function broughtByMap(groups: NameGroups): Map<string, string> {
  const b = groups.broughtBy;
  if (!b) return new Map();
  if (b instanceof Map) return new Map(b);
  const out = new Map<string, string>();
  for (const r of b as ReadonlyArray<{ guest_id: string; plus_one_of_guest_id: string | null }>) {
    if (r.plus_one_of_guest_id) out.set(r.guest_id, r.plus_one_of_guest_id);
  }
  return out;
}

/** The majority group of one table's seated guests, or null. */
function majorityOf(
  seatedHere: ReadonlyArray<string>,
  groupsOf: (guestId: string) => ReadonlySet<string>,
  labelOf: ReadonlyMap<string, string>,
): { groupLabel: string; groupSeats: number } | null {
  if (seatedHere.length === 0) return null;
  const count = new Map<string, number>();
  for (const g of seatedHere) for (const id of groupsOf(g)) if (labelOf.has(id)) count.set(id, (count.get(id) ?? 0) + 1);
  let best: { groupLabel: string; groupSeats: number } | null = null;
  for (const [id, n] of count) {
    // MORE than half: exactly half is not a majority.
    if (n * 2 <= seatedHere.length) continue;
    const label = labelOf.get(id)!.trim();
    if (!label) continue;
    if (!best || n > best.groupSeats || (n === best.groupSeats && label.localeCompare(best.groupLabel) < 0)) {
      best = { groupLabel: label, groupSeats: n };
    }
  }
  return best;
}

/** Every table's shown name and why — the one computation `tableDisplayNames` returns the names of. */
export function tableNameInfos(
  tables: ReadonlyArray<NameTable>,
  seated: ReadonlyArray<NameSeat>,
  groups: NameGroups,
): Map<string, TableNameInfo> {
  const labelOf = new Map(groups.labels.map((g) => [g.group_id, g.label]));
  const own = new Map<string, Set<string>>();
  for (const m of groups.members) {
    const s = own.get(m.guest_id) ?? new Set<string>();
    s.add(m.group_id);
    own.set(m.guest_id, s);
  }
  const bringer = broughtByMap(groups);
  const empty = new Set<string>();
  // A +1 or kid counts under their guest's group (and their own, if they were put in one).
  const groupsOf = (guestId: string): ReadonlySet<string> => {
    const by = bringer.get(guestId);
    const mine = own.get(guestId) ?? empty;
    if (!by) return mine;
    const theirs = own.get(by) ?? empty;
    return theirs.size === 0 ? mine : mine.size === 0 ? theirs : new Set([...mine, ...theirs]);
  };
  const seatedAt = new Map<string, string[]>();
  for (const s of seated) {
    const list = seatedAt.get(s.table_id) ?? [];
    list.push(s.guest_id);
    seatedAt.set(s.table_id, list);
  }

  const ordered = planOrder(tables);
  const out = new Map<string, TableNameInfo>();
  // Host names are kept as typed and claim their name first.
  const taken = new Set<string>();
  for (const t of ordered) {
    if (t.label_is_auto === true) continue;
    const name = (t.table_label ?? '').trim();
    out.set(t.table_id, { name, why: { kind: 'host' } });
    if (name) taken.add(key(name));
  }
  for (const t of ordered) {
    if (t.label_is_auto !== true) continue;
    const here = seatedAt.get(t.table_id) ?? [];
    const major = majorityOf(here, groupsOf, labelOf);
    const base = major ? major.groupLabel : (t.table_label ?? '').trim() || 'Table';
    let name = base;
    for (let n = 2; taken.has(key(name)); n += 1) name = `${base} ${n}`;
    taken.add(key(name));
    out.set(t.table_id, {
      name,
      why: major ? { kind: 'group', groupLabel: major.groupLabel, groupSeats: major.groupSeats, seated: here.length } : { kind: 'none', seated: here.length },
    });
  }
  return out;
}

/** 🪑 THE reader: every table's shown name, by `table_id`. */
export function tableDisplayNames(
  tables: ReadonlyArray<NameTable>,
  seated: ReadonlyArray<NameSeat>,
  groups: NameGroups,
): Map<string, string> {
  return new Map([...tableNameInfos(tables, seated, groups)].map(([id, i]) => [id, i.name]));
}

/** Rows with `table_label` swapped for the shown name — for surfaces that only display (prints, guest pages, badges). */
export function withDisplayNames<T extends NameTable>(tables: ReadonlyArray<T>, names: ReadonlyMap<string, string>): T[] {
  return tables.map((t) => {
    const name = names.get(t.table_id);
    return name && name !== t.table_label ? { ...t, table_label: name } : t;
  });
}

/**
 * A host name may not be another table's shown name. Returns the refusal words, or null when the name is free.
 * An empty name is never a clash: it returns the table to its auto name.
 */
export function hostNameClash(
  tableId: string,
  proposed: string,
  names: ReadonlyMap<string, string>,
): string | null {
  const want = key(proposed);
  if (!want) return null;
  for (const [id, shown] of names) {
    if (id !== tableId && key(shown) === want) return `${shown} already has that name. Pick another.`;
  }
  return null;
}

/** The Name row's line under the box (§ 4.3). */
export function tableNameWhyWords(why: TableNameWhy): string {
  if (why.kind === 'host') return 'Named by you · moving guests never changes it';
  if (why.kind === 'group') return `Auto · ${why.groupSeats} of ${why.seated} seated here are ${why.groupLabel}`;
  return 'Auto · no group has more than half the seats yet';
}

/**
 * The default label a host-named table goes back to when it returns to auto: its own label if it is still "Table N",
 * else the next free "Table N" (`nextTableName`). The ONE rule — `updateTableLabel` writes it, `autoNameFor` previews it.
 */
export function autoDefaultLabel(tableId: string, tables: ReadonlyArray<NameTable>): string {
  const own = tables.find((t) => t.table_id === tableId)?.table_label ?? '';
  if (isDefaultTableLabel(own)) return own.trim();
  return nextTableName(tables.filter((t) => t.table_id !== tableId).map((t) => t.table_label));
}

/** The name a table would show if it went back to auto — the Name row's "Use the auto name · <name>". */
export function autoNameFor(
  tableId: string,
  tables: ReadonlyArray<NameTable>,
  seated: ReadonlyArray<NameSeat>,
  groups: NameGroups,
): string {
  const label = autoDefaultLabel(tableId, tables);
  const asAuto = tables.map((t) => (t.table_id === tableId ? { ...t, table_label: label, label_is_auto: true } : t));
  return tableDisplayNames(asAuto, seated, groups).get(tableId) ?? '';
}
