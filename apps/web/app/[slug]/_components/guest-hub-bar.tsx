'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { Camera, Images, LayoutGrid, QrCode, User, UserPlus, X } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';

// Guest event-page hub bar (owner 2026-06-26). When a guest scans their
// personal QR they land on their own InvitationSite view; this turns that page
// into a single-screen hub with a fixed bottom control bar + a top-right
// account affordance. It reuses what page.tsx already computes — no new DB
// reads happen here.
//
//   bottom-left   = QR icon → modal showing the guest's OWN personal QR so
//                   others can scan them (reuses the pre-rendered qrSvg).
//   bottom-center = Camera (the prominent action) → /papic/me/{qrToken} when the
//                   guest's paid roll camera is live, else /papic/guest when the
//                   couple's candid camera is open, else hidden.
//   bottom-right  = Gallery → /papic/me/{qrToken} ("Photos of you").
//   top-right     = signed-in viewer → /dashboard/profile; otherwise a "Link to
//                   account" button that scrolls to the existing claim-account
//                   section (#claim-account) on the page.
//
// Replaces the two lone floating Papic CTAs that used to sit on this page.

export function GuestHubBar({
  qrToken,
  invitationUrl,
  qrSvg,
  cameraReady,
  papicGuestActive,
  hasAccount,
  galleryCount,
  showClaimAnchor,
  hubHref,
}: {
  /** Guest personal QR token — the /papic/me/[token] bridge resolves it. */
  qrToken: string;
  /** Full invitation URL the QR encodes (shown under the code for sharing). */
  invitationUrl: string;
  /** Pre-rendered invitation QR as an inline SVG string (already monogrammed). */
  qrSvg: string;
  /** Guest's paid Limited roll camera is live (status === 'ready'). */
  cameraReady: boolean;
  /** Couple's PAPIC_GUEST candid camera is available. */
  papicGuestActive: boolean;
  /** Viewer is on a Setnayan account (Supabase auth session present). */
  hasAccount: boolean;
  /** Count of photos this guest is tagged in (0 when none / not in window). */
  galleryCount: number;
  /** The #claim-account section is rendered on this page (so anchor works). */
  showClaimAnchor: boolean;
  /** When set (event-day live/post), a top-left chip opens the fullscreen
   *  no-scroll guest hub at this href. Undefined outside the event day. */
  hubHref?: string | null;
}) {
  const [qrOpen, setQrOpen] = useState(false);
  const qrDialogRef = useRef<HTMLDivElement>(null);
  useModalA11y({
    open: qrOpen,
    onClose: () => setQrOpen(false),
    containerRef: qrDialogRef,
  });

  // Camera destination: prefer the guest's own paid roll camera, fall back to
  // the couple's candid camera, otherwise the center control is disabled.
  const cameraHref = cameraReady
    ? `/papic/me/${qrToken}`
    : papicGuestActive
      ? '/papic/guest'
      : null;

  // Gallery always points at the guest-QR bridge, which renders "Photos of you".
  const galleryHref = `/papic/me/${qrToken}`;

  return (
    <>
      {/* Top-left "Live hub" entry (event-day only) — opens the fullscreen,
          no-scroll toggle-menu hub. The hub is a separate route, so the long
          event page stays intact; this is its doorway from the day-of bar. */}
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

      {/* Top-right account affordance. Fixed so it rides above the page chrome;
          safe-area inset keeps it clear of notches. */}
      <div className="fixed right-3 top-3 z-40 [padding-top:env(safe-area-inset-top)]">
        {hasAccount ? (
          <Link
            href="/dashboard/profile"
            aria-label="Your account"
            className="inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/10 bg-cream/90 px-3 text-sm font-medium text-ink shadow-sm backdrop-blur transition hover:border-terracotta hover:text-terracotta"
          >
            <User aria-hidden className="h-4 w-4" strokeWidth={1.75} />
            <span>Account</span>
          </Link>
        ) : showClaimAnchor ? (
          <Link
            href="#claim-account"
            aria-label="Link to a Setnayan account"
            className="inline-flex h-10 items-center gap-1.5 rounded-full bg-mulberry px-3.5 text-sm font-semibold text-cream shadow-sm transition hover:bg-mulberry-600"
          >
            <UserPlus aria-hidden className="h-4 w-4" strokeWidth={2} />
            <span>Link to account</span>
          </Link>
        ) : null}
      </div>

      {/* Fixed bottom control bar — 3 controls, the Camera the prominent center
          action. Safe-area padding keeps it above the iOS home indicator. */}
      <nav
        aria-label="Your event controls"
        className="fixed inset-x-0 bottom-0 z-40 [padding-bottom:env(safe-area-inset-bottom)]"
      >
        <div className="mx-auto flex max-w-md items-end justify-between gap-3 px-5 pb-3 pt-2">
          {/* Bottom-left: open the guest's own personal QR. */}
          <button
            type="button"
            onClick={() => setQrOpen(true)}
            aria-label="Show my QR code"
            className="inline-flex h-[3.25rem] w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl border border-ink/10 bg-cream/95 text-ink shadow-lg backdrop-blur transition hover:border-terracotta hover:text-terracotta"
          >
            <QrCode aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            <span className="text-[0.6rem] font-medium leading-none">My QR</span>
          </button>

          {/* Bottom-center: the prominent Camera action. */}
          {cameraHref ? (
            <Link
              href={cameraHref}
              aria-label={cameraReady ? 'Your Papic camera' : 'Be a candid camera'}
              className="inline-flex h-16 w-16 -translate-y-1.5 flex-col items-center justify-center gap-0.5 rounded-full bg-mulberry text-cream shadow-xl transition hover:bg-mulberry-600"
            >
              <Camera aria-hidden className="h-6 w-6" strokeWidth={2} />
              <span className="text-[0.6rem] font-semibold leading-none">Camera</span>
            </Link>
          ) : (
            <span
              aria-hidden
              className="inline-flex h-16 w-16 -translate-y-1.5 flex-col items-center justify-center gap-0.5 rounded-full bg-ink/10 text-ink/30"
            >
              <Camera className="h-6 w-6" strokeWidth={2} />
              <span className="text-[0.6rem] font-semibold leading-none">Camera</span>
            </span>
          )}

          {/* Bottom-right: the guest's photos ("Photos of you"). */}
          <Link
            href={galleryHref}
            aria-label="Photos of you"
            className="relative inline-flex h-[3.25rem] w-[3.25rem] flex-col items-center justify-center gap-0.5 rounded-2xl border border-ink/10 bg-cream/95 text-ink shadow-lg backdrop-blur transition hover:border-terracotta hover:text-terracotta"
          >
            <Images aria-hidden className="h-5 w-5" strokeWidth={1.75} />
            <span className="text-[0.6rem] font-medium leading-none">Photos</span>
            {galleryCount > 0 ? (
              <span className="absolute -right-1 -top-1 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-terracotta px-1 text-[0.6rem] font-semibold leading-[1.1rem] text-cream">
                {galleryCount > 99 ? '99+' : galleryCount}
              </span>
            ) : null}
          </Link>
        </div>
      </nav>

      {/* Personal-QR modal. */}
      {qrOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm"
          onClick={() => setQrOpen(false)}
        >
          <div
            ref={qrDialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="guest-qr-title"
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-xs rounded-3xl border border-ink/10 bg-cream p-6 text-center shadow-2xl"
          >
            <button
              type="button"
              onClick={() => setQrOpen(false)}
              aria-label="Close"
              className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full text-ink/55 transition hover:bg-ink/5 hover:text-ink"
            >
              <X aria-hidden className="h-4 w-4" strokeWidth={2} />
            </button>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-terracotta">
              Your QR
            </p>
            <h2 id="guest-qr-title" className="mt-1 text-lg font-semibold tracking-tight text-ink">
              Let others scan you
            </h2>
            <p className="mx-auto mt-1 max-w-prose text-xs text-ink/60">
              Show this so photographers and friends can tag you in their photos.
            </p>
            <div
              aria-hidden
              className="mx-auto mt-5 inline-block rounded-2xl bg-white p-3 shadow-sm [&_svg]:h-auto [&_svg]:w-44"
              dangerouslySetInnerHTML={{ __html: qrSvg }}
            />
            <p className="mt-4 break-all font-mono text-[0.65rem] tracking-[0.05em] text-ink/50">
              {invitationUrl}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
