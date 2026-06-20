import type { SupabaseClient } from '@supabase/supabase-js';
import { fetchSchemaWithSharedGroups } from '@/lib/vendor-service-attributes';

/**
 * requirements-capture — the COUPLE side of the per-category facet schema
 * (Phase 1b PR-3). When a couple inquires about a leaf service category, we
 * surface the SAME admin-defined `multi_select` facets the vendor fills (from
 * `canonical_service_schemas.category_specific_attributes`) as a checkbox
 * "what we're looking for" capture. The couple's picks persist to
 * `event_vendor_preferences.attribute_payload` (keyed by canonical_service)
 * via `setEventPreference`, and get appended to the inquiry message body so
 * the vendor sees them on first contact.
 *
 * We intentionally surface ONLY `multi_select` fields here: those are the
 * "pick what you want" facets that read naturally as couple preferences
 * (shooting styles, coverage scope, dietary accommodations, …). The other
 * field types (int / text / enum / boolean / multi_select_open) are
 * vendor-completeness inputs ("wedding count handled", "response-time SLA"),
 * not couple-facing requirements, so they're filtered out.
 *
 * Graceful-degrade: a leaf with no schema row, or a schema with no
 * multi_select fields, yields an empty list — the pop-up then shows only the
 * special-request box and never errors.
 */

/** One couple-facing requirement field: a labelled checkbox group. */
export type RequirementField = {
  /** The attribute_payload key (e.g. 'shooting_styles'). */
  key: string;
  /** Human label (from the schema's `label`, else humanized key). */
  label: string;
  /** The fixed checkbox options (raw values; humanize for display). */
  options: string[];
};

/** Humanize a raw snake_case option/key for display. */
export function humanizeFacet(value: string): string {
  return value.replaceAll('_', ' ');
}

/**
 * Resolve the couple-facing `multi_select` requirement fields for a leaf
 * canonical_service. Returns [] when the leaf has no schema or no
 * multi_select fields (never throws — fetchSchemaWithSharedGroups can throw,
 * so we swallow and degrade to no fields).
 */
export async function fetchRequirementFields(
  client: SupabaseClient,
  canonicalService: string | null,
): Promise<RequirementField[]> {
  const key = (canonicalService ?? '').trim();
  if (!key) return [];
  let resolved;
  try {
    resolved = await fetchSchemaWithSharedGroups(client, key);
  } catch {
    // Missing table / transient error → degrade to no fields. The pop-up
    // still works (special-request only) and the inquiry still sends.
    return [];
  }
  if (!resolved) return [];

  const fields: RequirementField[] = [];
  for (const [fieldKey, def] of Object.entries(resolved.fields)) {
    if (def.type !== 'multi_select') continue;
    const options = Array.isArray(def.options) ? def.options.filter((o) => typeof o === 'string') : [];
    if (options.length === 0) continue;
    fields.push({
      key: fieldKey,
      label: def.label ?? humanizeFacet(fieldKey),
      options: [...options],
    });
  }
  return fields;
}

/**
 * Whether a canonical_service key is a valid FK target for
 * event_vendor_preferences.canonical_service (i.e. a row exists in
 * canonical_service_schemas). The couple's leaf key comes from
 * vendor_services.category, which is ~1:1 with canonical_service — but a
 * handful of legacy categories have no schema row. Persisting against one of
 * those would violate the FK, so callers check this first and gracefully
 * SKIP the save (the inquiry still sends) when it returns false.
 *
 * Best-effort: a missing table (not-yet-migrated edge) returns false so the
 * caller skips rather than throwing.
 */
export async function isPersistableCanonicalService(
  client: SupabaseClient,
  canonicalService: string | null,
): Promise<boolean> {
  const key = (canonicalService ?? '').trim();
  if (!key) return false;
  const { data, error } = await client
    .from('canonical_service_schemas')
    .select('canonical_service')
    .eq('canonical_service', key)
    .maybeSingle();
  if (error) return false;
  return Boolean(data?.canonical_service);
}

/**
 * Build the "What we're looking for" block appended to the inquiry message
 * body so the vendor sees the couple's requirements on first contact.
 * Returns '' when there's nothing to show (no checked facets, no note).
 */
export function buildRequirementsBlock(
  payload: Record<string, string[]>,
  specialRequest: string | null,
): string {
  const lines: string[] = [];
  for (const [key, values] of Object.entries(payload)) {
    const picks = (values ?? []).filter((v) => typeof v === 'string' && v.trim().length > 0);
    if (picks.length === 0) continue;
    lines.push(`• ${humanizeFacet(key)}: ${picks.map(humanizeFacet).join(', ')}`);
  }
  const note = (specialRequest ?? '').trim();
  if (note.length > 0) lines.push(`• Special request: ${note}`);
  if (lines.length === 0) return '';
  return ['', '— What we’re looking for —', ...lines].join('\n');
}
