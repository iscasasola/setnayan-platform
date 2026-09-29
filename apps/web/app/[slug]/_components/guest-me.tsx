import type { GuestAccountState } from '@/lib/guest-one-path';
import type { CelebrantRow } from '@/lib/event-celebrants.server';
import { EventCelebrants, type CelebrantActions } from './event-celebrants';
import { NotYouSwitch } from './not-you-switch';
import { SaveToAccount } from './save-to-account';
import { YourGuests } from './your-guests';
import type { InviteEventFacts } from '@/lib/guest-invite-message';

/**
 * ME — the guest's own tab (owner 2026-09-26/27: Invitation bar Home · Details ·
 * RSVP · Story · Me; The Day bar keeps Me). What it holds, in order:
 *
 *   · their name, with "Not you? Switch" under it (a phone a family shares);
 *   · their guests — "Send their invite" each, "Show <name>'s pass" for a
 *     plus-one with no phone, "Add their name" for a TBA seat;
 *   · "The celebrants" — Follow or Add the people this event is for (owner
 *     2026-09-28), only when this seat is linked to the viewer's own account;
 *   · "Save to my account" — reachable any time, before or after replying, and
 *     on the day (owner 2026-09-27: *"and on the day"*), the SAME one button the
 *     thank-you carries, method chosen by the device.
 *
 * Their own QR pass and "Photos of you" stay where they already live in this
 * section (`GuestHubBar`'s Me) — this is mounted INTO it, never a second Me.
 */
export function GuestMe({
  name,
  slug,
  eventId,
  eventName,
  guests,
  passes,
  account,
  hasEmail,
  userAgent,
  termsCarried,
  inviteFacts,
  celebrants = [],
  canAddCelebrants = false,
  celebrantActions = null,
}: {
  name: string;
  slug: string;
  eventId: string;
  eventName: string;
  guests: { guestId: string; name: string | null; inviteUrl: string | null }[];
  passes: Readonly<Record<string, string>>;
  account: GuestAccountState | null;
  hasEmail: boolean;
  userAgent: string | null;
  termsCarried: boolean;
  /** The event's words for "Send their invite". */
  inviteFacts?: InviteEventFacts;
  /** This event's celebrants who hold accounts — empty unless the viewer's
   *  own account holds this seat (page.tsx decides). */
  celebrants?: CelebrantRow[];
  canAddCelebrants?: boolean;
  /** Follow + Add, handed in by the page (server actions). */
  celebrantActions?: CelebrantActions | null;
}) {
  return (
    <div className="space-y-6" data-guest-me>
      <div>
        <p className="font-serif text-2xl leading-tight text-ink">{name}</p>
        <NotYouSwitch slug={slug} />
      </div>
      <YourGuests
        guests={guests}
        eventName={eventName}
        addNamesHref={`/${slug}/invite/reply#plus-ones`}
        passes={passes}
        inviteFacts={inviteFacts}
      />
      <EventCelebrants
        eventId={eventId}
        celebrants={celebrants}
        canAdd={canAddCelebrants}
        actions={celebrantActions}
      />
      {account ? (
        <SaveToAccount
          state={account}
          eventId={eventId}
          slug={slug}
          hasEmail={hasEmail}
          userAgent={userAgent}
          termsCarried={termsCarried}
        />
      ) : null}
    </div>
  );
}
