import { fetchRevealConfig } from '@/lib/reveal-config';
import { createAdminClient } from '@/lib/supabase/admin';
import { resolveStdMedia, resolveStdNsfwVerdict, stdNsfwDisplayStatus } from '@/lib/std-media';
import { stdVideoReviewMedia } from '@/lib/std-video-gate';
import { RevealStudio } from '@/app/admin/reveal-studio/studio';
import {
  StdVideoModeration,
  type PendingStdVideo,
} from '@/app/admin/reveal-studio/std-video-moderation';

/**
 * RevealStudioSurface — the Reveal Studio body, re-homed byte-identical from
 * app/admin/reveal-studio/page.tsx into the tabbed /admin/studio studio
 * (Studio Studio slice 1). No searchParams. The house-default reveal config
 * editor (RevealStudio) + the STD-video override queue (StdVideoModeration)
 * are client components imported unchanged from @/app/admin/reveal-studio/*
 * (they import their own actions from @/app/admin/reveal-studio/actions). The
 * only change is mechanical: the outer max-w-6xl container is dropped (the
 * studio shell provides layout), matching the surface convention.
 *
 * NOTE: this /admin/studio Reveal Studio tab is DISTINCT from the legacy
 * /admin/reveal-studio route (which now redirects here); no route collision.
 */

/** Couple STD videos awaiting (pending) or failed (rejected) the auto-screen —
 *  the admin override queue. Videos carrying a BOUND `approved` verdict are
 *  omitted; a verdict that no longer binds its media counts as pending (SEC-6). */
async function fetchStdVideosNeedingReview(): Promise<PendingStdVideo[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('events')
      .select('event_id, public_id, display_name, std_media')
      .filter('std_media->>type', 'eq', 'video')
      .limit(200);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    if (rows.length === 0) return [];

    // SEC-6 — the verdict is a SEPARATE, host-unwritable column, fetched in its
    // OWN query so a deploy that lands ahead of the migration degrades to "every
    // video needs review" (a fuller queue) instead of an empty one. An empty
    // review queue is the dangerous failure here, not a crowded one.
    const verdicts = new Map<string, unknown>();
    {
      const { data: vRows } = await admin
        .from('events')
        .select('event_id, std_media_nsfw')
        .in(
          'event_id',
          rows.map((r) => r.event_id as string),
        );
      for (const v of (vRows ?? []) as Array<Record<string, unknown>>) {
        verdicts.set(v.event_id as string, v.std_media_nsfw);
      }
    }

    const needing = rows
      // A verdict naming a video the couple has since replaced is stale, so its
      // event belongs back in this queue. So is an `approved` verdict that never
      // produced a sealed copy — it shows nothing to a guest, and filtering on
      // the raw status would hide it from the ONE surface that can fix it
      // (SEC-6 round two: fail-closed must not also mean invisible).
      .map((r) => {
        const eventId = r.event_id as string;
        const m = resolveStdMedia(r.std_media, eventId);
        const verdict = resolveStdNsfwVerdict(verdicts.get(eventId));
        return { r, m, s: stdNsfwDisplayStatus(m, verdict, eventId) };
      })
      .filter(({ m, s }) => m.type === 'video' && m.videoKey && s !== 'approved');
    return Promise.all(
      needing.map(async ({ r, m, s }) => {
        // The reviewer watches the couple's SOURCE objects (the bytes under
        // judgement) through the same strict parser the gate uses — never
        // displayUrlForStoredAsset, whose legacy passthrough could point the
        // player at a foreign origin while the fingerprint covered an R2 decoy.
        // The fingerprints ride along so Approve can be pinned to them.
        const review = await stdVideoReviewMedia(m, r.event_id as string);
        return {
          eventId: r.event_id as string,
          publicId: (r.public_id as string) ?? '',
          name: (r.display_name as string) || 'Untitled wedding',
          status: s as 'pending' | 'rejected',
          videoUrl: review.videoUrl,
          posterUrl: review.posterUrl,
          videoFingerprint: review.videoFingerprint,
          posterFingerprint: review.posterFingerprint,
        };
      }),
    );
  } catch {
    // Pre-migration env / read error → empty queue (panel hides). Never break the page.
    return [];
  }
}

export async function RevealStudioSurface() {
  const [config, stdVideos] = await Promise.all([
    fetchRevealConfig(),
    fetchStdVideosNeedingReview(),
  ]);
  return (
    <div>
      <div className="mb-6">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)]">Content</div>
        <h1 className="text-2xl font-semibold text-[var(--m-ink,#1b1a17)]">Reveal Studio</h1>
        <p className="mt-2 max-w-2xl text-[14px] leading-relaxed text-[var(--m-slate,#4f535b)]">
          The opening reveal on every Save-the-Date couple site — the bridal veil, envelopes and
          doors guests lift to uncover the invitation. Turn it on or off, choose which templates
          couples may use, toggle features, and tune the veil look with the live sliders. Changes
          save as the house default and go live on couple sites.
        </p>
      </div>
      <RevealStudio initial={config} />
      <StdVideoModeration initial={stdVideos} />
    </div>
  );
}
