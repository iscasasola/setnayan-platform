import type { SupabaseClient } from '@supabase/supabase-js';
import { toIncludedTemplates, type IncludedTemplate } from '@/lib/included-templates';

/**
 * 📋 SETNAYAN'S STARTING "WHAT'S INCLUDED" FOR ONE SERVICE, read where the service is only known once it is picked:
 * the bare Add door (`/vendor-dashboard/services/new` and Today's setup sheet), where the kind is chosen ON the card
 * (owner, 18 Nov: "pre-fill the bare Add door too"). Runs with the signed-in supplier's own browser client — the
 * table is readable by every signed-in account (Pattern H, migration 20271351904391) — so no server action is spent.
 *
 * 🔒 `null` when the read was REFUSED, never `[]` (lib/guests.ts, reads-are-honest): `[]` would say "this service has
 * no starting list" when it may have one. The maker then pre-fills nothing and Load says it could not be read.
 * Same select and order as the server's library (`lib/card-maker-library.server.ts`).
 */
export async function loadIncludedTemplatesForService(
  supabase: SupabaseClient,
  service: string,
): Promise<IncludedTemplate[] | null> {
  const { data, error } = await supabase
    .from('service_included_templates')
    .select('template_id, name, rows, is_proposal, sort_order')
    .eq('canonical_service', service)
    .order('sort_order')
    .order('name');
  if (error) {
    console.error('[supabase-error] lib/included-templates-read.ts · from:service_included_templates.select', error);
    return null;
  }
  return toIncludedTemplates((data ?? []) as { template_id: string; name: string; rows: unknown; is_proposal: boolean }[]);
}
