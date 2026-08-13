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
 *
 * ─── WHAT IS IN THIS FILE, AND WHY IT IS SO SMALL ────────────────────────
 * Only the context, the opener and a `dynamic()` reference. The panel — the
 * card, the OAuth row, the Turnstile field, two stylesheets — lives in
 * `sign-in-here-panel.tsx` and is fetched on the first press. See the note
 * there: this provider is in the ROOT LAYOUT, so anything it imports statically
 * ships on every page in the product.
 */

import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import type { OpenSignInOptions } from './sign-in-here-types';

export type { OpenSignInOptions };

/*
  🚨 LAZY, AND THIS IS THE WHOLE REASON THE PANEL IS A SEPARATE FILE.
  This provider is mounted in the ROOT LAYOUT. A static import of the panel
  would put <SignInCard>, the OAuth row, the Turnstile field and two
  stylesheets into the first-load JS of EVERY page — for every visitor who
  never presses Sign in. That is the same defect the 2026-07-02 perf sweep
  fixed for the homepage overlays (finding #7), at a larger blast radius.
  `ssr: false` is safe: there is nothing to server-render while it is closed.
*/
const SignInHerePanel = dynamic(
  () => import('./sign-in-here-panel').then((m) => m.SignInHerePanel),
  { ssr: false },
);

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

