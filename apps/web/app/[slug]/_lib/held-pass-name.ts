import type { createAdminClient } from '@/lib/supabase/admin';

/**
 * 🪪 The first name the held-pass line says ("This browser also holds Milagros's invitation."). The pass's own row,
 * on this event, read only for a viewer the rule already decided the line is for. A failed read says "another
 * guest's" — logged, never a wrong name.
 */
export async function heldPassFirstNameFor(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  guestId: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('guests')
    .select('first_name, display_name')
    .eq('event_id', eventId)
    .eq('guest_id', guestId)
    .maybeSingle();
  if (error) {
    console.error('[supabase-error] app/[slug]/_lib/held-pass-name.ts · from:guests.select', error);
    return null;
  }
  const first = (data?.first_name as string | null | undefined)?.trim();
  return first || (data?.display_name as string | null | undefined)?.trim() || null;
}

