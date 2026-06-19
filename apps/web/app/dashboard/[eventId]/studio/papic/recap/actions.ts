'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Iteration 0012 Papic — Auto-Recap publish controls (couple-side).
//
// publishRecap / unpublishRecap flip the single event_recaps row for the event.
// Publishing turns the PUBLIC /[slug]/recap page on (public-safe content only);
// unpublishing takes it down. Couple-gated; writes via the admin client after
// the app-level couple check (mirrors moderation/actions.ts — RLS allows the
// couple, the admin client keeps it uniform with the rest of the surface).

async function requireCouple(eventId: string): Promise<{ userId: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: membership } = await supabase
    .from('event_members')
    .select('member_type')
    .eq('event_id', eventId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || membership.member_type !== 'couple') {
    redirect(`/dashboard/${eventId}`);
  }
  return { userId: user.id };
}

function eventIdFrom(formData: FormData): string {
  const raw = formData.get('eventId');
  if (typeof raw !== 'string' || !raw) redirect('/dashboard');
  return raw;
}

/** Revalidate the couple surface + the public recap page + its OG card. */
async function revalidateRecap(eventId: string, slug: string | null): Promise<void> {
  revalidatePath(`/dashboard/${eventId}/studio/papic/recap`);
  revalidatePath(`/dashboard/${eventId}/studio/papic`);
  if (slug) {
    revalidatePath(`/${slug}/recap`);
    revalidatePath(`/api/og/recap/${slug}`);
  }
}

async function slugFor(eventId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data } = await admin.from('events').select('slug').eq('event_id', eventId).maybeSingle();
  return (data?.slug as string) ?? null;
}

export async function publishRecap(formData: FormData): Promise<void> {
  const eventId = eventIdFrom(formData);
  await requireCouple(eventId);

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  await admin.from('event_recaps').upsert(
    {
      event_id: eventId,
      status: 'published',
      published_at: nowIso,
      unpublished_by: null,
      updated_at: nowIso,
    },
    { onConflict: 'event_id' },
  );

  await revalidateRecap(eventId, await slugFor(eventId));
}

export async function unpublishRecap(formData: FormData): Promise<void> {
  const eventId = eventIdFrom(formData);
  await requireCouple(eventId);

  const admin = createAdminClient();
  const nowIso = new Date().toISOString();
  await admin.from('event_recaps').upsert(
    {
      event_id: eventId,
      status: 'unpublished',
      unpublished_by: 'couple',
      updated_at: nowIso,
    },
    { onConflict: 'event_id' },
  );

  await revalidateRecap(eventId, await slugFor(eventId));
}
