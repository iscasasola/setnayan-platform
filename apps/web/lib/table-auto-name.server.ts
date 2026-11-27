import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { readEventGroupMemberships } from '@/lib/guests';
import { tableDisplayNames, withDisplayNames, type NameGroups, type NameSeat, type NameTable } from '@/lib/table-auto-name';

/**
 * 🪑 The server half of the ONE table-name reader (`tableDisplayNames`, lib/table-auto-name.ts): the event's groups,
 * memberships and who brought whom, read once (one `Promise.all`) for the surfaces that build a page on the server —
 * the caterer sheet, the escort and place-card prints, the entrance chart, the export, `/[slug]/seat` and find-seat.
 *
 * 🔴 A refused read THROWS. A printed escort card that says "Table 3" while the table's sign says "Reyes family"
 * sends a guest to the wrong table, so a name that could not be read is never guessed: the route fails, as it already
 * does when its tables cannot be read.
 */
export async function readTableNameGroups(
  supabase: SupabaseClient,
  eventId: string,
): Promise<NameGroups & { present: ReadonlySet<string> }> {
  const [groupsRes, membersRes, guestsRes] = await Promise.all([
    supabase.from('guest_groups').select('group_id,label').eq('event_id', eventId),
    readEventGroupMemberships(supabase, eventId),
    supabase.from('guests').select('guest_id,plus_one_of_guest_id').eq('event_id', eventId).is('deleted_at', null),
  ]);
  if (groupsRes.error) throw new Error(`readTableNameGroups (groups) failed: ${groupsRes.error.message}`);
  if (membersRes.error) throw new Error(`readTableNameGroups (memberships) failed: ${membersRes.error.message}`);
  if (guestsRes.error) throw new Error(`readTableNameGroups (guests) failed: ${guestsRes.error.message}`);
  const guests = (guestsRes.data ?? []) as Array<{ guest_id: string; plus_one_of_guest_id: string | null }>;
  return {
    labels: (groupsRes.data ?? []) as Array<{ group_id: string; label: string }>,
    members: (membersRes.data ?? []).map((m) => ({ guest_id: m.guest_id, group_id: m.group_id })),
    broughtBy: guests,
    present: new Set(guests.map((g) => g.guest_id)),
  };
}

/** Every table's shown name, from the rows a page already read (its tables + its seat rows). */
export async function readTableDisplayNames(
  supabase: SupabaseClient,
  eventId: string,
  tables: ReadonlyArray<NameTable>,
  seats: ReadonlyArray<NameSeat>,
): Promise<Map<string, string>> {
  const groups = await readTableNameGroups(supabase, eventId);
  // A seat row left behind by a removed guest is not a person at the table.
  return tableDisplayNames(tables, seats.filter((s) => groups.present.has(s.guest_id)), groups);
}

/** The page's own rows, each wearing its shown name in `table_label` — for surfaces that only display. */
export async function withShownTableNames<T extends NameTable>(
  supabase: SupabaseClient,
  eventId: string,
  tables: ReadonlyArray<T>,
  seats: ReadonlyArray<NameSeat>,
): Promise<T[]> {
  if (tables.length === 0) return [...tables];
  return withDisplayNames(tables, await readTableDisplayNames(supabase, eventId, tables, seats));
}

/** The same names from groups a page read in its own `Promise.all` (`readTableNameGroups` beside its tables). */
export function shownNamesFrom(
  groups: NameGroups & { present: ReadonlySet<string> },
  tables: ReadonlyArray<NameTable>,
  seats: ReadonlyArray<NameSeat>,
): Map<string, string> {
  return tableDisplayNames(tables, seats.filter((s) => groups.present.has(s.guest_id)), groups);
}

/**
 * 🔒 A GUEST PAGE's tables (`/[slug]/seat`, find-seat — rows from `fetchPublicTables`) under the names they show. Reads
 * the event's seat rows and groups beside each other, and hands back each row WITHOUT `label_is_auto` (the guest map
 * draws names, never how they were made). Throws on a refused read, like `fetchPublicTables`.
 */
export async function guestTablesWithShownNames<T extends NameTable>(
  supabase: SupabaseClient,
  eventId: string,
  tables: ReadonlyArray<T>,
): Promise<Array<Omit<T, 'label_is_auto'>>> {
  if (tables.length === 0) return [];
  const [seatsRes, groups, linksRes] = await Promise.all([
    supabase.from('event_seat_assignments').select('guest_id,table_id').eq('event_id', eventId),
    readTableNameGroups(supabase, eventId),
    // 🔗 Which tables are one linked run — read only to NAME them; the link fields never reach the guest's page.
    supabase.from('event_tables').select('table_id,link_group_id,link_group_label').eq('event_id', eventId),
  ]);
  if (seatsRes.error) throw new Error(`guestTablesWithShownNames (seats) failed: ${seatsRes.error.message}`);
  if (linksRes.error) throw new Error(`guestTablesWithShownNames (links) failed: ${linksRes.error.message}`);
  const linkOf = new Map(
    ((linksRes.data ?? []) as Array<{ table_id: string; link_group_id: string | null; link_group_label: string | null }>).map((r) => [r.table_id, r]),
  );
  const forNaming = tables.map((t) => ({
    ...t,
    link_group_id: linkOf.get(t.table_id)?.link_group_id ?? null,
    link_group_label: linkOf.get(t.table_id)?.link_group_label ?? null,
  }));
  const names = shownNamesFrom(groups, forNaming, (seatsRes.data ?? []) as NameSeat[]);
  return withDisplayNames(tables, names).map((t) => {
    const { label_is_auto: _made, ...rest } = t;
    void _made;
    return rest;
  });
}

/**
 * The open name search (`/api/seat-lookup/[slug]`): its RPC answers with a table's STORED label, so this maps each
 * stored label to the name the table shows. Only a label one table holds is mapped (two tables stored under one label
 * cannot be told apart from the label alone — they keep it). The event is found by its slug, as the RPC finds it
 * (a slug names one event; the RPC's own gate decides whether it answers at all). Throws on a refused read.
 */
export async function shownLabelsForSlug(supabase: SupabaseClient, slug: string): Promise<Map<string, string>> {
  const pattern = slug.replace(/[\\%_]/g, (c) => `\\${c}`);
  const { data: ev, error: evErr } = await supabase
    .from('events')
    .select('event_id')
    .ilike('slug', pattern)
    .limit(1)
    .maybeSingle();
  if (evErr) throw new Error(`shownLabelsForSlug (event) failed: ${evErr.message}`);
  if (!ev) return new Map();
  return shownLabelsByStored(supabase, (ev as { event_id: string }).event_id);
}

/**
 * Stored label → the name that table SHOWS, for a reader that is handed a STORED label by a database function (the
 * open name search, the coordinator's and crew's QR lookups). Only a label one table holds is mapped. Throws on a
 * refused read.
 */
export async function shownLabelsByStored(supabase: SupabaseClient, eventId: string): Promise<Map<string, string>> {
  const [tablesRes, seatsRes, groups] = await Promise.all([
    supabase.from('event_tables').select('table_id,table_label,label_is_auto,sort_order,link_group_id,link_group_label').eq('event_id', eventId),
    supabase.from('event_seat_assignments').select('guest_id,table_id').eq('event_id', eventId),
    readTableNameGroups(supabase, eventId),
  ]);
  if (tablesRes.error) throw new Error(`shownLabelsByStored (tables) failed: ${tablesRes.error.message}`);
  if (seatsRes.error) throw new Error(`shownLabelsByStored (seats) failed: ${seatsRes.error.message}`);
  const tables = (tablesRes.data ?? []) as NameTable[];
  const names = shownNamesFrom(groups, tables, (seatsRes.data ?? []) as NameSeat[]);
  const holders = new Map<string, number>();
  for (const t of tables) holders.set((t.table_label ?? '').trim(), (holders.get((t.table_label ?? '').trim()) ?? 0) + 1);
  const out = new Map<string, string>();
  for (const t of tables) {
    const stored = (t.table_label ?? '').trim();
    if (holders.get(stored) === 1) out.set(stored, names.get(t.table_id) ?? stored);
  }
  return out;
}

/**
 * 🪑 Every table's SHOWN name for an event, by `table_id` — for a surface that reads a label off its own seat or table
 * row (a ticket, a reminder email, the door desk, the coordinator's lookup) and only needs the name. Reads the tables,
 * the seats and the groups in one `Promise.all`. Throws on a refused read; a caller that degrades says so itself.
 */
export async function readShownTableNames(supabase: SupabaseClient, eventId: string): Promise<Map<string, string>> {
  const [tablesRes, seatsRes, groups] = await Promise.all([
    supabase.from('event_tables').select('table_id,table_label,label_is_auto,sort_order,link_group_id,link_group_label').eq('event_id', eventId),
    supabase.from('event_seat_assignments').select('guest_id,table_id').eq('event_id', eventId),
    readTableNameGroups(supabase, eventId),
  ]);
  if (tablesRes.error) throw new Error(`readShownTableNames (tables) failed: ${tablesRes.error.message}`);
  if (seatsRes.error) throw new Error(`readShownTableNames (seats) failed: ${seatsRes.error.message}`);
  return shownNamesFrom(groups, (tablesRes.data ?? []) as NameTable[], (seatsRes.data ?? []) as NameSeat[]);
}

export type ShownTableRow = { table_id: string; table_label: string; link_group_label: string | null };

/**
 * The same names in the shape a `from('event_tables').select('table_id, table_label, link_group_label')` answers —
 * a drop-in for a surface that reads a table's label beside its other reads: `table_label` is the SHOWN name and a
 * linked member's `link_group_label` is its unit's shown name (null when it is not linked). Never throws: a refused
 * read comes back as `{ data: null, error }`, exactly as the query it replaces did, so each caller keeps its own
 * honest answer to a failed read.
 */
export async function shownTableRows(
  supabase: SupabaseClient,
  eventId: string,
): Promise<{ data: ShownTableRow[] | null; error: { message: string } | null }> {
  const [tablesRes, seatsRes, groups] = await Promise.all([
    supabase.from('event_tables').select('table_id,table_label,label_is_auto,sort_order,link_group_id,link_group_label').eq('event_id', eventId),
    supabase.from('event_seat_assignments').select('guest_id,table_id').eq('event_id', eventId),
    readTableNameGroups(supabase, eventId).catch((e: unknown) => e as Error),
  ]);
  if (tablesRes.error) return { data: null, error: tablesRes.error };
  if (seatsRes.error) return { data: null, error: seatsRes.error };
  if (groups instanceof Error) return { data: null, error: { message: groups.message } };
  const tables = (tablesRes.data ?? []) as Array<NameTable & { table_label: string }>;
  const names = shownNamesFrom(groups, tables, (seatsRes.data ?? []) as NameSeat[]);
  return {
    data: tables.map((t) => {
      const shown = names.get(t.table_id) ?? t.table_label;
      return { table_id: t.table_id, table_label: shown, link_group_label: t.link_group_id ? shown : null };
    }),
    error: null,
  };
}
