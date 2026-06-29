'use server';

/**
 * Server actions for /admin/background-videos.
 *
 * The admin page is already gated by app/admin/layout.tsx, but server actions
 * can be invoked independently, so each re-verifies admin access. Writes use the
 * service-role client (homepage_background_videos has read-all RLS + no write
 * policy, matching homepage_hero_config / platform_settings). Publishing
 * revalidates the homepage so the new clip goes live.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserRoleSummary } from '@/lib/roles';
import { R2_BUCKETS, publicUrlFor } from '@/lib/r2';

type Result = { ok: true } | { ok: false; error: string };

const MIN_SLOT = 0;
const MAX_SLOT = 5;

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

function validSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= MIN_SLOT && slot <= MAX_SLOT;
}

/** Persists a freshly-uploaded clip to its slot as a DRAFT (admin publishes explicitly). */
export async function saveBackgroundVideo(input: {
  slot: number;
  videoKey: string;
  videoMime: string;
}): Promise<Result> {
  try {
    const adminId = await assertAdmin();
    if (!validSlot(input.slot)) return { ok: false, error: 'Invalid slot.' };
    if (!input.videoKey) return { ok: false, error: 'No uploaded video to save.' };
    const db = createAdminClient();
    const { error } = await db
      .from('homepage_background_videos')
      .update({
        video_url: publicUrlFor(R2_BUCKETS.media, input.videoKey),
        video_r2_key: input.videoKey,
        video_mime_type: input.videoMime,
        // a freshly-uploaded clip lands as a DRAFT — the admin publishes explicitly
        is_published: false,
        updated_at: new Date().toISOString(),
        updated_by_admin_id: adminId,
      })
      .eq('slot', input.slot);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed.' };
  }
}

/** Publishes / unpublishes a slot. Publishing requires an uploaded clip first. */
export async function toggleBackgroundVideoPublish(slot: number, publish: boolean): Promise<Result> {
  try {
    const adminId = await assertAdmin();
    if (!validSlot(slot)) return { ok: false, error: 'Invalid slot.' };
    const db = createAdminClient();
    if (publish) {
      const { data } = await db
        .from('homepage_background_videos')
        .select('video_r2_key')
        .eq('slot', slot)
        .maybeSingle();
      const key = (data as { video_r2_key: string | null } | null)?.video_r2_key ?? null;
      if (!key) return { ok: false, error: 'Upload a video to this slot before publishing.' };
    }
    const { error } = await db
      .from('homepage_background_videos')
      .update({ is_published: publish, updated_at: new Date().toISOString(), updated_by_admin_id: adminId })
      .eq('slot', slot);
    if (error) return { ok: false, error: error.message };
    // Homepage is force-dynamic, but revalidate any cached presigned URL batch
    // + the path so the change is reflected immediately.
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Publish failed.' };
  }
}
