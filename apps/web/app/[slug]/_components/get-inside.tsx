import Link from 'next/link';
import { DoorChoices } from './door-choices';
import { STRANGER_DOOR_WORDS, doorSignInHref } from './door-choice-words';
import { FirstScreenDoor } from './first-screen-door';
import { INVITATION_ONLY_LINE } from '@/lib/invite-arrival';
import { RequestKeyInput } from '@/app/_components/request-key-input';

/** 🚪 The stranger's door's words — owner 2026-11-03, *"yes Open your invitation"* (it read "Confirm your Booking"). */
export { STRANGER_DOOR_WORDS };

/**
 * THE STRANGER'S ONE BUTTON (owner 2026-09-26, verbatim: *"Get Inside: Scan
 * your QR, Tap NFC or sign in … with the general link shows the general
 * details, with one button"*).
 *
 * Two states, one button each:
 *
 *   · not signed in → ONE button, **"Open your invitation"**, and nothing else on it (owner 2026-11-03,
 *     DECISION_LOG "THE GUEST DOOR IS ONE BUTTON": *"both buttons does the same thing"* · *"just 1 button
 *     please"* · *"i also saw sign in"*; it read "Confirm your Booking" with "Upload your QR · Sign in" under
 *     it, and opened onto a SECOND full "Upload your QR" button). Pressing it shows exactly three choices
 *     (`DoorChoices`): Scan QR (the live camera) · Upload QR (the phone's picker) · Lost QR? Login. A
 *     `<details>`, so it opens with no script and in every in-app webview (Messenger);
 *   · signed in, not on this guest list → "You're not on the guest list for
 *     this event yet" + **"Ask to join"**, which goes to the couple's Requests
 *     (`/join/{eventId}`) — never an automatic entry; a name match alone never
 *     admits (owner 2026-09-26, "NOBODY WITHOUT A KEY");
 *   · signed in, not listed, on a ONE-QR event ("Will guests reply? No · One QR
 *     for everyone", not "I approve each one") → **"Join as a guest"**: one
 *     press posts the join door's own action, which adds THIS account as a
 *     guest and walks them in (owner 2026-09-30, "no reply, no approval unless
 *     the host picks 'I approve each one'"). A press, not the render: a page
 *     render may not write the guest cookie (lib/guest-membership-session.ts).
 *   · signed in, and the seat read was REFUSED (2026-11-05, reads-are-honest) →
 *     "We couldn't check your invitation just now" + **"Try again"** (a fresh
 *     load of this same page). Never the not-listed copy and never a join
 *     button: the person may well be on the list, and "Join as a guest" would
 *     add them a second time.
 *
 * 🚪 THE FIRST SCREEN MAKES ROOM FOR THE DOOR (2026-10-11). Measured on the live
 * sample event: the button's own place is under the date, at y 715 — entirely
 * below a 375 × 667 screen, and under the bottom bar at 375 × 812. A first cut
 * docked it over the cover and it then sat on the couple's names or the date.
 * So the button stays IN THE COVER'S FLOW and the cover makes room: its air
 * closes up, its mark is drawn smaller, and — only if it must — whole parts of
 * the cover move below the button, the link first and the names never
 * (`_lib/first-screen-fit.ts` is the rule; `FirstScreenDoor` measures and
 * writes it). `dock={false}` on the Maker's canvas, which is not a first screen.
 *
 * 🔒 THIS IS THE DOOR, NOT THE GATE. What stays inside (camera, gallery,
 * announcements, seat, exact venue) is withheld by the SERVER before this page
 * renders — this button only says how to become someone it would render for.
 */
export function GetInside({
  slug,
  eventId,
  signedInNotListed,
  seatUnread = false,
  theOrganizer,
  mayAskToJoin = false,
  joinAction,
  dock = true,
  inFoot = false,
}: {
  /** Fit the first screen around the signed-out door (see above). */
  dock?: boolean;
  /**
   * 🦶 Drawn IN the cover's foot (`PahinaMasthead` `door`, owner 2026-10-17): the foot is the bottom of the first
   * screen — and where the text cover is taller than a short phone, the cover makes room for the foot by the same fit
   * (`FirstScreenDoor foot`, 2026-10-18).
   */
  inFoot?: boolean;
  /**
   * One QR for everyone, no approval (`oneQrLetsYouIn`, lib/rsvp-ask.ts): the
   * join door's own action, bound to this event by the page
   * (`joinEventAction.bind(null, eventId, '')`). Absent = not a one-QR event.
   * Handed in rather than imported, so this door stays renderable on its own.
   */
  joinAction?: (formData: FormData) => void | Promise<void>;
  /** The couple chose "Anyone, I approve" (`anyoneMayAskToJoin`, lib/rsvp-ask.ts). */
  mayAskToJoin?: boolean;
  /** "the couple" / "the family" — the event type's own words. */
  theOrganizer: string;
  slug: string | null;
  eventId: string;
  signedInNotListed: boolean;
  /** Signed in, and their seat read was refused — we do not know whether they are listed. */
  seatUnread?: boolean;
}) {
  // 🔌 FIRST: an unanswered question is never answered with "not on the list".
  if (seatUnread) {
    return (
      <section aria-labelledby="seat-unread" className="mx-auto max-w-md space-y-4 text-center" data-get-inside="seat-unread">
        <h2 id="seat-unread" className="font-serif text-2xl leading-snug text-ink">
          We couldn&rsquo;t check your invitation just now
        </h2>
        <p className="text-sm text-ink/70" role="status">
          Your invitation is fine — something on our end is having trouble. Give it a moment and try again.
        </p>
        {/* A plain link, so it is a fresh server render of this same page — the read is asked again. */}
        <a
          href={slug ? `/${slug}` : '.'}
          className="button-primary flex min-h-[52px] w-full items-center justify-center"
        >
          Try again
        </a>
      </section>
    );
  }
  if (signedInNotListed && joinAction) {
    return (
      <section aria-labelledby="come-in" className="mx-auto max-w-md space-y-4 text-center" data-get-inside="join">
        <h2 id="come-in" className="font-serif text-2xl leading-snug text-ink">
          Come on in
        </h2>
        <p className="text-sm text-ink/70">Tap once and this event is added to your account. No reply needed.</p>
        <form action={joinAction}>
          <RequestKeyInput />
          <button type="submit" className="button-primary flex min-h-[52px] w-full items-center justify-center">
            Join as a guest
          </button>
        </form>
      </section>
    );
  }
  if (signedInNotListed) {
    return (
      <section aria-labelledby="not-on-list" className="mx-auto max-w-md space-y-4 text-center" data-get-inside="ask">
        <h2 id="not-on-list" className="font-serif text-2xl leading-snug text-ink">
          You&rsquo;re not on the guest list for this event yet
        </h2>
        {/* "Who can RSVP?" (the couple's one value, `rsvp_ask_config.whoCanRsvp`):
            only "Anyone, I approve" opens a request; the default "Only my Guest
            List" sends nobody to a door that would turn them away. */}
        {mayAskToJoin ? (
          <>
            <p className="text-sm text-ink/70">
              Ask {theOrganizer} — once they add you, your invitation opens here.
            </p>
            <Link href={`/join/${eventId}`} className="button-primary flex min-h-[52px] w-full items-center justify-center">
              Ask to join
            </Link>
          </>
        ) : (
          <p className="text-sm text-ink/70" data-invitation-only="">
            {INVITATION_ONLY_LINE}
          </p>
        )}
      </section>
    );
  }
  const door = (
    <details className={`group mx-auto max-w-md${dock && !inFoot ? ' sn-door-dock' : ''}`} data-get-inside="door">
      <summary className="button-primary flex min-h-[56px] w-full cursor-pointer list-none flex-col items-center justify-center gap-0.5 [&::-webkit-details-marker]:hidden">
        <span className="text-base">{STRANGER_DOOR_WORDS}</span>
      </summary>
      {inFoot ? <FirstScreenDoor foot /> : dock ? <FirstScreenDoor /> : null}
      {/* Exactly three choices (owner 2026-11-03) — quiet buttons; the ONE primary is the door above. */}
      <div className="mt-4">
        <DoorChoices slug={slug} signIn={doorSignInHref(slug)} />
      </div>
    </details>
  );
  if (mayAskToJoin) return door;
  /* A list-only event has nothing to request — said under the door, so a
     stranger is never left wondering whether to ask (owner 2026-10-03). */
  return (
    <>
      {door}
      <p className="mx-auto mt-3 max-w-md text-center text-sm text-ink/70" data-invitation-only="">
        {INVITATION_ONLY_LINE}
      </p>
    </>
  );
}
