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
import { sealScreenedMedia, stdSourceFingerprints } from '@/lib/std-video-gate';

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
 * (events.std_media_nsfw). The automatic poster-frame screen covers the normal
 * path; this is the admin override for a video stuck unscreened (a poster /
 * model hiccup left it never-decided, so it silently never goes live) or a
 * false-positive 'rejected'. Only an 'approved' video plays on the public page.
 *
 * SEC-6: the verdict is written into the host-UNWRITABLE column, and it is
 * BOUND — it names the exact videoKey + posterKey it covers and records a
 * content fingerprint of each object. An admin approval therefore covers the
 * bytes that were there when they approved and nothing else: if the couple
 * swaps the video afterwards (new key, or a re-PUT to the same key with the
 * presigned URL they still hold), the approval stops applying and the film
 * falls back to their photo gallery. That is the whole point — an override
 * that could outlive its media would just be the original bug with extra steps.
 *
 * An 'approved' decision REQUIRES both fingerprints. If R2 cannot identify the
 * objects we refuse rather than write an approval we cannot bind (fail closed).
 *
 * ── ROUND TWO: APPROVAL IS PINNED TO THE BYTES THAT WERE ON SCREEN ──────────
 * The reviewer watches at T0 and clicks Approve at T1. Fingerprinting at T1 —
 * which is what the first cut did — approves whatever is at the key when the
 * button is pressed, and the couple still holds a presigned PUT for that key.
 * So the queue now hands the reviewer the fingerprints of the exact objects it
 * presigned for their player, and this action REFUSES unless the live bytes
 * still match them (`stale-media`). The reviewer then re-opens the refreshed
 * queue and watches the new bytes, which is the only honest resolution.
 *
 * And an approval SEALS: the approved bytes are copied into the un-writable
 * `std-screened/` prefix and it is that copy the guest page serves, so the
 * admin's decision cannot be undone by a later re-PUT either.
 */
export async function setStdVideoModeration(
  eventId: string,
  decision: 'approved' | 'rejected',
  expect?: { videoFingerprint?: string | null; posterFingerprint?: string | null },
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
    const media = resolveStdMedia((row as Record<string, unknown>).std_media, eventId);
    if (media.type !== 'video' || !media.videoKey) return { ok: false, error: 'no-video' };
    if (!media.posterKey) return { ok: false, error: 'no-poster' };

    const { video: videoFingerprint, poster: posterFingerprint } =
      await stdSourceFingerprints(media, eventId);
    if (decision === 'approved' && (!videoFingerprint || !posterFingerprint)) {
      return { ok: false, error: 'media-unreadable' };
    }
    // The pin. An approval must cover the bytes the reviewer was shown; a
    // rejection is safe either way (it only ever withholds), so it is not pinned
    // — refusing to reject stale media would leave a video un-blockable.
    if (
      decision === 'approved' &&
      (videoFingerprint !== (expect?.videoFingerprint ?? null) ||
        posterFingerprint !== (expect?.posterFingerprint ?? null))
    ) {
      return { ok: false, error: 'stale-media' };
    }

    // Seal BEFORE writing the approval — an approval with no sealed copy shows
    // nothing to a guest, so writing one would just create a confusing dead row.
    let sealed: { servedVideoKey: string; servedPosterKey: string } | null = null;
    if (decision === 'approved') {
      sealed = await sealScreenedMedia({
        eventId,
        media,
        videoFingerprint: videoFingerprint as string,
        posterFingerprint: posterFingerprint as string,
      });
      if (!sealed) return { ok: false, error: 'media-unreadable' };
    }

    const now = new Date().toISOString();
    const { error } = await db
      .from('events')
      .update({
        std_media_nsfw: {
          status: decision,
          videoKey: media.videoKey,
          posterKey: media.posterKey,
          videoFingerprint,
          posterFingerprint,
          servedVideoKey: sealed?.servedVideoKey ?? null,
          servedPosterKey: sealed?.servedPosterKey ?? null,
          screenedAt: now,
          attemptedAt: now,
        },
      })
      .eq('event_id', eventId)
      // Conditional on the row still holding this exact media, so an override
      // can never land on something the couple changed mid-review.
      .filter('std_media->>videoKey', 'eq', media.videoKey)
      .filter('std_media->>posterKey', 'eq', media.posterKey);
    if (error) return { ok: false, error: error.message };
    revalidatePath('/[slug]', 'page');
    revalidatePath('/admin/reveal-studio', 'page');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed.' };
  }
}
