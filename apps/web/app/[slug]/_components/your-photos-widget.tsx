import type { EventWords } from '../_lib/event-words';
import { GuestToHostCta } from '@/app/_components/guest-to-host-cta';

/**
 * "YOUR PHOTOS" — the couple's placeable PROMISE CARD on the invitation.
 *
 * ⚠ THIS IS NOT THE GUEST'S GALLERY, AND THE REGISTER HAD THE WRONG FILE. It has
 * never rendered a photograph: it is the card a couple can place before the day
 * to tell guests where their photos will land. The screen where a guest actually
 * looks at theirs is `photos-of-you-gallery.tsx`, which the page body mounts
 * once the day is live. Porting an empty card into a mosaic would have drawn a
 * gallery with nothing in it.
 *
 * ── WHY IT IS OBSIDIAN ANYWAY ──────────────────────────────────────────────
 * It carries the same promise, under the same words, on the same page as the
 * real thing. Left cream, a guest would meet "Your photos" in two visibly
 * different products a scroll apart. So it takes the gallery's SURFACE and none
 * of its furniture — no tiles, no lightbox, no credits, because it has nothing
 * to put in them.
 *
 * 🚨 `--sn-ob-*` ONLY. Theme colours resolve to their LIGHT values on this panel
 * (ink measures 1.27:1 against it) — see the table beside those tokens.
 */
export function YourPhotosWidget({
  limited,
  eventId,
  eventPublicId,
  eventNoun,
  words,
}: {
  words: EventWords;
  limited: boolean;
  eventId: string;
  eventPublicId: string;
  eventNoun: string;
}) {
  return (
    <section className="sn-gal space-y-4 p-6">
      <header>
        <p className="sn-gal-kick font-mono text-xs font-bold uppercase tracking-[0.2em]">
          Your photos
        </p>
        <h3 className="sn-gal-text mt-1 text-2xl font-semibold tracking-tight">
          All curated for you
        </h3>
      </header>

      <div className="sn-gal-soft rounded-lg border border-dashed border-[rgb(251_250_247/0.22)] p-5 text-center text-sm">
        All your photos will appear here after the event.
      </div>

      <div className="rounded-lg border border-[rgb(251_250_247/0.12)] p-5 text-sm">
        <p className="sn-gal-text font-medium">
          Make sure a shutterbug snaps you on the {eventNoun} day
        </p>
        <p className="sn-gal-soft mt-1">
          Your first tagged photo automatically becomes your profile picture in the gallery.
        </p>
      </div>

      {limited ? (
        <p className="sn-gal-soft text-xs">
          Your photos will be visible in your inviter&rsquo;s gallery.
        </p>
      ) : (
        <div className="rounded-lg border border-[rgb(203_167_102/0.35)] bg-[rgb(203_167_102/0.10)] p-5 text-sm">
          <p className="sn-gal-text font-medium">Add more via Shutter</p>
          <p className="sn-gal-soft mt-1">
            You can also add your own photos and videos through Shutter, our in-app camera.
            Tag up to 5 guests per post — {words.theOrganizer} is tagged for you automatically.
          </p>
          <p className="sn-gal-soft mt-3 text-xs italic">
            Shutter ships with the Setnayan native app (Phase 2).
          </p>
        </div>
      )}

      <GuestToHostCta
        surface="your_photos"
        eventId={eventId}
        eventPublicId={eventPublicId}
        headline="Want this for your own day?"
        sub="Capture every moment — start planning free."
      />
    </section>
  );
}
