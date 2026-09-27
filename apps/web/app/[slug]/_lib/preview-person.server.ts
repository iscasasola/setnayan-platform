import 'server-only';

import type { createAdminClient } from '@/lib/supabase/admin';
import type { PreviewPerson } from '@/lib/simulated-guest-preview';
import { SIDE_PRINCIPAL_ROLES } from '@/lib/guest-side-question';

type AdminClient = ReturnType<typeof createAdminClient>;

/**
 * 🎭 THE PERSON THE MAKER'S RSVP PREVIEW WEARS (owner 2026-09-27: *"each editor
 * of each event will adapt to their event"*). The first primary guest on THIS
 * event's list — their NAME and PLUS-ONE ALLOWANCE, and nothing else (the
 * select names exactly those columns). Called only for a verified host's canvas.
 *
 * 🔒 READ ONLY. The preview keeps the sample's id, so no reply, scan row or
 * anything else is ever written for this person. A failed or empty read returns
 * null, and the preview says "Your guest" — never an invented couple.
 */
export async function loadPreviewPerson(admin: AdminClient, eventId: string): Promise<PreviewPerson | null> {
  const { data, error } = await admin
    .from('guests')
    .select('first_name, last_name, display_name, plus_one_allowed, plus_one_count')
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .is('plus_one_of_guest_id', null)
    // Not the couple themselves — they do not reply to their own wedding
    // (measured 2026-09-27: cale-ice's first row is the bride).
    .not('role', 'in', `(${SIDE_PRINCIPAL_ROLES.join(',')})`)
    // Someone the couple allowed a plus-one first, where there is one — so the
    // "Plus-ones" switch visibly adds and removes its question in the preview.
    .order('plus_one_allowed', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] app/[slug]/_lib/preview-person.server.ts · from:guests.select', error);
    return null;
  }
  return (data as PreviewPerson | null) ?? null;
}
