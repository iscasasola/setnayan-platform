import { fetchRevealConfig } from '@/lib/reveal-config';
import { createAdminClient } from '@/lib/supabase/admin';
import { displayUrlForStoredAsset } from '@/lib/uploads';
import { resolveStdMedia } from '@/lib/std-media';
import { RevealStudio } from './studio';
import { StdVideoModeration, type PendingStdVideo } from './std-video-moderation';

export const metadata = { title: 'Reveal Studio · Setnayan HQ' };

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

export default async function AdminRevealStudioPage() {
  const [config, stdVideos] = await Promise.all([
    fetchRevealConfig(),
    fetchStdVideosNeedingReview(),
  ]);
  return (
    <div className="max-w-6xl px-5 py-8 sm:px-8">
      <div className="mb-6">
        <div className="mb-1 text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)]">Content</div>
        <h1 className="text-2xl font-semibold text-[var(--m-ink,#1e2229)]">Reveal Studio</h1>
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
