import Link from 'next/link';
import { UploadYourQr } from './upload-your-qr';
import { DoorOpensInView } from './door-opens-in-view';
import { INVITATION_ONLY_LINE } from '@/lib/invite-arrival';

/**
 * THE STRANGER'S ONE BUTTON (owner 2026-09-26, verbatim: *"Get Inside: Scan
 * your QR, Tap NFC or sign in … with the general link shows the general
 * details, with one button"*).
 *
 * Two states, one button each:
 *
 *   · not signed in → **"Get inside"** · "Upload your QR · Sign in" — the two
 *     things it actually opens (it once said "Scan your QR · Tap NFC", which
 *     nothing behind it does).
 *     Pressing it opens exactly two things (owner 2026-09-27, the poster QR:
 *     "sign in to enter or upload your qr to login"): Upload your QR (a photo
 *     or screenshot, decoded on the phone) and Sign in. A `<details>`, so it
 *     opens with no script and in every in-app webview;
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
 *
 * 🚪 THE DOOR IS IN VIEW ON THE FIRST SCREEN (2026-10-11). Measured on the live
 * sample event: the button's own place is under the date, at y 715 — on a
 * 375 × 667 phone that is entirely below the screen (a cover with no action at
 * all), and at 375 × 812 it ran under the bottom bar with 32 of its 56 px
 * showing. The cover is the couple's own design and is as tall as it is, so the
 * button does not wait for it: while its place is still below the screen it
 * DOCKS just above the bar (`.sn-door-dock`, globals.css — `position: sticky`,
 * so it settles into its own place the moment the page is scrolled to it and
 * is never drawn twice). Opened, it returns to its place and is scrolled into
 * view (`DoorOpensInView`). `dock={false}` on the Maker's canvas, which has no
 * bar and is not a first screen.
 *
 * 🔒 THIS IS THE DOOR, NOT THE GATE. What stays inside (camera, gallery,
 * announcements, seat, exact venue) is withheld by the SERVER before this page
 * renders — this button only says how to become someone it would render for.
 */
export function GetInside({
  slug,
  eventId,
  signedInNotListed,
  theOrganizer,
  mayAskToJoin = false,
  joinAction,
  dock = true,
}: {
  /** Dock the signed-out door above the bottom bar while its place is below the screen (see above). */
  dock?: boolean;
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
}) {
  if (signedInNotListed && joinAction) {
    return (
      <section aria-labelledby="come-in" className="mx-auto max-w-md space-y-4 text-center" data-get-inside="join">
        <h2 id="come-in" className="font-serif text-2xl leading-snug text-ink">
          Come on in
        </h2>
        <p className="text-sm text-ink/70">Tap once and this event is added to your account. No reply needed.</p>
        <form action={joinAction}>
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
  const signIn = slug ? `/login?next=${encodeURIComponent(`/${slug}`)}` : '/login';
  const door = (
    <details className={`group mx-auto max-w-md${dock ? ' sn-door-dock' : ''}`} data-get-inside="door">
      <summary className="button-primary flex min-h-[56px] w-full cursor-pointer list-none flex-col items-center justify-center gap-0.5 [&::-webkit-details-marker]:hidden">
        <span className="text-base">Get inside</span>
        {/* Names only what opens underneath (guest text audit 2026-09-30): the
            button promised "Scan · Tap NFC", and neither is behind it. */}
        <span className="text-xs font-normal opacity-80">{slug ? 'Upload your QR · Sign in' : 'Sign in'}</span>
      </summary>
      {/* The poster's door (owner 2026-09-27: "sign in to enter or upload your
          qr to login") — exactly two things: the guest's own QR, read on the
          phone, or their account. */}
      {dock ? <DoorOpensInView /> : null}
      <div className="mt-4 space-y-4">
        {slug ? <UploadYourQr slug={slug} /> : null}
        <Link
          href={signIn}
          className="flex min-h-[48px] w-full items-center justify-center text-sm font-medium text-ink underline underline-offset-4"
        >
          Sign in
        </Link>
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
