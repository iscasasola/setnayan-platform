'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';

/**
 * Vendor Suggest flow on the shared day-of timeline — feature-access program
 * Phase 3 (corpus 03_Strategy/Feature_Access_By_Vendor_Category_2026-06-12.md
 * § 4). Vendors PROPOSE changes; the couple (or a delegate with schedule
 * edit) approves or declines on the couple's Schedule page. No direct vendor
 * writes to event_schedule_blocks — RLS enforces the booked gate + own-org
 * authorship on the suggestion row itself.
 */

function nullIfBlank(raw: FormDataEntryValue | null, max = 200): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim().slice(0, max);
  return t.length > 0 ? t : null;
}

function parseDatetimeLocal(raw: FormDataEntryValue | null): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

export async function suggestScheduleChange(formData: FormData) {
  const eventId = formData.get('event_id');
  const note = formData.get('note');
  if (typeof eventId !== 'string' || typeof note !== 'string' || note.trim().length === 0) {
    redirect('/vendor-dashboard/clients');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  const blockId = nullIfBlank(formData.get('block_id'), 64);

  // RLS enforces: booked on the event, own org, own user, status open.
  const { error } = await supabase.from('event_schedule_suggestions').insert({
    event_id: eventId,
    block_id: blockId,
    vendor_profile_id: profile.vendor_profile_id,
    suggested_by_user_id: user.id,
    suggested_by_name: profile.business_name ?? null,
    kind: blockId ? 'adjust' : 'new',
    proposed_label: nullIfBlank(formData.get('proposed_label'), 120),
    proposed_start_at: parseDatetimeLocal(formData.get('proposed_start_at')),
    proposed_end_at: parseDatetimeLocal(formData.get('proposed_end_at')),
    proposed_location: nullIfBlank(formData.get('proposed_location'), 200),
    note: (note as string).trim().slice(0, 1000),
    status: 'open',
  });

  revalidatePath(`/vendor-dashboard/clients/${eventId}`);
  redirect(
    `/vendor-dashboard/clients/${eventId}?suggest=${error ? 'error' : 'sent'}`,
  );
}
