'use server';

import { after } from 'next/server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { composeRecapSocialPost } from '@/lib/social/recap-post';
import { runSocialFlush } from '@/lib/social/flush';

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

  // Event completed → recap is live. Auto-share it to Setnayan's OWN Facebook
  // Page + Instagram Business account through the EXISTING social pipeline
  // (compose a source_type='event_recap' social_posts row · deduped per event ·
  // then kick the cron-free flush that dispatches it). Off the couple's
  // critical path via after(); both calls never throw and are inert when Meta
  // isn't configured (nothing dispatches until the owner arms autopublish).
  after(async () => {
    await composeRecapSocialPost(eventId);
    await runSocialFlush().catch(() => {});
  });
}

/**
 * Social follow-through #2 — the couple's per-event opt-out of Setnayan
 * featuring their published recap on Setnayan's OWN Facebook / Instagram.
 * `allowed` = the checkbox state on the recap manager: checked → Setnayan MAY
 * feature (clear recap_social_optout_at); unchecked → opt OUT (stamp it now).
 * Default is allowed (NULL). Honored by BOTH the compose and dispatch gates in
 * lib/social/*; if a post already went live, the existing admin Social Queue
 * take-down (24h SLA) handles removal — this only governs future dispatch.
 */
export async function setRecapSocialFeatureAllowed(
  eventId: string,
  allowed: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const clean = eventId?.trim();
  if (!clean) return { ok: false, error: 'missing_event' };
  await requireCouple(clean);

  const admin = createAdminClient();
  const { error } = await admin
    .from('events')
    .update({ recap_social_optout_at: allowed ? null : new Date().toISOString() })
    .eq('event_id', clean);
  if (error) return { ok: false, error: error.message.slice(0, 80) };

  revalidatePath(`/dashboard/${clean}/studio/papic/recap`);
  return { ok: true };
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
