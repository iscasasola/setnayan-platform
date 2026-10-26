import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { guestDisplayName } from '@/lib/guests';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { MemoriesPerson, MemoriesTags } from '@/lib/event-memories';

/**
 * WHO IS IN EACH PHOTO, AND WHO COULD BE — the full-screen viewer's Tag on Memories (owner 2026-10-27, "tag (add a
 * person tagged)"). Read on the couple's OWN session: `photo_tags` and `guests` are both couple-readable (RLS), so
 * nothing here widens who sees what.
 *
 *   · `people` — this event's guest list (removed guests left out — `deleted_at is null`), by first name;
 *   · `byItem` — `"<table>:<id>"` → the guest ids tagged in it now (a tombstoned tag is not a tag);
 *   · 🔑 `refused` — either read failed. The panel then says "couldn't load", never "nobody is tagged".
 *
 * Only the photos the page holds are asked about (`in`, in chunks — a long list of ids must not become one URL).
 */
const CHUNK = 100;

export async function readMemoriesTags(
  supabase: SupabaseClient,
  eventId: string,
  items: Array<{ table: string; id: string }>,
): Promise<MemoriesTags> {
  const taggable = items.filter((i) => i.table === 'papic_photos' || i.table === 'papic_guest_captures');
  const ids = [...new Set(taggable.map((i) => i.id))];
  const chunks: string[][] = [];
  for (let i = 0; i < ids.length; i += CHUNK) chunks.push(ids.slice(i, i + CHUNK));

  const [guestsRes, ...tagRes] = await Promise.all([
    supabase
      .from('guests')
      .select('guest_id, first_name, last_name, display_name')
      .eq('event_id', eventId)
      .is('deleted_at', null)
      .order('first_name', { ascending: true })
      .limit(2000),
    ...chunks.map((c) =>
      supabase
        .from('photo_tags')
        .select('source_table, source_id, guest_id')
        .eq('event_id', eventId)
        .is('removed_at', null)
        .in('source_id', c),
    ),
  ]);

  let refused = false;
  if (guestsRes.error) {
    refused = true;
    logQueryError('readMemoriesTags.guests', guestsRes.error, { event_id: eventId }, 'graceful_degrade');
  }
  const people: MemoriesPerson[] = ((guestsRes.data ?? []) as Array<{
    guest_id: string;
    first_name: string;
    last_name: string;
    display_name: string | null;
  }>)
    .map((g) => ({ guestId: g.guest_id, name: guestDisplayName(g) }))
    .filter((p) => p.name.length > 0);

  const byItem: Record<string, string[]> = {};
  for (const r of tagRes) {
    if (r.error) {
      refused = true;
      logQueryError('readMemoriesTags.photo_tags', r.error, { event_id: eventId }, 'graceful_degrade');
      continue;
    }
    for (const t of (r.data ?? []) as Array<{ source_table: string; source_id: string; guest_id: string }>) {
      const k = `${t.source_table}:${t.source_id}`;
      (byItem[k] ??= []).push(t.guest_id);
    }
  }
  return { people, byItem, refused };
}
