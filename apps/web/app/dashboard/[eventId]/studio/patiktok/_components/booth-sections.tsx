import { Download, Film, Hash } from 'lucide-react';
import { ServiceSection, ServiceChip, ServiceQuietLink } from '@/app/dashboard/[eventId]/studio/_components/service-page-band';

/**
 * ✅ THE VIDEO BOOTH PAGE'S SECTIONS (owner "approve all", 2026-10-14 — services
 * prototype `sections('booth')`): Templates · Your reels · Post to TikTok. Pure.
 */
export function BoothSections({
  added,
  reels,
  tiktokConnected,
  tiktokHandle,
  tiktokAvailable,
}: {
  added: boolean;
  /** Reels finished — null when unread ("guests record free", never "0"). */
  reels: number | null;
  tiktokConnected: boolean;
  tiktokHandle: string | null;
  tiktokAvailable: boolean;
}) {
  return (
    <div className="mt-2">
      <ServiceSection
        icon={<Film strokeWidth={1.9} />}
        title="Templates"
        sub="Pick your booth's reels"
        end={<ServiceQuietLink href="#templates" label="Change" />}
      />
      <ServiceSection
        icon={<Download strokeWidth={1.9} />}
        title="Your reels"
        sub={
          added
            ? reels !== null
              ? `${reels} ${reels === 1 ? 'reel' : 'reels'} · guests record free`
              : 'Guests record free'
            : 'Watermarked until added'
        }
        end={<ServiceQuietLink href="#renders" label="See" />}
      />
      <ServiceSection
        icon={<Hash strokeWidth={1.9} />}
        title="Post to TikTok"
        sub={tiktokHandle ? `@${tiktokHandle}` : tiktokAvailable ? 'Not connected' : 'Not set up yet'}
        end={<ServiceChip mood={tiktokConnected ? 'ok' : 'off'} words={tiktokConnected ? 'Connected' : 'Not set up'} />}
        dim={!added}
      />
    </div>
  );
}
