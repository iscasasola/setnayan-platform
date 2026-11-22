import Link from 'next/link';
import { Camera, Images } from 'lucide-react';

// Public event-day hub bar (owner 2026-06-28). The richer guest hub bar
// (guest-hub-bar.tsx) only renders on the IDENTIFIED-guest path — it needs a
// personal QR token + "photos of you". A no-guest viewer (anonymous link open,
// or the host's `?phase=event` preview) used to drop into PublicLanding with NO
// event-day chrome at all, so the live event page looked like a different,
// barer page. This is the slim public counterpart so all three event-day views
// share the same bottom chrome.
//
// A non-guest has no personal QR and no personal gallery, so the public bar
// carries only the two event-level actions:
//   bottom-center = Camera → the couple's candid camera (/papic/guest), shown
//                   only while the PAPIC_GUEST candid camera is open.
//   bottom-right  = Photos → the event's PUBLIC album (Live Photo Wall during
//                   the day, the recap after), shown only when one exists.
// The bottom-left "My QR" slot is intentionally empty here (owner 2026-06-28 —
// a non-guest has no personal QR to show).
//
// When neither action is available the bar renders nothing (no empty chrome).

export function PublicEventDayBar({
  candidCameraActive,
  photosHref,
  menuOn,
}: {
  /** Couple's PAPIC_GUEST candid camera is open → show the center Camera. */
  candidCameraActive: boolean;
  /** Public album destination (Live Wall / recap), or null when none exists. */
  photosHref: string | null;
  /**
   * Is the five-tab site menu rendering on this page? (PR11, 2026-08-05.)
   *
   * This bar is `fixed bottom-0 z-40` and the menu is `z-30`, so wherever both
   * render this one covers the menu whole — every tab untappable. The menu
   * resolves Camera and Photos for every viewer, so those two controls go.
   *
   * 🧭 THE "Live hub" CHIP IS GONE TOO (20 Nov 2026, one bar per stage —
   * DECISION_LOG "EVENT HUB MAKER — ONE TOOLBAR, FULL SCREEN, APPROVED"). It
   * opened `/[slug]/hub`, a second screen with a second bar; `/hub` now sends
   * its visitor back to this very page's Live, so the chip would be a door to
   * the room it stands in. The day's Live content is on this page.
   */
  menuOn?: boolean;
}) {
  const showBar = !menuOn && (candidCameraActive || Boolean(photosHref));
  if (!showBar) return null;

  return (
    <>
      {showBar ? (
        <nav
          aria-label="Event controls"
          className="fixed inset-x-0 bottom-0 z-40 [padding-bottom:env(safe-area-inset-bottom)]"
          data-safe-x=""
        >
          <div className="mx-auto flex max-w-md items-end justify-center gap-6 px-5 pb-3 pt-2">
            {/* Bottom-center: the couple's candid camera (prominent action). */}
            {candidCameraActive ? (
              <Link
                href="/papic/guest"
                aria-label="Be a candid camera"
                className="inline-flex h-16 w-16 -translate-y-1.5 flex-col items-center justify-center gap-0.5 rounded-full bg-mulberry text-cream shadow-xl transition hover:bg-mulberry-600"
              >
                <Camera aria-hidden className="h-6 w-6" strokeWidth={2} />
                <span className="text-[0.6rem] font-semibold leading-none">Camera</span>
              </Link>
            ) : null}

            {/* Bottom-right: the event's public album (Live Wall / recap). */}
            {photosHref ? (
              <Link
                href={photosHref}
                aria-label="Event photos"
                className="inline-flex h-[3.25rem] w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl border border-ink/10 bg-cream/95 text-ink shadow-lg backdrop-blur transition hover:border-terracotta hover:text-terracotta-700"
              >
                <Images aria-hidden className="h-5 w-5" strokeWidth={1.75} />
                <span className="text-[0.6rem] font-medium leading-none">Photos</span>
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </>
  );
}
