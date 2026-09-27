'use client';

import { useEffect } from 'react';

/**
 * TAP A CHAPTER ON THE PAGE → THE PANEL SCROLLS TO IT.
 *
 * In the Maker, Love Story's page (the scrapbook) is drawn in the same document
 * as its panel — not in the guest-page iframe the stages use — so the
 * `editor-bridge` postMessage pattern is not needed: one click listener reads
 * which chapter (`data-love-story-chapter`, on each book chapter) was tapped
 * and scrolls ONLY the panel's own scroll box to the same chapter
 * (`data-love-story-panel-chapter`). The window never moves, so on a phone the
 * page the couple is looking at stays put.
 */
export function PanelFollowsThePage() {
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const t = e.target as Element | null;
      const section = t?.closest?.('[data-maker-love-story-book] [data-love-story-chapter]');
      const chapter = section?.getAttribute('data-love-story-chapter');
      if (!chapter) return;
      const row = document.querySelector<HTMLElement>(`[data-love-story-panel-chapter="${chapter}"]`);
      const box = row ? scrollBox(row) : null;
      if (!row || !box) return;
      const top = row.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - 8;
      box.scrollTo({ top, behavior: 'smooth' });
    };
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, []);
  return null;
}

/** The nearest ancestor that scrolls on its own. */
function scrollBox(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const oy = getComputedStyle(p).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight) return p;
  }
  return null;
}
