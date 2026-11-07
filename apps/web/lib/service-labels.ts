import 'server-only';
import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import { logQueryError } from '@/lib/supabase/error-detect';

/**
 * service-labels.ts — THE COUPLE-FACING NAME OF A SERVICE (tier 3 of Group › Category › Service › Part).
 *
 * Admin-managed: `canonical_service_schemas.display_name_en`, the same column Admin › Categories edits
 * (`admin/categories/_components/load.ts`). Never a label map in code (owner 2026-10-29, Find v4) and never the key
 * itself on screen — `vendor_services.category` is a key like `hair_touchup_station`.
 *
 * One read per request (React `cache`), of a few hundred short rows — read-all under RLS, as the facet catalog reads
 * the same table through the couple's session (`lib/vendor-facets.ts`).
 *
 * A key with no row (or a failed read) falls back to its own words with the underscores read as spaces — the one
 * honest spelling we have — and the read failure is logged, never thrown: a missing label must not cost the couple
 * the list.
 */
export const readServiceLabels = cache(async (): Promise<Record<string, string>> => {
  try {
    const sb = await createClient();
    const { data, error } = await sb.from('canonical_service_schemas').select('canonical_service, display_name_en');
    if (error) {
      logQueryError('service-labels: canonical_service_schemas', error, {}, 'graceful_degrade');
      return {};
    }
    const out: Record<string, string> = {};
    for (const r of (data ?? []) as { canonical_service: string; display_name_en: string | null }[]) {
      const label = (r.display_name_en ?? '').trim();
      if (r.canonical_service && label) out[r.canonical_service] = label;
    }
    return out;
  } catch {
    return {};
  }
});

/** The label for a key: the admin's, else the key's own words ("hair_touchup_station" → "Hair touchup station"). */
export function serviceLabelOf(labels: Readonly<Record<string, string>>, key: string): string {
  const own = labels[key];
  if (own) return own;
  const words = key.replace(/_/g, ' ').trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : key;
}
