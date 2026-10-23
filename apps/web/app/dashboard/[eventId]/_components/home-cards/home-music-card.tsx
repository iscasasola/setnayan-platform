import Link from 'next/link';
import { ChevronRight, Music } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { readHomeMusicCard } from '@/lib/home-music-card.server';
import { UseSongButton } from '../../studio/pakanta/_components/use-song-button';
import { HomeCardRow, HomeServiceCard } from '../home-service-card';
import { HubDraftSwitch } from './hub-draft-switch';

/** Where the Event Hub's song came from, in the Maker's Music panel's words. */
const SOURCE_WORDS: Record<string, string> = { pakanta: 'Your Music Maker song', upload: 'Upload your own' };

/**
 * 🎵 THE MUSIC CARD (owner 2026-10-23, approved `prototypes/home_service_widgets_2026-10-23.html` frame 7).
 *
 *   QUICK VIEW   In production / Delivered · "Plays on your Event Hub" / "Not on your page yet" · the song with its player
 *                · "Use this song on my site" (the Music Maker page's own button) when it is ready and not yet used.
 *   OPEN         "Play music on my Event Hub" — written into the Hub's DRAFT, counted by the Event Hub card's Apply
 *                (one draft, one Apply) · the song's source, changed in the Maker's Music panel · "Open Music Maker ›".
 *
 * The Source dropdown stays in the Maker for now (its "Our music" list and the upload are the Maker's panel); Home
 * says which one is playing and opens that panel.
 */
export async function HomeMusicCard({ eventId, name, brand }: { eventId: string; name: string; brand?: string }) {
  const supabase = await createClient();
  const read = await readHomeMusicCard(supabase, eventId).catch(() => ({ ok: false }) as const);
  const door = { label: 'Open Music Maker', href: `/dashboard/${eventId}/studio/pakanta` };
  const icon = <Music aria-hidden strokeWidth={1.9} />;
  const marker = { 'data-home-service': 'music' };
  if (!read.ok) return <HomeServiceCard name={name} brand={brand} icon={icon} dots={[]} door={door} failed marker={marker} />;

  return (
    <HomeServiceCard
      name={name}
      brand={brand}
      icon={icon}
      dots={[
        { mood: read.ready ? 'ok' : 'wait', words: read.ready ? 'Delivered' : 'Your song is in production', marker: 'song' },
        ...(read.ready
          ? [{ mood: read.adopted ? ('ok' as const) : ('plain' as const), words: read.adopted ? 'Plays on your Event Hub' : 'Not on your page yet', marker: 'hub' }]
          : []),
      ]}
      status={read.ready && read.filename ? { lead: read.filename } : null}
      body={
        read.previewUrl ? (
          // eslint-disable-next-line jsx-a11y/media-has-caption
          <audio controls preload="none" src={read.previewUrl} className="mt-2 w-full" data-home-music-player="" />
        ) : null
      }
      actions={read.ready && !read.adopted ? <UseSongButton eventId={eventId} /> : null}
      settings={
        <>
          {read.hubHasMusic ? (
            <HubDraftSwitch
              eventId={eventId}
              column="site_bg_music_enabled"
              on={read.hubMusicOn}
              label="Play music on my Event Hub"
              hint={read.draftUnread ? 'Your waiting changes couldn’t load — this shows your live page.' : 'Guests hear it after you press Apply on your Event Hub.'}
            />
          ) : null}
          <HomeCardRow
            label="Source"
            hint={read.hubHasMusic ? (SOURCE_WORDS[read.hubSource ?? ''] ?? 'Our music') : 'No song on your Event Hub yet'}
            marker="music-source"
            control={
              <Link
                href={`/dashboard/${eventId}/website/editor?open=music`}
                className="inline-flex items-center gap-1 text-[13px] font-medium text-ink/65 hover:text-ink"
                data-home-music-source=""
              >
                Change
                <ChevronRight aria-hidden className="h-4 w-4" strokeWidth={1.9} />
              </Link>
            }
          />
        </>
      }
      door={door}
      marker={marker}
    />
  );
}
