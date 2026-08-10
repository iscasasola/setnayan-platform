'use client';

import { useEffect } from 'react';

import { installHistoryStormProbe } from '@/lib/history-storm-probe';

/**
 * Mounts the history-storm probe for the signed-in `/dashboard` outage.
 *
 * Renders nothing. Installs once, reports at most once per page load, and
 * always calls through to the real history functions — a diagnostic that can
 * change behaviour is worthless for diagnosing behaviour.
 *
 * `keepalive` on the POST because the page it is reporting from is, by
 * definition, about to throw: without it the request dies with the document and
 * the one piece of evidence never arrives.
 */
export function HistoryStormProbeMount() {
  useEffect(() => {
    return installHistoryStormProbe((storm) => {
      void fetch('/api/diag/history-storm', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(storm),
        keepalive: true,
      }).catch(() => {
        /* the page is already failing; a failed report must stay silent */
      });
    });
  }, []);

  return null;
}
