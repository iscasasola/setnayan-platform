'use client';

/**
 * StdViewBeacon — fires one Save-the-Date view ping on mount (iteration 0024).
 *
 * Rendered ONLY while the page is in its Save-the-Date phase and ONLY for
 * non-host viewers (the parent gates it so the couple/coordinators never count
 * their own visits). The endpoint dedups to one count per device per day via a
 * first-party cookie, so a refresh / re-mount is a cheap server no-op. Renders
 * nothing and never blocks paint (`keepalive` survives a quick tab close).
 */

import { useEffect, useRef } from 'react';

export function StdViewBeacon({ slug }: { slug: string }) {
  const sent = useRef(false);
  useEffect(() => {
    if (!slug || sent.current) return;
    sent.current = true;
    try {
      void fetch('/api/std/view', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      /* analytics is best-effort */
    }
  }, [slug]);
  return null;
}
