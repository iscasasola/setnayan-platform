'use client';

import { useEffect } from 'react';

/**
 * 🎚 SCRUB — the island. Rendered by `HubScenes` ONLY on a page that has a scene whose "Leaves" is Scrub out, so its
 * code reaches no other page. It draws NOTHING (not even a marker — an element among the scenes would be one more
 * thing for the page's own rules to trip on). After the page is interactive it fetches the engine — its own chunk,
 * the one request this feature makes — and arms it on every scenes block of the page that has a hand-over. Without
 * it (no script, a blocked chunk, "reduce motion") the page is the plain page: everything visible, nothing held
 * (`hub-scrub-engine.ts`).
 */
const armed = new WeakSet<Element>();

export function HubScrub() {
  useEffect(() => {
    const stops: Array<() => void> = [];
    let gone = false;
    void import('./hub-scrub-engine')
      .then((m) => {
        if (gone) return;
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
      })
      .catch(() => {
        /* The plain page stands. */
      });
    return () => {
      gone = true;
      for (const stop of stops) stop();
    };
  }, []);
  return null;
}
