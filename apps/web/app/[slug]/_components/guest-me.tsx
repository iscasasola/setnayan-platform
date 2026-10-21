import type { GuestAccountState } from '@/lib/guest-one-path';
import type { CelebrantRow } from '@/lib/event-celebrants.server';
import { EventCelebrants, type CelebrantActions } from './event-celebrants';
import { SaveToAccount } from './save-to-account';
import { UseOnProfile, type AdoptSeatName } from './use-on-profile';
import { YourGuests } from './your-guests';
import { FaceTaggingRow } from './face-tagging-row';
import type { PapicFaceMode } from '@/lib/papic-face-mode';
import type { FaceTaggingWish } from '@/lib/face-tagging-wish';
import type { InviteEventFacts } from '@/lib/guest-invite-message';
import { displayPersonName } from '@/lib/person-name-case';

/**
 * ME — the guest's own tab (owner 2026-09-26/27: Invitation bar Home · Details ·
 * RSVP · Story · Me; The Day bar keeps Me). What it holds, in order:
 *
 *   · their name (the way off a phone a family shares is the ONE "Sign out
 *     of this invitation" at the foot of Me — owner 2026-10-03: "Not you?
 *     Switch" posted to the same sign-out, a second button for one thing);
 *   · under it, when the seat they saved to their account lists a fuller
 *     formal name than their profile, ONE quiet "Use this on your profile"
 *     (B9, owner 2026-09-30: one tap, never silent);
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
 *
 * 🃏 EACH TOPIC SITS ON THE HUB'S OWN SCENE CARD (owner 2026-10-21, "Yes to all"
 * on guest_page_fixes_2_4, fix 2: *"Text sits straight on the cover photo
 * (unreadable)"*). Me was the one tab whose words sat bare on the couple's
 * photo; every scene above it already wears `.sn-hub-cards > section`
 * (globals.css — paper, 14 px corners, the 1 px hairline and soft shadow, kept
 * identical by the owner's answer). So this column IS `sn-hub-cards`, and each
 * topic is one of its sections: their name + Your guests · Face tagging · The
 * celebrants · Save to my account. No new CSS; a topic with nothing to say
 * draws no section, so there is never an empty card. Dark is the couple's look
 * (Candlelight): the card is `--color-cream`, which follows the paper.
 */
export function GuestMe({
  name,
  slug,
  faceTagging = null,
  eventId,
  guestId,
  askMeal,
  askDietary,
  askPlusOnes,
  eventName,
  guests,
  passCards = null,
  account,
  personalLink,
  userAgent,
  termsCarried,
  inviteFacts,
  celebrants = [],
  canAddCelebrants = false,
  celebrantActions = null,
  profileName = null,
}: {
  name: string;
  slug: string;
  eventId: string;
  /** Whose key this page holds — the bringer, for "Add name" in place. */
  /** Me → "Face tagging" (the approved face-registration design, frame D). Null
   *  where face tagging is not on offer — no Papic, or switched off (frame F). */
  faceTagging?: {
    on: boolean;
    open: boolean;
    faceMode: PapicFaceMode;
    wish: FaceTaggingWish;
    turnOff: (formData: FormData) => Promise<void>;
  } | null;
  guestId: string;
  /** The couple's "ask" switches — a plus-one is asked only what they ask. */
  askMeal: boolean;
  askDietary: boolean;
  /** The couple's plus-ones switch — off, the seat rule refuses a name, so no box is offered. */
  askPlusOnes: boolean;
  eventName: string;
  guests: { guestId: string; name: string | null; inviteUrl: string | null }[];
  /** The pass cards this guest may save (lib/pass-card.ts) — their own and each
   *  named plus-one's who is coming. Null: they have no card yet. */
  passCards?: { own: string; plusOnes: Readonly<Record<string, string>> } | null;
  account: GuestAccountState | null;
  /** This guest's own invitation link — handed over where no provider can sign in. */
  personalLink: string | null;
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
  /** "Use this on your profile" — null unless the viewer's OWN account holds
   *  this seat and the seat's name is fuller (page.tsx · seatNameOfferFor). */
  profileName?: { name: string; adopt: AdoptSeatName } | null;
}) {
  return (
    <div className="sn-hub-cards space-y-4" data-guest-me>
      <section className="space-y-5" data-me-card="guests">
        <div className="space-y-1">
          <p className="font-serif text-2xl leading-tight text-ink">{displayPersonName(name)}</p>
          {profileName ? (
            <UseOnProfile eventId={eventId} guestId={guestId} name={profileName.name} adopt={profileName.adopt} />
          ) : null}
        </div>
        <YourGuests
          guests={guests}
          eventName={eventName}
          addNamesHref={`/${slug}/invite/reply#plus-ones`}
          addName={askPlusOnes ? { eventId, guestId, askMeal, askDietary } : undefined}
          inviteFacts={inviteFacts}
          passCards={passCards}
        />
      </section>
      {faceTagging ? <FaceTaggingRow {...faceTagging} /> : null}
      <EventCelebrants
        eventId={eventId}
        celebrants={celebrants}
        canAdd={canAddCelebrants}
        actions={celebrantActions}
      />
      {account ? (
        <section data-me-card="account">
          <SaveToAccount
            state={account}
            eventId={eventId}
            slug={slug}
            personalLink={personalLink}
            userAgent={userAgent}
            termsCarried={termsCarried}
          />
        </section>
      ) : null}
    </div>
  );
}
