'use client';

import { useEffect, useState } from 'react';
import { useFormStatus } from 'react-dom';

/**
 * "DIDN'T OPEN? TRY AGAIN" — the way back when the sign-in provider does not
 * take over (owner's live test, 2026-10-02: from the thank-you, "Save to my
 * account" showed a Google sign-in that hung on "loading", and Guest A was never
 * linked).
 *
 * WHY OURS COULD SPIN FOREVER. The Save press is a Server Action that ends in a
 * redirect to ANOTHER SITE (accounts.google.com / appleid.apple.com). Two things
 * on our side then had no way out:
 *   · the press raised the app-wide no-touch veil, which is designed to stay up
 *     "until the destination's screen loader takes over" — a provider's page has
 *     no loader of ours, so if its page is slow, blocked or abandoned the veil
 *     covered the whole screen with nothing to tap (the Save button now opts out
 *     of the veil: `overlay={false}`);
 *   · a guest who backs out of the provider's page gets OUR page from the
 *     back-forward cache, frozen mid-press — "Opening Google…" on a disabled
 *     button, forever.
 * What happens on the provider's page itself (an account not picked, a slow
 * network, a provider outage) is theirs, not ours — but the guest must never be
 * stranded on our screen because of it.
 *
 * So: after `PROVIDER_STALL_MS` still pending, one line appears under the button
 * — "Didn't open? Try again" — and a page restored from the back-forward cache
 * reloads itself into a live one. Lives inside the Save form (it reads that
 * form's status), mounted ONLY by `SaveToAccount` (route chunks of the thank-you
 * and the plus-one welcome — never the shared bundle).
 */
export const PROVIDER_STALL_MS = 8000;

export function stallLine(provider: string): string {
  return `${provider} didn’t open?`;
}

export function ProviderStall({ provider }: { provider: 'Apple' | 'Google' }) {
  const { pending } = useFormStatus();
  const [stalled, setStalled] = useState(false);

  useEffect(() => {
    // Back from the provider's page: a frozen press comes back live.
    const onShow = (e: PageTransitionEvent) => {
      if (e.persisted) window.location.reload();
    };
    window.addEventListener('pageshow', onShow);
    return () => window.removeEventListener('pageshow', onShow);
  }, []);

  useEffect(() => {
    if (!pending) {
      setStalled(false);
      return;
    }
    const t = window.setTimeout(() => setStalled(true), PROVIDER_STALL_MS);
    return () => window.clearTimeout(t);
  }, [pending]);

  if (!stalled) return null;
  return (
    <p role="status" className="text-center text-sm text-ink/70" data-provider-stall="">
      {stallLine(provider)}{' '}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="inline-flex min-h-[44px] items-center font-medium text-mulberry underline underline-offset-4"
      >
        Try again
      </button>
    </p>
  );
}
