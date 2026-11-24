import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import { isHubToolTemplate, suggestedHubTools, type HubToolRecord, type HubToolTemplate } from '@/lib/hub-tools';

/**
 * 💡 THE HUB TOOLS A BOOKING STARTS WITH (DECISION_LOG 2026-11-23, the most-shared unbuilt hub tools). Reads Admin ›
 * Categories › Hub tools for the booked categories (`service_categories.id` = the booked tile keys) — the library
 * (`hub_tools`, active only), the scan settings and the switches — and hands them to the pure `suggestedHubTools`.
 * Every signed-in account may read these four (migration 20271330825868: SELECT … USING (true)).
 *
 * `inactive`: tools admin turned off ("Turn off keeps data") — they leave every Hub.
 * A refused read answers null: the caller then suggests nothing and hides nothing, so every tool is still one switch
 * away. A suggestion is never a gate.
 */
export type HubToolSuggestions = { suggested: ReadonlySet<string>; inactive: ReadonlySet<string> };

export async function readHubToolSuggestions(
  supabase: SupabaseClient,
  categoryIds: readonly string[] | null,
): Promise<HubToolSuggestions | null> {
  const ids = [...new Set((categoryIds ?? []).filter((c) => typeof c === 'string' && c.length > 0))];
  const [libRes, catRes, setRes, swRes] = await Promise.all([
    supabase.from('hub_tools').select('tool_key, label, template, is_active').order('sort_order'),
    ids.length ? supabase.from('service_categories').select('id, label_en').in('id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from('category_hub_settings').select('category_id, scan_default').in('category_id', ids) : Promise.resolve({ data: [], error: null }),
    ids.length ? supabase.from('category_hub_tool_switches').select('category_id, tool_key').in('category_id', ids) : Promise.resolve({ data: [], error: null }),
  ]);
  const failed = [libRes, catRes, setRes, swRes].find((r) => r.error);
  if (failed) {
    logQueryError('readHubToolSuggestions', failed.error, { categories: ids.join(',') }, 'graceful_degrade');
    return null;
  }
  const rows = (libRes.data ?? []) as Array<{ tool_key: string; label: string; template: string; is_active: boolean }>;
  const library: HubToolRecord[] = rows
    .filter((r) => r.is_active && isHubToolTemplate(r.template))
    .map((r) => ({ key: r.tool_key, label: r.label, template: r.template as HubToolTemplate }));
  const inactive = new Set(rows.filter((r) => !r.is_active).map((r) => r.tool_key));
  // A booked key with no category row still suggests by its own name (the seed matches names loosely).
  const found = (catRes.data ?? []) as Array<{ id: string; label_en: string | null }>;
  const categories = ids.map((id) => ({ id, label: found.find((c) => c.id === id)?.label_en ?? id.replace(/_/g, ' ') }));
  return {
    suggested: suggestedHubTools({
      categories,
      settings: (setRes.data ?? []) as Array<{ category_id: string; scan_default: string | null }>,
      switches: (swRes.data ?? []) as Array<{ category_id: string; tool_key: string }>,
      library,
    }),
    inactive,
  };
}
