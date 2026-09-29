import type { GuestAccountState } from '@/lib/guest-one-path';
import { NotYouSwitch } from './not-you-switch';
import { SaveToAccount } from './save-to-account';
import { YourGuests } from './your-guests';

/**
 * ME — the guest's own tab (owner 2026-09-26/27: Invitation bar Home · Details ·
 * RSVP · Story · Me; The Day bar keeps Me). What it holds, in order:
 *
 *   · their name, with "Not you? Switch" under it (a phone a family shares);
 *   · their guests — "Send their invite" each, "Show <name>'s pass" for a
 *     plus-one with no phone, and "Add name" for a TBA seat, which opens the
 *     four boxes IN PLACE (owner 2026-09-29, frame E — never a link back to
 *     the reply form);
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
  account,
  hasEmail,
  userAgent,
  termsCarried,
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
  account: GuestAccountState | null;
  hasEmail: boolean;
  userAgent: string | null;
  termsCarried: boolean;
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
