/**
 * 📶 WHO IS SIGNED IN, TOLD TO THE WORKER (EV3 — `public/sw.js` "THE SAVED COPY FOR A NO-SIGNAL VENUE", rule ONE
 * VIEWER). Rendered by the signed-in layouts (`app/dashboard/layout.tsx`, `app/vendor-dashboard/layout.tsx`): every
 * signed-in page load posts `OFFLINE_VIEWER` with the account id, and the worker erases any saved event pages that
 * belong to somebody else — so a second account on a shared phone never opens the first one's guest list with no
 * signal, even before it saves anything of its own.
 *
 * An inline script, not a client component: it adds nothing to any JavaScript bundle (the shared bundle has bytes of
 * room — `scripts/check-bundle-size.mjs`), the same choice as the last-seen wipe. Never throws.
 */
const VIEWER = /^[A-Za-z0-9_-]{8,128}$/;

export function offlineViewerScript(viewer: string): string | null {
  if (!VIEWER.test(viewer)) return null;
  return (
    'try{var c=navigator.serviceWorker&&navigator.serviceWorker.controller;' +
    `if(c)c.postMessage({type:"OFFLINE_VIEWER",viewer:${JSON.stringify(viewer)}})}catch(e){}`
  );
}

export function OfflineViewerScript({ viewer }: { viewer: string }) {
  const js = offlineViewerScript(viewer);
  return js ? <script dangerouslySetInnerHTML={{ __html: js }} /> : null;
}
