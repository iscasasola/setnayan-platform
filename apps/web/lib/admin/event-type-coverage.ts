import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import { nextEventTypes } from '@/lib/event-type-scope';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * A NEW event type's supplier coverage, set in the same press that makes it (admin supplier slice, owner 2026-10-28:
 * an event-type request's "Add it" opens the new type's supplier coverage right there).
 *
 * Writes the SAME `service_categories.applicable_event_types` column, through the SAME `nextEventTypes` rule, as
 * Admin › Event types › Scope categories (`setFolderEventTypeOffered`) — per GROUP: a ticked group offers the type on
 * every one of its categories, an unticked one hides it there. Never a second copy of the scoping rule.
 *
 * Returns how many categories could not be written (0 = all landed) — the caller SAYS a partial write.
 */
export async function setNewTypeCoverage(
  admin: ReturnType<typeof createAdminClient>,
  eventType: string,
  coveredGroups: ReadonlySet<string>,
): Promise<{ failed: number; total: number }> {
  const [{ data: tiles, error: tErr }, { data: vocab, error: vErr }] = await Promise.all([
    admin.from('service_categories').select('id, parent_id, applicable_event_types').eq('tier', 2).eq('status', 'active'),
    admin.from('event_type_vocab').select('event_type').eq('status', 'active'),
  ]);
  if (tErr || vErr) {
    logQueryError('setNewTypeCoverage.read', (tErr ?? vErr)!, { event_type: eventType }, 'graceful_degrade');
    return { failed: 1, total: 1 };
  }
  const activeTypes = ((vocab ?? []) as { event_type: string }[]).map((r) => r.event_type);
  const rows = (tiles ?? []) as { id: string; parent_id: string | null; applicable_event_types: string[] | null }[];
  let failed = 0;
  for (const t of rows) {
    const offered = t.parent_id !== null && coveredGroups.has(t.parent_id);
    const before = t.applicable_event_types ?? null;
    const next = nextEventTypes(before, eventType, offered, activeTypes);
    if (JSON.stringify(next) === JSON.stringify(before)) continue;
    const { error } = await admin.from('service_categories').update({ applicable_event_types: next }).eq('id', t.id);
    if (error) {
      failed += 1;
      logQueryError('setNewTypeCoverage.write', error, { tile_id: t.id, event_type: eventType }, 'graceful_degrade');
    }
  }
  return { failed, total: rows.length };
}
