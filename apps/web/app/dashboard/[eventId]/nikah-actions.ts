'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth';

// Allowed walima seating postures — must mirror the events_gender_separation_check
// DB constraint (migration 20270308998862). Belt-and-suspenders: the DB guards
// the column too, but validating here keeps a bad value from ever reaching it.
const GENDER_SEPARATION = new Set(['none', 'sections', 'separate_spaces']);

const MAHR_MAX = 600;

/**
 * Save the couple's Nikah details (the mahr description + the walima
 * gender-separation posture) from the Five-essentials card editor. Bound to an
 * eventId via .bind in the card's <form action>. Writes through the user-scoped
 * client so the events-table RLS is the access gate — a non-owner update simply
 * affects no rows.
 *
 * mahr_prompt_deferred tracks the onboarding-prompt state: once the couple sets
 * a description it flips to 'provided'; clearing it drops back to 'pending'
 * (asked, not yet answered) rather than 'deferred' (never asked).
 */
export async function updateNikahDetails(eventId: string, formData: FormData) {
  const user = await getCurrentUser();
  if (!user) return;

  const mahrRaw = (formData.get('mahr_description') ?? '').toString().trim();
  const mahr = mahrRaw ? mahrRaw.slice(0, MAHR_MAX) : null;

  const genderRaw = (formData.get('gender_separation') ?? 'none').toString();
  const gender = GENDER_SEPARATION.has(genderRaw) ? genderRaw : 'none';

  const sb = await createClient();
  await sb
    .from('events')
    .update({
      mahr_description: mahr,
      mahr_prompt_deferred: mahr ? 'provided' : 'pending',
      gender_separation: gender,
    })
    .eq('event_id', eventId);

  revalidatePath(`/dashboard/${eventId}`);
}
