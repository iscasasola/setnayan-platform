/**
 * Vendor "On the Day" launcher — per-booking module override I/O.
 *
 * Thin read/write layer over `vendor_dayof_configs` (migration 20270809000000):
 * the SPARSE override row that records which day-of modules a vendor turned on
 * for one (vendor, event) booking. Absent row → code defaults
 * (lib/vendor-dayof-modules.ts). The override list is always intersected with
 * the modules AVAILABLE to the vendor's family by `resolveModules` — this layer
 * never trusts the stored list to enable something the category doesn't offer.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DAY_OF_MODULES, type DayOfModuleId } from '@/lib/vendor-dayof-modules';

const VALID_IDS = new Set<string>(DAY_OF_MODULES.map((m) => m.id));

/** Read the override on-set for a booking, or null when no override row exists. */
export async function fetchDayOfOverride(
  supabase: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<DayOfModuleId[] | null> {
  const { data, error } = await supabase
    .from('vendor_dayof_configs')
    .select('enabled_modules')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !data) return null;
  const raw = (data as { enabled_modules: unknown }).enabled_modules;
  if (!Array.isArray(raw)) return null;
  return raw.filter((x): x is DayOfModuleId => typeof x === 'string' && VALID_IDS.has(x));
}

/**
 * Upsert the override on-set for a booking. `enabledModules` is the full set of
 * module ids the vendor wants ON. RLS restricts the write to the vendor's own
 * profile on an event they're booked on; we still sanitise to known ids so a
 * malformed payload can't persist junk. Returns the sanitised list actually
 * written.
 */
export async function saveDayOfOverride(
  supabase: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
  enabledModules: readonly string[],
): Promise<{ ok: boolean; enabled: DayOfModuleId[]; error?: string }> {
  const enabled = [...new Set(enabledModules)].filter(
    (x): x is DayOfModuleId => VALID_IDS.has(x),
  );
  const { error } = await supabase.from('vendor_dayof_configs').upsert(
    {
      vendor_profile_id: vendorProfileId,
      event_id: eventId,
      enabled_modules: enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'vendor_profile_id,event_id' },
  );
  if (error) return { ok: false, enabled, error: error.message };
  return { ok: true, enabled };
}
