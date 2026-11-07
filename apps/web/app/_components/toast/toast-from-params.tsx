'use client';

/**
 * toast-from-params.tsx — bridges server-action <form action={…}> flows to the
 * toast primitive. A plain server-action form can't call useToast(), so the
 * action redirect()s with a query flag and this component (mounted app-wide in
 * providers.tsx) fires the toast once, then strips the flag so a refresh won't
 * re-fire.
 *
 * Recognised flags — chosen to cover the success params ALREADY scattered across
 * the codebase (29 redirect sites as of the 2026-06-20 user-flow audit), so
 * existing redirects light up with zero per-site change:
 *   ?saved ?created ?updated ?added ?sent ?removed ?deleted ?completed
 *   ?done=approved|rejected                 → success toast (verb-appropriate)
 *   ?error[=…][&msg=…]                       → error toast
 *   a non-"1" value (e.g. ?created=ABC123)   → appended to the message
 *   &msg=…                                    → overrides the generated message
 *
 * To surface a FAILURE inline instead of crashing to the error boundary, give a
 * throwing action a catch that redirects `?error=1&msg=…` (the feedback sweep).
 *
 * Mounted inside <Suspense> (in providers.tsx) because useSearchParams() opts
 * the subtree into client rendering.
 *
 * 🔒 A PAGE THAT PRINTS ITS OWN `?error=` KEEPS IT (2026-11-06). What this does
 * with an address is decided in `./param-toast.ts` (tested there): the flags
 * leave the address without a server round trip, and an error the page already
 * shows gets no second, generic toast.
 */

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useToast } from './toast-provider';
import { planParamToast } from './param-toast';

/**
 * Does the page on screen already show the person an error? A visible `role="alert"` with words in it —
 * FormFlash (error), DoorNotice (alert), the sign-in cards' banner all render one. The peek toast's own
 * alert pill is not the page.
 */
function pageShowsError(): boolean {
  for (const el of Array.from(document.querySelectorAll('[role="alert"]'))) {
    if (el.closest('[data-peek-toast]')) continue;
    if (!(el.textContent ?? '').trim()) continue;
    if (el.getClientRects().length === 0) continue; // display:none / not rendered
    return true;
  }
  return false;
}

export function ToastFromParams() {
  const params = useSearchParams();
  const pathname = usePathname();
  const toast = useToast();
  // The ADDRESS last handled — not a one-shot flag. This component lives in the root providers for the whole
  // visit, so a `useRef(false)` set once meant only the FIRST flagged address of a visit ever toasted; every
  // later `?saved=1` / `?error=…` was ignored and left in the address. Same address twice (StrictMode's
  // double effect) is still handled once.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    const key = `${pathname}?${params.toString()}`;
    if (handled.current === key) return;
    const plan = planParamToast(new URLSearchParams(params.toString()), pageShowsError());
    if (!plan) {
      // A clean address: forget the last one, so the SAME flag arriving again (a second save) toasts again.
      handled.current = null;
      return;
    }
    handled.current = key;

    if (plan.toast?.tone === 'error') toast.error(plan.toast.message);
    else if (plan.toast) toast.success(plan.toast.message);

    // 🔑 `history.replaceState`, NEVER `router.replace`. The router follows a native replaceState (the address
    // and useSearchParams update) WITHOUT asking the server for the page again. `router.replace` did ask — and
    // the page came back drawn without its `?error=`, so the door's own specific error vanished the moment it
    // appeared (measured on /signup?error=password_leaked, 2026-11-06).
    window.history.replaceState(window.history.state, '', `${pathname}${plan.search}${window.location.hash}`);
  }, [params, pathname, toast]);

  return null;
}
