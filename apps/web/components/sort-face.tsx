import { SlidersHorizontal } from 'lucide-react';

/**
 * 🎚 THE THUMB ROW'S SORT / SHOW FACE — the sliders in the row's round, and a DOT while a choice other than the
 * default is on (owner 19 Nov 2026: "circle + dot on the thumb row"). The same face and the same dot the Guests
 * round (`FilterFace`) and the Portfolio round already draw: sliders at stroke 1.9, an 8 px terracotta dot at the
 * top right. ONE colour for the dot everywhere — terracotta, the shipped one.
 * 🔒 lib/sort-icon-is-sliders.test.ts
 */
export function SortFace({ on, size = 18 }: { on: boolean; size?: 18 | 20 }) {
  const box = size === 20 ? 'h-5 w-5' : 'h-[18px] w-[18px]';
  return (
    <span aria-hidden className={`relative inline-flex ${box}`} data-sort-face={on ? 'on' : 'off'}>
      <SlidersHorizontal className={box} strokeWidth={1.9} />
      {on ? <i className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-terracotta" /> : null}
    </span>
  );
}
