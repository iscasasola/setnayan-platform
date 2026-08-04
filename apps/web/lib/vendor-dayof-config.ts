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
 * Is this act's guest-request stream PAUSED for this booking?
 *
 * Separate from {@link fetchDayOfOverride} on purpose: that one answers "which
 * modules are on" and returns the module list, while this answers one boolean
 * about a different column. Folding them together would make every module read
 * carry a column it does not use, and make this read carry a JSON parse it does
 * not need.
 *
 * ⚠ FALSE (not paused) IS THE ANSWER FOR AN ABSENT ROW, and that is the whole
 * point of always-on (owner-locked 2026-07-30, migration 20271020224218):
 * `vendor_dayof_configs` is SPARSE, so most bookings have no row at all, and a
 * missing row means requests are flowing. Never render "paused" from a null.
 *
 * A day-of GRANTEE also gets `false` here — the table's RLS is keyed to the
 * vendor's own profile, so crew read nothing. That is the honest answer for the
 * control they cannot operate anyway (`setSongRequestsOpen` is owner-path only,
 * PR #3876's deliberate scope boundary).
 */
export async function fetchSongRequestsPaused(
  supabase: SupabaseClient,
  vendorProfileId: string,
  eventId: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('vendor_dayof_configs')
    .select('song_requests_open')
    .eq('vendor_profile_id', vendorProfileId)
    .eq('event_id', eventId)
    .maybeSingle();
  if (error || !data) return false;
  // The column means "not paused", so paused is its inverse. Only an explicit
  // FALSE is a pause; anything else (TRUE, NULL from a partial row) is flowing.
  return (data as { song_requests_open: boolean | null }).song_requests_open === false;
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
