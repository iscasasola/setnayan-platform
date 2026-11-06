'use client';

import { useState } from 'react';
import { Share } from 'lucide-react';
import { GalleryLightbox } from '@/app/_components/gallery/gallery-lightbox';
import { SaveFileLink } from '@/app/_components/save-file-link';

/**
 * 📱 THE GIFT QR, OPENED IN PLACE (owner 2026-10-24, on the Event Hub's e-gifts:
 * *"when i opened the QR Code, there is no way to go back"*).
 *
 * The thumbnail used to be `<a href={qrUrl} target="_blank">` straight to the IMAGE ROUTE
 * (`/api/pabuya/qr/<id>`). In a phone browser, the installed PWA or the app shell that is a bare PNG with no Setnayan
 * around it and nothing to press — a dead end in the middle of a guest giving a gift.
 *
 * Now a tap opens the SHIPPED full-screen viewer (`GalleryLightbox`) over the page: the QR large on a WHITE plate (a
 * banking app on another phone scans it; a dark ground defeats the scanner's quiet zone), the method and the account
 * name under it, "Save QR" (the route's `?download=1`, the same save `PabuyaMethodActions` offers), and ✕ — with
 * Escape, a tap outside, swipe-down and the phone's Back all closing it. Nothing navigates to the raw route.
 * 🔒 `lib/a-photo-viewer-is-a-real-screen.test.ts` fails if the Hub draws a `target="_blank"` link to it again.
 *
 * ⚠ ITS OWN 'use client' FILE, for the reason `pabuya-method-actions.tsx` gives: `PabuyaCardList` is rendered by the
 * SERVER guest page and the couple's CLIENT preview and must stay inert so the two cannot drift. A server component may
 * render this one.
 */
export function PabuyaQrThumb({
  qrUrl,
  label,
  accountName,
  primary,
}: {
  /** Permanent QR route URL (`/api/pabuya/qr/<public_id>`). */
  qrUrl: string;
  /** The method's display label ("GCash", "BPI"). */
  label: string;
  accountName: string | null;
  /** A scan-first rail (GCash, Maya) — the QR stands where the icon stood, a little larger. */
  primary: boolean;
}) {
  const [open, setOpen] = useState(false);
  const saveHref = `${qrUrl}${qrUrl.includes('?') ? '&' : '?'}download=1`;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        data-egift-qr={primary ? 'primary' : 'side'}
        aria-haspopup="dialog"
        aria-label={`Open the ${label} QR code full size`}
        className={`inline-flex ${primary ? 'h-32 w-32' : 'h-28 w-28'} shrink-0 overflow-hidden rounded-xl border border-ink/10 bg-white p-0 transition hover:border-terracotta focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-terracotta sm:h-36 sm:w-36`} // no-card-ok: the QR thumbnail is the press that opens the viewer
      >
        {/* Raw <img>: the QR is an app route, not a build-time asset, and
            next/image would add an optimiser hop in front of a gated route. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={qrUrl} alt={`${label} QR code`} className="h-full w-full object-contain" />
      </button>
      {open ? (
        <GalleryLightbox
          src={qrUrl}
          kind="photo"
          plate="white"
          label={`${label} QR code`}
          onClose={() => setOpen(false)}
          caption={
            <>
              <p className="font-display text-lg italic">{label}</p>
              {accountName ? <p className="sn-gal-soft mt-0.5 text-sm">{accountName}</p> : null}
            </>
          }
          actions={
            <SaveFileLink
              href={saveHref}
              /* The route answers `?download=1` with Content-Disposition: attachment — but the iPhone app's web view
                 renders it in place anyway, so SaveFileLink fetches it and hands it to the share sheet. */
              filename={`${label.replace(/[^\w-]+/g, '-').toLowerCase()}-qr.png`}
              aria-label={`Save the ${label} QR code to your photos`}
              className="sn-gal-btn inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium"
            >
              <Share aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              Save QR
            </SaveFileLink>
          }
        />
      ) : null}
    </>
  );
}
