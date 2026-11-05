import { PageMasthead } from '@/app/_components/page-masthead';
import { requireAdmin } from '@/lib/admin/require-admin';
import { fetchHubMusicForAdmin } from '@/lib/hub-music-server';
import { HubMusicManager } from './hub-music-manager';

export const metadata = { title: 'Event Hub music · Admin' };

/**
 * Admin · Event Hub music — "Our music" (owner 2026-10-08: "background music.
 * where can we upload via admin to add music they can pick?").
 *
 * The one place the tracks are uploaded, and the list couples pick from in
 * Look › Music once a track is published.
 * Migration: 20271266495922_hub_music_tracks.sql.
 */
export default async function AdminHubMusicPage() {
  // This page reads through the service-role client, so it gates itself — a
  // layout is not a safe auth boundary.
  await requireAdmin();
  const read = await fetchHubMusicForAdmin();

  return (
    <div className="max-w-5xl px-5 py-8 sm:px-8">
      <PageMasthead title="Event Hub music" />
      <HubMusicManager
        initial={read.ok ? read.tracks : null}
        readError={read.ok ? null : read.error}
      />
    </div>
  );
}
