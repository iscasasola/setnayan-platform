'use client';

/**
 * SignInCardModal — the greige sign-in card as a full-route surface: the dimmed
 * `.home-reskin-ov` backdrop + `.hr-ov-card` shell around <SignInCard>. Renders
 * the /login route (app/login/page.tsx) so a redirect / refresh / deep-link
 * shows the exact same popup the marketing nav does — one login everywhere
 * (owner 2026-07-18 "1 login … dimming the background anywhere").
 *
 * Rendered INLINE (not portaled) and without a mount gate so the form is
 * server-rendered and works even before/without JS (the server action posts via
 * progressive enhancement). `.home-reskin-ov` is position:fixed, so it overlays
 * the viewport from the page root regardless. The greige tokens + fonts are
 * re-declared on `.home-reskin-ov` itself (see home-reskin.css), so the card
 * styles correctly outside the marketing `.home-reskin` tree.
 *
 * DISMISS (close button · backdrop click · Escape via useModalA11y):
 *   • dismissHref set — the /login page passes "/" → router.push("/"). It must
 *     NOT be router.back(), which would return to the protected page that
 *     redirected here and bounce straight back to /login — a close loop.
 *   • dismissHref omitted → router.back() (kept as the generic default for any
 *     future overlay-over-a-page caller; the /login route never relies on it).
 */
import { useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { SignInCard, type SignInCardProps } from './sign-in-card';
import '@/app/_components/home/home-reskin.css';

export function SignInCardModal({
  dismissHref,
  ...card
}: SignInCardProps & { dismissHref?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const dismiss = () => {
    if (dismissHref) router.push(dismissHref);
    else router.back();
  };
  // open is constant true — the modal IS the route. onClose dismisses per above.
  useModalA11y({ open: true, onClose: dismiss, containerRef: ref });

  return (
    <div
      className="home-reskin-ov"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      ref={ref}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
    >
      {/*
        `sn-signin-terra` — SWITCHED ON HERE 2026-08-21 (owner: "switch it on").
        The seam panel (`sign-in-here-panel.tsx`) has worn this since 2026-08-13,
        so signing in from anywhere on the public site showed the terracotta
        card while /login — where you land from a redirect, a refresh, a
        bookmark or a deep link — showed the plain greige one. Same <SignInCard>
        inside, two different doors. "One login everywhere" is owner-locked
        (2026-07-18) and this is the half of it that had not been done.

        What it was wearing instead: `--hr-pop1` #9a7bc9, described in this
        file's own token block as "a la ELN's purple" — the accent of the
        cinematic homepage the owner RETIRED COMPLETELY on 2026-08-13. The last
        two links on the sign-in page were the last thing still painted in it.
      */}
      <div className="hr-ov-card sn-signin-terra" style={{ maxWidth: 460 }}>
        <button type="button" className="hr-ov-x" onClick={dismiss} aria-label="Close">
          ✕
        </button>
        <SignInCard {...card} />
      </div>
    </div>
  );
}
