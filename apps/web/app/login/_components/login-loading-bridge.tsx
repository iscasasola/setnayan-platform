'use client';

/**
 * LoginLoadingBridge — drives the app-wide brand loader overlay during
 * password sign-in. Sign-in → dashboard is the canonical "loading your
 * account" boot moment, so we cover it with the branded "thinking" loader
 * (Organic loaders handoff, owner 2026-06-07) rather than just the button's
 * "Signing in…" label.
 *
 * Renders nothing. Lives INSIDE the password <form> so useFormStatus() reads
 * that form's pending state — no change to the signInWithPassword server
 * action or the redirect flow. On success the action redirects, this unmounts,
 * and the cleanup hides the overlay; on error the redirect back to /login also
 * unmounts it. Scoped to password sign-in only (the magic-link form keeps its
 * lightweight "Sending…" button).
 */

import { useEffect } from 'react';
import { useFormStatus } from 'react-dom';
import { LOADER_STEPS, useLoader } from '@/components/sd-loader';

export function LoginLoadingBridge() {
  const { pending } = useFormStatus();
  const { show, hide } = useLoader();

  useEffect(() => {
    if (pending) {
      show({
        steps: LOADER_STEPS.signin,
        hint: 'Signing in',
        doneLabel: 'Welcome back',
      });
    } else {
      hide();
    }
  }, [pending, show, hide]);

  // Hide on unmount — covers the post-sign-in navigation away from /login.
  useEffect(() => () => hide(), [hide]);

  return null;
}
