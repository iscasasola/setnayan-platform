import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  AttributeFieldDef,
  CanonicalServiceSchema,
  SharedAttributeGroup,
} from '@/lib/marketplaces/schemas';

/**
 * Iteration 0044 — vendor-side per-category attribute payload helpers.
 *
 * canonical_service_schemas (one row per canonical_service) declares the
 * shape; shared_attribute_groups (faith_compatibility, dietary_accommodations,
 * etc.) provide reusable field bundles inherited by name; vendor_service_attributes
 * stores each vendor's filled values per canonical_service.
 *
 * Three reads, one write:
 *   - fetchSchemaWithSharedGroups: pulls a canonical_service_schemas row +
 *     resolves its shared_attribute_groups names into the matching rows,
 *     flattens fields into a single field map for the form renderer.
 *   - fetchVendorServiceAttributes: pulls the vendor's saved payloads keyed
 *     by canonical_service.
 *   - listCanonicalServices: lightweight catalog read for the "add a service"
 *     picker (display_name + canonical_service only).
 *   - saveVendorServiceAttribute: upserts a per-service payload + recomputes
 *     completeness_score via the SQL function from migration 20260521010000.
 */

export type ResolvedSchema = {
  canonical_service: string;
  display_name_en: string;
  display_name_tl: string | null;
  schema_version: number;
  /** Merged map of every field — category-specific + each shared group's
   *  contributions. Insertion order: category fields first, then groups in
   *  declaration order. Form renderer iterates this for the field list. */
  fields: Record<string, AttributeFieldDef>;
  /** filter_facets array verbatim — surfaces the field keys the marketplace
   *  sidebar will use. Useful for the form to mark "this is a marketplace
   *  filter" alongside the input. */
  filter_facets: string[];
  required_for_visibility: {
    minimum_fields?: string[];
    minimum_uploads?: Record<string, number>;
    minimum_products?: number;
    minimum_sample_audio?: number;
    minimum_sample_video?: number;
  };
};

export async function fetchSchemaWithSharedGroups(
  supabase: SupabaseClient,
  canonicalService: string,
): Promise<ResolvedSchema | null> {
  const { data: schemaRow, error } = await supabase
    .from('canonical_service_schemas')
    .select(
      'canonical_service, display_name_en, display_name_tl, schema_version, shared_attribute_groups, category_specific_attributes, filter_facets, required_for_visibility',
    )
    .eq('canonical_service', canonicalService)
    .maybeSingle();
  if (error) throw new Error(`fetchSchemaWithSharedGroups failed: ${error.message}`);
  if (!schemaRow) return null;

  const sharedNames: string[] = Array.isArray(schemaRow.shared_attribute_groups)
    ? (schemaRow.shared_attribute_groups as string[])
    : [];

  let sharedRows: SharedAttributeGroup[] = [];
  if (sharedNames.length > 0) {
    const { data: groups, error: groupErr } = await supabase
      .from('shared_attribute_groups')
      .select('group_name, display_name_en, display_name_tl, attributes')
      .in('group_name', sharedNames);
    if (groupErr) throw new Error(`shared groups fetch failed: ${groupErr.message}`);
    sharedRows = (groups ?? []) as SharedAttributeGroup[];
  }

  // Merge: category_specific_attributes first, then each shared group in
  // declaration order. The form renderer relies on this ordering so faith /
  // dietary / pricing groups always sit beneath the category-specific block.
  const fields: Record<string, AttributeFieldDef> = {};
  const catFields = (schemaRow.category_specific_attributes ?? {}) as Record<
    string,
    AttributeFieldDef
  >;
  for (const [key, def] of Object.entries(catFields)) fields[key] = def;
  for (const groupName of sharedNames) {
    const group = sharedRows.find((g) => g.group_name === groupName);
    if (!group) continue;
    const groupFields = (group.attributes ?? {}) as Record<string, AttributeFieldDef>;
    for (const [key, def] of Object.entries(groupFields)) {
      if (key in fields) continue; // category-specific wins on collision
      fields[key] = def;
    }
  }

  return {
    canonical_service: schemaRow.canonical_service as string,
    display_name_en: schemaRow.display_name_en as string,
    display_name_tl: (schemaRow.display_name_tl as string | null) ?? null,
    schema_version: (schemaRow.schema_version as number) ?? 1,
    fields,
    filter_facets: Array.isArray(schemaRow.filter_facets)
      ? (schemaRow.filter_facets as string[])
      : [],
    required_for_visibility: (schemaRow.required_for_visibility ??
      {}) as ResolvedSchema['required_for_visibility'],
  };
}

export type VendorAttributePayload = {
  vendor_profile_id: string;
  canonical_service: string;
  attribute_payload: Record<string, unknown>;
  schema_version_at_fill: number;
  completeness_score: number;
  meets_visibility_minimum: boolean;
  updated_at: string;
};

export async function fetchVendorServiceAttributes(
  supabase: SupabaseClient,
  vendorProfileId: string,
): Promise<VendorAttributePayload[]> {
  const { data, error } = await supabase
    .from('vendor_service_attributes')
    .select(
      'vendor_profile_id, canonical_service, attribute_payload, schema_version_at_fill, completeness_score, meets_visibility_minimum, updated_at',
    )
    .eq('vendor_profile_id', vendorProfileId)
    .order('canonical_service', { ascending: true });
  if (error) throw new Error(`fetchVendorServiceAttributes failed: ${error.message}`);
  return (data ?? []) as VendorAttributePayload[];
}

export type CanonicalServiceCatalogRow = {
  canonical_service: string;
  display_name_en: string;
  display_name_tl: string | null;
};

export async function listCanonicalServices(
  supabase: SupabaseClient,
): Promise<CanonicalServiceCatalogRow[]> {
  const { data, error } = await supabase
    .from('canonical_service_schemas')
    .select('canonical_service, display_name_en, display_name_tl')
    .order('display_name_en', { ascending: true });
  if (error) throw new Error(`listCanonicalServices failed: ${error.message}`);
  return (data ?? []) as CanonicalServiceCatalogRow[];
}
