import { fetchRevealConfig } from '@/lib/reveal-config';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveStdMedia } from '@/lib/std-media';
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
 *  the admin override queue. Auto-approved videos are presumed fine + omitted. */
async function fetchStdVideosNeedingReview(): Promise<PendingStdVideo[]> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from('events')
      .select('event_id, public_id, display_name, std_media')
      .filter('std_media->>type', 'eq', 'video')
      .limit(200);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const needing = rows
      .map((r) => ({ r, m: resolveStdMedia(r.std_media) }))
      .filter(({ m }) => m.type === 'video' && m.videoKey && m.nsfw !== 'approved');
    return Promise.all(
      needing.map(async ({ r, m }) => ({
        eventId: r.event_id as string,
        publicId: (r.public_id as string) ?? '',
        name: (r.display_name as string) || 'Untitled wedding',
        status: (m.nsfw === 'rejected' ? 'rejected' : 'pending') as 'pending' | 'rejected',
        videoUrl: m.videoKey ? await displayUrlForStoredAsset(m.videoKey) : null,
        posterUrl: m.posterKey ? await displayUrlForStoredAsset(m.posterKey) : null,
      })),
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
