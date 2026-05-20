// Iteration 0044 — per-category vendor attribute schema types.
//
// Mirrors the 3 tables landed in 20260521010000_iteration_0044... Schema
// content (filter facets, attribute lists, completeness rules) is intentionally
// loose-JSON here because the concrete schemas land in a later PR and the
// shape varies per canonical_service. Consumers that need strict types for a
// specific category should narrow at the call site.

/**
 * Field-level schema definition. Lives inside
 * canonical_service_schemas.category_specific_attributes (one key per field)
 * and inside shared_attribute_groups.attributes. Loose by design — each
 * field type has different config (multi_select needs options, int needs
 * min/max, etc.).
 */
export type AttributeFieldDef = {
  type:
    | 'boolean'
    | 'int'
    | 'text_short'
    | 'text_long'
    | 'enum'
    | 'multi_select'
    | 'multi_select_open';
  label?: string;
  required?: boolean;
  options?: readonly string[];
  default?: unknown;
  min?: number;
  max?: number;
  // Conditional requirement — e.g. tasting_fee_centavos is required when
  // tasting_availability='paid_tasting'. The string is "field=value" parsed
  // by the form-validation layer at write time.
  required_if?: string;
};

export type CanonicalServiceSchema = {
  canonical_service: string;
  schema_version: number;
  display_name_en: string;
  display_name_tl: string | null;
  display_name_ceb: string | null;
  shared_attribute_groups: string[];
  category_specific_attributes: Record<string, AttributeFieldDef>;
  // Which fields render in the marketplace filter sidebar. Order matters —
  // the sidebar renders them in this sequence.
  filter_facets: string[];
  required_for_visibility: {
    minimum_fields?: string[];
    minimum_uploads?: Record<string, number>;
    minimum_products?: number;
  };
  ranking_signal_weights: Record<string, number>;
  created_at: string;
  updated_at: string;
};

export type SharedAttributeGroup = {
  group_name: string;
  display_name_en: string;
  display_name_tl: string | null;
  attributes: Record<string, AttributeFieldDef>;
  created_at: string;
  updated_at: string;
};

export type VendorServiceAttributes = {
  vendor_profile_id: string;
  canonical_service: string;
  attribute_payload: Record<string, unknown>;
  schema_version_at_fill: number;
  completeness_score: number;
  meets_visibility_minimum: boolean;
  created_at: string;
  updated_at: string;
};
