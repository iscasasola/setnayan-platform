import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { regionLabel } from '@/lib/region-source';

/**
 * inquiry-mask.server.ts — server-only companions to lib/inquiry-mask.ts for
 * vendor inquiry anonymization-until-accept (Glass PR-6b). Region resolution +
 * the admin-scoped, non-identifying fact read live here so the pure primitives
 * stay dependency-free + unit-testable. Re-exports the pure predicate/placeholder
 * for one-stop imports on the server.
 */
export { isInquiryRevealed, inquiryPlaceholderLabel } from '@/lib/inquiry-mask';

/** City/area-level label from a region slug — never a venue name or address. */
export function inquiryCityLabel(region: string | null | undefined): string | null {
  return regionLabel(region);
}

/** The non-identifying facts needed to render a masked inquiry placeholder. */
export type InquiryMaskMeta = { eventType: string | null; city: string | null };

/**
 * Batched, admin-scoped read of the non-identifying facts (event type +
 * city-level region) for a set of PENDING inquiries' events. The caller passes
 * the event ids of its OWN unrevealed vendor threads; a vendor holds no `events`
 * RLS (not an event_members row until they've booked), so this mirrors the same
 * admin-scoped read pattern already used by vendor-overview.ts / the customers
 * hub — but deliberately selects ONLY `event_type` + `region`, never
 * `display_name` / `venue` / any PII. Best-effort: any error → empty map, and
 * the surface falls back to the generic "A couple planning an event".
 */
export async function fetchInquiryMaskMeta(
  admin: SupabaseClient,
  eventIds: string[],
): Promise<Map<string, InquiryMaskMeta>> {
  const out = new Map<string, InquiryMaskMeta>();
  const ids = Array.from(new Set(eventIds.filter(Boolean)));
  if (ids.length === 0) return out;
  try {
    const { data } = await admin
      .from('events')
      .select('event_id, event_type, region')
      .in('event_id', ids);
    for (const row of (data ?? []) as Array<{
      event_id: string;
      event_type: string | null;
      region: string | null;
    }>) {
      out.set(row.event_id, {
        eventType: row.event_type,
        city: regionLabel(row.region),
      });
    }
  } catch {
    // Best-effort — never let placeholder enrichment break the inbox.
  }
  return out;
}
