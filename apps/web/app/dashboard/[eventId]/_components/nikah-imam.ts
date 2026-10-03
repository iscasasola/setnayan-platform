import type { SupabaseClient } from '@supabase/supabase-js';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  computeOfficiantAutoResolution,
  getOfficiantAutoResolvedHint,
} from '@/lib/officiant-auto-resolve';

const OFFICIANT_LOCKED_STATUSES = new Set(['contracted', 'deposit_paid', 'delivered', 'complete']);

/**
 * Nikah imam designation (Muslim track) — lifted out of the Home page unchanged
 * when the Nikah essentials moved to their own page
 * (`/dashboard/[eventId]/nikah`) and the Home kept only a status line, so the
 * Home's "N of 4" and the page's checklist read the imam from ONE place.
 *
 * The "Imam / qadi" essential ticks when a guest has role 'imam' (computed from
 * the guest list by the caller) OR — read here, since the card only sees guests
 * — when the couple has booked an officiant vendor (locked), OR when a locked
 * mosque venue auto-resolves the imam (computeOfficiantAutoResolution →
 * muslim_mosque, which also surfaces the PD 1083 hint). The auto-resolve query
 * only fires when no officiant vendor is already booked. Call it for a Muslim
 * event only.
 */
export async function readNikahImam(
  supabase: SupabaseClient,
  eventId: string,
  userId: string,
): Promise<{ nikahImamBooked: boolean; nikahImamNote: string | null }> {
  let nikahImamBooked = false;
  let nikahImamNote: string | null = null;
  const officiantRowsRes = await (async () => {
    try {
      return await supabase
        .from('event_vendors')
        .select('marketplace_vendor_id, source_venue_directory_id, category, status')
        .eq('event_id', eventId)
        .is('archived_at', null);
    } catch (caught) {
      logQueryError(
        'Nikah (officiant event_vendors SELECT threw)',
        caught instanceof Error ? caught : new Error(String(caught)),
        { event_id: eventId, user_id: userId },
        'graceful_degrade',
      );
      return { data: [], error: null } as never;
    }
  })();
  const officiantRows = (officiantRowsRes.data ?? []) as Array<{
    marketplace_vendor_id: string | null;
    source_venue_directory_id: string | null;
    category: string | null;
    status: string | null;
  }>;
  nikahImamBooked = officiantRows.some(
    (v) => v.category === 'officiant' && OFFICIANT_LOCKED_STATUSES.has(v.status ?? ''),
  );
  if (!nikahImamBooked) {
    const resolved = await computeOfficiantAutoResolution(supabase, {
      eventId,
      ceremonyType: 'muslim',
      vendorRows: officiantRows,
    }).catch(() => null);
    if (resolved?.framing === 'muslim_mosque') {
      nikahImamBooked = true;
      nikahImamNote = getOfficiantAutoResolvedHint('muslim_mosque');
    }
  }
  return { nikahImamBooked, nikahImamNote };
}
