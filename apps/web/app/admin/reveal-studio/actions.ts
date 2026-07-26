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
import { resolveStdMedia, resolveStdNsfwVerdict } from '@/lib/std-media';
import {
  retireSupersededSeals,
  sealScreenedMedia,
  stdSealedFingerprints,
  stdSourceFingerprints,
} from '@/lib/std-video-gate';

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
 * The HUMAN EXAMINATION of a couple's Save-the-Date video — and, since SEC-6
 * round three, the ONLY thing in this codebase that can authorise one to play.
 *
 * ── WHY A HUMAN AT ALL ──────────────────────────────────────────────────────
 * The automatic screen classifies the POSTER, a JPEG the browser grabbed at
 * upload time and uploaded as an independent object with no derivation proof.
 * "Dirty video + clean unrelated poster" therefore produced, for two rounds, a
 * real bound-and-sealed `approved` for a video nothing had ever looked at.
 * nsfwjs is image-only and Vercel has no ffmpeg (lib/clip-poster.ts,
 * lib/hero-video.ts), so there is no server-side frame extraction to fall back
 * on. Until there is, the examiner competent to judge a video is a person, and
 * `COMPETENT_EXAMINERS.video` (lib/std-media.ts) says exactly that.
 *
 * ── WHAT THE REVIEWER IS ACTUALLY LOOKING AT ────────────────────────────────
 * The SEALED object — the immutable copy under `events/{id}/std-screened/`, the
 * same bytes the guest's browser will fetch. Not the couple's upload key, which
 * they still hold a presigned PUT for. So "the bytes examined" and "the bytes
 * served" are one object rather than two reads reconciled by a hash, and a row
 * that has not been sealed yet is simply NOT APPROVABLE.
 *
 * The fingerprint pin stays as a second lock: the queue passes the
 * `<etag>:<bytes>` of the objects it presigned into the player, and an approval
 * is refused (`stale-media`) if the sealed objects no longer read back the same.
 * Sealed keys have no writer, so that can only fire on an out-of-band act — but
 * an out-of-band act is exactly the case that must refuse rather than assume.
 *
 * A rejection is NOT pinned. Rejecting only ever withholds, and refusing to
 * reject stale media would leave a video un-blockable.
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
      .select('std_media, std_media_nsfw')
      .eq('event_id', eventId)
      .maybeSingle();
    if (readErr) return { ok: false, error: readErr.message };
    if (!row) return { ok: false, error: 'not-found' };
    const record = row as Record<string, unknown>;
    const media = resolveStdMedia(record.std_media, eventId);
    if (media.type !== 'video' || !media.videoKey) return { ok: false, error: 'no-video' };
    if (!media.posterKey) return { ok: false, error: 'no-poster' };
    const previous = resolveStdNsfwVerdict(record.std_media_nsfw);

    const now = new Date().toISOString();
    let next: Record<string, unknown>;

    if (decision === 'rejected') {
      next = {
        status: 'rejected',
        videoKey: media.videoKey,
        posterKey: media.posterKey,
        videoFingerprint: previous.videoFingerprint,
        posterFingerprint: previous.posterFingerprint,
        sealed: null,
        video: null,
        poster: null,
        // A human rejection ends any grandfathered carry-over for good.
        grandfathered: null,
        screenedAt: now,
        attemptedAt: now,
      };
    } else {
      // Approval REQUIRES frozen bytes. An admin can only ever put their name to
      // an object that cannot change afterwards.
      const sealed = previous.sealed;
      if (!sealed) return { ok: false, error: 'not-sealed' };
      const live = await stdSealedFingerprints(sealed, eventId);
      if (!live.video || !live.poster) return { ok: false, error: 'media-unreadable' };
      if (live.video !== sealed.videoFingerprint || live.poster !== sealed.posterFingerprint) {
        return { ok: false, error: 'stale-media' };
      }
      // The pin: what the reviewer's player was given must be what is still there.
      if (
        live.video !== (expect?.videoFingerprint ?? null) ||
        live.poster !== (expect?.posterFingerprint ?? null)
      ) {
        return { ok: false, error: 'stale-media' };
      }
      /**
       * Two examinations, both `human-review`, both naming the SEALED object.
       * The reviewer streamed the video and saw the poster as its frame, so they
       * are competent for both roles (COMPETENT_EXAMINERS). `digest` is null:
       * they watched the bytes, they did not buffer and hash them.
       */
      const examined = (ref: string, fingerprint: string) => ({
        ref,
        fingerprint,
        digest: null,
        by: 'human-review' as const,
        at: now,
      });
      next = {
        status: 'approved',
        videoKey: media.videoKey,
        posterKey: media.posterKey,
        videoFingerprint: previous.videoFingerprint,
        posterFingerprint: previous.posterFingerprint,
        sealed: {
          videoRef: sealed.videoRef,
          videoFingerprint: sealed.videoFingerprint,
          posterRef: sealed.posterRef,
          posterFingerprint: sealed.posterFingerprint,
        },
        video: examined(sealed.videoRef, sealed.videoFingerprint),
        poster: examined(sealed.posterRef, sealed.posterFingerprint),
        // A real examination SUPERSEDES the SEC-6 cutover marker — the row is no
        // longer serving on a legacy poster-only screen, so it drops out of the
        // grandfathered set and stops showing up as needing re-review.
        grandfathered: null,
        screenedAt: now,
        attemptedAt: now,
      };
    }

    const { data: written, error } = await db
      .from('events')
      .update({ std_media_nsfw: next })
      .eq('event_id', eventId)
      // Conditional on the row still holding this exact media, so an override
      // can never land on something the couple changed mid-review.
      .filter('std_media->>videoKey', 'eq', media.videoKey)
      .filter('std_media->>posterKey', 'eq', media.posterKey)
      .select('event_id');
    if (error) return { ok: false, error: error.message };
    // PostgREST returns no error when a filtered UPDATE matches nothing, so the
    // affected-row count is the only proof the decision actually landed.
    if (!written || written.length === 0) return { ok: false, error: 'stale-media' };
    await retireSupersededSeals({
      eventId,
      previous,
      next: resolveStdNsfwVerdict(next),
    });
    revalidatePath('/[slug]', 'page');
    revalidatePath('/admin/reveal-studio', 'page');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed.' };
  }
}

/**
 * Freeze a row's current bytes so a human CAN review it. Records no decision and
 * no examination — it only creates the immutable copy the reviewer will watch.
 *
 * Needed because approval is gated on a seal, and two states arrive without one:
 * a video the automatic screen REJECTED (the reject path deliberately seals
 * nothing — a sealed copy of refused content is a permanent public object we do
 * not want), and a video whose screen never finished. Before SEC-6 an admin
 * could override either straight to `approved`; that path is gone, so this is
 * what replaces it. It is deliberately two clicks: prepare, then examine and
 * decide — the human's approval is always against frozen bytes.
 */
export async function sealStdVideoForReview(eventId: string): Promise<Result> {
  try {
    await assertAdmin();
    if (!eventId) return { ok: false, error: 'missing-event' };
    const db = createAdminClient();
    const { data: row, error: readErr } = await db
      .from('events')
      .select('std_media, std_media_nsfw')
      .eq('event_id', eventId)
      .maybeSingle();
    if (readErr) return { ok: false, error: readErr.message };
    if (!row) return { ok: false, error: 'not-found' };
    const record = row as Record<string, unknown>;
    const media = resolveStdMedia(record.std_media, eventId);
    if (media.type !== 'video' || !media.videoKey) return { ok: false, error: 'no-video' };
    if (!media.posterKey) return { ok: false, error: 'no-poster' };
    const previous = resolveStdNsfwVerdict(record.std_media_nsfw);

    const { video: videoFingerprint, poster: posterFingerprint } =
      await stdSourceFingerprints(media, eventId);
    if (!videoFingerprint || !posterFingerprint) {
      return { ok: false, error: 'media-unreadable' };
    }
    const sealed = await sealScreenedMedia({
      eventId,
      media,
      videoFingerprint,
      posterFingerprint,
    });
    if (!sealed) return { ok: false, error: 'media-unreadable' };

    const now = new Date().toISOString();
    const next = {
      // Sealed but unexamined. Does NOT play — `stdVideoServeRefs` needs an
      // examination for each served artifact and there is none yet.
      status: 'in_review',
      videoKey: media.videoKey,
      posterKey: media.posterKey,
      videoFingerprint,
      posterFingerprint,
      sealed: {
        videoRef: sealed.videoRef,
        videoFingerprint: sealed.videoFingerprint,
        posterRef: sealed.posterRef,
        posterFingerprint: sealed.posterFingerprint,
      },
      video: null,
      poster: null,
      grandfathered: previous.grandfathered,
      screenedAt: null,
      attemptedAt: now,
    };
    const { data: written, error } = await db
      .from('events')
      .update({ std_media_nsfw: next })
      .eq('event_id', eventId)
      .filter('std_media->>videoKey', 'eq', media.videoKey)
      .filter('std_media->>posterKey', 'eq', media.posterKey)
      .select('event_id');
    if (error) return { ok: false, error: error.message };
    if (!written || written.length === 0) return { ok: false, error: 'stale-media' };
    await retireSupersededSeals({
      eventId,
      previous,
      next: resolveStdNsfwVerdict(next),
    });
    revalidatePath('/admin/reveal-studio', 'page');
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Failed.' };
  }
}
