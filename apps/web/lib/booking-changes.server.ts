import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { logQueryError } from '@/lib/supabase/error-detect';
import { toBookingChange, type BookingChange } from './booking-changes';

export { BOOKING_CHANGE_FIELDS, changesFor } from './booking-changes';
export type { BookingChange, BookingChangeField } from './booking-changes';

/**
 * The earlier values of one booking's agreed details — what "Changed N×"
 * opens to. Reads `public.booking_changes` under the CALLER's session (RLS:
 * the event's hosts; the supplier for its own rows and the event-wide ones;
 * admins).
 *
 * `vendorProfileId` given → that shop's rows PLUS the event-wide rows (date,
 * guest count), which is the whole history of one booking. Omitted → every
 * row the caller may read for the event.
 *
 * 🔒 READS ARE HONEST: a refused or failed read returns `null`, never `[]`.
 * `[]` means "measured: nothing ever changed" and the UI may say so; `null`
 * means "we could not look", and the UI must not state an absence.
 * Newest first.
 */
export async function readBookingChanges(
  supabase: SupabaseClient,
  { eventId, vendorProfileId }: { eventId: string; vendorProfileId?: string | null },
): Promise<BookingChange[] | null> {
  let query = supabase
    .from('booking_changes')
    .select('change_id, event_id, vendor_profile_id, field, subject_id, from_value, to_value, changed_by, changed_at')
    .eq('event_id', eventId);
  if (vendorProfileId) {
    query = query.or(`vendor_profile_id.eq.${vendorProfileId},vendor_profile_id.is.null`);
  }
  const { data, error } = await query
    .order('changed_at', { ascending: false })
    .order('change_id', { ascending: false });

  if (error || !Array.isArray(data)) {
    logQueryError(
      'readBookingChanges',
      error ?? { message: 'booking_changes read returned no array' },
      { event_id: eventId, vendor_profile_id: vendorProfileId ?? null },
      'graceful_degrade',
    );
    return null;
  }
  const rows: BookingChange[] = [];
  for (const raw of data as Record<string, unknown>[]) {
    const row = toBookingChange(raw);
    if (row) rows.push(row);
  }
  return rows;
}
