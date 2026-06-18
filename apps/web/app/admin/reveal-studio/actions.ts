'use server';

/**
 * Server actions for /admin/reveal-studio (the Reveal Studio).
 *
 * The admin page is gated by app/admin/layout.tsx, but server actions can be
 * invoked independently, so this re-verifies admin access. Writes use the
 * service-role client (reveal_studio_config has read-all RLS + no write policy,
 * matching platform_settings / homepage_hero_config). The incoming config is run
 * through mergeRevealConfig() so only known, type-checked fields are persisted.
 */

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchUserRoleSummary } from '@/lib/roles';
import { mergeRevealConfig } from '@/lib/reveal-config';
import { resolveStdMedia } from '@/lib/std-media';

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

export async function saveRevealStudio(input: unknown): Promise<Result> {
  try {
    const adminId = await assertAdmin();
    // Sanitize through the canonical merger — drops unknown keys, clamps types.
    const config = mergeRevealConfig(input);
    const db = createAdminClient();
    const { error } = await db
      .from('reveal_studio_config')
      .update({
        config,
        updated_at: new Date().toISOString(),
        updated_by_admin_id: adminId,
      })
      .eq('id', 1);
    if (error) return { ok: false, error: error.message };
    // Couple sites read this on render — revalidate the dynamic [slug] route.
    revalidatePath('/[slug]', 'page');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Save failed.' };
  }
}

/**
 * Manually set the NSFW verdict on a couple's Save-the-Date video
 * (events.std_media.nsfw). The automatic poster-frame screen covers the normal
 * path; this is the admin override for a video stuck at 'pending' (a poster /
 * model hiccup left it never-screened, so it silently never goes live) or a
 * false-positive 'rejected'. Only an 'approved' video plays on the public page.
 */
export async function setStdVideoModeration(
  eventId: string,
  decision: 'approved' | 'rejected',
): Promise<Result> {
  try {
    await assertAdmin();
    if (!eventId) return { ok: false, error: 'missing-event' };
    if (decision !== 'approved' && decision !== 'rejected') {
      return { ok: false, error: 'bad-decision' };
    }
    const db = createAdminClient();
    const { data: row, error: readErr } = await db
      .from('events')
      .select('std_media')
      .eq('event_id', eventId)
      .maybeSingle();
    if (readErr) return { ok: false, error: readErr.message };
    if (!row) return { ok: false, error: 'not-found' };
    const media = resolveStdMedia((row as Record<string, unknown>).std_media);
    if (media.type !== 'video' || !media.videoKey) return { ok: false, error: 'no-video' };
    const { error } = await db
      .from('events')
      .update({ std_media: { ...media, nsfw: decision } })
      .eq('event_id', eventId);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/[slug]', 'page');
    revalidatePath('/admin/reveal-studio', 'page');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed.' };
  }
}
