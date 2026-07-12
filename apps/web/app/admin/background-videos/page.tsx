import { fetchBackgroundVideosForAdmin } from '@/lib/background-videos';
import { BackgroundVideosManager, type SlotState } from './background-videos-manager';

import { requireAdmin } from '@/lib/admin/require-admin';
export const metadata = { title: 'Background videos · Admin' };

/**
 * Admin · Homepage background videos. Upload up to six plain looping clips:
 *   • slot 0    — the MAIN homepage background video (looping hero).
 *   • slots 1-5 — the five PILLAR "icon" videos in the bottom dock.
 * Migration: 20270328031951_homepage_background_videos.sql.
 */
export default async function AdminBackgroundVideosPage() {
  // Defense-in-depth: this page reads the RLS-bypassing service-role client,
  // so it gates itself (a layout is not a safe auth boundary).
  await requireAdmin();
  const rows = await fetchBackgroundVideosForAdmin();
  const slots: SlotState[] = rows.map((r) => ({
    slot: r.slot,
    pillarKey: r.pillarKey,
    label: r.label,
    url: r.url,
    isPublished: r.isPublished,
    hasVideo: Boolean(r.videoR2Key),
  }));

  return (
    <div className="px-5 py-8 sm:px-8 max-w-5xl">
      <div className="mb-6">
        <div className="text-[11px] uppercase tracking-wider text-[var(--m-slate,#6a6e76)] mb-1">Content</div>
        <h1 className="text-2xl font-semibold text-[var(--m-ink,#1b1a17)]">Homepage background videos</h1>
        <p className="text-[14px] leading-relaxed text-[var(--m-slate,#4f535b)] mt-2 max-w-2xl">
          Six looping background videos for the homepage. The first is the{' '}
          <strong>main background video</strong> (the full-screen looping hero). The other five are the{' '}
          <strong>pillar icons</strong> shown in the dock at the bottom of the page — Ala Ala, Likha, Plano,
          Suri, and Tiangge. Upload a clip to a slot, then click <strong>Publish</strong> to make it live. Until a
          slot is published, the homepage keeps its current hero / hides that icon.
        </p>
      </div>

      <BackgroundVideosManager slots={slots} />
    </div>
  );
}
