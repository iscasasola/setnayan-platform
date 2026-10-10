'use client';

import { useEffect, useRef } from 'react';

/**
 * 🚪 WHEN THE DOCKED DOOR OPENS, IT COMES INTO VIEW.
 *
 * "Get inside" docks above the bottom bar while its own place is still below
 * the screen (`.sn-door-dock`, globals.css). Opened, it goes back to its place
 * in the page — its two choices need the room, and must not be drawn over the
 * cover's words. On a short phone that place is below the fold, so the press
 * would make the button vanish. This brings it into view instead: the least
 * scroll that shows the whole open door, clear of the bar (the dock's own
 * `scroll-margin-bottom`).
 *
 * Draws nothing. Without script the door still opens — a `<details>` — it is
 * only not scrolled to.
 */
export function DoorOpensInView() {
  const mark = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const door = mark.current?.closest('details');
    if (!door) return;
    const onToggle = () => {
      if (!door.open) return;
      const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      door.scrollIntoView({ block: 'nearest', behavior: calm ? 'auto' : 'smooth' });
    };
    door.addEventListener('toggle', onToggle);
    return () => door.removeEventListener('toggle', onToggle);
  }, []);
  return <span ref={mark} hidden />;
}
