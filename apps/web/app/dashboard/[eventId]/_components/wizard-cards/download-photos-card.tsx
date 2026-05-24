/**
 * Card 37 Download Photos · Phase 5 · Post-event tier.
 *
 * Post-wedding photo delivery confirmation. Photographers + videographers
 * typically deliver final edited galleries 4-8 weeks after the wedding
 * via Google Drive / Dropbox / WeTransfer. The wizard surfaces a simple
 * "we have them" mark-done · the actual delivery happens out-of-band
 * with the vendor.
 *
 * V1.x layer can deepen this — surface per-vendor delivery status from
 * event_vendor relationships · Drive-link capture · etc. For V1, just
 * track wizard-side completion so the host can advance past this card.
 */

import { PaperworkCard } from './paperwork-card';

type Props = { eventId: string };

export function DownloadPhotosCard({ eventId }: Props) {
  return (
    <PaperworkCard
      eventId={eventId}
      taskId="download_photos"
      intro={
        <>
          <p>
            Your photo + video team typically delivers the final edited
            gallery 4–8 weeks after the wedding via Google Drive, Dropbox,
            or WeTransfer. Save copies to your own cloud as soon as you
            receive them — vendor links can expire.
          </p>
          <p className="mt-2 text-ink/65">
            Click <em>Waiting on delivery</em> while you wait, or
            <em> Mark done</em> once the gallery is downloaded.
          </p>
        </>
      }
      inFlightLabel="Waiting on delivery"
      doneLabel="Gallery downloaded"
    />
  );
}
