'use client';

/**
 * LoginOverlay — the client wrapper for the INTERCEPTED /login route
 * (app/@modal/(.)login). On soft navigation to /login the frosted sign-in rail
 * slides in OVER the page you were on (homepage, /pricing, …) instead of
 * leaving it: desktop slides the rail in from the right while the hero settles
 * from the left ("the website's buttons move"); mobile rises as a bottom sheet.
 * Owner directive 2026-07-01.
 *
 * The hero + rail are server-rendered (form wired to the signInWithPassword
 * server action) and handed in as props; this wrapper only adds the backdrop,
 * the entrance choreography, and the a11y/dismiss behavior. Dismiss =
 * router.back() (Escape via useModalA11y, backdrop click, or the close button),
 * which pops the intercepting route and returns to the underlying page with its
 * scroll position intact. A hard load / refresh of /login bypasses this entirely
 * and renders the standalone full page (app/login/page.tsx).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useModalA11y } from '@/lib/use-modal-a11y';

export function LoginOverlay({ hero, rail }: { hero: ReactNode; rail: ReactNode }) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  // `open` flips true on the first client tick so the CSS transition runs from
  // the off-screen start state → in. Without the tick the element mounts already
  // "in" and there's no animation.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // Focus trap + Escape-to-close + body-scroll-lock + focus restore. Mounted =
  // open; onClose pops the intercepted route.
  useModalA11y({ open: true, onClose: () => router.back(), containerRef: dialogRef });

  return (
    <div
      className="sn-login-overlay"
      data-open={open ? 'true' : 'false'}
      // Backdrop dismiss — only when the click starts on the backdrop itself,
      // not on the scene. mousedown (not click) so a text-selection drag that
      // ends on the backdrop doesn't dismiss.
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) router.back();
      }}
    >
      <div
        ref={dialogRef}
        className="sn-login sn-login--overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Sign in"
      >
        {hero}
        <aside className="sn-login-rail">
          <button
            type="button"
            className="sn-login-close"
            onClick={() => router.back()}
            aria-label="Close sign in"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden focusable={false}>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
          {rail}
        </aside>
      </div>
    </div>
  );
}
