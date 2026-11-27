/**
 * The name of the guest's OWN table in the 3D walk ("You're at Ninong's table").
 *
 * `public_venue_scene` names every table by its public id (`S89TBL-…`) and sends
 * no table names, so the walk's caption read "You're at S89TBL-LAB0000006". The
 * RPC fills `you` only after it has checked the guest's personal token, so
 * `you.table` is the token holder's own table. This joins that one table's name,
 * the same name find-seat shows them, and no other table is named. It runs
 * wherever the scene is read (the venue page and the live-refresh route), so a
 * refresh never brings the code back.
 *
 * A failed read leaves `tableName` null and the caption says "your table". It
 * never falls back to the code. Only a type is imported, so the client caption
 * can import `youAreAtWords` from here.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type TableNameRow = { table_label: string | null; link_group_label: string | null };
export type WithYou = { you?: { table: string; tableName?: string | null } | null };

/** A joined set of tables answers to its group name, as everywhere else (`groupTablesIntoUnits`). */
export function yourTableName(row: TableNameRow | null): string | null {
  const name = (row?.link_group_label ?? '').trim() || (row?.table_label ?? '').trim();
  return name || null;
}

/** The event's shown table names — `readShownTableNames` (lib/table-auto-name.server.ts); a test hands in its own. */
type NamesOf = (admin: SupabaseClient, eventId: string) => Promise<Map<string, string>>;
const shownNamesOf: NamesOf = async (admin, eventId) =>
  // Loaded here, not at the top: the client caption imports `youAreAtWords` from this file.
  (await import('@/lib/table-auto-name.server')).readShownTableNames(admin, eventId);

export async function withYourTableName<T extends WithYou>(admin: SupabaseClient, scene: T, namesOf: NamesOf = shownNamesOf): Promise<T> {
  const you = scene.you;
  if (!you?.table) return scene;
  const { data, error } = await admin
    .from('event_tables')
    .select('table_id, event_id')
    .eq('public_id', you.table)
    .maybeSingle();
  // A failed read is logged, and the caption says "your table" (never the code).
  if (error) console.error('[supabase-error] lib/venue-your-table.ts · from:event_tables.select', error);
  const row = error ? null : (data as { table_id: string; event_id: string } | null);
  if (!row) return { ...scene, you: { ...you, tableName: null } };
  // 🪑 The name the table SHOWS (the ONE reader, `tableDisplayNames` — lib/table-auto-name.ts); unread → "your table".
  let tableName: string | null = null;
  try {
    tableName = (await namesOf(admin, row.event_id)).get(row.table_id) ?? null;
  } catch (e) {
    console.error('[supabase-error] lib/venue-your-table.ts · shown table name', e);
  }
  return { ...scene, you: { ...you, tableName } };
}

/** What the caption names: the table's name, or "your table". Never the code. */
export function youAreAtWords(you: { tableName?: string | null }): string {
  return you.tableName || 'your table';
}
