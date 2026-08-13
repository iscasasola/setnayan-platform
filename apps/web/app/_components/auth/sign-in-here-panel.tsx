'use client';

/**
 * sign-in-here-panel.tsx — the sign-in panel itself.
 *
 * ─── WHY THIS IS A SEPARATE FILE FROM THE PROVIDER ───────────────────────
 * 🚨 THE PROVIDER IS MOUNTED IN THE ROOT LAYOUT, SO ANYTHING IT IMPORTS
 * STATICALLY SHIPS ON EVERY PAGE IN THE PRODUCT. The first cut of this change
 * imported <SignInCard> — plus the OAuth row, the Turnstile field and two
 * stylesheets — straight into the provider, which put the entire login form in
 * the first-load JS of every marketing page, every article and the front door,
 * for every visitor who never presses Sign in.
 *
 * That is EXACTLY the defect this repo's own 2026-07-02 perf sweep already
 * fixed once (finding #7, `HomeReskin` → `dynamic(() => import('./HomeOverlays'))`:
 * *"CLOSED on first paint … yet their code was statically imported into the
 * homepage's first-load JS bundle"*) — reintroduced at a strictly larger blast
 * radius, because the root layout is every route rather than one.
 *
 * So the provider now `dynamic()`-imports this module. Rendering nothing and
 * COSTING nothing are different claims, and only the second one needed a code
 * change to be true.
 *
 * `ssr: false` is safe and correct: there is nothing to server-render while the
 * panel is closed, and it only ever opens from a click.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { SignInCard } from '@/app/login/_components/sign-in-card';
import { detectSignInOAuth, type SignInOAuth } from './detect-oauth-shell';
import type { OpenSignInOptions } from './sign-in-here-types';
import '@/app/_components/home/home-reskin.css';

/**
 * The panel. Mounted only while open, so nothing about it — not the card, not
 * the overlay styles' effect on the page — exists for a visitor who never
 * presses Sign in.
 */
export function SignInHerePanel({
  options,
  onClose,
}: {
  options: OpenSignInOptions;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [oauth] = useState<SignInOAuth>(detectSignInOAuth);
  /*
    ⚠ READ FROM `window`, NOT `useSearchParams()` — and this is not a style
    choice. This provider is mounted in the ROOT LAYOUT, so a `useSearchParams`
    anywhere in it opts EVERY page in the app out of static rendering (or fails
    `next build` outright with the missing-Suspense error). The marketing pages
    and the front door are ISR/edge-cached; quietly making them dynamic to
    build one URL would be a site-wide performance regression shipped as a
    sign-in tweak. This panel only ever mounts from a click, so `window` is
    always there by the time it is read.
    🪤 `tsc` cannot see this class of break — only a real `next build` can.
  */
  const [here, setHere] = useState('/');

  useEffect(() => {
    setHere(`${window.location.pathname}${window.location.search}`);
  }, []);
  /*
    🚨 THERE IS NO `mounted` GATE HERE, AND ADDING ONE BREAKS THE DIALOG
    SILENTLY. `useModalA11y` reads `containerRef.current` inside an effect that
    runs ONCE — its deps are `open` (a constant `true` here), the ref OBJECT and
    the id, none of which change when a mount flag flips. So with an
    `if (!mounted) return null` in front of the portal, the first render has no
    DOM, the effect early-returns on a null ref, and it NEVER RUNS AGAIN:
    Escape stops closing the panel, Tab wanders into the page behind it, and
    the body never locks. Nothing throws and it looks completely fine.

    The gate is also unnecessary. This component is rendered only from a click,
    so `document` always exists by then — the panel is never part of the
    server-rendered tree (the provider holds `null` until somebody presses Sign
    in). The `typeof document` line below is a RENDER-TIME safety net, not a
    state gate: it cannot delay the first real render the way state does, so
    the ref is attached before the effect fires.

    `app/login/_components/sign-in-card-modal.tsx` is the shape that works and
    has always worked: no gate, `open: true`, ref attached on first commit.
  */
  useModalA11y({ open: true, onClose, containerRef: ref });

  /*
    WHERE OAUTH COMES BACK TO.
    OAuth genuinely leaves — it is Google's page, not ours — so `next` is the
    only thing that can bring somebody back to the shop they were reading. It
    carries the CURRENT url, query and all.
    (The password path never navigates at all; `next` is threaded so both
    halves of the card agree about where "here" is.)
  */
  const next = here;

  const handleSignedIn = useCallback(
    () => {
      onClose();
      options.onSignedIn?.();
      /*
        🔑 REFRESH, NOT PUSH — this is the whole seam in one call.
        `router.refresh()` re-renders the server components with the new
        session while leaving every CLIENT component mounted. That is what
        keeps a half-written enquiry in its box. `router.push(here)` would look
        identical in the address bar and throw the typing away.
      */
      router.refresh();
    },
    [onClose, options, router],
  );

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="home-reskin-ov sn-signin-here"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in"
      ref={ref}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="hr-ov-card sn-signin-terra" style={{ maxWidth: 460 }}>
        <button type="button" className="hr-ov-x" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <SignInCard
          next={next}
          signupHref={`/signup?next=${encodeURIComponent(next)}`}
          showOAuth={oauth.show}
          desktopOAuth={oauth.desktop}
          onNavigate={onClose}
          onSignedIn={handleSignedIn}
        />
      </div>
    </div>,
    document.body,
  );
}
