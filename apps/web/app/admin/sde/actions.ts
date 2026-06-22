'use server';

/**
 * Server actions for /admin/sde — Same-Day Edit film delivery.
 *
 * The admin page is already gated by app/admin/layout.tsx, but server actions
 * can be invoked independently, so each re-verifies admin access. Writes use
 * the service-role client (the events landing columns have host-scoped RLS;
 * the crew/admin who delivers the film isn't a host, so the service role is the
 * canonical writer — same pattern as the Panood watch-url + hero-video saves).
 *
 * AUTO-PUBLISH (owner rule): a paid feature auto-shows the moment it exists.
 * saveSdeFilm stamps sde_published_at=now() in the SAME update that stores the
 * keys — there is NO separate couple-publish step. The day-of page + recap gate
 * on eventSkuActive('SDE') (admin-approved, bundle-aware), so the film surfaces
 * the instant the crew uploads it for an event that holds the SKU.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserRoleSummary } from '@/lib/roles';
import { R2_BUCKETS } from '@/lib/r2';
import { encodeR2Ref } from '@/lib/uploads';

type Result = { ok: true } | { ok: false; error: string };

async function assertAdmin(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('You must be signed in.');
  const roles = await fetchUserRoleSummary(supabase, user.id);
  if (!roles.hasAdminAccess) throw new Error('Admin access required.');
  return user.id;
}

/**
 * Deliver (and auto-publish) the finished SDE film for an event.
 *
 * The uploader has already PUT the MP4 (+ optional poster) to R2 and hands back
 * the object KEYS; we wrap them in the `r2://bucket/key` stored-asset ref
 * (encodeR2Ref) the public read path expects (displayUrlForStoredAsset), and
 * stamp sde_published_at=now() so the film auto-shows immediately. Revalidates
 * the couple's public site + recap so the new film goes live without a wait.
 */
export async function saveSdeFilm(input: {
  eventId: string;
  videoKey: string;
  posterKey?: string | null;
}): Promise<Result> {
  try {
    await assertAdmin();
    if (!input.eventId) return { ok: false, error: 'Missing event.' };
    if (!input.videoKey) return { ok: false, error: 'No video was uploaded.' };

    const db = createAdminClient();
    const { data: ev, error: lookupErr } = await db
      .from('events')
      .select('event_id, slug')
      .eq('event_id', input.eventId)
      .maybeSingle();
    if (lookupErr) return { ok: false, error: lookupErr.message };
    if (!ev) return { ok: false, error: 'Event not found.' };

    const { error } = await db
      .from('events')
      .update({
        sde_video_r2_key: encodeR2Ref(R2_BUCKETS.media, input.videoKey),
        sde_poster_r2_key: input.posterKey
          ? encodeR2Ref(R2_BUCKETS.media, input.posterKey)
          : null,
        // AUTO-PUBLISH on upload — no separate couple-publish step.
        sde_published_at: new Date().toISOString(),
      })
      .eq('event_id', input.eventId);
    if (error) return { ok: false, error: error.message };

    // The couple's day-of page + recap render the film off these columns.
    const slug = (ev as { slug?: string | null }).slug;
    if (slug) {
      revalidatePath(`/${slug}`);
      revalidatePath(`/${slug}/recap`);
    }
    revalidatePath('/admin/sde');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed.' };
  }
}
