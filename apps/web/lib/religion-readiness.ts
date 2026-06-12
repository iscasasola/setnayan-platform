/**
 * Per-religion vendor-readiness — the "open a wedding religion only when its
 * vendors can cater it" gate (owner-directed 2026-06-03: "INC needs INC
 * compatible services before we can open it. the only usual issue is the
 * ceremonial and officiants and food").
 *
 * Readiness signal = how many published vendors + ceremonial venues have
 * declared they serve this religion, via the `compatible_ceremony_types[]`
 * tag (GIN-indexed on both tables). That tag is exactly the "can serve this
 * religion" marker an officiant / caterer / ceremonial venue sets, so it's the
 * reliable proxy for the owner's officiant + ceremonial + food dimensions
 * (vendor_profiles categorises via free-text `services[]`, so the tag — not a
 * category enum — is what we count).
 *
 * Two consumers:
 *   - fetchReligionReadiness() → the admin /admin/wedding-types surface (counts
 *     + status + threshold, so admins decide when to flip a religion live).
 *   - fetchActiveCeremonyTypes() → the couple-facing gate: onboarding +
 *     create-event grey/disable any religion whose launch-status row isn't
 *     'active'. Public-read RLS, so the normal server client can call it.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { FAITH_LABELS } from '@/lib/faith-registry';

export type LaunchStatus = 'active' | 'coming_soon' | 'disabled';

export type ReligionReadinessRow = {
  ceremonyType: string;
  label: string;
  region: string;
  status: LaunchStatus;
  threshold: number;
  vendorCount: number;
  venueCount: number;
  total: number;
  ready: boolean;
};

// Derived from lib/faith-registry (the single faith source, 2026-06-12) plus
// the two non-faith ceremony forms this admin surface also rows. The audit
// (2026-06-11) caught the old hardcode missing jewish + born_again — raw keys
// rendered in /admin/wedding-types.
const RELIGION_LABEL: Record<string, string> = {
  ...FAITH_LABELS,
  civil: 'Civil',
  mixed: 'Mixed',
};

// The ceremonial (rite) venue types — the religion-specific venue side of
// readiness. Reception venue types (ballroom/garden/beach/…) are multi-religion
// and excluded. Mirrors venue_directory_type in migration 20260526010000.
const CEREMONIAL_VENUE_TYPES = [
  'catholic_church',
  'christian_church',
  'inc_chapel',
  'mosque',
  'cultural_site',
  'civil_registrar',
] as const;

/**
 * Admin readiness rows — one per wedding_type_launch_status row, with live
 * vendor + ceremonial-venue counts for that religion. Pass an ADMIN client so
 * the counts see every vendor/venue regardless of RLS.
 */
export async function fetchReligionReadiness(
  supabase: SupabaseClient,
): Promise<ReligionReadinessRow[]> {
  const { data: statusRows, error } = await supabase
    .from('wedding_type_launch_status')
    .select('ceremony_type, region, status, vendor_count_threshold')
    .eq('region', 'all')
    .order('ceremony_type');
  if (error || !statusRows) {
    console.error('[religion-readiness] status fetch:', error?.message);
    return [];
  }

  return Promise.all(
    statusRows.map(async (r) => {
      const ceremonyType = r.ceremony_type as string;
      const [vendorRes, venueRes] = await Promise.all([
        supabase
          .from('vendor_profiles')
          .select('vendor_profile_id', { count: 'exact', head: true })
          .eq('public_visibility', 'verified')
          .contains('compatible_ceremony_types', [ceremonyType]),
        supabase
          .from('venue_directory')
          .select('venue_directory_id', { count: 'exact', head: true })
          .in('venue_type', CEREMONIAL_VENUE_TYPES as unknown as string[])
          .contains('compatible_ceremony_types', [ceremonyType]),
      ]);
      const vendorCount = vendorRes.count ?? 0;
      const venueCount = venueRes.count ?? 0;
      const total = vendorCount + venueCount;
      const threshold = (r.vendor_count_threshold as number | null) ?? 20;
      return {
        ceremonyType,
        label: RELIGION_LABEL[ceremonyType] ?? ceremonyType,
        region: r.region as string,
        status: r.status as LaunchStatus,
        threshold,
        vendorCount,
        venueCount,
        total,
        ready: total >= threshold,
      };
    }),
  );
}

/**
 * The set of ceremony_types currently 'active' (region 'all'). Used by the
 * couple-facing surfaces (onboarding faith chips, create-event picker) to gate
 * which religions are selectable. Returns null on any failure so callers can
 * fall back to their existing default (treat all as available) — the gate must
 * never hard-block event creation on a transient read error.
 */
export async function fetchActiveCeremonyTypes(
  supabase: SupabaseClient,
): Promise<string[] | null> {
  const { data, error } = await supabase
    .from('wedding_type_launch_status')
    .select('ceremony_type, status')
    .eq('region', 'all')
    .eq('status', 'active');
  if (error || !data) {
    console.error('[religion-readiness] active fetch:', error?.message);
    return null;
  }
  return data.map((r) => r.ceremony_type as string);
}
