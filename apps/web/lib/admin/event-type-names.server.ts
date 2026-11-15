import 'server-only';

import { getEventTypeVocab } from '@/lib/event-types-db';
import { eventTypeLabel as fallbackLabel } from '@/lib/admin/intelligence-stats';

/** An event type's display name, by its key. */
export type EventTypeName = (key: string | null | undefined) => string;

/**
 * 🏷 ONE NAME PER EVENT TYPE ON EVERY ADMIN PAGE (admin walk 13 Nov 2026, F-A-15: the console read "simple event" and
 * "date" — the raw key with its underscore swapped for a space — wherever a hand-kept label map had no entry). The name
 * is the admin-managed `event_type_vocab.label_en` ("Get-together"), read through the shipped, remembered
 * `getEventTypeVocab`; a key the list does not hold (or a refused read) falls to the old map, then to the key itself.
 */
export async function readEventTypeNames(): Promise<EventTypeName> {
  const rows = await getEventTypeVocab().catch(() => []);
  const names = new Map(rows.map((r) => [r.key, r.label] as const));
  return (key) => {
    if (!key) return '—';
    return names.get(key)?.trim() || fallbackLabel(key);
  };
}
