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
 * ─── WHY THIS IS A HOOK AND NOT A CONTEXT PROVIDER ────────────────────────
 * 🚨 THE SHARED CLIENT BUNDLE IS FULL. `main` measures 199.8 KB gzipped
 * against a 200 KB ceiling locked in `DECISION_LOG.md` 2026-05-22 — 0.2 KB of
 * headroom for the whole product. The first cut of this change mounted a
 * context PROVIDER in the ROOT LAYOUT, and everything the root layout's client
 * tree touches lands in exactly that shared chunk: measured at 200.4 KB, over
 * budget, on a feature most visitors never use.
 *
 * So there is no provider and no context. Each surface that offers sign-in
 * owns its own state through this hook, and every one of those surfaces —
 * the front door shell, the shop page's link, the marketplace save button —
 * lives in a ROUTE chunk. The marketing nav keeps using the lazily-loaded
 * `HomeOverlays` chunk it already had. **The feature pays for itself where it
 * is used, and a page that never offers sign-in carries none of it.**
 *
 * 🔑 A raw `import()`, not `next/dynamic` — one less runtime, and the split is
 * the only thing being asked for.
 */

import { useCallback, useState, type ReactNode } from 'react';
import type { OpenSignInOptions } from './sign-in-here-types';

export type { OpenSignInOptions };

type PanelProps = { options: OpenSignInOptions; onClose: () => void };
type PanelComponent = (props: PanelProps) => ReactNode;

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
  const [Panel, setPanel] = useState<PanelComponent | null>(null);

  const openSignIn = useCallback((next?: OpenSignInOptions) => {
    /*
      Fetch the panel chunk, THEN open. Setting the options first would render
      a hole where the dialog should be for as long as the chunk takes — on a
      slow connection that reads as a broken button. `setPanel(() => …)` because
      a bare component value would be treated as a state updater.
    */
    void import('./sign-in-here-panel').then((m) => {
      setPanel(() => m.SignInHerePanel);
      setOptions(next ?? {});
    });
  }, []);

  const close = useCallback(() => setOptions(null), []);

  return {
    openSignIn,
    panel: options && Panel ? <Panel options={options} onClose={close} /> : null,
  };
}
