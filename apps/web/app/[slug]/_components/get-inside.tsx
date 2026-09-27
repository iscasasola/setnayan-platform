import Link from 'next/link';
import { UploadYourQr } from './upload-your-qr';

/**
 * THE STRANGER'S ONE BUTTON (owner 2026-09-26, verbatim: *"Get Inside: Scan
 * your QR, Tap NFC or sign in … with the general link shows the general
 * details, with one button"*).
 *
 * Two states, one button each:
 *
 *   · not signed in → **"Get inside"** · "Scan your QR · Tap NFC · Sign in".
 *     Pressing it opens exactly two things (owner 2026-09-27, the poster QR:
 *     "sign in to enter or upload your qr to login"): Upload your QR (a photo
 *     or screenshot, decoded on the phone) and Sign in. A `<details>`, so it
 *     opens with no script and in every in-app webview;
 *   · signed in, not on this guest list → "You're not on the guest list for
 *     this event yet" + **"Ask to join"**, which goes to the couple's Requests
 *     (`/join/{eventId}`) — never an automatic entry; a name match alone never
 *     admits (owner 2026-09-26, "NOBODY WITHOUT A KEY").
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
}: {
  /** The couple chose "Anyone, I approve" (`anyoneMayAskToJoin`, lib/rsvp-ask.ts). */
  mayAskToJoin?: boolean;
  /** "the couple" / "the family" — the event type's own words. */
  theOrganizer: string;
  slug: string | null;
  eventId: string;
  signedInNotListed: boolean;
}) {
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
          <p className="text-sm text-ink/70">
            Open the invite link or scan the QR {theOrganizer} sent you — it opens your invitation here.
          </p>
        )}
      </section>
    );
  }
  const signIn = slug ? `/login?next=${encodeURIComponent(`/${slug}`)}` : '/login';
  return (
    <details className="group mx-auto max-w-md" data-get-inside="door">
      <summary className="button-primary flex min-h-[56px] w-full cursor-pointer list-none flex-col items-center justify-center gap-0.5 [&::-webkit-details-marker]:hidden">
        <span className="text-base">Get inside</span>
        <span className="text-xs font-normal opacity-80">Scan your QR · Tap NFC · Sign in</span>
      </summary>
      {/* The poster's door (owner 2026-09-27: "sign in to enter or upload your
          qr to login") — exactly two things: the guest's own QR, read on the
          phone, or their account. */}
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
}
