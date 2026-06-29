'use server';

/**
 * joinVendorWaitlist — a signed-in couple joins a vendor's Booked-Out Waitlist
 * for their intended date (Wave 4 vendor benefit). Surfaced on /v/[slug] only
 * when the vendor is unavailable on the couple's event date.
 *
 * The insert is RLS-checked (host client): the WITH CHECK on
 * vendor_date_waitlist requires user_id = auth.uid(), so a couple can only
 * waitlist themselves. A re-join of the same (couple, vendor, date) is an
 * idempotent no-op thanks to the partial unique index — we swallow the unique
 * violation and report success either way.
 *
 * Feedback travels via a `?wl=` notice code on the redirect back to the profile
 * (these surfaces are plain server-rendered, no client JS).
 */

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchUserEvents } from '@/lib/events';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(formData: FormData, key: string): string {
  const v = formData.get(key);
  return typeof v === 'string' ? v.trim() : '';
}

export async function joinVendorWaitlist(formData: FormData): Promise<void> {
  const slug = str(formData, 'slug');
  const backTo = slug ? `/v/${slug}` : '/explore';

  const vendorProfileId = str(formData, 'vendor_profile_id');
  const requestedDate = str(formData, 'requested_date');
  if (!vendorProfileId || !DATE_RE.test(requestedDate)) {
    redirect(`${backTo}?wl=error`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  // Resolve the couple's primary event so the waitlist row is event-anchored
  // (nullable column — a couple without an active event can still waitlist).
  let eventId: string | null = null;
  try {
    const events = await fetchUserEvents(supabase, user.id, 'couple');
    eventId = events[0]?.event_id ?? null;
  } catch {
    eventId = null;
  }

  const { error } = await supabase.from('vendor_date_waitlist').insert({
    vendor_profile_id: vendorProfileId,
    event_id: eventId,
    requested_date: requestedDate,
    user_id: user.id,
    status: 'pending',
  });

  // 23505 = unique_violation → the couple is already on this date's waitlist.
  // Treat as success (idempotent join).
  if (error && error.code !== '23505') {
    redirect(`${backTo}?wl=error`);
  }

  revalidatePath(backTo);
  redirect(`${backTo}?wl=joined`);
}
