'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { LANDING_WORDS, SAFARI_HOP_WAIT_MS, safariHopLink, safariHopStuck } from '@/lib/guest-landing';
import { CopyMyLink } from './copy-my-link';

/**
 * 🧭 "OPEN IN SAFARI" THAT SAYS WHEN IT DID NOT OPEN (owner walk 2026-11-27, MASTER-PLAN L3 — the tap fired 35 times on
 * `/[slug]/invite/enter` and `/[slug]/welcome` and did nothing).
 *
 * Inside Messenger / Facebook / Instagram on an iPhone the way out is an `x-safari-https://…` link
 * (`inAppHandoffFor`, lib/guest-landing.ts). Where the app honours it, the tap opens Safari and this page leaves the
 * screen — nothing else happens here. Where the app ignores it, the page used to just sit there. Now the press watches
 * the page for `SAFARI_HOP_WAIT_MS`: still on screen → the hop did not happen, and the line under it says so, with the
 * two ways that always work — the app's own "Open in browser" menu, or the guest's own link to copy (`CopyMyLink`, which
 * itself falls back to a field to select by hand when the clipboard is refused).
 *
 * The link is still a real `<a href>`: with no script it is exactly the shipped link.
 */
export function SafariHop({
  href,
  className,
  children,
  under = 'block',
  ...rest
}: {
  /** The `x-safari-https://…` hand-off. */
  href: string;
  className?: string;
  children: ReactNode;
  /** `bar`: the fallback stands under a thin bar (full width, its own padding); `block`: under a button. */
  under?: 'bar' | 'block';
} & Record<`data-${string}`, string | undefined>) {
  const [stuck, setStuck] = useState(false);
  const waiting = useRef<(() => void) | null>(null);
  useEffect(() => () => waiting.current?.(), []);

  function watch() {
    waiting.current?.();
    setStuck(false);
    let left = false;
    const away = () => {
      if (document.visibilityState === 'hidden') left = true;
    };
    const gone = () => {
      left = true;
    };
    document.addEventListener('visibilitychange', away);
    window.addEventListener('pagehide', gone);
    const timer = window.setTimeout(() => {
      stop();
      setStuck(safariHopStuck({ left, visible: document.visibilityState === 'visible' }));
    }, SAFARI_HOP_WAIT_MS);
    function stop() {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', away);
      window.removeEventListener('pagehide', gone);
      waiting.current = null;
    }
    waiting.current = stop;
  }

  return (
    <>
      <a {...rest} href={href} onClick={watch} className={className}>
        {children}
      </a>
      {stuck ? (
        <div
          role="status"
          data-safari-stuck=""
          className={under === 'bar' ? 'order-last w-full space-y-2 px-1 pb-3 pt-1 text-center' : 'mt-3 space-y-2 text-center'}
        >
          <p className="text-sm font-medium text-ink">{LANDING_WORDS.safariStuck}</p>
          <p className="text-xs text-ink/70">{LANDING_WORDS.safariStuckHow}</p>
          <CopyMyLink link={safariHopLink(href)} heading={null} note={null} />
        </div>
      ) : null}
    </>
  );
}
