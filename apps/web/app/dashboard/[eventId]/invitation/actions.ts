'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

function randomHex(bytes = 16): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function reissueGuestToken(
  eventId: string,
  guestId: string,
  _formData: FormData,
): Promise<void> {
  // Authorize via the user's JWT (RLS prevents anyone but couple/admin from updating).
  const supabase = await createClient();
  const newToken = randomHex(16);

  const { error } = await supabase
    .from('guests')
    .update({ qr_token: newToken, updated_at: new Date().toISOString() })
    .eq('event_id', eventId)
    .eq('guest_id', guestId);

  if (error) {
    redirect(
      `/dashboard/${eventId}/invitation?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/dashboard/${eventId}/invitation`);
  redirect(`/dashboard/${eventId}/invitation?reissued=${guestId}`);
}

export async function updateEventSlug(
  eventId: string,
  formData: FormData,
): Promise<void> {
  const requested = String(formData.get('slug') ?? '')
    .trim()
    .toLowerCase();

  if (!requested || !/^[a-z0-9-]{3,32}$/.test(requested)) {
    redirect(`/dashboard/${eventId}/invitation?slug_error=invalid_format`);
  }

  const admin = createAdminClient();

  // Make sure no other event already owns the slug.
  const { data: clash } = await admin
    .from('events')
    .select('event_id')
    .ilike('slug', requested)
    .neq('event_id', eventId)
    .maybeSingle();
  if (clash) {
    redirect(`/dashboard/${eventId}/invitation?slug_error=taken`);
  }

  // Read the old slug so we can log it.
  const { data: existing } = await admin
    .from('events')
    .select('slug')
    .eq('event_id', eventId)
    .maybeSingle();

  // Pull the user's id for the log.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error: updateErr } = await supabase
    .from('events')
    .update({ slug: requested, updated_at: new Date().toISOString() })
    .eq('event_id', eventId);

  if (updateErr) {
    redirect(
      `/dashboard/${eventId}/invitation?slug_error=${encodeURIComponent(updateErr.message)}`,
    );
  }

  if (existing?.slug && existing.slug !== requested) {
    await admin.from('slug_change_log').insert({
      entity_type: 'event',
      entity_id: eventId,
      old_slug: existing.slug,
      new_slug: requested,
      changed_by: user?.id ?? null,
    });
  }

  revalidatePath(`/dashboard/${eventId}/invitation`);
  redirect(`/dashboard/${eventId}/invitation?slug_saved=1`);
}
