'use client';

/**
 * toast-from-params.tsx — bridges server-action <form action={…}> flows to the
 * toast primitive. A plain server-action form can't call useToast(), so the
 * action redirects with a query flag and this component (mounted app-wide in
 * providers.tsx) fires the toast once, then strips the flag so a refresh won't
 * re-fire.
 *
 * Convention (use in the gated feedback sweep — see User_Flow_Audit_Backlog_2026-06-20.md):
 *   success: redirect(`${path}?saved=1`)            → "Saved."
 *            redirect(`${path}?saved=1&msg=Booking%20confirmed`)
 *   error:   redirect(`${path}?error=1&msg=…`)      → that message, error tint
 *
 * Mounted inside <Suspense> because useSearchParams() opts the subtree into
 * client rendering.
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useToast } from './toast-provider';

export function ToastFromParams() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const fired = useRef(false);

  useEffect(() => {
    if (fired.current) return;
    const saved = params.get('saved');
    const error = params.get('error');
    const msg = params.get('msg') ?? undefined;
    if (!saved && !error) return;

    fired.current = true;
    if (error) toast.error(msg ?? 'Something went wrong — please try again.');
    else toast.success(msg ?? 'Saved.');

    const next = new URLSearchParams(params.toString());
    next.delete('saved');
    next.delete('error');
    next.delete('msg');
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [params, pathname, router, toast]);

  return null;
}
