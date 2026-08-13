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
 * ─── WHY THIS IS A HOOK, NOT A PROVIDER — AND WHY THE IMPORT IS STATIC ────
 * 🚨 THE SHARED CLIENT BUNDLE IS FULL. `main` measures 199.8 KB gzipped
 * against the 200 KB ceiling locked in `DECISION_LOG.md` 2026-05-22 — 0.2 KB
 * of headroom for the whole product. This change took two goes to fit, and
 * BOTH failures were measured rather than guessed:
 *
 *   1. A context PROVIDER in the ROOT LAYOUT → 200.4 KB. Everything the root
 *      layout's client tree touches lands in the shared chunk, on every page,
 *      for every visitor including the ones who never sign in.
 *   2. Provider removed, panel behind a lazy `import()` → STILL 200.4 KB.
 *      Diffing the per-chunk breakdown against a passing run showed five of
 *      six chunks BYTE-IDENTICAL to `main`, and the whole overage in
 *      `webpack-*.js` — the runtime that carries the CHUNK MANIFEST. It grew
 *      3.2 KB → 3.8 KB gz because a NEW ASYNC CHUNK had been created. **The
 *      lazy import was itself the cost.**
 *
 * So the import is STATIC and the panel has no chunk of its own. Every
 * consumer is already somewhere that is not the shared bundle — the front-door
 * shell and the shop page's link and the marketplace save button are ROUTE
 * chunks, and the marketing nav opens it through `HomeOverlays`, which was
 * already `dynamic(ssr:false)` and already paid for. The panel's code simply
 * rides along in chunks that already exist.
 *
 * 🔑 THAT IS THE BUDGET'S OWN POLICY, not a workaround: the checker counts the
 * shared surface only, and says outright that "a single page can carry a
 * heavier per-route bundle as long as the shared surface stays inside the
 * budget". Splitting is not free — a split you do not need costs the runtime
 * that indexes it.
 */

import { useCallback, useState, type ReactNode } from 'react';
import type { OpenSignInOptions } from './sign-in-here-types';
import { SignInHerePanel } from './sign-in-here-panel';

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
    setOptions(next ?? {});
  }, []);

  const close = useCallback(() => setOptions(null), []);

  /*
    Nothing renders until it is opened — no portal, no backdrop, no effect —
    so a visitor who never presses Sign in sees and runs none of it. What they
    no longer avoid is DOWNLOADING it, and that is the deliberate trade: the
    code rides in a route chunk that was being fetched anyway, instead of
    costing every page in the product a bigger chunk manifest.
  */
  return {
    openSignIn,
    panel: options ? <SignInHerePanel options={options} onClose={close} /> : null,
  };
}
