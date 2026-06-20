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
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from './toast-provider';

function dec(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

// param → message builder. Array order = priority when several are present.
const SUCCESS_PARAMS: Array<[string, (v: string) => string]> = [
  ['saved', (v) => (v && v !== '1' ? `Saved — ${dec(v)}` : 'Saved.')],
  ['created', (v) => (v && v !== '1' ? `Created — ${dec(v)}` : 'Created.')],
  ['updated', (v) => (v && v !== '1' ? `Updated — ${dec(v)}` : 'Updated.')],
  ['added', (v) => (v && v !== '1' ? `Added ${dec(v)}` : 'Added.')],
  ['sent', () => 'Sent.'],
  ['removed', () => 'Removed.'],
  ['deleted', () => 'Deleted.'],
  ['completed', () => 'Done.'],
  ['done', (v) => (v === 'approved' ? 'Approved.' : v === 'rejected' ? 'Rejected.' : 'Done.')],
];
const HANDLED_KEYS = ['error', 'msg', ...SUCCESS_PARAMS.map(([k]) => k)];

export function ToastFromParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const msg = params.get('msg') ?? undefined;

    let message: string | null = null;
    let isError = false;
    if (params.get('error') !== null) {
      message = msg ?? 'Something went wrong — please try again.';
      isError = true;
    } else {
      for (const [key, build] of SUCCESS_PARAMS) {
        const v = params.get(key);
        if (v !== null) {
          message = msg ?? build(v);
          break;
        }
      }
    }
    if (message === null) return;

    fired.current = true; // set before side-effects — StrictMode double-invoke safe
    if (isError) toast.error(message);
    else toast.success(message);

    const next = new URLSearchParams(params.toString());
    for (const k of HANDLED_KEYS) next.delete(k);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router, toast]);

  return null;
}
