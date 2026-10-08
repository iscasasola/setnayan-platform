'use client';

import { useEffect } from 'react';
import { makerLeavingWords } from '@/lib/maker-resume';

/**
 * 🔁 "UPDATING SETNAYAN…" — said BEFORE the Maker reloads itself (owner 08 Oct, live: *"clicking on music reset the
 * maker and reloaded"*; `lib/maker-resume.ts` has what reloaded and why). The reload is Next's own, or the stale
 * bundle's — code that gives no warning — so the page listens for the navigation itself (the Navigation API's
 * `navigate` event, which fires before the page leaves) and, when it is the page reloading ITSELF by script
 * (`makerLeavingWords`), lays one line over the screen. The old page stays painted until the new one arrives, so
 * the words are what the couple reads in between — never a blank flash that looks like a crash.
 *
 * Drawn straight into the document (no state): the page is on its way out, and a render might never paint. A
 * browser without the Navigation API says nothing; the Maker still comes back where it was. Should the
 * navigation not happen after all, the line takes itself away.
 *
 * Lazy (`details-lazy.tsx`): nothing of it rides the Maker's first load.
 */
export function MakerUpdating() {
  useEffect(() => {
    const nav = (window as unknown as { navigation?: EventTarget }).navigation;
    if (!nav) return;
    const onNavigate = (e: Event) => {
      const n = e as Event & { userInitiated?: boolean; navigationType?: string; destination?: { url?: string; sameDocument?: boolean } };
      const words = makerLeavingWords({
        userInitiated: n.userInitiated === true,
        type: n.navigationType ?? '',
        to: n.destination?.url ?? '',
        sameDocument: n.destination?.sameDocument === true,
        here: window.location.href,
      });
      if (!words || document.querySelector('[data-maker-updating]')) return;
      const el = document.createElement('p');
      el.setAttribute('role', 'status');
      el.setAttribute('data-maker-updating', '');
      el.textContent = words;
      el.style.cssText =
        'position:fixed;inset:0;z-index:2147483647;margin:0;display:grid;place-items:center;background:rgb(var(--color-cream)/.94);color:rgb(var(--color-ink));font:600 15px/1.4 system-ui,sans-serif';
      document.body.appendChild(el);
      window.setTimeout(() => el.remove(), 8000);
    };
    nav.addEventListener('navigate', onNavigate);
    return () => nav.removeEventListener('navigate', onNavigate);
  }, []);
  return null;
}
