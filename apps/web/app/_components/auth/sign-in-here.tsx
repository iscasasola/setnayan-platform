'use client';

/**
 * sign-in-here.tsx — opening the sign-in panel from wherever you already are.
 *
 * Redesign Session 6, "the seam". Binding sources:
 * `FRONT_DOOR_AND_SEAM_FINAL_2026-08-12.md` §3 and
 * `prototypes/front_door_and_seam_2026-08-12.html`.
 *
 * ─── WHAT WAS WRONG ───────────────────────────────────────────────────────
 * Every public sign-in was a DEPARTURE. The front door's two Sign-in controls
 * were `<Link href="/login">`; the shop page's "Sign in to customize" was too;
 * the shop-save button did `window.location.href = '/login?next=…'`. All of
 * them take the page away. And the marketing nav's popup — the one surface
 * that already opened OVER the page — hardcoded `next='/'`, so it always
 * dropped you on the account board and never back on the shop you were
 * reading. On a WRONG PASSWORD every one of them redirected to
 * `/login?error=…`: one typo and the page, plus anything typed into it, gone.
 *
 * ─── WHY THIS IS A HOOK, NOT A PROVIDER ──────────────────────────────────
 * A context PROVIDER in the ROOT LAYOUT would put the panel's whole client
 * tree in the shared bundle, on every page, for every visitor (measured
 * 2026-08: +0.6 KB over the shared ceiling). A hook keeps it in the chunks of
 * the screens that can open it.
 *
 * ─── WHY THE PANEL IS NOW ITS OWN CHUNK (2026-11-26) ─────────────────────
 * It used to be a STATIC import, because a new lazy chunk added an entry to
 * the webpack runtime when the shared bundle had 0.2 KB of room. That bundle
 * now has ~97 KB of room, and the static import had a cost of its own: the
 * front-door shell wraps EVERY signed-in page, so the whole sign-in card
 * (the form, the common-password list, the door words) rode in the event
 * layout's first load — the Event Hub Maker's included, which sat 0.2 KB
 * under its ceiling (`scripts/check-maker-js-budget.mjs`) for a panel a
 * signed-in host can never open there. It loads on the first press of Sign
 * in. `loadSignInHerePanel` is exported so a screen can warm it while idle.
 */

import { lazy, Suspense, useCallback, useState, type ReactNode } from 'react';
import type { OpenSignInOptions } from './sign-in-here-types';

export const loadSignInHerePanel = () => import('./sign-in-here-panel');
const SignInHerePanel = lazy(() => loadSignInHerePanel().then((m) => ({ default: m.SignInHerePanel })));

export type { OpenSignInOptions };

/**
 * useSignInPanel — `openSignIn()` to open it, `panel` to render it.
 *
 * Usage:
 *   const { openSignIn, panel } = useSignInPanel();
 *   …
 *   <Link href="/login" onClick={(e) => { e.preventDefault(); openSignIn(); }}>Sign in</Link>
 *   {panel}
 *
 * ⚠ THE CALLER KEEPS A REAL `href`. The press is intercepted, but the control
 * stays a genuine link so it works before hydration and with JavaScript off,
 * and so middle-click / open-in-new-tab still reach `/login`. A `<button>`
 * pressed before hydration does nothing at all — a dead control, which is the
 * one thing the front door forbids.
 */
export function useSignInPanel(): {
  openSignIn: (options?: OpenSignInOptions) => void;
  panel: ReactNode;
} {
  const [options, setOptions] = useState<OpenSignInOptions | null>(null);

  const openSignIn = useCallback((next?: OpenSignInOptions) => {
    void loadSignInHerePanel();
    setOptions(next ?? {});
  }, []);

  const close = useCallback(() => setOptions(null), []);

  /*
    Nothing renders until it is opened — no portal, no backdrop, no effect,
    and no download: a visitor who never presses Sign in fetches none of it.
    While the chunk arrives nothing is drawn; the press already started it.
  */
  return {
    openSignIn,
    panel: options ? (
      <Suspense fallback={null}>
        <SignInHerePanel options={options} onClose={close} />
      </Suspense>
    ) : null,
  };
}
