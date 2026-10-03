'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { applyReconcileForEvent } from '@/lib/seating-reconcile';
import { parsePersonName } from '@/lib/person-name-parse';

type QuickEntry = { firstName: string; lastName: string };

const MAX_BULK = 500;

// Quick-add guests in bulk. Each row gets dropped into "Uncategorized"
// (group_category: 'other') with sensible defaults the couple can refine
// later from the full guest editor. Enforces a soft cap of 500 names per
// upload — anything beyond that should use CSV import.
export async function bulkAddGuests(eventId: string, formData: FormData) {
  const raw = formData.get('guests');
  if (typeof raw !== 'string') {
    return redirect(`/dashboard/${eventId}/guests/quick?error=missing`);
  }

  let entries: QuickEntry[];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) throw new Error('not an array');
    entries = parsed
      .map((e) => ({
        firstName: typeof e?.firstName === 'string' ? e.firstName.trim() : '',
        lastName: typeof e?.lastName === 'string' ? e.lastName.trim() : '',
      }))
      .filter((e) => e.firstName.length > 0 || e.lastName.length > 0);
  } catch {
    return redirect(`/dashboard/${eventId}/guests/quick?error=parse`);
  }

  if (entries.length === 0) {
    return redirect(`/dashboard/${eventId}/guests/quick?error=empty`);
  }
  if (entries.length > MAX_BULK) {
    return redirect(`/dashboard/${eventId}/guests/quick?error=too_many`);
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const rows = entries.map((e) => {
    // The SAME split as the capture bar, the full form and the import
    // (lib/person-name-parse.ts): a title, a typed initial and a suffix land in
    // their own parts, and no bare word is guessed into a middle name.
    const p = parsePersonName(`${e.firstName} ${e.lastName}`.trim());
    return {
      event_id: eventId,
      first_name: p.firstName || e.firstName,
      last_name: p.firstName ? p.lastName : e.lastName || '',
      name_prefix: p.prefix || null,
      middle_name: p.middleName || null,
      name_suffix: p.suffix || null,
      side: 'both' as const,
      group_category: 'other' as const,
      role: 'guest' as const,
      rsvp_status: 'pending' as const,
      meal_preference: 'no_preference' as const,
      invited_to_blocks: ['ceremony', 'reception'],
      custom_tags: [],
    };
  });

  const { error } = await supabase.from('guests').insert(rows);
  if (error) {
    return redirect(
      `/dashboard/${eventId}/guests/quick?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Smart seat-plan Phase 5: gap-fill the new guests into provisional seats.
  await applyReconcileForEvent(supabase, eventId);

  revalidatePath(`/dashboard/${eventId}/guests`);
  revalidatePath(`/dashboard/${eventId}/invitation`);
  redirect(`/dashboard/${eventId}/guests?added=${entries.length}`);
}
