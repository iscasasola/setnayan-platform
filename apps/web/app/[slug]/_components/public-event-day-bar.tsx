import Link from 'next/link';
import { Camera, Images, LayoutGrid } from 'lucide-react';

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
  hubHref,
}: {
  /** Couple's PAPIC_GUEST candid camera is open → show the center Camera. */
  candidCameraActive: boolean;
  /** Public album destination (Live Wall / recap), or null when none exists. */
  photosHref: string | null;
  /** When set (event-day live/post), a top-left chip opens the fullscreen
   *  no-scroll hub (public panels only for a no-guest viewer). */
  hubHref?: string | null;
}) {
  if (!candidCameraActive && !photosHref && !hubHref) return null;

  return (
    <>
      {/* Top-left "Live hub" entry (event-day only) — public panels only for a
          no-guest viewer (candid Camera + public Photos), mirroring this bar. */}
      {hubHref ? (
        <div className="fixed left-3 top-3 z-40 [padding-top:env(safe-area-inset-top)]">
          <Link
            href={hubHref}
            aria-label="Open the live event hub"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-ink px-3.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-ink/90"
          >
            <LayoutGrid aria-hidden className="h-4 w-4" strokeWidth={2} />
            <span>Live hub</span>
          </Link>
        </div>
      ) : null}

      {candidCameraActive || photosHref ? (
        <nav
          aria-label="Event controls"
          className="fixed inset-x-0 bottom-0 z-40 [padding-bottom:env(safe-area-inset-bottom)]"
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
                className="inline-flex h-[3.25rem] w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl border border-ink/10 bg-cream/95 text-ink shadow-lg backdrop-blur transition hover:border-terracotta hover:text-terracotta"
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
