import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * vendor-facets — the STRUCTURED-ATTRIBUTE refinement layer for the couple's
 * category search (the in-place overlay in dashboard/[eventId]/vendors).
 *
 * Three tables, all iteration 0044 / Vendor_Match_Personalization_2026-06-01:
 *   • canonical_service_schemas  — defines the selectable facets per category
 *     (filter_facets[] + category_specific_attributes{} + shared_attribute_groups[]).
 *   • shared_attribute_groups    — reusable attribute definitions the schemas
 *     reference by group_name (cuisine/faith/dietary/… field defs live here).
 *   • vendor_service_attributes  — a vendor's actual facet values
 *     (attribute_payload{}) per canonical_service.
 *
 * This module is the COUPLE-selectable sibling of lib/preference-match.ts (which
 * matches SAVED event_vendor_preferences). Both compute per-dimension ARRAY
 * OVERLAP — a vendor "matches" a dimension when the couple's chosen values ∩ the
 * vendor's facet tags is non-empty. It FLOATS matches up + optionally hard-filters
 * TAGGED-but-unmatched vendors; it NEVER drops a vendor merely for having no
 * attribute row (graceful degrade — an unjudgeable vendor is always admitted).
 *
 * Graceful-degrade everywhere: a not-yet-migrated table (42P01) / missing column
 * (42703) / any read error / no data collapses to an EMPTY catalog + EMPTY match
 * map, so the category search behaves EXACTLY as it does today. Inert in
 * production until vendors carry facet payloads (vendor_service_attributes is
 * empty in prod today), then activates automatically — same "ship the read, light
 * up when data exists" posture as event-preferences.ts / preference-match.ts.
 *
 * Scope note: only MULTI_SELECT + ENUM facets (string[] / string payloads) are
 * surfaced, so matching reuses the proven string-overlap semantics. Boolean
 * facets (faith/dietary — already handled by the outer taxonomy faith gate) and
 * numeric range facets are intentionally out of this additive pass.
 */

/** One selectable option inside a facet dimension. */
export type FacetOption = { value: string; label: string };

/** A selectable facet dimension for the refinement UI (chips in the overlay). */
export type FacetDimension = {
  /** The attribute_payload key (e.g. 'cuisine_specialties'). */
  key: string;
  /** Human label ('Cuisine specialties'). */
  label: string;
  /** Allowed values (from the schema's option list). */
  options: FacetOption[];
};

/** The couple's facet selection: dimension key → chosen option values. */
export type FacetSelection = Record<string, string[]>;

/** Per-vendor facet-match result against a selection. */
export type VendorFacetMatch = {
  /** Dimensions where the vendor overlaps ≥1 selected value. */
  matchedCount: number;
  /** Dimensions the couple selected values on (same for every vendor). */
  selectedCount: number;
};

/** Cap the refinement UI so a mega-schema can't flood the sheet. */
const MAX_DIMENSIONS = 6;
const MAX_OPTIONS_PER_DIMENSION = 16;

/** Missing-table / missing-column shape error (tables not migrated yet). */
function isShapeError(code: string | undefined): boolean {
  return code === '42P01' || code === '42703';
}

/** snake_case token → "Title Case" label. */
function humanizeToken(token: string): string {
  return token
    .split('_')
    .filter((w) => w.length > 0)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}

/** Facet payload values are string[] tags; coerce defensively. */
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string' && v.length > 0) return [v];
  return [];
}

/** The dimensions in a payload that carry ≥1 value, as dimension → value set. */
function expressedDimensions(
  payload: Record<string, unknown>,
): Map<string, Set<string>> {
  const dims = new Map<string, Set<string>>();
  for (const [k, v] of Object.entries(payload ?? {})) {
    const vals = toStringArray(v);
    if (vals.length > 0) dims.set(k, new Set(vals));
  }
  return dims;
}

/** Merge a payload's dimensions into an accumulator (union of values per dim). */
function mergeDimensions(
  acc: Map<string, Set<string>>,
  payload: Record<string, unknown>,
): void {
  for (const [dim, vals] of expressedDimensions(payload)) {
    const set = acc.get(dim) ?? new Set<string>();
    for (const v of vals) set.add(v);
    acc.set(dim, set);
  }
}

type FieldDef = { type?: string; label?: string; options?: unknown };

/** A field def is a selectable facet iff it's a multi_select/enum with options. */
function selectableOptions(def: FieldDef | undefined): string[] | null {
  if (!def) return null;
  if (def.type !== 'multi_select' && def.type !== 'enum') return null;
  const opts = Array.isArray(def.options)
    ? def.options.filter((o): o is string => typeof o === 'string')
    : [];
  return opts.length > 0 ? opts : null;
}

/**
 * Build the selectable facet catalog for a category's canonical_services.
 *
 * Reads canonical_service_schemas + the shared_attribute_groups they reference,
 * resolves each `filter_facets` entry against the merged field definitions, and
 * keeps only the multi_select/enum dimensions (deduped across services). Returns
 * an EMPTY array on any read error / no schema — the overlay then renders no
 * facet chips and the search is unchanged.
 *
 * Uses the caller-supplied client. canonical_service_schemas + shared_attribute_
 * groups are RLS read-all (anon + authenticated), so the couple's session client
 * reads them fine.
 */
export async function fetchCategoryFacets(
  client: SupabaseClient,
  canonicalServices: ReadonlyArray<string>,
): Promise<FacetDimension[]> {
  if (canonicalServices.length === 0) return [];

  let schemaRows: Array<{
    shared_attribute_groups: string[] | null;
    category_specific_attributes: Record<string, unknown> | null;
    filter_facets: unknown;
  }>;
  try {
    const { data, error } = await client
      .from('canonical_service_schemas')
      .select('shared_attribute_groups, category_specific_attributes, filter_facets')
      .in('canonical_service', canonicalServices as string[]);
    if (error) {
      if (!isShapeError(error.code)) {
        console.warn(`vendor-facets: schema read failed: ${error.message}`);
      }
      return [];
    }
    schemaRows = (data ?? []) as typeof schemaRows;
  } catch {
    return [];
  }
  if (schemaRows.length === 0) return [];

  // Resolve the shared groups these schemas reference into one field-def map.
  const groupNames = new Set<string>();
  for (const s of schemaRows) {
    for (const g of s.shared_attribute_groups ?? []) {
      if (typeof g === 'string' && g.length > 0) groupNames.add(g);
    }
  }
  const groupFieldDefs: Record<string, FieldDef> = {};
  if (groupNames.size > 0) {
    try {
      const { data: groupRows } = await client
        .from('shared_attribute_groups')
        .select('group_name, attributes')
        .in('group_name', Array.from(groupNames));
      for (const row of (groupRows ?? []) as Array<{
        attributes: Record<string, FieldDef> | null;
      }>) {
        for (const [k, def] of Object.entries(row.attributes ?? {})) {
          if (!(k in groupFieldDefs)) groupFieldDefs[k] = def;
        }
      }
    } catch {
      // Group defs unavailable → we can still resolve category-specific facets.
    }
  }

  // Resolve each schema's filter_facets against (group defs ∪ category defs),
  // deduping dimensions by key across services.
  const byKey = new Map<string, FacetDimension>();
  for (const s of schemaRows) {
    const fieldDefs: Record<string, FieldDef> = {
      ...groupFieldDefs,
      ...((s.category_specific_attributes ?? {}) as Record<string, FieldDef>),
    };
    const facetKeys = Array.isArray(s.filter_facets)
      ? (s.filter_facets.filter((f) => typeof f === 'string') as string[])
      : [];
    for (const key of facetKeys) {
      const def = fieldDefs[key];
      const options = selectableOptions(def);
      if (!options) continue;
      const dim =
        byKey.get(key) ??
        ({
          key,
          label: (typeof def?.label === 'string' && def.label) || humanizeToken(key),
          options: [],
        } satisfies FacetDimension);
      const seen = new Set(dim.options.map((o) => o.value));
      for (const opt of options) {
        if (seen.has(opt)) continue;
        if (dim.options.length >= MAX_OPTIONS_PER_DIMENSION) break;
        dim.options.push({ value: opt, label: humanizeToken(opt) });
        seen.add(opt);
      }
      byKey.set(key, dim);
    }
  }

  return Array.from(byKey.values()).slice(0, MAX_DIMENSIONS);
}

/**
 * Clean a raw selection against the catalog: keep only known dimension keys and
 * valid option values, coerce values to string[], dedupe, drop empty dimensions.
 * Used for BOTH the couple's explicit picks AND the saved-preference seed, so an
 * unknown key or a stale option value can never leak into the match.
 */
export function sanitizeFacetSelection(
  catalog: ReadonlyArray<FacetDimension>,
  raw: Record<string, unknown> | null | undefined,
): FacetSelection {
  const out: FacetSelection = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const dim of catalog) {
    const allowed = new Set(dim.options.map((o) => o.value));
    const vals = toStringArray(raw[dim.key]).filter((v) => allowed.has(v));
    if (vals.length > 0) out[dim.key] = Array.from(new Set(vals));
  }
  return out;
}

/** True when a selection carries ≥1 dimension with values. */
export function hasFacetSelection(selection: FacetSelection): boolean {
  return Object.values(selection).some((v) => Array.isArray(v) && v.length > 0);
}

/**
 * Per-vendor facet match for a category query against an explicit selection.
 * Returns a map with an entry for EVERY vendor that carries ≥1 attribute row on
 * the queried services (matchedCount may be 0) — the caller distinguishes
 * "tagged but 0 match" (hard-filterable) from "no attribute row" (never dropped)
 * by presence in the map. Never throws; graceful-degrades to an empty map.
 *
 * Uses the caller-supplied client. vendor_service_attributes RLS grants
 * anon+authenticated read of rows with meets_visibility_minimum = TRUE, so the
 * couple's session client sees the couple-visible vendor tags.
 */
export async function matchVendorFacets(
  client: SupabaseClient,
  vendorIds: ReadonlyArray<string>,
  canonicalServices: ReadonlyArray<string>,
  selection: FacetSelection,
): Promise<Map<string, VendorFacetMatch>> {
  const out = new Map<string, VendorFacetMatch>();
  const selectedDims = Object.entries(selection).filter(
    ([, v]) => Array.isArray(v) && v.length > 0,
  );
  if (
    vendorIds.length === 0 ||
    canonicalServices.length === 0 ||
    selectedDims.length === 0
  ) {
    return out;
  }
  const selectedCount = selectedDims.length;

  let rows: Array<{
    vendor_profile_id: string;
    attribute_payload: Record<string, unknown> | null;
  }>;
  try {
    const { data, error } = await client
      .from('vendor_service_attributes')
      .select('vendor_profile_id, canonical_service, attribute_payload')
      .in('vendor_profile_id', vendorIds as string[])
      .in('canonical_service', canonicalServices as string[]);
    if (error) {
      if (!isShapeError(error.code)) {
        console.warn(`vendor-facets: vendor attribute read failed: ${error.message}`);
      }
      return out;
    }
    rows = (data ?? []) as typeof rows;
  } catch {
    return out;
  }

  // Aggregate each vendor's facet values (union across the services they offer).
  const vendorDims = new Map<string, Map<string, Set<string>>>();
  for (const row of rows) {
    const perVendor =
      vendorDims.get(row.vendor_profile_id) ?? new Map<string, Set<string>>();
    mergeDimensions(perVendor, (row.attribute_payload ?? {}) as Record<string, unknown>);
    vendorDims.set(row.vendor_profile_id, perVendor);
  }

  for (const [vendorId, vDims] of vendorDims) {
    let matchedCount = 0;
    for (const [dim, values] of selectedDims) {
      const vendorVals = vDims.get(dim);
      if (!vendorVals) continue;
      if (values.some((v) => vendorVals.has(v))) matchedCount += 1;
    }
    out.set(vendorId, { matchedCount, selectedCount });
  }

  return out;
}
