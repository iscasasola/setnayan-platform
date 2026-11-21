import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeft } from 'lucide-react';
import type { VendorPapicTier } from '@/lib/vendor-papic-tier';
import { hubHref } from '@/lib/hub-events';
import { PartPage, PartText, setTwo } from '../../../../_components/set-two/parts';
import { ReadFailedBody } from '../../../../_components/set-two/read-failed';
import { PapicCaptureController } from './papic-capture-controller';

/**
 * THE PAPIC DESK — before you shoot, the camera, and what you shot, in the November look (owner-approved 21 Nov 2026,
 * supplier pages set two, page 8; drawing `supplier_pages_set2_v2_fable.html` `#p8`, "Papic: before you shoot" · "the
 * camera" · "Papic · not the event day" · "Papic credits card" · "Your private portfolio").
 *
 * Draws only — `papic/page.tsx` reads and decides; what reads data of its own (what you shot, the credits card, the
 * private portfolio, the challenge photos) arrives as a SLOT the page renders, so the lab draws this from fixtures.
 *
 * 🔒 A FAILED READ IS SAID, NEVER A REDIRECT (drawing "Papic · this event could not be read"): `PapicReadFailed` keeps
 * the shell and the title and offers Try again as the one main button. A gate that REFUSES (the counsel switch off, no
 * shop, not booked here, the fee unpaid) still sends you where it always did — the page tells the two apart.
 * 🔒 app/vendor-dashboard/on-the-day/set-two-day-reads-are-honest.test.ts
 */

/** The pinned row: the round back · the title over "Back to …". The back is per visit (the floor on the day, the Hub
 *  after it), so it is drawn here rather than read from the one map's fixed home. */
function PapicPin({ title, backHref, backLabel }: { title: string; backHref: string; backLabel: string }) {
  return (
    <div className={setTwo.pin} data-set-two-pin="">
      <Link href={backHref} aria-label={backLabel} className={setTwo.round} data-set-two-back="">
        <ArrowLeft aria-hidden strokeWidth={1.75} />
      </Link>
      <h1 className={setTwo.pinTitle}>
        {title}
        <small>{backLabel}</small>
      </h1>
    </div>
  );
}

/** This event's Papic could not be read: the shell, the title, the note, Try again. */
export function PapicReadFailed({ eventId }: { eventId: string }) {
  return (
    <PartPage column="mx-auto w-full tab:max-w-3xl" mark="papic">
      <PapicPin title="Papic capture" backHref={hubHref(eventId)} backLabel="Back to the Hub" />
      <ReadFailedBody mark="papic">We couldn&rsquo;t load this event&rsquo;s Papic right now.</ReadFailedBody>
    </PartPage>
  );
}

export type PapicCapture = {
  uploadOwner: string | null;
  tier: VendorPapicTier;
  allowVideo: boolean;
  pointsCap: number | null;
  pointsSpent: number;
};

export function PapicDeskBody({
  eventId,
  isEventDay,
  backHref,
  coupleName,
  capture,
  captures,
  credits,
  album,
  challenge,
}: {
  eventId: string;
  /** The shutter is day-bound; looking back is not. */
  isEventDay: boolean;
  /** The floor on the day, the Hub after it. */
  backHref: string;
  coupleName: string;
  /** The camera's allowance on the event day; null = the camera hides. */
  capture: PapicCapture | null;
  /** "What you've shot" — the strip under the shutter. */
  captures: ReactNode;
  /** Papic credits + the pack. */
  credits: ReactNode;
  /** The private portfolio. */
  album: ReactNode;
  /** "From your challenge" — renders nothing when there is nothing. */
  challenge: ReactNode;
}) {
  const backLabel = isEventDay ? 'Back to the floor' : 'Back to the Hub';
  const pin = <PapicPin title={isEventDay ? 'Papic capture' : 'What you shot'} backHref={backHref} backLabel={backLabel} />;
  return (
    <PartPage column="mx-auto w-full tab:max-w-3xl" mark="papic">
      {isEventDay && capture ? (
        <PapicCaptureController
          pin={pin}
          backHref={backHref}
          backLabel={backLabel}
          eventId={eventId}
          uploadOwner={capture.uploadOwner}
          coupleName={coupleName}
          tier={capture.tier}
          allowVideo={capture.allowVideo}
          pointsCap={capture.pointsCap}
          pointsSpent={capture.pointsSpent}
        />
      ) : (
        <>
          {pin}
          <PartText>
            The camera runs on the day itself. These are the photos and clips you shot at {coupleName} — they stay here
            for you to check.
          </PartText>
        </>
      )}

      {/* What they already shot, under the shutter — the question on a dark reception floor is "did that upload?",
          and the answer belongs on the same screen (the camera's "what you shot" press lands here). */}
      <div id="what-you-shot" className="scroll-mt-24 px-4 tab:px-1">
        {captures}
      </div>
      {credits}
      {album}
      <div className="px-4 tab:px-1">{challenge}</div>
    </PartPage>
  );
}
