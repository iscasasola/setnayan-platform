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

/* ────────────────────────────────────────────────────────────────────────
 * Shared attribute-field PARSING (single source of truth)
 *
 * Both the full /vendor-dashboard/attributes tool AND the inline refinement
 * chips on the fast service-card form parse FormData into a typed payload the
 * exact same way. These helpers used to live privately inside
 * attributes/actions.ts; they're hoisted here so the two write paths can never
 * drift on parse semantics. Pure functions — no Supabase, no server-only deps.
 * ──────────────────────────────────────────────────────────────────────── */

/** FormData field-name prefix — an input for `shooting_style` is named
 *  `field__shooting_style`. Shared by every attribute form + parser. */
export const ATTRIBUTE_FIELD_NAME_PREFIX = 'field__';

// Sample audio / video URL fields per the 2026-05-20 showcase-pattern lock
// (CLAUDE.md decision log): only YouTube + Vimeo URLs are accepted.
export const YOUTUBE_VIMEO_URL_RE =
  /^https?:\/\/(www\.)?(youtube\.com|youtu\.be|youtube-nocookie\.com|vimeo\.com|player\.vimeo\.com)\//i;

export function isSampleUrlField(fieldKey: string): boolean {
  return fieldKey.endsWith('_audio_urls') || fieldKey.endsWith('_video_urls');
}

export type ParsedAttributeValue =
  | { ok: true; value: unknown }
  | { ok: false; reason: string };

/**
 * Parse the raw FormData values for a single field against its declared type.
 * Returns `{ value: null }` for unset fields; a friendly `reason` on invalid
 * input. Byte-for-byte the same logic the attributes tool has always used.
 */
export function parseAttributeFieldValue(
  fieldKey: string,
  def: AttributeFieldDef,
  rawValues: FormDataEntryValue[],
): ParsedAttributeValue {
  if (rawValues.length === 0) return { ok: true, value: null };
  switch (def.type) {
    case 'boolean': {
      const hasOn = rawValues.some(
        (v) => typeof v === 'string' && (v === 'on' || v === 'true'),
      );
      return { ok: true, value: hasOn };
    }
    case 'int': {
      const raw = String(rawValues[0] ?? '').trim();
      if (raw === '') return { ok: true, value: null };
      const n = Number(raw);
      if (!Number.isFinite(n) || !Number.isInteger(n)) {
        return { ok: false, reason: `${fieldKey}: must be a whole number` };
      }
      if (typeof def.min === 'number' && n < def.min) {
        return { ok: false, reason: `${fieldKey}: minimum is ${def.min}` };
      }
      if (typeof def.max === 'number' && n > def.max) {
        return { ok: false, reason: `${fieldKey}: maximum is ${def.max}` };
      }
      return { ok: true, value: n };
    }
    case 'text_short':
    case 'text_long': {
      const raw = String(rawValues[0] ?? '').trim();
      return { ok: true, value: raw === '' ? null : raw };
    }
    case 'enum': {
      const raw = String(rawValues[0] ?? '').trim();
      if (raw === '') return { ok: true, value: null };
      const allowed = (def.options ?? []) as readonly string[];
      if (!allowed.includes(raw)) {
        return { ok: false, reason: `${fieldKey}: invalid option "${raw}"` };
      }
      return { ok: true, value: raw };
    }
    case 'multi_select': {
      const allowed = new Set((def.options ?? []) as readonly string[]);
      const filtered: string[] = [];
      for (const v of rawValues) {
        if (typeof v !== 'string') continue;
        const trimmed = v.trim();
        if (!allowed.has(trimmed)) continue;
        if (filtered.includes(trimmed)) continue;
        filtered.push(trimmed);
      }
      return { ok: true, value: filtered.length > 0 ? filtered : null };
    }
    case 'multi_select_open': {
      const out: string[] = [];
      const seen = new Set<string>();
      const isUrlField = isSampleUrlField(fieldKey);
      for (const v of rawValues) {
        if (typeof v !== 'string') continue;
        for (const piece of v.split(',')) {
          const trimmed = piece.trim().slice(0, 256);
          if (trimmed.length === 0) continue;
          if (isUrlField && !YOUTUBE_VIMEO_URL_RE.test(trimmed)) {
            return {
              ok: false,
              reason: `${fieldKey}: "${trimmed.slice(0, 60)}" is not a YouTube or Vimeo URL`,
            };
          }
          const lc = trimmed.toLowerCase();
          if (seen.has(lc)) continue;
          seen.add(lc);
          out.push(trimmed);
          if (out.length >= 50) break;
        }
        if (out.length >= 50) break;
      }
      return { ok: true, value: out.length > 0 ? out : null };
    }
    default:
      return { ok: true, value: null };
  }
}

/** required_if format: "other_field=value" — field is required only when the
 *  other field equals the value. Falls back to `def.required` when unset. */
export function checkAttributeConditionalRequired(
  payload: Record<string, unknown>,
  def: AttributeFieldDef,
): boolean {
  if (!def.required_if) return def.required === true;
  const [otherKey, expectedValue] = def.required_if.split('=');
  if (!otherKey) return false;
  const otherActual = payload[otherKey];
  if (Array.isArray(otherActual)) {
    return otherActual.includes(expectedValue ?? '');
  }
  return String(otherActual ?? '') === (expectedValue ?? '');
}

export function isAttributeFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (typeof value === 'string') return value.length > 0;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Compute the 0-100 completeness score for a payload against a full field map.
 * Prefers the SQL helper `compute_attribute_completeness` (so the number stays
 * consistent with admin queries that call it directly) and falls back to a
 * JS-side filled/total ratio if the RPC errors. Mirrors the inline logic the
 * attributes tool has used since iteration 0044.
 */
export async function computeAttributeCompleteness(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
  fields: Record<string, AttributeFieldDef>,
): Promise<number> {
  const { data: scoreRow, error } = await supabase.rpc(
    'compute_attribute_completeness',
    { payload, schema: fields },
  );
  if (!error && typeof scoreRow === 'number' && Number.isFinite(scoreRow)) {
    return Math.max(0, Math.min(100, Math.round(scoreRow)));
  }
  const totalFields = Object.keys(fields).length;
  const filledFields = Object.keys(fields).filter((k) =>
    isAttributeFieldFilled(payload[k]),
  ).length;
  return totalFields === 0 ? 0 : Math.round((filledFields * 100) / totalFields);
}

/* ────────────────────────────────────────────────────────────────────────
 * Inline "refinement chips" for the fast service-card form
 *
 * The fast form surfaces only the CHIP-shaped, category-specific refinements
 * (multi_select / enum / boolean) so a vendor can tag the leaf's facets
 * without leaving the card. The heavier fields (int / free-text / URL lists)
 * and the shared faith/dietary/region groups stay in the full attributes
 * tool. Same underlying vendor_service_attributes row — keyed by
 * canonical_service, which is exactly a vendor_services.category value.
 * ──────────────────────────────────────────────────────────────────────── */

/** The field types that render naturally as inline chips. */
export const CHIP_REFINEMENT_TYPES = ['multi_select', 'enum', 'boolean'] as const;

export function isChipRefinementType(type: AttributeFieldDef['type']): boolean {
  return (CHIP_REFINEMENT_TYPES as readonly string[]).includes(type);
}

export type CategoryRefinements = {
  canonical_service: string;
  /** Chip-shaped category-specific fields only, in declaration order. */
  fields: Record<string, AttributeFieldDef>;
  /** filter_facets verbatim — used to flag which chips are marketplace filters. */
  filter_facets: string[];
};

function pickChipFields(
  categoryAttributes: Record<string, AttributeFieldDef> | null | undefined,
): Record<string, AttributeFieldDef> {
  const fields: Record<string, AttributeFieldDef> = {};
  for (const [key, def] of Object.entries(categoryAttributes ?? {})) {
    if (def && isChipRefinementType(def.type)) fields[key] = def;
  }
  return fields;
}

/**
 * Read the chip-shaped refinements for one leaf (canonical_service). Returns
 * null when the category has no schema row or no chip-shaped fields — callers
 * simply render nothing in that case (graceful; ~9% of categories have no
 * schema yet). Reads ONLY category_specific_attributes — the shared
 * faith/dietary/region/pricing groups are surfaced by their own dedicated UI
 * (Serves checklist, coverage, pricing editor) and must not be duplicated here.
 */
export async function fetchCategoryChipRefinements(
  supabase: SupabaseClient,
  canonicalService: string,
): Promise<CategoryRefinements | null> {
  const { data, error } = await supabase
    .from('canonical_service_schemas')
    .select('canonical_service, category_specific_attributes, filter_facets')
    .eq('canonical_service', canonicalService)
    .maybeSingle();
  if (error) {
    throw new Error(`fetchCategoryChipRefinements failed: ${error.message}`);
  }
  if (!data) return null;

  const fields = pickChipFields(
    data.category_specific_attributes as Record<string, AttributeFieldDef> | null,
  );
  if (Object.keys(fields).length === 0) return null;

  return {
    canonical_service: data.canonical_service as string,
    fields,
    filter_facets: Array.isArray(data.filter_facets)
      ? (data.filter_facets as string[])
      : [],
  };
}

/**
 * Batch variant of {@link fetchCategoryChipRefinements} for the services
 * manager, which needs refinements for several categories at once. One round
 * trip; returns a Map keyed by canonical_service (only entries that have
 * chip-shaped fields are present).
 */
export async function fetchCategoryChipRefinementsMany(
  supabase: SupabaseClient,
  canonicalServices: string[],
): Promise<Map<string, CategoryRefinements>> {
  const out = new Map<string, CategoryRefinements>();
  const unique = Array.from(new Set(canonicalServices.filter(Boolean)));
  if (unique.length === 0) return out;

  const { data, error } = await supabase
    .from('canonical_service_schemas')
    .select('canonical_service, category_specific_attributes, filter_facets')
    .in('canonical_service', unique);
  if (error) {
    throw new Error(`fetchCategoryChipRefinementsMany failed: ${error.message}`);
  }

  for (const row of (data ?? []) as {
    canonical_service: string;
    category_specific_attributes: Record<string, AttributeFieldDef> | null;
    filter_facets: unknown;
  }[]) {
    const fields = pickChipFields(row.category_specific_attributes);
    if (Object.keys(fields).length === 0) continue;
    out.set(row.canonical_service, {
      canonical_service: row.canonical_service,
      fields,
      filter_facets: Array.isArray(row.filter_facets)
        ? (row.filter_facets as string[])
        : [],
    });
  }
  return out;
}
