'use client';

import { installHistoryStormProbe, type HistoryStorm } from '@/lib/history-storm-probe';

/**
 * Installs the history-storm probe for the signed-in `/dashboard` outage.
 *
 * 🔑 INSTALLED AT MODULE SCOPE, NOT IN AN EFFECT, AND THAT IS THE WHOLE POINT.
 * The failure it is meant to observe kills the page during hydration — and if
 * hydration dies, effects never run. A probe that waits for `useEffect` would
 * be installed only on the loads that did not need it, and would report nothing
 * on exactly the loads that did. It has to be watching before React starts.
 *
 * Module scope in a client component runs when the chunk is evaluated, which is
 * before hydration. Wrapping `history` there is safe: the wrapper always calls
 * through, and nothing else in the app depends on the identity of those
 * functions.
 *
 * Renders nothing.
 */
function send(storm: HistoryStorm) {
  // `keepalive` because the page this reports from is, by definition, about to
  // die: without it the request goes with the document and the one piece of
  // evidence never arrives.
  void fetch('/api/diag/history-storm', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(storm),
    keepalive: true,
  }).catch(() => {
    /* the page is already failing; a failed report must stay silent */
  });
}

if (typeof window !== 'undefined') {
  installHistoryStormProbe(send);
}

export function HistoryStormProbeMount() {
  return null;
}
