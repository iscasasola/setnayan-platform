import { BackButton } from '@/app/_components/back-button';

/**
 * 🔒 A coordinator does not write the host review (owner, 6 Nov 2026 — conflict of interest: a coordinator is a
 * supplier on the same event). Said plainly, with nothing to press but the way back.
 */
export function CoordinatorRefusedState({
  eventId,
  vendorId,
  vendorName,
  unread,
}: {
  eventId: string;
  /** The booking row the page opened on — its own route param, for the map's back. */
  vendorId: string;
  vendorName: string;
  unread: boolean;
}) {
  return (
    <section className="space-y-4" data-review-state={unread ? 'unread' : 'coordinator'}>
      <BackButton route="/dashboard/[eventId]/vendors/[vendorId]/review" params={{ eventId, vendorId }} />
      {unread ? (
        <p role="alert" className="max-w-prose text-base text-ink/65">
          We couldn&rsquo;t check your place on this event just now. Reload to try again.
        </p>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight">The couple reviews {vendorName}</h1>
          <p className="max-w-prose text-base text-ink/65">
            Host reviews are written by the couple and their co-hosts — the people who planned with the supplier. As
            the coordinator, you work beside {vendorName} on this event, so the review is theirs to write.
          </p>
        </>
      )}
    </section>
  );
}
