'use server';

/**
 * Server actions for /admin/hero-video.
 *
 * The admin page is already gated by app/admin/layout.tsx, but server actions
 * can be invoked independently, so each re-verifies admin access. Writes use
 * the service-role client (homepage_hero_config has read-all RLS + no write
 * policy, matching platform_settings). Publishing revalidates the static
 * homepage so the new frames go live.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserRoleSummary } from '@/lib/roles';
import { R2_BUCKETS, publicUrlFor } from '@/lib/r2';

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

export async function saveHeroVideo(input: {
  videoKey: string;
  videoMime: string;
  frameKeys: string[];
  frameWidth: number;
  frameHeight: number;
}): Promise<Result> {
  try {
    const adminId = await assertAdmin();
    if (!Array.isArray(input.frameKeys) || input.frameKeys.length === 0) {
      return { ok: false, error: 'No frames were produced from that video.' };
    }
    const db = createAdminClient();
    const frameUrls = input.frameKeys.map((k) => publicUrlFor(R2_BUCKETS.media, k));
    const { error } = await db
      .from('homepage_hero_config')
      .update({
        video_url: publicUrlFor(R2_BUCKETS.media, input.videoKey),
        video_r2_key: input.videoKey,
        video_mime_type: input.videoMime,
        // frame_keys are the source of truth — the read path builds display
        // URLs from them (presigned today, public once R2_PUBLIC_URL points at
        // the media bucket's public domain). frame_urls kept for reference.
        frame_keys: input.frameKeys,
        frame_urls: frameUrls,
        frame_count: frameUrls.length,
        frame_width: input.frameWidth,
        frame_height: input.frameHeight,
        // a freshly-uploaded video lands as a DRAFT — the admin publishes explicitly
        is_published: false,
        updated_at: new Date().toISOString(),
        updated_by_admin_id: adminId,
      })
      .eq('id', 1);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed.' };
  }
}

export async function toggleHeroPublish(publish: boolean): Promise<Result> {
  try {
    const adminId = await assertAdmin();
    const db = createAdminClient();
    if (publish) {
      const { data } = await db.from('homepage_hero_config').select('frame_count').eq('id', 1).maybeSingle();
      const count = (data as { frame_count: number } | null)?.frame_count ?? 0;
      if (count < 1) return { ok: false, error: 'Upload and process a video before publishing.' };
    }
    const { error } = await db
      .from('homepage_hero_config')
      .update({ is_published: publish, updated_at: new Date().toISOString(), updated_by_admin_id: adminId })
      .eq('id', 1);
    if (error) return { ok: false, error: error.message };
    // Homepage is force-static — rebuild it so the change goes live immediately.
    revalidatePath('/');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Publish failed.' };
  }
}
