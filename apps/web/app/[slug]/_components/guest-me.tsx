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
 *     plus-one with no phone, and "Add name" for a TBA seat, which opens the
 *     four boxes IN PLACE (owner 2026-09-29, frame E — never a link back to
 *     the reply form);
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
  guestId,
  askMeal,
  askDietary,
  askPlusOnes,
  eventName,
  guests,
  passes,
  passCards = null,
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
  /** Whose key this page holds — the bringer, for "Add name" in place. */
  guestId: string;
  /** The couple's "ask" switches — a plus-one is asked only what they ask. */
  askMeal: boolean;
  askDietary: boolean;
  /** The couple's plus-ones switch — off, the seat rule refuses a name, so no box is offered. */
  askPlusOnes: boolean;
  eventName: string;
  guests: { guestId: string; name: string | null; inviteUrl: string | null }[];
  passes: Readonly<Record<string, string>>;
  /** The pass cards this guest may save (lib/pass-card.ts) — their own and each
   *  named plus-one's who is coming. Null: they have no card yet. */
  passCards?: { own: string; plusOnes: Readonly<Record<string, string>> } | null;
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
        addName={askPlusOnes ? { eventId, guestId, askMeal, askDietary } : undefined}
        passes={passes}
        inviteFacts={inviteFacts}
        passCards={passCards}
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
