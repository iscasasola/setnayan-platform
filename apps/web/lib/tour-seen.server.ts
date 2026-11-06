import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import type { TourKey } from '@/lib/tours';

/**
 * Whether ONE tour is on record for this person (`users.tour_seen_keys`, written by the shipped `completeTour`).
 *
 * 🔑 A REFUSED READ IS NULL, NEVER FALSE. "Not yet" would replay a tour to somebody who finished it — and where the
 * record is a step's ✓ (a new shop's step 6, `lib/supplier-setup.ts` `SETUP_TOUR_KEY`), it would un-tick a step that
 * happened. The caller says it could not load instead.
 */
export async function readTourSeen(supabase: SupabaseClient, userId: string, key: TourKey): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.from('users').select('tour_seen_keys').eq('user_id', userId).maybeSingle();
    if (error) {
      logQueryError('tour-seen.server.ts: readTourSeen users', error, { key });
      return null;
    }
    if (!data) return null;
    return ((data as { tour_seen_keys?: string[] | null }).tour_seen_keys ?? []).includes(key);
  } catch {
    return null;
  }
}
