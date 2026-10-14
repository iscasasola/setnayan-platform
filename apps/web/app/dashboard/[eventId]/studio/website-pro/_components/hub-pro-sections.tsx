import { Diamond, Globe2, ImageIcon } from 'lucide-react';
import { ServiceSection, ServiceChip, ServiceQuietLink } from '@/app/dashboard/[eventId]/studio/_components/service-page-band';

/**
 * ✅ THE EVENT HUB PRO PAGE'S SECTIONS (owner 2026-10-14 🧾 + ✅ the services
 * prototype `sections('hub')`): Your theme · Backgrounds · Your Event Hub. Each
 * opens the Maker — ◆ is tried freely and applied with Pro, never a padlock. Pure.
 */
export function HubProSections({
  eventId,
  on,
  theme,
  background,
}: {
  eventId: string;
  on: boolean;
  theme: string | null;
  background: string | null;
}) {
  return (
    <div className="mt-2">
      <ServiceSection
        icon={<Diamond strokeWidth={1.9} />}
        title="Your theme"
        sub={on ? (theme ? `${theme} · applied` : 'Applied') : 'Classic (free) · ◆ with Pro'}
        end={<ServiceQuietLink href={`/dashboard/${eventId}/launch`} label="Change" />}
      />
      <ServiceSection
        icon={<ImageIcon strokeWidth={1.9} />}
        title="Backgrounds"
        sub={on ? (background ? `${background.replace(/^./, (c) => c.toUpperCase())} · applied` : 'Applied') : 'Colours and patterns · ◆ media'}
        end={<ServiceQuietLink href={`/dashboard/${eventId}/launch`} label="Change" />}
      />
      <ServiceSection
        icon={<Globe2 strokeWidth={1.9} />}
        title="Your Event Hub"
        sub={on ? 'Watermark-free, everywhere guests see it' : 'Carries the Setnayan mark'}
        end={on ? <ServiceChip mood="ok" words="Pro on" /> : <ServiceChip mood="off" words="Free" />}
      />
    </div>
  );
}
