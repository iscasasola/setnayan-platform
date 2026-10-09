'use client';

import { useEffect } from 'react';

/**
 * 🎚 SCRUB — the island. Rendered by `HubScenes` ONLY on a page that has a scene whose "Leaves" is Scrub out, so its
 * code reaches no other page. It draws NOTHING (not even a marker — an element among the scenes would be one more
 * thing for the page's own rules to trip on). After the page is interactive it fetches the engine — its own chunk,
 * the one request this feature makes — and arms it on every scenes block of the page that has a hand-over. Without
 * it (no script, a blocked chunk, "reduce motion") the page is the plain page: everything visible, nothing held
 * (`hub-scrub-engine.ts`).
 *
 * ✏ IN THE MAKER, WHILE EDITING, NOTHING IS HELD (2026-10-09). The Maker's canvas is this same page, and an editor
 * must stay a place where every part can be picked: a scene drawn over the one before it, faded out, or standing
 * still under the thumb cannot be. So on the Maker's canvas the page stays the PLAIN page — every scene whole, in
 * page order — and the hand-overs run only while the host looks at the whole page as a guest (▶ held: the bridge's
 * `data-maker-guest`, `editor-bridge.tsx`). Leaving the preview disarms the engine, which takes every mark off.
 * The Maker's canvas is known by what ONLY it draws: a section marker (`[data-maker-section]`, host-verified by the
 * server — `site-body.tsx` `makerMark`). A guest's page has none, and is armed as it loads.
 */
const armed = new WeakSet<Element>();

/** Are the hand-overs on? A guest's page: always. The Maker's canvas: only while it is shown as a guest sees it. */
export function scrubArmsNow(makerCanvas: boolean, asGuest: boolean): boolean {
  return !makerCanvas || asGuest;
}

export function HubScrub() {
  useEffect(() => {
    const html = document.documentElement;
    const makerCanvas = document.querySelector('[data-maker-section]') !== null;
    const stops: Array<() => void> = [];
    let gone = false;
    let on = false;
    /* ▶ held changes the page's length under the host (the holds are length): the scene that was mid-screen is put
       back as the preview opens and as it closes — `hub-scrub-place.ts`, fetched on the Maker's canvas ONLY. A
       guest's page never loads it, and is never moved by script. */
    let keepPlace: ((change: () => void) => void) | null = null;
    const disarm = () => {
      for (const stop of stops.splice(0)) stop();
    };
    const arm = () => {
      void Promise.all([import('./hub-scrub-engine'), makerCanvas ? import('./hub-scrub-place') : null])
        .then(([m, place]) => {
          if (gone || !on) return;
          keepPlace = place?.keepScenePlace ?? null;
          const go = () => {
            for (const root of document.querySelectorAll<HTMLElement>('.hub-scenes')) {
              /* One engine a block — a page can mount this island more than once (each scenes block renders its own). */
              if (armed.has(root) || !root.querySelector('[data-hub-fx]')) continue;
              armed.add(root);
              const stop = m.armHubScrub(root);
              stops.push(() => {
                armed.delete(root);
                stop();
              });
            }
          };
          if (keepPlace) keepPlace(go);
          else go();
        })
        .catch(() => {
          /* The plain page stands. */
        });
    };
    const sync = () => {
      const want = scrubArmsNow(makerCanvas, html.hasAttribute('data-maker-guest'));
      if (want === on) return;
      on = want;
      if (on) arm();
      else if (keepPlace) keepPlace(disarm);
      else disarm();
    };
    sync();
    const watch = makerCanvas && typeof MutationObserver !== 'undefined' ? new MutationObserver(sync) : null;
    watch?.observe(html, { attributes: true, attributeFilter: ['data-maker-guest'] });
    return () => {
      gone = true;
      watch?.disconnect();
      disarm();
    };
  }, []);
  return null;
}
