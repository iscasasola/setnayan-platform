import { MonitorPlay, Tv, Video } from 'lucide-react';
import { ServiceSection, ServiceChip, ServiceQuietLink } from '@/app/dashboard/[eventId]/studio/_components/service-page-band';

/**
 * ✅ THE LIVE STREAM PAGE'S SECTIONS (owner "approve all", 2026-10-14 — services
 * prototype `sections('live')`): Your cameras · Recording ("keep a copy" — call
 * 2) · YouTube channel. Pure.
 */
export function LiveSections({
  on,
  cameras,
  recorded,
  recordedLength,
  controllerHref,
  channelName,
  hostedChannel,
  linked,
}: {
  on: boolean;
  /** Cameras set up — null when unread. */
  cameras: number | null;
  recorded: boolean;
  recordedLength: string | null;
  controllerHref: string;
  channelName: string | null;
  hostedChannel: boolean;
  linked: boolean;
}) {
  return (
    <div className="mt-2">
      <ServiceSection
        icon={<Video strokeWidth={1.9} />}
        title="Your cameras"
        sub={
          on
            ? cameras !== null
              ? cameras === 0
                ? 'None set up yet'
                : `${cameras} set up`
              : 'Set up in the controller'
            : '1 free · more with Live Watch'
        }
        end={<ServiceQuietLink href={controllerHref} label="Pair a camera" />}
      />
      <ServiceSection
        id="recording"
        icon={<Tv strokeWidth={1.9} />}
        title="Recording"
        sub={recorded ? `${recordedLength ?? 'Recorded'} · unlisted` : 'Starts when you press Go live'}
        end={recorded ? <ServiceQuietLink href={controllerHref} label="Download" /> : null}
        dim={!on}
      >
        {recorded ? (
          <p className="m-0 text-[13px] text-ink/60">Keep a copy — YouTube unlisted links are not forever.</p>
        ) : null}
      </ServiceSection>
      <ServiceSection
        icon={<MonitorPlay strokeWidth={1.9} />}
        title="YouTube channel"
        sub={channelName ?? (hostedChannel ? 'Setnayan runs your channel' : 'Not linked yet')}
        end={<ServiceChip mood={linked ? 'ok' : 'off'} words={linked ? 'Linked' : 'Not linked'} />}
      />
    </div>
  );
}
