'use client';

/**
 * sign-in-here.tsx — signing in without leaving.
 *
 * Redesign Session 6, "the seam". Binding sources:
 * `FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md` §3 and
 * `prototypes/front_door_and_seam_2026-08-12.html`.
 *
 * ─── WHAT WAS WRONG ───────────────────────────────────────────────────────
 * Every public sign-in was a DEPARTURE. The front door's two Sign-in controls
 * were `<Link href="/login">`; the shop-page Save button did
 * `window.location.href = '/login?next=…'`. Both take the page away, and the
 * marketing nav's popup — the one surface that already opened over the page —
 * hardcoded `next='/'`, so it always dropped you on the account board and never
 * back on the shop you were reading. And on a WRONG PASSWORD every one of them
 * redirected to `/login?error=…`: one typo and the page, plus anything typed
 * into it, was gone.
 *
 * ─── THE RULE ─────────────────────────────────────────────────────────────
 * The rail never leaves. Sign-in opens OVER the page, the page behind stays
 * mounted, and when it closes you are still where you were — signed in.
 *
 * ⚠ THERE IS NO "…UNLESS" BRANCH HERE, and that is a decision, not an
 * omission. The seam doc says a sign-in "with no destination lands on the
 * board". That case is the /login ROUTE — reached by a hard load, a bookmark
 * or a protected-route redirect, with genuinely nothing behind it — and it
 * already behaves that way, untouched. Every sign-in that opens OVER a page
 * has a destination by definition: the page it opened over. A `landOn`
 * parameter was written here and deleted for having no caller; an option
 * nothing passes is a decision nobody made.
 *
 * ─── ONE LOGIN EVERYWHERE (owner-locked 2026-07-18) ───────────────────────
 * This does NOT add a second login. It renders the SAME <SignInCard> that
 * /login renders, in the SAME `.home-reskin-ov` shell, wired to the SAME
 * credential exchange — only the ending differs, and that difference lives in
 * `signInInPlace`, which shares its whole body with `signInWithPassword`.
 *
 * ─── COLOUR: THE ONE PLACE THE TWO PALETTES MEET ──────────────────────────
 * The panel wears the APP's terracotta (#C24E25), not the front door's gold.
 * It is the first room inside, not the last step outside — so the colour change
 * is a threshold you cross on purpose rather than a mismatch you notice.
 * (`FRONT_DOOR_AND_SEAM_FINAL` §4b.)
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { SignInCard } from '@/app/login/_components/sign-in-card';
import { detectSignInOAuth, type SignInOAuth } from './detect-oauth-shell';
import '@/app/_components/home/home-reskin.css';
import './sign-in-here.css';

export type OpenSignInOptions = {
  /**
   * Ran after a successful in-place sign-in, before the refresh. The shop
   * page's Save button uses it to retry the save the person had already
   * pressed, so the four presses in the prototype are four presses here.
   */
  onSignedIn?: () => void;
};

type SignInHereApi = {
  open: (options?: OpenSignInOptions) => void;
  /** False when no provider is mounted — callers fall back to /login. */
  available: boolean;
};

const SignInHereContext = createContext<SignInHereApi | null>(null);

/**
 * useSignInHere — the opener.
 *
 * ⚠ ALWAYS CHECK `available`. A caller that assumes the provider is mounted
 * ships a dead control the day somebody renders it outside the root layout,
 * and a dead control is the one thing the front door forbids. Every caller in
 * this repo falls back to a real `/login` navigation.
 */
export function useSignInHere(): SignInHereApi {
  const ctx = useContext(SignInHereContext);
  return (
    ctx ?? {
      open: () => {
        /* No provider — the caller's href fallback does the work. */
      },
      available: false,
    }
  );
}

export function SignInHereProvider({ children }: { children: React.ReactNode }) {
  const [options, setOptions] = useState<OpenSignInOptions | null>(null);
  const open = useCallback((next?: OpenSignInOptions) => {
    setOptions(next ?? {});
  }, []);
  const api = useMemo<SignInHereApi>(() => ({ open, available: true }), [open]);

  return (
    <SignInHereContext.Provider value={api}>
      {children}
      {options ? (
        <SignInHerePanel options={options} onClose={() => setOptions(null)} />
      ) : null}
    </SignInHereContext.Provider>
  );
}

/**
 * The panel. Mounted only while open, so nothing about it — not the card, not
 * the overlay styles' effect on the page — exists for a visitor who never
 * presses Sign in.
 */
function SignInHerePanel({
  options,
  onClose,
}: {
  options: OpenSignInOptions;
  onClose: () => void;
}) {
  const router = useRouter();
  const ref = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);
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
    setMounted(true);
    setHere(`${window.location.pathname}${window.location.search}`);
  }, []);
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

  if (!mounted) return null;

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
