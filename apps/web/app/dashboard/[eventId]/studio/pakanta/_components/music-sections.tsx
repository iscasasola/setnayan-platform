import { ListMusic, Music, Settings2 } from 'lucide-react';
import { ServiceSection, ServiceChip, ServiceQuietLink } from '@/app/dashboard/[eventId]/studio/_components/service-page-band';
import { AiDisclosure } from '@/components/AiDisclosure';
import { SongPlayer } from './song-player';
import { UseSongButton } from './use-song-button';

/**
 * ✅ THE MUSIC PAGE'S SECTIONS (owner "approve all", 2026-10-14 — services
 * prototype `sections('music')`): Your brief · Your song (the player marks it
 * heard) · Play on your Event Hub (ONE row). Not added → dim. Pure of reads.
 */
export function MusicSections({
  eventId,
  added,
  owned,
  songReady,
  songFilename,
  songPreviewUrl,
  adopted,
  briefWords,
  hasBrief,
}: {
  eventId: string;
  /** Unlocked (not merely waiting for payment). */
  added: boolean;
  owned: boolean;
  songReady: boolean;
  songFilename: string | null;
  songPreviewUrl: string | null;
  adopted: boolean;
  briefWords: string;
  hasBrief: boolean;
}) {
  return (
    <div className="mt-2">
      <ServiceSection
        id="brief"
        icon={<ListMusic strokeWidth={1.9} />}
        title="Your brief"
        sub={briefWords || 'Style, mood, your story'}
        end={<ServiceQuietLink href="#brief-form" label={hasBrief ? 'See' : 'Tell us'} />}
        dim={!added}
      />
      <ServiceSection
        id="song"
        icon={<Music strokeWidth={1.9} />}
        title="Your song"
        sub={owned && songReady ? `Ready${songFilename ? ` · ${songFilename}` : ''}` : owned ? 'In production' : 'Lands here when ready'}
        dim={!owned}
      >
        {owned && songReady && songPreviewUrl ? (
          <>
            <SongPlayer eventId={eventId} src={songPreviewUrl} />
            <AiDisclosure generator="song" className="mt-2" />
          </>
        ) : owned ? (
          <div className="ss-empty">
            <b>In production</b>
            <span>No clock on this — you will see Ready here first.</span>
          </div>
        ) : null}
      </ServiceSection>
      {/* A setting is ONE row. Turning the song ON is the shipped one-tap adopt; once it plays,
          the Event Hub's own music settings are where it is changed. */}
      <ServiceSection
        icon={<Settings2 strokeWidth={1.9} />}
        title="Play on your Event Hub"
        sub="Softly, as a guest opens it"
        end={adopted ? <ServiceChip mood="ok" words="Playing" /> : owned && songReady ? null : <ServiceChip mood="off" words="When ready" />}
        dim={!owned}
      >
        {owned && songReady && !adopted ? <UseSongButton eventId={eventId} /> : null}
      </ServiceSection>
    </div>
  );
}
