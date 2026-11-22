import { Clock, Lock } from 'lucide-react';
import { InfoTip } from '@/app/_components/info-tip';
import { MAX_PER_TYPE } from '@/lib/editorial-vendor-media';
import { PartNote } from '@/app/vendor-dashboard/_components/set-two/parts';
import { TheirEventPart } from '@/app/vendor-dashboard/_components/set-two/their-event-line';
import { EditorialMediaStudio, type ExistingMedia } from './_components/editorial-media-studio';

const ROUTE = '/vendor-dashboard/clients/[eventId]/editorial-media';

export type EditorialEligibilityView =
  | { kind: 'open'; existing: ExistingMedia[]; existingUnread: boolean }
  | { kind: 'almost'; disputed: boolean }
  | { kind: 'not-recommended' };

/**
 * From your camera, drawn from the page's reads (the lab draws it from fixtures). Supplier pages set two, page 4: the
 * first line of the intro stays on screen, the rest moves into the ⓘ word for word; the supplier-side words say "Story"
 * (decided 2 — no route or table rename); the not-yet states are notes.
 */
export function EditorialMediaBody({
  eventId,
  eventName,
  vendorProfileId,
  view,
}: {
  eventId: string;
  /** The couple's event name as read; null when it could not be read (the line then says "Their event"). */
  eventName: string | null;
  vendorProfileId: string;
  view: EditorialEligibilityView;
}) {
  const who = eventName ?? 'this wedding';
  return (
    <TheirEventPart
      column="mx-auto w-full tab:max-w-3xl"
      mark="editorial-media"
      route={ROUTE}
      eventId={eventId}
      eventName={eventName}
      title="From your camera"
      end={
        <InfoTip label="" ariaLabel="About From your camera" align="end">
          They appear in a “From your suppliers” strip on the couple’s Story, credited to you. Clips loop as a seamless
          boomerang.
        </InfoTip>
      }
      intro={
        <p>
          Add a few of your favourite shots from {who} — up to <strong>{MAX_PER_TYPE} photos</strong> and{' '}
          <strong>{MAX_PER_TYPE} short clips</strong>.
        </p>
      }
    >
      {view.kind === 'open' ? (
        <EditorialMediaStudio
          eventId={eventId}
          vendorProfileId={vendorProfileId}
          existing={view.existing}
          existingUnread={view.existingUnread}
        />
      ) : view.kind === 'almost' ? (
        <PartNote icon={Clock}>
          <strong className="block">{view.disputed ? 'On hold for this event' : 'Almost there'}</strong>
          {view.disputed
            ? `${who} reported a problem with the delivery. Once that’s sorted out, you’ll be able to add a photo or a 5-second clip to their story.`
            : `Once ${who} marks your service complete, you can add a photo or a 5-second clip to their story. Mark your service complete on the event brief, then confirm with them.`}
        </PartNote>
      ) : (
        <PartNote icon={Lock}>
          <strong className="block">Not available for this event yet</strong>
          “From your suppliers” is open to the couple’s recommended supplier for a category. Once you’re the couple’s
          confirmed pick here, you’ll be able to add your photos and clips to their Story.
        </PartNote>
      )}
    </TheirEventPart>
  );
}
