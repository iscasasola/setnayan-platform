import type { SupabaseClient } from '@supabase/supabase-js';
import { getEventPreferences } from './event-preferences';

/**
 * preference-match — Layer-B "matches your preference" computation for the
 * vendor matcher (Vendor_Match_Personalization_2026-06-01.md §8/§9).
 *
 * Couple side: `event_vendor_preferences.attribute_payload` (per canonical_service,
 *   migration 20260721000000).
 * Vendor side: `vendor_service_attributes.attribute_payload` (per canonical_service,
 *   iteration 0044, migration 20260521010000).
 * Match = per-dimension ARRAY OVERLAP (the couple's chosen values ∩ the vendor's
 *   facet tags); a vendor "matches" if it overlaps ANY captured dimension on a
 *   service it offers. This FLOATS matches up, it NEVER excludes — the partition
 *   re-rank in `fetchWizardVendorRecommendations` mirrors the existing
 *   song-overlap block exactly, generalized from music to every category.
 *
 * Graceful-degrade — every one of these collapses to an EMPTY map so the
 * matcher's order is unchanged (zero regression):
 *   - the tables aren't migrated (42P01) / a column is missing (42703)
 *   - the couple expressed no preferences for the queried services
 *   - no candidate vendor carries facet tags
 * Inert in production until `vendor_service_attributes` carries facet payloads
 * (empty today · founder-only marketplace), then activates automatically — same
 * "ship the read, light up when data exists" posture as event-preferences.ts.
 */

export type PreferenceMatch = {
  /** ≥1 preference dimension overlaps the vendor on a shared service. */
  matched: boolean;
  /** How many of the couple's expressed dimensions the vendor satisfies. */
  matchedDimensions: number;
  /** How many dimensions the couple expressed across the queried services. */
  totalDimensions: number;
};

type AttrRow = {
  vendor_profile_id: string;
  canonical_service: string;
  attribute_payload: Record<string, unknown> | null;
};

/** Missing-table / missing-column shape error (tables not migrated yet). */
function isShapeError(code: string | undefined): boolean {
  return code === '42P01' || code === '42703';
}

/** Facet payload values are string[] tags; coerce defensively. */
function toStringArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === 'string');
  if (typeof v === 'string' && v.length > 0) return [v];
  return [];
}

/** The dimensions in a payload that carry ≥1 value, as dimension → value set. */
function expressedDimensions(payload: Record<string, unknown>): Map<string, Set<string>> {
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

/**
 * Per-vendor preference match for a category query. Returns a map containing
 * ONLY the vendors that matched ≥1 dimension — an absent entry means "no
 * signal," which callers treat as not-floated (order unchanged). Never throws.
 *
 * @param admin   service-role client (matcher reads run admin-side, like the
 *                song-overlap path) — RLS on event_vendor_preferences is
 *                defense-in-depth; the caller is the gate.
 * @param eventId the browsing couple's event.
 * @param vendorIds the candidate pool (already filtered/ranked by the matcher).
 * @param canonicalServices the canonical_service keys for the category query.
 */
export async function fetchPreferenceMatches(
  admin: SupabaseClient,
  eventId: string,
  vendorIds: ReadonlyArray<string>,
  canonicalServices: ReadonlyArray<string>,
): Promise<Map<string, PreferenceMatch>> {
  const out = new Map<string, PreferenceMatch>();
  if (vendorIds.length === 0 || canonicalServices.length === 0) return out;

  // ── Couple side ── reuse the canonical reader (graceful-degrades to {}).
  const prefMap = await getEventPreferences(admin, eventId);
  const coupleDims = new Map<string, Set<string>>();
  for (const svc of canonicalServices) {
    // prefMap[svc] is the saved requirements template; the matcher reads only
    // its facet dimensions (attribute_payload) — special_request / auto_send are
    // not match signals (Phase 1b PR-1).
    const pref = prefMap[svc];
    if (pref) mergeDimensions(coupleDims, pref.attribute_payload as Record<string, unknown>);
  }
  const totalDimensions = coupleDims.size;
  if (totalDimensions === 0) return out; // couple expressed nothing → no-op

  // ── Vendor side ── facet payloads for the candidate vendors on these services.
  const { data, error } = await admin
    .from('vendor_service_attributes')
    .select('vendor_profile_id, canonical_service, attribute_payload')
    .in('vendor_profile_id', vendorIds as string[])
    .in('canonical_service', canonicalServices as string[]);

  if (error) {
    if (isShapeError(error.code)) return out;
    console.warn(`preference-match: vendor attribute read failed: ${error.message}`);
    return out;
  }

  // Aggregate each vendor's facet values (union across the services they offer).
  const vendorDims = new Map<string, Map<string, Set<string>>>();
  for (const row of (data ?? []) as AttrRow[]) {
    const perVendor = vendorDims.get(row.vendor_profile_id) ?? new Map<string, Set<string>>();
    mergeDimensions(perVendor, (row.attribute_payload ?? {}) as Record<string, unknown>);
    vendorDims.set(row.vendor_profile_id, perVendor);
  }

  for (const vendorId of vendorIds) {
    const vDims = vendorDims.get(vendorId);
    if (!vDims) continue; // no facet tags → no signal (omit from the map)
    let matchedDimensions = 0;
    for (const [dim, allowed] of coupleDims) {
      const vendorVals = vDims.get(dim);
      if (!vendorVals) continue;
      let overlaps = false;
      for (const v of allowed) {
        if (vendorVals.has(v)) {
          overlaps = true;
          break;
        }
      }
      if (overlaps) matchedDimensions += 1;
    }
    if (matchedDimensions > 0) {
      out.set(vendorId, { matched: true, matchedDimensions, totalDimensions });
    }
  }

  return out;
}
