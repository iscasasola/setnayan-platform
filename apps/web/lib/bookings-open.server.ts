import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { GLOBAL_SETTINGS_TAGS, rememberedGlobalRead } from '@/lib/global-settings-cache';
import { bookingsOpenFromSetting } from '@/lib/bookings-open';

/**
 * Are bookings open on Setnayan? (owner 2026-11-02 — "for now, they cannot add
 * bookings"). See `lib/bookings-open.ts` for the switch and the eight doors.
 *
 * FAIL-CLOSED: a refused or absent read answers "closed". Closed only refuses a
 * booking — it never hides a shop, a package or a price — so the safe answer
 * when the switch cannot be read is the launch default, not the open one.
 *
 * REMEMBERED under the platform_settings tag; the one writer
 * (`setBookingsOpen`, app/admin/booking-fees/actions.ts) clears it, so a flip
 * is seen on the next request. A refused read throws inside and is never
 * remembered.
 */
export async function areBookingsOpen(): Promise<boolean> {
  try {
    return await rememberedGlobalRead('platform_settings-bookings-open-v1', GLOBAL_SETTINGS_TAGS.platformSettings, async () => {
      const { data, error } = await createAdminClient()
        .from('platform_settings')
        .select('bookings_open')
        .eq('id', 1)
        .maybeSingle();
      if (error) throw error;
      return bookingsOpenFromSetting((data as { bookings_open?: unknown } | null)?.bookings_open);
    });
  } catch (e) {
    logQueryError('bookings-open.read', e as { message?: string });
    return false;
  }
}
