import type { SupabaseClient } from '@supabase/supabase-js';
import {
  ATTRIBUTE_FIELD_NAME_PREFIX,
  computeAttributeCompleteness,
  fetchSchemaWithSharedGroups,
  isAttributeFieldFilled,
  isChipRefinementType,
  parseAttributeFieldValue,
} from '@/lib/vendor-service-attributes';

/**
 * vendor-service-refinements-write.ts — THE ONE MERGE of a card's chip-shaped details ("refinements") into
 * `vendor_service_attributes`, shared by the inline "Save refinements" form (`saveServiceRefinements`) and the
 * simpler maker's one save (`commitVendorService`, the "Details" fold — 2026-10-14). Moved here verbatim from
 * refinement-actions.ts so the two doors cannot merge two ways.
 *
 * Refinements are keyed by (vendor_profile_id, canonical_service) — a card's category IS a canonical_service — and
 * this MERGES, never replaces: only the submitted chip keys (`refinement_keys`, re-validated against the live schema
 * and re-checked to be chip-shaped) are overlaid; the heavier int / free-text fields set in the full attributes tool
 * are left alone. Visibility + completeness are recomputed over the FULL merged payload.
 *
 * Returns an error sentence, or null when written (or when the kind has no refinements schema — nothing to write).
 */
export async function mergeServiceRefinements(
  supabase: SupabaseClient,
  vendorProfileId: string,
  canonicalService: string,
  formData: FormData,
  /** Already read by the caller — passed so the schema is read once per save. */
  preRead?: Awaited<ReturnType<typeof fetchSchemaWithSharedGroups>>,
): Promise<string | null> {
  const schema = preRead !== undefined ? preRead : await fetchSchemaWithSharedGroups(supabase, canonicalService);
  if (!schema) return null;

  const { data: existingRow } = await supabase
    .from('vendor_service_attributes')
    .select('attribute_payload')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('canonical_service', canonicalService)
    .maybeSingle();
  const merged: Record<string, unknown> = {
    ...(((existingRow?.attribute_payload as Record<string, unknown>) ?? {})),
  };

  const ownedKeys = String(formData.get('refinement_keys') ?? '')
    .split(',')
    .map((k) => k.trim())
    .filter((k) => k.length > 0);

  const errors: string[] = [];
  for (const key of ownedKeys) {
    const def = schema.fields[key];
    if (!def || !isChipRefinementType(def.type)) continue;
    const rawValues = formData.getAll(`${ATTRIBUTE_FIELD_NAME_PREFIX}${key}`);
    const parsed = parseAttributeFieldValue(key, def, rawValues);
    if (!parsed.ok) {
      errors.push(parsed.reason);
      continue;
    }
    if (isAttributeFieldFilled(parsed.value)) merged[key] = parsed.value;
    else delete merged[key];
  }
  if (errors.length > 0) return errors.join('; ');

  const minimumFields = schema.required_for_visibility.minimum_fields ?? [];
  const meetsVisibility = minimumFields.every((k) => isAttributeFieldFilled(merged[k]));
  const completeness = await computeAttributeCompleteness(supabase, merged, schema.fields);

  const { error: upsertErr } = await supabase.from('vendor_service_attributes').upsert(
    {
      vendor_profile_id: vendorProfileId,
      canonical_service: canonicalService,
      attribute_payload: merged,
      schema_version_at_fill: schema.schema_version,
      completeness_score: completeness,
      meets_visibility_minimum: meetsVisibility,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'vendor_profile_id,canonical_service' },
  );
  return upsertErr ? upsertErr.message : null;
}
