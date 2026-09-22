'use client';

import { useEffect, useRef, useState } from 'react';
import { ExternalLink } from 'lucide-react';
import { walletFallbackFor, walletSchemeFor } from '@/lib/wallet-handoff';

/**
 * "Open GCash" — hands the phone off to the wallet app so the payer pastes a
 * number instead of typing eleven digits from memory.
 *
 * See `lib/wallet-handoff.ts` for what was measured and on which phone. Three
 * rules this component exists to keep:
 *
 *  1. IT CAN ONLY EVER SAVE A TAP. The number and its copy control render
 *     beside this button, not behind it, so an unsupported phone (or the day
 *     GCash retires the scheme) costs a tap and never a payment.
 *  2. IT NEVER APPEARS ON THE WRONG RAIL. `walletSchemeFor` is exact-match, so
 *     a BDO row cannot open GCash and misdirect money.
 *  3. IT ADMITS WHEN NOTHING HAPPENED. An unhandled scheme on iOS is silent —
 *     the page just sits there, which looks identical to a slow app. If we are
 *     still visible a beat after the tap, the app did not take over and we say
 *     so, with somewhere to go.
 *
 * Touch only: `gcash://` does nothing on a desktop, and a dead button is worse
 * than no button. The check runs after mount, so the server renders nothing.
 */

/** How long to wait before deciding the app never came to the front. */
const HANDOFF_GRACE_MS = 1400;

export function OpenWalletButton({
  provider,
  className,
}: {
  provider: string | null | undefined;
  className?: string;
}) {
  const scheme = walletSchemeFor(provider);
  const fallback = walletFallbackFor(provider);

  const [onTouch, setOnTouch] = useState(false);
  const [stranded, setStranded] = useState(false);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    // A coarse pointer is the capability we actually depend on, so test that
    // rather than sniffing the user agent.
    try {
      setOnTouch(window.matchMedia('(pointer: coarse)').matches);
    } catch {
      /* no matchMedia — leave the button off rather than render a dead one */
    }
  }, []);

  useEffect(() => {
    // The app taking over backgrounds this page. Either event means the
    // handoff worked, so stand the watchdog down.
    function standDown() {
      if (document.visibilityState === 'hidden' && timer.current !== null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    }
    document.addEventListener('visibilitychange', standDown);
    window.addEventListener('pagehide', standDown);
    return () => {
      document.removeEventListener('visibilitychange', standDown);
      window.removeEventListener('pagehide', standDown);
      if (timer.current !== null) window.clearTimeout(timer.current);
    };
  }, []);

  if (!scheme || !onTouch) return null;

  function armWatchdog() {
    setStranded(false);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      // Still here, still visible → nothing claimed the scheme.
      if (document.visibilityState === 'visible') setStranded(true);
    }, HANDOFF_GRACE_MS);
  }

  return (
    <div className="flex flex-col gap-1.5">
      <a
        href={scheme}
        onClick={armWatchdog}
        className={
          className ??
          'inline-flex items-center justify-center gap-1.5 rounded-md border border-ink/15 bg-cream px-3 py-2 text-sm font-medium text-ink/80 hover:border-terracotta/50 hover:text-terracotta-700'
        }
      >
        <ExternalLink aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        Open {provider}
      </a>

      {stranded ? (
        <p className="text-xs text-ink/60" role="status">
          {provider} didn&rsquo;t open — it may not be installed on this phone.{' '}
          {fallback ? (
            <a
              href={fallback}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-link underline"
            >
              Get {provider}
            </a>
          ) : null}{' '}
          The number above is still copied.
        </p>
      ) : null}
    </div>
  );
}
