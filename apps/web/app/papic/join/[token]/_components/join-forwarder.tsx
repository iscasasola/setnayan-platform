'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// Papic · hybrid join — client-side forwarder to the resolved web flow.
//
// The join page is a valid Universal/App-Link TARGET: when the native app is
// installed the OS intercepts this URL before the page ever loads. When it
// isn't, the page renders this thin interstitial and this component forwards
// the browser into the existing /papic/claim (seat) or /papic/me (guest)
// experience — we never duplicate the capture UI, we just bridge to it.
//
// A small delay lets the page-local install banner paint first (so the nudge is
// actually seen) without the friend feeling stuck — then we replace() so the
// join URL doesn't sit in history and a back-tap can't bounce them here. The
// no-JS <meta refresh> + visible link in the page are the fallback path, so a
// scanner with JS disabled still reaches the camera.

export function JoinForwarder({
  href,
  delayMs = 1200,
}: {
  href: string;
  delayMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace(href);
    }, delayMs);
    return () => clearTimeout(t);
  }, [href, delayMs, router]);

  return null;
}
