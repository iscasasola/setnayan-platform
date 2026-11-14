import { Wifi } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { VenueCheckStatus, type VenueCheckStatusProps } from './venue-check-status';

import { InfoTip } from '@/app/_components/info-tip';
/**
 * The venue check's door on Live Watch setup (owner 5 Nov 2026: "it should"). The page told couples to
 * "run a venue connectivity check a week ahead" for months with no tool behind it; this card is the
 * tool's door, and shows the last result to the couple and the coordinator alike.
 */
export function VenueCheckCard({ href, latest }: { href: string; latest: VenueCheckStatusProps }) {
  return (
    <section aria-labelledby="venue-check-heading" className="border-t border-ink/10 space-y-3 py-5 sm:p-6">
      <p className="sn-eye">Before the day</p>
      <h2 id="venue-check-heading" className="flex items-center gap-2 text-xl font-semibold tracking-tight">
        <Wifi aria-hidden className="h-5 w-5 text-terracotta" strokeWidth={1.75} />
        Check the venue&rsquo;s connection
      </h2>
      <InfoTip labelAs="p" label="Open this on a phone at the venue, where the stream will go out from." labelClassName="text-sm text-ink/70" className="max-w-prose" align="start">
        It tells you whether the connection can
        carry your live stream.
      </InfoTip>
      <VenueCheckStatus {...latest} />
      <ActionButton
        tone="brand"
        main
        icon={<Wifi aria-hidden className="h-4 w-4" strokeWidth={2} />}
        label={latest.state === 'found' ? 'Check again' : 'Check the venue'}
        href={href}
        data-testid="venue-check-open"
      />
    </section>
  );
}
